# Incident: Clerk `host_invalid` Error (2026-05-13)

## Summary

Users were unable to sign in. Clerk returned `host_invalid` after redirect
from the Clerk-hosted auth pages, preventing session creation.

## Timeline

| Time (UTC) | Event |
|---|---|
| ~14:00 | User reports "Host Error" after logging in |
| 14:25 | Investigation begins |
| 14:45 | Root cause identified: CSP + broken Cloud Run proxy |
| 14:55 | Fix applied to `tauri.conf.json` CSP |
| 15:00 | Smoke tests confirm all endpoints healthy |

## Root Cause

**Primary: Tauri CSP blocked Clerk FAPI requests.**

The Content Security Policy in `tauri.conf.json` allowed `connect-src`
to `https://api.clerk.com`, `https://*.clerk.accounts.dev`, and
`https://*.clerk.com`, but NOT to the custom domain
`https://clerk.tunesoar.com`. Since `clerk.tunesoar.com` is a subdomain
of `tunesoar.com` (not `clerk.com`), the `*.clerk.com` wildcard does
not match it.

This blocked all `fetch()`/XHR requests from the Clerk SDK in the Tauri
webview to the Frontend API.

**Secondary: A Cloud Run proxy (`clerk-client-api-svdc6x3ypq-uc.a.run.app`)**
had been deployed as a workaround but was forwarding incorrect Host headers
to Clerk, triggering the `host_invalid` server-side error.

The proxy was unnecessary — `clerk.tunesoar.com` already resolves via
Cloudflare directly to Clerk's edge infrastructure.

## Fix Applied

### Code changes

1. **`src-tauri/tauri.conf.json`** — Added `https://clerk.tunesoar.com` to:
   - `connect-src` (was missing entirely — this was the critical fix)
   - `frame-src` (for Clerk iframe components on custom domain)
   - `img-src` (for Clerk profile images served via custom domain)

2. **No frontend code changes needed** — `main.tsx` already uses standard
   `<ClerkProvider publishableKey={...}>` without any custom proxy URL.

### Infrastructure cleanup (pending)

- [ ] Delete Cloud Run service `clerk-client-api-svdc6x3ypq-uc`
  ```bash
  gcloud run services delete clerk-client-api --region=us-central1
  ```
  **Hold 7 days for rollback safety.** Target deletion: 2026-05-20.

## Verification

| Test | Result |
|---|---|
| Clerk Backend API (`api.clerk.com/v1/health`) | ✅ 200 |
| Clerk FAPI via custom domain (`clerk.tunesoar.com/v1/client`) | ✅ 200 |
| Clerk FAPI `/v1/environment` | ✅ 200 |
| CORS preflight | ✅ 200, correct headers |
| TuneSoar Worker health | ✅ 200 |
| Bad token → 401 | ✅ |
| Missing auth → 401 | ✅ |

## Rollback Plan

If auth breaks after this fix:

1. Revert `tauri.conf.json` CSP changes (remove `clerk.tunesoar.com` from
   `connect-src`, `frame-src`, `img-src`)
2. The Cloud Run proxy is still running (empty 200 response) — do NOT
   delete until 7 days after verification
3. If proxy needed for rollback: fix Host header forwarding in the
   Cloud Run service handler

## Lessons Learned

1. **CSP wildcards don't cross domain boundaries.** `*.clerk.com` does
   not match `clerk.tunesoar.com`.
2. **Don't proxy managed auth services** without a strong business reason.
   Clerk's edge infrastructure already handles latency, caching, and
   custom domains natively.
3. **Custom Clerk domains should use Clerk's native CNAME setup**, not
   a self-managed reverse proxy. The `clerk.tunesoar.com` DNS already
   points to Cloudflare → Clerk correctly.
4. **Cloud Run is overkill for a thin auth proxy.** If proxying were
   truly needed, a Cloudflare Worker would be simpler, faster, and free.

## Auth Architecture (post-fix)

```
┌──────────┐     Clerk FAPI      ┌──────────────────────┐
│  Tauri   │ ──────────────────→ │ clerk.tunesoar.com   │
│  App     │   (fetch/XHR)       │   (Cloudflare →       │
│ (webview)│                     │    Clerk Edge)        │
└──────────┘                     └──────────────────────┘
     │                                    │
     │ Clerk session token                │ Auth state
     │ (Bearer)                           │
     ▼                                    ▼
┌──────────┐                     ┌──────────────────────┐
│  Cloud-  │ ──────────────────→ │  Clerk Backend API   │
│  flare   │  verifyToken()      │  (api.clerk.com)     │
│  Worker  │                     │                      │
└──────────┘                     └──────────────────────┘
```
