// Run with: node --import tsx/esm tests/automated/trigger-ip-lookup.js
// or: npx tsx tests/automated/trigger-ip-lookup.js
import { fetchPublicIp } from '../../src/main/tools/ipLookup.ts';

(async () => {
  try {
    await fetchPublicIp();
  } catch (e) {
    console.error('As expected:', e.message);
  }
})();
