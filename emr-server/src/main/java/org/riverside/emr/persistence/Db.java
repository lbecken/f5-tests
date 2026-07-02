package org.riverside.emr.persistence;

import org.hibernate.SessionFactory;
import org.hibernate.boot.MetadataSources;
import org.hibernate.boot.registry.StandardServiceRegistry;
import org.hibernate.boot.registry.StandardServiceRegistryBuilder;
import org.hibernate.cfg.AvailableSettings;
import org.riverside.emr.entity.EncounterEntity;
import org.riverside.emr.entity.EventEntity;
import org.riverside.emr.entity.ObservationEntity;
import org.riverside.emr.entity.PatientEntity;
import org.riverside.emr.entity.PractitionerEntity;

import java.util.HashMap;
import java.util.Map;
import java.util.function.Function;

/**
 * Programmatic Hibernate bootstrap. Configuration comes from environment
 * variables so the same WAR runs in docker compose (Postgres) and in a
 * plain local Tomcat (falls back to in-memory H2 when DB_URL is unset).
 *
 *   DB_URL      e.g. jdbc:postgresql://db:5432/emr
 *   DB_USER     database user
 *   DB_PASSWORD database password
 */
public final class Db {

    private static volatile SessionFactory sessionFactory;

    private Db() {
    }

    public static SessionFactory sessionFactory() {
        if (sessionFactory == null) {
            synchronized (Db.class) {
                if (sessionFactory == null) {
                    sessionFactory = build(System.getenv());
                }
            }
        }
        return sessionFactory;
    }

    static SessionFactory build(Map<String, String> env) {
        String url = env.getOrDefault("DB_URL",
                "jdbc:h2:mem:emr;MODE=PostgreSQL;DB_CLOSE_DELAY=-1");
        String user = env.getOrDefault("DB_USER", "sa");
        String password = env.getOrDefault("DB_PASSWORD", "");

        Map<String, Object> settings = new HashMap<>();
        settings.put(AvailableSettings.JAKARTA_JDBC_URL, url);
        settings.put(AvailableSettings.JAKARTA_JDBC_USER, user);
        settings.put(AvailableSettings.JAKARTA_JDBC_PASSWORD, password);
        settings.put(AvailableSettings.HBM2DDL_AUTO, "update");
        settings.put(AvailableSettings.SHOW_SQL, "false");

        StandardServiceRegistry registry = new StandardServiceRegistryBuilder()
                .applySettings(settings)
                .build();

        return new MetadataSources(registry)
                .addAnnotatedClass(PatientEntity.class)
                .addAnnotatedClass(PractitionerEntity.class)
                .addAnnotatedClass(EncounterEntity.class)
                .addAnnotatedClass(ObservationEntity.class)
                .addAnnotatedClass(EventEntity.class)
                .buildMetadata()
                .buildSessionFactory();
    }

    /** Runs work in a transaction and returns its result. */
    public static <T> T tx(Function<org.hibernate.Session, T> work) {
        return sessionFactory().fromTransaction(work::apply);
    }

    public static void shutdown() {
        if (sessionFactory != null) {
            sessionFactory.close();
            sessionFactory = null;
        }
    }
}
