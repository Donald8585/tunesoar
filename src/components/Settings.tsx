import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { UserPrefs } from "../types";
import { APP_NAME, CARRIER_FREQ_MIN, CARRIER_FREQ_MAX } from "../lib/constants";
import { Slider } from "./ui/slider";
import { Switch } from "./ui/switch";
import { Button } from "./ui/button";
import { ArrowLeft, Save, Shield, Download } from "lucide-react";

interface Props {
  onBack: () => void;
  onGetWsToken: () => Promise<string>;
}

export function Settings({ onBack, onGetWsToken }: Props) {
  const [prefs, setPrefs] = useState<UserPrefs | null>(null);
  const [saved, setSaved] = useState(false);
  const [wsToken, setWsToken] = useState("");

  useEffect(() => {
    invoke<UserPrefs>("get_prefs").then(setPrefs).catch(console.error);
    onGetWsToken().then(setWsToken).catch(console.error);
  }, []);

  const update = async (key: string, value: string) => {
    try {
      await invoke("save_pref", { key, value });
      setPrefs((p) => (p ? { ...p, [key]: key === "volume" || key === "carrier_frequency" ? parseFloat(value) : value === "true" } : p));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error("Save failed:", e);
    }
  };

  if (!prefs) return <div className="p-5 text-text-secondary text-sm">Loading...</div>;

  return (
    <div className="flex flex-col h-full bg-surface overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-surface/95 backdrop-blur-sm px-5 py-4 border-b border-surface-lighter flex items-center gap-3 z-10">
        <button onClick={onBack} className="p-1 -ml-1 rounded-lg hover:bg-surface-lighter text-text-secondary hover:text-text-primary">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-base font-semibold text-text-primary">Settings</h2>
        {saved && (
          <span className="text-xs text-trance-400 flex items-center gap-1 ml-auto">
            <Save className="w-3 h-3" /> Saved
          </span>
        )}
      </div>

      <div className="p-5 space-y-6">
        {/* Audio Settings */}
        <section>
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Audio</h3>
          <div className="space-y-4">
            <Slider
              label="Default Volume"
              min={0}
              max={0.25}
              step={0.01}
              value={prefs.volume}
              onChange={(v) => update("volume", v.toString())}
              valueFormatter={(v) => `${Math.round((v / 0.25) * 100)}%`}
            />
            <Slider
              label="Carrier Frequency"
              min={CARRIER_FREQ_MIN}
              max={CARRIER_FREQ_MAX}
              step={1}
              value={prefs.carrier_frequency}
              onChange={(v) => update("carrier_frequency", v.toString())}
              valueFormatter={(v) => `${v} Hz`}
            />
          </div>
        </section>

        {/* Detection */}
        <section>
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Detection</h3>
          <div className="space-y-3">
            <Slider
              label="Detection Interval"
              min={1}
              max={30}
              step={1}
              value={prefs.detection_interval_secs}
              onChange={(v) => update("detection_interval_secs", v.toString())}
              valueFormatter={(v) => `Every ${v}s`}
            />
          </div>
        </section>

        {/* Behavior */}
        <section>
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Behavior</h3>
          <div className="space-y-3">
            <Switch
              checked={prefs.auto_start}
              onChange={(v) => update("auto_start", v.toString())}
              label="Auto-start on login"
              description="Start Attunely when you log into your computer"
            />
            <Switch
              checked={prefs.minimize_to_tray}
              onChange={(v) => update("minimize_to_tray", v.toString())}
              label="Minimize to system tray"
              description="Close button minimizes instead of quitting"
            />
          </div>
        </section>

        {/* Privacy */}
        <section>
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Privacy</h3>
          <div className="space-y-3">
            <Switch
              checked={prefs.telemetry_opt_in}
              onChange={(v) => update("telemetry_opt_in", v.toString())}
              label="Usage Telemetry"
              description="Opt-in anonymous usage data helps us improve Attunely"
            />
          </div>
        </section>

        {/* Browser Extension */}
        <section>
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Browser Extension</h3>
          <div className="rounded-lg bg-surface-light border border-surface-lighter p-3 space-y-2">
            <p className="text-xs text-text-secondary">
              Install the browser extension to enable URL-based context detection (YouTube, Gmail, etc.)
            </p>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-text-primary truncate max-w-[200px]">
                Token: {wsToken.slice(0, 8)}...
              </span>
              <Button size="sm" variant="secondary" onClick={() => navigator.clipboard.writeText(wsToken)}>
                Copy
              </Button>
            </div>
            <Button size="sm" variant="primary" className="w-full mt-2">
              <Download className="w-3.5 h-3.5" /> Install Extension
            </Button>
          </div>
        </section>

        {/* Safety */}
        <section>
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Safety</h3>
          <div className="rounded-lg bg-amber-600/10 border border-amber-600/30 p-3">
            <div className="flex items-start gap-2">
              <Shield className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <div className="text-xs text-amber-300/80 leading-relaxed">
                <p className="font-medium text-amber-400 mb-1">⚠️ Important Safety Notice</p>
                <p>
                  Binaural beats may trigger seizures in people with photosensitive epilepsy.
                  Do not use if you have a history of seizures. Consult a doctor before use.
                  Start at low volume (&lt;10%). Stop immediately if you feel discomfort.
                </p>
                <p className="mt-2 text-amber-400/60">
                  {APP_NAME} enforces a maximum volume of 25%. Gamma frequencies (30-40 Hz) are disabled by default.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* About */}
        <section className="pb-4">
          <div className="text-center">
            <p className="text-xs text-text-secondary">
              {APP_NAME} v0.1.0 · Made by <span className="text-trance-400">TranceLab</span>
            </p>
            <p className="text-[10px] text-text-secondary mt-1">
              Pairs with MindGlow AI
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
