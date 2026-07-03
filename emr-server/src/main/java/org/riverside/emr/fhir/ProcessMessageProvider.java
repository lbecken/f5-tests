package org.riverside.emr.fhir;

import ca.uhn.fhir.rest.annotation.Operation;
import ca.uhn.fhir.rest.annotation.OperationParam;
import org.hl7.fhir.r4.model.Bundle;
import org.hl7.fhir.r4.model.MessageHeader;
import org.riverside.emr.ingest.IngestService;

import java.util.Date;
import java.util.UUID;

/**
 * FHIR's standard inbound messaging operation:
 *
 *   POST [base]/$process-message   (body = a message Bundle)
 *
 * This is what the Mirth channel calls after translating an HL7 v2 message.
 * The response is itself a message Bundle whose MessageHeader.response
 * acknowledges the inbound message - FHIR's version of a v2 ACK.
 */
public class ProcessMessageProvider {

    private final IngestService ingestService;

    public ProcessMessageProvider(IngestService ingestService) {
        this.ingestService = ingestService;
    }

    @Operation(name = "$process-message")
    public Bundle processMessage(@OperationParam(name = "content") Bundle content) {
        String disposition = ingestService.apply(content);

        MessageHeader inboundHeader = (MessageHeader) content.getEntryFirstRep().getResource();
        MessageHeader ack = new MessageHeader();
        ack.setId(UUID.randomUUID().toString());
        ack.setEvent(inboundHeader.getEventCoding().copy());
        ack.setSource(new MessageHeader.MessageSourceComponent()
                .setName("Riverside Medical Center EMR")
                .setEndpoint("https://riverside-medical.example.org/fhir"));
        ack.setResponse(new MessageHeader.MessageHeaderResponseComponent()
                .setIdentifier(inboundHeader.getIdElement().getIdPart())
                .setCode(MessageHeader.ResponseType.OK));

        Bundle response = new Bundle();
        response.setType(Bundle.BundleType.MESSAGE);
        response.setTimestamp(new Date());
        response.addEntry(new Bundle.BundleEntryComponent()
                .setFullUrl("urn:uuid:" + UUID.randomUUID())
                .setResource(ack));
        // Non-standard but convenient: surface what the EMR did.
        response.setId(UUID.randomUUID().toString());
        ack.getResponse().addExtension(
                "https://riverside-medical.example.org/fhir/StructureDefinition/disposition",
                new org.hl7.fhir.r4.model.StringType(disposition));
        return response;
    }
}
