/**
 * Qeyloop Audio Engine
 * 
 * Manages the Web Audio API context, AudioWorklet, and communication
 * with the WASM DSP module.
 * 
 * All audio processing happens in the AudioWorklet/WASM.
 * This class only handles setup and message passing.
 */

import {
  PlaybackMode,
  PlaybackType,
  OverlapMode,
  ModulationPreset,
  KeyMapping,
  SoundData,
  WorkletMessage,
  WorkletResponse,
} from '../types';

// ============================================================================
// AUDIO ENGINE
// ============================================================================

export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private isInitialized = false;
  private pendingCallbacks: Map<string, (data: any) => void> = new Map();
  
  // Sound storage (for export)
  private loadedSounds: Map<number, SoundData> = new Map();
  
  // State tracking
  private currentBpm = 120;
  private masterVolume = 1.0;
  private metronomeEnabled = false;
  private metronomeVolume = 0.5;
  private modulationPreset = ModulationPreset.None;
  
  /**
   * Initialize the audio engine
   * Must be called after user interaction (browser autoplay policy)
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    
    try {
      // Create audio context with low latency settings
      this.audioContext = new AudioContext({
        latencyHint: 'interactive',
        sampleRate: 48000,
      });
      
      // Load the AudioWorklet processor
      await this.audioContext.audioWorklet.addModule('/worklet/processor.js');
      
      // Create the worklet node
      this.workletNode = new AudioWorkletNode(
        this.audioContext,
        'qeyloop-processor',
        {
          numberOfInputs: 0,
          numberOfOutputs: 1,
          outputChannelCount: [2],
          processorOptions: {
            sampleRate: this.audioContext.sampleRate,
          },
        }
      );
      
      // Connect to output
      this.workletNode.connect(this.audioContext.destination);
      
      // Handle messages from worklet
      this.workletNode.port.onmessage = this.handleWorkletMessage.bind(this);
      
      // Wait for worklet to signal ready
      await this.waitForWorkletReady();
      
      this.isInitialized = true;
      
    } catch (error) {
      console.error('Failed to initialize audio engine:', error);
      throw error;
    }
  }
  
  /**
   * Wait for worklet to signal it's ready
   */
  private waitForWorkletReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Worklet initialization timeout'));
      }, 5000);
      
      this.pendingCallbacks.set('wasmInitialized', () => {
        clearTimeout(timeout);
        resolve();
      });
      
      this.pendingCallbacks.set('error', (message: string) => {
        clearTimeout(timeout);
        reject(new Error(message));
      });
    });
  }
  
  /**
   * Handle messages from the AudioWorklet
   */
  private handleWorkletMessage(event: MessageEvent<WorkletResponse>): void {
    const { type } = event.data;
    
    const callback = this.pendingCallbacks.get(type);
    if (callback) {
      callback('data' in event.data ? event.data.data : undefined);
      this.pendingCallbacks.delete(type);
    }
    
    // Emit events for UI updates
    if (type === 'soundLoaded') {
      window.dispatchEvent(new CustomEvent('qeyloop:soundLoaded', {
        detail: { index: (event.data as any).index }
      }));
    }
  }
  
  /**
   * Post message to the AudioWorklet
   */
  private postMessage(message: WorkletMessage): void {
    if (this.workletNode) {
      this.workletNode.port.postMessage(message);
    }
  }
  
  // ==========================================================================
  // SOUND LOADING
  // ==========================================================================
  
  /**
   * Load an audio file into a sound slot
   */
  async loadSound(index: number, file: File): Promise<SoundData> {
    if (!this.audioContext) {
      throw new Error('Audio engine not initialized');
    }
    
    // Decode the audio file
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    
    // Convert to mono Float32Array
    const samples = this.convertToMono(audioBuffer);
    
    // Resample if necessary (target: 48kHz)
    const resampledSamples = this.resample(
      samples,
      audioBuffer.sampleRate,
      this.audioContext.sampleRate
    );
    
    // Create sound data object
    const soundData: SoundData = {
      index,
      name: file.name,
      samples: resampledSamples,
      sampleRate: this.audioContext.sampleRate,
      duration: resampledSamples.length / this.audioContext.sampleRate,
    };
    
    // Store for export
    this.loadedSounds.set(index, soundData);
    
    // Send to worklet
    this.postMessage({
      type: 'loadSound',
      data: { index, samples: resampledSamples },
    });
    
    return soundData;
  }
  
  /**
   * Load sound from raw samples (for import)
   */
  loadSoundFromSamples(index: number, name: string, samples: Float32Array): void {
    const soundData: SoundData = {
      index,
      name,
      samples,
      sampleRate: this.audioContext?.sampleRate || 48000,
      duration: samples.length / (this.audioContext?.sampleRate || 48000),
    };
    
    this.loadedSounds.set(index, soundData);
    
    console.log(`AudioEngine: Loaded sound ${name} at index ${index}, samples: ${samples.length}`);
    
    this.postMessage({
      type: 'loadSound',
      data: { index, samples },
    });
  }
  
  /**
   * Convert stereo/multichannel audio to mono
   */
  private convertToMono(audioBuffer: AudioBuffer): Float32Array {
    const numChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const mono = new Float32Array(length);
    
    // Mix all channels to mono
    for (let ch = 0; ch < numChannels; ch++) {
      const channelData = audioBuffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        mono[i] += channelData[i] / numChannels;
      }
    }
    
    return mono;
  }
  
  /**
   * Simple linear resampling
   */
  private resample(
    samples: Float32Array,
    fromRate: number,
    toRate: number
  ): Float32Array {
    if (fromRate === toRate) {
      return samples;
    }
    
    const ratio = fromRate / toRate;
    const newLength = Math.floor(samples.length / ratio);
    const resampled = new Float32Array(newLength);
    
    for (let i = 0; i < newLength; i++) {
      const srcIndex = i * ratio;
      const srcFloor = Math.floor(srcIndex);
      const srcFrac = srcIndex - srcFloor;
      
      const s1 = samples[srcFloor] || 0;
      const s2 = samples[srcFloor + 1] || s1;
      
      resampled[i] = s1 + (s2 - s1) * srcFrac;
    }
    
    return resampled;
  }
  
  /**
   * Get loaded sound data (for export)
   */
  getLoadedSound(index: number): SoundData | undefined {
    return this.loadedSounds.get(index);
  }
  
  /**
   * Get all loaded sounds
   */
  getAllLoadedSounds(): SoundData[] {
    return Array.from(this.loadedSounds.values());
  }
  
  // ==========================================================================
  // NOTE TRIGGERING
  // ==========================================================================
  
  /**
   * Trigger a note (key down)
   */
  noteOn(keyCode: number): void {
    const sound = this.loadedSounds.get(keyCode);
    console.log(`AudioEngine: noteOn(${keyCode}), loaded sounds count: ${this.loadedSounds.size}`);
    this.postMessage({ type: 'noteOn', data: { keyCode } });
  }
  
  /**
   * Release a note (key up)
   */
  noteOff(keyCode: number): void {
    this.postMessage({ type: 'noteOff', data: { keyCode } });
  }
  
  /**
   * Stop all sounds immediately
   */
  panic(): void {
    this.postMessage({ type: 'panic' });
  }
  
  // ==========================================================================
  // KEY MAPPING
  // ==========================================================================
  
  /**
   * Set complete key mapping
   */
  setKeyMapping(mapping: KeyMapping): void {
    console.log(`AudioEngine: Setting key ${mapping.keyCode} → sound ${mapping.soundIndex} (hasSound: ${mapping.hasSound})`);
    
    this.postMessage({
      type: 'setKeyMapping',
      data: {
        keyCode: mapping.keyCode,
        soundIndex: mapping.soundIndex,
        mode: mapping.mode,
        playbackType: mapping.playbackType,
        overlapMode: mapping.overlapMode,
        groupId: mapping.groupId,
        volume: mapping.volume,
        pitchSemitones: mapping.pitchSemitones,
        modulationEnabled: mapping.modulationEnabled,
      },
    });
  }
  
  /**
   * Set just the playback mode for a key
   */
  setKeyMode(keyCode: number, mode: PlaybackMode): void {
    this.postMessage({ type: 'setKeyMode', data: { keyCode, mode } });
  }
  
  /**
   * Set playback type for a key (Gate or OneShot)
   */
  setKeyPlaybackType(keyCode: number, playbackType: PlaybackType): void {
    this.postMessage({ type: 'setKeyPlaybackType', data: { keyCode, playbackType } });
  }
  
  /**
   * Set volume for a key
   */
  setKeyVolume(keyCode: number, volume: number): void {
    this.postMessage({ type: 'setKeyVolume', data: { keyCode, volume } });
  }
  
  /**
   * Set pitch for a key (in semitones)
   */
  setKeyPitch(keyCode: number, semitones: number): void {
    this.postMessage({ type: 'setKeyPitch', data: { keyCode, semitones } });
  }
  
  /**
   * Set modulation enabled for a key
   */
  setKeyModulation(keyCode: number, enabled: boolean): void {
    this.postMessage({ type: 'setKeyModulation', data: { keyCode, enabled } });
  }
  
  /**
   * Set overlap mode and group for a key
   */
  setKeyOverlap(keyCode: number, mode: OverlapMode, groupId: number): void {
    this.postMessage({ type: 'setKeyOverlap', data: { keyCode, mode, groupId } });
  }
  
  // ==========================================================================
  // GLOBAL SETTINGS
  // ==========================================================================
  
  /**
   * Set global BPM
   */
  setBpm(bpm: number): void {
    this.currentBpm = bpm;
    this.postMessage({ type: 'setBpm', data: { bpm } });
  }
  
  /**
   * Get current BPM
   */
  getBpm(): number {
    return this.currentBpm;
  }
  
  /**
   * Set metronome settings
   */
  setMetronome(enabled: boolean, volume: number): void {
    this.metronomeEnabled = enabled;
    this.metronomeVolume = volume;
    this.postMessage({ type: 'setMetronome', data: { enabled, volume } });
  }
  
  /**
   * Get metronome state
   */
  getMetronome(): { enabled: boolean; volume: number } {
    return { enabled: this.metronomeEnabled, volume: this.metronomeVolume };
  }
  
  /**
   * Set modulation preset
   */
  setModulationPreset(preset: ModulationPreset): void {
    this.modulationPreset = preset;
    this.postMessage({ type: 'setModulationPreset', data: { preset } });
  }
  
  /**
   * Get current modulation preset
   */
  getModulationPreset(): ModulationPreset {
    return this.modulationPreset;
  }
  
  /**
   * Set master volume
   */
  setMasterVolume(volume: number): void {
    this.masterVolume = volume;
    this.postMessage({ type: 'setMasterVolume', data: { volume } });
  }
  
  /**
   * Get master volume
   */
  getMasterVolume(): number {
    return this.masterVolume;
  }
  
  /**
   * Reset timing (sync to beat)
   */
  resetTiming(): void {
    this.postMessage({ type: 'resetTiming' });
  }
  
  // ==========================================================================
  // AUDIO CONTEXT CONTROL
  // ==========================================================================
  
  /**
   * Resume audio context (required after user interaction)
   */
  async resume(): Promise<void> {
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }
  }
  
  /**
   * Suspend audio context (save resources)
   */
  async suspend(): Promise<void> {
    if (this.audioContext?.state === 'running') {
      await this.audioContext.suspend();
    }
  }
  
  /**
   * Get audio context state
   */
  getState(): AudioContextState | 'uninitialized' {
    return this.audioContext?.state ?? 'uninitialized';
  }
  
  /**
   * Get sample rate
   */
  getSampleRate(): number {
    return this.audioContext?.sampleRate ?? 48000;
  }
  
  /**
   * Check if engine is initialized
   */
  getIsInitialized(): boolean {
    return this.isInitialized;
  }
}

// Singleton instance
export const audioEngine = new AudioEngine();
