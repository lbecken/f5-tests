# Stage 1: build both WARs with Gradle
FROM gradle:8.14-jdk21 AS build
WORKDIR /workspace
COPY settings.gradle.kts build.gradle.kts gradle.properties ./
COPY emr-server ./emr-server
COPY ward-dashboard ./ward-dashboard
RUN gradle --no-daemon war

# Stage 2: deploy them into Tomcat 10.1 (Jakarta EE 10, runs on JRE 21)
FROM tomcat:10.1-jre21
RUN rm -rf /usr/local/tomcat/webapps/*
COPY --from=build /workspace/emr-server/build/libs/emr.war /usr/local/tomcat/webapps/emr.war
COPY --from=build /workspace/ward-dashboard/build/libs/dashboard.war /usr/local/tomcat/webapps/dashboard.war
EXPOSE 8080
