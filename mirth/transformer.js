/**
 * Mirth destination transformer step: HL7 v2 -> FHIR R4 message Bundle.
 *
 * This is THE classic interface-engine job. `msg` is Mirth's parsed E4X view
 * of the inbound v2 message; we read the familiar segments (MSH/PID/PV1/OBX)
 * and build the FHIR message Bundle that the EMR's $process-message endpoint
 * understands. The result is stored in the channel map and the HTTP Sender
 * destination posts ${fhirMessage}.
 *
 * Kept as a standalone .js file so you can read it in the repo and paste it
 * into a channel by hand if you build one from scratch.
 */

var EVENT_SYSTEM = 'https://riverside-medical.example.org/fhir/message-events';
var MRN_SYSTEM = 'https://riverside-medical.example.org/mrn';

// --- OAuth2 client-credentials token for the EMR (Keycloak) ---
// The interface engine authenticates like any other backend service. The
// token is cached in the global channel map until shortly before expiry.
// Fail-soft: when Keycloak is unreachable we send no token, which still
// works against an EMR running with AUTH_ENABLED=false.
var TOKEN_URL = 'http://keycloak:8080/realms/riverside/protocol/openid-connect/token';
var CLIENT_ID = 'mirth-gateway';
var CLIENT_SECRET = 'mirth-secret-change-me';

function getAuthorizationHeader() {
    try {
        var now = java.lang.System.currentTimeMillis();
        var cached = globalChannelMap.get('kcToken');
        var expiry = globalChannelMap.get('kcTokenExpiry');
        if (cached != null && expiry != null && now < expiry - 30000) {
            return 'Bearer ' + cached;
        }
        var conn = new java.net.URL(TOKEN_URL).openConnection();
        conn.setRequestMethod('POST');
        conn.setDoOutput(true);
        conn.setConnectTimeout(5000);
        conn.setReadTimeout(5000);
        conn.setRequestProperty('Content-Type', 'application/x-www-form-urlencoded');
        var body = 'grant_type=client_credentials&client_id=' + CLIENT_ID
                + '&client_secret=' + CLIENT_SECRET;
        var os = conn.getOutputStream();
        os.write(new java.lang.String(body).getBytes('UTF-8'));
        os.close();
        var response = org.apache.commons.io.IOUtils.toString(conn.getInputStream(), 'UTF-8');
        var token = JSON.parse(response);
        globalChannelMap.put('kcToken', token.access_token);
        globalChannelMap.put('kcTokenExpiry', now + token.expires_in * 1000);
        return 'Bearer ' + token.access_token;
    } catch (e) {
        logger.warn('Could not fetch access token from Keycloak (' + e + '); sending without token');
        return '';
    }
}

channelMap.put('authHeader', getAuthorizationHeader());

var messageType = msg['MSH']['MSH.9']['MSH.9.1'].toString();   // ADT / ORU
var trigger = msg['MSH']['MSH.9']['MSH.9.2'].toString();       // A01 / A03 / R01

// --- map the v2 event to our FHIR message event code ---
var eventCode;
if (messageType == 'ADT' && trigger == 'A01') eventCode = 'admit';
else if (messageType == 'ADT' && trigger == 'A03') eventCode = 'discharge';
else if (messageType == 'ORU') eventCode = 'lab-result';
else throw 'Unsupported message type: ' + messageType + '^' + trigger;

// --- PID -> Patient ---
function fhirDate(v2date) {
    var s = v2date.toString();
    if (s.length < 8) return null;
    return s.substring(0, 4) + '-' + s.substring(4, 6) + '-' + s.substring(6, 8);
}

var genderMap = { M: 'male', F: 'female', O: 'other' };
var patient = {
    resourceType: 'Patient',
    identifier: [{ system: MRN_SYSTEM, value: msg['PID']['PID.3']['PID.3.1'].toString() }],
    name: [{
        family: msg['PID']['PID.5']['PID.5.1'].toString(),
        given: [msg['PID']['PID.5']['PID.5.2'].toString()]
    }],
    gender: genderMap[msg['PID']['PID.8']['PID.8.1'].toString()] || 'unknown',
    birthDate: fhirDate(msg['PID']['PID.7']['PID.7.1'])
};

var focus = [patient];

// --- PV1 -> Encounter (for ADT) ---
if (messageType == 'ADT') {
    var ward = msg['PV1']['PV1.3']['PV1.3.1'].toString();
    var bed = msg['PV1']['PV1.3']['PV1.3.2'].toString();
    focus.push({
        resourceType: 'Encounter',
        status: eventCode == 'admit' ? 'in-progress' : 'finished',
        'class': {
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
            code: 'IMP',
            display: 'inpatient encounter'
        },
        location: ward ? [{ location: { display: ward + (bed ? ', Bed ' + bed : '') } }] : [],
        reasonCode: [{ text: 'Transferred from Community Clinic (HL7 v2 ' + messageType + '^' + trigger + ')' }]
    });
}

// --- OBX -> Observation (for ORU) ---
if (messageType == 'ORU') {
    var obx = msg['OBX'][0] !== undefined ? msg['OBX'][0] : msg['OBX'];
    var range = obx['OBX.7']['OBX.7.1'].toString().split('-');
    var observation = {
        resourceType: 'Observation',
        status: 'final',
        category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'laboratory' }] }],
        code: {
            coding: [{
                system: 'http://loinc.org',
                code: obx['OBX.3']['OBX.3.1'].toString(),
                display: obx['OBX.3']['OBX.3.2'].toString()
            }]
        },
        valueQuantity: {
            value: parseFloat(obx['OBX.5']['OBX.5.1'].toString()),
            unit: obx['OBX.6']['OBX.6.1'].toString(),
            system: 'http://unitsofmeasure.org',
            code: obx['OBX.6']['OBX.6.1'].toString()
        },
        effectiveDateTime: new Date().toISOString()
    };
    if (range.length == 2) {
        observation.referenceRange = [{
            low: { value: parseFloat(range[0]) },
            high: { value: parseFloat(range[1]) }
        }];
    }
    focus.push(observation);
}

// --- assemble the message Bundle ---
var entries = [];
var focusRefs = [];
for (var i = 0; i < focus.length; i++) {
    var url = 'urn:uuid:' + UUIDGenerator.getUUID();
    focusRefs.push({ reference: url });
    entries.push({ fullUrl: url, resource: focus[i] });
}

var header = {
    resourceType: 'MessageHeader',
    id: UUIDGenerator.getUUID(),
    eventCoding: { system: EVENT_SYSTEM, code: eventCode, display: eventCode },
    source: {
        name: 'Mirth Connect (v2 gateway)',
        endpoint: 'mllp://mirth:6661'
    },
    focus: focusRefs
};

var bundle = {
    resourceType: 'Bundle',
    type: 'message',
    timestamp: new Date().toISOString(),
    entry: [{ fullUrl: 'urn:uuid:' + UUIDGenerator.getUUID(), resource: header }].concat(entries)
};

channelMap.put('fhirMessage', JSON.stringify(bundle, null, 2));
