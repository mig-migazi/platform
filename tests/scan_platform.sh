#!/bin/bash

set -e

echo "🔍 Scanning IoT Platform components..."

# Function to check if a command exists
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo "❌ Required command not found: $1"
        exit 1
    fi
}

# Check required commands
echo "Checking required commands..."
check_command docker
check_command curl
check_command jq

# Check Docker containers
echo -e "\n📦 Checking Docker containers..."
expected_containers=("kafka" "connect" "schema-registry" "rest-proxy" "connector-creator" "timescaledb")
for container in "${expected_containers[@]}"; do
    if docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
        status=$(docker ps --format '{{.Status}}' --filter "name=^${container}$")
        echo "✅ Container ${container} is running (${status})"
    else
        echo "❌ Container ${container} is not running"
        exit 1
    fi
done

# Check Docker volumes
echo -e "\n💾 Checking Docker volumes..."
expected_volumes=("connect_plugins" "deployment_kafka_data" "docker_timescaledb_data")
for volume in "${expected_volumes[@]}"; do
    if docker volume ls --format '{{.Name}}' | grep -q "^${volume}$"; then
        echo "✅ Volume ${volume} exists"
    else
        echo "❌ Volume ${volume} not found"
        exit 1
    fi
done

# Check Kafka topics
echo -e "\n📫 Checking Kafka topics..."
expected_topics=("iot_messages" "alarms" "connect-configs" "connect-offsets" "connect-status")
topics=$(docker exec kafka kafka-topics --bootstrap-server localhost:9092 --list)
for topic in "${expected_topics[@]}"; do
    if echo "$topics" | grep -q "^${topic}$"; then
        partitions=$(docker exec kafka kafka-topics --bootstrap-server localhost:9092 --describe --topic $topic | grep "PartitionCount")
        echo "✅ Topic ${topic} exists (${partitions})"
    else
        echo "❌ Topic ${topic} not found"
        exit 1
    fi
done

# Check Schema Registry subjects
echo -e "\n📋 Checking Schema Registry subjects..."
expected_subjects=("iot_messages-value" "iot_messages-key" "iot_alarms-value" "iot_alarms-key")
if subjects=$(curl -s http://localhost:8081/subjects); then
    for subject in "${expected_subjects[@]}"; do
        if echo "$subjects" | jq -e ".[] | select(. == \"$subject\")" > /dev/null; then
            version=$(curl -s http://localhost:8081/subjects/$subject/versions/latest | jq .version)
            echo "✅ Subject ${subject} exists (version ${version})"
        else
            echo "❌ Subject ${subject} not found"
            exit 1
        fi
    done
else
    echo "❌ Could not connect to Schema Registry"
    exit 1
fi

# Check Kafka Connect
echo -e "\n🔌 Checking Kafka Connect..."
if curl -s http://localhost:8083 > /dev/null; then
    echo "✅ Kafka Connect REST API is accessible"
    
    # Check connector plugins
    echo -e "\nInstalled connector plugins:"
    curl -s http://localhost:8083/connector-plugins | jq -r '.[] | "✓ \(.class) (\(.type))"'
    
    # Check configured connectors
    echo -e "\nConfigured connectors:"
    expected_connectors=("jdbc-sink-iot" "jdbc-sink-alarms")
    connectors=$(curl -s http://localhost:8083/connectors)
    for connector in "${expected_connectors[@]}"; do
        if echo "$connectors" | jq -e ".[] | select(. == \"$connector\")" > /dev/null; then
            status=$(curl -s http://localhost:8083/connectors/$connector/status)
            state=$(echo $status | jq -r .connector.state)
            echo "✅ Connector ${connector} exists (state: ${state})"
            
            if [ "$state" != "RUNNING" ]; then
                echo "❌ Connector ${connector} is not running"
                echo "Connector status:"
                echo "$status" | jq .
                exit 1
            fi
        else
            echo "❌ Connector ${connector} not found"
            exit 1
        fi
    done
else
    echo "❌ Could not connect to Kafka Connect"
    exit 1
fi

# Check TimescaleDB
echo -e "\n📊 Checking TimescaleDB..."
if docker exec timescaledb psql -U postgres -d iot_platform -c "\dt" > /dev/null; then
    echo "✅ TimescaleDB is accessible"
    
    # Check required tables
    expected_tables=("iot_messages" "alarms")
    for table in "${expected_tables[@]}"; do
        if docker exec timescaledb psql -U postgres -d iot_platform -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '$table');" | grep -q "t"; then
            echo "✅ Table ${table} exists"
        else
            echo "❌ Table ${table} not found"
            exit 1
        fi
    done
else
    echo "❌ Could not connect to TimescaleDB"
    exit 1
fi

echo -e "\n✨ Platform scan completed successfully!" 