package org.riverside.emr.ingest;

import ca.uhn.fhir.rest.server.exceptions.InvalidRequestException;
import org.hl7.fhir.r4.model.Bundle;
import org.hl7.fhir.r4.model.Encounter;
import org.hl7.fhir.r4.model.MessageHeader;
import org.hl7.fhir.r4.model.Observation;
import org.hl7.fhir.r4.model.Patient;
import org.hl7.fhir.r4.model.Resource;
import org.riverside.emr.entity.EncounterEntity;
import org.riverside.emr.entity.EventEntity;
import org.riverside.emr.entity.ObservationEntity;
import org.riverside.emr.entity.PatientEntity;
import org.riverside.emr.persistence.Repository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

/**
 * Applies an inbound FHIR message Bundle (typically translated from HL7 v2
 * by the Mirth channel) to the EMR database:
 *
 *   admit       upsert patient by MRN, open an encounter
 *   discharge   close the patient's in-progress encounter
 *   lab-result  store the observation (linked to the active encounter if any)
 *
 * Every applied message also writes an outbox event, so inbound v2 traffic
 * re-emerges on the dashboard's message feed - the full round trip:
 * v2 sender -> MLLP -> Mirth -> $process-message -> DB -> feed.
 */
public class IngestService {

    private static final Logger log = LoggerFactory.getLogger(IngestService.class);

    private final Repository repository;

    public IngestService(Repository repository) {
        this.repository = repository;
    }

    /** Returns a human-readable disposition, used in the ACK message. */
    public String apply(Bundle message) {
        if (message.getType() != Bundle.BundleType.MESSAGE) {
            throw new InvalidRequestException("Bundle.type must be 'message', got: " + message.getType());
        }
        MessageHeader header = firstResource(message, MessageHeader.class)
                .orElseThrow(() -> new InvalidRequestException(
                        "message Bundle must start with a MessageHeader"));
        Patient patient = firstResource(message, Patient.class)
                .orElseThrow(() -> new InvalidRequestException(
                        "message Bundle must contain a Patient"));

        String eventCode = header.getEventCoding().getCode();
        PatientEntity patientEntity = upsertPatient(patient);

        return switch (eventCode) {
            case "admit" -> admit(patientEntity, firstResource(message, Encounter.class));
            case "discharge" -> discharge(patientEntity);
            case "lab-result" -> labResult(patientEntity,
                    firstResource(message, Observation.class).orElseThrow(
                            () -> new InvalidRequestException("lab-result message needs an Observation")));
            default -> throw new InvalidRequestException("Unsupported message event: " + eventCode);
        };
    }

    /** MRN is the matching key - same idea as v2 patient identity resolution. */
    private PatientEntity upsertPatient(Patient patient) {
        String mrn = patient.getIdentifierFirstRep().getValue();
        if (mrn == null || mrn.isBlank()) {
            throw new InvalidRequestException("Patient.identifier (MRN) is required");
        }
        List<PatientEntity> existing = repository.findPatients(null, mrn);
        if (!existing.isEmpty()) {
            return existing.get(0);
        }
        PatientEntity entity = new PatientEntity();
        entity.setMrn(mrn);
        entity.setFamilyName(orDefault(patient.getNameFirstRep().getFamily(), "Unknown"));
        entity.setGivenName(patient.getNameFirstRep().getGiven().isEmpty()
                ? "Unknown" : patient.getNameFirstRep().getGiven().get(0).getValue());
        entity.setGender(patient.getGender() != null ? patient.getGender().toCode() : "unknown");
        entity.setBirthDate(patient.hasBirthDate()
                ? patient.getBirthDate().toInstant().atZone(ZoneOffset.UTC).toLocalDate()
                : LocalDate.of(1900, 1, 1));
        if (patient.hasTelecom()) {
            entity.setPhone(patient.getTelecomFirstRep().getValue());
        }
        repository.save(entity);
        log.info("Registered new patient {} ({})", entity.displayName(), mrn);
        return entity;
    }

    private String admit(PatientEntity patient, Optional<Encounter> encounterResource) {
        if (!repository.findEncounters(patient.getId(), "in-progress").isEmpty()) {
            return "patient " + patient.getMrn() + " is already admitted - message ignored";
        }
        EncounterEntity encounter = new EncounterEntity();
        encounter.setPatient(patient);
        encounter.setStatus("in-progress");
        encounter.setClassCode("IMP");
        encounter.setPeriodStart(Instant.now());
        encounterResource.ifPresent(e -> {
            if (e.hasLocation()) {
                encounter.setLocation(e.getLocationFirstRep().getLocation().getDisplay());
            }
            if (e.hasReasonCode()) {
                encounter.setReason(e.getReasonCodeFirstRep().getText());
            }
            if (e.hasClass_() && e.getClass_().hasCode()) {
                encounter.setClassCode(e.getClass_().getCode());
            }
        });
        repository.save(encounter);
        queueEvent(EventEntity.Type.ADMIT, patient.getId(), encounter.getId(), null);
        return "admitted " + patient.displayName() + " (" + patient.getMrn() + ")";
    }

    private String discharge(PatientEntity patient) {
        List<EncounterEntity> active = repository.findEncounters(patient.getId(), "in-progress");
        if (active.isEmpty()) {
            return "patient " + patient.getMrn() + " has no open encounter - message ignored";
        }
        EncounterEntity encounter = active.get(0);
        encounter.setStatus("finished");
        encounter.setPeriodEnd(Instant.now());
        repository.update(encounter);
        queueEvent(EventEntity.Type.DISCHARGE, patient.getId(), encounter.getId(), null);
        return "discharged " + patient.displayName() + " (" + patient.getMrn() + ")";
    }

    private String labResult(PatientEntity patient, Observation observation) {
        ObservationEntity entity = new ObservationEntity();
        entity.setPatient(patient);
        repository.findEncounters(patient.getId(), "in-progress").stream()
                .findFirst().ifPresent(entity::setEncounter);
        entity.setCategory("laboratory");
        entity.setLoincCode(orDefault(observation.getCode().getCodingFirstRep().getCode(), "unknown"));
        entity.setDisplay(orDefault(observation.getCode().getCodingFirstRep().getDisplay(),
                observation.getCode().getText()));
        entity.setValue(observation.hasValueQuantity()
                ? observation.getValueQuantity().getValue().doubleValue() : 0.0);
        entity.setUnit(orDefault(observation.hasValueQuantity()
                ? observation.getValueQuantity().getUnit() : null, ""));
        if (observation.hasReferenceRange()) {
            var range = observation.getReferenceRangeFirstRep();
            if (range.hasLow()) {
                entity.setReferenceLow(range.getLow().getValue().doubleValue());
            }
            if (range.hasHigh()) {
                entity.setReferenceHigh(range.getHigh().getValue().doubleValue());
            }
        }
        entity.setEffectiveTime(observation.hasEffectiveDateTimeType()
                ? observation.getEffectiveDateTimeType().getValue().toInstant()
                : Instant.now());
        repository.save(entity);
        queueEvent(EventEntity.Type.LAB_RESULT, patient.getId(),
                entity.getEncounter() != null ? entity.getEncounter().getId() : null,
                entity.getId());
        return "stored " + entity.getDisplay() + " = " + entity.getValue() + " " + entity.getUnit()
                + " for " + patient.displayName();
    }

    private void queueEvent(EventEntity.Type type, Long patientId, Long encounterId, Long observationId) {
        EventEntity event = new EventEntity();
        event.setType(type);
        event.setPatientId(patientId);
        event.setEncounterId(encounterId);
        event.setObservationId(observationId);
        event.setCreatedAt(Instant.now());
        repository.save(event);
    }

    private static <T extends Resource> Optional<T> firstResource(Bundle bundle, Class<T> type) {
        return bundle.getEntry().stream()
                .map(Bundle.BundleEntryComponent::getResource)
                .filter(type::isInstance)
                .map(type::cast)
                .findFirst();
    }

    private static String orDefault(String value, String fallback) {
        return value != null && !value.isBlank() ? value : fallback;
    }
}
