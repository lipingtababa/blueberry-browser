/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { createServer } from "http";
import { fileURLToPath } from "url";

// ---------------------------------------------------------------------------
// Categorization
// ---------------------------------------------------------------------------

/**
 * @param {{ toolName: string | null, message: string }} event
 * @returns {{ category: string, label: string, fixable: boolean, fixReason: string | null }}
 */
export function categorizeError(event) {
  const msg = (event.message ?? "").toLowerCase();
  const toolName = event.toolName ?? null;

  // Stage 2: tool errors — checked before LLM-stream non-fixable gate
  if (toolName === "getMyIpAddress") {
    if (msg.includes("timed out")) {
      return {
        category: "tool.ip-lookup.timeout",
        label: "IP Lookup — Timeout",
        fixable: true,
        fixReason: null,
      };
    }
    if (msg.includes("ip lookup failed:")) {
      return {
        category: "tool.ip-lookup.http-error",
        label: "IP Lookup — HTTP Error",
        fixable: true,
        fixReason: null,
      };
    }
    if (msg.includes("unexpected response shape")) {
      return {
        category: "tool.ip-lookup.invalid-shape",
        label: "IP Lookup — Invalid Response Shape",
        fixable: true,
        fixReason: null,
      };
    }
    if (msg.includes("invalid ipv4")) {
      return {
        category: "tool.ip-lookup.invalid-ip",
        label: "IP Lookup — Invalid IPv4",
        fixable: true,
        fixReason: null,
      };
    }
    return {
      category: "tool.ip-lookup.unknown",
      label: "IP Lookup — Unknown",
      fixable: true,
      fixReason: null,
    };
  }

  // Stage 1: non-fixable gate — LLM stream errors only (toolName == null)
  if (msg.includes("401") || msg.includes("unauthorized")) {
    return {
      category: "llm.stream.unknown",
      label: "LLM Stream — Unknown",
      fixable: false,
      fixReason: "Config error — check API key",
    };
  }
  if (msg.includes("429") || msg.includes("rate limit")) {
    return {
      category: "llm.stream.unknown",
      label: "LLM Stream — Unknown",
      fixable: false,
      fixReason: "External rate limit — not a code bug",
    };
  }
  if (
    msg.includes("network") ||
    msg.includes("econnrefused") ||
    msg.includes("no internet")
  ) {
    return {
      category: "llm.stream.unknown",
      label: "LLM Stream — Unknown",
      fixable: false,
      fixReason: "Network issue — not a code bug",
    };
  }

  // LLM stream errors (toolName == null), fixable
  if (msg.includes("timeout") || msg.includes("timed out")) {
    return {
      category: "llm.stream.timeout",
      label: "LLM Stream — Timeout",
      fixable: true,
      fixReason: null,
    };
  }

  return {
    category: "llm.stream.unknown",
    label: "LLM Stream — Unknown",
    fixable: true,
    fixReason: null,
  };
}

// ---------------------------------------------------------------------------
// App factory (test-friendly, no HTTP binding)
// ---------------------------------------------------------------------------

export function createApp() {
  /** @type {Map<string, object>} */
  const buckets = new Map();

  function postError(payload) {
    const { category, label, fixable, fixReason } = categorizeError(payload);
    const bucketKey = `${category}:${payload.signature}`;

    if (buckets.has(bucketKey)) {
      const bucket = buckets.get(bucketKey);
      bucket.count += 1;
      bucket.lastSeen = payload.timestamp;
      if (bucket.samples.length < 5) {
        bucket.samples.push(payload);
      } else {
        // Keep most recent 5: drop oldest, append newest
        bucket.samples.shift();
        bucket.samples.push(payload);
      }
    } else {
      buckets.set(bucketKey, {
        category,
        signature: payload.signature,
        label,
        fixable,
        fixReason: fixReason ?? null,
        count: 1,
        firstSeen: payload.timestamp,
        lastSeen: payload.timestamp,
        samples: [payload],
      });
    }

    return Promise.resolve(204);
  }

  function getBuckets() {
    return Array.from(buckets.values());
  }

  function resetBuckets() {
    buckets.clear();
  }

  return { postError, getBuckets, resetBuckets };
}

// ---------------------------------------------------------------------------
// HTTP server — only starts when executed directly
// ---------------------------------------------------------------------------

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Blueberry Error Dashboard</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 1rem; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
    .fixable { background: #f0fff4; }
    .not-fixable { background: #f5f5f5; color: #666; }
    button { cursor: pointer; }
  </style>
</head>
<body>
  <h1>Blueberry Error Dashboard</h1>
  <p id="refresh-time">Loading...</p>
  <button onclick="resetAll()">Reset All</button>
  <table id="error-table">
    <thead>
      <tr>
        <th>Label</th><th>Category</th><th>Count</th><th>First Seen</th><th>Last Seen</th><th>Sample</th><th>Fixable</th><th>Action</th>
      </tr>
    </thead>
    <tbody id="table-body"></tbody>
  </table>
  <script>
    function esc(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }
    async function loadErrors() {
      const resp = await fetch('/errors');
      const buckets = await resp.json();
      const tbody = document.getElementById('table-body');
      tbody.innerHTML = '';
      for (const b of buckets) {
        const tr = document.createElement('tr');
        tr.className = b.fixable ? 'fixable' : 'not-fixable';
        const sample = b.samples[0] ? JSON.stringify(b.samples[0]) : '';
        const action = b.fixable
          ? \`<button onclick="triggerFix(\${esc(JSON.stringify(b))})">Trigger Fix</button>\`
          : esc(b.fixReason ?? 'Not fixable');
        tr.innerHTML = \`
          <td>\${esc(b.label)}</td>
          <td>\${esc(b.category)}</td>
          <td>\${esc(b.count)}</td>
          <td>\${esc(b.firstSeen)}</td>
          <td>\${esc(b.lastSeen)}</td>
          <td>\${esc(sample.slice(0, 100))}</td>
          <td>\${esc(b.fixable)}</td>
          <td>\${action}</td>
        \`;
        tbody.appendChild(tr);
      }
      document.getElementById('refresh-time').textContent = 'Last refreshed: ' + new Date().toLocaleTimeString();
    }
    function triggerFix(bucket) {
      const prompt = \`You are working in the blueberry-browser project.\\n\\nA recurring error has been detected that requires a code fix:\\n  Category: \${bucket.category} (\${bucket.count} occurrences)\\n  Label: \${bucket.label}\\n  Sample: \${JSON.stringify(bucket.samples[0])}\\n\\nRun the full fix pipeline:\\n1. /architect\\n2. tester agent\\n3. coder agent\\n4. /ship\`;
      navigator.clipboard.writeText(prompt).then(() => alert('Copied!'));
    }
    async function resetAll() {
      await fetch('/errors', { method: 'DELETE' });
      loadErrors();
    }
    loadErrors();
    setInterval(loadErrors, 10000);
  </script>
</body>
</html>`;

function startServer() {
  const sharedApp = createApp();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4242;

  const server = createServer((req, res) => {
    if (req.method === "GET" && req.url === "/") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(DASHBOARD_HTML);
    } else if (req.method === "POST" && req.url === "/errors") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", async () => {
        try {
          const payload = JSON.parse(body);
          await sharedApp.postError(payload);
          res.writeHead(204);
          res.end();
        } catch {
          res.writeHead(400);
          res.end("Bad Request");
        }
      });
    } else if (req.method === "GET" && req.url === "/errors") {
      const buckets = sharedApp.getBuckets();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(buckets));
    } else if (req.method === "DELETE" && req.url === "/errors") {
      sharedApp.resetBuckets();
      res.writeHead(204);
      res.end();
    } else {
      res.writeHead(404);
      res.end("Not Found");
    }
  });

  server.listen(PORT, () => {
    console.log(`Error dashboard running at http://localhost:${PORT}`);
  });
}

// Only start the HTTP server when executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer();
}
