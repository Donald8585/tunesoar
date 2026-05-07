# 🔒 Privacy Policy

**Effective Date: May 2026**
**Last Updated: May 6, 2026**

This Privacy Policy describes how **TranceLab** ("we," "our," or "us") collects, uses, stores, and protects your information when you use **TuneSoar** (the "Application"). By using TuneSoar, you agree to the practices described in this policy.

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

The optional browser extension enables URL-based context detection (e.g., detecting when you're on YouTube to switch to PassiveWatch mode). Here is exactly what it does and does not do:

**What the extension collects and transmits:**

| Data | Purpose |
|---|---|
| **Active tab hostname** (e.g., `github.com`, `youtube.com`) | Context mapping (URL → beat profile) |
| **Auth token** (one-time, during initial handshake) | WebSocket authentication |

**Transmission path:** The extension opens a WebSocket connection to `ws://127.0.0.1:47821` — a local-only server that never leaves your machine. Data is encrypted in transit via the WebSocket protocol.

**What the extension NEVER collects or transmits:**

- ❌ Full URLs or URL paths (we strip everything after the hostname)
- ❌ Page titles or content
- ❌ Browsing history
- ❌ Form data or input fields
- ❌ Cookies or authentication tokens from websites
- ❌ Screenshots or page thumbnails
- ❌ **Incognito / Private Browsing tabs** — the extension is completely disabled in private/incognito windows
- ❌ Any data from active tab while the extension is paused or disconnected

The extension has the **minimum required permissions** to function:

| Permission | Why |
|---|---|
| `tabs` | Read the hostname of the active tab |
| `storage` | Store auth token locally |
| `activeTab` (Firefox) / `tabGroups` (Chrome) | Detect active tab changes |

The extension does **not** request the `history`, `cookies`, `bookmarks`, `downloads`, or `<all_urls>` permissions.

---

## 2. How We Use Your Information

### Pro Tier Data

- **License validation:** Verifying that your license key is valid and hasn't exceeded device limits
- **Support:** Responding to support requests, troubleshooting Pro features
- **Billing:** Processing subscription renewals (via payment provider, not us)
- **Legal compliance:** As required by applicable law

### Telemetry Data (if opted in)

- **Product improvement:** Understanding which beat bands are most used helps us improve defaults
- **Stability monitoring:** Crash reports help us fix bugs
- **Feature development:** Usage patterns inform which contexts and integrations to build next

We do **not** use telemetry data for advertising, profiling, or any purpose other than improving TuneSoar.

---

## 3. Data Retention & Deletion

### Local Data

All local data (preferences, mappings, usage logs) is stored in the app data directory. You can delete it at any time:

1. Close TuneSoar completely
2. Delete the app data directory (see paths in Section 1.1)
3. Restart TuneSoar — it will create a fresh database with defaults

Alternatively, from within the app, you can reset preferences to defaults from the Settings page (future feature).

### Pro License Data

Data associated with your Pro license is retained for the duration of your license validity plus **90 days** after expiry or cancellation. After this period, your data is permanently deleted from our systems.

To request early deletion, contact us at the email below.

### Telemetry Data

Telemetry data is stored in aggregate form (not per-user). We retain aggregate telemetry data for **24 months** for trend analysis. Individual telemetry submissions are not stored in a way that can be linked back to a specific user or device.

### Usage Logs

Local usage logs in the SQLite database are retained indefinitely but are never transmitted. You can query and inspect them via the app's usage stats feature. Delete them by removing the app data directory.

---

## 4. Data Sharing & Third Parties

**We do not sell your data. Period.**

We may share data only in the following limited circumstances:

| Circumstance | What May Be Shared |
|---|---|
| **Payment processor** (Stripe, Paddle, etc.) | Email address for receipt delivery; payment details are handled entirely by them |
| **Legal obligation** | If required by valid legal process (subpoena, court order, warrant), and only the minimum necessary |
| **Business transfer** | In the event of a merger, acquisition, or sale of TranceLab assets, your data may be transferred. You will be notified. |
| **Service providers** (hosting, analytics, crash reporting) | Anonymized aggregate telemetry and crash reports |

All third-party service providers are bound by data processing agreements that restrict use of your data to the specific services we've engaged them for.

---

## 5. Security

We take reasonable measures to protect your information:

| Measure | Detail |
|---|---|
| **Local-first architecture** | The free tier stores nothing on our servers |
| **Encrypted WebSocket** | Browser extension communication is encrypted over local-only WebSocket (`ws://127.0.0.1`) |
| **No cloud sync** | No data is synced to cloud services unless you opt in to telemetry |
| **Minimal permissions** | Browser extension requests only `tabs` and `storage` |
| **SQLite on disk** | Local database is accessible only to the user running the application |

However, no method of electronic storage or transmission is 100% secure. We cannot guarantee absolute security of your data.

---

## 6. Your Rights

### Under GDPR (EU/EEA Users)

If you are located in the European Economic Area, you have the following rights under the General Data Protection Regulation:

- **Right of access:** Request a copy of your personal data
- **Right to rectification:** Correct inaccurate or incomplete data
- **Right to erasure ("right to be forgotten"):** Request deletion of your personal data
- **Right to restrict processing:** Limit how we use your data
- **Right to data portability:** Receive your data in a structured, machine-readable format
- **Right to object:** Object to processing based on legitimate interests
- **Right to withdraw consent:** Withdraw consent at any time (disabling telemetry)

Since TuneSoar stores virtually all data locally, exercising these rights is typically as simple as disabling telemetry or deleting your local database. For Pro license data, contact us at the email below.

**Legal basis for processing:** We process personal data under the following legal bases:
- **Consent:** Telemetry collection (opt-in) and browser extension data
- **Contractual necessity:** Pro license validation
- **Legitimate interest:** Aggregate product analytics and crash reporting

### Under PIPL (Mainland China Users)

If you are located in the People's Republic of China, you have rights under the Personal Information Protection Law:

- Right to know, decide, restrict, and refuse processing of your personal information
- Right to access and copy your personal information
- Right to correction and deletion
- Right to data portability
- Right to withdraw consent

TuneSoar's local-first architecture is designed to respect these rights. Almost all data processing occurs on your device, not on our servers.

### Under PDPO (Hong Kong Users)

If you are located in Hong Kong, you have rights under the Personal Data (Privacy) Ordinance. We comply with the six Data Protection Principles (DPPs) of the PDPO. Contact us for data access requests or correction requests.

### California Residents (CCPA/CPRA)

TuneSoar does not "sell" or "share" personal information as defined under the California Consumer Privacy Act. Since the free tier collects no personal information and Pro collects only the minimum necessary for license validation, CCPA does not apply to the free tier and applies minimally to Pro.

---

## 7. How to Disable All Telemetry

### From the App

1. Open TuneSoar → **Settings** (gear icon in tray menu)
2. Scroll to **Privacy** section
3. Toggle **"Usage Telemetry"** to **OFF**
4. The change takes effect immediately — no data will be sent from that point forward

### Verify Telemetry is Off

You can verify telemetry is disabled by checking your `user_prefs` database:

```sql
SELECT value FROM user_prefs WHERE key = 'telemetry_opt_in';
-- Should return: 0 or false (if disabled)
```

### Additional Steps for Complete Privacy

- **Do not install the browser extension** — URL detection via extension is optional; app-based detection works without it
- **Do not sign up for Pro** — the free tier requires zero personal information
- **Block outbound connections** — you can use a firewall to block TuneSoar from all outbound network access; the app functions fully offline
- **Periodic data cleanup** — delete the local SQLite database to wipe all usage history

---

## 8. Children's Privacy

TuneSoar is **not intended for use by anyone under the age of 18**. We do not knowingly collect personal information from children. If you are a parent or guardian and believe your child has provided us with personal information, please contact us immediately.

See [SAFETY.md](./SAFETY.md) for additional age-related safety warnings.

---

## 9. Changes to This Policy

We may update this Privacy Policy from time to time. When we do, we will:

1. Update the "Last Updated" date at the top of this document
2. For material changes, display a notice in the TuneSoar application on next launch
3. For Pro users, send an email notification to the address on file

Your continued use of TuneSoar after changes constitutes acceptance of the updated policy.

---

## 10. Contact Us

For privacy-related inquiries, data access requests, or complaints:

| Channel | Detail |
|---|---|
| **Email** | fiverrkroft@gmail.com |
| **Organization** | Wealth Maker Masterclass Limited (TranceLab) |
| **DPO Contact** | Alfred So, Director |

For GDPR inquiries from EU/EEA users, please include "GDPR Request" in your subject line. We will respond within 30 days as required by Article 12 of the GDPR.

---

*This privacy policy was last updated on May 6, 2026.*
