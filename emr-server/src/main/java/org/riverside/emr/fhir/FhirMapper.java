package org.riverside.emr.fhir;

import org.hl7.fhir.r4.model.Address;
import org.hl7.fhir.r4.model.CodeableConcept;
import org.hl7.fhir.r4.model.Coding;
import org.hl7.fhir.r4.model.ContactPoint;
import org.hl7.fhir.r4.model.Encounter;
import org.hl7.fhir.r4.model.Enumerations;
import org.hl7.fhir.r4.model.HumanName;
import org.hl7.fhir.r4.model.IdType;
import org.hl7.fhir.r4.model.Identifier;
import org.hl7.fhir.r4.model.Observation;
import org.hl7.fhir.r4.model.Patient;
import org.hl7.fhir.r4.model.Period;
import org.hl7.fhir.r4.model.Practitioner;
import org.hl7.fhir.r4.model.Quantity;
import org.hl7.fhir.r4.model.Reference;
import org.riverside.emr.entity.EncounterEntity;
import org.riverside.emr.entity.ObservationEntity;
import org.riverside.emr.entity.PatientEntity;
import org.riverside.emr.entity.PractitionerEntity;

import java.time.ZoneOffset;
import java.util.Date;

/**
 * Maps database entities to FHIR R4 resources. This is where the "FHIR-ness"
 * lives: identifier systems, LOINC/UCUM codings, terminology bindings and
 * references between resources.
 */
public final class FhirMapper {

    /** Identifier systems - in real life these are assigned by the organization / registry. */
    public static final String MRN_SYSTEM = "https://riverside-medical.example.org/mrn";
    public static final String NPI_SYSTEM = "http://hl7.org/fhir/sid/us-npi";

    public static final String LOINC = "http://loinc.org";
    public static final String UCUM = "http://unitsofmeasure.org";
    public static final String OBS_CATEGORY = "http://terminology.hl7.org/CodeSystem/observation-category";
    public static final String V3_ACT_CODE = "http://terminology.hl7.org/CodeSystem/v3-ActCode";

    private FhirMapper() {
    }

    public static Patient toFhir(PatientEntity entity) {
        Patient patient = new Patient();
        patient.setId(new IdType("Patient", entity.getId()));
        patient.addIdentifier(new Identifier()
                .setSystem(MRN_SYSTEM)
                .setValue(entity.getMrn()));
        patient.addName(new HumanName()
                .setFamily(entity.getFamilyName())
                .addGiven(entity.getGivenName()));
        patient.setGender(Enumerations.AdministrativeGender.fromCode(entity.getGender()));
        patient.setBirthDate(Date.from(entity.getBirthDate()
                .atStartOfDay(ZoneOffset.UTC).toInstant()));
        if (entity.getPhone() != null) {
            patient.addTelecom(new ContactPoint()
                    .setSystem(ContactPoint.ContactPointSystem.PHONE)
                    .setValue(entity.getPhone()));
        }
        if (entity.getAddressLine() != null) {
            patient.addAddress(new Address()
                    .addLine(entity.getAddressLine())
                    .setCity(entity.getCity())
                    .setPostalCode(entity.getPostalCode()));
        }
        return patient;
    }

    public static Practitioner toFhir(PractitionerEntity entity) {
        Practitioner practitioner = new Practitioner();
        practitioner.setId(new IdType("Practitioner", entity.getId()));
        practitioner.addIdentifier(new Identifier()
                .setSystem(NPI_SYSTEM)
                .setValue(entity.getNpi()));
        HumanName name = new HumanName()
                .setFamily(entity.getFamilyName())
                .addGiven(entity.getGivenName());
        if (entity.getPrefix() != null) {
            name.addPrefix(entity.getPrefix());
        }
        practitioner.addName(name);
        return practitioner;
    }

    public static Encounter toFhir(EncounterEntity entity) {
        Encounter encounter = new Encounter();
        encounter.setId(new IdType("Encounter", entity.getId()));
        encounter.setStatus(Encounter.EncounterStatus.fromCode(entity.getStatus()));
        encounter.setClass_(new Coding()
                .setSystem(V3_ACT_CODE)
                .setCode(entity.getClassCode())
                .setDisplay(switch (entity.getClassCode()) {
                    case "IMP" -> "inpatient encounter";
                    case "AMB" -> "ambulatory";
                    case "EMER" -> "emergency";
                    default -> entity.getClassCode();
                }));
        encounter.setSubject(patientReference(entity.getPatient()));
        if (entity.getAttending() != null) {
            encounter.addParticipant(new Encounter.EncounterParticipantComponent()
                    .setIndividual(new Reference("Practitioner/" + entity.getAttending().getId())
                            .setDisplay(entity.getAttending().displayName())));
        }
        if (entity.getReason() != null) {
            encounter.addReasonCode(new CodeableConcept().setText(entity.getReason()));
        }
        Period period = new Period().setStart(Date.from(entity.getPeriodStart()));
        if (entity.getPeriodEnd() != null) {
            period.setEnd(Date.from(entity.getPeriodEnd()));
        }
        encounter.setPeriod(period);
        if (entity.getLocation() != null) {
            encounter.addLocation(new Encounter.EncounterLocationComponent()
                    .setLocation(new Reference().setDisplay(entity.getLocation())));
        }
        return encounter;
    }

    public static Observation toFhir(ObservationEntity entity) {
        Observation observation = new Observation();
        observation.setId(new IdType("Observation", entity.getId()));
        observation.setStatus(Observation.ObservationStatus.FINAL);
        observation.addCategory(new CodeableConcept().addCoding(new Coding()
                .setSystem(OBS_CATEGORY)
                .setCode(entity.getCategory())));
        observation.setCode(new CodeableConcept().addCoding(new Coding()
                .setSystem(LOINC)
                .setCode(entity.getLoincCode())
                .setDisplay(entity.getDisplay())));
        observation.setSubject(patientReference(entity.getPatient()));
        if (entity.getEncounter() != null) {
            observation.setEncounter(new Reference("Encounter/" + entity.getEncounter().getId()));
        }
        observation.setEffective(new org.hl7.fhir.r4.model.DateTimeType(
                Date.from(entity.getEffectiveTime())));
        observation.setValue(quantity(entity.getValue(), entity.getUnit()));
        if (entity.getReferenceLow() != null && entity.getReferenceHigh() != null) {
            observation.addReferenceRange(new Observation.ObservationReferenceRangeComponent()
                    .setLow(quantity(entity.getReferenceLow(), entity.getUnit()))
                    .setHigh(quantity(entity.getReferenceHigh(), entity.getUnit())));
            if (entity.getValue() < entity.getReferenceLow()) {
                observation.addInterpretation(interpretation("L", "Low"));
            } else if (entity.getValue() > entity.getReferenceHigh()) {
                observation.addInterpretation(interpretation("H", "High"));
            }
        }
        return observation;
    }

    private static Reference patientReference(PatientEntity patient) {
        return new Reference("Patient/" + patient.getId())
                .setDisplay(patient.displayName());
    }

    private static Quantity quantity(double value, String unit) {
        return new Quantity()
                .setValue(value)
                .setUnit(unit)
                .setSystem(UCUM)
                .setCode(unit);
    }

    private static CodeableConcept interpretation(String code, String display) {
        return new CodeableConcept().addCoding(new Coding()
                .setSystem("http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation")
                .setCode(code)
                .setDisplay(display));
    }
}
