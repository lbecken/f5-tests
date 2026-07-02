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
 * A hospital stay or visit. Maps to FHIR Encounter; the lifecycle
 * (in-progress -> finished) is what ADT^A01/A03 messages track in HL7 v2.
 */
@Entity
@Table(name = "encounters")
public class EncounterEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "patient_id")
    private PatientEntity patient;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "attending_id")
    private PractitionerEntity attending;

    /** FHIR encounter-status code: in-progress | finished */
    @Column(nullable = false)
    private String status;

    /** v3-ActCode: IMP (inpatient) | AMB (ambulatory) | EMER (emergency) */
    @Column(nullable = false)
    private String classCode;

    /** e.g. ward / room-bed, like PV1-3 in HL7 v2 */
    private String location;

    /** Admission reason, free text */
    private String reason;

    @Column(nullable = false)
    private Instant periodStart;

    private Instant periodEnd;

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

    public PractitionerEntity getAttending() {
        return attending;
    }

    public void setAttending(PractitionerEntity attending) {
        this.attending = attending;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getClassCode() {
        return classCode;
    }

    public void setClassCode(String classCode) {
        this.classCode = classCode;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public Instant getPeriodStart() {
        return periodStart;
    }

    public void setPeriodStart(Instant periodStart) {
        this.periodStart = periodStart;
    }

    public Instant getPeriodEnd() {
        return periodEnd;
    }

    public void setPeriodEnd(Instant periodEnd) {
        this.periodEnd = periodEnd;
    }
}
