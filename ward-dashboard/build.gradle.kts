val hapiFhirVersion: String by project
val servletApiVersion: String by project
val jacksonVersion: String by project
val junitVersion: String by project

dependencies {
    // Provided by Tomcat 10.1 (Jakarta EE 10)
    compileOnly("jakarta.servlet:jakarta.servlet-api:$servletApiVersion")

    // HAPI FHIR client - the idiomatic way to talk to a FHIR server from Java
    implementation("ca.uhn.hapi.fhir:hapi-fhir-base:$hapiFhirVersion")
    implementation("ca.uhn.hapi.fhir:hapi-fhir-structures-r4:$hapiFhirVersion")
    implementation("ca.uhn.hapi.fhir:hapi-fhir-client:$hapiFhirVersion")

    implementation("com.fasterxml.jackson.core:jackson-databind:$jacksonVersion")

    implementation("org.slf4j:slf4j-simple:2.0.13")

    testImplementation("org.junit.jupiter:junit-jupiter:$junitVersion")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.war {
    archiveFileName.set("dashboard.war")
}
