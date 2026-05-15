import { Hono } from "hono";
import { cors } from "hono/cors";
import { verifyToken } from "@clerk/backend";
import Stripe from "stripe";
import {
  HOME_PAGE, PRICING_PAGE, ACCOUNT_PAGE,
  PRIVACY_PAGE, TERMS_PAGE, SAFETY_PAGE, layout,
} from "./pages";

interface Env {
  DB: D1Database;
  RELEASES: R2Bucket;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  CLERK_SECRET_KEY: string;
  LICENSE_SECRET: string;
  STRIPE_MONTHLY_PRICE_ID: string;
  STRIPE_LIFETIME_PRICE_ID: string;
  GITHUB_TOKEN: string;
}

interface LicenseRow {
  id: string; user_id: string; email: string; plan: "monthly"|"lifetime";
  key: string; devices: string; created_at: number; expires_at: number|null; active: number;
}

const ALPH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", MAX_DEV = 3;
function genKey(): string { const a=new Uint8Array(24); crypto.getRandomValues(a); let k="AT-"; for(let i=0;i<24;i++)k+=ALPH[a[i]&31]; return k; }
function parseDevices(r: string|null|undefined): string[] { if(!r)return[]; try{const p=JSON.parse(r);return Array.isArray(p)?p:[]}catch{return[]} }
async function hashDevice(s: string, f: string): Promise<string> { const e=new TextEncoder(); const k=await crypto.subtle.importKey("raw",e.encode(s),{name:"HMAC",hash:"SHA-256"},false,["sign"]); const sig=await crypto.subtle.sign("HMAC",k,e.encode(f)); return Array.from(new Uint8Array(sig)).map(b=>b.toString(16).padStart(2,"0")).join(""); }
function jsonErr(m: string, s=400) { return Response.json({error:m},{status:s}); }
async function clerkAuth(env: Env, req: Request): Promise<{userId:string}|Response> {
  const h=req.headers.get("Authorization"); if(!h?.startsWith("Bearer ")) return jsonErr("Missing auth",401);
  try{const r=await verifyToken(h.slice(7),{secretKey:env.CLERK_SECRET_KEY}); const p=r.data as {sub?:string}|undefined; if("errors"in r||!p?.sub)return jsonErr("Invalid token",401); return {userId:p.sub};}
  catch{return jsonErr("Invalid token",401);}
}

const app = new Hono<{Bindings:Env}>();
app.use("*", cors());

// ── Payment & Licensing ──

app.post("/checkout", async(c) => {
  const env=c.env; const auth=await clerkAuth(env,c.req.raw); if(auth instanceof Response) return auth;
  let b:any; try{b=await c.req.json()}catch{return jsonErr("Invalid JSON")}
  if(b.plan!=="monthly"&&b.plan!=="lifetime") return jsonErr("plan must be monthly or lifetime");
  if(!b.success_url||!b.cancel_url) return jsonErr("success_url and cancel_url required");
  const pid=b.plan==="monthly"?env.STRIPE_MONTHLY_PRICE_ID:env.STRIPE_LIFETIME_PRICE_ID;
  if(!pid||pid==="CHANGEME") return jsonErr("Price ID not configured",500);
  const stripe=new Stripe(env.STRIPE_SECRET_KEY,{apiVersion:"2025-02-24.acacia",httpClient:Stripe.createFetchHttpClient()});
  try{const s=await stripe.checkout.sessions.create({mode:b.plan==="monthly"?"subscription":"payment",line_items:[{price:pid,quantity:1}],success_url:b.success_url,cancel_url:b.cancel_url,client_reference_id:auth.userId,metadata:{plan:b.plan,user_id:auth.userId}}); return Response.json({url:s.url});}
  catch(e:any){return jsonErr(e.message,500)}
});

app.post("/webhook", async(c) => {
  const env=c.env; const stripe=new Stripe(env.STRIPE_SECRET_KEY,{apiVersion:"2025-02-24.acacia",httpClient:Stripe.createFetchHttpClient()});
  const sig=c.req.header("stripe-signature"); if(!sig) return jsonErr("Missing signature",400);
  let ev:Stripe.Event; try{ev=await stripe.webhooks.constructEventAsync(await c.req.raw.text(),sig,env.STRIPE_WEBHOOK_SECRET)}catch{return jsonErr("Invalid signature",400)}
  if(ev.type==="checkout.session.completed"){const s=ev.data.object as Stripe.Checkout.Session; const m=s.metadata??{}; const plan=(m.plan as"monthly"|"lifetime")??"monthly"; const uid=m.user_id??"unknown"; const email=s.customer_details?.email??s.customer_email??"unknown"; const now=Math.floor(Date.now()/1e3); const exp=plan==="lifetime"?null:now+30*86400; const key=genKey(); await env.DB.prepare("INSERT INTO licenses(id,user_id,email,plan,key,devices,created_at,expires_at,active)VALUES(?,?,?,?,?,'[]',?,?,1)").bind(crypto.randomUUID(),uid,email,plan,key,now,exp).run();}
  if(ev.type==="customer.subscription.deleted"){const sub=ev.data.object as Stripe.Subscription; await env.DB.prepare("UPDATE licenses SET active=0 WHERE user_id=? AND plan='monthly' AND active=1").bind((sub.customer as string)??"unknown").run();}
  return Response.json({received:true});
});

app.post("/verify-license", async(c) => {
  const env=c.env; let b:any; try{b=await c.req.json()}catch{return jsonErr("Invalid JSON")}
  if(!b.key||!b.device_id) return jsonErr("key and device_id required");
  const nk=b.key.trim().toUpperCase();
  const row=await env.DB.prepare("SELECT * FROM licenses WHERE key=? LIMIT 1").bind(nk).first<LicenseRow>();
  if(!row) return Response.json({valid:false,reason:"license_not_found"});
  if(row.active!==1) return Response.json({valid:false,reason:"license_inactive"});
  if(row.expires_at&&Math.floor(Date.now()/1e3)>row.expires_at) return Response.json({valid:false,reason:"license_expired"});
  const devs=parseDevices(row.devices), dh=await hashDevice(env.LICENSE_SECRET,b.device_id);
  if(!devs.includes(dh)){if(devs.length>=MAX_DEV)return Response.json({valid:false,reason:"device_limit_reached",devices:devs.length,max:MAX_DEV});devs.push(dh);await env.DB.prepare("UPDATE licenses SET devices=? WHERE id=?").bind(JSON.stringify(devs),row.id).run();}
  return Response.json({valid:true,plan:row.plan,email:row.email,devices:devs.length,max_devices:MAX_DEV,expires_at:row.expires_at,created_at:row.created_at});
});

app.post("/deactivate", async(c) => {
  const env=c.env; const auth=await clerkAuth(env,c.req.raw); if(auth instanceof Response) return auth;
  let b:any; try{b=await c.req.json()}catch{return jsonErr("Invalid JSON")}
  if(!b.key||!b.device_id) return jsonErr("key and device_id required");
  const nk=b.key.trim().toUpperCase();
  const row=await env.DB.prepare("SELECT * FROM licenses WHERE key=? LIMIT 1").bind(nk).first<LicenseRow>();
  if(!row) return jsonErr("License not found",404);
  if(row.user_id!==auth.userId) return jsonErr("Not your license",403);
  const devs=parseDevices(row.devices); const dh=await hashDevice(env.LICENSE_SECRET,b.device_id);
  const nd=devs.filter(d=>d!==dh); if(nd.length===devs.length) return jsonErr("Device not found",404);
  await env.DB.prepare("UPDATE licenses SET devices=? WHERE id=?").bind(JSON.stringify(nd),row.id).run();
  return Response.json({success:true,devices_remaining:nd.length});
});

// ── Release CDN (R2-backed) ──

async function fileName(releases: R2Bucket, platform:string, arch:string): Promise<string|null> {
  // Dynamically look up the latest asset for this platform/arch from R2
  const latestObj = await releases.get('latest.json');
  if (!latestObj) return null;
  const latest = JSON.parse(await latestObj.text()) as any;
  const version = (latest.version || '0.1.2').replace(/^v/, '');

  const patterns: Record<string, RegExp> = {
    'windows-x64': new RegExp(`_${version.replace(/\./g, '\\.')}.*-setup\\.exe$`, 'i'),
    'macos-x64': new RegExp(`_${version.replace(/\./g, '\\.')}_x64\\.dmg$`, 'i'),
    'macos-arm64': new RegExp(`_${version.replace(/\./g, '\\.')}_aarch64\\.dmg$`, 'i'),
    'linux-x64': new RegExp(`_${version.replace(/\./g, '\\.')}.*\\.AppImage$`, 'i'),
  };
  const pat = patterns[`${platform}-${arch}`];
  if (!pat) return null;

  const list = await releases.list();
  for (const obj of list.objects) {
    if (pat.test(obj.key)) return obj.key;
  }
  return null;
}

// ── Server-rendered Download Page ──

async function renderDownloadPage(releases: R2Bucket): Promise<string> {
  try {
    const latestObj = await releases.get('latest.json');
    let version = '0.1.2';
    if (latestObj) {
      const latest = JSON.parse(await latestObj.text()) as any;
      version = (latest.version || '0.1.2');
    }

    const list = await releases.list();
    const groups: Record<string, string[]> = { 'macOS': [], 'Windows': [], 'Linux': [], 'Other': [] };

    // Build a regex to match only the latest version's files
    const verClean = version.replace(/^v/, '');
    const verPattern = new RegExp(`[-_]${verClean.replace(/\./g, '\\.')}[-_.]`);

    for (const obj of list.objects) {
      const name = obj.key;
      // Skip manifest, sigs, and files that don't match the current version
      if (name === 'latest.json' || name.endsWith('.sig')) continue;
      if (!verPattern.test(name) && !name.includes('.app.tar.gz')) continue;
      // For .app.tar.gz files (no version in name), only include if no versioned dmg exists
      if (name.endsWith('.app.tar.gz')) {
        const base = name.replace(/\.app\.tar\.gz$/, '');
        // Check if there's a versioned dmg for this arch — if so, skip the tar.gz
        const hasDmg = list.objects.some(o => o.key !== name && o.key.includes(base) && o.key.endsWith('.dmg'));
        if (hasDmg) continue;
      }
      const url = 'https://tunesoar.com/releases/download/' + encodeURIComponent(name);
      const mb = (obj.size / 1024 / 1024).toFixed(1);
      const item = '<a href="' + url + '" class="dl-item"><span class="dl-name">' + name + '</span><span class="dl-size">' + mb + ' MB</span></a>';

      if (/\.dmg$|\.app\.tar\.gz$/.test(name)) groups['macOS'].push(item);
      else if (/\.exe$|\.msi$/i.test(name)) groups['Windows'].push(item);
      else if (/\.deb$|\.AppImage$|\.rpm$/i.test(name)) groups['Linux'].push(item);
      else groups['Other'].push(item);
    }

    let cardsHtml = '<div class="dl-grid">';
    const labels: Record<string,string> = { 'macOS': '🍎 macOS', 'Windows': '🪟 Windows', 'Linux': '🐧 Linux', 'Other': '📦 Other' };
    for (const [os, items] of Object.entries(groups)) {
      if (items.length === 0) continue;
      cardsHtml += '<div class="card"><h3>' + labels[os] + '</h3>' + items.join('') + '</div>';
    }
    cardsHtml += '</div>';

    const body = `
<div class="hero">
<h1>Download TuneSoar v${version}</h1>
<p>All downloads served via Cloudflare CDN.</p>
</div>
${cardsHtml}
<p class="dl-note">macOS builds are ad-hoc signed. Right-click Open on first launch.</p>
<div class="install-section">
<h2>One-liner install</h2>
<p>Paste into your terminal:</p>
<div class="code-block">
<pre><code>curl -fsSL https://tunesoar.com/install.sh | bash</code></pre>
<button class="btn ghost btn-copy" onclick="copyCode(this,'curl -fsSL https://tunesoar.com/install.sh | bash')">📋 Copy</button>
</div>
<p style="font-size:.78rem;margin:12px 0 8px">or on Windows PowerShell:</p>
<div class="code-block">
<pre><code>irm https://tunesoar.com/install.ps1 | iex</code></pre>
<button class="btn ghost btn-copy" onclick="copyCode(this,'irm https://tunesoar.com/install.ps1 | iex')">📋 Copy</button>
</div>
</div>
<p style="text-align:center;margin-top:32px"><a href="https://github.com/Donald8585/tunesoar/releases/latest" class="btn ghost">View on GitHub Releases</a></p>
<script>
function copyCode(btn,text){navigator.clipboard.writeText(text).then(function(){btn.textContent='✓ Copied!';setTimeout(function(){btn.textContent='📋 Copy'},2000)}).catch(function(){btn.textContent='⚠ Failed';setTimeout(function(){btn.textContent='📋 Copy'},2000)})}
<\/script>`;

    return layout("Download", body, "/downloads");
  } catch (e: any) {
    console.error('renderDownloadPage error:', e?.message || e, e?.stack || '');
    return layout("Download", `
<div class="hero">
<h1>Download TuneSoar</h1>
<p>Unable to load releases. Try again shortly.</p>
<p style="font-size:10px;color:#555">Error: ${String(e?.message || e).replace(/</g,'&lt;')}</p>
<a href="https://github.com/Donald8585/tunesoar/releases/latest" class="btn primary" style="margin-top:16px">View on GitHub Releases</a>
</div>`, "/downloads");
  }
}

// ─── attachmentHeader() — SINGLE SOURCE OF TRUTH ────────────────────
//
// POST-MORTEM (2026-05-15):
//   "${fn}" appeared as literal filename on downloaded binaries.
//
// ROOT CAUSE:
//   Three code paths emitted Content-Disposition or download URLs.
//   The first fix only addressed lines 221 & 235 (download routes).
//   Line 256 (updater manifest URL) used
//     `https://${host}/releases/download/\${fn}`
//   where \${fn} was an ESCAPED template literal producing the
//   literal string "${fn}" instead of interpolating the filename.
//   This caused the Tauri updater to download files named "${fn}".
//
// WHY PRIOR FIX MISSED IT:
//   Single-emitter assumption — we tested latest.json and binary
//   downloads but not the updater manifest endpoint. The updater
//   path was a separate emitter that constructed URLs differently.
//
// NEW INVARIANT:
//   1. ONLY this function emits Content-Disposition headers.
//   2. Download URLs in manifests are interpolated at generation
//      time, never at runtime (the GitHub release asset filename
//      is the single source).
//   3. CI guards (grep + curl smoke test) ban \${fn} literals.
//
// BANNED PATTERNS (enforced by CI):
//   - Hand-rolled 'Content-Disposition' outside this helper
//   - Escaped \${...} in template literals producing literal "${...}"
//
function attachmentHeader(fn: string): string {
  const safe = fn.replace(/[^\w.\-]/g, "_");
  const utf8 = encodeURIComponent(fn);
  return `attachment; filename="${safe}"; filename*=UTF-8''${utf8}`;
}

function contentType(fn:string): string {
  if(fn.endsWith(".exe")) return "application/vnd.microsoft.portable-executable";
  if(fn.endsWith(".msi")) return "application/x-msi";
  if(fn.endsWith(".dmg")) return "application/x-apple-diskimage";
  if(fn.endsWith(".deb")) return "application/vnd.debian.binary-package";
  if(fn.endsWith(".AppImage")) return "application/octet-stream";
  if(fn.endsWith(".rpm")) return "application/x-rpm";
  if(fn.endsWith(".tar.gz")) return "application/gzip";
  return "application/octet-stream";
}

app.get("/releases/download/:filename", async(c) => {
  const fn=c.req.param("filename");
  const obj=await c.env.RELEASES.get(fn);
  if(!obj) return c.notFound();
  const headers=new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("Content-Type",contentType(fn));
  headers.set("Cache-Control","public, max-age=3600");
  headers.set("Content-Disposition",attachmentHeader(fn));
  return new Response(obj.body,{headers});
});

app.get("/releases/latest/:platform/:arch", async(c) => {
  const platform=c.req.param("platform"), arch=c.req.param("arch");
  const fn=await fileName(c.env.RELEASES, platform, arch);
  if(!fn) return Response.json({error:"Unsupported platform",platform,arch},{status:404});
  const obj=await c.env.RELEASES.get(fn);
  if(!obj) return Response.json({error:"Asset not found"},{status:404});
  const headers=new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("Content-Type",contentType(fn));
  headers.set("Cache-Control","public, max-age=3600");
  headers.set("Content-Disposition",attachmentHeader(fn));
  return new Response(obj.body,{headers});
});

app.get("/releases/updater/:target/:arch/:current_version", async(c) => {
  const cv=c.req.param("current_version");
  const nocache=c.req.query("nocache")==="1";
  const manifestObj=await c.env.RELEASES.get("latest.json");
  if(!manifestObj) return Response.json({error:"No manifest"},{status:502});

  const manifest:any=await manifestObj.json();
  const lv=(manifest.version??"0.0.0").replace(/^v/,"");
  if(lv===cv.replace(/^v/,"")) return Response.json({status:"no-update"},
    {status:204,headers:{"Cache-Control":"no-store"}});

  // Rewrite download URLs to point to Cloudflare CDN
  const host=c.req.header("host")??"tunesoar.com";
  const rewritten:any={...manifest};
  if(rewritten.platforms) {
    for(const key of Object.keys(rewritten.platforms)) {
      const url=rewritten.platforms[key].url;
      if(url) {
        const fn=url.split("/").pop();
        rewritten.platforms[key].url=`https://${host}/releases/download/${fn}`;
      }
    }
  }
  // Never cache updater manifest — it's dynamic per-request (host header)
  const headers=new Headers();
  headers.set("Cache-Control","no-store, max-age=0, must-revalidate");
  headers.set("Content-Type","application/json");
  return new Response(JSON.stringify(rewritten),{headers});
});

// ── Diagnostic: debug manifest info ──
app.get("/debug/manifest", async(c) => {
  const manifestObj=await c.env.RELEASES.get("latest.json");
  if(!manifestObj) return Response.json({error:"No manifest"},{status:502});
  const manifest:any=await manifestObj.json();
  const host=c.req.header("host")??"tunesoar.com";
  const resolved:any[]=[];
  if(manifest.platforms) {
    for(const key of Object.keys(manifest.platforms)) {
      const ghUrl=manifest.platforms[key].url??"";
      const fn=ghUrl.split("/").pop()??"";
      resolved.push({
        platform:key,
        filename:fn,
        ghUrl,
        cdnUrl:`https://${host}/releases/download/${fn}`,
        hasTemplateLiteral: fn.includes("${"),
      });
    }
  }
  return Response.json({
    version:manifest.version,
    pubDate:manifest.pub_date,
    platformCount:resolved.length,
    anyTemplateLiterals:resolved.some((r:any)=>r.hasTemplateLiteral),
    cfRay:c.req.header("cf-ray")??"unknown",
    cacheControl:"updater:no-store | assets:public,max-age=3600",
    platforms:resolved,
  });
});

// ── Support: explain \${fn} download bug ──
app.get("/support/update-fix", (c) => new Response(`<!doctype html>
<html lang="en">
<head><meta charset="UTF-8"/><title>TuneSoar Support</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#0a0a0f;color:#e4e4ec;max-width:640px;margin:40px auto;padding:20px;line-height:1.6}
h1{color:#a78bfa}code{background:#1a1a28;padding:2px 6px;border-radius:4px;font-size:.9em}.box{background:#12121a;border:1px solid #2a2a3a;border-radius:12px;padding:20px;margin:16px 0}a{color:#60a5fa}</style></head>
<body>
<h1>Update file named \${fn}?</h1>
<div class="box">
<p>If your TuneSoar auto-update downloads a file literally named <code>\${fn}</code>, you're running an old version of the app that had a filename template bug.</p>
<p><b>Quick fix:</b></p>
<ol>
<li>Download the latest installer manually:<br>
  <a href="/downloads">tunesoar.com/downloads</a></li>
<li>Install it over your current version (no uninstall needed)</li>
<li>Future auto-updates will name files correctly</li>
</ol>
<p>This was a server-side template literal bug (fixed in v0.2.11+). The installed app was serving stale template URLs. One manual reinstall resolves it permanently.</p>
<p>Still stuck? <a href="mailto:alfredso@wealthmakermasterclass.com">Email support</a></p>
</div>
<p style="font-size:.8rem;color:#555">Server version: v0.2.12 | All updater manifest URLs verified clean</p>
</body></html>`,{headers:{"Content-Type":"text/html; charset=utf-8"}}));

// ── Site Pages ──

app.get("/", (c) => new Response(HOME_PAGE, { headers: { "Content-Type": "text/html; charset=utf-8" } }));
app.get("/pricing", (c) => new Response(PRICING_PAGE, { headers: { "Content-Type": "text/html; charset=utf-8" } }));
app.get("/account", (c) => new Response(ACCOUNT_PAGE, { headers: { "Content-Type": "text/html; charset=utf-8" } }));
app.get("/privacy", (c) => new Response(PRIVACY_PAGE, { headers: { "Content-Type": "text/html; charset=utf-8" } }));
app.get("/terms", (c) => new Response(TERMS_PAGE, { headers: { "Content-Type": "text/html; charset=utf-8" } }));
app.get("/safety", (c) => new Response(SAFETY_PAGE, { headers: { "Content-Type": "text/html; charset=utf-8" } }));
app.get("/downloads", async(c) => {
  const body = await renderDownloadPage(c.env.RELEASES);
  return new Response(body, { headers: { "Content-Type": "text/html; charset=utf-8" } });
});

// ── Install Scripts ──

const INSTALL_SH=`#!/usr/bin/env bash
set -euo pipefail
BOLD=\"\\\\033[1m\";GREEN=\"\\\\033[0;32m\";RED=\"\\\\033[0;31m\";NC=\"\\\\033[0m\"
log(){echo -e \"\${GREEN}==>\${NC} \${BOLD}$*\${NC}\";};die(){echo -e \"\${RED}✗\${NC}  $*\">&2;exit 1;}
OS=$(uname -s);ARCH=$(uname -m)
case \"$OS\" in Darwin)P=\"macos\";;Linux)P=\"linux\";;*)die \"Unsupported OS\";;esac
case \"$ARCH\" in x86_64|amd64)A=\"x64\";;arm64|aarch64)A=\"arm64\";;*)die \"Unsupported arch\";;esac
U=\"https://tunesoar.com/releases/latest/\${P}/\${A}\"
log \"Detected: $P / $A\";log \"Downloading TuneSoar...\"
T=$(mktemp -d);trap 'rm -rf \"$T\"' EXIT;cd \"$T\"
if [ \"$P\" = \"macos\" ];then
  curl -fsSL -o TuneSoar.dmg \"$U\"||die \"Download failed\"
  hdiutil attach TuneSoar.dmg -nobrowse -quiet
  cp -R \"/Volumes/TuneSoar/TuneSoar.app\" /Applications/
  hdiutil detach \"/Volumes/TuneSoar\" -quiet
  log \"Done! Launch from /Applications/TuneSoar.app\"
else
  curl -fsSL -o tunesoar \"$U\"||die \"Download failed\"
  chmod +x tunesoar;mkdir -p \"$HOME/.local/bin\"
  mv tunesoar \"$HOME/.local/bin/tunesoar\"
  mkdir -p \"$HOME/.local/share/applications\"
  printf '[Desktop Entry]\\\\nName=TuneSoar\\\\nComment=Context-Aware Binaural Beats\\\\nExec=%s/.local/bin/tunesoar\\\\nIcon=tunesoar\\\\nTerminal=false\\\\nType=Application\\\\nCategories=Audio;Utility;\\\\n' \"$HOME\">\"$HOME/.local/share/applications/tunesoar.desktop\"
  log \"Done! Run: tunesoar\"
fi
echo\"\";echo -e \"  \${GREEN}✓ TuneSoar installed!\${NC}\";echo`;

const INSTALL_PS1=`# TuneSoar one-liner (Windows)
param($Version=\"latest\");$ErrorActionPreference=\"Stop\"
Write-Host\"==> TuneSoar Installer (Windows)\"-ForegroundColor Green
if(-not[Environment]::Is64BitOperatingSystem){Write-Error\"64-bit required\";exit 1}
Write-Host\"Detected: Windows/x64\"
$U=\"https://tunesoar.com/releases/latest/windows/x64\"
$T=Join-Path $env:TEMP\"tunesoar-install\";New-Item -Type Directory -Force -Path $T|Out-Null
$I=Join-Path $T\"TuneSoar-Setup.exe\"
Write-Host\"Downloading...\";Invoke-WebRequest -Uri $U -OutFile $I
Write-Host\"Installing...\";Start-Process -FilePath $I -ArgumentList\"/S\" -Wait
Remove-Item -Recurse -Force $T -ErrorAction SilentlyContinue
Write-Host\"✓ TuneSoar installed!\"-ForegroundColor Green`;

// ── Desktop Auth Flow (Path C) — fully inline ──
let authReqCounter = 0;
function b64url(buf: Uint8Array): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let s = "";
  for (let i = 0; i < buf.length; i += 3) {
    const b0 = buf[i], b1 = i + 1 < buf.length ? buf[i + 1] : 0, b2 = i + 2 < buf.length ? buf[i + 2] : 0;
    s += chars[b0 >> 2] + chars[((b0 & 3) << 4) | (b1 >> 4)];
    if (i + 1 < buf.length) s += chars[((b1 & 15) << 2) | (b2 >> 6)];
    if (i + 2 < buf.length) s += chars[b2 & 63];
  }
  return s;
}

const DESKTOP_AUTH_PAGE = `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Sign In — TuneSoar Desktop</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0a0a0f;color:#e4e4ec;min-height:100vh;display:flex;align-items:center;justify-content:center}
.card{background:#12121a;border:1px solid #2a2a3a;border-radius:16px;padding:40px;max-width:420px;width:100%;text-align:center;margin:16px}
h1{font-size:1.5rem;margin-bottom:8px;background:linear-gradient(135deg,#a78bfa,#60a5fa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
p{color:#8a8a9a;font-size:.9rem;margin-bottom:24px}
.btn{display:inline-flex;align-items:center;gap:8px;padding:12px 28px;border-radius:10px;font-size:.95rem;font-weight:600;text-decoration:none;transition:all .15s;cursor:pointer;border:1px solid #2a2a3a;background:#12121a;color:#c4c4d4;margin:6px}
.btn:hover{background:#1a1a28;border-color:#4747ff;color:#fff}
.btn.primary{background:linear-gradient(135deg,#6b21ff,#4747ff);border-color:transparent;color:#fff}.btn.primary:hover{opacity:.85}
.spinner{display:inline-block;width:20px;height:20px;border:2px solid #2a2a3a;border-top-color:#6b21ff;border-radius:50%;animation:spin .6s linear infinite;margin-right:8px}
@keyframes spin{to{transform:rotate(360deg)}}
.msg{display:none;padding:12px;border-radius:8px;font-size:.85rem;margin-bottom:16px}
.msg.error{background:#2d1111;border:1px solid #5c1a1a;color:#f87171}
.msg.success{background:#0d2818;border:1px solid #1a5c2a;color:#4ade80}
.footer{font-size:.75rem;color:#555;margin-top:24px}
</style>
<script async crossorigin src="https://cdn.jsdelivr.net/npm/@clerk/clerk-js@latest/dist/clerk.browser.js" data-clerk-publishable-key="pk_live_Y2xlcmsudHVuZXNvYXIuY29tJA"></script></head>
<body><div class="card">
<svg width="48" height="48" viewBox="0 0 128 128" style="margin:0 auto 16px"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#8b5cf6"/><stop offset="100%" stop-color="#3b82f6"/></linearGradient></defs><rect x="18" y="46" width="8" height="36" rx="4" fill="url(#g)" opacity=".7"/><rect x="32" y="32" width="8" height="64" rx="4" fill="url(#g)"/><rect x="46" y="22" width="8" height="84" rx="4" fill="url(#g)"/><circle cx="72" cy="64" r="22" fill="url(#g)"/><circle cx="72" cy="64" r="10" fill="#fff" opacity=".9"/><rect x="104" y="22" width="8" height="84" rx="4" fill="url(#g)"/><rect x="118" y="32" width="8" height="64" rx="4" fill="url(#g)" opacity=".7"/></svg>
<h1>Sign in to TuneSoar</h1>
<p>You'll be redirected back to the desktop app after signing in.</p>
<div id="error" class="msg error"></div><div id="success" class="msg success"></div>
<div id="content"><div style="padding:20px"><span class="spinner"></span> Loading…</div></div>
<div class="footer">Wealth Maker Masterclass Limited</div>
</div>
<script>(function(){
var state=__STATE__,returnUrl=__RETURN_URL__,desktopPort=__PORT__,sentRef=false;
function show(el,s){var e=document.getElementById(el);if(e){e.style.display=s||"block"}}
function setHtml(id,h){var e=document.getElementById(id);if(e)e.innerHTML=h}
function showButtons(){
if(!window.Clerk)return;
if(window.Clerk.session&&!sentRef){sentRef=true;setHtml("content",'<div style="padding:20px"><span class="spinner"></span> Exchanging session…</div>');exchangeToken();return}
if(window.Clerk.session)return;
var si=window.Clerk.buildSignInUrl({redirectUrl:returnUrl}),su=window.Clerk.buildSignUpUrl({redirectUrl:returnUrl});
setHtml("content",'<a href="'+si+'" class="btn primary">Sign In with Browser</a><a href="'+su+'" class="btn">Create Account</a>')}
async function exchangeToken(){
try{
if(!window.Clerk||!window.Clerk.session){show("error");setHtml("error","No session found.");sentRef=false;showButtons();return}
var sid=window.Clerk.session.id;
console.log("[desktop-auth] POST sessionId="+sid.slice(0,14)+"... state="+state.slice(0,8)+"...");
var resp=await fetch("/auth/desktop/token",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:sid,state:state})});
var data=await resp.json();console.log("[desktop-auth] server response",resp.status,data);
if(!data.token){show("error");setHtml("error",(data.reason||data.error||"Failed")+(data.requestId?" ["+data.requestId+"]":""));return}
// Loopback delivery: fetch the token directly to the desktop app's local HTTP server
if(!desktopPort){show("error");setHtml("error","No desktop port — please restart sign-in from the app");return}
var callbackUrl="http://127.0.0.1:"+desktopPort+"/callback?token="+encodeURIComponent(data.token)+"&state="+encodeURIComponent(state);
console.log("[desktop-auth] delivering to loopback: "+callbackUrl.slice(0,80)+"...");
show("success");setHtml("success","Signed in! Sending to app…");
setHtml("content",'<div style="padding:20px"><span class="spinner"></span> Connecting to desktop app…</div>');
try{
var cbResp=await fetch(callbackUrl,{mode:"cors"});
if(cbResp.ok){
show("success");setHtml("success","Signed in! You can close this tab.");
setHtml("content","<p style=\"color:#8a8a9a;font-size:.85rem\">✓ Token delivered to the desktop app.</p>");
console.log("[desktop-auth] loopback delivery OK");
}else{
var cbData=await cbResp.json().catch(function(){return{}});
console.error("[desktop-auth] loopback returned "+cbResp.status,cbData);
showFallback(data.token,"App rejected the token ("+cbResp.status+"): "+(cbData.error||"unknown"))}
}catch(e){
console.error("[desktop-auth] loopback fetch failed:",e.message||e);
showFallback(data.token,"Couldn&rsquo;t reach the desktop app. Is TuneSoar running?");
}}
catch(e){show("error");setHtml("error","Connection error");sentRef=false;showButtons()}}
function showFallback(token,msg){
show("error");setHtml("success","");
setHtml("content","");
var html='<p style=\"margin-bottom:12px\">'+msg+'</p>';
html+='<p style=\"font-size:.8rem;margin-bottom:8px\"><b>Manual recovery:</b> Copy the token below, then paste it into <b>Account → Sign In → Enter Token</b> in the desktop app.</p>';
html+='<textarea style=\"width:100%;height:60px;margin-top:4px;background:#0a0a0f;color:#4ade80;border:1px solid #1a5c2a;border-radius:8px;padding:8px;font-size:11px;font-family:monospace;resize:none\" readonly>'+token+'</textarea>';
html+='<button class=\"btn primary\" style=\"margin-top:8px\" onclick=\"navigator.clipboard.writeText(this.previousElementSibling.value).then(function(){this.textContent=&rsquo;✓ Copied!&rsquo;;setTimeout(function(){this.textContent=&rsquo;📋 Copy Token&rsquo;}.bind(this),2000)}.bind(this))\">📋 Copy Token</button>';
setHtml("error",html)}
function waitForClerk(){var a=0,iv=setInterval(function(){a++;if(window.Clerk){clearInterval(iv);window.Clerk.load().then(showButtons).catch(function(e){show("error");setHtml("error","Sign-in unavailable: "+(e.message||"unknown"))})}else if(a>100){clearInterval(iv);show("error");setHtml("error","Sign-in unavailable. Check connection.")}},200)}
if(window.Clerk){window.Clerk.load().then(showButtons).catch(function(){waitForClerk()})}else{waitForClerk()}
})();</script></body></html>`;

// ── GET /auth/desktop ──
app.get("/auth/desktop", (c) => {
  const state = c.req.query("state") || "";
  const port = c.req.query("port") || "";
  const returnUrl = `https://tunesoar.com/auth/desktop?state=${encodeURIComponent(state)}&port=${encodeURIComponent(port)}`;
  // Validate port is a number in the ephemeral range
  const portNum = parseInt(port, 10);
  const portStr = (portNum >= 1024 && portNum <= 65535) ? String(portNum) : "null";
  return new Response(
    DESKTOP_AUTH_PAGE
      .replace("__STATE__", JSON.stringify(state))
      .replace("__RETURN_URL__", JSON.stringify(returnUrl))
      .replace("__PORT__", portStr),
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
});

// ── POST /auth/desktop/token ──
app.post("/auth/desktop/token", async (c) => {
  const env = c.env as any;
  const reqId = String(++authReqCounter);
  let body: any;
  try { body = await c.req.json(); } catch {
    return Response.json({ error: "Invalid JSON", reason: "invalid_json", requestId: reqId }, { status: 400 });
  }
  const sessionId: string | undefined = body?.sessionId;
  const state: string | undefined = body?.state;
  if (!sessionId || typeof sessionId !== "string" || !sessionId.startsWith("sess_")) {
    return Response.json({ error: "Missing or invalid sessionId", reason: "missing_session_id", requestId: reqId }, { status: 400 });
  }
  if (!state || typeof state !== "string" || state.length < 8 || !/^[0-9a-f]+$/.test(state)) {
    return Response.json({ error: "Missing or invalid state", reason: "invalid_state", requestId: reqId }, { status: 400 });
  }
  const sidPrefix = sessionId.slice(0, 16), statePrefix = state.slice(0, 8);
  console.log(`[desktop-auth] req=${reqId} state=${statePrefix}… sid=${sidPrefix}…`);
  const t0 = Date.now();
  let session: any;
  try {
    const res = await fetch(`https://api.clerk.com/v1/sessions/${encodeURIComponent(sessionId)}`, {
      headers: { Authorization: `Bearer ${env.CLERK_SECRET_KEY}` },
    });
    const clerkMs = Date.now() - t0;
    if (!res.ok) {
      console.error(`[desktop-auth] req=${reqId} clerk_session status=${res.status} ms=${clerkMs}`);
      if (res.status === 404) return Response.json({ error: "Session not found", reason: "session_not_found", requestId: reqId, clerk_ms: clerkMs }, { status: 401 });
      if (res.status >= 500) return Response.json({ error: "Clerk API unavailable", reason: "clerk_unreachable", requestId: reqId, clerk_ms: clerkMs }, { status: 502 });
      return Response.json({ error: "Session lookup failed", reason: "clerk_error", clerk_status: res.status, requestId: reqId, clerk_ms: clerkMs }, { status: 401 });
    }
    session = await res.json() as any;
    console.log(`[desktop-auth] req=${reqId} clerk_session 200 ok ms=${clerkMs}`);
  } catch (e: any) {
    console.error(`[desktop-auth] req=${reqId} clerk_fetch_error:`, e?.message || e);
    return Response.json({ error: "Clerk API unreachable", reason: "clerk_unreachable", requestId: reqId }, { status: 502 });
  }
  if (session.status !== "active" || !session.user_id) {
    return Response.json({ error: "Session is not active", reason: "session_inactive", requestId: reqId }, { status: 401 });
  }
  let user: any;
  try {
    const userRes = await fetch(`https://api.clerk.com/v1/users/${session.user_id}`, {
      headers: { Authorization: `Bearer ${env.CLERK_SECRET_KEY}` },
    });
    if (!userRes.ok) {
      console.error(`[desktop-auth] req=${reqId} clerk_user status=${userRes.status}`);
      return Response.json({ error: "User lookup failed", reason: "user_lookup_failed", requestId: reqId }, { status: 502 });
    }
    user = await userRes.json() as any;
  } catch (e: any) {
    return Response.json({ error: "User lookup error", reason: "clerk_unreachable", requestId: reqId }, { status: 502 });
  }
  const emails = user.email_addresses || [];
  const primary = emails.find((e: any) => e.id === user.primary_email_address_id);
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || "User";
  const email = primary?.email_address || "";
  const now = Math.floor(Date.now() / 1000);
  const payload = JSON.stringify({ sub: user.id, email, name, iat: now, exp: now + 86400, state });
  const header = JSON.stringify({ alg: "HS256", typ: "JWT" });
  try {
    const enc = new TextEncoder();
    const hb = enc.encode(header), pb = enc.encode(payload);
    const input = b64url(hb) + "." + b64url(pb);
    const key = await crypto.subtle.importKey("raw", enc.encode(env.LICENSE_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(input));
    const token = input + "." + b64url(new Uint8Array(sig));
    console.log(`[desktop-auth] req=${reqId} success user=${user.id.slice(0,8)}…`);
    return Response.json({ token });
  } catch (e: any) {
    console.error(`[desktop-auth] req=${reqId} sign_error:`, e?.message || e);
    return Response.json({ error: "Token signing failed", reason: "desktop_jwt_sign_failed", requestId: reqId }, { status: 500 });
  }
});

app.get("/health", () => Response.json({ ok: true }));
export default app;
