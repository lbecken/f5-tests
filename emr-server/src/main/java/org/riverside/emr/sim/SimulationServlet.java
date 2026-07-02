package org.riverside.emr.sim;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.riverside.emr.persistence.Repository;

import java.io.IOException;
import java.util.Random;

/**
 * Lets you drive hospital activity by hand (the dashboard has buttons for
 * these). Each action stores data AND queues an event for the message feed.
 *
 *   POST [context]/simulate/admit        admit a random patient
 *   POST [context]/simulate/discharge    discharge a random inpatient
 *   POST [context]/simulate/lab          produce a lab result
 */
@WebServlet(urlPatterns = "/simulate/*")
public class SimulationServlet extends HttpServlet {

    private final transient ObjectMapper json = new ObjectMapper();
    private final transient Repository repository = new Repository();
    private final transient ClinicalSimulator simulator =
            new ClinicalSimulator(repository, new Random());

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String path = req.getPathInfo() == null ? "" : req.getPathInfo();
        ObjectNode result = json.createObjectNode();
        switch (path) {
            case "/admit" -> simulator.admitRandomPatient().ifPresentOrElse(
                    e -> result.put("status", "admitted")
                            .put("patient", e.getPatient().displayName())
                            .put("location", e.getLocation()),
                    () -> result.put("status", "no-op")
                            .put("detail", "everyone is already admitted"));
            case "/discharge" -> simulator.dischargeRandomPatient().ifPresentOrElse(
                    e -> result.put("status", "discharged")
                            .put("patient", e.getPatient().displayName()),
                    () -> result.put("status", "no-op")
                            .put("detail", "nobody is currently admitted"));
            case "/lab" -> simulator.produceRandomLabResult().ifPresentOrElse(
                    o -> result.put("status", "resulted")
                            .put("patient", o.getPatient().displayName())
                            .put("test", o.getDisplay())
                            .put("value", o.getValue() + " " + o.getUnit()),
                    () -> result.put("status", "no-op")
                            .put("detail", "no patients in the system"));
            default -> {
                resp.sendError(HttpServletResponse.SC_NOT_FOUND,
                        "Use /simulate/admit, /simulate/discharge or /simulate/lab");
                return;
            }
        }
        resp.setContentType("application/json;charset=UTF-8");
        json.writeValue(resp.getWriter(), result);
    }
}
