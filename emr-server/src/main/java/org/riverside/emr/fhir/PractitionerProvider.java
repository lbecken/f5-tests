package org.riverside.emr.fhir;

import ca.uhn.fhir.rest.annotation.IdParam;
import ca.uhn.fhir.rest.annotation.Read;
import ca.uhn.fhir.rest.annotation.Search;
import ca.uhn.fhir.rest.server.IResourceProvider;
import ca.uhn.fhir.rest.server.exceptions.ResourceNotFoundException;
import org.hl7.fhir.r4.model.IdType;
import org.hl7.fhir.r4.model.Practitioner;
import org.riverside.emr.persistence.Repository;

import java.util.List;

public class PractitionerProvider implements IResourceProvider {

    private final Repository repository;

    public PractitionerProvider(Repository repository) {
        this.repository = repository;
    }

    @Override
    public Class<Practitioner> getResourceType() {
        return Practitioner.class;
    }

    @Read
    public Practitioner read(@IdParam IdType id) {
        return repository.findPractitioner(id.getIdPartAsLong())
                .map(FhirMapper::toFhir)
                .orElseThrow(() -> new ResourceNotFoundException(id));
    }

    @Search
    public List<Practitioner> search() {
        return repository.findAllPractitioners().stream()
                .map(FhirMapper::toFhir)
                .toList();
    }
}
