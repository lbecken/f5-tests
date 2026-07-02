package org.riverside.emr.messaging;

import org.hl7.fhir.r4.model.Bundle;
import org.hl7.fhir.r4.model.Coding;
import org.hl7.fhir.r4.model.MessageHeader;
import org.hl7.fhir.r4.model.Reference;
import org.hl7.fhir.r4.model.Resource;
import org.riverside.emr.entity.EventEntity;
import org.riverside.emr.fhir.FhirMapper;
import org.riverside.emr.persistence.Repository;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.UUID;

/**
 * Turns an outbox event into a FHIR "message" Bundle - the FHIR equivalent
 * of an HL7 v2 message. The first entry is always a MessageHeader (think
 * MSH segment: event code, sender, receiver); the remaining entries are the
 * resources the event is about (think PID/PV1/OBX segments).
 *
 * Event codes:
 *   admit         ~ ADT^A01   (MessageHeader + Patient + Encounter)
 *   discharge     ~ ADT^A03   (MessageHeader + Patient + Encounter)
 *   lab-result    ~ ORU^R01   (MessageHeader + Patient + Observation [+ Encounter])
 */
public class MessageBuilder {

    public static final String EVENT_SYSTEM = "https://riverside-medical.example.org/fhir/message-events";

    private final Repository repository;

    public MessageBuilder(Repository repository) {
        this.repository = repository;
    }

    public Bundle build(EventEntity event) {
        String eventCode = switch (event.getType()) {
            case ADMIT -> "admit";
            case DISCHARGE -> "discharge";
            case LAB_RESULT -> "lab-result";
        };

        List<Resource> focus = new ArrayList<>();
        repository.findPatient(event.getPatientId())
                .map(FhirMapper::toFhir).ifPresent(focus::add);
        if (event.getEncounterId() != null) {
            repository.findEncounter(event.getEncounterId())
                    .map(FhirMapper::toFhir).ifPresent(focus::add);
        }
        if (event.getObservationId() != null) {
            repository.findObservation(event.getObservationId())
                    .map(FhirMapper::toFhir).ifPresent(focus::add);
        }

        MessageHeader header = new MessageHeader();
        header.setId(UUID.randomUUID().toString());
        header.setEvent(new Coding()
                .setSystem(EVENT_SYSTEM)
                .setCode(eventCode)
                .setDisplay(eventCode));
        header.setSource(new MessageHeader.MessageSourceComponent()
                .setName("Riverside Medical Center EMR")
                .setEndpoint("https://riverside-medical.example.org/fhir"));
        header.addDestination(new MessageHeader.MessageDestinationComponent()
                .setName("Ward Dashboard")
                .setEndpoint("https://ward-dashboard.example.org"));

        Bundle bundle = new Bundle();
        bundle.setType(Bundle.BundleType.MESSAGE);
        bundle.setTimestamp(Date.from(event.getCreatedAt()));
        bundle.setId(UUID.randomUUID().toString());

        // In a message Bundle every entry gets a fullUrl; the MessageHeader
        // focus references point at those URLs.
        List<String> focusUrls = new ArrayList<>();
        List<Bundle.BundleEntryComponent> entries = new ArrayList<>();
        for (Resource resource : focus) {
            String fullUrl = "urn:uuid:" + UUID.randomUUID();
            focusUrls.add(fullUrl);
            entries.add(new Bundle.BundleEntryComponent()
                    .setFullUrl(fullUrl)
                    .setResource(resource));
        }
        focusUrls.forEach(url -> header.addFocus(new Reference(url)));

        bundle.addEntry(new Bundle.BundleEntryComponent()
                .setFullUrl("urn:uuid:" + UUID.randomUUID())
                .setResource(header));
        entries.forEach(bundle::addEntry);
        return bundle;
    }
}
