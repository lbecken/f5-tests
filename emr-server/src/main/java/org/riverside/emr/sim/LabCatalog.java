package org.riverside.emr.sim;

import java.util.List;
import java.util.Random;

/**
 * A tiny catalog of common lab tests and vital signs with real LOINC codes,
 * UCUM units and adult reference ranges. Values are generated around the
 * reference range so most results are normal and some are flagged.
 */
public final class LabCatalog {

    public record Test(String loinc, String display, String category,
                       String unit, double low, double high) {

        /** Generates a value mostly within range, occasionally outside it. */
        public double randomValue(Random random) {
            double span = high - low;
            // ~80% normal, ~20% skewed outside the reference range
            double center = low + span * random.nextDouble();
            if (random.nextDouble() < 0.2) {
                center += (random.nextBoolean() ? 1 : -1) * span * (0.2 + random.nextDouble() * 0.4);
            }
            return Math.round(center * 10.0) / 10.0;
        }
    }

    public static final List<Test> LABS = List.of(
            new Test("718-7", "Hemoglobin [Mass/volume] in Blood", "laboratory", "g/dL", 12.0, 17.5),
            new Test("6690-2", "Leukocytes [#/volume] in Blood", "laboratory", "10*3/uL", 4.5, 11.0),
            new Test("777-3", "Platelets [#/volume] in Blood", "laboratory", "10*3/uL", 150, 400),
            new Test("2345-7", "Glucose [Mass/volume] in Serum or Plasma", "laboratory", "mg/dL", 70, 100),
            new Test("2160-0", "Creatinine [Mass/volume] in Serum or Plasma", "laboratory", "mg/dL", 0.6, 1.3),
            new Test("2951-2", "Sodium [Moles/volume] in Serum or Plasma", "laboratory", "mmol/L", 135, 145),
            new Test("2823-3", "Potassium [Moles/volume] in Serum or Plasma", "laboratory", "mmol/L", 3.5, 5.1),
            new Test("1988-5", "C reactive protein [Mass/volume] in Serum or Plasma", "laboratory", "mg/L", 0, 5)
    );

    public static final List<Test> VITALS = List.of(
            new Test("8867-4", "Heart rate", "vital-signs", "/min", 60, 100),
            new Test("8480-6", "Systolic blood pressure", "vital-signs", "mm[Hg]", 100, 130),
            new Test("8462-4", "Diastolic blood pressure", "vital-signs", "mm[Hg]", 60, 85),
            new Test("8310-5", "Body temperature", "vital-signs", "Cel", 36.2, 37.6),
            new Test("2708-6", "Oxygen saturation in Arterial blood", "vital-signs", "%", 94, 100),
            new Test("9279-1", "Respiratory rate", "vital-signs", "/min", 12, 20)
    );

    public static Test randomLab(Random random) {
        return LABS.get(random.nextInt(LABS.size()));
    }

    public static Test randomVital(Random random) {
        return VITALS.get(random.nextInt(VITALS.size()));
    }

    private LabCatalog() {
    }
}
