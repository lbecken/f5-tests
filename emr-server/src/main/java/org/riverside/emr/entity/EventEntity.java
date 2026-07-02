package org.riverside.emr.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * Outbox row for outbound clinical events. Every admit / discharge / final
 * lab result writes one of these; the message feed turns undelivered rows
 * into FHIR message Bundles, the way an interface engine drains a v2 queue.
 */
@Entity
@Table(name = "events")
public class EventEntity {

    public enum Type {
        /** HL7 v2 analog: ADT^A01 */
        ADMIT,
        /** HL7 v2 analog: ADT^A03 */
        DISCHARGE,
        /** HL7 v2 analog: ORU^R01 */
        LAB_RESULT
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Type type;

    @Column(nullable = false)
    private Long patientId;

    private Long encounterId;

    private Long observationId;

    @Column(nullable = false)
    private Instant createdAt;

    private Instant deliveredAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Type getType() {
        return type;
    }

    public void setType(Type type) {
        this.type = type;
    }

    public Long getPatientId() {
        return patientId;
    }

    public void setPatientId(Long patientId) {
        this.patientId = patientId;
    }

    public Long getEncounterId() {
        return encounterId;
    }

    public void setEncounterId(Long encounterId) {
        this.encounterId = encounterId;
    }

    public Long getObservationId() {
        return observationId;
    }

    public void setObservationId(Long observationId) {
        this.observationId = observationId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getDeliveredAt() {
        return deliveredAt;
    }

    public void setDeliveredAt(Instant deliveredAt) {
        this.deliveredAt = deliveredAt;
    }
}
