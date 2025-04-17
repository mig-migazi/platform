#!/bin/bash

set -e

# Parse command line arguments
KEEP_DATA=false
START_APP=false
while [[ $# -gt 0 ]]; do
    case $1 in
        --keep-data)
            KEEP_DATA=true
            shift
            ;;
        --start-app)
            START_APP=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--keep-data] [--start-app]"
            echo "  --keep-data: Keep existing volumes, topics, and data"
            echo "  --start-app: Start the frontend and backend services"
            exit 1
            ;;
    esac
done

# Change to project root directory
cd "$(dirname "$0")/../.."

echo "Starting IoT Platform..."

# Start platform services (Kafka, TimescaleDB)
echo "Starting platform services..."
if [ "$KEEP_DATA" = true ]; then
    echo "Keeping existing volumes and data..."
    docker-compose -f deployment/docker-compose.confluent.yml -f deployment/docker-compose.timescaledb.yml up -d --remove-orphans
else
    echo "Starting with clean state..."
    docker-compose -f deployment/docker-compose.confluent.yml -f deployment/docker-compose.timescaledb.yml down -v --remove-orphans
    docker-compose -f deployment/docker-compose.confluent.yml -f deployment/docker-compose.timescaledb.yml up -d --remove-orphans
fi

# Wait for Kafka Connect to be ready
echo "Waiting for Kafka Connect to be ready..."
while ! curl -s http://localhost:8083/connectors > /dev/null; do
    sleep 5
    echo "Waiting for Kafka Connect..."
done

# Wait for JDBC connector to be available
echo "Waiting for JDBC connector to be available..."
while ! curl -s http://localhost:8083/connector-plugins | jq -e '.[] | select(.class == "io.confluent.connect.jdbc.JdbcSinkConnector")' > /dev/null; do
    sleep 5
    echo "Waiting for JDBC connector..."
done

# Optionally start the app
if [ "$START_APP" = true ]; then
    echo "Starting application services..."
    docker-compose -f deployment/docker-compose.app.yml up -d
fi

echo "Platform startup complete!"
if [ "$START_APP" = true ]; then
    echo "You can access the application at http://localhost:3000"
fi
echo "You can check the status of the connector with: curl -s http://localhost:8083/connectors/iot-messages-sink/status | jq"

echo -e "\nCurrent deployment status:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 