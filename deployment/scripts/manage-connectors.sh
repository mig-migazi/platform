#!/bin/bash

set -e

# Change to project root directory
cd "$(dirname "$0")/../.."

MAX_RETRIES=30
RETRY_INTERVAL=10

echo "Starting connector creator..."

# Function to check if a service is ready
wait_for_service() {
    local service_name=$1
    local url=$2
    local retries=0

    echo "Waiting for ${service_name} to be ready..."
    while [ $retries -lt $MAX_RETRIES ]; do
        if curl -s "${url}" > /dev/null; then
            echo "${service_name} is ready"
            return 0
        fi
        retries=$((retries + 1))
        echo "${service_name} not ready, retry ${retries}/${MAX_RETRIES}..."
        sleep $RETRY_INTERVAL
    done

    echo "Error: ${service_name} did not become ready in time"
    return 1
}

# Function to create or update a connector from a JSON file
create_or_update_connector() {
    local config_file=$1
    local name=$(jq -r '.name' "$config_file")
    local config=$(jq -r '.config' "$config_file")
    local retries=0
    
    while [ $retries -lt $MAX_RETRIES ]; do
        echo "Attempting to configure connector ${name} (attempt $((retries + 1))/${MAX_RETRIES})..."
        
        # Check if connector exists
        if curl -s "${CONNECT_URL}/connectors/${name}" > /dev/null; then
            echo "Updating existing connector ${name}..."
            if curl -X PUT "${CONNECT_URL}/connectors/${name}/config" \
                -H "Content-Type: application/json" \
                -d "${config}" > /dev/null; then
                echo "Successfully updated connector ${name}"
                break
            fi
        else
            echo "Creating new connector ${name}..."
            if curl -X POST "${CONNECT_URL}/connectors" \
                -H "Content-Type: application/json" \
                -d "@${config_file}" > /dev/null; then
                echo "Successfully created connector ${name}"
                break
            fi
        fi

        retries=$((retries + 1))
        if [ $retries -eq $MAX_RETRIES ]; then
            echo "Error: Failed to configure connector ${name} after ${MAX_RETRIES} attempts"
            return 1
        fi
        sleep $RETRY_INTERVAL
    done

    # Wait for connector to be running
    echo "Waiting for connector ${name} to start running..."
    retries=0
    while [ $retries -lt $MAX_RETRIES ]; do
        status=$(curl -s "${CONNECT_URL}/connectors/${name}/status" | jq -r '.connector.state')
        if [ "$status" = "RUNNING" ]; then
            echo "Connector ${name} is running"
            return 0
        elif [ "$status" = "FAILED" ]; then
            echo "Error: Connector ${name} failed to start"
            curl -s "${CONNECT_URL}/connectors/${name}/status" | jq .
            return 1
        fi
        retries=$((retries + 1))
        echo "Connector ${name} status: ${status}, waiting... (${retries}/${MAX_RETRIES})"
        sleep $RETRY_INTERVAL
    done

    echo "Error: Connector ${name} did not start running in time"
    return 1
}

# Wait for Kafka Connect to be ready
wait_for_service "Kafka Connect" "${CONNECT_URL}/connectors" || exit 1

# Configure connectors
echo "Configuring connectors..."

# Create IoT Messages connector
create_or_update_connector "kafka-connect/jdbc-sink-iot.json" || exit 1

# Create Alarms connector
create_or_update_connector "kafka-connect/jdbc-sink-alarms.json" || exit 1

echo "Connectors configured successfully"

# Keep monitoring connector status
while true; do
    echo "Checking connector status..."
    for name in $(curl -s "${CONNECT_URL}/connectors" | jq -r '.[]'); do
        status=$(curl -s "${CONNECT_URL}/connectors/${name}/status" | jq -r '.connector.state')
        echo "Connector ${name} status: ${status}"
        if [ "$status" != "RUNNING" ]; then
            echo "Warning: Connector ${name} is not running"
            curl -s "${CONNECT_URL}/connectors/${name}/status" | jq .
        fi
    done
    sleep 60
done 