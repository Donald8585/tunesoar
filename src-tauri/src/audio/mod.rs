pub mod binaural;

use binaural::BinauralEngine;
use std::sync::{Arc, Mutex};
use crate::license::LicenseState;

/// Global audio engine state shared across the app
pub struct AudioState {
    pub engine: Arc<Mutex<Option<BinauralEngine>>>,
    pub current_profile: Arc<Mutex<Option<BeatProfile>>>,
    pub volume: Arc<Mutex<f32>>, // 0.0 - 0.25 (hard cap)
    pub carrier_frequency: Arc<Mutex<f32>>, // 100 - 400 Hz
    pub error_message: Arc<Mutex<Option<String>>>,
    pub is_playing: Arc<Mutex<bool>>,
    pub is_paused: Arc<Mutex<bool>>,
}

impl AudioState {
    pub fn new() -> Self {
        Self {
            engine: Arc::new(Mutex::new(None)),
            current_profile: Arc::new(Mutex::new(None)),
            volume: Arc::new(Mutex::new(0.025)), // default 10%
            carrier_frequency: Arc::new(Mutex::new(200.0)),
            error_message: Arc::new(Mutex::new(None)),
            is_playing: Arc::new(Mutex::new(false)),
            is_paused: Arc::new(Mutex::new(false)),
        }
    }
}

/// Beat profile configuration
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct BeatProfile {
    pub beat_type: BeatType,
    pub beat_frequency: f32,
    pub carrier_frequency: f32,
    pub volume: f32,
}

/// Core binaural beat types
#[derive(Debug, Clone, Copy, PartialEq, serde::Serialize, serde::Deserialize)]
pub enum BeatType {
    Delta,   // 1-4 Hz
    Theta,   // 4-8 Hz
    Alpha,   // 8-13 Hz
    Beta,    // 13-30 Hz
    Gamma,   // 30-40 Hz
}

impl BeatType {
    pub fn default_frequency(&self) -> f32 {
        match self {
            BeatType::Delta => 2.0,
            BeatType::Theta => 6.0,
            BeatType::Alpha => 10.0,
            BeatType::Beta => 15.0,
            BeatType::Gamma => 35.0,
        }
    }

    pub fn frequency_range(&self) -> (f32, f32) {
        match self {
            BeatType::Delta => (1.0, 4.0),
            BeatType::Theta => (4.0, 8.0),
            BeatType::Alpha => (8.0, 13.0),
            BeatType::Beta => (13.0, 30.0),
            BeatType::Gamma => (30.0, 40.0),
        }
    }
}

/// Context types that map to beat profiles
#[derive(Debug, Clone, Copy, PartialEq, serde::Serialize, serde::Deserialize)]
pub enum ContextType {
    Coding,
    Writing,
    Creative,
    PassiveWatch,
    Communication,
    Meeting,
    Relaxation,
    Music,       // auto-pause
    Idle,
    SleepPrep,
    Gaming,
    Ambient,     // default
}

impl ContextType {
    pub fn default_beat(&self) -> BeatType {
        match self {
            ContextType::Coding => BeatType::Beta,
            ContextType::Writing => BeatType::Alpha,
            ContextType::Creative => BeatType::Theta,
            ContextType::PassiveWatch => BeatType::Alpha,
            ContextType::Communication => BeatType::Beta,
            ContextType::Meeting => BeatType::Alpha,
            ContextType::Relaxation => BeatType::Theta,
            ContextType::Music => BeatType::Alpha,
            ContextType::Idle => BeatType::Alpha,
            ContextType::SleepPrep => BeatType::Delta,
            ContextType::Gaming => BeatType::Beta,
            ContextType::Ambient => BeatType::Alpha,
        }
    }

    pub fn default_beat_freq(&self) -> f32 {
        match self {
            ContextType::Coding => 15.0,
            ContextType::Writing => 10.0,
            ContextType::Creative => 6.0,
            ContextType::PassiveWatch => 10.0,
            ContextType::Communication => 13.0,
            ContextType::Meeting => 0.0,         // auto-pause
            ContextType::Relaxation => 6.0,
            ContextType::Music => 0.0,           // auto-pause
            ContextType::Idle => 0.0,            // fade out
            ContextType::SleepPrep => 2.0,
            ContextType::Gaming => 14.0,
            ContextType::Ambient => 10.0,
        }
    }
}

/// The detected current context with metadata
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DetectedContext {
    pub context_type: ContextType,
    pub app_name: String,
    pub window_title: String,
    pub url: Option<String>,
    pub detected_at: i64,
}

// SAFETY: All fields are Arced Mutex-protected. The cpal types are
// only accessed from within locked contexts on the same thread.
unsafe impl Send for AudioState {}
unsafe impl Sync for AudioState {}

/// Update the active beat profile based on context, enforcing license tier
pub fn update_beat_for_context(state: &AudioState, context: &DetectedContext, license: &LicenseState) {
    let mut engine_guard = state.engine.lock().unwrap();
    let mut profile_guard = state.current_profile.lock().unwrap();

    let is_pro = license.can_use("unlimited_contexts");

    // ── Tier enforcement: redirect Pro-only contexts to Ambient for free users ──
    let effective_ctx = if !is_pro {
        match context.context_type {
            // Free tier (5 contexts): Coding, Writing, Creative, Gaming, Ambient
            ContextType::PassiveWatch | ContextType::Communication
            | ContextType::Meeting | ContextType::Relaxation
            | ContextType::Music | ContextType::Idle
            | ContextType::SleepPrep => {
                log::info!("[tunesoar:audio] Free tier: context {:?} → Ambient", context.context_type);
                ContextType::Ambient
            }
            other => other,
        }
    } else {
        context.context_type
    };

    let freq = effective_ctx.default_beat_freq();

    if freq <= 0.0 {
        // Auto-pause or fade out
        if let Some(ref mut engine) = *engine_guard {
            engine.fade_out();
        }
        *profile_guard = None;
        return;
    }

    let mut beat_type = effective_ctx.default_beat();

    // ── Tier enforcement: block Delta and Gamma bands for free users ──
    if !is_pro {
        match beat_type {
            BeatType::Delta => {
                log::info!("[tunesoar:audio] Free tier: Delta → Alpha");
                beat_type = BeatType::Alpha;
            }
            BeatType::Gamma => {
                log::info!("[tunesoar:audio] Free tier: Gamma → Beta");
                beat_type = BeatType::Beta;
            }
            _ => {}
        }
    }

    // Use carrier frequency from AudioState (default 200 Hz, configurable via Settings)
    let carrier = *state.carrier_frequency.lock().unwrap();

    let profile = BeatProfile {
        beat_type,
        beat_frequency: if freq > 0.0 { freq } else { beat_type.default_frequency() },
        carrier_frequency: carrier,
        volume: *state.volume.lock().unwrap(),
    };

    if let Some(ref mut engine) = *engine_guard {
        engine.set_profile(profile.clone());
    } else {
        match BinauralEngine::new(profile.clone()) {
            Ok(engine) => {
                *state.error_message.lock().unwrap() = None;
                *engine_guard = Some(engine);
            }
            Err(e) => {
                let msg = format!("Failed to create audio engine: {}", e);
                eprintln!("[tunesoar:audio] {}", msg);
                log::error!("[tunesoar:audio] {}", msg);
                *state.error_message.lock().unwrap() = Some(msg);
            }
        }
    }

    *profile_guard = Some(profile);
}
