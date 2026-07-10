package dev.syndata.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

/**
 * Minimal client for a local Ollama server ({@code /api/generate}).
 * Used only when AI enrichment is enabled; every failure degrades silently
 * to the built-in generators.
 */
public class LocalModelClient {

    private final String baseUrl;
    private final String model;
    private final Consumer<String> log;
    private final HttpClient http;
    private final ObjectMapper mapper = new ObjectMapper();
    private boolean unreachable;

    public LocalModelClient(String baseUrl, String model, Consumer<String> log) {
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
        this.model = model;
        this.log = log;
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    }

    /** Asks the model for {@code count} sample values; returns null on any failure. */
    public List<String> sampleValues(String table, String column, String typeName,
                                     Integer maxLength, int count) {
        if (unreachable) {
            return null;
        }
        try {
            String lengthHint = maxLength == null ? "" : " Each value must be at most " + maxLength + " characters.";
            String prompt = "You generate realistic sample data for databases. "
                    + "Give " + count + " distinct realistic sample values for the SQL column \""
                    + column + "\" of table \"" + table + "\" (type " + typeName + ")." + lengthHint
                    + " Respond with ONLY a JSON object of the form {\"values\": [\"...\", \"...\"]}.";

            ObjectNode body = mapper.createObjectNode();
            body.put("model", model);
            body.put("prompt", prompt);
            body.put("stream", false);
            body.put("format", "json");

            HttpRequest request = HttpRequest.newBuilder(URI.create(baseUrl + "/api/generate"))
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(120))
                    .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)))
                    .build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                log.accept("AI: " + baseUrl + " returned HTTP " + response.statusCode()
                        + " for " + table + "." + column + "; using built-in generators.");
                return null;
            }
            JsonNode root = mapper.readTree(response.body());
            JsonNode inner = mapper.readTree(root.path("response").asText("{}"));
            JsonNode values = inner.isArray() ? inner : inner.path("values");
            if (!values.isArray() || values.isEmpty()) {
                return null;
            }
            List<String> result = new ArrayList<>();
            values.forEach(v -> {
                String s = v.asText();
                if (!s.isBlank()) {
                    result.add(maxLength != null && s.length() > maxLength ? s.substring(0, maxLength) : s);
                }
            });
            return result.isEmpty() ? null : result;
        } catch (Exception e) {
            unreachable = true;
            log.accept("AI: cannot reach " + baseUrl + " (" + e.getMessage()
                    + "); falling back to built-in generators for all columns.");
            return null;
        }
    }
}
