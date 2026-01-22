/**
 * Qeyloop BPM & Timing Controller
 * 
 * Manages global BPM, metronome, and timing synchronization.
 * All timing-critical calculations happen in WASM, this is just for UI state.
 */

import { audioEngine } from '../audio/engine';

// ============================================================================
// BPM CONTROLLER
// ============================================================================

export class BpmController {
  /** Current BPM */
  private bpm = 120;
  
  /** BPM range limits */
  private readonly minBpm = 20;
  private readonly maxBpm = 300;
  
  /** Metronome state */
  private metronomeEnabled = false;
  private metronomeVolume = 0.5;
  
  /** Callback for BPM changes */
  private onBpmChange: ((bpm: number) => void) | null = null;
  
  /** Callback for metronome changes */
  private onMetronomeChange: ((enabled: boolean, volume: number) => void) | null = null;
  
  /**
   * Initialize BPM controller
   */
  initialize(): void {
    // Set initial values
    this.setBpm(120);
    this.setMetronome(false, 0.5);
  }
  
  /**
   * Set BPM change callback
   */
  setBpmChangeCallback(callback: (bpm: number) => void): void {
    this.onBpmChange = callback;
  }
  
  /**
   * Set metronome change callback
   */
  setMetronomeChangeCallback(callback: (enabled: boolean, volume: number) => void): void {
    this.onMetronomeChange = callback;
  }
  
  // ==========================================================================
  // BPM CONTROL
  // ==========================================================================
  
  /**
   * Set BPM
   */
  setBpm(bpm: number): void {
    this.bpm = Math.max(this.minBpm, Math.min(this.maxBpm, bpm));
    audioEngine.setBpm(this.bpm);
    this.onBpmChange?.(this.bpm);
  }
  
  /**
   * Get current BPM
   */
  getBpm(): number {
    return this.bpm;
  }
  
  /**
   * Increment BPM by amount
   */
  incrementBpm(amount: number = 1): void {
    this.setBpm(this.bpm + amount);
  }
  
  /**
   * Decrement BPM by amount
   */
  decrementBpm(amount: number = 1): void {
    this.setBpm(this.bpm - amount);
  }
  
  /**
   * Double the BPM
   */
  doubleBpm(): void {
    this.setBpm(this.bpm * 2);
  }
  
  /**
   * Halve the BPM
   */
  halveBpm(): void {
    this.setBpm(this.bpm / 2);
  }
  
  /**
   * Get BPM range
   */
  getBpmRange(): { min: number; max: number } {
    return { min: this.minBpm, max: this.maxBpm };
  }
  
  // ==========================================================================
  // METRONOME
  // ==========================================================================
  
  /**
   * Set metronome enabled and volume
   */
  setMetronome(enabled: boolean, volume?: number): void {
    this.metronomeEnabled = enabled;
    if (volume !== undefined) {
      this.metronomeVolume = Math.max(0, Math.min(1, volume));
    }
    audioEngine.setMetronome(this.metronomeEnabled, this.metronomeVolume);
    this.onMetronomeChange?.(this.metronomeEnabled, this.metronomeVolume);
  }
  
  /**
   * Toggle metronome
   */
  toggleMetronome(): boolean {
    this.setMetronome(!this.metronomeEnabled);
    return this.metronomeEnabled;
  }
  
  /**
   * Check if metronome is enabled
   */
  isMetronomeEnabled(): boolean {
    return this.metronomeEnabled;
  }
  
  /**
   * Get metronome volume
   */
  getMetronomeVolume(): number {
    return this.metronomeVolume;
  }
  
  /**
   * Set metronome volume
   */
  setMetronomeVolume(volume: number): void {
    this.metronomeVolume = Math.max(0, Math.min(1, volume));
    audioEngine.setMetronome(this.metronomeEnabled, this.metronomeVolume);
    this.onMetronomeChange?.(this.metronomeEnabled, this.metronomeVolume);
  }
  
  // ==========================================================================
  // TIMING UTILITIES
  // ==========================================================================
  
  /**
   * Get samples per beat at current BPM
   */
  getSamplesPerBeat(sampleRate: number = 48000): number {
    return Math.round(sampleRate * 60 / this.bpm);
  }
  
  /**
   * Get milliseconds per beat
   */
  getMillisecondsPerBeat(): number {
    return 60000 / this.bpm;
  }
  
  /**
   * Get beats per second
   */
  getBeatsPerSecond(): number {
    return this.bpm / 60;
  }
  
  /**
   * Reset timing (sync to beat one)
   */
  resetTiming(): void {
    audioEngine.resetTiming();
  }
  
  // ==========================================================================
  // SERIALIZATION
  // ==========================================================================
  
  /**
   * Export state for project save
   */
  exportState(): { bpm: number; metronome: { enabled: boolean; volume: number } } {
    return {
      bpm: this.bpm,
      metronome: {
        enabled: this.metronomeEnabled,
        volume: this.metronomeVolume,
      },
    };
  }
  
  /**
   * Import state from project load
   */
  importState(state: { bpm: number; metronome: { enabled: boolean; volume: number } }): void {
    this.setBpm(state.bpm);
    this.setMetronome(state.metronome.enabled, state.metronome.volume);
  }
}

// Singleton instance
export const bpmController = new BpmController();
