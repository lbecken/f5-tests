package dev.syndata.entity;

import dev.syndata.model.ColumnModel;
import dev.syndata.model.SchemaModel;
import dev.syndata.model.TableModel;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

import java.io.IOException;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.net.URL;
import java.net.URLClassLoader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.List;
import java.util.Locale;
import java.util.function.Consumer;
import java.util.jar.JarEntry;
import java.util.jar.JarFile;
import java.util.stream.Stream;

/**
 * Optional enrichment of a scanned schema from compiled JPA entity classes.
 *
 * <p>Most structure (tables, types, nullability, FKs) is already known from the
 * database, so this scanner only adds semantics the database cannot express:
 * Java enum constants for plain varchar/int columns stored with
 * {@code @Enumerated}, and {@code @Email} hints from Bean Validation.
 * Classes that cannot be loaded (missing dependencies) are skipped silently.</p>
 */
public class EntityScanner {

    private final Consumer<String> log;

    public EntityScanner(Consumer<String> log) {
        this.log = log;
    }

    /** @return number of columns that received extra information */
    public int enrich(SchemaModel schema, List<Path> classPaths, String packagePrefix) {
        List<URL> urls = new ArrayList<>();
        for (Path p : classPaths) {
            try {
                urls.add(p.toUri().toURL());
            } catch (IOException e) {
                log.accept("Entities: cannot use path " + p + ": " + e.getMessage());
            }
        }
        int enriched = 0;
        try (URLClassLoader loader = new URLClassLoader(urls.toArray(new URL[0]),
                EntityScanner.class.getClassLoader())) {
            for (Path p : classPaths) {
                for (String className : listClassNames(p, packagePrefix)) {
                    enriched += enrichFromClass(schema, loader, className);
                }
            }
        } catch (IOException e) {
            log.accept("Entities: " + e.getMessage());
        }
        return enriched;
    }

    private List<String> listClassNames(Path root, String packagePrefix) {
        List<String> names = new ArrayList<>();
        try {
            if (Files.isDirectory(root)) {
                try (Stream<Path> walk = Files.walk(root)) {
                    walk.filter(f -> f.toString().endsWith(".class")).forEach(f -> {
                        String rel = root.relativize(f).toString();
                        names.add(rel.substring(0, rel.length() - 6).replace('/', '.').replace('\\', '.'));
                    });
                }
            } else if (root.toString().endsWith(".jar")) {
                try (JarFile jar = new JarFile(root.toFile())) {
                    Enumeration<JarEntry> entries = jar.entries();
                    while (entries.hasMoreElements()) {
                        String name = entries.nextElement().getName();
                        if (name.endsWith(".class") && !name.contains("module-info")) {
                            names.add(name.substring(0, name.length() - 6).replace('/', '.'));
                        }
                    }
                }
            }
        } catch (IOException e) {
            log.accept("Entities: cannot list classes in " + root + ": " + e.getMessage());
        }
        if (packagePrefix != null && !packagePrefix.isBlank()) {
            names.removeIf(n -> !n.startsWith(packagePrefix));
        }
        return names;
    }

    private int enrichFromClass(SchemaModel schema, ClassLoader loader, String className) {
        Class<?> cls;
        try {
            cls = Class.forName(className, false, loader);
        } catch (Throwable t) {
            return 0; // missing dependency, malformed class, ... — best effort
        }
        Entity entity;
        try {
            entity = cls.getAnnotation(Entity.class);
        } catch (Throwable t) {
            return 0;
        }
        if (entity == null) {
            return 0;
        }
        Table tableAnn = cls.getAnnotation(Table.class);
        String tableName = tableAnn != null && !tableAnn.name().isBlank()
                ? tableAnn.name()
                : camelToSnake(cls.getSimpleName());
        TableModel table = findTable(schema, tableName);
        if (table == null) {
            return 0;
        }

        int enriched = 0;
        for (Class<?> c = cls; c != null && c != Object.class; c = c.getSuperclass()) {
            for (Field field : c.getDeclaredFields()) {
                if (Modifier.isStatic(field.getModifiers()) || Modifier.isTransient(field.getModifiers())) {
                    continue;
                }
                Column columnAnn = field.getAnnotation(Column.class);
                String columnName = columnAnn != null && !columnAnn.name().isBlank()
                        ? columnAnn.name()
                        : camelToSnake(field.getName());
                ColumnModel col = findColumn(table, columnName);
                if (col == null) {
                    continue;
                }
                if (enrichColumn(col, field)) {
                    enriched++;
                    log.accept("Entities: " + table.name + "." + col.name + " enriched from "
                            + cls.getSimpleName() + "." + field.getName());
                }
            }
        }
        return enriched;
    }

    private boolean enrichColumn(ColumnModel col, Field field) {
        boolean changed = false;
        Class<?> type = field.getType();
        if (type.isEnum() && (col.semanticValues == null || col.semanticValues.isEmpty())
                && (col.enumValues == null) && (col.checkValues == null)) {
            Enumerated enumerated = field.getAnnotation(Enumerated.class);
            boolean asString = enumerated != null && enumerated.value() == EnumType.STRING;
            List<String> values = new ArrayList<>();
            Object[] constants = type.getEnumConstants();
            for (int i = 0; i < constants.length; i++) {
                values.add(asString ? ((Enum<?>) constants[i]).name() : String.valueOf(i));
            }
            col.semanticValues = values;
            col.semantic = "ENUM(" + type.getSimpleName() + ")";
            changed = true;
        }
        if (hasAnnotation(field, "jakarta.validation.constraints.Email") && col.semantic == null) {
            col.semantic = "EMAIL";
            changed = true;
        }
        return changed;
    }

    private static boolean hasAnnotation(Field field, String annotationClassName) {
        for (var ann : field.getAnnotations()) {
            if (ann.annotationType().getName().equals(annotationClassName)) {
                return true;
            }
        }
        return false;
    }

    private static TableModel findTable(SchemaModel schema, String name) {
        for (TableModel t : schema.tables) {
            if (t.name.equalsIgnoreCase(name)) {
                return t;
            }
        }
        return null;
    }

    private static ColumnModel findColumn(TableModel table, String name) {
        for (ColumnModel c : table.columns) {
            if (c.name.equalsIgnoreCase(name)) {
                return c;
            }
        }
        return null;
    }

    static String camelToSnake(String name) {
        return name.replaceAll("([a-z0-9])([A-Z])", "$1_$2").toLowerCase(Locale.ROOT);
    }
}
