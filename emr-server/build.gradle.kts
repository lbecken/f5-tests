plugins {
    war
}

val hapiFhirVersion: String by project
val hibernateVersion: String by project
val postgresVersion: String by project
val h2Version: String by project
val servletApiVersion: String by project
val jacksonVersion: String by project
val junitVersion: String by project

dependencies {
    // Provided by Tomcat 10.1 (Jakarta EE 10)
    compileOnly("jakarta.servlet:jakarta.servlet-api:$servletApiVersion")

    // HAPI FHIR - R4 model + RESTful server framework
    implementation("ca.uhn.hapi.fhir:hapi-fhir-base:$hapiFhirVersion")
    implementation("ca.uhn.hapi.fhir:hapi-fhir-structures-r4:$hapiFhirVersion")
    implementation("ca.uhn.hapi.fhir:hapi-fhir-server:$hapiFhirVersion")

    // Persistence
    implementation("org.hibernate.orm:hibernate-core:$hibernateVersion")
    runtimeOnly("org.postgresql:postgresql:$postgresVersion")
    runtimeOnly("com.h2database:h2:$h2Version")

    implementation("com.fasterxml.jackson.core:jackson-databind:$jacksonVersion")

    // Logging (HAPI uses slf4j)
    implementation("org.slf4j:slf4j-simple:2.0.13")

    testImplementation("org.junit.jupiter:junit-jupiter:$junitVersion")
    testImplementation("jakarta.servlet:jakarta.servlet-api:$servletApiVersion")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
    testRuntimeOnly("com.h2database:h2:$h2Version")
}

tasks.war {
    archiveFileName.set("emr.war")
}
