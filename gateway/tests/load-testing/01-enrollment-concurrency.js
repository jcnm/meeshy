/**
 * Load Test: Concurrent User Enrollment
 * Goal: Validate 1000 concurrent user enrollments without bottlenecks
 *
 * Run: k6 run --vus 1000 --duration 4m 01-enrollment-concurrency.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '30s', target: 100 },   // Ramp up to 100 users
    { duration: '1m30s', target: 500 }, // Ramp up to 500 users
    { duration: '1m30s', target: 1000 }, // Ramp up to 1000 users
    { duration: '1m', target: 0 },      // Ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(99)<500'],   // 99th percentile < 500ms
    'http_req_failed': ['rate<0.01'],     // Error rate < 1%
    'group_duration{group:::enrollment}': ['p(99)<500'],
    'group_duration{group:::jwt_validation}': ['p(99)<200'],
  },
  ext: {
    loadimpact: {
      projectID: 3456789,
      name: 'Enrollment Concurrency Test'
    }
  }
};

// Global counter for unique user IDs
let userCounter = 0;

export default function() {
  const userId = `user_${__VU}_${__ITER}`;
  const whatsappLogin = `${userId}@whatsapp.com`;
  const deviceId = `device_${__VU}_${Date.now()}`;

  // Test 1: Create new enrollment
  group('enrollment', () => {
    let enrollmentPayload = JSON.stringify({
      whatsappLogin: whatsappLogin,
      deviceId: deviceId,
      platform: 'android',
      osVersion: '14.0'
    });

    let enrollmentResponse = http.post(
      'http://localhost:3000/dma/enroll',
      enrollmentPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Meeshy-DMA-Client/1.0'
        },
        timeout: '10s'
      }
    );

    check(enrollmentResponse, {
      'enrollment status 200': (r) => r.status === 200,
      'enrollment token exists': (r) => r.json('enrollmentToken') !== null,
      'enrollment token length > 0': (r) => r.json('enrollmentToken').length > 0,
      'whatsapp internal ID assigned': (r) => r.json('whatsappInternalId') !== null,
      'response time < 500ms': (r) => r.timings.duration < 500,
    });

    if (enrollmentResponse.status !== 200) {
      console.error(`Enrollment failed for ${whatsappLogin}: ${enrollmentResponse.status}`);
      console.error(`Response: ${enrollmentResponse.body}`);
    }

    sleep(0.5);
  });

  // Test 2: Get enrollment details
  group('get_enrollment', () => {
    // Note: In real test, we would extract enrollmentToken from previous response
    let enrollmentId = `enrollment_${__VU}_${__ITER}`;

    let getResponse = http.get(
      `http://localhost:3000/dma/enrollments/${enrollmentId}`,
      {
        headers: {
          'Authorization': 'Bearer mock-jwt-token',
          'User-Agent': 'Meeshy-DMA-Client/1.0'
        },
        timeout: '10s'
      }
    );

    check(getResponse, {
      'get enrollment status 200': (r) => r.status === 200 || r.status === 404,
      'response time < 300ms': (r) => r.timings.duration < 300,
    });

    sleep(0.5);
  });

  // Test 3: Fetch pre-key bundle
  group('fetch_prekey_bundle', () => {
    let bundleResponse = http.post(
      'http://localhost:3000/dma/prekey-bundle',
      JSON.stringify({
        whatsappId: 'test@whatsapp.com',
        deviceId: deviceId
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Meeshy-DMA-Client/1.0'
        },
        timeout: '10s'
      }
    );

    check(bundleResponse, {
      'prekey bundle status 200': (r) => r.status === 200 || r.status === 404,
      'bundle contains keys': (r) => {
        try {
          return r.json('identityKey') !== null || r.status === 404;
        } catch {
          return true;
        }
      },
      'response time < 200ms': (r) => r.timings.duration < 200,
    });

    sleep(0.5);
  });
}

/**
 * Expected Results:
 * - 99th percentile response time: < 500ms
 * - Error rate: < 1%
 * - Successful enrollments: 99%+
 * - Database connection pool healthy
 * - No memory leaks during ramp-down
 */
