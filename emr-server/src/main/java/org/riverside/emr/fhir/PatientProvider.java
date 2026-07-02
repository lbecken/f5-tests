package org.riverside.emr.fhir;

import ca.uhn.fhir.rest.annotation.IdParam;
import ca.uhn.fhir.rest.annotation.OptionalParam;
import ca.uhn.fhir.rest.annotation.Read;
import ca.uhn.fhir.rest.annotation.Search;
import ca.uhn.fhir.rest.param.StringParam;
import ca.uhn.fhir.rest.param.TokenParam;
import ca.uhn.fhir.rest.server.IResourceProvider;
import ca.uhn.fhir.rest.server.exceptions.ResourceNotFoundException;
import org.hl7.fhir.r4.model.IdType;
import org.hl7.fhir.r4.model.Patient;
import org.riverside.emr.persistence.Repository;

import java.util.List;

/**
 * Serves Patient. Try:
 *   GET [base]/Patient/1
 *   GET [base]/Patient?family=diaz
 *   GET [base]/Patient?identifier=MRN-100234
 */
public class PatientProvider implements IResourceProvider {

    private final Repository repository;

    public PatientProvider(Repository repository) {
        this.repository = repository;
    }

    @Override
    public Class<Patient> getResourceType() {
        return Patient.class;
    }

    @Read
    public Patient read(@IdParam IdType id) {
        return repository.findPatient(id.getIdPartAsLong())
                .map(FhirMapper::toFhir)
                .orElseThrow(() -> new ResourceNotFoundException(id));
    }

    @Search
    public List<Patient> search(
            @OptionalParam(name = Patient.SP_FAMILY) StringParam family,
            @OptionalParam(name = Patient.SP_IDENTIFIER) TokenParam identifier) {
        String familyValue = family != null ? family.getValue() : null;
        String mrn = identifier != null ? identifier.getValue() : null;
        return repository.findPatients(familyValue, mrn).stream()
                .map(FhirMapper::toFhir)
                .toList();
    }
}
