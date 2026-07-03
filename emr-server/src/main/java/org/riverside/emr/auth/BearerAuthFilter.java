package org.riverside.emr.auth;

import com.auth0.jwk.JwkException;
import com.auth0.jwk.JwkProvider;
import com.auth0.jwk.JwkProviderBuilder;
import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.FilterConfig;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.annotation.WebFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.net.URL;
import java.security.interfaces.RSAPublicKey;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * OAuth2 resource-server guard for the EMR's API. Enabled by environment
 * variables (all off by default so the playground runs without Keycloak):
 *
 *   AUTH_ENABLED   "true" to enforce Bearer tokens
 *   AUTH_ISSUER    comma-separated accepted issuers, e.g.
 *                  http://keycloak:8080/realms/riverside,http://localhost:8085/realms/riverside
 *   AUTH_JWKS_URL  where to fetch the realm's signing keys; defaults to
 *                  [first issuer]/protocol/openid-connect/certs
 *
 * GET /fhir/metadata stays open: per the FHIR spec the CapabilityStatement
 * SHOULD be publicly readable (SMART clients discover endpoints through it).
 * Failures answer 401 with a FHIR OperationOutcome, like real FHIR servers.
 */
@WebFilter(urlPatterns = {"/fhir/*", "/messages/*", "/simulate/*"})
public class BearerAuthFilter implements Filter {

    private static final Logger log = LoggerFactory.getLogger(BearerAuthFilter.class);

    private boolean enabled;
    private TokenValidator validator;

    @Override
    public void init(FilterConfig filterConfig) throws ServletException {
        enabled = Boolean.parseBoolean(System.getenv().getOrDefault("AUTH_ENABLED", "false"));
        if (!enabled) {
            log.info("Bearer token authentication is DISABLED (set AUTH_ENABLED=true to enforce)");
            return;
        }
        List<String> issuers = Arrays.stream(
                        System.getenv().getOrDefault("AUTH_ISSUER",
                                "http://keycloak:8080/realms/riverside").split(","))
                .map(String::trim).filter(s -> !s.isEmpty()).toList();
        String jwksUrl = System.getenv().getOrDefault("AUTH_JWKS_URL",
                issuers.get(0) + "/protocol/openid-connect/certs");
        try {
            // Cached + rate-limited so we don't hammer Keycloak per request.
            JwkProvider jwkProvider = new JwkProviderBuilder(new URL(jwksUrl))
                    .cached(10, 24, TimeUnit.HOURS)
                    .rateLimited(10, 1, TimeUnit.MINUTES)
                    .build();
            validator = new TokenValidator(kid -> resolveKey(jwkProvider, kid), issuers);
        } catch (Exception e) {
            throw new ServletException("Invalid AUTH_JWKS_URL: " + jwksUrl, e);
        }
        log.info("Bearer token authentication ENABLED; issuers={} jwks={}", issuers, jwksUrl);
    }

    private static RSAPublicKey resolveKey(JwkProvider provider, String kid) {
        try {
            return (RSAPublicKey) provider.get(kid).getPublicKey();
        } catch (JwkException e) {
            log.warn("Could not resolve signing key '{}': {}", kid, e.getMessage());
            return null;
        }
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest req = (HttpServletRequest) request;
        HttpServletResponse resp = (HttpServletResponse) response;

        if (!enabled || isCapabilityStatement(req)) {
            chain.doFilter(request, response);
            return;
        }

        String header = req.getHeader("Authorization");
        if (header == null || !header.regionMatches(true, 0, "Bearer ", 0, 7)) {
            reject(resp, "No Bearer token provided");
            return;
        }
        try {
            var jwt = validator.validate(header.substring(7).trim());
            // Make the caller identity available downstream (and in logs).
            request.setAttribute("auth.subject", jwt.getSubject());
            String client = jwt.getClaim("azp").asString();
            log.debug("Authenticated request from client '{}' for {}", client, req.getRequestURI());
            chain.doFilter(request, response);
        } catch (Exception e) {
            reject(resp, "Token rejected: " + e.getMessage());
        }
    }

    private static boolean isCapabilityStatement(HttpServletRequest req) {
        String path = req.getRequestURI();
        return "GET".equals(req.getMethod()) && path.endsWith("/fhir/metadata");
    }

    private static void reject(HttpServletResponse resp, String message) throws IOException {
        resp.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        resp.setHeader("WWW-Authenticate", "Bearer realm=\"riverside\"");
        resp.setContentType("application/fhir+json;charset=UTF-8");
        resp.getWriter().write("""
                {
                  "resourceType": "OperationOutcome",
                  "issue": [ {
                    "severity": "error",
                    "code": "login",
                    "diagnostics": "%s"
                  } ]
                }""".formatted(message.replace("\"", "'")));
    }
}
