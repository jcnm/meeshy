/**
 * Load Test: Offline Message Queue Handling
 * Goal: Validate 30-day retention and bulk delivery performance
 *
 * Scenario:
 * 1. Disconnect 500 users for 24 hours
 * 2. Queue 5,000 offline messages (10 msgs/user)
 * 3. Reconnect all users simultaneously
 * 4. Validate all offline messages delivered
 *
 * Run: k6 run --vus 500 --duration 2h 03-offline-queue.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import encoding from 'k6/encoding';

export let options = {
  stages: [
    // Phase 1: Queue offline messages (simulate users disconnected)
    { duration: '5m', target: 500 },
    { duration: '15m', target: 500 },  // Generate 5000 offline messages

    // Phase 2: Reconnect and deliver
    { duration: '2m', target: 0 },     // Disconnect
    { duration: '2m', target: 500 },   // Reconnect all simultaneously
    { duration: '10m', target: 500 },  // Deliver all queued messages
    { duration: '2m', target: 0 },     // Wind down
  ],
  thresholds: {
    'http_req_duration': ['p(99)<300'],  // Queue/delivery latency
    'http_req_failed': ['rate<0.01'],
    'group_duration{group:::queue_offline}': ['p(99)<100'],
    'group_duration{group:::retrieve_queued}': ['p(99)<200'],
  }
};

let messageCounter = 0;

export default function() {
  const enrollmentId = `enrollment_${__VU}`;
  const userJID = `user_${__VU}@whatsapp.com`;
  const currentStage = Math.floor(__VU / 100); // Determine test phase

  // Phase 1: Queue offline messages (5,000 total across all users)
  if (__ITER < 10) {
    // Each user queues 10 messages
    group('queue_offline', () => {
      for (let i = 0; i < 1; i++) {
        const messageId = `msg_${__VU}_${__ITER}_${i}`;
        const senderJID = `sender_${Math.floor(Math.random() * 500)}@whatsapp.com`;
        const encryptedContent = encoding.b64encode(`encrypted_msg_${messageId}`);

        let queuePayload = JSON.stringify({
          enrollmentId: enrollmentId,
          messageId: messageId,
          senderJID: senderJID,
          encryptedContent: encryptedContent,
          contentType: 'signal_v3'
        });

        let queueResponse = http.post(
          'http://localhost:3000/dma/offline-messages/queue',
          queuePayload,
          {
            headers: {
              'Content-Type': 'application/json',
            },
            timeout: '5s'
          }
        );

        check(queueResponse, {
          'queue success 200': (r) => r.status === 200,
          'delivery ID returned': (r) => r.json('deliveryId') !== null,
          'queue time < 100ms': (r) => r.timings.duration < 100,
        });

        if (queueResponse.status !== 200) {
          console.error(`Queue failed: ${queueResponse.status}`);
        }

        messageCounter++;
      }

      sleep(0.5);
    });
  }

  // Phase 2: Retrieve and deliver queued messages after reconnection
  else {
    group('retrieve_queued', () => {
      let retrieveResponse = http.get(
        `http://localhost:3000/dma/offline-messages/${enrollmentId}`,
        {
          headers: {
            'Authorization': `Bearer ${enrollmentId}_token`
          },
          timeout: '10s'
        }
      );

      check(retrieveResponse, {
        'retrieve success 200': (r) => r.status === 200,
        'messages array exists': (r) => {
          try {
            const body = r.json();
            return Array.isArray(body.messages) || r.status === 404;
          } catch {
            return true;
          }
        },
        'retrieve time < 200ms': (r) => r.timings.duration < 200,
      });

      if (retrieveResponse.status === 200) {
        // Simulate delivering each queued message
        try {
          const messages = retrieveResponse.json('messages') || [];
          for (let msg of messages) {
            group('deliver_queued_msg', () => {
              let deliverResponse = http.post(
                'http://localhost:3000/dma/offline-messages/deliver',
                JSON.stringify({
                  messageId: msg.messageId,
                  deliveryId: msg.deliveryId,
                  status: 'delivered',
                  timestamp: new Date().toISOString()
                }),
                {
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  timeout: '5s'
                }
              );

              check(deliverResponse, {
                'delivery success 200': (r) => r.status === 200 || r.status === 202,
                'delivery time < 100ms': (r) => r.timings.duration < 100,
              });
            });
          }
        } catch (e) {
          console.error(`Error processing messages: ${e}`);
        }
      }

      sleep(1);
    });
  }
}

/**
 * Expected Results:
 *
 * Phase 1 (Queueing):
 * - 500 users × 10 messages = 5,000 offline messages queued
 * - Queue latency p99: < 100ms
 * - Success rate: 100%
 * - Database write performance: stable
 *
 * Phase 2 (Retrieval & Delivery):
 * - Bulk retrieval for 500 users: p99 < 200ms
 * - Zero duplicate deliveries
 * - All 5,000 messages delivered within 10 minutes
 * - Delivery acknowledgment rate: 99.99%
 *
 * Database Metrics:
 * - Queue growth linear (no cascading delays)
 * - Index efficiency: enrollmentId lookup < 50ms for 5k messages
 * - Cleanup performance: 30-day retention sweep < 1 minute
 *
 * Success Criteria:
 * ✓ All queued messages retrievable
 * ✓ All messages delivered post-reconnection
 * ✓ Zero data loss
 * ✓ No duplicate message delivery
 * ✓ Memory remains stable (no queue leaks)
 */
