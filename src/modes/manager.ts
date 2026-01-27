/**
 * Qeyloop Mode Manager
 * 
 * Manages the mode system including:
 * - Key playback modes (SingleShot, Loop)
 * - Key playback types (Gate, OneShot)
 * - Modulation settings
 * - Overlap groups
 * - Volume and pitch per key
 */

import { audioEngine } from '../audio/engine';
import {
  PlaybackMode,
  PlaybackType,
  OverlapMode,
  ModulationPreset,
  KeyMapping,
  createDefaultKeyMapping,
  getAllKeyCodes,
} from '../types';

// ============================================================================
// MODE MANAGER
// ============================================================================

export class ModeManager {
  /** All key mappings indexed by keyCode */
  private keyMappings: Map<number, KeyMapping> = new Map();
  
  /** Current modulation preset */
  private modulationPreset: ModulationPreset = ModulationPreset.None;
  
  /** Callback for mapping changes (for UI) */
  private onMappingChange: ((keyCode: number, mapping: KeyMapping) => void) | null = null;
  
  /**
   * Initialize mode manager with default mappings
   */
  initialize(): void {
    // Create default mappings for all launchpad keys
    for (const keyCode of getAllKeyCodes()) {
      this.keyMappings.set(keyCode, createDefaultKeyMapping(keyCode));
    }
  }
  
  /**
   * Set callback for mapping changes
   */
  setMappingChangeCallback(callback: (keyCode: number, mapping: KeyMapping) => void): void {
    this.onMappingChange = callback;
  }
  
  // ==========================================================================
  // KEY MAPPING
  // ==========================================================================
  
  /**
   * Get mapping for a key
   */
  getMapping(keyCode: number): KeyMapping | undefined {
    return this.keyMappings.get(keyCode);
  }
  
  /**
   * Get all key mappings
   */
  getAllMappings(): KeyMapping[] {
    return Array.from(this.keyMappings.values());
  }
  
  /**
   * Set complete mapping for a key
   */
  setMapping(mapping: KeyMapping): void {
    this.keyMappings.set(mapping.keyCode, mapping);
    audioEngine.setKeyMapping(mapping);
    this.onMappingChange?.(mapping.keyCode, mapping);
  }
  
  /**
   * Assign a sound to a key
   */
  assignSound(keyCode: number, soundIndex: number, soundName: string): void {
    const mapping = this.keyMappings.get(keyCode);
    if (!mapping) return;
    
    mapping.soundIndex = soundIndex;
    mapping.soundName = soundName;
    mapping.hasSound = true;
    
    audioEngine.setKeyMapping(mapping);
    this.onMappingChange?.(keyCode, mapping);
  }
  
  /**
   * Remove sound from a key
   */
  removeSound(keyCode: number): void {
    const mapping = this.keyMappings.get(keyCode);
    if (!mapping) return;
    
    mapping.soundIndex = 0;
    mapping.soundName = '';
    mapping.hasSound = false;
    
    audioEngine.setKeyMapping(mapping);
    this.onMappingChange?.(keyCode, mapping);
  }
  
  // ==========================================================================
  // PLAYBACK MODE
  // ==========================================================================
  
  /**
   * Set playback mode for a key
   */
  setKeyMode(keyCode: number, mode: PlaybackMode): void {
    const mapping = this.keyMappings.get(keyCode);
    if (!mapping) return;
    
    mapping.mode = mode;
    audioEngine.setKeyMode(keyCode, mode);
    this.onMappingChange?.(keyCode, mapping);
  }
  
  /**
   * Toggle playback mode for a key
   */
  toggleKeyMode(keyCode: number): PlaybackMode {
    const mapping = this.keyMappings.get(keyCode);
    if (!mapping) return PlaybackMode.SingleShot;
    
    const newMode = mapping.mode === PlaybackMode.SingleShot
      ? PlaybackMode.Loop
      : PlaybackMode.SingleShot;
    
    this.setKeyMode(keyCode, newMode);
    return newMode;
  }
  
  /**
   * Get playback mode for a key
   */
  getKeyMode(keyCode: number): PlaybackMode {
    return this.keyMappings.get(keyCode)?.mode ?? PlaybackMode.SingleShot;
  }
  
  // ==========================================================================
  // PLAYBACK TYPE (Gate / OneShot)
  // ==========================================================================
  
  /**
   * Set playback type for a key (Gate or OneShot)
   */
  setKeyPlaybackType(keyCode: number, playbackType: PlaybackType): void {
    const mapping = this.keyMappings.get(keyCode);
    if (!mapping) return;
    
    mapping.playbackType = playbackType;
    audioEngine.setKeyPlaybackType(keyCode, playbackType);
    this.onMappingChange?.(keyCode, mapping);
  }
  
  /**
   * Toggle playback type for a key
   */
  toggleKeyPlaybackType(keyCode: number): PlaybackType {
    const mapping = this.keyMappings.get(keyCode);
    if (!mapping) return PlaybackType.OneShot;
    
    const newType = mapping.playbackType === PlaybackType.Gate
      ? PlaybackType.OneShot
      : PlaybackType.Gate;
    
    this.setKeyPlaybackType(keyCode, newType);
    return newType;
  }
  
  /**
   * Get playback type for a key
   */
  getKeyPlaybackType(keyCode: number): PlaybackType {
    return this.keyMappings.get(keyCode)?.playbackType ?? PlaybackType.OneShot;
  }
  
  // ==========================================================================
  // MODULATION
  // ==========================================================================
  
  /**
   * Set modulation enabled for a key
   */
  setKeyModulation(keyCode: number, enabled: boolean): void {
    const mapping = this.keyMappings.get(keyCode);
    if (!mapping) return;
    
    mapping.modulationEnabled = enabled;
    audioEngine.setKeyModulation(keyCode, enabled);
    this.onMappingChange?.(keyCode, mapping);
  }
  
  /**
   * Toggle modulation for a key
   */
  toggleKeyModulation(keyCode: number): boolean {
    const mapping = this.keyMappings.get(keyCode);
    if (!mapping) return false;
    
    const newEnabled = !mapping.modulationEnabled;
    this.setKeyModulation(keyCode, newEnabled);
    return newEnabled;
  }
  
  /**
   * Set global modulation preset
   */
  setModulationPreset(preset: ModulationPreset): void {
    this.modulationPreset = preset;
    audioEngine.setModulationPreset(preset);
  }
  
  /**
   * Get current modulation preset
   */
  getModulationPreset(): ModulationPreset {
    return this.modulationPreset;
  }
  
  // ==========================================================================
  // OVERLAP GROUPS
  // ==========================================================================
  
  /**
   * Set overlap mode and group for a key
   */
  setKeyOverlap(keyCode: number, mode: OverlapMode, groupId: number): void {
    const mapping = this.keyMappings.get(keyCode);
    if (!mapping) return;
    
    mapping.overlapMode = mode;
    mapping.groupId = groupId;
    audioEngine.setKeyOverlap(keyCode, mode, groupId);
    this.onMappingChange?.(keyCode, mapping);
  }
  
  /**
   * Toggle overlap mode for a key
   */
  toggleOverlapMode(keyCode: number): OverlapMode {
    const mapping = this.keyMappings.get(keyCode);
    if (!mapping) return OverlapMode.Polyphonic;
    
    const newMode = mapping.overlapMode === OverlapMode.Polyphonic
      ? OverlapMode.Monophonic
      : OverlapMode.Polyphonic;
    
    this.setKeyOverlap(keyCode, newMode, mapping.groupId);
    return newMode;
  }
  
  /**
   * Get all keys in a specific overlap group
   */
  getGroupKeys(groupId: number): number[] {
    const keys: number[] = [];
    for (const [keyCode, mapping] of this.keyMappings) {
      if (mapping.groupId === groupId) {
        keys.push(keyCode);
      }
    }
    return keys;
  }
  
  // ==========================================================================
  // VOLUME & PITCH
  // ==========================================================================
  
  /**
   * Set volume for a key
   */
  setKeyVolume(keyCode: number, volume: number): void {
    const mapping = this.keyMappings.get(keyCode);
    if (!mapping) return;
    
    mapping.volume = Math.max(0, Math.min(1, volume));
    audioEngine.setKeyVolume(keyCode, mapping.volume);
    this.onMappingChange?.(keyCode, mapping);
  }
  
  /**
   * Get volume for a key
   */
  getKeyVolume(keyCode: number): number {
    return this.keyMappings.get(keyCode)?.volume ?? 1.0;
  }
  
  /**
   * Set pitch for a key (in semitones)
   */
  setKeyPitch(keyCode: number, semitones: number): void {
    const mapping = this.keyMappings.get(keyCode);
    if (!mapping) return;
    
    mapping.pitchSemitones = Math.max(-24, Math.min(24, semitones));
    audioEngine.setKeyPitch(keyCode, mapping.pitchSemitones);
    this.onMappingChange?.(keyCode, mapping);
  }
  
  /**
   * Get pitch for a key
   */
  getKeyPitch(keyCode: number): number {
    return this.keyMappings.get(keyCode)?.pitchSemitones ?? 0;
  }
  
  // ==========================================================================
  // SERIALIZATION
  // ==========================================================================
  
  /**
   * Export all mappings (for project save)
   */
  exportMappings(): KeyMapping[] {
    return Array.from(this.keyMappings.values()).filter(m => m.hasSound);
  }
  
  /**
   * Import mappings (for project load)
   */
  importMappings(mappings: KeyMapping[]): void {
    // Reset all to defaults first
    this.initialize();
    
    // Apply imported mappings
    for (const mapping of mappings) {
      this.keyMappings.set(mapping.keyCode, mapping);
      audioEngine.setKeyMapping(mapping);
      this.onMappingChange?.(mapping.keyCode, mapping);
    }
  }
  
  /**
   * Reset a key to defaults
   */
  resetKey(keyCode: number): void {
    const defaultMapping = createDefaultKeyMapping(keyCode);
    this.keyMappings.set(keyCode, defaultMapping);
    audioEngine.setKeyMapping(defaultMapping);
    this.onMappingChange?.(keyCode, defaultMapping);
  }
  
  /**
   * Reset all keys to defaults
   */
  resetAll(): void {
    for (const keyCode of this.keyMappings.keys()) {
      this.resetKey(keyCode);
    }
    this.setModulationPreset(ModulationPreset.None);
  }
}

// Singleton instance
export const modeManager = new ModeManager();
