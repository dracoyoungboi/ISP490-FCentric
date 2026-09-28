# ===== Build stage =====
FROM maven:3.9.6-eclipse-temurin-17 AS build

WORKDIR /app
COPY pom.xml .
COPY src ./src

RUN mvn -e -B -DskipTests clean package

# ===== Run stage =====
FROM eclipse-temurin:17-jre-alpine
RUN apk add --no-cache wget tzdata

WORKDIR /app
COPY --from=build /app/target/*.jar app.jar

EXPOSE 8080

ENV JAVA_OPTS="-Xms512m -Xmx1024m"
# Múi giờ cho JVM trong container (Alpine mặc định UTC) — đồng bộ với máy chủ MySQL ở Việt Nam
ENV TZ=Asia/Ho_Chi_Minh

HEALTHCHECK --interval=30s --timeout=3s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
