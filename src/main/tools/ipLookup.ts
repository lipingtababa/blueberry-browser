// ip-api.com works from Node.js/Electron main process (HTTP is fine here — no browser mixed-content restriction)
const IP_LOOKUP_URL = "http://ip-api.com/json";
const TIMEOUT_MS = 2500;
const IPV4_REGEX =
  /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

export interface IpLookupResult {
  ip: string;
  city: string | null;
  region: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
}

/**
 * Fetches the user's public IPv4 address and geolocation from ip-api.com.
 * @returns IpLookupResult — validated IPv4 + best-effort geo fields (null when unavailable)
 * @throws Error if the network request fails, times out, returns a non-2xx status,
 *         returns an unexpected shape, or returns a non-IPv4 string
 */
export async function fetchPublicIp(): Promise<IpLookupResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(IP_LOOKUP_URL, {
      signal: controller.signal,
      redirect: "error",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(
        `IP lookup failed: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as unknown;

    if (typeof data !== "object" || data === null) {
      throw new Error("IP lookup returned unexpected response shape");
    }

    const record = data as Record<string, unknown>;

    // ip-api.com signals errors via a 200 with { status: "fail", message: "..." }
    if (record.status === "fail") {
      const reason =
        typeof record.message === "string" ? record.message : "unknown";
      throw new Error(`IP lookup service error: ${reason}`);
    }

    // ip-api.com returns the IP in the "query" field
    if (!("query" in data) || typeof record.query !== "string") {
      throw new Error("IP lookup returned unexpected response shape");
    }

    const ip = record.query as string;

    if (!IPV4_REGEX.test(ip)) {
      throw new Error("IP lookup returned an invalid IPv4 address");
    }

    const stringOrNull = (v: unknown): string | null =>
      typeof v === "string" && v !== "" ? v : null;

    return {
      ip,
      city: stringOrNull(record.city),
      region: stringOrNull(record.regionName), // ip-api.com uses "regionName"
      country: stringOrNull(record.country),
      latitude: typeof record.lat === "number" ? record.lat : null,
      longitude: typeof record.lon === "number" ? record.lon : null,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("IP lookup timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
