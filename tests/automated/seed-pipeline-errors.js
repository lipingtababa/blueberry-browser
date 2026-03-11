/**
 * Seed the error pipeline with synthetic error reports.
 *
 * High count: tool.ip-lookup.invalid-shape  (25 occurrences)
 * Low count:  tool.ip-lookup.timeout         (3 occurrences)
 *
 * Usage: node tests/automated/seed-pipeline-errors.js [endpoint]
 * Default endpoint: http://localhost:4242/errors
 */

const ENDPOINT = process.argv[2] ?? 'http://localhost:4242/errors';

const ERRORS = [
  {
    label: 'tool.ip-lookup.invalid-shape',
    count: 25,
    event: {
      toolName: 'getMyIpAddress',
      errorType: 'Error',
      message: 'IP lookup returned unexpected response shape',
      signature: 'IP lookup returned unexpected response shape',
      stack: null,
      appVersion: '1.0.0',
      platform: 'darwin',
    },
  },
  {
    label: 'tool.ip-lookup.timeout',
    count: 3,
    event: {
      toolName: 'getMyIpAddress',
      errorType: 'Error',
      message: 'IP lookup timed out',
      signature: 'IP lookup timed out',
      stack: null,
      appVersion: '1.0.0',
      platform: 'darwin',
    },
  },
];

async function post(event) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...event, timestamp: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`POST failed: ${res.status} ${res.statusText}`);
}

(async () => {
  console.log(`Seeding errors → ${ENDPOINT}\n`);

  for (const { label, count, event } of ERRORS) {
    process.stdout.write(`${label} (${count}x) ... `);
    await Promise.all(Array(count).fill(null).map(() => post(event)));
    console.log('done');
  }

  const res = await fetch(ENDPOINT);
  const buckets = await res.json();
  console.log('\nBuckets:');
  for (const b of buckets) {
    console.log(`  ${b.category} | count: ${b.count} | fixable: ${b.fixable}`);
  }
})();
