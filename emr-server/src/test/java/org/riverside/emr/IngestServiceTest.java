package org.riverside.emr;

import ca.uhn.fhir.context.FhirContext;
import org.hl7.fhir.r4.model.Bundle;
import org.junit.jupiter.api.Test;
import org.riverside.emr.ingest.IngestService;
import org.riverside.emr.persistence.Repository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Feeds the IngestService the exact JSON the Mirth transformer produces
 * (see mirth/transformer.js) and verifies the admit -> lab -> discharge
 * round trip against the database.
 */
class IngestServiceTest {

    private static final FhirContext FHIR = FhirContext.forR4Cached();

    private final Repository repository = new Repository();
    private final IngestService ingest = new IngestService(repository);

    private static final String MRN = "MRN-3001";

    private String message(String eventCode, String extraEntry) {
        return """
                {
                  "resourceType": "Bundle",
                  "type": "message",
                  "entry": [
                    { "fullUrl": "urn:uuid:h1", "resource": {
                        "resourceType": "MessageHeader",
                        "eventCoding": { "system": "https://riverside-medical.example.org/fhir/message-events",
                                         "code": "%s" },
                        "source": { "name": "Mirth Connect (v2 gateway)", "endpoint": "mllp://mirth:6661" } } },
                    { "fullUrl": "urn:uuid:p1", "resource": {
                        "resourceType": "Patient",
                        "identifier": [{ "system": "https://riverside-medical.example.org/mrn", "value": "%s" }],
                        "name": [{ "family": "Petrova", "given": ["Elena"] }],
                        "gender": "female", "birthDate": "1985-02-14" } }%s
                  ]
                }""".formatted(eventCode, MRN, extraEntry);
    }

    @Test
    void v2RoundTripAdmitLabDischarge() {
        long eventsBefore = repository.countUndeliveredEvents();

        // ADT^A01 analog: unknown patient is auto-registered and admitted
        String encounterEntry = """
                ,{ "fullUrl": "urn:uuid:e1", "resource": {
                    "resourceType": "Encounter", "status": "in-progress",
                    "class": { "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode", "code": "IMP" },
                    "location": [{ "location": { "display": "4W, Bed 12" } }],
                    "reasonCode": [{ "text": "Transferred from Community Clinic (HL7 v2 ADT^A01)" }] } }""";
        String disposition = ingest.apply(parse(message("admit", encounterEntry)));
        assertTrue(disposition.contains("admitted"), disposition);

        var patient = repository.findPatients(null, MRN).get(0);
        assertEquals("Elena Petrova", patient.displayName());
        assertEquals(1, repository.findEncounters(patient.getId(), "in-progress").size());

        // duplicate admit is ignored, not duplicated
        assertTrue(ingest.apply(parse(message("admit", encounterEntry))).contains("ignored"));
        assertEquals(1, repository.findEncounters(patient.getId(), "in-progress").size());

        // ORU^R01 analog: lab result links to the open encounter
        String obsEntry = """
                ,{ "fullUrl": "urn:uuid:o1", "resource": {
                    "resourceType": "Observation", "status": "final",
                    "code": { "coding": [{ "system": "http://loinc.org", "code": "2345-7", "display": "Glucose" }] },
                    "valueQuantity": { "value": 112, "unit": "mg/dL" },
                    "referenceRange": [{ "low": { "value": 70 }, "high": { "value": 100 } }] } }""";
        assertTrue(ingest.apply(parse(message("lab-result", obsEntry))).contains("Glucose"));
        var observations = repository.findObservations(patient.getId(), null);
        assertEquals(1, observations.size());
        assertEquals("2345-7", observations.get(0).getLoincCode());
        assertEquals(112.0, observations.get(0).getValue());

        // ADT^A03 analog: discharge closes the encounter
        assertTrue(ingest.apply(parse(message("discharge", ""))).contains("discharged"));
        assertEquals(0, repository.findEncounters(patient.getId(), "in-progress").size());

        // every applied message queued an outbox event for the dashboard feed
        assertEquals(eventsBefore + 3, repository.countUndeliveredEvents());
    }

    private Bundle parse(String json) {
        return (Bundle) FHIR.newJsonParser().parseResource(json);
    }
}
