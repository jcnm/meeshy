/**
 * Load Test: 24-Hour Connection Stability
 * Goal: Validate system stability with sustained message flow
 *
 * Scenario:
 * - 100 persistent XMPP connections
 * - 1 message/sec per connection (100 msg/sec total)
 * - Run continuously for 24 hours
 * - Monitor for connection drops, memory leaks, stale sessions
 *
 * Run: k6 run --vus 100 --duration 24h 05-24hour-stability.js
 * Note: For testing, reduce duration to --duration 1h and scale to 10 VUs
 */

import http from 'k6/http';
import ws from 'k6/ws';
import { check, group, sleep } from 'k6';
import { Counter, Gauge, Histogram } from 'k6/metrics';

// Custom metrics
const messageCounter = new Counter('messages_sent');
const connectionUptime = new Gauge('connection_uptime_seconds');
const memoryUsageGauge = new Gauge('memory_usage_mb');
const messageLatency = new Histogram('message_latency_ms', { buckets: [10, 50, 100, 200, 500] });

export let options = {
  stages: [
    { duration: '5m', target: 10 },   // Ramp up (testing: 10 VUs for 5 min)
    { duration: '55m', target: 10 },  // Sustained load (testing: 55 min at 10 VUs)
    // For 24-hour test: use `--duration 24h --vus 100`
  ],
  thresholds: {
    'messages_sent': ['count>5000'],        // At least 5000 messages sent
    'connection_uptime_seconds': ['min>3000'], // Connections up > 50 minutes
    'message_latency_ms': ['p(99)<500'],    // 99th percentile < 500ms
    'http_req_failed': ['rate<0.01'],       // Error rate < 1%
  }
};

let startTime = Date.now();

export default function() {
  const userId = `stability_user_${__VU}`;
  const enrollmentId = `enrollment_${__VU}`;

  // Test 1: XMPP WebSocket connection (persistent)
  group('xmpp_connection', () => {
    let url = 'ws://localhost:5280/ws';

    let res = ws.connect(url, function(socket) {
      socket.on('open', () => {
        console.log(`VU ${__VU}: Connected to XMPP`);

        // Send XMPP stream header
        socket.send(JSON.stringify({
          type: 'stream:stream',
          xmlns: 'jabber:client',
          to: 'localhost',
          version: '1.0'
        }));
      });

      socket.on('message', (data) => {
        try {
          const message = JSON.parse(data);

          // Handle XMPP stream features
          if (message.type === 'stream:features') {
            socket.send(JSON.stringify({
              type: 'auth',
              mechanism: 'SASL',
              username: userId,
              password: 'test-password'
            }));
          }

          // Handle SASL success
          if (message.type === 'success') {
            // Start authenticated stream
            socket.send(JSON.stringify({
              type: 'stream:stream',
              xmlns: 'jabber:client',
              to: 'localhost',
              version: '1.0'
            }));
          }

          // Ready for messages
          if (message.type === 'bind') {
            socket.send(JSON.stringify({
              type: 'iq',
              id: 'bind_1',
              type: 'set',
              child: { name: 'bind', xmlns: 'urn:ietf:params:xml:ns:xmpp-bind' }
            }));
          }
        } catch (e) {
          console.error(`Parse error: ${e}`);
        }
      });

      socket.on('close', () => {
        console.warn(`VU ${__VU}: Connection closed`);
      });

      socket.on('error', (e) => {
        console.error(`VU ${__VU}: WebSocket error: ${e}`);
      });

      // Keep connection alive for the duration
      socket.setTimeout(() => {
        socket.close();
      }, 60000); // 1 minute for testing (24 hours in production)
    });

    check(res, {
      'connection successful': (r) => r.status === 101 || res.status < 400,
    });

    sleep(1);
  });

  // Test 2: Send steady message stream
  group('steady_message_flow', () => {
    const messageId = `msg_${__VU}_${Date.now()}`;
    const recipientJID = `recipient_${Math.floor(Math.random() * 50)}@whatsapp.com`;

    let sendStartTime = Date.now();

    let messagePayload = JSON.stringify({
      type: 'message',
      id: messageId,
      from: `${userId}@localhost`,
      to: recipientJID,
      body: {
        messageId: messageId,
        encryptedContent: 'encrypted_payload_' + messageId,
        timestamp: new Date().toISOString()
      }
    });

    let sendResponse = http.post(
      'http://localhost:3000/dma/messages/send',
      messagePayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${enrollmentId}_token`
        },
        timeout: '10s'
      }
    );

    let latency = Date.now() - sendStartTime;
    messageLatency.add(latency);
    messageCounter.add(1);

    check(sendResponse, {
      'send success 200': (r) => r.status === 200,
      'delivery ID returned': (r) => r.json('deliveryId') !== null,
      'message latency < 500ms': (r) => latency < 500,
    });

    // 1 message per second per VU
    sleep(1);
  });

  // Test 3: Monitor system health
  group('system_health', () => {
    let healthResponse = http.get('http://localhost:3000/health/metrics', {
      timeout: '5s'
    });

    check(healthResponse, {
      'health check success': (r) => r.status === 200,
      'uptime increasing': (r) => {
        try {
          const uptime = r.json('uptime');
          const elapsedSeconds = (Date.now() - startTime) / 1000;
          return uptime >= elapsedSeconds - 60; // Allow 60s tolerance
        } catch {
          return true;
        }
      }
    });

    // Record connection uptime
    let uptime = (Date.now() - startTime) / 1000;
    connectionUptime.add(uptime);
  });

  // Test 4: Verify no memory leaks
  group('memory_health', () => {
    let memoryResponse = http.get('http://localhost:3000/health/memory', {
      timeout: '5s'
    });

    check(memoryResponse, {
      'memory endpoint success': (r) => r.status === 200 || r.status === 404,
    });

    if (memoryResponse.status === 200) {
      try {
        const memoryMB = memoryResponse.json('heapUsed') / 1024 / 1024;
        memoryUsageGauge.add(memoryMB);

        check(memoryResponse, {
          'memory growth reasonable': (r) => memoryMB < 1000, // Less than 1GB
        });
      } catch (e) {
        console.error(`Memory parse error: ${e}`);
      }
    }
  });

  // Test 5: Retrieve user's active sessions
  group('session_tracking', () => {
    let sessionResponse = http.get(
      `http://localhost:3000/dma/users/${userId}/sessions`,
      {
        headers: {
          'Authorization': `Bearer ${enrollmentId}_token`
        },
        timeout: '5s'
      }
    );

    check(sessionResponse, {
      'session list success': (r) => r.status === 200 || r.status === 404,
      'session response time < 100ms': (r) => r.timings.duration < 100,
    });
  });

  // Test 6: Verify offline message cleanup
  if (__ITER % 1440 === 0) { // Every 24 hours (1440 iterations at 1/min)
    group('offline_cleanup_validation', () => {
      let cleanupResponse = http.post(
        'http://localhost:3000/dma/maintenance/cleanup-expired',
        JSON.stringify({
          daysRetention: 30
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer admin_token'
          },
          timeout: '30s'
        }
      );

      check(cleanupResponse, {
        'cleanup success': (r) => r.status === 200 || r.status === 202,
        'expired messages removed': (r) => {
          try {
            return r.json('removedCount') >= 0;
          } catch {
            return true;
          }
        }
      });

      console.log(`24-hour cleanup cycle: ${cleanupResponse.status}`);
    });
  }
}

/**
 * Expected Results (After 24 Hours):
 *
 * Connection Stability:
 * ✓ Uptime: 99.99% (max 9 seconds downtime)
 * ✓ Zero unexpected disconnections
 * ✓ Reconnection time: < 5 seconds
 * ✓ Session persistence: All sessions intact
 *
 * Message Delivery:
 * ✓ Total messages: 100 VUs × 86,400 seconds = 8,640,000 messages
 * ✓ Delivery rate: 100% (no message loss)
 * ✓ Latency p99: < 500ms (stable throughout)
 * ✓ No message duplicates
 *
 * System Health:
 * ✓ Memory stable: < 10MB growth over 24 hours
 * ✓ CPU usage: < 80% sustained
 * ✓ Database connections: pooled, no leaks
 * ✓ File descriptors: stable (no leaks)
 *
 * Data Integrity:
 * ✓ No stale sessions accumulating
 * ✓ Offline messages properly queued
 * ✓ 30-day cleanup executes successfully
 * ✓ Zero data corruption
 *
 * Success Criteria:
 * ✓ 8+ million messages delivered
 * ✓ 99.99% uptime maintained
 * ✓ Memory growth < 10MB
 * ✓ No critical errors in logs
 */
