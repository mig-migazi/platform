FROM ubuntu:22.04

# Install required packages
RUN apt-get update && apt-get install -y curl jq python3 python3-pip && rm -rf /var/lib/apt/lists/* \
    && pip3 install confluent-kafka httpx attrs cachetools authlib

WORKDIR /schemas

# Copy schema files and registration script
COPY *.avsc ./
COPY register_schemas_on_startup.sh ./
RUN chmod +x register_schemas_on_startup.sh

# Set the entrypoint
ENTRYPOINT ["/schemas/register_schemas_on_startup.sh"] 