package org.riverside.emr.persistence;

import org.riverside.emr.entity.EncounterEntity;
import org.riverside.emr.entity.EventEntity;
import org.riverside.emr.entity.ObservationEntity;
import org.riverside.emr.entity.PatientEntity;
import org.riverside.emr.entity.PractitionerEntity;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * Thin data-access layer on top of {@link Db}. Deliberately plain queries -
 * the point of the playground is the FHIR layer, not the ORM.
 */
public class Repository {

    // ---- patients ----

    public Optional<PatientEntity> findPatient(long id) {
        return Optional.ofNullable(Db.tx(s -> s.find(PatientEntity.class, id)));
    }

    public List<PatientEntity> findPatients(String family, String mrn) {
        return Db.tx(s -> {
            StringBuilder hql = new StringBuilder("from PatientEntity p where 1=1");
            if (family != null) {
                hql.append(" and lower(p.familyName) like :family");
            }
            if (mrn != null) {
                hql.append(" and p.mrn = :mrn");
            }
            hql.append(" order by p.familyName, p.givenName");
            var query = s.createQuery(hql.toString(), PatientEntity.class);
            if (family != null) {
                query.setParameter("family", family.toLowerCase() + "%");
            }
            if (mrn != null) {
                query.setParameter("mrn", mrn);
            }
            return query.getResultList();
        });
    }

    // ---- practitioners ----

    public Optional<PractitionerEntity> findPractitioner(long id) {
        return Optional.ofNullable(Db.tx(s -> s.find(PractitionerEntity.class, id)));
    }

    public List<PractitionerEntity> findAllPractitioners() {
        return Db.tx(s -> s.createQuery(
                "from PractitionerEntity order by familyName", PractitionerEntity.class)
                .getResultList());
    }

    // ---- encounters ----

    public Optional<EncounterEntity> findEncounter(long id) {
        return Optional.ofNullable(Db.tx(s -> s.find(EncounterEntity.class, id)));
    }

    public List<EncounterEntity> findEncounters(Long patientId, String status) {
        return Db.tx(s -> {
            StringBuilder hql = new StringBuilder("from EncounterEntity e where 1=1");
            if (patientId != null) {
                hql.append(" and e.patient.id = :pid");
            }
            if (status != null) {
                hql.append(" and e.status = :status");
            }
            hql.append(" order by e.periodStart desc");
            var query = s.createQuery(hql.toString(), EncounterEntity.class);
            if (patientId != null) {
                query.setParameter("pid", patientId);
            }
            if (status != null) {
                query.setParameter("status", status);
            }
            return query.getResultList();
        });
    }

    // ---- observations ----

    public Optional<ObservationEntity> findObservation(long id) {
        return Optional.ofNullable(Db.tx(s -> s.find(ObservationEntity.class, id)));
    }

    public List<ObservationEntity> findObservations(Long patientId, String category) {
        return Db.tx(s -> {
            StringBuilder hql = new StringBuilder("from ObservationEntity o where 1=1");
            if (patientId != null) {
                hql.append(" and o.patient.id = :pid");
            }
            if (category != null) {
                hql.append(" and o.category = :category");
            }
            hql.append(" order by o.effectiveTime desc");
            var query = s.createQuery(hql.toString(), ObservationEntity.class);
            if (patientId != null) {
                query.setParameter("pid", patientId);
            }
            if (category != null) {
                query.setParameter("category", category);
            }
            return query.getResultList();
        });
    }

    // ---- events (outbox) ----

    public Optional<EventEntity> popNextUndeliveredEvent() {
        return Db.tx(s -> {
            List<EventEntity> next = s.createQuery(
                            "from EventEntity e where e.deliveredAt is null order by e.createdAt, e.id",
                            EventEntity.class)
                    .setMaxResults(1)
                    .getResultList();
            if (next.isEmpty()) {
                return Optional.empty();
            }
            EventEntity event = next.get(0);
            event.setDeliveredAt(Instant.now());
            s.merge(event);
            return Optional.of(event);
        });
    }

    public long countUndeliveredEvents() {
        return Db.tx(s -> s.createQuery(
                        "select count(e) from EventEntity e where e.deliveredAt is null", Long.class)
                .getSingleResult());
    }

    public long countPatients() {
        return Db.tx(s -> s.createQuery("select count(p) from PatientEntity p", Long.class)
                .getSingleResult());
    }

    // ---- writes ----

    public <T> T save(T entity) {
        return Db.tx(s -> {
            s.persist(entity);
            return entity;
        });
    }

    public <T> T update(T entity) {
        return Db.tx(s -> s.merge(entity));
    }
}
