use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use std::sync::{Arc, Mutex};
use std::f32::consts::PI;

use super::{BeatProfile, BeatType};

/// Core binaural beat generator using pure DSP sine waves
pub struct BinauralEngine {
    stream: Option<cpal::Stream>,
    profile: Arc<Mutex<BeatProfile>>,
    volume: Arc<Mutex<f32>>,
    target_volume: Arc<Mutex<f32>>,
    fade_active: Arc<Mutex<bool>>,
    sample_rate: f32,
    phase_l: Arc<Mutex<f32>>,
    phase_r: Arc<Mutex<f32>>,
}

impl BinauralEngine {
    /// Create a new binaural beat engine and start streaming
    pub fn new(profile: BeatProfile) -> Result<Self, String> {
        let host = cpal::default_host();
        let device = host
            .default_output_device()
            .ok_or("No output device found")?;

        let config = device
            .default_output_config()
            .map_err(|e| format!("Failed to get default config: {}", e))?;

        let sample_rate = config.sample_rate().0 as f32;
        let channels = config.channels() as usize;

        let profile = Arc::new(Mutex::new(profile));
        let volume = Arc::new(Mutex::new(profile.lock().unwrap().volume));
        let target_volume = Arc::new(Mutex::new(profile.lock().unwrap().volume));
        let fade_active = Arc::new(Mutex::new(false));
        let phase_l = Arc::new(Mutex::new(0.0f32));
        let phase_r = Arc::new(Mutex::new(0.0f32));

        let p_clone = profile.clone();
        let v_clone = volume.clone();
        let tv_clone = target_volume.clone();
        let fa_clone = fade_active.clone();
        let pl_clone = phase_l.clone();
        let pr_clone = phase_r.clone();

        let stream = device
            .build_output_stream(
                &config.into(),
                move |data: &mut [f32], _: &cpal::OutputCallbackInfo| {
                    Self::audio_callback(
                        data,
                        channels,
                        sample_rate,
                        &p_clone,
                        &v_clone,
                        &tv_clone,
                        &fa_clone,
                        &pl_clone,
                        &pr_clone,
                    );
                },
                |err| {
                    log::error!("[tunesoar:audio] Stream error: {}", err);
                },
                None,
            )
            .map_err(|e| format!("Failed to build stream: {}", e))?;

        stream.play().map_err(|e| format!("Failed to play: {}", e))?;

        Ok(Self {
            stream: Some(stream),
            profile,
            volume,
            target_volume,
            fade_active,
            sample_rate,
            phase_l,
            phase_r,
        })
    }

    /// Audio callback — generates stereo binaural beats per sample
    fn audio_callback(
        data: &mut [f32],
        channels: usize,
        sample_rate: f32,
        profile: &Arc<Mutex<BeatProfile>>,
        volume: &Arc<Mutex<f32>>,
        target_volume: &Arc<Mutex<f32>>,
        fade_active: &Arc<Mutex<bool>>,
        phase_l: &Arc<Mutex<f32>>,
        phase_r: &Arc<Mutex<f32>>,
    ) {
        let p = profile.lock().unwrap();
        let mut vol = volume.lock().unwrap();
        let target = *target_volume.lock().unwrap();
        let mut fading = fade_active.lock().unwrap();

        // Smooth fade towards target volume (2-second ramp)
        if (*vol - target).abs() > 0.0001 {
            *fading = true;
            let samples_per_step = sample_rate * 2.0; // 2 seconds
            let step = (target - *vol) / samples_per_step;
            *vol += step * (data.len() / channels) as f32;
            // Snap to target when close
            if (*vol - target).abs() < step.abs() * 2.0 {
                *vol = target;
                *fading = false;
            }
        }

        let effective_vol = *vol;
        let carrier = p.carrier_frequency;
        let beat = p.beat_frequency;
        let half_beat = beat / 2.0;

        let mut pl = phase_l.lock().unwrap();
        let mut pr = phase_r.lock().unwrap();

        for frame in data.chunks_mut(channels) {
            // Left ear: carrier - half_beat
            let freq_l = carrier - half_beat;
            let increment_l = 2.0 * PI * freq_l / sample_rate;
            let sample = (*pl).sin() * effective_vol;
            *pl = (*pl + increment_l) % (2.0 * PI);

            // Right ear: carrier + half_beat
            let freq_r = carrier + half_beat;
            let increment_r = 2.0 * PI * freq_r / sample_rate;
            let sample_r = (*pr).sin() * effective_vol;

            // Map to output channels
            if channels >= 2 {
                frame[0] = sample;       // left
                frame[1] = sample_r;     // right
            } else {
                // Mono: average both ears
                frame[0] = (sample + sample_r) / 2.0;
            }

            // Fill remaining channels with silence
            for ch in frame.iter_mut().skip(2) {
                *ch = 0.0;
            }

            *pr = (*pr + increment_r) % (2.0 * PI);
        }
    }

    /// Change beat profile with 2-second crossfade
    pub fn set_profile(&mut self, new_profile: BeatProfile) {
        let mut p = self.profile.lock().unwrap();
        *p = new_profile;
        *self.target_volume.lock().unwrap() = p.volume;
    }

    /// Set volume (clamped 0.0 - 0.25)
    pub fn set_volume(&mut self, vol: f32) {
        let clamped = vol.clamp(0.0, 0.25);
        *self.target_volume.lock().unwrap() = clamped;
    }

    /// Fade out and stop playback
    pub fn fade_out(&mut self) {
        *self.target_volume.lock().unwrap() = 0.0;
    }

    /// Resume from faded state
    pub fn fade_in(&mut self) {
        let p = self.profile.lock().unwrap();
        *self.target_volume.lock().unwrap() = p.volume;
    }

    /// Check if engine is currently fading
    pub fn is_fading(&self) -> bool {
        *self.fade_active.lock().unwrap()
    }
}

impl Drop for BinauralEngine {
    fn drop(&mut self) {
        if let Some(stream) = self.stream.take() {
            drop(stream);
        }
    }
}
