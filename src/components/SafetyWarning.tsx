import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Shield, AlertTriangle, Zap, ChevronDown } from "lucide-react";
import { Button } from "./ui/button";

interface SafetyStatus {
  acknowledged: boolean;
  requires_reack: boolean;
}

interface Props {
  onComplete: () => void;
}

export function SafetyWarning({ onComplete }: Props) {
  const [status, setStatus] = useState<SafetyStatus | null>(null);
  // step tracking removed — scroll-to-bottom replaces explicit stepper
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [checkbox1, setCheckbox1] = useState(false);
  const [checkbox2, setCheckbox2] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    invoke<SafetyStatus>("get_safety_status")
      .then(setStatus)
      .catch(() => setStatus({ acknowledged: false, requires_reack: true }));
  }, []);

  const handleDisagree = async () => {
    try {
      await invoke("discomfort_stop");
      // App will close via process exit
      await invoke("process:exit", { exitCode: 0 });
    } catch {
      window.close();
    }
  };

  const handleAgree = async () => {
    if (!checkbox1 || !checkbox2) {
      setError("Both checkboxes must be checked to continue");
      return;
    }
    setError("");
    try {
      await invoke("acknowledge_safety", {
        readAndUnderstood: checkbox1,
        noListedConditions: checkbox2,
      });
      setStatus((s) => s ? { ...s, acknowledged: true } : null);
      onComplete();
    } catch (e) {
      setError(`Failed to save: ${e}`);
    }
  };

  if (!status) return null;
  if (status.acknowledged && !status.requires_reack) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 rounded-2xl bg-surface border border-surface-lighter shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="text-center p-6 pb-0 shrink-0">
          <div className="w-14 h-14 rounded-2xl bg-amber-600/20 flex items-center justify-center mx-auto mb-3">
            <Shield className="w-7 h-7 text-amber-400" />
          </div>
          <h1 className="text-xl font-bold text-text-primary mb-1">
            {status.requires_reack ? "Safety Update" : "Safety First"}
          </h1>
          <p className="text-sm text-text-secondary">
            {status.requires_reack
              ? "Attunely has been updated. Please review the updated safety information."
              : "Please read this important safety information before using Attunely"}
          </p>
        </div>

        {/* Scrollable Content */}
        <div
          className="overflow-y-auto px-6 py-4 flex-1"
          onScroll={(e) => {
            const el = e.currentTarget;
            if (el.scrollHeight - el.scrollTop - el.clientHeight < 20) {
              setScrolledToBottom(true);
            }
          }}
        >
          <div className="space-y-3">
            {/* Critical Warning */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-red-600/15 border border-red-600/30">
              <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
              <div className="text-sm text-red-300/80">
                <p className="font-semibold text-red-400 mb-1">⚠️ Critical Safety Warning</p>
                <p className="leading-relaxed">
                  Binaural beats may cause <strong>seizures, headaches, dizziness, nausea, or anxiety</strong> in some individuals.
                  This is rare but serious. Please read carefully.
                </p>
              </div>
            </div>

            {/* Do Not Use If */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-surface-lighter border border-surface-lighter">
              <Shield className="w-5 h-5 text-text-secondary mt-0.5 shrink-0" />
              <div className="text-sm text-text-secondary leading-relaxed">
                <p className="font-medium text-text-primary mb-1">DO NOT USE if you:</p>
                <ul className="space-y-1 list-disc pl-4">
                  <li>Have a history of <strong>epilepsy or seizures</strong> of any kind</li>
                  <li>Have <strong>photosensitive or audiogenic triggers</strong></li>
                  <li>Are <strong>pregnant</strong></li>
                  <li>Have a <strong>pacemaker</strong> or implanted medical device</li>
                  <li>Are <strong>under 18</strong> without guardian consent and supervision</li>
                </ul>
              </div>
            </div>

            {/* Stop If */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-surface-lighter border border-surface-lighter">
              <Zap className="w-5 h-5 text-text-secondary mt-0.5 shrink-0" />
              <div className="text-sm text-text-secondary leading-relaxed">
                <p className="font-medium text-text-primary mb-1">Stop immediately if you feel:</p>
                <ul className="space-y-1 list-disc pl-4">
                  <li>Headache, dizziness, or vertigo</li>
                  <li>Nausea or motion sickness</li>
                  <li>Anxiety, panic, or emotional distress</li>
                  <li>Any unusual physical or mental sensation</li>
                  <li>Consult a physician before resuming use</li>
                </ul>
              </div>
            </div>

            {/* Not Medical */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-surface-lighter border border-surface-lighter">
              <Shield className="w-5 h-5 text-text-secondary mt-0.5 shrink-0" />
              <div className="text-sm text-text-secondary leading-relaxed">
                <p className="font-medium text-text-primary mb-1">Not a Medical Device</p>
                <p>
                  This app is <strong>not a medical device</strong>. Claims have not been evaluated by
                  the FDA, CE, or HKFDA. Attunely is designed to accompany relaxation and focus —
                  it does not diagnose, treat, cure, or prevent any disease or condition.
                </p>
              </div>
            </div>

            {/* Safety Measures */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-trance-600/10 border border-trance-600/20">
              <Shield className="w-5 h-5 text-trance-400 mt-0.5 shrink-0" />
              <div className="text-sm text-text-secondary leading-relaxed">
                <p className="font-medium text-trance-400 mb-1">How Attunely Protects You</p>
                <ul className="space-y-1 list-disc pl-4">
                  <li>Volume hard-capped at 25% — cannot be exceeded</li>
                  <li>Gamma frequencies (30-40 Hz) disabled by default</li>
                  <li>90-minute sessions enforced with 10-minute breaks</li>
                  <li>2-second fade transitions to prevent audio shock</li>
                  <li>One-click "I feel unwell" emergency stop in menu</li>
                </ul>
              </div>
            </div>

            {!scrolledToBottom && (
              <div className="text-center py-2 text-xs text-text-secondary animate-pulse flex items-center justify-center gap-1">
                <ChevronDown className="w-3 h-3" /> Scroll to continue
              </div>
            )}
          </div>
        </div>

        {/* Confirmation */}
        <div className="p-6 pt-4 border-t border-surface-lighter shrink-0 space-y-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={checkbox1}
              onChange={(e) => setCheckbox1(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-surface-lighter text-trance-600 focus:ring-trance-500 accent-trance-600"
            />
            <span className="text-xs text-text-secondary leading-relaxed">
              <strong>I have read and understood</strong> the safety information above. I understand that
              binaural beats may cause seizures, headaches, dizziness, nausea, or anxiety in some individuals.
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={checkbox2}
              onChange={(e) => setCheckbox2(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-surface-lighter text-trance-600 focus:ring-trance-500 accent-trance-600"
            />
            <span className="text-xs text-text-secondary leading-relaxed">
              <strong>I confirm I do not have</strong> any of the listed conditions: no history of epilepsy,
              seizures, or photosensitive triggers; not pregnant; no pacemaker; and I am either 18+ or have guardian consent.
            </span>
          </label>

          {error && (
            <p className="text-xs text-red-400 text-center">{error}</p>
          )}

          <div className="flex gap-3">
            <Button
              variant="danger"
              className="flex-1"
              onClick={handleDisagree}
            >
              Disagree & Quit
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              disabled={!scrolledToBottom || !checkbox1 || !checkbox2}
              onClick={handleAgree}
            >
              I Agree — Continue
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
