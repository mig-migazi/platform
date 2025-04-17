#!/bin/bash

set -e

echo "🔄 Testing data flow through the platform..."

# Function to wait for records to appear in TimescaleDB
wait_for_records() {
    local table=$1
    local expected_count=$2
    local max_retries=30
    local retry_interval=2
    local retries=0

    echo "Waiting for records in ${table}..."
    while [ $retries -lt $max_retries ]; do
        count=$(docker exec timescaledb psql -U postgres -d iot_platform -tAc "SELECT COUNT(*) FROM ${table};")
        if [ "$count" -ge "$expected_count" ]; then
            echo "✅ Found ${count} records in ${table}"
            return 0
        fi
        retries=$((retries + 1))
        echo "Records in ${table}: ${count}, waiting... (${retries}/${max_retries})"
        sleep $retry_interval
    done
    echo "❌ Timed out waiting for records in ${table}"
    return 1
}

# Get schema IDs by checking metadata for v1
echo "Getting schema IDs for v1..."
IOT_SCHEMA_ID=$(curl -s http://localhost:8081/subjects/iot_messages-value/versions | jq -r '.[]' | while read version; do
    schema_version=$(curl -s http://localhost:8081/subjects/iot_messages-value/versions/$version | jq -r '.schema | fromjson | .version')
    if [ "$schema_version" = "v1" ]; then
        curl -s http://localhost:8081/subjects/iot_messages-value/versions/$version | jq -r '.id'
        break
    fi
done)

ALARM_SCHEMA_ID=$(curl -s http://localhost:8081/subjects/iot_alarms-value/versions | jq -r '.[]' | while read version; do
    schema_version=$(curl -s http://localhost:8081/subjects/iot_alarms-value/versions/$version | jq -r '.schema | fromjson | .version')
    if [ "$schema_version" = "v1" ]; then
        curl -s http://localhost:8081/subjects/iot_alarms-value/versions/$version | jq -r '.id'
        break
    fi
done)

if [ -z "$IOT_SCHEMA_ID" ] || [ -z "$ALARM_SCHEMA_ID" ]; then
    echo "❌ Could not find v1 schemas"
    exit 1
fi

echo "Using schema IDs:"
echo "IoT Messages: $IOT_SCHEMA_ID"
echo "Alarms: $ALARM_SCHEMA_ID"

# Test IoT Messages - Direct Kafka Path
echo -e "\n📡 Testing IoT Messages - Direct Kafka Path..."
echo "Sending test message via Kafka..."
curl -X POST -H "Content-Type: application/vnd.kafka.avro.v2+json" \
     -H "Accept: application/vnd.kafka.v2+json" \
     --data '{
         "value_schema_id": '$IOT_SCHEMA_ID',
         "records": [
             {
                 "value": {
                     "timestamp": '$(date +%s%3N)',
                     "id": "test-device-001",
                     "temperature": {"double": 23.5},
                     "humidity": {"double": 48.2},
                     "pressure": {"double": 1013.25},
                     "battery": {"double": 85.0},
                     "metadata": {"location": "test"}
                 }
             }
         ]
     }' \
     http://localhost:8082/topics/iot_messages

# Test IoT Messages - REST API Path
echo -e "\n📡 Testing IoT Messages - REST API Path..."
echo "Sending test message via REST API..."
curl -X POST -H "Content-Type: application/vnd.kafka.avro.v2+json" \
     -H "Accept: application/vnd.kafka.v2+json" \
     --data '{
         "value_schema_id": '$IOT_SCHEMA_ID',
         "records": [
             {
                 "value": {
                     "timestamp": '$(date +%s%3N)',
                     "id": "test-device-002",
                     "temperature": {"double": 24.5},
                     "humidity": {"double": 49.2},
                     "pressure": {"double": 1014.25},
                     "battery": {"double": 86.0},
                     "metadata": {"location": "test"}
                 }
             }
         ]
     }' \
     http://localhost:8082/topics/iot_messages

# Test Alarms - Direct Kafka Path
echo -e "\n🚨 Testing Alarms - Direct Kafka Path..."
echo "Sending test alarm via Kafka..."
curl -X POST -H "Content-Type: application/vnd.kafka.avro.v2+json" \
     -H "Accept: application/vnd.kafka.v2+json" \
     --data '{
         "value_schema_id": '$ALARM_SCHEMA_ID',
         "records": [
             {
                 "value": {
                     "timestamp": '$(date +%s%3N)',
                     "id": "test-device-001",
                     "severity": 2,
                     "errorCode": 1001
                 }
             }
         ]
     }' \
     http://localhost:8082/topics/iot_alarms

# Test Alarms - REST API Path
echo -e "\n🚨 Testing Alarms - REST API Path..."
echo "Sending test alarm via REST API..."
curl -X POST -H "Content-Type: application/vnd.kafka.avro.v2+json" \
     -H "Accept: application/vnd.kafka.v2+json" \
     --data '{
         "value_schema_id": '$ALARM_SCHEMA_ID',
         "records": [
             {
                 "value": {
                     "timestamp": '$(date +%s%3N)',
                     "id": "test-device-002",
                     "severity": 1,
                     "errorCode": 1002
                 }
             }
         ]
     }' \
     http://localhost:8082/topics/iot_alarms

# Wait for messages to be processed
echo -e "\n⏳ Waiting for messages to be processed..."

# Check IoT Messages table
if wait_for_records "iot_messages" 2; then
    echo -e "\n📊 Latest records in iot_messages:"
    docker exec timescaledb psql -U postgres -d iot_platform -c "
        SELECT timestamp, device_id, temperature, humidity, pressure, battery 
        FROM iot_messages 
        ORDER BY timestamp DESC 
        LIMIT 2;"
else
    echo "❌ IoT Messages did not make it to the database"
    exit 1
fi

# Check Alarms table
if wait_for_records "alarms" 2; then
    echo -e "\n📊 Latest records in alarms:"
    docker exec timescaledb psql -U postgres -d iot_platform -c "
        SELECT timestamp, device_id, severity, error_code 
        FROM alarms 
        ORDER BY timestamp DESC 
        LIMIT 2;"
else
    echo "❌ Alarms did not make it to the database"
    exit 1
fi

echo -e "\n✨ Data flow test completed successfully!" 