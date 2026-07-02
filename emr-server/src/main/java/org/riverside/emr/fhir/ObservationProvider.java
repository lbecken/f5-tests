package org.riverside.emr.fhir;

import ca.uhn.fhir.rest.annotation.IdParam;
import ca.uhn.fhir.rest.annotation.OptionalParam;
import ca.uhn.fhir.rest.annotation.Read;
import ca.uhn.fhir.rest.annotation.Search;
import ca.uhn.fhir.rest.param.ReferenceParam;
import ca.uhn.fhir.rest.param.TokenParam;
import ca.uhn.fhir.rest.server.IResourceProvider;
import ca.uhn.fhir.rest.server.exceptions.ResourceNotFoundException;
import org.hl7.fhir.r4.model.IdType;
import org.hl7.fhir.r4.model.Observation;
import org.riverside.emr.persistence.Repository;

import java.util.List;

/**
 * Serves Observation. Try:
 *   GET [base]/Observation?patient=1
 *   GET [base]/Observation?patient=1&amp;category=vital-signs
 */
public class ObservationProvider implements IResourceProvider {

    private final Repository repository;

    public ObservationProvider(Repository repository) {
        this.repository = repository;
    }

    @Override
    public Class<Observation> getResourceType() {
        return Observation.class;
    }

    @Read
    public Observation read(@IdParam IdType id) {
        return repository.findObservation(id.getIdPartAsLong())
                .map(FhirMapper::toFhir)
                .orElseThrow(() -> new ResourceNotFoundException(id));
    }

    @Search
    public List<Observation> search(
            @OptionalParam(name = Observation.SP_PATIENT) ReferenceParam patient,
            @OptionalParam(name = Observation.SP_CATEGORY) TokenParam category) {
        Long patientId = patient != null ? Long.valueOf(patient.getIdPart()) : null;
        String categoryValue = category != null ? category.getValue() : null;
        return repository.findObservations(patientId, categoryValue).stream()
                .map(FhirMapper::toFhir)
                .toList();
    }
}
