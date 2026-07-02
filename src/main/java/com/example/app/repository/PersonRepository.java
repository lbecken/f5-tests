package com.example.app.repository;

import java.util.List;

import com.example.app.entity.Person;
import com.example.app.persistence.Transactional;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;

@ApplicationScoped
public class PersonRepository {

    @Inject
    private EntityManager em;

    public List<Person> findAll() {
        return em.createQuery("select p from Person p order by p.id", Person.class)
                .getResultList();
    }

    @Transactional
    public Person save(Person person) {
        if (person.getId() == null) {
            em.persist(person);
            return person;
        }
        return em.merge(person);
    }

    @Transactional
    public void delete(Long id) {
        Person managed = em.find(Person.class, id);
        if (managed != null) {
            em.remove(managed);
        }
    }
}
