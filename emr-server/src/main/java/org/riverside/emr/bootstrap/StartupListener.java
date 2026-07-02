package org.riverside.emr.bootstrap;

import jakarta.servlet.ServletContextEvent;
import jakarta.servlet.ServletContextListener;
import jakarta.servlet.annotation.WebListener;
import org.riverside.emr.entity.PatientEntity;
import org.riverside.emr.entity.PractitionerEntity;
import org.riverside.emr.persistence.Db;
import org.riverside.emr.persistence.Repository;
import org.riverside.emr.sim.ClinicalSimulator;
import org.riverside.emr.sim.LabCatalog;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Random;

/**
 * Creates the schema (hbm2ddl auto=update) and seeds the hospital with a
 * plausible starting state: a patient panel, a few clinicians, two current
 * inpatients with vitals/labs, and a couple of undelivered events so the
 * message feed has something to show right away.
 */
@WebListener
public class StartupListener implements ServletContextListener {

    private static final Logger log = LoggerFactory.getLogger(StartupListener.class);

    @Override
    public void contextInitialized(ServletContextEvent sce) {
        Repository repository = new Repository();
        if (repository.countPatients() > 0) {
            log.info("Database already seeded, {} undelivered event(s) pending",
                    repository.countUndeliveredEvents());
            return;
        }
        log.info("Seeding EMR database ...");
        seed(repository, new Random(42));
        log.info("Seed complete: {} patients, {} pending event(s)",
                repository.countPatients(), repository.countUndeliveredEvents());
    }

    @Override
    public void contextDestroyed(ServletContextEvent sce) {
        Db.shutdown();
    }

    public static void seed(Repository repository, Random random) {
        List<PractitionerEntity> practitioners = List.of(
                practitioner("1932475810", "Okafor", "Amara", "Dr.", "Internal Medicine"),
                practitioner("1740283927", "Lindqvist", "Erik", "Dr.", "Cardiology"),
                practitioner("1568301246", "Marchetti", "Sofia", "Dr.", "Emergency Medicine"));
        practitioners.forEach(repository::save);

        List<PatientEntity> patients = List.of(
                patient("MRN-100234", "Diaz", "Jane", "female", LocalDate.of(1968, 3, 14),
                        "555-0134", "1420 Alder Street", "Riverside", "97201"),
                patient("MRN-100519", "Kowalski", "Piotr", "male", LocalDate.of(1955, 11, 2),
                        "555-0177", "88 Birchwood Ave", "Riverside", "97203"),
                patient("MRN-100777", "Nguyen", "Linh", "female", LocalDate.of(1990, 7, 23),
                        "555-0121", "301 Cedar Lane", "Riverside", "97202"),
                patient("MRN-101042", "Johansson", "Maja", "female", LocalDate.of(1982, 1, 9),
                        "555-0165", "77 Dogwood Court", "Riverside", "97201"),
                patient("MRN-101388", "Okonkwo", "Chidi", "male", LocalDate.of(1947, 6, 30),
                        "555-0142", "9 Elm Park", "Riverside", "97204"),
                patient("MRN-101533", "Braun", "Stefan", "male", LocalDate.of(1975, 9, 18),
                        "555-0190", "245 Fir Ridge Rd", "Riverside", "97203"));
        patients.forEach(repository::save);

        ClinicalSimulator simulator = new ClinicalSimulator(repository, random);

        // Two patients are currently admitted; give them a set of admission
        // vitals and labs recorded over the last day (history only, no events).
        for (PatientEntity inpatient : List.of(patients.get(0), patients.get(4))) {
            var encounter = simulator.admit(inpatient);
            for (int i = 0; i < 4; i++) {
                Instant when = Instant.now().minus(6L * (4 - i), ChronoUnit.HOURS);
                simulator.recordObservation(inpatient, encounter,
                        LabCatalog.randomVital(random), when, false);
                simulator.recordObservation(inpatient, encounter,
                        LabCatalog.randomLab(random), when, false);
            }
        }

        // Outpatient history for everyone else.
        for (PatientEntity outpatient : List.of(patients.get(1), patients.get(2),
                patients.get(3), patients.get(5))) {
            for (int i = 0; i < 3; i++) {
                Instant when = Instant.now().minus(30L * (i + 1), ChronoUnit.DAYS);
                simulator.recordObservation(outpatient, null,
                        LabCatalog.randomLab(random), when, false);
            }
        }

        // A couple of fresh lab results so the dashboard feed is not empty.
        simulator.produceRandomLabResult();
        simulator.produceRandomLabResult();
    }

    private static PractitionerEntity practitioner(String npi, String family, String given,
                                                   String prefix, String specialty) {
        PractitionerEntity p = new PractitionerEntity();
        p.setNpi(npi);
        p.setFamilyName(family);
        p.setGivenName(given);
        p.setPrefix(prefix);
        p.setSpecialty(specialty);
        return p;
    }

    private static PatientEntity patient(String mrn, String family, String given, String gender,
                                         LocalDate birthDate, String phone, String address,
                                         String city, String postalCode) {
        PatientEntity p = new PatientEntity();
        p.setMrn(mrn);
        p.setFamilyName(family);
        p.setGivenName(given);
        p.setGender(gender);
        p.setBirthDate(birthDate);
        p.setPhone(phone);
        p.setAddressLine(address);
        p.setCity(city);
        p.setPostalCode(postalCode);
        return p;
    }
}
