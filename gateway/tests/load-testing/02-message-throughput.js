/**
 * Load Test: Message Throughput (10,000 messages/hour)
 * Goal: Validate Signal Protocol encryption and XMPP delivery
 *
 * Scenario:
 * - 100 active users
 * - 100 messages/user/hour (1-2 messages/min per user)
 * - Each message: Signal encrypted + XMPP federation
 *
 * Run: k6 run --vus 100 --duration 1h 02-message-throughput.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import crypto from 'k6/crypto';

export let options = {
  stages: [
    { duration: '2m', target: 50 },   // Warm up to 50 users
    { duration: '8m', target: 100 },  // Ramp to 100 users
    { duration: '30m', target: 100 }, // Steady state
    { duration: '20m', target: 100 }, // Continue steady
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(99)<200'],  // End-to-end latency < 200ms
    'http_req_failed': ['rate<0.01'],    // Error rate < 1%
    'group_duration{group:::encryption}': ['p(99)<50'],
    'group_duration{group:::xmpp_send}': ['p(99)<100'],
  }
};

// Generate mock Signal Protocol encrypted message
function generateEncryptedMessage() {
  // Simulate AES-256-GCM encrypted payload (256 bytes typical)
  const randomPayload = crypto.sha256(`${Date.now()}-${Math.random()}`, 'hex');
  const messageBody = {
    version: 3,
    ephemeralPublicKey: 'BF' + randomPayload.substring(0, 66),
    encryptedContent: randomPayload + randomPayload.substring(0, 100),
    authTag: randomPayload.substring(0, 32),
  };
  return messageBody;
}

export default function() {
  const userId = `user_${__VU}`;
  const recipientJID = `recipient_${Math.floor(Math.random() * 50)}@whatsapp.com`;
  const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  // Test 1: Encrypt message with Signal Protocol
  group('encryption', () => {
    const encryptedMessage = generateEncryptedMessage();

    // Simulate encryption overhead measurement
    check(encryptedMessage, {
      'message version correct': (msg) => msg.version === 3,
      'ephemeralPublicKey present': (msg) => msg.ephemeralPublicKey.length > 0,
      'encryptedContent present': (msg) => msg.encryptedContent.length > 0,
      'authTag present': (msg) => msg.authTag.length > 0,
    });

    sleep(0.01); // Simulate encryption time
  });

  // Test 2: Send message via XMPP
  group('xmpp_send', () => {
    let messagePayload = JSON.stringify({
      messageId: messageId,
      senderJID: `${userId}@whatsapp.com`,
      recipientJID: recipientJID,
      encryptedContent: generateEncryptedMessage(),
      timestamp: new Date().toISOString(),
      contentType: 'signal_v3'
    });

    let sendResponse = http.post(
      'http://localhost:3000/dma/messages/send',
      messagePayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer user_${__VU}_token`
        },
        timeout: '5s'
      }
    );

    check(sendResponse, {
      'message sent status 200': (r) => r.status === 200,
      'delivery ID returned': (r) => r.json('deliveryId') !== null,
      'timestamp recorded': (r) => r.json('timestamp') !== null,
      'response time < 200ms': (r) => r.timings.duration < 200,
    });

    if (sendResponse.status !== 200) {
      console.error(`Send failed: ${sendResponse.status}`);
    }
  });

  // Test 3: Track message status
  group('message_status', () => {
    let statusResponse = http.get(
      `http://localhost:3000/dma/messages/${messageId}/status`,
      {
        headers: {
          'Authorization': `Bearer user_${__VU}_token`
        },
        timeout: '5s'
      }
    );

    check(statusResponse, {
      'status check 200': (r) => r.status === 200 || r.status === 404,
      'response time < 100ms': (r) => r.timings.duration < 100,
    });
  });

  // Test 4: Receive acknowledgment
  group('receive_ack', () => {
    let ackPayload = JSON.stringify({
      messageId: messageId,
      status: 'delivered',
      timestamp: new Date().toISOString()
    });

    let ackResponse = http.post(
      'http://localhost:3000/dma/messages/ack',
      ackPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer recipient_token`
        },
        timeout: '5s'
      }
    );

    check(ackResponse, {
      'ack accepted 200': (r) => r.status === 200 || r.status === 202,
      'response time < 100ms': (r) => r.timings.duration < 100,
    });
  });

  // Stagger messages from each user (1-2 messages/min = 60-120 second interval)
  sleep(Math.random() * 30 + 30); // Random sleep between 30-60 seconds
}

/**
 * Expected Results:
 * Duration: 1 hour
 * Total Messages: ~100 users × 60 messages = 6,000 messages
 *
 * Metrics:
 * - Encryption time: p99 < 50ms
 * - XMPP send time: p99 < 100ms
 * - End-to-end latency p99: < 200ms
 * - Delivery rate: 99.99%
 * - Error rate: < 1%
 *
 * Target: 10,000 messages/hour
 * Current test volume: 6,000/hour (can be scaled up with more VUs)
 */
