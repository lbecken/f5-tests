package dev.syndata.ai;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Caches one model call per column, so AI enrichment costs O(columns), not O(rows).
 * The generator then samples from the pooled values.
 */
public class AiValuePool {

    private final LocalModelClient client;
    private final Map<String, List<String>> cache = new HashMap<>();

    public AiValuePool(LocalModelClient client) {
        this.client = client;
    }

    public List<String> pool(String table, String column, String typeName, Integer maxLength, int count) {
        String key = table + "." + column;
        if (cache.containsKey(key)) {
            return cache.get(key);
        }
        List<String> values = client.sampleValues(table, column, typeName, maxLength, count);
        cache.put(key, values);
        return values;
    }
}
