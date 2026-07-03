package org.riverside.emr.auth;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.exceptions.JWTVerificationException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * Validates the resource-server logic with a locally generated key pair -
 * the same RS256 mechanics Keycloak uses, minus the HTTP fetch of the JWKS.
 */
class TokenValidatorTest {

    private static final String ISSUER = "http://keycloak:8080/realms/riverside";
    private static final String KID = "test-key-1";

    private static RSAPublicKey publicKey;
    private static RSAPrivateKey privateKey;
    private static TokenValidator validator;

    @BeforeAll
    static void generateRealmKey() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        KeyPair pair = generator.generateKeyPair();
        publicKey = (RSAPublicKey) pair.getPublic();
        privateKey = (RSAPrivateKey) pair.getPrivate();

        Function<String, RSAPublicKey> keyResolver =
                kid -> Map.of(KID, publicKey).get(kid);
        validator = new TokenValidator(keyResolver,
                List.of(ISSUER, "http://localhost:8085/realms/riverside"));
    }

    private static String token(String issuer, String kid, Instant expiresAt) {
        return JWT.create()
                .withKeyId(kid)
                .withIssuer(issuer)
                .withSubject("service-account-ward-dashboard")
                .withClaim("azp", "ward-dashboard")
                .withExpiresAt(expiresAt)
                .sign(Algorithm.RSA256(publicKey, privateKey));
    }

    @Test
    void acceptsValidTokenFromEitherIssuerUrl() {
        var jwt = validator.validate(token(ISSUER, KID, Instant.now().plusSeconds(300)));
        assertEquals("ward-dashboard", jwt.getClaim("azp").asString());

        // Same realm reached via the host-mapped port has a different issuer.
        validator.validate(token("http://localhost:8085/realms/riverside", KID,
                Instant.now().plusSeconds(300)));
    }

    @Test
    void rejectsExpiredToken() {
        String expired = token(ISSUER, KID, Instant.now().minusSeconds(120));
        assertThrows(JWTVerificationException.class, () -> validator.validate(expired));
    }

    @Test
    void rejectsWrongIssuer() {
        String foreign = token("http://evil.example/realms/riverside", KID,
                Instant.now().plusSeconds(300));
        assertThrows(JWTVerificationException.class, () -> validator.validate(foreign));
    }

    @Test
    void rejectsUnknownSigningKey() {
        String unknownKid = token(ISSUER, "some-other-key", Instant.now().plusSeconds(300));
        assertThrows(JWTVerificationException.class, () -> validator.validate(unknownKid));
    }

    @Test
    void rejectsTokenSignedWithADifferentKey() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        KeyPair attacker = generator.generateKeyPair();
        String forged = JWT.create()
                .withKeyId(KID)
                .withIssuer(ISSUER)
                .withExpiresAt(Instant.now().plusSeconds(300))
                .sign(Algorithm.RSA256((RSAPublicKey) attacker.getPublic(),
                        (RSAPrivateKey) attacker.getPrivate()));
        assertThrows(JWTVerificationException.class, () -> validator.validate(forged));
    }

    @Test
    void rejectsGarbage() {
        assertThrows(Exception.class, () -> validator.validate("not-a-jwt"));
    }
}
