import { fetchPublicIp } from '../../out/main/tools/ipLookup.js';

(async () => {
  try {
    await fetchPublicIp();
  } catch (e) {
    console.error('As expected:', e.message);
  }
})();
