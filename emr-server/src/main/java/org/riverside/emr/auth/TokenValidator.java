package org.riverside.emr.auth;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.exceptions.JWTVerificationException;
import com.auth0.jwt.interfaces.DecodedJWT;

import java.security.interfaces.RSAPublicKey;
import java.util.Collection;
import java.util.List;
import java.util.function.Function;

/**
 * Validates OAuth2 access tokens (JWTs) the way a FHIR resource server is
 * supposed to: RS256 signature against the issuer's published keys (JWKS),
 * expiry, and issuer. This is the foundation SMART on FHIR builds on -
 * scopes like patient/Observation.read would be checked on top of this.
 *
 * The key lookup is injected as a function (kid -> public key) so tests can
 * use a locally generated key pair instead of a live JWKS endpoint.
 */
public class TokenValidator {

    private final Function<String, RSAPublicKey> keyResolver;
    private final List<String> acceptedIssuers;

    public TokenValidator(Function<String, RSAPublicKey> keyResolver,
                          Collection<String> acceptedIssuers) {
        this.keyResolver = keyResolver;
        this.acceptedIssuers = List.copyOf(acceptedIssuers);
    }

    /**
     * @return the decoded, verified token
     * @throws JWTVerificationException if the token is invalid for any reason
     */
    public DecodedJWT validate(String token) {
        DecodedJWT unverified = JWT.decode(token);
        RSAPublicKey publicKey = keyResolver.apply(unverified.getKeyId());
        if (publicKey == null) {
            throw new JWTVerificationException("Unknown signing key: " + unverified.getKeyId());
        }
        // Verifies signature and rejects expired tokens; withIssuer(varargs)
        // accepts any of the listed issuers (the same Keycloak realm has a
        // different issuer URL from inside the compose network vs. the host).
        return JWT.require(Algorithm.RSA256(publicKey, null))
                .withIssuer(acceptedIssuers.toArray(String[]::new))
                .build()
                .verify(token);
    }
}
