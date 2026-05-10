# 🔒 Privacy Policy

**Effective Date: May 2026**
**Last Updated: May 6, 2026**

This Privacy Policy describes how **Wealth Maker Masterclass Limited** ("we," "our," or "us") collects, uses, stores, and protects your information when you use **TuneSoar** (the "Application"). By using TuneSoar, you agree to the practices described in this policy.

If you do not agree with this policy, do not use TuneSoar. You can also [disable all telemetry](#how-to-disable-all-telemetry) at any time.

---

## TL;DR Summary

| What | Details |
|---|---|
| **Account Required?** | No — free tier works fully offline |
| **Data Collected** | Opt-in only: anonymous session minutes per beat band (no URLs, no app names, no window titles) |
| **Data Stored Locally** | User preferences, custom mappings, usage logs — all in local SQLite database |
| **Data Sent to Us** | Nothing unless you opt in to telemetry; even then, only aggregate counts |
| **Browser Extension** | Sends **hostname only** (e.g., `github.com`) to the desktop app via encrypted local WebSocket; never page content, never incognito |
| **Your Control** | Toggle telemetry off anytime. Delete all local data by removing the app data directory. |

---

## 1. Information We Collect

### 1.1 Free Tier (No Account)

The free tier of TuneSoar **requires no account** and **collects no personal information**. The application runs entirely on your local machine. The following data is stored **only on your device** and is **never transmitted** to us or any third party:

| Data | Purpose | Location |
|---|---|---|
| User Preferences (`user_prefs`) | Volume, carrier frequency, detection interval, UI settings, safety acknowledgment status | Local SQLite database |
| Custom Context Mappings | Your personal app/URL → beat mappings | Local SQLite database |
| Usage Logs (`usage_logs`) | Session durations per context/beat type for your personal usage dashboard | Local SQLite database |

**We never see this data.** It lives in a SQLite database file at your operating system's app data directory:

- **Windows:** `%APPDATA%/com.trance-lab.tunesoar/`
- **macOS:** `~/Library/Application Support/com.trance-lab.tunesoar/`
- **Linux:** `~/.local/share/com.trance-lab.tunesoar/` or `$XDG_DATA_HOME/com.trance-lab.tunesoar/`

### 1.2 Pro Tier

If you purchase a Pro license, we collect the **minimum information necessary** to provide license validation and Pro features:

| Information | Purpose | Retention |
|---|---|---|
| **Email address** | License delivery, Pro feature activation, renewal reminders | Duration of license + 90 days after expiry |
| **License key** | Cryptographic validation of Pro tier access | Duration of license validity |
| **Device fingerprint** | Preventing license abuse (hash of OS + hostname + machine ID) | Duration of license validity |

We do **not** use your email for marketing unless you explicitly opt in to a separate mailing list. We do **not** sell, rent, or share your email or license data with third parties.

**Payment processing** is handled by our payment provider (e.g., Stripe, Paddle). We do **not** receive, store, or process your credit card numbers, billing address, or payment details. Refer to your payment provider's privacy policy for details on how they handle your payment data.

### 1.3 Telemetry (Opt-In Only)

TuneSoar includes an **opt-in** usage telemetry system. By default, telemetry is **disabled**. You must explicitly enable it from **Settings → Privacy → Usage Telemetry**.

When enabled, the following **aggregate, anonymized** data may be transmitted:

| Data Point | Example | What It Is NOT |
|---|---|---|
| Session minutes per beat band | `Beta: 120 min, Theta: 45 min` | Not: app names, URLs, window titles, or any identifying information |
| Beat band switch count | `13 context switches today` | Not: which apps triggered switches |
| Aggregate crash reports | Stack traces (Rust panics) | Not: memory dumps, screenshots, or sensitive data |
| App version & OS | `v0.1.0, Windows 11` | Not: username, hostname, or machine ID |

**What we NEVER collect, even with telemetry enabled:**

- ❌ Active window titles
- ❌ Running application names or processes
- ❌ URLs or browsing history
- ❌ File names, paths, or contents
- ❌ Microphone or camera input
- ❌ Keystrokes or input events
- ❌ Screen contents or screenshots
- ❌ Your name, email, or any PII (unless you're on Pro — see 1.2)
- ❌ IP address (telemetry reports are sanitized before transmission)
- ❌ Device MAC address or hardware identifiers

The telemetry system sends **only** `(context_type, beat_type, duration_secs)` aggregated into counts per band. These are derived from the local `usage_logs` table but stripped of all `app_name` and `timestamp` fields before upload.

### 1.4 Browser Extension

