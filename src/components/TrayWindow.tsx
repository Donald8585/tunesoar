import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { CurrentStatus } from "../types";
import { CONTEXT_LABELS, BEAT_PROFILES, type ContextType, type BeatType } from "../types";
import { Play, Pause, Activity, Volume2, Settings2, RefreshCw, ChevronDown } from "lucide-react";
import { Logo } from "./Logo";
import { Slider } from "./ui/slider";
import { Button } from "./ui/button";
import { addToast } from "./ErrorToast";

export function TrayWindow() {
  const [status, setStatus] = useState<CurrentStatus | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [overrideMode, setOverrideMode] = useState("auto");
  const [userScrolled, setUserScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const s = await invoke<CurrentStatus>("get_status");
      setStatus(s);
      setIsPlaying(s.is_playing && !s.is_paused);
      // Only update override mode from backend on initial load;
      // after that, let the local state drive the select to avoid
      // it snapping back to "auto" during fetchStatus after override.
      setOverrideMode((prev) => {
        if (prev !== "" && prev !== "auto" && s.manual_override) return prev;
        return s.manual_override || (s.auto_detect_enabled ? "auto" : "");
      });
    } catch (e) {
      console.error("Failed to get status:", e);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStatus();
    // Also trigger context detection in the backend
    invoke("detect_context").catch(() => {});
    const interval = setInterval(() => {
      invoke("detect_context").catch(() => {});
      fetchStatus();
    }, 3000);
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

  const handleManualOverride = async (ctx: string) => {
    if (ctx === "auto" || !ctx) {
      handleResumeAuto();
      return;
    }
    try {
      await invoke("set_manual_override", { contextType: ctx });
      setOverrideMode(ctx);
      fetchStatus();
    } catch (e) { console.error("Override failed:", e); }
  };

  const handleResumeAuto = async () => {
    try {
      await invoke("resume_auto_detect");
      setOverrideMode("auto");
      fetchStatus();
    } catch (e) { console.error("Resume auto failed:", e); }
  };

  const contextType = (status?.context_type ?? "Ambient") as ContextType;
  const beatType = (status?.beat_type ?? "Alpha") as BeatType;
  const ctx = CONTEXT_LABELS[contextType] ?? CONTEXT_LABELS.Ambient;
  const beat = BEAT_PROFILES[beatType] ?? BEAT_PROFILES.Alpha;
  const isPausedForMusic = contextType === "Music" || contextType === "Meeting";
  const isIdle = contextType === "Idle";

  // Auto-scroll to bottom on first load & when status changes
  useEffect(() => {
    if (!userScrolled && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [status, userScrolled]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    // If user is within 40px of bottom, consider them at the bottom
    setUserScrolled(scrollHeight - scrollTop - clientHeight > 40);
  };

  // Surface audio errors as toasts
  useEffect(() => {
    if (status?.audio_error) {
      addToast("tunesoar:audio", status.audio_error, "error");
    }
  }, [status?.audio_error]);

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 shrink-0">
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

      {/* Scrollable content area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-5 scroll-smooth"
      >
      {/* Audio error banner */}
      {status?.audio_error && (
        <div className="pb-3">
          <div className="rounded-lg bg-red-600/10 border border-red-600/30 p-3">
            <p className="text-xs text-red-400">⚠️ {status.audio_error}</p>
          </div>
        </div>
      )}

      {/* Free tier upgrade prompt */}
      {status && !status.is_pro && (
        <div className="pb-3">
          <div className="rounded-lg bg-trance-600/10 border border-trance-600/20 p-2.5">
            <p className="text-[11px] text-trance-300">
              🆓 Free tier — 5 contexts, 3 beat types.{" "}
              <a href="/upgrade" className="underline hover:text-trance-200" onClick={(e) => { e.preventDefault(); window.location.hash = "#/upgrade"; }}>
                Upgrade to Pro ↗
              </a>
            </p>
          </div>
        </div>
      )}

      {/* Current Context Card */}
      <div className="pb-4 pt-1">
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

      {/* Manual Override */}
      <div className="px-5 pb-3">
        <div className="flex items-center gap-2">
          <Settings2 className="w-3.5 h-3.5 text-text-secondary" />
          <span className="text-xs text-text-secondary">Mode</span>
          <div className="flex-1" />
          {!status?.auto_detect_enabled && (
            <Button size="sm" variant="ghost" onClick={handleResumeAuto}
              className="h-7 px-2 text-xs gap-1">
              <RefreshCw className="w-3 h-3" />
              Auto
            </Button>
          )}
          <select
            value={overrideMode}
            onChange={(e) => handleManualOverride(e.target.value)}
            className="h-7 px-2 rounded-lg bg-surface-light border border-surface-lighter text-xs text-text-primary cursor-pointer outline-none focus:border-trance-500"
          >
            <option value="auto">🔄 Auto-Detect</option>
            <option value="coding">💻 Coding</option>
            <option value="writing">✍️ Writing</option>
            <option value="creative">🎨 Creative</option>
            <option value="communication">💬 Chat</option>
            <option value="gaming">🎮 Gaming</option>
            <option value="relaxation">🧘 Relax</option>
            <option value="sleep">🌙 Sleep</option>
            <option value="ambient">🌿 Ambient</option>
          </select>
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
          value={status?.volume ?? 0.025}
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

      {/* Scroll indicator */}
      {isPlaying && !userScrolled && (
        <div className="flex items-center justify-center gap-1 py-2 text-[10px] text-text-secondary animate-pulse">
          <ChevronDown className="w-3 h-3" />
          <span>Read and scroll to bottom for beat details</span>
          <ChevronDown className="w-3 h-3" />
        </div>
      )}
      </div>{/* end scrollable area */}

      {/* Quick Nav */}
      <div className="shrink-0 px-5 pb-5 pt-2 border-t border-surface-lighter">
        <div className="flex gap-1.5">
          <a
            href="/settings"
            className="flex-1 text-center text-xs text-text-secondary hover:text-text-primary py-2 rounded-lg hover:bg-surface-light transition-colors"
            onClick={(e) => {
              e.preventDefault();
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
            Mappings
          </a>
          <a
            href="/upgrade"
            className="flex-1 text-center text-xs text-trance-400 hover:text-trance-300 py-2 rounded-lg hover:bg-trance-600/10 transition-colors font-medium"
            onClick={(e) => {
              e.preventDefault();
              window.location.hash = "#/upgrade";
            }}
          >
            Pro ↗
          </a>
          <a
            href="/account"
            className="flex-1 text-center text-xs text-text-secondary hover:text-text-primary py-2 rounded-lg hover:bg-surface-light transition-colors"
            onClick={(e) => {
              e.preventDefault();
              window.location.hash = "#/account";
            }}
          >
            Account
          </a>
        </div>
      </div>
    </div>
  );
}

function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}
