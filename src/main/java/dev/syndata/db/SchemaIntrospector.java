package dev.syndata.db;

import dev.syndata.analyze.CheckParser;
import dev.syndata.model.CheckModel;
import dev.syndata.model.ColumnModel;
import dev.syndata.model.ForeignKeyModel;
import dev.syndata.model.SchemaModel;
import dev.syndata.model.TableModel;
import dev.syndata.model.UniqueModel;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.function.Consumer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Reads tables, columns, and constraints from a Postgres database into a {@link SchemaModel}. */
public class SchemaIntrospector {

    private static final Pattern NEXTVAL = Pattern.compile("nextval\\('((?:[^']|'')+)'");

    private final Connection connection;
    private final String schemaName;
    private final Consumer<String> log;

    public SchemaIntrospector(Connection connection, String schemaName, Consumer<String> log) {
        this.connection = connection;
        this.schemaName = schemaName;
        this.log = log;
    }

    /**
     * @param includePatterns  glob patterns (* and ?) of table names to include; empty = all
     * @param excludePatterns  glob patterns of table names to exclude
     * @param withDependencies also include tables referenced (transitively) by included tables
     * @param globalSequence   name of the Hibernate global sequence (unqualified or qualified)
     */
    public SchemaModel introspect(List<String> includePatterns, List<String> excludePatterns,
                                  boolean withDependencies, String globalSequence) throws SQLException {
        DatabaseMetaData md = connection.getMetaData();

        SchemaModel schema = new SchemaModel();
        schema.generatedAt = OffsetDateTime.now().truncatedTo(ChronoUnit.SECONDS).toString();
        schema.databaseProduct = md.getDatabaseProductName() + " " + md.getDatabaseProductVersion();
        schema.schemaName = schemaName;
        schema.sequences = listSequences();
        schema.globalSequence = resolveGlobalSequence(schema.sequences, globalSequence);

        Set<String> allTables = listTableNames(md);
        Set<String> selected = selectTables(allTables, includePatterns, excludePatterns);
        if (withDependencies) {
            addFkClosure(md, allTables, selected);
        }

        Map<String, List<String>> enumTypes = loadEnumTypes();

        for (String tableName : selected) {
            TableModel table = new TableModel(schemaName, tableName);
            readColumns(md, table, enumTypes);
            readPrimaryKey(md, table);
            readForeignKeys(md, table);
            readUniqueConstraints(table);
            readCheckConstraints(table);
            applyColumnSequences(table, schema);
            table.joinTable = isJoinTable(table);
            schema.tables.add(table);
        }
        warnAboutMissingFkTargets(schema, selected);
        return schema;
    }

    private Set<String> listTableNames(DatabaseMetaData md) throws SQLException {
        Set<String> names = new TreeSet<>();
        try (ResultSet rs = md.getTables(null, schemaName, "%", new String[]{"TABLE"})) {
            while (rs.next()) {
                names.add(rs.getString("TABLE_NAME"));
            }
        }
        return names;
    }

    private static Set<String> selectTables(Set<String> all, List<String> includes, List<String> excludes) {
        List<Pattern> inc = compileGlobs(includes);
        List<Pattern> exc = compileGlobs(excludes);
        Set<String> selected = new TreeSet<>();
        for (String name : all) {
            boolean included = inc.isEmpty() || inc.stream().anyMatch(p -> p.matcher(name).matches());
            boolean excluded = exc.stream().anyMatch(p -> p.matcher(name).matches());
            if (included && !excluded) {
                selected.add(name);
            }
        }
        return selected;
    }

    private static List<Pattern> compileGlobs(List<String> globs) {
        List<Pattern> patterns = new ArrayList<>();
        if (globs == null) {
            return patterns;
        }
        for (String g : globs) {
            for (String part : g.split(",")) {
                part = part.trim();
                if (part.isEmpty()) {
                    continue;
                }
                String regex = ("\\Q" + part + "\\E").replace("*", "\\E.*\\Q").replace("?", "\\E.\\Q");
                patterns.add(Pattern.compile(regex, Pattern.CASE_INSENSITIVE));
            }
        }
        return patterns;
    }

    /** Adds every table transitively referenced by the selected set through foreign keys. */
    private void addFkClosure(DatabaseMetaData md, Set<String> allTables, Set<String> selected)
            throws SQLException {
        Deque<String> queue = new ArrayDeque<>(selected);
        while (!queue.isEmpty()) {
            String table = queue.poll();
            try (ResultSet rs = md.getImportedKeys(null, schemaName, table)) {
                while (rs.next()) {
                    String parent = rs.getString("PKTABLE_NAME");
                    String parentSchema = rs.getString("PKTABLE_SCHEM");
                    if (schemaName.equals(parentSchema) && allTables.contains(parent) && selected.add(parent)) {
                        log.accept("Including " + parent + " (referenced by " + table + ")");
                        queue.add(parent);
                    }
                }
            }
        }
    }

    private void readColumns(DatabaseMetaData md, TableModel table, Map<String, List<String>> enumTypes)
            throws SQLException {
        // information_schema gives identity/generated flags that DatabaseMetaData hides.
        record Extra(String isIdentity, String identityGeneration, String isGenerated, String columnDefault) {
        }
        Map<String, Extra> extras = new HashMap<>();
        try (PreparedStatement ps = connection.prepareStatement("""
                select column_name, is_identity, identity_generation, is_generated, column_default
                from information_schema.columns
                where table_schema = ? and table_name = ?""")) {
            ps.setString(1, schemaName);
            ps.setString(2, table.name);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    extras.put(rs.getString(1), new Extra(rs.getString(2), rs.getString(3),
                            rs.getString(4), rs.getString(5)));
                }
            }
        }

        try (ResultSet rs = md.getColumns(null, schemaName, table.name, "%")) {
            while (rs.next()) {
                ColumnModel col = new ColumnModel();
                col.name = rs.getString("COLUMN_NAME");
                col.typeName = rs.getString("TYPE_NAME");
                col.jdbcType = rs.getInt("DATA_TYPE");
                col.nullable = rs.getInt("NULLABLE") != DatabaseMetaData.columnNoNulls;

                int size = rs.getInt("COLUMN_SIZE");
                int digits = rs.getInt("DECIMAL_DIGITS");
                switch (col.jdbcType) {
                    case java.sql.Types.NUMERIC, java.sql.Types.DECIMAL -> {
                        if (size > 0) {
                            col.precision = size;
                            col.scale = digits;
                        }
                    }
                    case java.sql.Types.VARCHAR, java.sql.Types.CHAR, java.sql.Types.LONGVARCHAR -> {
                        if (size > 0 && size < Integer.MAX_VALUE) {
                            col.length = size;
                        }
                    }
                    default -> {
                    }
                }

                Extra extra = extras.get(col.name);
                if (extra != null) {
                    col.defaultValue = extra.columnDefault();
                    col.identity = "YES".equals(extra.isIdentity());
                    col.identityAlways = col.identity && "ALWAYS".equals(extra.identityGeneration());
                    col.generated = "ALWAYS".equals(extra.isGenerated());
                }
                List<String> labels = enumTypes.get(col.typeName);
                if (labels != null) {
                    col.enumValues = labels;
                }
                table.columns.add(col);
            }
        }
    }

    private void readPrimaryKey(DatabaseMetaData md, TableModel table) throws SQLException {
        Map<Integer, String> bySeq = new LinkedHashMap<>();
        try (ResultSet rs = md.getPrimaryKeys(null, schemaName, table.name)) {
            while (rs.next()) {
                bySeq.put(rs.getInt("KEY_SEQ"), rs.getString("COLUMN_NAME"));
            }
        }
        bySeq.keySet().stream().sorted().forEach(k -> table.primaryKey.add(bySeq.get(k)));
    }

    private void readForeignKeys(DatabaseMetaData md, TableModel table) throws SQLException {
        Map<String, ForeignKeyModel> byName = new LinkedHashMap<>();
        try (ResultSet rs = md.getImportedKeys(null, schemaName, table.name)) {
            while (rs.next()) {
                String fkName = rs.getString("FK_NAME");
                ForeignKeyModel fk = byName.computeIfAbsent(fkName, n ->
                        new ForeignKeyModel(n, null, null));
                fk.referencedSchema = rs.getString("PKTABLE_SCHEM");
                fk.referencedTable = rs.getString("PKTABLE_NAME");
                fk.columns.add(rs.getString("FKCOLUMN_NAME"));
                fk.referencedColumns.add(rs.getString("PKCOLUMN_NAME"));
            }
        }
        table.foreignKeys.addAll(byName.values());
    }

    private void readUniqueConstraints(TableModel table) throws SQLException {
        // pg_catalog keeps unique constraints and unique indexes; skip the PK and partial/expression indexes.
        String sql = """
                select i.relname as index_name, a.attname as column_name, x.indisprimary,
                       array_position(x.indkey, a.attnum) as pos
                from pg_index x
                join pg_class c on c.oid = x.indrelid
                join pg_class i on i.oid = x.indexrelid
                join pg_namespace n on n.oid = c.relnamespace
                join pg_attribute a on a.attrelid = c.oid and a.attnum = any(x.indkey)
                where n.nspname = ? and c.relname = ? and x.indisunique
                  and x.indpred is null and x.indexprs is null
                order by index_name, pos""";
        Map<String, List<String>> byIndex = new LinkedHashMap<>();
        Set<String> primary = new HashSet<>();
        try (PreparedStatement ps = connection.prepareStatement(sql)) {
            ps.setString(1, schemaName);
            ps.setString(2, table.name);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String index = rs.getString("index_name");
                    byIndex.computeIfAbsent(index, k -> new ArrayList<>()).add(rs.getString("column_name"));
                    if (rs.getBoolean("indisprimary")) {
                        primary.add(index);
                    }
                }
            }
        }
        byIndex.forEach((index, cols) -> {
            if (!primary.contains(index)) {
                table.uniqueConstraints.add(new UniqueModel(index, cols));
            }
        });
    }

    private void readCheckConstraints(TableModel table) throws SQLException {
        String sql = """
                select con.conname, pg_get_constraintdef(con.oid) as def
                from pg_constraint con
                join pg_class c on c.oid = con.conrelid
                join pg_namespace n on n.oid = c.relnamespace
                where con.contype = 'c' and n.nspname = ? and c.relname = ?""";
        try (PreparedStatement ps = connection.prepareStatement(sql)) {
            ps.setString(1, schemaName);
            ps.setString(2, table.name);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    CheckModel check = new CheckModel(rs.getString(1), rs.getString(2));
                    CheckParser.parse(check);
                    table.checkConstraints.add(check);
                    if (check.column != null && check.values != null) {
                        ColumnModel col = table.column(check.column);
                        if (col != null) {
                            col.checkValues = check.values;
                        }
                    }
                }
            }
        }
    }

    private Map<String, List<String>> loadEnumTypes() throws SQLException {
        Map<String, List<String>> enums = new HashMap<>();
        String sql = """
                select t.typname, e.enumlabel
                from pg_enum e
                join pg_type t on t.oid = e.enumtypid
                join pg_namespace n on n.oid = t.typnamespace
                where n.nspname = ?
                order by t.typname, e.enumsortorder""";
        try (PreparedStatement ps = connection.prepareStatement(sql)) {
            ps.setString(1, schemaName);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    enums.computeIfAbsent(rs.getString(1), k -> new ArrayList<>()).add(rs.getString(2));
                }
            }
        }
        return enums;
    }

    private List<String> listSequences() throws SQLException {
        List<String> sequences = new ArrayList<>();
        try (PreparedStatement ps = connection.prepareStatement(
                "select schemaname, sequencename from pg_sequences where schemaname = ? order by sequencename")) {
            ps.setString(1, schemaName);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    sequences.add(rs.getString(1) + "." + rs.getString(2));
                }
            }
        }
        return sequences;
    }

    private String resolveGlobalSequence(List<String> sequences, String configured) {
        if (configured == null || configured.isBlank()) {
            return null;
        }
        String wanted = configured.contains(".") ? configured : schemaName + "." + configured;
        for (String seq : sequences) {
            if (seq.equalsIgnoreCase(wanted)) {
                return seq;
            }
        }
        log.accept("Warning: global sequence '" + configured + "' not found in schema " + schemaName
                + "; PKs will not be marked as sequence-backed.");
        return null;
    }

    /** Decides which sequence, if any, produces values for each column. */
    private void applyColumnSequences(TableModel table, SchemaModel schema) throws SQLException {
        for (ColumnModel col : table.columns) {
            if (col.generated) {
                continue;
            }
            // serial columns: default is nextval('...')
            if (col.defaultValue != null) {
                Matcher m = NEXTVAL.matcher(col.defaultValue);
                if (m.find()) {
                    col.sequence = normalizeSequenceName(m.group(1).replace("''", "'"));
                    continue;
                }
            }
            // identity columns: sequence via pg_get_serial_sequence
            if (col.identity) {
                try (PreparedStatement ps = connection.prepareStatement(
                        "select pg_get_serial_sequence(?, ?)")) {
                    ps.setString(1, Db.quote(schemaName) + "." + Db.quote(table.name));
                    ps.setString(2, col.name);
                    try (ResultSet rs = ps.executeQuery()) {
                        if (rs.next() && rs.getString(1) != null) {
                            col.sequence = normalizeSequenceName(rs.getString(1));
                        }
                    }
                }
            }
        }
        // Hibernate global sequence: single-column integer PK without any other value source.
        if (schema.globalSequence != null && table.primaryKey.size() == 1) {
            ColumnModel pk = table.column(table.primaryKey.get(0));
            if (pk != null && pk.sequence == null && pk.defaultValue == null && !pk.identity
                    && isIntegerType(pk.typeName)) {
                pk.sequence = schema.globalSequence;
            }
        }
    }

    private static boolean isIntegerType(String typeName) {
        String t = typeName.toLowerCase(Locale.ROOT);
        return t.equals("int8") || t.equals("int4") || t.equals("int2")
                || t.equals("bigint") || t.equals("integer") || t.equals("smallint")
                || t.equals("numeric");
    }

    private String normalizeSequenceName(String raw) {
        String name = raw.replace("\"", "");
        int cast = name.indexOf("::");
        if (cast >= 0) {
            name = name.substring(0, cast);
        }
        return name.contains(".") ? name : schemaName + "." + name;
    }

    private static boolean isJoinTable(TableModel table) {
        if (table.foreignKeys.size() < 2 || table.columns.isEmpty()) {
            return false;
        }
        Set<String> fkColumns = new HashSet<>();
        for (ForeignKeyModel fk : table.foreignKeys) {
            fkColumns.addAll(fk.columns);
        }
        for (ColumnModel col : table.columns) {
            if (!fkColumns.contains(col.name)) {
                return false;
            }
        }
        return true;
    }

    private void warnAboutMissingFkTargets(SchemaModel schema, Set<String> selected) {
        for (TableModel t : schema.tables) {
            for (ForeignKeyModel fk : t.foreignKeys) {
                if (!selected.contains(fk.referencedTable)) {
                    log.accept("Warning: " + t.name + "." + fk.name + " references " + fk.referencedTable
                            + " which is not included; use --with-dependencies or include it explicitly.");
                }
            }
        }
    }
}
