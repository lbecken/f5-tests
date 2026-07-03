package org.riverside.v2sender;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Random;

/**
 * Plays the role of an upstream clinic system that still speaks HL7 v2:
 * builds ADT^A01 / ADT^A03 / ORU^R01 (v2.5) messages and sends them over
 * MLLP to the Mirth channel, printing the returned ACK.
 *
 * Usage:
 *   ./gradlew :v2-sender:run --args="admit"
 *   ./gradlew :v2-sender:run --args="lab --host localhost --port 6661"
 *   ./gradlew :v2-sender:run --args="discharge"
 *
 * MLLP framing: <VT>message<FS><CR>  (0x0B ... 0x1C 0x0D)
 */
public final class V2Sender {

    private static final char VT = 0x0B;
    private static final char FS = 0x1C;
    private static final char CR = 0x0D;

    private record Person(String mrn, String family, String given, String dob, String sex) {
    }

    /**
     * Two MRNs match patients seeded in the EMR (identity match on MRN);
     * the others are new to the EMR and will be auto-registered on admit -
     * exactly what happens when an external clinic sends an unknown patient.
     */
    private static final List<Person> PATIENTS = List.of(
            new Person("MRN-100519", "Kowalski", "Piotr", "19551102", "M"),
            new Person("MRN-100777", "Nguyen", "Linh", "19900723", "F"),
            new Person("MRN-200101", "Petrova", "Elena", "19850214", "F"),
            new Person("MRN-200102", "Almeida", "Rafael", "19771130", "M"),
            new Person("MRN-200103", "Yamamoto", "Kenji", "19621208", "M"));

    private record Lab(String loinc, String name, String unit, String range, double lo, double hi) {
    }

    private static final List<Lab> LABS = List.of(
            new Lab("2345-7", "Glucose", "mg/dL", "70-100", 70, 100),
            new Lab("718-7", "Hemoglobin", "g/dL", "12.0-17.5", 12.0, 17.5),
            new Lab("2823-3", "Potassium", "mmol/L", "3.5-5.1", 3.5, 5.1),
            new Lab("2160-0", "Creatinine", "mg/dL", "0.6-1.3", 0.6, 1.3));

    private static final Random RANDOM = new Random();

    public static void main(String[] args) throws Exception {
        String type = args.length > 0 ? args[0] : "admit";
        String host = argValue(args, "--host", "localhost");
        int port = Integer.parseInt(argValue(args, "--port", "6661"));

        String message = switch (type) {
            case "admit" -> adt("A01");
            case "discharge" -> adt("A03");
            case "lab" -> oru();
            default -> throw new IllegalArgumentException(
                    "unknown message type: " + type + " (use admit|discharge|lab)");
        };

        System.out.println("--- sending HL7 v2 to " + host + ":" + port + " ---");
        System.out.println(message.replace("\r", "\n"));
        String ack = sendMllp(host, port, message);
        System.out.println("--- ACK ---");
        System.out.println(ack.replace("\r", "\n"));
    }

    private static String adt(String trigger) {
        Person p = PATIENTS.get(RANDOM.nextInt(PATIENTS.size()));
        String ts = now();
        String controlId = "MSG" + ts + RANDOM.nextInt(1000);
        return String.join("\r",
                "MSH|^~\\&|CLINIC-SYS|COMMUNITY-CLINIC|EMR|RIVERSIDE|" + ts + "||ADT^" + trigger
                        + "|" + controlId + "|P|2.5",
                "EVN|" + trigger + "|" + ts,
                pid(p),
                "PV1|1|I|4W^" + (1 + RANDOM.nextInt(20)) + "^A||||1740283927^Lindqvist^Erik^^^Dr."
                        + "|||MED||||7|||1740283927^Lindqvist^Erik^^^Dr.|IP|V"
                        + RANDOM.nextInt(9999) + "|||||||||||||||||||||||||" + ts);
    }

    private static String oru() {
        Person p = PATIENTS.get(RANDOM.nextInt(PATIENTS.size()));
        Lab lab = LABS.get(RANDOM.nextInt(LABS.size()));
        double span = lab.hi - lab.lo;
        double value = Math.round((lab.lo + RANDOM.nextDouble() * span * 1.4) * 10.0) / 10.0;
        String flag = value > lab.hi ? "H" : value < lab.lo ? "L" : "N";
        String ts = now();
        String controlId = "MSG" + ts + RANDOM.nextInt(1000);
        return String.join("\r",
                "MSH|^~\\&|LAB-SYS|COMMUNITY-CLINIC|EMR|RIVERSIDE|" + ts + "||ORU^R01|"
                        + controlId + "|P|2.5",
                pid(p),
                "OBR|1||" + RANDOM.nextInt(99999) + "|" + lab.loinc + "^" + lab.name
                        + "^LN|||" + ts + "||||||||||||||||||F",
                "OBX|1|NM|" + lab.loinc + "^" + lab.name + "^LN||" + value + "|" + lab.unit
                        + "|" + lab.range + "|" + flag + "|||F|||" + ts);
    }

    private static String pid(Person p) {
        return "PID|1||" + p.mrn + "^^^RIVERSIDE^MR||" + p.family + "^" + p.given
                + "||" + p.dob + "|" + p.sex + "|||12 Maple St^^Riverside^OR^97201||555-01"
                + (10 + RANDOM.nextInt(89));
    }

    private static String sendMllp(String host, int port, String message) throws Exception {
        try (Socket socket = new Socket(host, port)) {
            socket.setSoTimeout(10_000);
            OutputStream out = socket.getOutputStream();
            out.write(VT);
            out.write(message.getBytes(StandardCharsets.UTF_8));
            out.write(FS);
            out.write(CR);
            out.flush();

            InputStream in = socket.getInputStream();
            StringBuilder ack = new StringBuilder();
            int b;
            while ((b = in.read()) != -1) {
                if (b == FS) {
                    break;
                }
                if (b != VT) {
                    ack.append((char) b);
                }
            }
            return ack.toString();
        }
    }

    private static String now() {
        return LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
    }

    private static String argValue(String[] args, String name, String fallback) {
        for (int i = 0; i < args.length - 1; i++) {
            if (args[i].equals(name)) {
                return args[i + 1];
            }
        }
        return fallback;
    }
}
