package org.riverside.emr.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * A single measured value - a lab result or a vital sign. Maps to FHIR
 * Observation with a LOINC code and a UCUM-united quantity, which is the
 * FHIR equivalent of an OBX segment in an HL7 v2 ORU^R01.
 */
@Entity
@Table(name = "observations")
public class ObservationEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "patient_id")
    private PatientEntity patient;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "encounter_id")
    private EncounterEntity encounter;

    /** FHIR observation-category code: laboratory | vital-signs */
    @Column(nullable = false)
    private String category;

    @Column(nullable = false)
    private String loincCode;

    @Column(nullable = false)
    private String display;

    /** Column renamed because "value" is a reserved word in H2. */
    @Column(name = "obs_value", nullable = false)
    private Double value;

    /** UCUM unit, e.g. g/dL, mmol/L, /min */
    @Column(nullable = false)
    private String unit;

    private Double referenceLow;

    private Double referenceHigh;

    @Column(nullable = false)
    private Instant effectiveTime;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public PatientEntity getPatient() {
        return patient;
    }

    public void setPatient(PatientEntity patient) {
        this.patient = patient;
    }

    public EncounterEntity getEncounter() {
        return encounter;
    }

    public void setEncounter(EncounterEntity encounter) {
        this.encounter = encounter;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getLoincCode() {
        return loincCode;
    }

    public void setLoincCode(String loincCode) {
        this.loincCode = loincCode;
    }

    public String getDisplay() {
        return display;
    }

    public void setDisplay(String display) {
        this.display = display;
    }

    public Double getValue() {
        return value;
    }

    public void setValue(Double value) {
        this.value = value;
    }

    public String getUnit() {
        return unit;
    }

    public void setUnit(String unit) {
        this.unit = unit;
    }

    public Double getReferenceLow() {
        return referenceLow;
    }

    public void setReferenceLow(Double referenceLow) {
        this.referenceLow = referenceLow;
    }

    public Double getReferenceHigh() {
        return referenceHigh;
    }

    public void setReferenceHigh(Double referenceHigh) {
        this.referenceHigh = referenceHigh;
    }

    public Instant getEffectiveTime() {
        return effectiveTime;
    }

    public void setEffectiveTime(Instant effectiveTime) {
        this.effectiveTime = effectiveTime;
    }
}
