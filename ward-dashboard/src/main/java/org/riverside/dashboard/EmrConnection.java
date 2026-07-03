package org.riverside.dashboard;

import ca.uhn.fhir.context.FhirContext;
import ca.uhn.fhir.rest.client.api.IGenericClient;
import ca.uhn.fhir.rest.client.interceptor.BearerTokenAuthInterceptor;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;

/**
 * Connection settings for the EMR, from environment variables:
 *
 *   EMR_BASE_URL  base of the EMR webapp, default http://localhost:8080/emr
 *
 * The FHIR endpoint is [EMR_BASE_URL]/fhir; the message feed and the
 * simulation endpoints live next to it.
 */
public final class EmrConnection {

    private static final String BASE_URL =
            System.getenv().getOrDefault("EMR_BASE_URL", "http://localhost:8080/emr");

    /** One FhirContext per JVM - it is expensive to create and thread-safe. */
    public static final FhirContext FHIR = FhirContext.forR4Cached();

    private static final HttpClient HTTP = HttpClient.newHttpClient();

    private static final TokenClient TOKENS = TokenClient.fromEnv(HTTP);

    private EmrConnection() {
    }

    public static String baseUrl() {
        return BASE_URL;
    }

    public static String fhirBaseUrl() {
        return BASE_URL + "/fhir";
    }

    /** A HAPI generic client - the idiomatic Java way to consume a FHIR API. */
    public static IGenericClient fhirClient() {
        IGenericClient client = FHIR.newRestfulGenericClient(fhirBaseUrl());
        if (TOKENS.enabled()) {
            try {
                client.registerInterceptor(new BearerTokenAuthInterceptor(TOKENS.accessToken()));
            } catch (IOException e) {
                throw new RuntimeException("Could not obtain access token from Keycloak", e);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new RuntimeException("Interrupted while obtaining access token", e);
            }
        }
        return client;
    }

    /** Adds the Bearer token to a raw HTTP request when auth is configured. */
    public static HttpRequest.Builder authorize(HttpRequest.Builder builder)
            throws IOException, InterruptedException {
        if (TOKENS.enabled()) {
            builder.header("Authorization", "Bearer " + TOKENS.accessToken());
        }
        return builder;
    }

    public static HttpClient http() {
        return HTTP;
    }

    public static URI uri(String pathAndQuery) {
        return URI.create(BASE_URL + pathAndQuery);
    }
}
