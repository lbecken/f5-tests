package org.riverside.emr.fhir;

import ca.uhn.fhir.context.FhirContext;
import ca.uhn.fhir.rest.server.RestfulServer;
import ca.uhn.fhir.rest.server.interceptor.ResponseHighlighterInterceptor;
import jakarta.servlet.annotation.WebServlet;

import java.util.List;

/**
 * The FHIR R4 endpoint of the EMR, at [context]/fhir/*.
 *
 * HAPI's RestfulServer handles content negotiation (JSON/XML), search
 * parameter parsing, paging, the CapabilityStatement at /fhir/metadata,
 * and even a syntax-highlighted HTML view when opened in a browser.
 */
@WebServlet(urlPatterns = "/fhir/*", loadOnStartup = 1)
public class EmrFhirServlet extends RestfulServer {

    public EmrFhirServlet() {
        super(FhirContext.forR4Cached());
    }

    @Override
    protected void initialize() {
        var repository = new org.riverside.emr.persistence.Repository();
        setResourceProviders(List.of(
                new PatientProvider(repository),
                new PractitionerProvider(repository),
                new EncounterProvider(repository),
                new ObservationProvider(repository)));

        // POST /fhir/$process-message - inbound messaging (used by Mirth).
        registerProvider(new ProcessMessageProvider(
                new org.riverside.emr.ingest.IngestService(repository)));

        // Pretty HTML when a browser asks for it - handy for exploring.
        registerInterceptor(new ResponseHighlighterInterceptor());
        setDefaultPrettyPrint(true);
        setServerName("Riverside Medical Center EMR (playground)");
        setServerVersion("0.1.0");
    }
}
