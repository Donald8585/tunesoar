import { useEffect, useState } from "react";
import { Clock, Pause } from "lucide-react";
import { Button } from "./ui/button";

interface Props {
  onDismiss: () => void;
}

export function BreakNotice({ onDismiss }: Props) {
  const [remaining, setRemaining] = useState(600); // 10 minutes

  useEffect(() => {
    const timer = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(timer);
          onDismiss();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onDismiss]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm mx-4 rounded-2xl bg-surface border border-surface-lighter shadow-2xl p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-trance-600/20 flex items-center justify-center mx-auto mb-4">
          <Clock className="w-7 h-7 text-trance-400" />
        </div>
        <h2 className="text-lg font-semibold text-text-primary mb-2">Time for a Break</h2>
        <p className="text-sm text-text-secondary mb-2">
          You've been using TuneSoar for 90 minutes. Taking breaks is important for your auditory health.
        </p>
        <p className="text-2xl font-mono font-bold text-trance-400 mb-4">
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </p>
        <p className="text-xs text-text-secondary mb-4">
          Audio has been paused. It will resume automatically after a 10-minute break.
        </p>
        <div className="flex items-center justify-center gap-2 text-xs text-amber-400/80 mb-4">
          <Pause className="w-3 h-3" /> Binaural audio paused for your safety
        </div>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          I understand
        </Button>
      </div>
    </div>
  );
}
