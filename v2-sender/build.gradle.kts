plugins {
    application
}

application {
    mainClass.set("org.riverside.v2sender.V2Sender")
}

// No dependencies on purpose: HL7 v2 is pipes-and-hats text and MLLP is a
// trivial framing protocol - seeing that helps demystify both.
