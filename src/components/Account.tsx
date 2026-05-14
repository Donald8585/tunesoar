import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-shell";
import { onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { ArrowLeft, Key, Shield, ExternalLink, LogIn } from "lucide-react";
import { addToast } from "./ErrorToast";
import { Button } from "./ui/button";

interface Props {
  onBack: () => void;
}

interface DesktopUser {
  sub: string;
  email: string;
  name: string;
  exp: number;
}

function parseJwtPayload(token: string): DesktopUser | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    // Base64url decode (add padding, replace chars)
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const json = atob(b64);
    const payload = JSON.parse(json);
    if (!payload.sub || !payload.exp) return null;
    return payload as DesktopUser;
  } catch {
    return null;
  }
}

export function Account({ onBack }: Props) {
  const [user, setUser] = useState<DesktopUser | null>(null);
  const [licenseInfo, setLicenseInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingState, setPendingState] = useState("");

  // Restore saved auth on mount
  useEffect(() => {
    const saved = localStorage.getItem("tunesoar_desktop_token");
    if (saved) {
      const u = parseJwtPayload(saved);
      if (u && u.exp * 1000 > Date.now()) {
        setUser(u);
        // Store in Rust backend
        invoke("set_desktop_auth", { token: saved }).catch(console.error);
      } else {
        localStorage.removeItem("tunesoar_desktop_token");
      }
    }
  }, []);

  // Listen for deep-link callbacks from system browser
  useEffect(() => {
    const unlisten = onOpenUrl((urls) => {
      for (const url of urls) {
        try {
          const parsed = new URL(url);
          if (parsed.hostname === "auth-callback") {
            const token = parsed.searchParams.get("token");
            const state = parsed.searchParams.get("state");
            const err = parsed.searchParams.get("error");
            handleCallback(token, state, err);
          }
        } catch { /* ignore malformed URLs */ }
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleCallback = useCallback((token: string | null, state: string | null, err: string | null) => {
    if (err) {
      setError(decodeURIComponent(err));
      setLoading(false);
      return;
    }
    if (!token) {
      setError("No token received from sign-in");
      setLoading(false);
      return;
    }
    // Verify state
    if (pendingState && state !== pendingState) {
      setError("State mismatch — possible CSRF attack");
      setLoading(false);
      return;
    }
    const u = parseJwtPayload(token);
    if (!u) {
      setError("Invalid token received");
      setLoading(false);
      return;
    }
    if (u.exp * 1000 <= Date.now()) {
      setError("Token expired");
      setLoading(false);
      return;
    }
    // Success
    localStorage.setItem("tunesoar_desktop_token", token);
    setUser(u);
    setPendingState("");
    setLoading(false);
    // Store in Rust backend
    invoke("set_desktop_auth", { token }).catch(console.error);
    addToast("auth", "Signed in successfully", "warning");
  }, [pendingState]);

  const signInWithBrowser = useCallback(async () => {
    setLoading(true);
    setError("");
    // Generate random state for CSRF protection
    const state = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    setPendingState(state);
    try {
      await open(`https://tunesoar.com/auth/desktop?state=${state}`);
    } catch (e: any) {
      setError(`Failed to open browser: ${e}`);
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem("tunesoar_desktop_token");
    setUser(null);
    setLicenseInfo(null);
    invoke("clear_desktop_auth").catch(console.error);
    addToast("auth", "Signed out", "warning");
  }, []);

  // Load license info when user is set
  useEffect(() => {
    if (user) {
      invoke("get_license_info").then(setLicenseInfo).catch((e) => {
        console.error("[tunesoar:auth]", e);
        addToast("tunesoar:auth", String(e), "error");
      });
    }
  }, [user]);

  return (
    <div className="flex flex-col h-full bg-surface overflow-y-auto">
      <div className="sticky top-0 bg-surface/95 backdrop-blur-sm px-5 py-4 border-b border-surface-lighter flex items-center gap-3 z-10">
        <button onClick={onBack} className="p-1 -ml-1 rounded-lg hover:bg-surface-lighter text-text-secondary hover:text-text-primary">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-base font-semibold text-text-primary">Account</h2>
      </div>

      <div className="p-5">
        {!user ? (
          <div className="text-center py-4">
            <p className="text-sm text-text-secondary mb-4">
              Sign in to manage your license and subscription.
            </p>
            {error && (
              <div className="bg-red-900/20 border border-red-800 text-red-300 rounded-lg p-3 mb-4 text-xs">
                {error}
              </div>
            )}
            <Button
              variant="primary"
              className="w-full"
              onClick={signInWithBrowser}
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                  Waiting for browser…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn className="w-4 h-4" /> Sign in with Browser
                </span>
              )}
            </Button>
            <p className="text-[10px] text-text-secondary mt-4">
              Opens your browser to sign in securely via tunesoar.com.
              <br />
              You'll be redirected back automatically.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* User Info */}
            <div className="flex items-center gap-3 p-4 rounded-xl bg-surface-light border border-surface-lighter">
              <div className="w-9 h-9 rounded-full bg-trance-600 flex items-center justify-center text-white text-sm font-semibold">
                {user.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">{user.name}</p>
                <p className="text-xs text-text-secondary">{user.email}</p>
              </div>
            </div>

            {/* License Info */}
            <div className="rounded-xl bg-surface-light border border-surface-lighter p-4">
              <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3 flex items-center gap-2">
                <Key className="w-3.5 h-3.5" /> License
              </h3>
              {licenseInfo?.valid ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-secondary">Plan</span>
                    <span className="text-xs font-medium text-trance-400 capitalize">{licenseInfo.plan}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-secondary">Devices</span>
                    <span className="text-xs font-medium text-text-primary">{licenseInfo.devices}/{licenseInfo.max_devices}</span>
                  </div>
                  {licenseInfo.expires_at && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-text-secondary">Expires</span>
                      <span className="text-xs font-medium text-text-primary">
                        {new Date(licenseInfo.expires_at * 1000).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-text-secondary">
                  No active license. Purchase one from the{" "}
                  <a href="https://tunesoar.com/pricing" target="_blank" className="text-trance-400 hover:underline">
                    pricing page <ExternalLink className="w-3 h-3 inline" />
                  </a>
                  .
                </p>
              )}
            </div>

            {/* Manage Account */}
            <a
              href="https://accounts.tunesoar.com/user"
              target="_blank"
              className="flex items-center justify-between p-3 rounded-lg bg-surface-light border border-surface-lighter hover:bg-surface-lighter/50 transition-colors text-text-primary no-underline"
            >
              <span className="text-sm">Manage Account</span>
              <ExternalLink className="w-4 h-4 text-text-secondary" />
            </a>

            {/* Sign Out */}
            <button
              onClick={signOut}
              className="w-full p-3 rounded-lg bg-surface-light border border-surface-lighter hover:bg-red-900/20 hover:border-red-800 text-text-secondary hover:text-red-300 transition-colors text-sm"
            >
              Sign Out
            </button>

            <p className="text-[10px] text-text-secondary text-center pt-2">
              <Shield className="w-3 h-3 inline mr-1" />
              Account managed by Clerk · Payments by Stripe
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
