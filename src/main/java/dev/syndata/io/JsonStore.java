package dev.syndata.io;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import dev.syndata.model.DataSetModel;
import dev.syndata.model.SchemaModel;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;

/** Reads and writes the schema and data files as JSON. */
public final class JsonStore {

    private static final ObjectMapper MAPPER = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .enable(SerializationFeature.INDENT_OUTPUT)
            .enable(DeserializationFeature.USE_BIG_DECIMAL_FOR_FLOATS)
            .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    private JsonStore() {
    }

    public static void writeSchema(SchemaModel schema, Path file) {
        write(schema, file);
    }

    public static SchemaModel readSchema(Path file) {
        return read(file, SchemaModel.class);
    }

    public static void writeDataSet(DataSetModel data, Path file) {
        write(data, file);
    }

    public static DataSetModel readDataSet(Path file) {
        return read(file, DataSetModel.class);
    }

    private static void write(Object value, Path file) {
        try {
            if (file.getParent() != null) {
                Files.createDirectories(file.getParent());
            }
            MAPPER.writeValue(file.toFile(), value);
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot write " + file, e);
        }
    }

    private static <T> T read(Path file, Class<T> type) {
        try {
            return MAPPER.readValue(file.toFile(), type);
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot read " + file + ": " + e.getMessage(), e);
        }
    }
}
