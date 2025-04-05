#!/usr/bin/env python3

import json
import time
from datetime import datetime, UTC
import random
from confluent_kafka import Producer, Consumer, KafkaError
import argparse
import uuid

class IoTTelemetry:
    def __init__(self, bootstrap_servers, topic):
        self.topic = topic
        self.producer = Producer({
            'bootstrap.servers': bootstrap_servers,
            'client.id': 'test-producer'
        })
        self.consumer = Consumer({
            'bootstrap.servers': bootstrap_servers,
            'group.id': f'test-group-{uuid.uuid4()}',
            'auto.offset.reset': 'earliest'
        })
        self.consumer.subscribe([topic])

    def generate_telemetry(self, device_id):
        """Generate a realistic IoT telemetry message"""
        return {
            "device_id": device_id,
            "timestamp": datetime.now(UTC).isoformat(),
            "temperature": round(random.uniform(20.0, 30.0), 2),
            "humidity": round(random.uniform(40.0, 60.0), 2),
            "pressure": round(random.uniform(980.0, 1020.0), 2),
            "battery_level": round(random.uniform(20.0, 100.0), 2),
            "signal_strength": random.randint(-90, -50),
            "location": {
                "latitude": round(random.uniform(-90.0, 90.0), 6),
                "longitude": round(random.uniform(-180.0, 180.0), 6)
            },
            "status": random.choice(["normal", "warning", "critical"]),
            "metadata": {
                "firmware_version": "1.2.3",
                "model": "IoT-Sensor-X",
                "manufacturer": "SmartDevices Inc"
            }
        }

    def delivery_report(self, err, msg):
        """Callback for message delivery reports"""
        if err is not None:
            print(f'Message delivery failed: {err}')
        else:
            print(f'Message delivered to {msg.topic()} [{msg.partition()}]')

    def produce_messages(self, num_messages, device_id):
        """Produce a specified number of telemetry messages"""
        messages = []
        for _ in range(num_messages):
            message = self.generate_telemetry(device_id)
            messages.append(message)
            self.producer.produce(
                self.topic,
                value=json.dumps(message).encode('utf-8'),
                callback=self.delivery_report
            )
            self.producer.poll(0)  # Trigger delivery reports
            time.sleep(0.1)  # Small delay between messages
        
        self.producer.flush()
        return messages

    def verify_messages(self, expected_messages, timeout=10):
        """Verify that the expected messages were received"""
        received_messages = []
        start_time = time.time()
        
        while True:
            msg = self.consumer.poll(1.0)
            if msg is None:
                if time.time() - start_time > timeout:
                    break
                continue
            if msg.error():
                if msg.error().code() == KafkaError._PARTITION_EOF:
                    continue
                print(f'Consumer error: {msg.error()}')
                return False
            
            try:
                value = json.loads(msg.value().decode('utf-8'))
                received_messages.append(value)
                if len(received_messages) >= len(expected_messages):
                    break
            except Exception as e:
                print(f'Error processing message: {e}')
                return False
            
            if time.time() - start_time > timeout:
                break
        
        # Compare messages (ignoring timestamp differences)
        if len(received_messages) != len(expected_messages):
            print(f'Expected {len(expected_messages)} messages, but received {len(received_messages)}')
            return False
            
        for expected, received in zip(expected_messages, received_messages):
            expected_copy = expected.copy()
            received_copy = received.copy()
            expected_copy.pop('timestamp')
            received_copy.pop('timestamp')
            if expected_copy != received_copy:
                print('Message content mismatch')
                return False
        
        return True

def main():
    parser = argparse.ArgumentParser(description='Test IoT telemetry message production and consumption')
    parser.add_argument('--bootstrap-servers', required=True, help='Kafka bootstrap servers')
    parser.add_argument('--topic', default='iot_messages', help='Topic name')
    parser.add_argument('--num-messages', type=int, default=10, help='Number of messages to produce')
    parser.add_argument('--device-id', default='test-device-001', help='Device ID for the test messages')
    
    args = parser.parse_args()
    
    iot = IoTTelemetry(args.bootstrap_servers, args.topic)
    
    print(f"Producing {args.num_messages} messages...")
    messages = iot.produce_messages(args.num_messages, args.device_id)
    
    print("Verifying messages...")
    if iot.verify_messages(messages):
        print("✅ Test passed: All messages were successfully produced and consumed")
    else:
        print("❌ Test failed: Message verification failed")
        exit(1)

if __name__ == "__main__":
    main() 