import { Hono } from "hono";
import { cors } from "hono/cors";
import { verifyToken } from "@clerk/backend";
import Stripe from "stripe";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Env {
  DB: D1Database;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  CLERK_SECRET_KEY: string;
  LICENSE_SECRET: string;
  STRIPE_MONTHLY_PRICE_ID: string;
  STRIPE_LIFETIME_PRICE_ID: string;
  GITHUB_TOKEN: string;   // PAT with repo scope for release downloads
}

interface LicenseRow {
  id: string;
  user_id: string;
  email: string;
  plan: "monthly" | "lifetime";
  key: string;
  devices: string; // JSON array
  created_at: number;
  expires_at: number | null;
  active: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LICENSE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 chars, no I/O/0/1
const LICENSE_LENGTH = 24; // chars after "AT-"
const MAX_DEVICES = 3;

/** Generate a human-readable license key: "AT-" + 24 base32 chars. */
function generateLicenseKey(): string {
  const arr = new Uint8Array(LICENSE_LENGTH);
  crypto.getRandomValues(arr);
  let key = "AT-";
  for (let i = 0; i < LICENSE_LENGTH; i++) {
    key += LICENSE_ALPHABET[arr[i] & 31]; // lower 5 bits → 0-31
  }
  return key;
}

/** Parse devices JSON column safely. */
function parseDevices(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Hash a device fingerprint so we don't store raw fingerprints in plaintext if desired.
 *  Uses HMAC-SHA256 with LICENSE_SECRET. */
async function hashDevice(secret: string, fingerprint: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(fingerprint));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Simple JSON error response. */
function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

// ---------------------------------------------------------------------------
// Auth middleware – Clerk session token
// ---------------------------------------------------------------------------

async function clerkAuth(env: Env, req: Request): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return jsonError("Missing or invalid Authorization header", 401);
  }
  const token = authHeader.slice(7);
  try {
    const result = await verifyToken(token, { secretKey: env.CLERK_SECRET_KEY });
    const payload = result.data as { sub?: string } | undefined;
    if ("errors" in result || !payload?.sub) {
      return jsonError("Invalid session token", 401);
    }
    return { userId: payload.sub };
  } catch {
    return jsonError("Invalid session token", 401);
  }
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const app = new Hono<{ Bindings: Env }>();

app.use("*", cors());

// ─────────────────────────────────────────────────────────────────────────
// Payment & Licensing (existing routes)
// ─────────────────────────────────────────────────────────────────────────

// POST /checkout — create Stripe checkout session
app.post("/checkout", async (c) => {
  const env = c.env;
  const authResult = await clerkAuth(env, c.req.raw);
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;

  let body: { plan?: string; success_url?: string; cancel_url?: string };
  try { body = await c.req.json(); } catch { return jsonError("Invalid JSON body"); }

  const { plan, success_url, cancel_url } = body;
  if (plan !== "monthly" && plan !== "lifetime") {
    return jsonError("plan must be 'monthly' or 'lifetime'");
  }
  if (!success_url || !cancel_url) {
    return jsonError("success_url and cancel_url are required");
  }

  const priceId = plan === "monthly" ? env.STRIPE_MONTHLY_PRICE_ID : env.STRIPE_LIFETIME_PRICE_ID;
  if (!priceId || priceId === "CHANGEME") return jsonError("Price ID not configured", 500);

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-02-24.acacia",
    httpClient: Stripe.createFetchHttpClient(),
  });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: plan === "monthly" ? "subscription" : "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url, cancel_url,
      client_reference_id: userId,
      metadata: { plan, user_id: userId },
    });
    return Response.json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Stripe error";
    return jsonError(message, 500);
  }
});

// POST /webhook — Stripe webhook handler
app.post("/webhook", async (c) => {
  const env = c.env;
  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-02-24.acacia",
    httpClient: Stripe.createFetchHttpClient(),
  });
  const sig = c.req.header("stripe-signature");
  if (!sig) return jsonError("Missing stripe-signature header", 400);
  const rawBody = await c.req.raw.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return jsonError("Invalid webhook signature", 400);
  }
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata ?? {};
    const plan = (metadata.plan as "monthly" | "lifetime") ?? "monthly";
    const userId = metadata.user_id ?? "unknown";
    const email = session.customer_details?.email ?? session.customer_email ?? "unknown";
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = plan === "lifetime" ? null : now + 30 * 24 * 60 * 60;
    const key = generateLicenseKey();
    await env.DB.prepare(
      `INSERT INTO licenses (id, user_id, email, plan, key, devices, created_at, expires_at, active)
       VALUES (?, ?, ?, ?, ?, '[]', ?, ?, 1)`,
    ).bind(crypto.randomUUID(), userId, email, plan, key, now, expiresAt).run();
    console.log(`✅ License created: ${key} for ${email} (${plan})`);
  }
  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const customerId = (sub.customer as string) ?? "unknown";
    await env.DB.prepare(
      `UPDATE licenses SET active = 0 WHERE user_id = ? AND plan = 'monthly' AND active = 1`,
    ).bind(customerId).run();
    console.log(`🚫 Deactivated monthly licenses for customer ${customerId}`);
  }
  return Response.json({ received: true });
});

// POST /verify-license — validate a license key for a device
app.post("/verify-license", async (c) => {
  const env = c.env;
  let body: { key?: string; device_id?: string };
  try { body = await c.req.json(); } catch { return jsonError("Invalid JSON body"); }
  const { key, device_id } = body;
  if (!key || !device_id) return jsonError("key and device_id are required");
  const normalizedKey = key.trim().toUpperCase();
  const row = await env.DB.prepare(
    `SELECT * FROM licenses WHERE key = ? LIMIT 1`,
  ).bind(normalizedKey).first<LicenseRow>();
  if (!row) return Response.json({ valid: false, reason: "license_not_found" });
  if (row.active !== 1) return Response.json({ valid: false, reason: "license_inactive" });
  if (row.expires_at !== null) {
    const now = Math.floor(Date.now() / 1000);
    if (now > row.expires_at) return Response.json({ valid: false, reason: "license_expired" });
  }
  const devices = parseDevices(row.devices);
  const deviceHash = await hashDevice(env.LICENSE_SECRET, device_id);
  if (!devices.includes(deviceHash)) {
    if (devices.length >= MAX_DEVICES) {
      return Response.json({ valid: false, reason: "device_limit_reached", devices: devices.length, max: MAX_DEVICES });
    }
    devices.push(deviceHash);
    await env.DB.prepare(`UPDATE licenses SET devices = ? WHERE id = ?`).bind(JSON.stringify(devices), row.id).run();
  }
  return Response.json({ valid: true, plan: row.plan, email: row.email, devices: devices.length, max_devices: MAX_DEVICES, expires_at: row.expires_at, created_at: row.created_at });
});

// POST /deactivate — remove a device from a license
app.post("/deactivate", async (c) => {
  const env = c.env;
  const authResult = await clerkAuth(env, c.req.raw);
  if (authResult instanceof Response) return authResult;
  const { userId } = authResult;
  let body: { key?: string; device_id?: string };
  try { body = await c.req.json(); } catch { return jsonError("Invalid JSON body"); }
  const { key, device_id } = body;
  if (!key || !device_id) return jsonError("key and device_id are required");
  const normalizedKey = key.trim().toUpperCase();
  const row = await env.DB.prepare(`SELECT * FROM licenses WHERE key = ? LIMIT 1`).bind(normalizedKey).first<LicenseRow>();
  if (!row) return jsonError("License not found", 404);
  if (row.user_id !== userId) return jsonError("You do not own this license", 403);
  const devices = parseDevices(row.devices);
  const deviceHash = await hashDevice(env.LICENSE_SECRET, device_id);
  const newDevices = devices.filter((d) => d !== deviceHash);
  if (newDevices.length === devices.length) return jsonError("Device not found on this license", 404);
  await env.DB.prepare(`UPDATE licenses SET devices = ? WHERE id = ?`).bind(JSON.stringify(newDevices), row.id).run();
  return Response.json({ success: true, devices_remaining: newDevices.length });
});

// ─────────────────────────────────────────────────────────────────────────
// Release CDN — proxies private GitHub Releases to public.
// The Worker holds a GITHUB_TOKEN (PAT with repo scope).
// ─────────────────────────────────────────────────────────────────────────

const REPO_OWNER = "Donald8585";
const REPO_NAME = "attunely";

function assetPattern(platform: string, arch: string): RegExp {
  const patterns: Record<string, RegExp> = {
    "windows-x64":   /Attunely_.*_x64-setup\.exe$/,
    "macos-x64":     /Attunely_.*_x64\.dmg$/,
    "macos-arm64":   /Attunely_.*_aarch64\.dmg$/,
    "linux-x64":     /[Aa]ttunely_.*_amd64\.AppImage$/,
    "linux-arm64":   /[Aa]ttunely_.*_arm64\.AppImage$/,
  };
  return patterns[`${platform}-${arch}`] ?? /./;
}

// GET /releases/latest/:platform/:arch — stream latest installer binary
app.get("/releases/latest/:platform/:arch", async (c) => {
  const platform = c.req.param("platform");
  const arch = c.req.param("arch");

  const resp = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`,
    { headers: { Authorization: `Bearer ${c.env.GITHUB_TOKEN}`, "User-Agent": "attunely-worker", Accept: "application/vnd.github.v3+json" } },
  );
  if (!resp.ok) return Response.json({ error: "Failed to fetch release" }, { status: 502 });

  const release: any = await resp.json();
  const asset = release.assets?.find((a: any) => assetPattern(platform, arch).test(a.name));
  if (!asset) return Response.json({ error: "No matching asset", platform, arch }, { status: 404 });

  const download = await fetch(asset.url, {
    headers: { Authorization: `Bearer ${c.env.GITHUB_TOKEN}`, "User-Agent": "attunely-worker", Accept: "application/octet-stream" },
    redirect: "follow",
  });
  if (!download.ok) return Response.json({ error: "Download failed" }, { status: 502 });

  return new Response(download.body, {
    status: 200,
    headers: {
      "Content-Type": download.headers.get("Content-Type") ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${asset.name}"`,
      "Content-Length": download.headers.get("Content-Length") ?? asset.size?.toString() ?? "0",
      "Cache-Control": "public, max-age=3600",
    },
  });
});

// GET /releases/updater/:target/:arch/:current_version — Tauri auto-updater endpoint
app.get("/releases/updater/:target/:arch/:current_version", async (c) => {
  const target = c.req.param("target");
  const arch = c.req.param("arch");
  const currentVersion = c.req.param("current_version");

  const resp = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`,
    { headers: { Authorization: `Bearer ${c.env.GITHUB_TOKEN}`, "User-Agent": "attunely-updater", Accept: "application/vnd.github.v3+json" } },
  );
  if (!resp.ok) return Response.json({ error: "Failed to fetch release" }, { status: 502 });

  const release: any = await resp.json();
  const latestVersion = (release.tag_name ?? "v0.0.0").replace(/^v/, "");
  if (latestVersion === currentVersion.replace(/^v/, "")) return new Response(null, { status: 204 });

  const sigPattern = new RegExp(`Attunely_.*_${arch}.*\\.(exe\\.zip\\.sig|app\\.tar\\.gz\\.sig|AppImage\\.tar\\.gz\\.sig)$`, "i");
  const sigAsset = release.assets?.find((a: any) => sigPattern.test(a.name));
  if (!sigAsset) return new Response(null, { status: 204 });

  const sigResp = await fetch(sigAsset.url, {
    headers: { Authorization: `Bearer ${c.env.GITHUB_TOKEN}`, "User-Agent": "attunely-updater", Accept: "application/octet-stream" },
  });
  const signature = await sigResp.text();
  const workerHost = c.req.header("host") ?? "attunely-api.workers.dev";
  const downloadUrl = `https://${workerHost}/releases/latest/${target === "darwin" ? "macos" : target}/${arch}`;

  return Response.json({
    version: `v${latestVersion}`,
    notes: release.body ?? "",
    pub_date: release.published_at ?? new Date().toISOString(),
    platforms: { [target]: { signature, url: downloadUrl } },
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Install scripts — served inline so users never touch the private repo.
// Usage:
//   curl -fsSL https://WORKER/install.sh | bash
//   irm https://WORKER/install.ps1 | iex
// ─────────────────────────────────────────────────────────────────────────

const INSTALL_SH = `#!/usr/bin/env bash
set -euo pipefail

BOLD="\\\\033[1m"; GREEN="\\\\033[0;32m"; RED="\\\\033[0;31m"; NC="\\\\033[0m"
log()  { echo -e "\${GREEN}==>\${NC} \${BOLD}\$*\${NC}"; }
die()  { echo -e "\${RED}✗\${NC}  \$*" >&2; exit 1; }

OS=\$(uname -s); ARCH=\$(uname -m)
case "\$OS" in
  Darwin) PLATFORM="macos";;
  Linux)  PLATFORM="linux";;
  *)      die "Unsupported OS: \$OS";;
esac
case "\$ARCH" in
  x86_64|amd64)  ARCH_NORM="x64";;
  arm64|aarch64) ARCH_NORM="arm64";;
  *)             die "Unsupported arch: \$ARCH";;
esac

DOWNLOAD_URL="https://api.tunesoar.com/releases/latest/\${PLATFORM}/\${ARCH_NORM}"

log "Detected: \$PLATFORM / \$ARCH_NORM"
log "Downloading Attunely..."

TMPDIR=\$(mktemp -d)
trap 'rm -rf "\$TMPDIR"' EXIT
cd "\$TMPDIR"

if [ "\$PLATFORM" = "macos" ]; then
  curl -fsSL --progress-bar -o Attunely.dmg "\$DOWNLOAD_URL" || die "Download failed"
  log "Mounting DMG..."
  hdiutil attach Attunely.dmg -nobrowse -quiet
  if [ -d "/Volumes/Attunely" ]; then
    cp -R "/Volumes/Attunely/Attunely.app" /Applications/
    hdiutil detach "/Volumes/Attunely" -quiet
    log "Done! Launch from /Applications/Attunely.app"
  else
    die "Could not mount DMG"
  fi
else
  curl -fsSL --progress-bar -o attunely "\$DOWNLOAD_URL" || die "Download failed"
  chmod +x attunely
  mkdir -p "\$HOME/.local/bin"
  mv attunely "\$HOME/.local/bin/attunely"
  mkdir -p "\$HOME/.local/share/applications"
  cat > "\$HOME/.local/share/applications/attunely.desktop" << 'DESKTOP'
[Desktop Entry]
Name=Attunely
Comment=Context-Aware Binaural Beats
Exec=\$HOME/.local/bin/attunely
Icon=attunely
Terminal=false
Type=Application
Categories=Audio;Utility;
DESKTOP
  log "Done! Run: attunely"
fi

echo ""
echo -e "  \${GREEN}✓ Attunely installed!\${NC}"
echo ""
`;

const INSTALL_PS1 = `# Attunely — Windows one-liner installer
param(\$Version = "latest")
\$ErrorActionPreference = "Stop"

Write-Host "==> Attunely Installer (Windows)" -ForegroundColor Green
if (-not [Environment]::Is64BitOperatingSystem) { Write-Error "64-bit Windows required"; exit 1 }
\$Arch = "x64"
Write-Host "Detected: Windows / \$Arch"

\$DownloadUrl = "https://api.tunesoar.com/releases/latest/windows/\$Arch"
\$TempDir = Join-Path \$env:TEMP "attunely-installer"
New-Item -ItemType Directory -Force -Path \$TempDir | Out-Null
\$InstallerPath = Join-Path \$TempDir "Attunely-Setup.exe"

Write-Host "Downloading..."
Invoke-WebRequest -Uri \$DownloadUrl -OutFile \$InstallerPath

Write-Host "Installing..."
Start-Process -FilePath \$InstallerPath -ArgumentList "/S" -Wait

Remove-Item -Recurse -Force \$TempDir -ErrorAction SilentlyContinue
Write-Host "✓ Attunely installed!" -ForegroundColor Green
`;

app.get("/install.sh", (c) => {
  return new Response(INSTALL_SH, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
});

app.get("/install.ps1", (c) => {
  return new Response(INSTALL_PS1, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
});

// ─────────────────────────────────────────────────────────────────────────
// Health check
// ─────────────────────────────────────────────────────────────────────────

app.get("/health", () => Response.json({ ok: true }));

// ─────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────

export default app;
