/**
 * Playwright Global Teardown
 *
 * Exécuté une fois après tous les tests E2E
 */

import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Global Teardown: Cleaning up after E2E tests...');

  // Cleanup test data if needed
  const apiURL = process.env.GATEWAY_URL || 'http://localhost:3000';

  try {
    // Example: Delete all test users created during tests
    // const response = await fetch(`${apiURL}/api/test/cleanup`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' }
    // });

    console.log('✅ Cleanup completed');
  } catch (error) {
    console.warn('⚠️ Cleanup failed:', error);
  }
}

export default globalTeardown;
