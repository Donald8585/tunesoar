import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { CurrentStatus } from "../types";
import { CONTEXT_LABELS, BEAT_PROFILES, type ContextType, type BeatType } from "../types";
import { Play, Pause, Activity, Volume2 } from "lucide-react";
import { Logo } from "./Logo";
import { Slider } from "./ui/slider";
import { Button } from "./ui/button";

export function TrayWindow() {
  const [status, setStatus] = useState<CurrentStatus | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const s = await invoke<CurrentStatus>("get_status");
      setStatus(s);
      setIsPlaying(s.is_playing && !s.is_paused);
    } catch (e) {
      console.error("Failed to get status:", e);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleToggle = async () => {
    try {
      const playing = await invoke<boolean>("toggle_playback");
      setIsPlaying(playing);
    } catch (e) {
      console.error("Toggle failed:", e);
    }
  };

  const handleVolume = async (v: number) => {
    try {
      await invoke("set_volume", { volume: v });
      fetchStatus();
    } catch (e) {
      console.error("Volume change failed:", e);
    }
  };

  const contextType = (status?.context_type ?? "Ambient") as ContextType;
  const beatType = (status?.beat_type ?? "Alpha") as BeatType;
  const ctx = CONTEXT_LABELS[contextType] ?? CONTEXT_LABELS.Ambient;
  const beat = BEAT_PROFILES[beatType] ?? BEAT_PROFILES.Alpha;
  const isPausedForMusic = contextType === "Music" || contextType === "Meeting";
  const isIdle = contextType === "Idle";

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo size={22} />
            <h1 className="text-lg font-semibold text-text-primary">TuneSoar</h1>
          </div>
          <Button
            size="sm"
            variant={isPlaying ? "primary" : "secondary"}
            onClick={handleToggle}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {isPlaying ? "Pause" : "Play"}
          </Button>
        </div>
      </div>

      {/* Current Context Card */}
      <div className="px-5 pb-4">
        <div className="rounded-xl bg-surface-light border border-surface-lighter p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-trance-600/20 flex items-center justify-center text-xl">
              {ctx.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-text-primary">
                  {isPausedForMusic ? "Paused for Audio" : isIdle ? "Fading Out" : ctx.label}
                </span>
                {!isPausedForMusic && !isIdle && (status?.beat_frequency ?? 0) > 0 && (
                  <span className="text-xs text-trance-400 font-mono">
                    {beat.emoji} {status?.beat_frequency ?? 0} Hz {beat.name}
                  </span>
                )}
              </div>
              <p className="text-xs text-text-secondary truncate mt-0.5">
                {status?.app_name || "No app detected"}
                {status?.window_title ? ` — ${status.window_title}` : ""}
              </p>
            </div>
            <Activity className={cn(
              "w-4 h-4",
              isPlaying && !isIdle ? "text-trance-500 animate-pulse" : "text-text-secondary"
            )} />
          </div>
        </div>
      </div>

      {/* Volume Control */}
      <div className="px-5 pb-4">
        <div className="flex items-center gap-3 mb-2">
          <Volume2 className="w-4 h-4 text-text-secondary" />
          <span className="text-xs text-text-secondary">Volume</span>
        </div>
        <Slider
          min={0}
          max={0.25}
          step={0.01}
          value={status?.volume ?? 0.10}
          onChange={handleVolume}
          valueFormatter={(v) => `${Math.round((v / 0.25) * 100)}%`}
        />
        <p className="text-[10px] text-text-secondary mt-1.5">
          Max 25% for safety · Default 10% · Use low volume
        </p>
      </div>

      {/* Beat Info */}
      {!isPausedForMusic && !isIdle && (status?.beat_frequency ?? 0) > 0 && (() => {
        const freq = status?.beat_frequency ?? 0;
        return (
        <div className="px-5 pb-4">
          <div className="rounded-lg bg-surface-light/50 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-secondary">Left ear</span>
              <span className="text-text-secondary">Carrier</span>
              <span className="text-text-secondary">Right ear</span>
            </div>
            <div className="flex items-center justify-between mt-1 font-mono text-sm">
              <span className="text-trance-400">
                {(200 - freq / 2).toFixed(0)} Hz
              </span>
              <span className="text-text-primary">200 Hz</span>
              <span className="text-trance-400">
                {(200 + freq / 2).toFixed(0)} Hz
              </span>
            </div>
            <div className="flex items-center justify-center gap-1 mt-2 text-[10px] text-text-secondary">
              <span>Difference: {freq} Hz → {beat.range}</span>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Quick Nav */}
      <div className="mt-auto px-5 pb-5">
        <div className="flex gap-2">
          <a
            href="/settings"
            className="flex-1 text-center text-xs text-text-secondary hover:text-text-primary py-2 rounded-lg hover:bg-surface-light transition-colors"
            onClick={(e) => {
              e.preventDefault();
              // Navigate to settings
              window.location.hash = "#/settings";
            }}
          >
            Settings
          </a>
          <a
            href="/mappings"
            className="flex-1 text-center text-xs text-text-secondary hover:text-text-primary py-2 rounded-lg hover:bg-surface-light transition-colors"
            onClick={(e) => {
              e.preventDefault();
              window.location.hash = "#/mappings";
            }}
          >
            Context Mappings
          </a>
          <a
            href="/upgrade"
            className="flex-1 text-center text-xs text-trance-400 hover:text-trance-300 py-2 rounded-lg hover:bg-trance-600/10 transition-colors"
            onClick={(e) => {
              e.preventDefault();
              window.location.hash = "#/upgrade";
            }}
          >
            Pro ↗
          </a>
        </div>
      </div>
    </div>
  );
}

function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}
