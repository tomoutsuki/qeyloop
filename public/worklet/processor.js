/**
 * Qeyloop AudioWorklet Processor
 * 
 * This processor runs in the audio rendering thread with real-time priority.
 * Contains a pure JS DSP engine for instant functionality.
 * WASM version can be loaded for enhanced performance.
 * 
 * CRITICAL: No async operations, no memory allocation, no promises allowed here.
 */

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_VOICES = 64;
const MAX_SOUNDS = 64;
const BLOCK_SIZE = 128;

// Playback modes
const PlaybackMode = {
  SingleShot: 0,
  Loop: 1,
};

// Overlap modes
const OverlapMode = {
  Polyphonic: 0,
  Monophonic: 1,
};

// Modulation presets
const ModulationPreset = {
  None: 0,
  QuarterSidechain: 1,
  EighthSidechain: 2,
  SixteenthSidechain: 3,
};

// ============================================================================
// PURE JS DSP ENGINE (runs inside AudioWorklet)
// ============================================================================

class JsDspEngine {
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    this.bpm = 120;
    this.globalSamplePosition = 0;
    this.metronomeEnabled = false;
    this.metronomeVolume = 0.5;
    this.modulationPreset = ModulationPreset.None;
    this.masterVolume = 1.0;
    
    // Pre-allocate all arrays to avoid allocation in audio callback
    // Sounds: array of { samples: Float32Array, length: number, loaded: boolean }
    this.sounds = new Array(MAX_SOUNDS);
    for (let i = 0; i < MAX_SOUNDS; i++) {
      this.sounds[i] = { samples: null, length: 0, loaded: false };
    }
    
    // Voices: array of voice objects
    this.voices = new Array(MAX_VOICES);
    for (let i = 0; i < MAX_VOICES; i++) {
      this.voices[i] = {
        soundIndex: 0,
        position: 0,
        active: false,
        volume: 1.0,
        pitch: 1.0,
        mode: PlaybackMode.SingleShot,
        groupId: 0,
        keyCode: 0,
        modulationEnabled: false,
      };
    }
    
    // Key mappings: array indexed by keyCode
    this.keyMappings = new Array(256);
    for (let i = 0; i < 256; i++) {
      this.keyMappings[i] = {
        soundIndex: 0,
        mode: PlaybackMode.SingleShot,
        overlapMode: OverlapMode.Polyphonic,
        groupId: 0,
        volume: 1.0,
        pitchSemitones: 0,
        modulationEnabled: false,
        hasSound: false,
      };
    }
  }
  
  // Load audio samples into a sound slot
  load_sound(soundIndex, samples) {
    if (soundIndex >= MAX_SOUNDS) return;
    this.sounds[soundIndex] = {
      samples: samples,
      length: samples.length,
      loaded: true,
    };
  }
  
  // Set key mapping
  set_key_mapping(keyCode, soundIndex, mode, overlapMode, groupId, volume, pitchSemitones, modulationEnabled) {
    const mapping = this.keyMappings[keyCode];
    mapping.soundIndex = soundIndex;
    mapping.mode = mode;
    mapping.overlapMode = overlapMode;
    mapping.groupId = groupId;
    mapping.volume = Math.max(0, Math.min(1, volume));
    mapping.pitchSemitones = Math.max(-24, Math.min(24, pitchSemitones));
    mapping.modulationEnabled = modulationEnabled;
    mapping.hasSound = soundIndex < MAX_SOUNDS && this.sounds[soundIndex].loaded;
  }
  
  set_key_mode(keyCode, mode) {
    this.keyMappings[keyCode].mode = mode;
  }
  
  set_key_modulation(keyCode, enabled) {
    this.keyMappings[keyCode].modulationEnabled = enabled;
  }
  
  set_key_volume(keyCode, volume) {
    this.keyMappings[keyCode].volume = Math.max(0, Math.min(1, volume));
  }
  
  set_key_pitch(keyCode, semitones) {
    this.keyMappings[keyCode].pitchSemitones = Math.max(-24, Math.min(24, semitones));
  }
  
  set_key_overlap(keyCode, mode, groupId) {
    this.keyMappings[keyCode].overlapMode = mode;
    this.keyMappings[keyCode].groupId = groupId;
  }
  
  // Trigger a note
  note_on(keyCode) {
    const mapping = this.keyMappings[keyCode];
    if (!mapping.hasSound) return;
    
    // Handle monophonic mode
    if (mapping.overlapMode === OverlapMode.Monophonic) {
      for (let i = 0; i < MAX_VOICES; i++) {
        if (this.voices[i].active && this.voices[i].groupId === mapping.groupId) {
          this.voices[i].active = false;
        }
      }
    }
    
    // Find free voice
    for (let i = 0; i < MAX_VOICES; i++) {
      if (!this.voices[i].active) {
        const voice = this.voices[i];
        voice.soundIndex = mapping.soundIndex;
        voice.position = 0;
        voice.active = true;
        voice.volume = mapping.volume;
        voice.pitch = Math.pow(2, mapping.pitchSemitones / 12);
        voice.mode = mapping.mode;
        voice.groupId = mapping.groupId;
        voice.keyCode = keyCode;
        voice.modulationEnabled = mapping.modulationEnabled;
        break;
      }
    }
  }
  
  // Release a note
  note_off(keyCode) {
    for (let i = 0; i < MAX_VOICES; i++) {
      if (this.voices[i].active && this.voices[i].keyCode === keyCode) {
        if (this.voices[i].mode === PlaybackMode.Loop) {
          this.voices[i].active = false;
        }
      }
    }
  }
  
  // Stop all sounds
  panic() {
    for (let i = 0; i < MAX_VOICES; i++) {
      this.voices[i].active = false;
    }
    this.globalSamplePosition = 0;
  }
  
  set_bpm(bpm) {
    this.bpm = Math.max(20, Math.min(300, bpm));
  }
  
  get_bpm() {
    return this.bpm;
  }
  
  set_metronome(enabled, volume) {
    this.metronomeEnabled = enabled;
    this.metronomeVolume = Math.max(0, Math.min(1, volume));
  }
  
  set_modulation_preset(preset) {
    this.modulationPreset = preset;
  }
  
  set_master_volume(volume) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
  }
  
  reset_timing() {
    this.globalSamplePosition = 0;
  }
  
  // Calculate modulation amount
  calculateModulation() {
    if (this.modulationPreset === ModulationPreset.None) {
      return 1.0;
    }
    
    const samplesPerBeat = Math.floor(this.sampleRate * 60 / this.bpm);
    let samplesPerCycle;
    
    switch (this.modulationPreset) {
      case ModulationPreset.QuarterSidechain:
        samplesPerCycle = samplesPerBeat;
        break;
      case ModulationPreset.EighthSidechain:
        samplesPerCycle = samplesPerBeat / 2;
        break;
      case ModulationPreset.SixteenthSidechain:
        samplesPerCycle = samplesPerBeat / 4;
        break;
      default:
        return 1.0;
    }
    
    if (samplesPerCycle === 0) return 1.0;
    
    const cyclePos = (this.globalSamplePosition % samplesPerCycle) / samplesPerCycle;
    
    // Sidechain envelope
    if (cyclePos < 0.1) {
      return 0.1 + (cyclePos / 0.1) * 0.3;
    } else {
      const releasePos = (cyclePos - 0.1) / 0.9;
      return 0.4 + Math.pow(releasePos, 0.5) * 0.6;
    }
  }
  
  // Generate metronome click
  generateMetronomeSample() {
    if (!this.metronomeEnabled) return 0;
    
    const samplesPerBeat = Math.floor(this.sampleRate * 60 / this.bpm);
    if (samplesPerBeat === 0) return 0;
    
    const posInBeat = this.globalSamplePosition % samplesPerBeat;
    const clickSamples = Math.floor(this.sampleRate * 0.01);
    
    if (posInBeat < clickSamples) {
      const t = posInBeat / this.sampleRate;
      const freq = (this.globalSamplePosition % (samplesPerBeat * 4)) < samplesPerBeat ? 1500 : 1000;
      const envelope = 1 - (posInBeat / clickSamples);
      return Math.sin(t * freq * Math.PI * 2) * envelope * this.metronomeVolume;
    }
    
    return 0;
  }
  
  // Soft clipping
  softClip(x) {
    if (Math.abs(x) < 0.5) return x;
    if (x > 0) return 0.5 + (1 - Math.exp(-2 * (x - 0.5))) * 0.5;
    return -0.5 - (1 - Math.exp(2 * (x + 0.5))) * 0.5;
  }
  
  // Main audio processing
  process(output) {
    // Clear output
    output.fill(0);
    
    for (let frame = 0; frame < output.length / 2; frame++) {
      let sample = 0;
      const modulation = this.calculateModulation();
      
      // Mix all active voices
      for (let v = 0; v < MAX_VOICES; v++) {
        const voice = this.voices[v];
        if (!voice.active) continue;
        
        const sound = this.sounds[voice.soundIndex];
        if (!sound.loaded) {
          voice.active = false;
          continue;
        }
        
        const posFloor = Math.floor(voice.position);
        const posFrac = voice.position - posFloor;
        
        if (posFloor >= sound.length) {
          if (voice.mode === PlaybackMode.Loop) {
            // Loop back to start
            voice.position = voice.position - sound.length;
            continue;
          } else {
            voice.active = false;
            continue;
          }
        }
        
        // BPM-sync check for loop mode: quantize to 1/8 beat
        if (voice.mode === PlaybackMode.Loop) {
          const samplesPerBeat = Math.floor(this.sampleRate * 60 / this.bpm);
          const samplesPerEighth = samplesPerBeat / 2; // 1/8 note
          const soundDuration = sound.length / voice.pitch;
          
          // Calculate how many 1/8 notes this sound should occupy
          const eighthNotes = Math.round(soundDuration / samplesPerEighth);
          const targetLength = eighthNotes * samplesPerEighth;
          
          // If we're past the target length, loop back
          if (voice.position >= targetLength && targetLength > 0) {
            voice.position = voice.position % targetLength;
            continue;
          }
        }
        
        // Linear interpolation
        const s1 = sound.samples[posFloor];
        const s2 = posFloor + 1 < sound.length ? sound.samples[posFloor + 1] : s1;
        const interpolated = s1 + (s2 - s1) * posFrac;
        
        // Apply volume and modulation
        const voiceMod = voice.modulationEnabled ? modulation : 1.0;
        sample += interpolated * voice.volume * voiceMod;
        
        // Advance position
        voice.position += voice.pitch;
      }
      
      // Add metronome
      sample += this.generateMetronomeSample();
      
      // Apply master volume and soft clip
      sample = this.softClip(sample * this.masterVolume);
      
      // Write to stereo output
      output[frame * 2] = sample;
      output[frame * 2 + 1] = sample;
      
      this.globalSamplePosition++;
    }
  }
  
  get_active_voice_count() {
    let count = 0;
    for (let i = 0; i < MAX_VOICES; i++) {
      if (this.voices[i].active) count++;
    }
    return count;
  }
}

// ============================================================================
// AUDIOWORKLET PROCESSOR
// ============================================================================

class QeyloopProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    
    this.sampleRate = options.processorOptions?.sampleRate || 48000;
    
    // Create JS DSP engine (pure JS, no WASM dependency)
    this.dspEngine = new JsDspEngine(this.sampleRate);
    
    // Pre-allocate output buffer to avoid allocation in process()
    // Stereo interleaved: 128 frames * 2 channels = 256 samples
    this.outputBuffer = new Float32Array(256);
    
    // Message handling for commands from main thread
    this.port.onmessage = this.handleMessage.bind(this);
    
    // Signal ready
    this.port.postMessage({ type: 'wasmInitialized' });
  }
  
  /**
   * Handle messages from the main thread
   * Commands are processed synchronously to maintain deterministic behavior
   */
  handleMessage(event) {
    const { type, data } = event.data;
    const engine = this.dspEngine;
    
    switch (type) {
      case 'init':
        // WASM initialization - we're already using JS engine
        this.port.postMessage({ type: 'wasmInitialized' });
        break;
        
      case 'noteOn':
        engine.note_on(data.keyCode);
        break;
        
      case 'noteOff':
        engine.note_off(data.keyCode);
        break;
        
      case 'loadSound':
        // data.samples is Float32Array, data.index is sound slot
        engine.load_sound(data.index, data.samples);
        this.port.postMessage({ type: 'soundLoaded', index: data.index });
        break;
        
      case 'setKeyMapping':
        engine.set_key_mapping(
          data.keyCode,
          data.soundIndex,
          data.mode,
          data.overlapMode,
          data.groupId,
          data.volume,
          data.pitchSemitones,
          data.modulationEnabled
        );
        break;
        
      case 'setKeyMode':
        engine.set_key_mode(data.keyCode, data.mode);
        break;
        
      case 'setKeyVolume':
        engine.set_key_volume(data.keyCode, data.volume);
        break;
        
      case 'setKeyPitch':
        engine.set_key_pitch(data.keyCode, data.semitones);
        break;
        
      case 'setKeyModulation':
        engine.set_key_modulation(data.keyCode, data.enabled);
        break;
        
      case 'setKeyOverlap':
        engine.set_key_overlap(data.keyCode, data.mode, data.groupId);
        break;
        
      case 'setBpm':
        engine.set_bpm(data.bpm);
        break;
        
      case 'setMetronome':
        engine.set_metronome(data.enabled, data.volume);
        break;
        
      case 'setModulationPreset':
        engine.set_modulation_preset(data.preset);
        break;
        
      case 'setMasterVolume':
        engine.set_master_volume(data.volume);
        break;
        
      case 'panic':
        engine.panic();
        break;
        
      case 'resetTiming':
        engine.reset_timing();
        break;
        
      case 'getState':
        this.port.postMessage({
          type: 'state',
          data: {
            bpm: engine.get_bpm(),
            activeVoices: engine.get_active_voice_count()
          }
        });
        break;
    }
  }
  
  /**
   * Main audio processing callback
   * 
   * Called 375 times per second at 48kHz (128 samples per call)
   * Must complete in under ~2.7ms to avoid audio glitches
   * 
   * CRITICAL: No allocation, no async, no promises
   */
  process(inputs, outputs, parameters) {
    const output = outputs[0];
    
    if (!output || output.length === 0) {
      return true;
    }
    
    // Process audio through DSP engine
    this.dspEngine.process(this.outputBuffer);
    
    // Deinterleave to Web Audio's per-channel format
    const left = output[0];
    const right = output[1] || output[0];
    
    for (let i = 0; i < 128; i++) {
      left[i] = this.outputBuffer[i * 2];
      right[i] = this.outputBuffer[i * 2 + 1];
    }
    
    return true;
  }
}

// Register the processor
registerProcessor('qeyloop-processor', QeyloopProcessor);
