#!/bin/bash

# Function to test a specific broker type
test_broker() {
    local broker_type=$1
    local compose_file=$2
    local service_name=$3

    echo "Testing $broker_type setup..."
    echo "----------------------------------------"

    # Clean up any existing containers
    echo "Cleaning up existing containers..."
    docker-compose -f $compose_file down -v --remove-orphans

    # Start the services
    echo "Starting services..."
    docker-compose -f $compose_file up -d

    # Wait for the broker to be ready
    echo "Waiting for $broker_type to be ready..."
    if [ "$broker_type" = "redpanda" ]; then
        until docker exec $service_name rpk cluster health > /dev/null 2>&1; do
            echo "Waiting for $broker_type to be ready..."
            sleep 2
        done
    else
        until docker exec $service_name kafka-topics --bootstrap-server localhost:9092 --list > /dev/null 2>&1; do
            echo "Waiting for $broker_type to be ready..."
            sleep 2
        done
    fi
    echo "$broker_type is ready!"

    # Wait a moment for topic creation
    echo "Waiting for topics to be created..."
    sleep 5

    # Verify topics
    echo "Verifying topics..."
    if [ "$broker_type" = "redpanda" ]; then
        docker exec $service_name rpk topic list
    else
        docker exec $service_name kafka-topics --bootstrap-server localhost:9092 --list
    fi

    # Show topic details
    echo "Topic details:"
    if [ "$broker_type" = "redpanda" ]; then
        docker exec $service_name rpk topic describe iot_messages alarms
    else
        docker exec $service_name kafka-topics --bootstrap-server localhost:9092 --describe
    fi

    # Clean up
    echo "Cleaning up..."
    docker-compose -f $compose_file down -v --remove-orphans

    echo "----------------------------------------"
    echo "$broker_type test completed!"
    echo "----------------------------------------"
}

# Test Confluent Platform
test_broker "Confluent Platform" "docker-compose.confluent.yml" "broker"

# Test Redpanda
test_broker "Redpanda" "docker-compose.redpanda.yml" "redpanda"

echo "All tests completed!" 