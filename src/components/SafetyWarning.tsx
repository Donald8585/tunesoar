import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Shield, AlertTriangle, Zap } from "lucide-react";
import { Button } from "./ui/button";

export function SafetyWarning() {
  const [accepted, setAccepted] = useState<boolean | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    invoke<boolean>("is_safety_accepted").then(setAccepted).catch(() => setAccepted(false));
  }, []);

  const handleAccept = async () => {
    try {
      await invoke("accept_safety_warning");
      setAccepted(true);
    } catch (e) {
      console.error("Failed to accept:", e);
    }
  };

  if (accepted === null) return null;
  if (accepted) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 rounded-2xl bg-surface border border-surface-lighter shadow-2xl p-6 animate-in fade-in zoom-in-95">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-amber-600/20 flex items-center justify-center mx-auto mb-3">
            <Shield className="w-7 h-7 text-amber-400" />
          </div>
          <h1 className="text-xl font-bold text-text-primary mb-1">Safety First</h1>
          <p className="text-sm text-text-secondary">
            Please read this important safety information before using Attunely
          </p>
        </div>

        <div className="space-y-3 mb-6">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-600/10 border border-amber-600/20">
            <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-300/80">
              <p className="font-medium text-amber-400 mb-1">Seizure Risk Warning</p>
              <p className="leading-relaxed">
                Binaural beats involve rhythmic audio frequencies that may trigger seizures in people
                with photosensitive epilepsy or other neurological conditions. If you have a history of
                seizures, consult your doctor before use.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-surface-light border border-surface-lighter">
            <Zap className="w-5 h-5 text-text-secondary mt-0.5 shrink-0" />
            <div className="text-sm text-text-secondary leading-relaxed">
              <p className="font-medium text-text-primary mb-1">Safety Measures We Take</p>
              <ul className="space-y-1 list-disc pl-4">
                <li>Volume hard-capped at 25% of system output</li>
                <li>Gamma frequencies (30-40 Hz) disabled by default</li>
                <li>2-second fade transitions to prevent audio shock</li>
                <li>Auto-pause during calls and music playback</li>
              </ul>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-surface-light border border-surface-lighter">
            <Shield className="w-5 h-5 text-text-secondary mt-0.5 shrink-0" />
            <div className="text-sm text-text-secondary leading-relaxed">
              <p className="font-medium text-text-primary mb-1">Best Practices</p>
              <ul className="space-y-1 list-disc pl-4">
                <li>Start at low volume (10% or less)</li>
                <li>Use headphones for proper binaural effect</li>
                <li>Stop immediately if you experience discomfort, dizziness, or headache</li>
                <li>Do not use while operating heavy machinery or driving</li>
              </ul>
            </div>
          </div>
        </div>

        <label className="flex items-start gap-3 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-surface-lighter text-trance-600 focus:ring-trance-500"
          />
          <span className="text-xs text-text-secondary leading-relaxed">
            I understand the risks and safety guidelines. I do not have a history of seizures and
            agree to use Attunely responsibly.
          </span>
        </label>

        <Button
          variant="primary"
          className="w-full"
          disabled={!checked}
          onClick={handleAccept}
        >
          I Understand — Continue
        </Button>
      </div>
    </div>
  );
}
