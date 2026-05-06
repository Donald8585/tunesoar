import { useState } from "react";
import { Brain, Activity, Shield, ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "./ui/button";

interface Props {
  onComplete: () => void;
}

const slides = [
  {
    icon: Brain,
    title: "Your Brain, Your Context",
    description:
      "Attunely detects what you're doing and plays the right brainwave — quietly, automatically. Coding? Beta waves for focus. Writing? Alpha state for flow. No manual switching.",
    emoji: "🧠",
  },
  {
    icon: Activity,
    title: "Always in Control",
    description:
      "Your current context shows in the menu bar. Tweak volume, override the context, or pause anytime. The system tray is your command center — always accessible, never in the way.",
    emoji: "🎛️",
  },
  {
    icon: Shield,
    title: "Safety by Design",
    description:
      "Stay safe: volume is hard-capped at 25%, breaks are enforced every 90 minutes, Gamma frequencies require explicit opt-in. One click to stop everything if you ever feel unwell.",
    emoji: "🛡️",
  },
];

export function Onboarding({ onComplete }: Props) {
  const [current, setCurrent] = useState(0);
  const slide = slides[current];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-surface">
      <div className="w-full max-w-md mx-4 text-center px-6">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {slides.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === current ? "bg-trance-500" : "bg-surface-lighter"
              }`}
            />
          ))}
        </div>

        {/* Icon */}
        <div className="w-20 h-20 rounded-3xl bg-trance-600/20 flex items-center justify-center mx-auto mb-6">
          <slide.icon className="w-10 h-10 text-trance-400" />
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-text-primary mb-3">
          {slide.emoji} {slide.title}
        </h2>

        {/* Description */}
        <p className="text-sm text-text-secondary leading-relaxed mb-8">
          {slide.description}
        </p>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          {current > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => setCurrent(c => c - 1)}>
              <ChevronLeft className="w-4 h-4" /> Back
            </Button>
          ) : (
            <div />
          )}

          {current < slides.length - 1 ? (
            <Button variant="primary" size="sm" onClick={() => setCurrent(c => c + 1)}>
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button variant="primary" size="md" onClick={onComplete}>
              Get Started
            </Button>
          )}
        </div>

        {/* Skip */}
        {current < slides.length - 1 && (
          <button
            onClick={onComplete}
            className="mt-6 text-xs text-text-secondary hover:text-text-primary transition-colors"
          >
            Skip tour
          </button>
        )}
      </div>
    </div>
  );
}
