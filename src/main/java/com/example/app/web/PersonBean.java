package com.example.app.web;

import java.io.Serializable;
import java.util.List;

import com.example.app.entity.Person;
import com.example.app.repository.PersonRepository;

import jakarta.annotation.PostConstruct;
import jakarta.faces.application.FacesMessage;
import jakarta.faces.context.FacesContext;
import jakarta.faces.view.ViewScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;

/**
 * Backing bean for index.xhtml (JSF 3.0 + PrimeFaces + CDI).
 *
 * Good hotswap test subject: start a debug session, change the body of
 * {@link #add()} (e.g. tweak the growl message), save in Eclipse, and the
 * change is live on the next click - no redeploy.
 */
@Named
@ViewScoped
public class PersonBean implements Serializable {

    private static final long serialVersionUID = 1L;

    @Inject
    private PersonRepository repository;

    private List<Person> persons;
    private Person newPerson = new Person();

    @PostConstruct
    public void init() {
        refresh();
    }

    public void refresh() {
        persons = repository.findAll();
    }

    public void add() {
        repository.save(newPerson);
        FacesContext.getCurrentInstance().addMessage(null,
                new FacesMessage(FacesMessage.SEVERITY_INFO, "Saved",
                        "Person '" + newPerson.getName() + "' saved."));
        newPerson = new Person();
        refresh();
    }

    public void delete(Person person) {
        repository.delete(person.getId());
        FacesContext.getCurrentInstance().addMessage(null,
                new FacesMessage(FacesMessage.SEVERITY_WARN, "Deleted",
                        "Person '" + person.getName() + "' deleted."));
        refresh();
    }

    public List<Person> getPersons() {
        return persons;
    }

    public Person getNewPerson() {
        return newPerson;
    }
}
