package org.riverside.dashboard;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Instant;

/**
 * Fetches OAuth2 access tokens from Keycloak using the client_credentials
 * grant - how one backend service authenticates to another (no user
 * involved). Configured by environment variables; when OAUTH_TOKEN_URL is
 * unset the dashboard runs tokenless, matching an EMR with AUTH_ENABLED=false.
 *
 *   OAUTH_TOKEN_URL      e.g. http://keycloak:8080/realms/riverside/protocol/openid-connect/token
 *   OAUTH_CLIENT_ID      default ward-dashboard
 *   OAUTH_CLIENT_SECRET  the client secret from the realm
 *
 * Tokens are cached until shortly before expiry - never fetch a fresh token
 * per request, identity providers are rate-limited in real life.
 */
public class TokenClient {

    private static final Logger log = LoggerFactory.getLogger(TokenClient.class);
    private static final ObjectMapper JSON = new ObjectMapper();

    /** Refresh this many seconds before the token actually expires. */
    private static final long EXPIRY_MARGIN_SECONDS = 30;

    private final String tokenUrl;
    private final String clientId;
    private final String clientSecret;
    private final HttpClient http;

    private String cachedToken;
    private Instant cachedTokenExpiry = Instant.EPOCH;

    public static TokenClient fromEnv(HttpClient http) {
        return new TokenClient(
                System.getenv("OAUTH_TOKEN_URL"),
                System.getenv().getOrDefault("OAUTH_CLIENT_ID", "ward-dashboard"),
                System.getenv().getOrDefault("OAUTH_CLIENT_SECRET", ""),
                http);
    }

    public TokenClient(String tokenUrl, String clientId, String clientSecret, HttpClient http) {
        this.tokenUrl = tokenUrl;
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.http = http;
    }

    public boolean enabled() {
        return tokenUrl != null && !tokenUrl.isBlank();
    }

    /** @return a valid access token, from cache when possible. */
    public synchronized String accessToken() throws IOException, InterruptedException {
        if (cachedToken != null && Instant.now().isBefore(cachedTokenExpiry)) {
            return cachedToken;
        }
        String form = "grant_type=client_credentials"
                + "&client_id=" + URLEncoder.encode(clientId, StandardCharsets.UTF_8)
                + "&client_secret=" + URLEncoder.encode(clientSecret, StandardCharsets.UTF_8);
        HttpRequest request = HttpRequest.newBuilder(URI.create(tokenUrl))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(form))
                .build();
        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new IOException("Token endpoint returned HTTP " + response.statusCode()
                    + ": " + response.body());
        }
        JsonNode node = JSON.readTree(response.body());
        cachedToken = node.get("access_token").asText();
        long expiresIn = node.has("expires_in") ? node.get("expires_in").asLong() : 60;
        cachedTokenExpiry = Instant.now().plusSeconds(
                Math.max(expiresIn - EXPIRY_MARGIN_SECONDS, 5));
        log.debug("Fetched new access token for '{}', valid {}s", clientId, expiresIn);
        return cachedToken;
    }
}
