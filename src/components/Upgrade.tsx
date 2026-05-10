import { useState } from "react";
import { open } from "@tauri-apps/plugin-shell";
import { APP_NAME, PRO_PRICE_MONTHLY, PRO_PRICE_LIFETIME } from "../lib/constants";
import { Button } from "./ui/button";
import { ArrowLeft, Check, Shield, Infinity as InfinityIcon, Sparkles } from "lucide-react";

interface Props {
  onBack: () => void;
}

export function Upgrade({ onBack }: Props) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleUpgrade = async (plan: "monthly" | "lifetime") => {
    setLoading(plan);
    try {
      // Open Stripe checkout in browser
      const checkoutUrl = plan === "monthly"
        ? "https://trancelab.ai/tunesoar/checkout/monthly"
        : "https://trancelab.ai/tunesoar/checkout/lifetime";
      await open(checkoutUrl);
    } catch (e) {
      console.error("Failed to open checkout:", e);
    }
    setLoading(null);
  };

  const freeFeatures = [
    "5 context types (Coding, Writing, Gaming, Creative, Ambient)",
    "3 beat profiles (Alpha, Beta, Theta)",
    "Default context mappings",
    "System tray controls",
    "Basic volume control",
    "Active window detection",
    "Offline mode",
  ];

  const proFeatures = [
    "All 12 context types",
    "All 5 beat profiles (Delta, Theta, Alpha, Beta, Gamma)",
    "Unlimited custom context mappings",
    "Sleep mode (22:00-06:00 auto Delta)",
    "Priority audio engine",
    "Advanced statistics & insights",
    "Telemetry & usage dashboard",
  ];

  const FeatureRow = ({ text, included }: { text: string; included: boolean }) => (
    <li className="flex items-start gap-2 text-sm">
      <Check className={`w-4 h-4 mt-0.5 shrink-0 ${included ? "text-trance-400" : "text-text-secondary/30"}`} />
      <span className={included ? "text-text-primary" : "text-text-secondary/50"}>{text}</span>
    </li>
  );

  return (
    <div className="flex flex-col h-full bg-surface overflow-y-auto">
      <div className="sticky top-0 bg-surface/95 backdrop-blur-sm px-5 py-4 border-b border-surface-lighter flex items-center gap-3 z-10">
        <button onClick={onBack} className="p-1 -ml-1 rounded-lg hover:bg-surface-lighter text-text-secondary hover:text-text-primary">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-base font-semibold text-text-primary">Upgrade to Pro</h2>
      </div>

      <div className="p-5 space-y-6">
        {/* Hero */}
        <div className="text-center space-y-2">
          <Sparkles className="w-8 h-8 text-trance-400 mx-auto" />
          <h3 className="text-lg font-semibold text-text-primary">Unlock {APP_NAME} Pro</h3>
          <p className="text-xs text-text-secondary">
            Get unlimited contexts, all beat profiles, and advanced features
          </p>
        </div>

        {/* Plans */}
        <div className="grid gap-3">
          {/* Free */}
          <div className="rounded-xl border border-surface-lighter p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-text-primary">Free</h4>
              <span className="text-lg font-bold text-text-primary">$0</span>
            </div>
            <ul className="space-y-1.5">
              {freeFeatures.map((f, i) => <FeatureRow key={i} text={f} included />)}
              {proFeatures.map((f, i) => <FeatureRow key={`pro-${i}`} text={f} included={false} />)}
            </ul>
          </div>

          {/* Monthly */}
          <div className="rounded-xl border border-trance-600/30 bg-trance-600/5 p-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-trance-600 text-white text-[10px] font-semibold px-2 py-0.5 rounded-bl-lg">
              POPULAR
            </div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-text-primary">Pro Monthly</h4>
              <div className="text-right">
                <span className="text-lg font-bold text-trance-400">${PRO_PRICE_MONTHLY}</span>
                <span className="text-xs text-text-secondary">/mo</span>
              </div>
            </div>
            <ul className="space-y-1.5 mb-3">
              {proFeatures.map((f, i) => <FeatureRow key={i} text={f} included />)}
            </ul>
            <Button
              variant="primary"
              className="w-full"
              onClick={() => handleUpgrade("monthly")}
              disabled={loading === "monthly"}
            >
              {loading === "monthly" ? "Opening..." : `Subscribe $${PRO_PRICE_MONTHLY}/mo`}
            </Button>
          </div>

          {/* Lifetime */}
          <div className="rounded-xl border border-surface-lighter p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-medium text-text-primary">Lifetime</h4>
                <InfinityIcon className="w-4 h-4 text-text-secondary" />
              </div>
              <div className="text-right">
                <span className="text-lg font-bold text-text-primary">${PRO_PRICE_LIFETIME}</span>
                <span className="text-xs text-text-secondary"> one-time</span>
              </div>
            </div>
            <ul className="space-y-1.5 mb-3">
              {proFeatures.map((f, i) => <FeatureRow key={i} text={f} included />)}
            </ul>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => handleUpgrade("lifetime")}
              disabled={loading === "lifetime"}
            >
              {loading === "lifetime" ? "Opening..." : `Buy Once — $${PRO_PRICE_LIFETIME}`}
            </Button>
          </div>
        </div>

        <div className="text-center text-[10px] text-text-secondary flex items-center justify-center gap-1">
          <Shield className="w-3 h-3" /> 30-day money-back guarantee
        </div>
      </div>
    </div>
  );
}
