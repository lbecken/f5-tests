package org.riverside.emr;

import ca.uhn.fhir.context.FhirContext;
import org.hl7.fhir.r4.model.Bundle;
import org.hl7.fhir.r4.model.MessageHeader;
import org.hl7.fhir.r4.model.Observation;
import org.hl7.fhir.r4.model.Patient;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.riverside.emr.bootstrap.StartupListener;
import org.riverside.emr.entity.EventEntity;
import org.riverside.emr.fhir.FhirMapper;
import org.riverside.emr.messaging.MessageBuilder;
import org.riverside.emr.persistence.Db;
import org.riverside.emr.persistence.Repository;
import org.riverside.emr.sim.ClinicalSimulator;

import java.util.Random;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * End-to-end (minus the servlet container): seeds the in-memory H2 database
 * exactly the way the webapp does on startup, then exercises the FHIR
 * mapping, the simulator and the message builder.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class EmrFlowTest {

    private static final FhirContext FHIR = FhirContext.forR4Cached();

    private final Repository repository = new Repository();

    @BeforeAll
    void seed() {
        // No DB_URL in the test environment -> Db falls back to in-memory H2.
        StartupListener.seed(repository, new Random(7));
    }

    @AfterAll
    void shutdown() {
        Db.shutdown();
    }

    @Test
    void seedsPatientPanelWithInpatients() {
        assertEquals(6, repository.countPatients());
        assertEquals(2, repository.findEncounters(null, "in-progress").size());
        assertFalse(repository.findObservations(null, null).isEmpty(),
                "seed should record vitals and labs");
    }

    @Test
    void mapsPatientEntityToFhirWithMrnIdentifier() {
        var entity = repository.findPatients(null, "MRN-100234").get(0);
        Patient patient = FhirMapper.toFhir(entity);

        assertEquals("MRN-100234", patient.getIdentifierFirstRep().getValue());
        assertEquals(FhirMapper.MRN_SYSTEM, patient.getIdentifierFirstRep().getSystem());
        assertEquals("Jane Diaz", patient.getNameFirstRep().getNameAsSingleString());
    }

    @Test
    void observationsCarryLoincAndUcumAndOutOfRangeFlags() {
        var entity = repository.findObservations(null, null).get(0);
        Observation observation = FhirMapper.toFhir(entity);

        assertEquals(FhirMapper.LOINC, observation.getCode().getCodingFirstRep().getSystem());
        assertEquals(FhirMapper.UCUM, observation.getValueQuantity().getSystem());
        assertTrue(observation.hasReferenceRange());
        boolean outOfRange = entity.getValue() < entity.getReferenceLow()
                || entity.getValue() > entity.getReferenceHigh();
        assertEquals(outOfRange, observation.hasInterpretation());
    }

    @Test
    void labEventBecomesAValidFhirMessageBundle() {
        // Queue a lab result of our own, then drain the outbox until we
        // reach a lab event (earlier entries may be seeded admits).
        new ClinicalSimulator(repository, new Random(3)).produceRandomLabResult().orElseThrow();
        EventEntity event;
        do {
            event = repository.popNextUndeliveredEvent().orElseThrow();
        } while (event.getType() != EventEntity.Type.LAB_RESULT);

        Bundle bundle = new MessageBuilder(repository).build(event);

        assertEquals(Bundle.BundleType.MESSAGE, bundle.getType());
        assertInstanceOf(MessageHeader.class, bundle.getEntryFirstRep().getResource(),
                "first entry of a message Bundle must be the MessageHeader");

        MessageHeader header = (MessageHeader) bundle.getEntryFirstRep().getResource();
        assertEquals("lab-result", header.getEventCoding().getCode());
        assertTrue(header.getFocus().size() >= 2,
                "focus = Patient + Observation (+ Encounter when admitted)");
        assertEquals(bundle.getEntry().size() - 1, header.getFocus().size(),
                "every non-header entry is referenced from MessageHeader.focus");

        // Round-trips through the JSON parser without loss of the event code.
        String encoded = FHIR.newJsonParser().encodeResourceToString(bundle);
        Bundle reparsed = (Bundle) FHIR.newJsonParser().parseResource(encoded);
        MessageHeader reparsedHeader = (MessageHeader) reparsed.getEntryFirstRep().getResource();
        assertEquals("lab-result", reparsedHeader.getEventCoding().getCode());
    }

    @Test
    void simulatorDrivesAdmitAndDischargeLifecycle() {
        ClinicalSimulator simulator = new ClinicalSimulator(repository, new Random(11));
        long before = repository.countUndeliveredEvents();

        var admitted = simulator.admitRandomPatient();
        assertTrue(admitted.isPresent(), "4 of 6 seeded patients are not admitted");
        assertEquals("in-progress", admitted.get().getStatus());

        var discharged = simulator.dischargeRandomPatient();
        assertTrue(discharged.isPresent());
        assertEquals("finished", discharged.get().getStatus());
        assertNotNull(discharged.get().getPeriodEnd());

        assertEquals(before + 2, repository.countUndeliveredEvents());
        assertFalse(repository.findEncounters(null, "in-progress").size() > 6);
    }
}
