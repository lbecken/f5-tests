package org.riverside.emr.fhir;

import ca.uhn.fhir.rest.annotation.IdParam;
import ca.uhn.fhir.rest.annotation.OptionalParam;
import ca.uhn.fhir.rest.annotation.Read;
import ca.uhn.fhir.rest.annotation.Search;
import ca.uhn.fhir.rest.param.ReferenceParam;
import ca.uhn.fhir.rest.param.TokenParam;
import ca.uhn.fhir.rest.server.IResourceProvider;
import ca.uhn.fhir.rest.server.exceptions.ResourceNotFoundException;
import org.hl7.fhir.r4.model.Encounter;
import org.hl7.fhir.r4.model.IdType;
import org.riverside.emr.persistence.Repository;

import java.util.List;

/**
 * Serves Encounter. Try:
 *   GET [base]/Encounter?patient=1
 *   GET [base]/Encounter?status=in-progress   (the current inpatient census)
 */
public class EncounterProvider implements IResourceProvider {

    private final Repository repository;

    public EncounterProvider(Repository repository) {
        this.repository = repository;
    }

    @Override
    public Class<Encounter> getResourceType() {
        return Encounter.class;
    }

    @Read
    public Encounter read(@IdParam IdType id) {
        return repository.findEncounter(id.getIdPartAsLong())
                .map(FhirMapper::toFhir)
                .orElseThrow(() -> new ResourceNotFoundException(id));
    }

    @Search
    public List<Encounter> search(
            @OptionalParam(name = Encounter.SP_PATIENT) ReferenceParam patient,
            @OptionalParam(name = Encounter.SP_STATUS) TokenParam status) {
        Long patientId = patient != null ? Long.valueOf(patient.getIdPart()) : null;
        String statusValue = status != null ? status.getValue() : null;
        return repository.findEncounters(patientId, statusValue).stream()
                .map(FhirMapper::toFhir)
                .toList();
    }
}
