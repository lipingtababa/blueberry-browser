/**
 * Seed the error pipeline with synthetic error reports.
 *
 * High count: tool.ip-lookup.invalid-shape  (25 occurrences)
 * Low count:  tool.ip-lookup.timeout         (3 occurrences)
 * Rare (1x):  tool.ip-lookup.http-error, tool.ip-lookup.invalid-ip, llm.stream.unknown
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
  {
    label: 'tool.ip-lookup.http-error',
    count: 1,
    event: {
      toolName: 'getMyIpAddress',
      errorType: 'Error',
      message: 'IP lookup failed: 503 Service Unavailable',
      signature: 'IP lookup failed: {status} Service Unavailable',
      stack: null,
      appVersion: '1.0.0',
      platform: 'darwin',
    },
  },
  {
    label: 'tool.ip-lookup.invalid-ip',
    count: 1,
    event: {
      toolName: 'getMyIpAddress',
      errorType: 'Error',
      message: 'IP lookup returned an invalid IPv4 address',
      signature: 'IP lookup returned an invalid IPv4 address',
      stack: null,
      appVersion: '1.0.0',
      platform: 'darwin',
    },
  },
  {
    label: 'llm.stream.unknown (rate limit)',
    count: 1,
    event: {
      toolName: null,
      errorType: 'Error',
      message: '429 Too Many Requests: rate limit exceeded',
      signature: '{status} Too Many Requests: rate limit exceeded',
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
