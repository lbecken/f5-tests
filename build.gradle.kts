plugins {
    java
    application
    id("com.gradleup.shadow") version "8.3.6"
}

group = "dev.syndata"
version = "0.1.0"

repositories {
    mavenCentral()
}

dependencies {
    implementation("info.picocli:picocli:4.7.7")
    implementation("org.postgresql:postgresql:42.7.7")
    implementation("com.fasterxml.jackson.core:jackson-databind:2.19.0")
    implementation("com.fasterxml.jackson.datatype:jackson-datatype-jsr310:2.19.0")
    implementation("net.datafaker:datafaker:2.4.3")
    implementation("org.slf4j:slf4j-simple:2.0.17")

    // JPA / validation APIs so the optional entity scanner can read annotations
    // from the user's compiled entity classes.
    implementation("jakarta.persistence:jakarta.persistence-api:3.1.0")
    implementation("jakarta.validation:jakarta.validation-api:3.0.2")

    testImplementation(platform("org.junit:junit-bom:5.12.2"))
    testImplementation("org.junit.jupiter:junit-jupiter")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

application {
    mainClass.set("dev.syndata.Main")
}

tasks.withType<JavaCompile> {
    options.release.set(17)
}

tasks.test {
    useJUnitPlatform()
    testLogging {
        events("passed", "failed", "skipped")
    }
}

tasks.shadowJar {
    archiveBaseName.set("syndata")
    archiveClassifier.set("")
    mergeServiceFiles()
}
