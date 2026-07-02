package org.riverside.emr.sim;

import org.riverside.emr.entity.EncounterEntity;
import org.riverside.emr.entity.EventEntity;
import org.riverside.emr.entity.ObservationEntity;
import org.riverside.emr.entity.PatientEntity;
import org.riverside.emr.entity.PractitionerEntity;
import org.riverside.emr.persistence.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Random;

/**
 * Generates realistic-looking clinical activity: admissions, lab results
 * and discharges. Every action also writes an {@link EventEntity} to the
 * outbox so the message feed can broadcast it as a FHIR message Bundle.
 */
public class ClinicalSimulator {

    private static final List<String> WARDS = List.of(
            "3 East - Internal Medicine", "4 West - Cardiology",
            "2 North - Surgery", "ED Observation", "5 South - Oncology");

    private static final List<String> REASONS = List.of(
            "Community-acquired pneumonia", "Chest pain, rule out ACS",
            "Acute appendicitis", "Hyperglycemia work-up",
            "Syncope", "Cellulitis of lower limb", "COPD exacerbation");

    private final Repository repository;
    private final Random random;

    public ClinicalSimulator(Repository repository, Random random) {
        this.repository = repository;
        this.random = random;
    }

    /** Admits a patient who is not currently in-house. */
    public Optional<EncounterEntity> admitRandomPatient() {
        List<PatientEntity> candidates = repository.findPatients(null, null).stream()
                .filter(p -> repository.findEncounters(p.getId(), "in-progress").isEmpty())
                .toList();
        if (candidates.isEmpty()) {
            return Optional.empty();
        }
        PatientEntity patient = candidates.get(random.nextInt(candidates.size()));
        return Optional.of(admit(patient));
    }

    public EncounterEntity admit(PatientEntity patient) {
        List<PractitionerEntity> practitioners = repository.findAllPractitioners();

        EncounterEntity encounter = new EncounterEntity();
        encounter.setPatient(patient);
        if (!practitioners.isEmpty()) {
            encounter.setAttending(practitioners.get(random.nextInt(practitioners.size())));
        }
        encounter.setStatus("in-progress");
        encounter.setClassCode("IMP");
        encounter.setLocation(WARDS.get(random.nextInt(WARDS.size()))
                + ", Bed " + (1 + random.nextInt(24)));
        encounter.setReason(REASONS.get(random.nextInt(REASONS.size())));
        encounter.setPeriodStart(Instant.now());
        repository.save(encounter);

        queueEvent(EventEntity.Type.ADMIT, patient.getId(), encounter.getId(), null);
        return encounter;
    }

    /** Discharges a random in-house patient (ends the encounter). */
    public Optional<EncounterEntity> dischargeRandomPatient() {
        List<EncounterEntity> active = repository.findEncounters(null, "in-progress");
        if (active.isEmpty()) {
            return Optional.empty();
        }
        EncounterEntity encounter = active.get(random.nextInt(active.size()));
        encounter.setStatus("finished");
        encounter.setPeriodEnd(Instant.now());
        encounter = repository.update(encounter);

        queueEvent(EventEntity.Type.DISCHARGE, encounter.getPatient().getId(),
                encounter.getId(), null);
        return Optional.of(encounter);
    }

    /**
     * Produces a final lab result for an in-house patient (or any patient if
     * nobody is admitted) - the ORU^R01 analog.
     */
    public Optional<ObservationEntity> produceRandomLabResult() {
        List<EncounterEntity> active = repository.findEncounters(null, "in-progress");
        PatientEntity patient;
        EncounterEntity encounter = null;
        if (!active.isEmpty()) {
            encounter = active.get(random.nextInt(active.size()));
            patient = encounter.getPatient();
        } else {
            List<PatientEntity> patients = repository.findPatients(null, null);
            if (patients.isEmpty()) {
                return Optional.empty();
            }
            patient = patients.get(random.nextInt(patients.size()));
        }
        return Optional.of(recordObservation(patient, encounter,
                LabCatalog.randomLab(random), Instant.now(), true));
    }

    public ObservationEntity recordObservation(PatientEntity patient,
                                               EncounterEntity encounter,
                                               LabCatalog.Test test,
                                               Instant effectiveTime,
                                               boolean publishEvent) {
        ObservationEntity obs = new ObservationEntity();
        obs.setPatient(patient);
        obs.setEncounter(encounter);
        obs.setCategory(test.category());
        obs.setLoincCode(test.loinc());
        obs.setDisplay(test.display());
        obs.setValue(test.randomValue(random));
        obs.setUnit(test.unit());
        obs.setReferenceLow(test.low());
        obs.setReferenceHigh(test.high());
        obs.setEffectiveTime(effectiveTime);
        repository.save(obs);

        if (publishEvent) {
            queueEvent(EventEntity.Type.LAB_RESULT, patient.getId(),
                    encounter != null ? encounter.getId() : null, obs.getId());
        }
        return obs;
    }

    private void queueEvent(EventEntity.Type type, Long patientId,
                            Long encounterId, Long observationId) {
        EventEntity event = new EventEntity();
        event.setType(type);
        event.setPatientId(patientId);
        event.setEncounterId(encounterId);
        event.setObservationId(observationId);
        event.setCreatedAt(Instant.now());
        repository.save(event);
    }
}
