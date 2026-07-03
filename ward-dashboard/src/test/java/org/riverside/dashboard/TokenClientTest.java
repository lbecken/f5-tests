package org.riverside.dashboard;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Exercises the client_credentials flow against a stub token endpoint. */
class TokenClientTest {

    private static HttpServer server;
    private static final AtomicInteger tokenRequests = new AtomicInteger();

    @BeforeAll
    static void startStubKeycloak() throws Exception {
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/token", exchange -> {
            String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            int n = tokenRequests.incrementAndGet();
            byte[] response = ("{\"access_token\":\"token-" + n
                    + "\",\"expires_in\":3600,\"token_type\":\"Bearer\"}")
                    .getBytes(StandardCharsets.UTF_8);
            assertTrue(body.contains("grant_type=client_credentials"));
            assertTrue(body.contains("client_id=ward-dashboard"));
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(response);
            }
        });
        server.start();
    }

    @AfterAll
    static void stop() {
        server.stop(0);
    }

    @Test
    void fetchesAndCachesToken() throws Exception {
        String url = "http://localhost:" + server.getAddress().getPort() + "/token";
        TokenClient client = new TokenClient(url, "ward-dashboard", "secret",
                HttpClient.newHttpClient());

        assertTrue(client.enabled());
        int before = tokenRequests.get();
        String first = client.accessToken();
        String second = client.accessToken();
        assertEquals(first, second, "second call must come from the cache");
        assertEquals(before + 1, tokenRequests.get(), "only one token request expected");
    }

    @Test
    void disabledWithoutTokenUrl() {
        assertFalse(new TokenClient(null, "x", "y", HttpClient.newHttpClient()).enabled());
        assertFalse(new TokenClient(" ", "x", "y", HttpClient.newHttpClient()).enabled());
    }
}
