package org.riverside.emr.messaging;

import ca.uhn.fhir.context.FhirContext;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.hl7.fhir.r4.model.Bundle;
import org.riverside.emr.entity.EventEntity;
import org.riverside.emr.persistence.Repository;

import java.io.IOException;
import java.util.Optional;

/**
 * A simple polling feed of outbound FHIR message Bundles, playing the role
 * an MLLP outbound interface would in an HL7 v2 world.
 *
 *   GET  [context]/messages/next     next undelivered message (204 if none)
 *   GET  [context]/messages/pending  number of queued messages
 *
 * Fetching /next marks the event delivered - like an application ACK
 * consuming a message from an interface engine queue.
 */
@WebServlet(urlPatterns = "/messages/*")
public class MessageFeedServlet extends HttpServlet {

    private final transient FhirContext fhirContext = FhirContext.forR4Cached();
    private final transient Repository repository = new Repository();
    private final transient MessageBuilder messageBuilder = new MessageBuilder(repository);

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String path = req.getPathInfo() == null ? "" : req.getPathInfo();
        switch (path) {
            case "/next" -> next(resp);
            case "/pending" -> pending(resp);
            default -> resp.sendError(HttpServletResponse.SC_NOT_FOUND,
                    "Use /messages/next or /messages/pending");
        }
    }

    private void next(HttpServletResponse resp) throws IOException {
        Optional<EventEntity> event = repository.popNextUndeliveredEvent();
        if (event.isEmpty()) {
            resp.setStatus(HttpServletResponse.SC_NO_CONTENT);
            return;
        }
        Bundle bundle = messageBuilder.build(event.get());
        resp.setContentType("application/fhir+json;charset=UTF-8");
        fhirContext.newJsonParser().setPrettyPrint(true)
                .encodeResourceToWriter(bundle, resp.getWriter());
    }

    private void pending(HttpServletResponse resp) throws IOException {
        resp.setContentType("application/json;charset=UTF-8");
        resp.getWriter().write("{\"pending\":" + repository.countUndeliveredEvents() + "}");
    }
}
