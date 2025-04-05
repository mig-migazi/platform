#!/bin/bash

# Default values
TEST_REDPANDA=true
TEST_CONFLUENT=true
CLEAN_DATA=true

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --redpanda-only)
            TEST_REDPANDA=true
            TEST_CONFLUENT=false
            shift
            ;;
        --confluent-only)
            TEST_REDPANDA=false
            TEST_CONFLUENT=true
            shift
            ;;
        --keep-data)
            CLEAN_DATA=false
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--redpanda-only|--confluent-only] [--keep-data]"
            echo "  --keep-data: Preserve data between runs (don't delete volumes)"
            exit 1
            ;;
    esac
done

# Clean up any existing containers and networks to prevent port conflicts
echo "Cleaning up existing containers and networks..."
if [ "$CLEAN_DATA" = true ]; then
    docker-compose -f docker-compose.redpanda.yml down -v --remove-orphans
    docker-compose -f docker-compose.confluent.yml down -v --remove-orphans
else
    docker-compose -f docker-compose.redpanda.yml down --remove-orphans
    docker-compose -f docker-compose.confluent.yml down --remove-orphans
fi
docker system prune -f

# Function to test a specific broker type
test_broker() {
    local broker_type=$1
    local compose_file=$2
    local service_name=$3
    local max_wait_seconds=15
    local start_time=$(date +%s)

    echo "Testing $broker_type setup..."
    echo "----------------------------------------"

    # Start the services
    if [ "$CLEAN_DATA" = true ]; then
        echo "Starting services with clean data (volumes will be deleted)..."
        docker-compose -f $compose_file down -v
    else
        echo "Starting services (preserving existing data)..."
        docker-compose -f $compose_file down
    fi
    docker-compose -f $compose_file up -d

    # Wait for the broker to be ready with timeout
    echo "Waiting for $broker_type to be ready (timeout: ${max_wait_seconds}s)..."
    while true; do
        current_time=$(date +%s)
        elapsed_time=$((current_time - start_time))
        
        if [ $elapsed_time -gt $max_wait_seconds ]; then
            echo "❌ Timeout: $broker_type failed to start within ${max_wait_seconds} seconds"
            exit 1
        fi

        if [ "$broker_type" = "Redpanda" ]; then
            if docker exec $service_name rpk cluster info > /dev/null 2>&1; then
                break
            fi
            echo "Cluster not ready yet... (${elapsed_time}s elapsed)"
        else
            if docker exec $service_name kafka-topics --bootstrap-server localhost:9092 --list > /dev/null 2>&1; then
                break
            fi
            echo "Waiting for $broker_type to be ready... (${elapsed_time}s elapsed)"
        fi
        sleep 2
    done
    echo "$broker_type is ready!"

    # Wait a moment for topic creation
    sleep 5

    # Verify topics
    echo "Verifying topics..."
    if [ "$broker_type" = "Redpanda" ]; then
        docker exec $service_name rpk topic list
    else
        docker exec $service_name kafka-topics --bootstrap-server localhost:9092 --list
    fi

    # Show topic details
    echo "Topic details:"
    if [ "$broker_type" = "Redpanda" ]; then
        docker exec $service_name rpk topic describe iot_messages
        docker exec $service_name rpk topic describe alarms
    else
        docker exec $service_name kafka-topics --bootstrap-server localhost:9092 --describe
    fi

    # Test telemetry
    echo "Testing IoT telemetry..."
    pip install -r requirements.txt
    python3 test_iot_telemetry.py \
        --bootstrap-servers localhost:9092 \
        --topic iot_messages \
        --num-messages 10 \
        --device-id test-device-001
    telemetry_test_result=$?

    echo "----------------------------------------"
    if [ $telemetry_test_result -eq 0 ]; then
        echo "$broker_type test completed successfully!"
    else
        echo "$broker_type test failed!"
        exit 1
    fi
    echo "----------------------------------------"
}

# Test Confluent Platform if enabled
if [ "$TEST_CONFLUENT" = true ]; then
    test_broker "Confluent Platform" "docker-compose.confluent.yml" "broker"
fi

# Test Redpanda if enabled
if [ "$TEST_REDPANDA" = true ]; then
    test_broker "Redpanda" "docker-compose.redpanda.yml" "redpanda"
fi

echo "All tests completed!" 