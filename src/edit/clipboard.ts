/**
 * Qeyloop Clipboard System
 * 
 * In-memory clipboard for cut/copy/paste operations on pads.
 * Supports two modes:
 * - Audio-only: Copies just the sound data
 * - Full pad: Copies all pad settings including audio
 * 
 * Does NOT use browser clipboard APIs.
 */

import { KeyMapping, SoundData, PlaybackMode, PlaybackType, OverlapMode, createDefaultKeyMapping } from '../types';

// ============================================================================
// CLIPBOARD TYPES
// ============================================================================

/** Type of clipboard content */
export const enum ClipboardType {
  /** No content */
  Empty = 0,
  /** Audio data only */
  AudioOnly = 1,
  /** Full pad with all settings */
  FullPad = 2,
}

/** Audio-only clipboard content */
export interface AudioClipboardData {
  type: ClipboardType.AudioOnly;
  /** Sound data (samples, name, etc.) */
  sound: SoundData;
}

/** Full pad clipboard content */
export interface FullPadClipboardData {
  type: ClipboardType.FullPad;
  /** Sound data (may be null if pad has no sound) */
  sound: SoundData | null;
  /** All pad settings */
  settings: {
    volume: number;
    pitchSemitones: number;
    mode: PlaybackMode;
    playbackType: PlaybackType;
    modulationEnabled: boolean;
    overlapMode: OverlapMode;
    groupId: number;
    pageJumpTarget: number;
    soundName: string;
    hasSound: boolean;
  };
}

/** Empty clipboard */
export interface EmptyClipboardData {
  type: ClipboardType.Empty;
}

/** Union of all clipboard content types */
export type ClipboardData = EmptyClipboardData | AudioClipboardData | FullPadClipboardData;

/** Operation that was performed (for undo/redo) */
export const enum ClipboardOperation {
  Cut = 'cut',
  Copy = 'copy',
  Paste = 'paste',
}

// ============================================================================
// CLIPBOARD MANAGER
// ============================================================================

export class ClipboardManager {
  /** Current clipboard content */
  private content: ClipboardData = { type: ClipboardType.Empty };
  
  /** Source pad keyCode (for visual feedback) */
  private sourceKeyCode: number | null = null;
  
  /** Was the last operation a cut? */
  private _wasCut = false;
  
  /** Callback for clipboard state changes */
  private onClipboardChange: ((hasContent: boolean, sourceKeyCode: number | null, wasCut: boolean) => void) | null = null;
  
  /**
   * Set callback for clipboard state changes
   */
  setClipboardChangeCallback(
    callback: (hasContent: boolean, sourceKeyCode: number | null, wasCut: boolean) => void
  ): void {
    this.onClipboardChange = callback;
  }
  
  /**
   * Copy audio only from a pad
   * @param keyCode Source pad keyCode
   * @param sound Sound data to copy
   */
  copyAudio(keyCode: number, sound: SoundData): void {
    // Clone the samples to prevent shared reference issues
    const clonedSound: SoundData = {
      ...sound,
      samples: new Float32Array(sound.samples),
    };
    
    this.content = {
      type: ClipboardType.AudioOnly,
      sound: clonedSound,
    };
    
    this.sourceKeyCode = keyCode;
    this._wasCut = false;
    
    this.notifyChange();
  }
  
  /**
   * Cut audio only from a pad
   * @param keyCode Source pad keyCode
   * @param sound Sound data to cut
   */
  cutAudio(keyCode: number, sound: SoundData): void {
    // Clone the samples to prevent shared reference issues
    const clonedSound: SoundData = {
      ...sound,
      samples: new Float32Array(sound.samples),
    };
    
    this.content = {
      type: ClipboardType.AudioOnly,
      sound: clonedSound,
    };
    
    this.sourceKeyCode = keyCode;
    this._wasCut = true;
    
    this.notifyChange();
  }
  
  /**
   * Copy full pad (audio + settings)
   * @param keyCode Source pad keyCode
   * @param mapping Pad mapping
   * @param sound Sound data (may be null)
   * @param pageJumpTarget Page jump target (-1 if none)
   */
  copyFullPad(
    keyCode: number,
    mapping: KeyMapping,
    sound: SoundData | null,
    pageJumpTarget: number
  ): void {
    // Clone sound samples if present
    const clonedSound = sound ? {
      ...sound,
      samples: new Float32Array(sound.samples),
    } : null;
    
    this.content = {
      type: ClipboardType.FullPad,
      sound: clonedSound,
      settings: {
        volume: mapping.volume,
        pitchSemitones: mapping.pitchSemitones,
        mode: mapping.mode,
        playbackType: mapping.playbackType,
        modulationEnabled: mapping.modulationEnabled,
        overlapMode: mapping.overlapMode,
        groupId: mapping.groupId,
        pageJumpTarget,
        soundName: mapping.soundName,
        hasSound: mapping.hasSound,
      },
    };
    
    this.sourceKeyCode = keyCode;
    this._wasCut = false;
    
    this.notifyChange();
  }
  
  /**
   * Cut full pad (audio + settings)
   * @param keyCode Source pad keyCode
   * @param mapping Pad mapping
   * @param sound Sound data (may be null)
   * @param pageJumpTarget Page jump target (-1 if none)
   */
  cutFullPad(
    keyCode: number,
    mapping: KeyMapping,
    sound: SoundData | null,
    pageJumpTarget: number
  ): void {
    // Clone sound samples if present
    const clonedSound = sound ? {
      ...sound,
      samples: new Float32Array(sound.samples),
    } : null;
    
    this.content = {
      type: ClipboardType.FullPad,
      sound: clonedSound,
      settings: {
        volume: mapping.volume,
        pitchSemitones: mapping.pitchSemitones,
        mode: mapping.mode,
        playbackType: mapping.playbackType,
        modulationEnabled: mapping.modulationEnabled,
        overlapMode: mapping.overlapMode,
        groupId: mapping.groupId,
        pageJumpTarget,
        soundName: mapping.soundName,
        hasSound: mapping.hasSound,
      },
    };
    
    this.sourceKeyCode = keyCode;
    this._wasCut = true;
    
    this.notifyChange();
  }
  
  /**
   * Get current clipboard content
   */
  getContent(): ClipboardData {
    return this.content;
  }
  
  /**
   * Check if clipboard has content
   */
  hasContent(): boolean {
    return this.content.type !== ClipboardType.Empty;
  }
  
  /**
   * Get clipboard type
   */
  getType(): ClipboardType {
    return this.content.type;
  }
  
  /**
   * Get source keyCode
   */
  getSourceKeyCode(): number | null {
    return this.sourceKeyCode;
  }
  
  /**
   * Check if last operation was cut
   */
  wasCut(): boolean {
    return this._wasCut;
  }
  
  /**
   * Clear clipboard after paste (for cut operations)
   */
  clearAfterPaste(): void {
    if (this._wasCut) {
      this.clear();
    }
  }
  
  /**
   * Clear clipboard completely
   */
  clear(): void {
    this.content = { type: ClipboardType.Empty };
    this.sourceKeyCode = null;
    this._wasCut = false;
    this.notifyChange();
  }
  
  /**
   * Notify listeners of clipboard change
   */
  private notifyChange(): void {
    this.onClipboardChange?.(
      this.hasContent(),
      this.sourceKeyCode,
      this._wasCut
    );
  }
}

// Singleton instance
export const clipboardManager = new ClipboardManager();
