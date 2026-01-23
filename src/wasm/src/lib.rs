//! Qeyloop DSP Engine - WebAssembly Module
//! 
//! Zero-allocation real-time audio processing for launchpad application.
//! All audio processing happens here, never in JavaScript.

use wasm_bindgen::prelude::*;

// ============================================================================
// CONSTANTS - Fixed at compile time for zero runtime overhead
// ============================================================================

/// Maximum number of simultaneous voices (keys that can play at once)
const MAX_VOICES: usize = 64;

/// Maximum sample length per sound (10 seconds at 48kHz)
const MAX_SAMPLE_LENGTH: usize = 480000;

/// Maximum number of sounds that can be loaded
const MAX_SOUNDS: usize = 64;

/// Audio processing block size (matches AudioWorklet quantum)
const BLOCK_SIZE: usize = 128;

// ============================================================================
// PLAYBACK MODES
// ============================================================================

#[wasm_bindgen]
#[derive(Clone, Copy, PartialEq)]
#[repr(u8)]
pub enum PlaybackMode {
    /// Sound plays once on key down
    SingleShot = 0,
    /// Sound loops, BPM-synced
    Loop = 1,
}

#[wasm_bindgen]
#[derive(Clone, Copy, PartialEq)]
#[repr(u8)]
pub enum OverlapMode {
    /// Multiple sounds can play simultaneously
    Polyphonic = 0,
    /// New sound cuts previous sound in same group
    Monophonic = 1,
}

// ============================================================================
// VOICE - Represents a single playing sound instance
// ============================================================================

#[derive(Clone, Copy)]
struct Voice {
    /// Index into sounds array
    sound_index: usize,
    /// Current playback position in samples (fixed-point for pitch shifting)
    position: f64,
    /// Whether this voice is currently active
    active: bool,
    /// Volume (0.0 to 1.0)
    volume: f32,
    /// Pitch multiplier (1.0 = normal, 2.0 = octave up)
    pitch: f32,
    /// Playback mode for this voice
    mode: PlaybackMode,
    /// Overlap group ID (voices in same group interact based on OverlapMode)
    group_id: u8,
    /// Key code that triggered this voice (for release detection)
    key_code: u8,
    /// Whether modulation is applied to this voice
    modulation_enabled: bool,
}

impl Voice {
    const fn new() -> Self {
        Self {
            sound_index: 0,
            position: 0.0,
            active: false,
            volume: 1.0,
            pitch: 1.0,
            mode: PlaybackMode::SingleShot,
            group_id: 0,
            key_code: 0,
            modulation_enabled: false,
        }
    }
}

// ============================================================================
// SOUND - Pre-loaded audio data
// ============================================================================

struct Sound {
    /// Mono audio samples (interleaved stereo converted to mono on load)
    samples: [f32; MAX_SAMPLE_LENGTH],
    /// Actual length of audio data
    length: usize,
    /// Whether this slot contains valid audio
    loaded: bool,
}

impl Sound {
    const fn new() -> Self {
        Self {
            samples: [0.0; MAX_SAMPLE_LENGTH],
            length: 0,
            loaded: false,
        }
    }
}

// ============================================================================
// KEY MAPPING - Maps keyboard keys to sounds and settings
// ============================================================================

#[derive(Clone, Copy)]
struct KeyMapping {
    /// Index into sounds array
    sound_index: usize,
    /// Playback mode for this key
    mode: PlaybackMode,
    /// Overlap mode
    overlap_mode: OverlapMode,
    /// Overlap group ID
    group_id: u8,
    /// Volume (0.0 to 1.0)
    volume: f32,
    /// Pitch in semitones (-24 to +24)
    pitch_semitones: i8,
    /// Whether modulation is enabled for this key
    modulation_enabled: bool,
    /// Whether a sound is assigned to this key
    has_sound: bool,
}

impl KeyMapping {
    const fn new() -> Self {
        Self {
            sound_index: 0,
            mode: PlaybackMode::SingleShot,
            overlap_mode: OverlapMode::Polyphonic,
            group_id: 0,
            volume: 1.0,
            pitch_semitones: 0,
            modulation_enabled: false,
            has_sound: false,
        }
    }
}

// ============================================================================
// MODULATION - Amplitude modulation for sidechain-like effects
// ============================================================================

#[wasm_bindgen]
#[derive(Clone, Copy, PartialEq)]
#[repr(u8)]
pub enum ModulationPreset {
    /// No modulation
    None = 0,
    /// 1/4 note fake sidechain (duck on each beat)
    QuarterSidechain = 1,
    /// 1/8 note sidechain
    EighthSidechain = 2,
    /// 1/16 note sidechain
    SixteenthSidechain = 3,
}

// ============================================================================
// DSP ENGINE - Main audio processing state
// ============================================================================

#[wasm_bindgen]
pub struct DspEngine {
    /// All loaded sounds
    sounds: Box<[Sound; MAX_SOUNDS]>,
    /// Active voices (playing sounds)
    voices: [Voice; MAX_VOICES],
    /// Key mappings (256 possible key codes)
    key_mappings: [KeyMapping; 256],
    /// Sample rate (typically 44100 or 48000)
    sample_rate: f32,
    /// Global BPM
    bpm: f32,
    /// Current sample position (for BPM sync)
    global_sample_position: u64,
    /// Metronome enabled
    metronome_enabled: bool,
    /// Metronome volume
    metronome_volume: f32,
    /// Current modulation preset
    modulation_preset: ModulationPreset,
    /// Master volume
    master_volume: f32,
}

#[wasm_bindgen]
impl DspEngine {
    /// Create a new DSP engine
    #[wasm_bindgen(constructor)]
    pub fn new(sample_rate: f32) -> Self {
        // Pre-allocate all memory upfront - no allocation during audio processing
        let sounds = Box::new([const { Sound::new() }; MAX_SOUNDS]);
        
        Self {
            sounds,
            voices: [const { Voice::new() }; MAX_VOICES],
            key_mappings: [const { KeyMapping::new() }; 256],
            sample_rate,
            bpm: 120.0,
            global_sample_position: 0,
            metronome_enabled: false,
            metronome_volume: 0.5,
            modulation_preset: ModulationPreset::None,
            master_volume: 1.0,
        }
    }

    /// Load audio data into a sound slot
    /// 
    /// # Arguments
    /// * `sound_index` - Which slot to load into (0-63)
    /// * `samples` - Audio samples (mono f32)
    #[wasm_bindgen]
    pub fn load_sound(&mut self, sound_index: usize, samples: &[f32]) {
        if sound_index >= MAX_SOUNDS {
            return;
        }

        let len = samples.len().min(MAX_SAMPLE_LENGTH);
        let sound = &mut self.sounds[sound_index];
        
        // Copy samples into pre-allocated buffer
        sound.samples[..len].copy_from_slice(&samples[..len]);
        sound.length = len;
        sound.loaded = true;
    }

    /// Unload a sound from a slot
    #[wasm_bindgen]
    pub fn unload_sound(&mut self, sound_index: usize) {
        if sound_index >= MAX_SOUNDS {
            return;
        }
        self.sounds[sound_index].loaded = false;
        self.sounds[sound_index].length = 0;
    }

    /// Map a key to a sound with settings
    #[wasm_bindgen]
    pub fn set_key_mapping(
        &mut self,
        key_code: u8,
        sound_index: usize,
        mode: PlaybackMode,
        overlap_mode: OverlapMode,
        group_id: u8,
        volume: f32,
        pitch_semitones: i8,
        modulation_enabled: bool,
    ) {
        let mapping = &mut self.key_mappings[key_code as usize];
        mapping.sound_index = sound_index;
        mapping.mode = mode;
        mapping.overlap_mode = overlap_mode;
        mapping.group_id = group_id;
        mapping.volume = volume.clamp(0.0, 1.0);
        mapping.pitch_semitones = pitch_semitones.clamp(-24, 24);
        mapping.modulation_enabled = modulation_enabled;
        mapping.has_sound = sound_index < MAX_SOUNDS && self.sounds[sound_index].loaded;
    }

    /// Update just the playback mode for a key
    #[wasm_bindgen]
    pub fn set_key_mode(&mut self, key_code: u8, mode: PlaybackMode) {
        self.key_mappings[key_code as usize].mode = mode;
    }

    /// Update just the modulation setting for a key
    #[wasm_bindgen]
    pub fn set_key_modulation(&mut self, key_code: u8, enabled: bool) {
        self.key_mappings[key_code as usize].modulation_enabled = enabled;
    }

    /// Update volume for a key
    #[wasm_bindgen]
    pub fn set_key_volume(&mut self, key_code: u8, volume: f32) {
        self.key_mappings[key_code as usize].volume = volume.clamp(0.0, 1.0);
    }

    /// Update pitch for a key (in semitones)
    #[wasm_bindgen]
    pub fn set_key_pitch(&mut self, key_code: u8, semitones: i8) {
        self.key_mappings[key_code as usize].pitch_semitones = semitones.clamp(-24, 24);
    }

    /// Set overlap mode and group for a key
    #[wasm_bindgen]
    pub fn set_key_overlap(&mut self, key_code: u8, mode: OverlapMode, group_id: u8) {
        self.key_mappings[key_code as usize].overlap_mode = mode;
        self.key_mappings[key_code as usize].group_id = group_id;
    }

    /// Trigger a sound (key down)
    #[wasm_bindgen]
    pub fn note_on(&mut self, key_code: u8) {
        let mapping = &self.key_mappings[key_code as usize];
        
        if !mapping.has_sound {
            return;
        }

        // Handle monophonic mode - stop other voices in same group
        if mapping.overlap_mode == OverlapMode::Monophonic {
            for voice in &mut self.voices {
                if voice.active && voice.group_id == mapping.group_id {
                    voice.active = false;
                }
            }
        }

        // Find free voice slot
        let voice_slot = self.voices.iter_mut().find(|v| !v.active);
        
        if let Some(voice) = voice_slot {
            // Convert semitones to pitch multiplier: 2^(semitones/12)
            let pitch = 2.0_f32.powf(mapping.pitch_semitones as f32 / 12.0);
            
            voice.sound_index = mapping.sound_index;
            voice.position = 0.0;
            voice.active = true;
            voice.volume = mapping.volume;
            voice.pitch = pitch;
            voice.mode = mapping.mode;
            voice.group_id = mapping.group_id;
            voice.key_code = key_code;
            voice.modulation_enabled = mapping.modulation_enabled;
        }
    }

    /// Release a sound (key up)
    #[wasm_bindgen]
    pub fn note_off(&mut self, key_code: u8) {
        // For SingleShot mode, sound continues playing after key release
        // For Loop mode, sound stops on key release
        for voice in &mut self.voices {
            if voice.active && voice.key_code == key_code {
                if voice.mode == PlaybackMode::Loop {
                    voice.active = false;
                }
            }
        }
    }

    /// Stop all sounds immediately
    #[wasm_bindgen]
    pub fn panic(&mut self) {
        for voice in &mut self.voices {
            voice.active = false;
        }
        self.global_sample_position = 0;
    }

    /// Set global BPM
    #[wasm_bindgen]
    pub fn set_bpm(&mut self, bpm: f32) {
        self.bpm = bpm.clamp(20.0, 300.0);
    }

    /// Get current BPM
    #[wasm_bindgen]
    pub fn get_bpm(&self) -> f32 {
        self.bpm
    }

    /// Enable/disable metronome
    #[wasm_bindgen]
    pub fn set_metronome(&mut self, enabled: bool, volume: f32) {
        self.metronome_enabled = enabled;
        self.metronome_volume = volume.clamp(0.0, 1.0);
    }

    /// Set modulation preset
    #[wasm_bindgen]
    pub fn set_modulation_preset(&mut self, preset: ModulationPreset) {
        self.modulation_preset = preset;
    }

    /// Set master volume
    #[wasm_bindgen]
    pub fn set_master_volume(&mut self, volume: f32) {
        self.master_volume = volume.clamp(0.0, 1.0);
    }

    /// Calculate modulation amount based on current position and preset
    /// Returns a multiplier between 0.0 and 1.0
    fn calculate_modulation(&self) -> f32 {
        if self.modulation_preset == ModulationPreset::None {
            return 1.0;
        }

        // Samples per beat = sample_rate * 60 / bpm
        let samples_per_beat = (self.sample_rate * 60.0 / self.bpm) as u64;
        
        // Samples per modulation cycle based on preset
        let samples_per_cycle = match self.modulation_preset {
            ModulationPreset::None => return 1.0,
            ModulationPreset::QuarterSidechain => samples_per_beat,
            ModulationPreset::EighthSidechain => samples_per_beat / 2,
            ModulationPreset::SixteenthSidechain => samples_per_beat / 4,
        };

        if samples_per_cycle == 0 {
            return 1.0;
        }

        // Position within current cycle (0.0 to 1.0)
        let cycle_pos = (self.global_sample_position % samples_per_cycle) as f32 
            / samples_per_cycle as f32;

        // Sidechain envelope: quick attack, exponential release
        // Duck at start of cycle, recover quickly
        if cycle_pos < 0.1 {
            // Attack phase: duck down
            0.1 + (cycle_pos / 0.1) * 0.3
        } else {
            // Release phase: recover to full
            let release_pos = (cycle_pos - 0.1) / 0.9;
            0.4 + release_pos.powf(0.5) * 0.6
        }
    }

    /// Generate metronome click if appropriate
    fn generate_metronome_sample(&self) -> f32 {
        if !self.metronome_enabled {
            return 0.0;
        }

        let samples_per_beat = (self.sample_rate * 60.0 / self.bpm) as u64;
        if samples_per_beat == 0 {
            return 0.0;
        }

        let pos_in_beat = self.global_sample_position % samples_per_beat;
        
        // Click sound: short sine wave burst at start of beat
        // 10ms click duration
        let click_samples = (self.sample_rate * 0.01) as u64;
        
        if pos_in_beat < click_samples {
            // Generate a 1kHz click with envelope
            let t = pos_in_beat as f32 / self.sample_rate;
            let freq = if self.global_sample_position % (samples_per_beat * 4) < samples_per_beat {
                1500.0 // Higher pitch on beat 1
            } else {
                1000.0
            };
            let envelope = 1.0 - (pos_in_beat as f32 / click_samples as f32);
            (t * freq * std::f32::consts::TAU).sin() * envelope * self.metronome_volume
        } else {
            0.0
        }
    }

    /// Process a single audio block
    /// 
    /// This is the main audio callback - called from AudioWorklet.
    /// CRITICAL: No allocations, no panics, no async operations allowed here.
    /// 
    /// # Arguments
    /// * `output` - Mutable slice to write audio output (stereo interleaved)
    #[wasm_bindgen]
    pub fn process(&mut self, output: &mut [f32]) {
        // Clear output buffer
        output.fill(0.0);

        let samples_per_beat = (self.sample_rate * 60.0 / self.bpm) as u64;
        
        // Process each sample
        for frame in 0..(output.len() / 2) {
            let mut sample = 0.0_f32;
            
            // Get modulation amount for this sample
            let modulation = self.calculate_modulation();

            // Mix all active voices
            for voice in &mut self.voices {
                if !voice.active {
                    continue;
                }

                let sound = &self.sounds[voice.sound_index];
                if !sound.loaded {
                    voice.active = false;
                    continue;
                }

                // Get sample at current position (linear interpolation)
                let pos_floor = voice.position as usize;
                let pos_frac = voice.position - pos_floor as f64;
                
                if pos_floor >= sound.length {
                    if voice.mode == PlaybackMode::Loop {
                        // Loop back to start
                        voice.position = voice.position - sound.length as f64;
                        continue;
                    } else {
                        // Single shot: deactivate when done
                        voice.active = false;
                        continue;
                    }
                }
                
                // BPM-sync for loop mode: quantize to 1/8 beat
                if voice.mode == PlaybackMode::Loop {
                    let samples_per_beat = (self.sample_rate * 60.0 / self.bpm) as u64;
                    let samples_per_eighth = samples_per_beat / 2; // 1/8 note
                    let sound_duration = sound.length as f64 / voice.pitch as f64;
                    
                    // Calculate how many 1/8 notes this sound should occupy
                    let eighth_notes = (sound_duration / samples_per_eighth as f64).round() as u64;
                    let target_length = eighth_notes * samples_per_eighth;
                    
                    // If we're past the target length, loop back
                    if target_length > 0 && voice.position >= target_length as f64 {
                        voice.position = voice.position % target_length as f64;
                        continue;
                    }
                }

                // Linear interpolation between samples
                let s1 = sound.samples[pos_floor];
                let s2 = if pos_floor + 1 < sound.length {
                    sound.samples[pos_floor + 1]
                } else {
                    s1
                };
                let interpolated = s1 + (s2 - s1) * pos_frac as f32;

                // Apply volume and optional modulation
                let voice_mod = if voice.modulation_enabled { modulation } else { 1.0 };
                sample += interpolated * voice.volume * voice_mod;

                // Advance position by pitch factor
                voice.position += voice.pitch as f64;
            }

            // Add metronome
            sample += self.generate_metronome_sample();

            // Apply master volume
            sample *= self.master_volume;

            // Soft clipping to prevent harsh distortion
            sample = soft_clip(sample);

            // Write to stereo output
            output[frame * 2] = sample;
            output[frame * 2 + 1] = sample;

            // Advance global position
            self.global_sample_position += 1;
        }
    }

    /// Get number of active voices (for UI feedback)
    #[wasm_bindgen]
    pub fn get_active_voice_count(&self) -> u32 {
        self.voices.iter().filter(|v| v.active).count() as u32
    }

    /// Check if a specific key is currently playing
    #[wasm_bindgen]
    pub fn is_key_playing(&self, key_code: u8) -> bool {
        self.voices.iter().any(|v| v.active && v.key_code == key_code)
    }

    /// Reset timing (call when starting/stopping transport)
    #[wasm_bindgen]
    pub fn reset_timing(&mut self) {
        self.global_sample_position = 0;
    }

    /// Get key mapping info (for serialization)
    #[wasm_bindgen]
    pub fn get_key_mode(&self, key_code: u8) -> PlaybackMode {
        self.key_mappings[key_code as usize].mode
    }

    #[wasm_bindgen]
    pub fn get_key_volume(&self, key_code: u8) -> f32 {
        self.key_mappings[key_code as usize].volume
    }

    #[wasm_bindgen]
    pub fn get_key_pitch(&self, key_code: u8) -> i8 {
        self.key_mappings[key_code as usize].pitch_semitones
    }

    #[wasm_bindgen]
    pub fn get_key_modulation(&self, key_code: u8) -> bool {
        self.key_mappings[key_code as usize].modulation_enabled
    }

    #[wasm_bindgen]
    pub fn get_key_has_sound(&self, key_code: u8) -> bool {
        self.key_mappings[key_code as usize].has_sound
    }

    #[wasm_bindgen]
    pub fn get_key_sound_index(&self, key_code: u8) -> usize {
        self.key_mappings[key_code as usize].sound_index
    }

    #[wasm_bindgen]
    pub fn get_key_overlap_mode(&self, key_code: u8) -> OverlapMode {
        self.key_mappings[key_code as usize].overlap_mode
    }

    #[wasm_bindgen]
    pub fn get_key_group_id(&self, key_code: u8) -> u8 {
        self.key_mappings[key_code as usize].group_id
    }
}

/// Soft clipping function to prevent harsh digital distortion
/// Uses tanh-like curve for natural saturation
#[inline(always)]
fn soft_clip(x: f32) -> f32 {
    if x.abs() < 0.5 {
        x
    } else if x > 0.0 {
        0.5 + (1.0 - (-2.0 * (x - 0.5)).exp()) * 0.5
    } else {
        -0.5 - (1.0 - (2.0 * (x + 0.5)).exp()) * 0.5
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_engine_creation() {
        let engine = DspEngine::new(48000.0);
        assert_eq!(engine.get_bpm(), 120.0);
    }

    #[test]
    fn test_soft_clip() {
        assert_eq!(soft_clip(0.0), 0.0);
        assert!(soft_clip(10.0) < 1.0);
        assert!(soft_clip(-10.0) > -1.0);
    }
}
