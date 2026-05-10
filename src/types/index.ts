// ─── Core Types for TuneSoar ───────────────────────────────────

export type BeatType = 'Delta' | 'Theta' | 'Alpha' | 'Beta' | 'Gamma';

export type ContextType =
  | 'Coding'
  | 'Writing'
  | 'Creative'
  | 'PassiveWatch'
  | 'Communication'
  | 'Meeting'
  | 'Relaxation'
  | 'Music'
  | 'Idle'
  | 'SleepPrep'
  | 'Gaming'
  | 'Ambient';

export interface DetectedContext {
  context_type: ContextType;
  app_name: string;
  window_title: string;
  detected_at: number;
}

export interface CurrentStatus {
  context_type: string;
  app_name: string;
  window_title: string;
  beat_type: string;
  beat_frequency: number;
  volume: number;
  carrier_frequency: number;
  is_playing: boolean;
  is_paused: boolean;
  auto_detect_enabled: boolean;
  manual_override: string | null;
  audio_error: string | null;
  is_pro: boolean;
}

export interface UserPrefs {
  volume: number;
  carrier_frequency: number;
  detection_interval_secs: number;
  auto_start: boolean;
  minimize_to_tray: boolean;
  telemetry_opt_in: boolean;
  pro_license_key: string | null;
  safety_warning_accepted: boolean;
}

export interface ContextMapping {
  id?: number;
  pattern: string;
  pattern_type: 'app' | 'window';
  context_type: string;
  beat_type: string;
  beat_frequency: number;
  enabled: boolean;
}

export interface UsageLog {
  id?: number;
  context_type: string;
  beat_type: string;
  app_name: string;
  duration_secs: number;
  timestamp: number;
}

// Beat profile definitions
export const BEAT_PROFILES: Record<BeatType, { name: string; range: string; description: string; emoji: string }> = {
  Delta:    { name: 'Delta', range: '1–4 Hz', description: 'Deep sleep, healing, pain relief', emoji: '🌙' },
  Theta:    { name: 'Theta', range: '4–8 Hz', description: 'Meditation, creativity, deep relaxation', emoji: '🧘' },
  Alpha:    { name: 'Alpha', range: '8–13 Hz', description: 'Relaxed focus, flow state, calm alertness', emoji: '🌊' },
  Beta:     { name: 'Beta', range: '13–30 Hz', description: 'Active focus, concentration, problem-solving', emoji: '⚡' },
  Gamma:    { name: 'Gamma', range: '30–40 Hz', description: 'High cognition, peak awareness (use with caution)', emoji: '🧠' },
};

// Default context → beat mapping
export const DEFAULT_CONTEXT_MAP: Record<ContextType, { beat: BeatType; freq: number }> = {
  Coding:          { beat: 'Beta',  freq: 15 },
  Writing:         { beat: 'Alpha', freq: 10 },
  Creative:        { beat: 'Theta', freq: 6 },
  PassiveWatch:    { beat: 'Alpha', freq: 10 },
  Communication:   { beat: 'Beta',  freq: 13 },
  Meeting:         { beat: 'Alpha', freq: 0 },
  Relaxation:      { beat: 'Theta', freq: 6 },
  Music:           { beat: 'Alpha', freq: 0 },
  Idle:            { beat: 'Alpha', freq: 0 },
  SleepPrep:       { beat: 'Delta', freq: 2 },
  Gaming:          { beat: 'Beta',  freq: 14 },
  Ambient:         { beat: 'Alpha', freq: 10 },
};

export const CONTEXT_LABELS: Record<ContextType, { label: string; emoji: string }> = {
  Coding:          { label: 'Coding', emoji: '💻' },
  Writing:         { label: 'Writing', emoji: '✍️' },
  Creative:        { label: 'Creative', emoji: '🎨' },
  PassiveWatch:    { label: 'Watching', emoji: '📺' },
  Communication:   { label: 'Chat', emoji: '💬' },
  Meeting:         { label: 'Meeting', emoji: '📞' },
  Relaxation:      { label: 'Relaxing', emoji: '🧘' },
  Music:           { label: 'Music Detected', emoji: '🎵' },
  Idle:            { label: 'Idle', emoji: '💤' },
  SleepPrep:       { label: 'Sleep Prep', emoji: '🌙' },
  Gaming:          { label: 'Gaming', emoji: '🎮' },
  Ambient:         { label: 'Ambient', emoji: '🌿' },
};
