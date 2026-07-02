package org.riverside.dashboard;

import ca.uhn.fhir.context.FhirContext;
import ca.uhn.fhir.rest.client.api.IGenericClient;

import java.net.URI;
import java.net.http.HttpClient;

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
        return FHIR.newRestfulGenericClient(fhirBaseUrl());
    }

    public static HttpClient http() {
        return HTTP;
    }

    public static URI uri(String pathAndQuery) {
        return URI.create(BASE_URL + pathAndQuery);
    }
}
