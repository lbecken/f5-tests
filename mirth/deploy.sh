#!/bin/sh
# Imports and deploys the HL7v2->FHIR channel into Mirth Connect via its
# REST API. Runs as the one-shot `mirth-deploy` compose service, but can be
# run from the host too:  MIRTH_URL=https://localhost:8444 sh mirth/deploy.sh
set -eu

MIRTH_URL="${MIRTH_URL:-https://mirth:8443}"
MIRTH_USER="${MIRTH_USER:-admin}"
MIRTH_PASS="${MIRTH_PASS:-admin}"
CHANNEL_FILE="${CHANNEL_FILE:-/mirth/channels/hl7v2-to-fhir.xml}"
CHANNEL_ID="e7261a4f-3a83-4a5e-9a5a-1b2c3d4e5f60"

auth="-k -u ${MIRTH_USER}:${MIRTH_PASS} -H 'X-Requested-With: OpenAPI'"

echo "Waiting for Mirth Connect API at ${MIRTH_URL} ..."
i=0
until curl -ksf -u "${MIRTH_USER}:${MIRTH_PASS}" -H "X-Requested-With: OpenAPI" \
        "${MIRTH_URL}/api/server/status" >/dev/null 2>&1; do
    i=$((i + 1))
    [ "$i" -gt 60 ] && echo "Mirth did not come up in time" && exit 1
    sleep 5
done

echo "Importing channel ..."
curl -ksf -u "${MIRTH_USER}:${MIRTH_PASS}" -H "X-Requested-With: OpenAPI" \
    -H "Content-Type: application/xml" \
    -X PUT "${MIRTH_URL}/api/channels/${CHANNEL_ID}?override=true" \
    --data-binary "@${CHANNEL_FILE}" >/dev/null

echo "Deploying channel ..."
curl -ksf -u "${MIRTH_USER}:${MIRTH_PASS}" -H "X-Requested-With: OpenAPI" \
    -X POST "${MIRTH_URL}/api/channels/${CHANNEL_ID}/_deploy" >/dev/null

echo "Channel imported and deployed. MLLP listener on port 6661."
