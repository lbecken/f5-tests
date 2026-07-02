package org.riverside.dashboard;

import ca.uhn.fhir.rest.client.api.IGenericClient;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.hl7.fhir.r4.model.Bundle;
import org.hl7.fhir.r4.model.Encounter;
import org.hl7.fhir.r4.model.MessageHeader;
import org.hl7.fhir.r4.model.Observation;
import org.hl7.fhir.r4.model.Patient;
import org.hl7.fhir.r4.model.Resource;

import java.io.IOException;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * JSON backend for the dashboard UI. Talks to the EMR in two ways:
 *
 *  - FHIR REST queries via HAPI's IGenericClient (patients, encounters,
 *    observations) - the "query" style of FHIR exchange.
 *  - Polling the EMR's message feed - the "messaging" style, closest to
 *    what an HL7 v2 interface does.
 *
 * Endpoints:
 *   GET  /api/patients               patient registry with census flag
 *   GET  /api/patients/{id}          detail: encounters + observations
 *   GET  /api/feed/next              next message (summary + raw FHIR JSON)
 *   GET  /api/feed/pending           queued message count on the EMR
 *   POST /api/simulate/{action}      proxied to the EMR simulator
 */
@WebServlet(urlPatterns = "/api/*")
public class ApiServlet extends HttpServlet {

    private static final DateTimeFormatter TS =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private final transient ObjectMapper json = new ObjectMapper();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String path = req.getPathInfo() == null ? "" : req.getPathInfo();
        try {
            if (path.equals("/patients")) {
                writeJson(resp, patients());
            } else if (path.matches("/patients/\\d+")) {
                writeJson(resp, patientDetail(path.substring("/patients/".length())));
            } else if (path.equals("/feed/next")) {
                writeJson(resp, nextMessage());
            } else if (path.equals("/feed/pending")) {
                proxy(resp, "GET", "/messages/pending");
            } else {
                resp.sendError(HttpServletResponse.SC_NOT_FOUND);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            resp.sendError(HttpServletResponse.SC_SERVICE_UNAVAILABLE, "interrupted");
        } catch (Exception e) {
            error(resp, e);
        }
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String path = req.getPathInfo() == null ? "" : req.getPathInfo();
        try {
            if (path.matches("/simulate/(admit|discharge|lab)")) {
                proxy(resp, "POST", "/simulate/" + path.substring("/simulate/".length()));
            } else {
                resp.sendError(HttpServletResponse.SC_NOT_FOUND);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            resp.sendError(HttpServletResponse.SC_SERVICE_UNAVAILABLE, "interrupted");
        } catch (Exception e) {
            error(resp, e);
        }
    }

    // ---- FHIR queries via HAPI client ----

    private ObjectNode patients() {
        IGenericClient client = EmrConnection.fhirClient();

        Bundle patientBundle = client.search().forResource(Patient.class)
                .returnBundle(Bundle.class).execute();
        Bundle censusBundle = client.search().forResource(Encounter.class)
                .where(Encounter.STATUS.exactly().code("in-progress"))
                .returnBundle(Bundle.class).execute();

        List<String> admittedPatientIds = censusBundle.getEntry().stream()
                .map(e -> (Encounter) e.getResource())
                .map(e -> e.getSubject().getReferenceElement().getIdPart())
                .toList();

        ObjectNode root = json.createObjectNode();
        ArrayNode list = root.putArray("patients");
        for (Bundle.BundleEntryComponent entry : patientBundle.getEntry()) {
            Patient p = (Patient) entry.getResource();
            ObjectNode node = list.addObject();
            node.put("id", p.getIdElement().getIdPart());
            node.put("name", p.getNameFirstRep().getNameAsSingleString());
            node.put("mrn", p.getIdentifierFirstRep().getValue());
            node.put("gender", p.getGender() != null ? p.getGender().toCode() : "unknown");
            node.put("birthDate", p.getBirthDateElement().getValueAsString());
            node.put("admitted", admittedPatientIds.contains(p.getIdElement().getIdPart()));
        }
        return root;
    }

    private ObjectNode patientDetail(String id) {
        IGenericClient client = EmrConnection.fhirClient();

        Patient patient = client.read().resource(Patient.class).withId(id).execute();
        Bundle encounters = client.search().forResource(Encounter.class)
                .where(Encounter.PATIENT.hasId(id))
                .returnBundle(Bundle.class).execute();
        Bundle observations = client.search().forResource(Observation.class)
                .where(Observation.PATIENT.hasId(id))
                .returnBundle(Bundle.class).execute();

        ObjectNode root = json.createObjectNode();
        root.put("id", id);
        root.put("name", patient.getNameFirstRep().getNameAsSingleString());
        root.put("mrn", patient.getIdentifierFirstRep().getValue());
        root.put("gender", patient.getGender() != null ? patient.getGender().toCode() : "unknown");
        root.put("birthDate", patient.getBirthDateElement().getValueAsString());
        root.put("phone", patient.getTelecomFirstRep().getValue());
        root.put("raw", encode(patient));

        ArrayNode encounterList = root.putArray("encounters");
        for (Bundle.BundleEntryComponent entry : encounters.getEntry()) {
            Encounter e = (Encounter) entry.getResource();
            ObjectNode node = encounterList.addObject();
            node.put("status", e.getStatus().toCode());
            node.put("class", e.getClass_().getCode());
            node.put("reason", e.getReasonCodeFirstRep().getText());
            node.put("location", e.getLocationFirstRep().getLocation().getDisplay());
            node.put("attending", e.getParticipantFirstRep().getIndividual().getDisplay());
            node.put("start", e.getPeriod().getStartElement().getValueAsString());
            node.put("end", e.getPeriod().hasEnd()
                    ? e.getPeriod().getEndElement().getValueAsString() : null);
        }

        ArrayNode obsList = root.putArray("observations");
        for (Bundle.BundleEntryComponent entry : observations.getEntry()) {
            Observation o = (Observation) entry.getResource();
            ObjectNode node = obsList.addObject();
            node.put("category", o.getCategoryFirstRep().getCodingFirstRep().getCode());
            node.put("loinc", o.getCode().getCodingFirstRep().getCode());
            node.put("test", o.getCode().getCodingFirstRep().getDisplay());
            node.put("value", o.getValueQuantity().getValue().doubleValue());
            node.put("unit", o.getValueQuantity().getUnit());
            node.put("flag", o.hasInterpretation()
                    ? o.getInterpretationFirstRep().getCodingFirstRep().getCode() : null);
            node.put("time", o.getEffectiveDateTimeType().getValueAsString());
        }
        return root;
    }

    // ---- message feed ----

    private ObjectNode nextMessage() throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder(EmrConnection.uri("/messages/next")).GET().build();
        HttpResponse<String> response = EmrConnection.http()
                .send(request, HttpResponse.BodyHandlers.ofString());

        ObjectNode root = json.createObjectNode();
        if (response.statusCode() == 204) {
            root.put("empty", true);
            return root;
        }
        if (response.statusCode() != 200) {
            throw new IOException("EMR message feed returned HTTP " + response.statusCode());
        }

        Bundle bundle = (Bundle) EmrConnection.FHIR.newJsonParser()
                .parseResource(response.body());
        root.put("empty", false);
        root.put("raw", response.body());
        summarize(bundle, root);
        return root;
    }

    /** Builds the human-readable one-liner the feed shows per message. */
    private void summarize(Bundle bundle, ObjectNode root) {
        MessageHeader header = null;
        Patient patient = null;
        Encounter encounter = null;
        Observation observation = null;
        for (Bundle.BundleEntryComponent entry : bundle.getEntry()) {
            Resource r = entry.getResource();
            if (r instanceof MessageHeader h) header = h;
            if (r instanceof Patient p) patient = p;
            if (r instanceof Encounter e) encounter = e;
            if (r instanceof Observation o) observation = o;
        }

        String eventCode = header != null ? header.getEventCoding().getCode() : "unknown";
        root.put("event", eventCode);
        root.put("v2Analog", switch (eventCode) {
            case "admit" -> "ADT^A01";
            case "discharge" -> "ADT^A03";
            case "lab-result" -> "ORU^R01";
            default -> "?";
        });
        root.put("timestamp", bundle.hasTimestamp()
                ? TS.format(bundle.getTimestamp().toInstant()
                        .atZone(java.time.ZoneId.systemDefault())) : "");

        String who = patient != null
                ? patient.getNameFirstRep().getNameAsSingleString()
                        + " (" + patient.getIdentifierFirstRep().getValue() + ")"
                : "unknown patient";

        String detail = switch (eventCode) {
            case "admit" -> "admitted to " + (encounter != null
                    ? encounter.getLocationFirstRep().getLocation().getDisplay()
                    + " - " + encounter.getReasonCodeFirstRep().getText() : "?");
            case "discharge" -> "discharged";
            case "lab-result" -> observation != null
                    ? observation.getCode().getCodingFirstRep().getDisplay()
                    + ": " + observation.getValueQuantity().getValue()
                    + " " + observation.getValueQuantity().getUnit()
                    + (observation.hasInterpretation()
                        ? " [" + observation.getInterpretationFirstRep()
                                .getCodingFirstRep().getCode() + "]" : "")
                    : "lab result";
            default -> "";
        };
        root.put("patient", who);
        root.put("detail", detail);
    }

    // ---- plumbing ----

    private void proxy(HttpServletResponse resp, String method, String path)
            throws IOException, InterruptedException {
        HttpRequest.Builder builder = HttpRequest.newBuilder(EmrConnection.uri(path));
        if (method.equals("POST")) {
            builder.POST(HttpRequest.BodyPublishers.noBody());
        }
        HttpResponse<String> response = EmrConnection.http()
                .send(builder.build(), HttpResponse.BodyHandlers.ofString());
        resp.setStatus(response.statusCode());
        resp.setContentType("application/json;charset=UTF-8");
        resp.getWriter().write(response.body());
    }

    private String encode(Resource resource) {
        return EmrConnection.FHIR.newJsonParser().setPrettyPrint(true)
                .encodeResourceToString(resource);
    }

    private void writeJson(HttpServletResponse resp, ObjectNode node) throws IOException {
        resp.setContentType("application/json;charset=UTF-8");
        json.writeValue(resp.getWriter(), node);
    }

    private void error(HttpServletResponse resp, Exception e) throws IOException {
        resp.setStatus(HttpServletResponse.SC_BAD_GATEWAY);
        resp.setContentType("application/json;charset=UTF-8");
        ObjectNode node = json.createObjectNode();
        node.put("error", e.getClass().getSimpleName());
        node.put("message", String.valueOf(e.getMessage()));
        node.put("hint", "Is the EMR reachable at " + EmrConnection.baseUrl() + "?");
        json.writeValue(resp.getWriter(), node);
    }
}
