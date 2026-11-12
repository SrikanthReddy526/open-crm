# Open CRM — single-server image: website + API in one container.
# Used by Render (render.yaml). The image is built on Render's servers; nothing runs on your PC.
# The Docker Compose setup in deploy/ (Caddy + separate containers) still works as before.

# 1) Website
FROM node:24-alpine AS web
WORKDIR /src
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ .
# Same origin as the API, so no API URL is baked in.
ENV VITE_API_URL=
RUN npm run build

# 2) API, with the website bundled as static files
FROM eclipse-temurin:21-jdk AS api
WORKDIR /src
COPY backend/.mvn/ .mvn/
COPY backend/mvnw backend/pom.xml ./
RUN sed -i 's/\r$//' mvnw && chmod +x mvnw && ./mvnw -q -B dependency:go-offline
COPY backend/src/ src/
COPY --from=web /src/dist/ src/main/resources/static/
RUN ./mvnw -q -B -DskipTests package && cp target/*.jar /src/app.jar

# 3) Runtime
FROM eclipse-temurin:21-jre
RUN groupadd --system app && useradd --system --gid app --home /app app
WORKDIR /app
COPY --from=api /src/app.jar app.jar
USER app
EXPOSE 8080
# Tuned for small (512 MB) hosts: capped heap, low-overhead GC, faster startup.
ENV SPRING_PROFILES_ACTIVE=prod \
    JAVA_TOOL_OPTIONS="-Xmx300m -Xss512k -XX:MaxMetaspaceSize=160m -XX:+UseSerialGC -XX:TieredStopAtLevel=1 -XX:+ExitOnOutOfMemoryError"
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
