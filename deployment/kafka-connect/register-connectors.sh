#!/bin/bash

# Register IoT messages connector
curl -X POST -H "Content-Type: application/json" \
  --data @jdbc-sink-iot.json \
  http://localhost:8083/connectors

# Register alarms connector
curl -X POST -H "Content-Type: application/json" \
  --data @jdbc-sink-alarms.json \
  http://localhost:8083/connectors 