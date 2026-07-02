package com.example.app.persistence;

import jakarta.annotation.PreDestroy;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.context.RequestScoped;
import jakarta.enterprise.inject.Disposes;
import jakarta.enterprise.inject.Produces;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import jakarta.persistence.Persistence;

/**
 * Bridges JPA into CDI on a plain servlet container.
 *
 * Tomcat has no built-in JPA/JTA integration, so the EntityManagerFactory is
 * bootstrapped manually from META-INF/persistence.xml (RESOURCE_LOCAL) and a
 * request-scoped EntityManager is exposed for injection with {@code @Inject}.
 */
@ApplicationScoped
public class EntityManagerProducer {

    private EntityManagerFactory emf;

    private synchronized EntityManagerFactory factory() {
        if (emf == null) {
            emf = Persistence.createEntityManagerFactory("primaryPU");
        }
        return emf;
    }

    @Produces
    @RequestScoped
    public EntityManager entityManager() {
        return factory().createEntityManager();
    }

    public void close(@Disposes EntityManager em) {
        if (em.isOpen()) {
            em.close();
        }
    }

    @PreDestroy
    public void shutdown() {
        if (emf != null && emf.isOpen()) {
            emf.close();
        }
    }
}
