package dev.syndata.cli;

import dev.syndata.db.Db;
import dev.syndata.db.SchemaIntrospector;
import dev.syndata.entity.EntityScanner;
import dev.syndata.io.JsonStore;
import dev.syndata.model.SchemaModel;
import dev.syndata.model.TableModel;
import picocli.CommandLine.Command;
import picocli.CommandLine.Mixin;
import picocli.CommandLine.Option;

import java.nio.file.Path;
import java.sql.Connection;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;

@Command(name = "scan", mixinStandardHelpOptions = true,
        description = "Introspect the database and export tables, columns and constraints to a schema file.")
public class ScanCommand implements Callable<Integer> {

    @Mixin
    DbOptions db;

    @Option(names = {"-o", "--output"}, defaultValue = "schema.json",
            description = "Schema file to write (default: ${DEFAULT-VALUE}).")
    Path output;

    @Option(names = {"-i", "--include"},
            description = "Table name pattern(s) to include, * and ? wildcards, repeatable "
                    + "and comma-separable (default: all tables).")
    List<String> include = new ArrayList<>();

    @Option(names = {"-x", "--exclude"},
            description = "Table name pattern(s) to exclude, repeatable and comma-separable.")
    List<String> exclude = new ArrayList<>();

    @Option(names = "--with-dependencies",
            description = "Also include tables referenced by the included tables through foreign keys.")
    boolean withDependencies;

    @Option(names = "--sequence",
            description = "Name of the Hibernate global id sequence "
                    + "(default: hibernate_sequence, config key: sequence.global).")
    String globalSequence;

    @Option(names = "--entities-path",
            description = "Optional: jar file or classes directory with compiled JPA entities, repeatable. "
                    + "Adds semantics the database cannot express (Java enum values, @Email). "
                    + "Config keys: entities.enabled, entities.path, entities.package.")
    List<Path> entitiesPath = new ArrayList<>();

    @Option(names = "--entities-package",
            description = "Only scan entity classes under this package prefix.")
    String entitiesPackage;

    @Override
    public Integer call() throws Exception {
        String sequence = globalSequence != null ? globalSequence
                : db.config().get("sequence.global", "hibernate_sequence");

        SchemaModel schema;
        try (Connection connection = Db.connect(db.resolvedUrl(), db.resolvedUser(), db.resolvedPassword())) {
            SchemaIntrospector introspector = new SchemaIntrospector(connection, db.dbSchema, System.err::println);
            schema = introspector.introspect(include, exclude, withDependencies, sequence);
        }

        List<Path> entityPaths = new ArrayList<>(entitiesPath);
        boolean entitiesEnabled = !entityPaths.isEmpty() || db.config().getBoolean("entities.enabled", false);
        if (entitiesEnabled) {
            if (entityPaths.isEmpty()) {
                String configured = db.config().get("entities.path", null);
                if (configured != null) {
                    for (String p : configured.split(",")) {
                        entityPaths.add(Path.of(p.trim()));
                    }
                }
            }
            String pkg = entitiesPackage != null ? entitiesPackage : db.config().get("entities.package", null);
            if (entityPaths.isEmpty()) {
                System.err.println("Entities: entities.enabled is set but no entities path was given.");
            } else {
                int enriched = new EntityScanner(System.err::println).enrich(schema, entityPaths, pkg);
                System.out.println("Entity scan enriched " + enriched + " column(s).");
            }
        }

        JsonStore.writeSchema(schema, output);
        printSummary(schema);
        System.out.println("Wrote " + output);
        return 0;
    }

    private void printSummary(SchemaModel schema) {
        System.out.println(schema.databaseProduct + ", schema '" + schema.schemaName + "': "
                + schema.tables.size() + " table(s)"
                + (schema.globalSequence != null ? ", global sequence " + schema.globalSequence : ""));
        for (TableModel t : schema.tables) {
            long seqPk = t.columns.stream().filter(c -> c.sequence != null).count();
            System.out.printf("  %-40s %3d cols, %d fk(s)%s%s%n", t.name, t.columns.size(),
                    t.foreignKeys.size(),
                    seqPk > 0 ? ", seq-backed id" : "",
                    t.joinTable ? ", join table" : "");
        }
    }
}
