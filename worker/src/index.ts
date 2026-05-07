import { Hono } from "hono";
import { cors } from "hono/cors";
import { verifyToken } from "@clerk/backend";
import Stripe from "stripe";
import {
  HOME_PAGE, PRICING_PAGE, ACCOUNT_PAGE,
  PRIVACY_PAGE, TERMS_PAGE, SAFETY_PAGE,
} from "./pages";

interface Env {
  DB: D1Database;
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

// ── Release CDN ──

const REPO_OWNER="Donald8585", REPO_NAME="tunesoar";

function assetPat(platform:string, arch:string): RegExp {
  const m:Record<string,RegExp>={"windows-x64":/TuneSoar_.*_x64-setup\.exe$/,"macos-x64":/TuneSoar_.*_x64\.dmg$/,"macos-arm64":/TuneSoar_.*_aarch64\.dmg$/,"linux-x64":/[Tt]unesoar_.*_amd64\.AppImage$/,"linux-arm64":/[Tt]unesoar_.*_arm64\.AppImage$/};
  return m[`${platform}-${arch}`]??/./;
}

app.get("/releases/latest/:platform/:arch", async(c) => {
  const platform=c.req.param("platform"), arch=c.req.param("arch");
  const r=await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`,{headers:{Authorization:`Bearer ${c.env.GITHUB_TOKEN}`,"User-Agent":"tunesoar-worker",Accept:"application/vnd.github.v3+json"}});
  if(!r.ok) return Response.json({error:"Failed to fetch release"},{status:502});
  const release:any=await r.json(); const asset=release.assets?.find((a:any)=>assetPat(platform,arch).test(a.name));
  if(!asset) return Response.json({error:"No matching asset",platform,arch},{status:404});
  const dl=await fetch(asset.url,{headers:{Authorization:`Bearer ${c.env.GITHUB_TOKEN}`,"User-Agent":"tunesoar-worker",Accept:"application/octet-stream"},redirect:"follow"});
  if(!dl.ok) return Response.json({error:"Download failed"},{status:502});
  return new Response(dl.body,{status:200,headers:{"Content-Type":dl.headers.get("Content-Type")??"application/octet-stream","Content-Disposition":`attachment; filename="${asset.name}"`,"Content-Length":dl.headers.get("Content-Length")??asset.size?.toString()??"0","Cache-Control":"public, max-age=3600"}});
});

app.get("/releases/updater/:target/:arch/:current_version", async(c) => {
  const target=c.req.param("target"), arch=c.req.param("arch"), cv=c.req.param("current_version");
  const r=await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`,{headers:{Authorization:`Bearer ${c.env.GITHUB_TOKEN}`,"User-Agent":"tunesoar-updater",Accept:"application/vnd.github.v3+json"}});
  if(!r.ok) return Response.json({error:"Failed to fetch release"},{status:502});
  const release:any=await r.json(); const lv=(release.tag_name??"v0.0.0").replace(/^v/,"");
  if(lv===cv.replace(/^v/,"")) return new Response(null,{status:204});
  const sp=new RegExp(`TuneSoar_.*_${arch}.*\\.(exe\\.zip\\.sig|app\\.tar\\.gz\\.sig|AppImage\\.tar\\.gz\\.sig)$`,"i");
  const sa=release.assets?.find((a:any)=>sp.test(a.name)); if(!sa) return new Response(null,{status:204});
  const sr=await fetch(sa.url,{headers:{Authorization:`Bearer ${c.env.GITHUB_TOKEN}`,"User-Agent":"tunesoar-updater",Accept:"application/octet-stream"}});
  const sig=await sr.text(); const host=c.req.header("host")??"tunesoar.com";
  return Response.json({version:`v${lv}`,notes:release.body??"",pub_date:release.published_at??new Date().toISOString(),platforms:{[target]:{signature:sig,url:`https://${host}/releases/latest/${target==="darwin"?"macos":target}/${arch}`}}});
});

// ── Site Pages ──

app.get("/", (c) => new Response(HOME_PAGE, { headers: { "Content-Type": "text/html; charset=utf-8" } }));
app.get("/pricing", (c) => new Response(PRICING_PAGE, { headers: { "Content-Type": "text/html; charset=utf-8" } }));
app.get("/account", (c) => new Response(ACCOUNT_PAGE, { headers: { "Content-Type": "text/html; charset=utf-8" } }));
app.get("/privacy", (c) => new Response(PRIVACY_PAGE, { headers: { "Content-Type": "text/html; charset=utf-8" } }));
app.get("/terms", (c) => new Response(TERMS_PAGE, { headers: { "Content-Type": "text/html; charset=utf-8" } }));
app.get("/safety", (c) => new Response(SAFETY_PAGE, { headers: { "Content-Type": "text/html; charset=utf-8" } }));

// ── Install Scripts ──

const INSTALL_SH=`#!/usr/bin/env bash
set -euo pipefail
BOLD=\"\\\\033[1m\";GREEN=\"\\\\033[0;32m\";RED=\"\\\\033[0;31m\";NC=\"\\\\033[0m\"
log(){echo -e \"\${GREEN}==>\${NC} \${BOLD}\$*\${NC}\";};die(){echo -e \"\${RED}✗\${NC}  \$*\">&2;exit 1;}
OS=\$(uname -s);ARCH=\$(uname -m)
case \"\$OS\" in Darwin)P=\"macos\";;Linux)P=\"linux\";;*)die \"Unsupported OS\";;esac
case \"\$ARCH\" in x86_64|amd64)A=\"x64\";;arm64|aarch64)A=\"arm64\";;*)die \"Unsupported arch\";;esac
U=\"https://tunesoar.com/releases/latest/\${P}/\${A}\"
log \"Detected: \$P / \$A\";log \"Downloading TuneSoar...\"
T=\$(mktemp -d);trap 'rm -rf \"\$T\"' EXIT;cd \"\$T\"
if [ \"\$P\" = \"macos\" ];then
  curl -fsSL -o TuneSoar.dmg \"\$U\"||die \"Download failed\"
  hdiutil attach TuneSoar.dmg -nobrowse -quiet
  cp -R \"/Volumes/TuneSoar/TuneSoar.app\" /Applications/
  hdiutil detach \"/Volumes/TuneSoar\" -quiet
  log \"Done! Launch from /Applications/TuneSoar.app\"
else
  curl -fsSL -o tunesoar \"\$U\"||die \"Download failed\"
  chmod +x tunesoar;mkdir -p \"\$HOME/.local/bin\"
  mv tunesoar \"\$HOME/.local/bin/tunesoar\"
  mkdir -p \"\$HOME/.local/share/applications\"
  printf '[Desktop Entry]\\\\nName=TuneSoar\\\\nComment=Context-Aware Binaural Beats\\\\nExec=%s/.local/bin/tunesoar\\\\nIcon=tunesoar\\\\nTerminal=false\\\\nType=Application\\\\nCategories=Audio;Utility;\\\\n' \"\$HOME\">\"\$HOME/.local/share/applications/tunesoar.desktop\"
  log \"Done! Run: tunesoar\"
fi
echo\"\";echo -e \"  \${GREEN}✓ TuneSoar installed!\${NC}\";echo`;

const INSTALL_PS1=`# TuneSoar one-liner (Windows)
param(\$Version=\"latest\");\$ErrorActionPreference=\"Stop\"
Write-Host\"==> TuneSoar Installer (Windows)\"-ForegroundColor Green
if(-not[Environment]::Is64BitOperatingSystem){Write-Error\"64-bit required\";exit 1}
Write-Host\"Detected: Windows/x64\"
\$U=\"https://tunesoar.com/releases/latest/windows/x64\"
\$T=Join-Path \$env:TEMP\"tunesoar-install\";New-Item -Type Directory -Force -Path \$T|Out-Null
\$I=Join-Path \$T\"TuneSoar-Setup.exe\"
Write-Host\"Downloading...\";Invoke-WebRequest -Uri \$U -OutFile \$I
Write-Host\"Installing...\";Start-Process -FilePath \$I -ArgumentList\"/S\" -Wait
Remove-Item -Recurse -Force \$T -ErrorAction SilentlyContinue
Write-Host\"✓ TuneSoar installed!\"-ForegroundColor Green`;

app.get("/install.sh", (c) => new Response(INSTALL_SH, { headers: { "Content-Type": "text/plain; charset=utf-8" } }));
app.get("/install.ps1", (c) => new Response(INSTALL_PS1, { headers: { "Content-Type": "text/plain; charset=utf-8" } }));
app.get("/health", () => Response.json({ ok: true }));

export default app;
