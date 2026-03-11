const IP_LOOKUP_URL = "https://api4.ipify.org?format=json";
const TIMEOUT_MS = 2500;
const IPV4_REGEX =
  /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

/**
 * Fetches the user's public IPv4 address from api4.ipify.org.
 * @returns { ip: string } — validated IPv4 address string
 * @throws Error if the network request fails, times out, returns a non-2xx status,
 *         returns an unexpected shape, or returns a non-IPv4 string
 */
export async function fetchPublicIp(): Promise<{ ip: string }> {
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
        `IP lookup failed: ${response.status} ${response.statusText}`
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

    const ip = (data as { ip: string }).ip;

    if (!IPV4_REGEX.test(ip)) {
      throw new Error("IP lookup returned an invalid IPv4 address");
    }

    return { ip };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("IP lookup timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
