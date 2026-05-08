import { SignIn, SignUp, UserButton, useAuth, useUser } from "@clerk/react";
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ArrowLeft, Key, Shield, ExternalLink } from "lucide-react";

interface Props {
  onBack: () => void;
}

export function Account({ onBack }: Props) {
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const [showSignUp, setShowSignUp] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [licenseInfo, setLicenseInfo] = useState<any>(null);

  useEffect(() => {
    if (isSignedIn) {
      invoke("get_license_info").then(setLicenseInfo).catch(() => {});
    }
  }, [isSignedIn]);

  return (
    <div className="flex flex-col h-full bg-surface overflow-y-auto">
      <div className="sticky top-0 bg-surface/95 backdrop-blur-sm px-5 py-4 border-b border-surface-lighter flex items-center gap-3 z-10">
        <button onClick={onBack} className="p-1 -ml-1 rounded-lg hover:bg-surface-lighter text-text-secondary hover:text-text-primary">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-base font-semibold text-text-primary">Account</h2>
      </div>

      <div className="p-5">
        {!isSignedIn ? (
          <div className="text-center py-4">
            <p className="text-sm text-text-secondary mb-4">Sign in to manage your license and subscription.</p>
            {showSignUp ? (
              <>
                <SignUp signInUrl="/account" />
                <p className="text-xs text-text-secondary mt-3">
                  Already have an account?{" "}
                  <button onClick={() => setShowSignUp(false)} className="text-trance-400 hover:underline">Sign in</button>
                </p>
              </>
            ) : (
              <>
                <SignIn signUpUrl="/account" />
                <p className="text-xs text-text-secondary mt-3">
                  Don't have an account?{" "}
                  <button onClick={() => setShowSignUp(true)} className="text-trance-400 hover:underline">Sign up</button>
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-surface-light border border-surface-lighter">
              <UserButton />
              <div>
                <p className="text-sm font-medium text-text-primary">
                  {user?.fullName || user?.primaryEmailAddress?.emailAddress || "Signed in"}
                </p>
                <p className="text-xs text-text-secondary">
                  {user?.primaryEmailAddress?.emailAddress}
                </p>
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

            {/* Manage */}
            <a
              href="https://accounts.tunesoar.com/user"
              target="_blank"
              className="flex items-center justify-between p-3 rounded-lg bg-surface-light border border-surface-lighter hover:bg-surface-lighter/50 transition-colors text-text-primary no-underline"
            >
              <span className="text-sm">Manage Account</span>
              <ExternalLink className="w-4 h-4 text-text-secondary" />
            </a>

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
