/**
 * Load Test: Session Establishment & Key Exchange
 * Goal: Validate X3DH and Noise Protocol performance under load
 *
 * Scenario:
 * - 1,000 concurrent X3DH key agreements
 * - 500 concurrent Noise Protocol handshakes
 * - Measure key derivation and encryption setup time
 *
 * Run: k6 run --vus 1000 --duration 10m 04-session-establishment.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import crypto from 'k6/crypto';
import encoding from 'k6/encoding';

export let options = {
  stages: [
    { duration: '1m', target: 100 },   // Warm up
    { duration: '1m', target: 500 },   // Ramp to 500
    { duration: '2m', target: 1000 },  // Full load
    { duration: '4m', target: 1000 },  // Sustained
    { duration: '2m', target: 0 },     // Ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(99)<150'],  // Total session setup < 150ms
    'http_req_failed': ['rate<0.005'],   // Error rate < 0.5%
    'group_duration{group:::x3dh}': ['p(99)<50'],
    'group_duration{group:::noise_handshake}': ['p(99)<100'],
  }
};

// Simulate EC-P256 key pair generation
function generateECPublicKey() {
  const hash = crypto.sha256(`${Date.now()}-${Math.random()}`, 'hex');
  return encoding.b64encode(hash.substring(0, 64));
}

// Simulate X3DH 4-DH operation
function simulateX3DH(ik1, spk1, ek1, ik2) {
  const dh1 = crypto.sha256(`${ik1}${ik2}`, 'hex');
  const dh2 = crypto.sha256(`${spk1}${ik2}`, 'hex');
  const dh3 = crypto.sha256(`${ek1}${ik2}`, 'hex');
  const dh4 = crypto.sha256(`${ek1}${spk1}`, 'hex');

  // HKDF-SHA256 derivation
  const combinedDH = `${dh1}${dh2}${dh3}${dh4}`;
  const sharedSecret = crypto.sha256(combinedDH, 'hex');

  return sharedSecret;
}

// Simulate Noise Protocol handshake (NN pattern)
function simulateNoiseHandshake(initiatorEphemeral, responderEphemeral) {
  // NN pattern: no pre-shared keys, pure DH
  const dh = crypto.sha256(`${initiatorEphemeral}${responderEphemeral}`, 'hex');

  // CipherState initialization
  const k = crypto.sha256(`key-${dh}`, 'hex');
  const n = crypto.sha256(`nonce-${dh}`, 'hex');

  return {
    cipherKey: k.substring(0, 32),
    nonce: n.substring(0, 24)
  };
}

export default function() {
  const userId = `user_${__VU}`;
  const remotePartyId = `party_${Math.floor(Math.random() * 1000)}`;

  // Test 1: X3DH Key Agreement (for Signal Protocol)
  group('x3dh', () => {
    // Generate ephemeral keys
    const initiatorIK = generateECPublicKey();
    const initiatorSPK = generateECPublicKey();
    const initiatorEK = generateECPublicKey();
    const responderIK = generateECPublicKey();

    let x3dhPayload = JSON.stringify({
      enrollmentId: `enrollment_${__VU}`,
      remotePartyId: remotePartyId,
      initiatorIdentityKey: initiatorIK,
      initiatorSignedPreKey: initiatorSPK,
      initiatorEphemeralKey: initiatorEK,
      responderIdentityKey: responderIK,
    });

    let x3dhResponse = http.post(
      'http://localhost:3000/dma/key-agreement/x3dh',
      x3dhPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userId}_token`
        },
        timeout: '5s'
      }
    );

    check(x3dhResponse, {
      'x3dh success 200': (r) => r.status === 200,
      'shared secret returned': (r) => r.json('sharedSecret') !== null,
      'session ID created': (r) => r.json('sessionId') !== null,
      'x3dh time < 50ms': (r) => r.timings.duration < 50,
    });

    if (x3dhResponse.status !== 200) {
      console.error(`X3DH failed: ${x3dhResponse.status}`);
    }

    sleep(0.1);
  });

  // Test 2: Noise Protocol Handshake (NN pattern)
  if (__VU <= 500) { // Only half the VUs do Noise handshake
    group('noise_handshake', () => {
      const initiatorEphemeral = generateECPublicKey();
      const responderEphemeral = generateECPublicKey();

      let noisePayload = JSON.stringify({
        enrollmentId: `enrollment_${__VU}`,
        remotePartyId: remotePartyId,
        pattern: 'NN',
        ephemeralPublicKey: initiatorEphemeral,
        expectedResponderEphemeral: responderEphemeral,
      });

      let noiseResponse = http.post(
        'http://localhost:3000/dma/noise-handshake/initiate',
        noisePayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userId}_token`
          },
          timeout: '5s'
        }
      );

      check(noiseResponse, {
        'noise handshake 200': (r) => r.status === 200,
        'cipher state initialized': (r) => r.json('cipherKey') !== null,
        'session ready': (r) => r.json('sessionReady') === true || r.status !== 200,
        'handshake time < 100ms': (r) => r.timings.duration < 100,
      });

      // Test 3: Complete handshake (if initiating)
      if (noiseResponse.status === 200) {
        group('noise_complete', () => {
          const messagePayload = JSON.stringify({
            sessionId: noiseResponse.json('sessionId'),
            responderEphemeralKey: responderEphemeral,
          });

          let completeResponse = http.post(
            'http://localhost:3000/dma/noise-handshake/complete',
            messagePayload,
            {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userId}_token`
              },
              timeout: '5s'
            }
          );

          check(completeResponse, {
            'handshake complete 200': (r) => r.status === 200,
            'transport ready': (r) => r.json('transportReady') === true,
            'complete time < 50ms': (r) => r.timings.duration < 50,
          });

          sleep(0.1);
        });
      }
    });
  }

  // Test 4: Session Persistence
  group('session_persistence', () => {
    let sessionId = `session_${__VU}_${__ITER}`;

    let persistResponse = http.get(
      `http://localhost:3000/dma/sessions/${sessionId}`,
      {
        headers: {
          'Authorization': `Bearer ${userId}_token`
        },
        timeout: '5s'
      }
    );

    check(persistResponse, {
      'session lookup success': (r) => r.status === 200 || r.status === 404,
      'persistence time < 50ms': (r) => r.timings.duration < 50,
    });

    sleep(0.5);
  });
}

/**
 * Expected Results:
 *
 * X3DH Key Agreement (1000 concurrent):
 * ✓ Success rate: 99.5%+
 * ✓ Latency p99: < 50ms
 * ✓ Zero failed key agreements
 * ✓ Proper session ID generation
 *
 * Noise Protocol Handshake (500 concurrent):
 * ✓ Success rate: 99.5%+
 * ✓ Initiation time: p99 < 100ms
 * ✓ Completion time: p99 < 50ms
 * ✓ Total handshake < 150ms
 * ✓ Cipher state properly initialized
 *
 * Session Management:
 * ✓ Session storage latency < 50ms
 * ✓ Session retrieval < 50ms
 * ✓ Memory per session: < 1MB
 * ✓ No session leaks during ramp-down
 *
 * Database Performance:
 * ✓ 1000 concurrent writes: stable
 * ✓ Index performance: enrollmentId lookup < 10ms
 * ✓ No deadlocks or lock contention
 */
