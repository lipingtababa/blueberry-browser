const IP_LOOKUP_URL = "https://ipapi.co/json";
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
 * Fetches the user's public IPv4 address and geolocation from ipapi.co.
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

    if (
      typeof data !== "object" ||
      data === null ||
      !("ip" in data) ||
      typeof (data as Record<string, unknown>).ip !== "string"
    ) {
      throw new Error("IP lookup returned unexpected response shape");
    }

    const record = data as Record<string, unknown>;
    const ip = record.ip as string;

    if (!IPV4_REGEX.test(ip)) {
      throw new Error("IP lookup returned an invalid IPv4 address");
    }

    const stringOrNull = (v: unknown): string | null =>
      typeof v === "string" && v !== "" ? v : null;

    return {
      ip,
      city: stringOrNull(record.city),
      region: stringOrNull(record.region),
      country: stringOrNull(record.country_name),
      latitude: typeof record.latitude === "number" ? record.latitude : null,
      longitude: typeof record.longitude === "number" ? record.longitude : null,
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
