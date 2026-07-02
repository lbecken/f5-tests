# Tomcat 10.1 on Eclipse Temurin JDK 21 - the default development image.
#
# Remote debugging (JDWP) is enabled by starting with `catalina.sh jpda run`
# (see docker-compose.yml). With a debug session attached, the standard JVM
# already hot-swaps METHOD BODY changes pushed by Eclipse - no redeploy.
# For structural changes (new methods/fields) either run `./gradlew deploy`
# or use Dockerfile.jbr-hotswap (JetBrains Runtime + HotswapAgent).
FROM tomcat:10.1-jdk21-temurin

# Remove the default webapps (docs, examples, manager...). The real webapps
# directory is bind-mounted from ./deploy anyway.
RUN rm -rf /usr/local/tomcat/webapps/* /usr/local/tomcat/webapps.dist

EXPOSE 8080 8000
