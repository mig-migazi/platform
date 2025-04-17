#!/bin/bash

# This script registers Avro schemas with the Schema Registry.
#
# Important Note About Versions:
# - Schema versions are automatically assigned by the Schema Registry
# - Version numbers auto-increment and cannot be manually specified
# - The first schema registered for a subject becomes version 1
# - Subsequent schemas for the same subject get incremented version numbers
#
# To find the right schema version:
# 1. By schema ID (most reliable):
#    curl -s http://schema-registry:8081/schemas/ids/1
#
# 2. Get latest version for a subject:
#    curl -s http://schema-registry:8081/subjects/iot_messages-value/versions/latest
#
# 3. Search by schema metadata:
#    curl -s http://schema-registry:8081/subjects/iot_messages-value/versions | jq '.[]' | while read -r version; do
#      curl -s http://schema-registry:8081/subjects/iot_messages-value/versions/$version | jq -r 'select(.schema | fromjson | .version == "1")'
#    done
#
# 4. Get schema by version:
#    curl -s http://schema-registry:8081/subjects/iot_messages-value/versions/1

# Wait for Schema Registry to be ready
echo "Waiting for Schema Registry to be ready..."
while ! curl -s http://schema-registry:8081/subjects > /dev/null; do
    echo "Schema Registry not ready yet, waiting..."
    sleep 5
done

echo "Schema Registry is ready..."

# Function to get subject name from filename
get_subject() {
    local filename=$1
    # Convert hyphens to underscores and remove version suffix
    echo $filename | sed -E 's/(.*)-v[0-9]+\.avsc/\1/' | tr '-' '_'
}

# Process each schema file
for schema_file in *-v*.avsc; do
    if [ -f "$schema_file" ]; then
        subject=$(get_subject "$schema_file")
        
        echo "Processing $schema_file..."
        echo "Subject: $subject"
        
        # Register the value schema
        echo "Registering $subject-value schema..."
        SCHEMA=$(cat "$schema_file")
        response=$(curl -s -X POST -H "Content-Type: application/vnd.schemaregistry.v1+json" \
          --data "{\"schema\": $(echo $SCHEMA | jq -R -s .)}" \
          http://schema-registry:8081/subjects/$subject-value/versions)
        
        if echo "$response" | grep -q "error_code"; then
            echo "ERROR: Failed to register $subject-value schema"
            echo "Response: $response"
            exit 1
        fi
        
        # Extract and store the schema ID
        schema_id=$(echo "$response" | jq -r '.id')
        echo "Registered $subject-value schema with ID: $schema_id"
        
        # Register the key schema
        echo "Registering $subject-key schema..."
        response=$(curl -s -X POST -H "Content-Type: application/vnd.schemaregistry.v1+json" \
          --data '{"schema": "\"string\""}' \
          http://schema-registry:8081/subjects/$subject-key/versions)
        
        if echo "$response" | grep -q "error_code"; then
            echo "ERROR: Failed to register $subject-key schema"
            echo "Response: $response"
            exit 1
        fi
        
        key_schema_id=$(echo "$response" | jq -r '.id')
        echo "Registered $subject-key schema with ID: $key_schema_id"
        
        # Show how to retrieve this schema
        echo
        echo "To retrieve this schema later:"
        echo "1. By schema ID (recommended):"
        echo "   curl -s http://schema-registry:8081/schemas/ids/$schema_id"
        echo
        echo "2. By latest version:"
        echo "   curl -s http://schema-registry:8081/subjects/$subject-value/versions/latest"
        echo
        echo "3. By metadata (search for version \"1\"):"
        echo "   curl -s http://schema-registry:8081/subjects/$subject-value/versions | jq '.[]' | while read -r version; do"
        echo "     curl -s http://schema-registry:8081/subjects/$subject-value/versions/\$version | jq -r 'select(.schema | fromjson | .version == \"1\")'"
        echo "   done"
        echo
    fi
done

# Set compatibility level to BACKWARD
echo "Setting compatibility level..."
for subject in iot_messages iot_alarms; do
    curl -X PUT -H "Content-Type: application/vnd.schemaregistry.v1+json" \
      --data '{"compatibility": "BACKWARD"}' \
      http://schema-registry:8081/config/$subject-value
done

echo "Schema registration completed!" 