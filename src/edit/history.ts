/**
 * Qeyloop Undo/Redo History Manager
 * 
 * Page-scoped undo/redo system with maximum 20 steps.
 * Stores immutable snapshots of pad state for reliable restoration.
 * 
 * Does NOT interact with AudioWorklet - only UI and project state.
 */

import { KeyMapping, SoundData, createDefaultKeyMapping } from '../types';
import { pageManager } from '../pages/manager';
import { modeManager } from '../modes/manager';
import { audioEngine } from '../audio/engine';

// ============================================================================
// HISTORY TYPES
// ============================================================================

/** Maximum undo steps per page */
const MAX_HISTORY_SIZE = 20;

/** Type of action that created this history entry */
export const enum HistoryActionType {
  /** Audio was added or changed */
  AudioChange = 'audio_change',
  /** Audio was removed */
  AudioRemove = 'audio_remove',
  /** Pad settings changed */
  SettingsChange = 'settings_change',
  /** Cut operation */
  Cut = 'cut',
  /** Paste operation */
  Paste = 'paste',
  /** Pad cleared */
  Clear = 'clear',
}

/** Snapshot of a single pad's state */
export interface PadSnapshot {
  keyCode: number;
  mapping: KeyMapping;
  sound: SoundData | null;
  pageJumpTarget: number;
}

/** A single history entry */
export interface HistoryEntry {
  /** Type of action */
  actionType: HistoryActionType;
  /** Description for potential UI display */
  description: string;
  /** Affected pad keyCodes */
  affectedPads: number[];
  /** Pad states BEFORE the action */
  beforeState: Map<number, PadSnapshot>;
  /** Pad states AFTER the action */
  afterState: Map<number, PadSnapshot>;
  /** Timestamp */
  timestamp: number;
}

/** History stack for a single page */
interface PageHistory {
  /** Undo stack (most recent at end) */
  undoStack: HistoryEntry[];
  /** Redo stack (most recent at end) */
  redoStack: HistoryEntry[];
}

// ============================================================================
// HISTORY MANAGER
// ============================================================================

export class HistoryManager {
  /** History per page index */
  private pageHistories: Map<number, PageHistory> = new Map();
  
  /** Callback for history state changes */
  private onHistoryChange: ((canUndo: boolean, canRedo: boolean) => void) | null = null;
  
  /**
   * Set callback for history state changes
   */
  setHistoryChangeCallback(callback: (canUndo: boolean, canRedo: boolean) => void): void {
    this.onHistoryChange = callback;
  }
  
  /**
   * Get or create history for a page
   */
  private getPageHistory(pageIndex: number): PageHistory {
    let history = this.pageHistories.get(pageIndex);
    if (!history) {
      history = { undoStack: [], redoStack: [] };
      this.pageHistories.set(pageIndex, history);
    }
    return history;
  }
  
  /**
   * Get current page's history
   */
  private getCurrentHistory(): PageHistory {
    return this.getPageHistory(pageManager.getActivePageIndex());
  }
  
  /**
   * Create a snapshot of a pad's current state
   */
  createPadSnapshot(keyCode: number): PadSnapshot {
    const mapping = modeManager.getMapping(keyCode);
    const page = pageManager.getActivePage();
    
    // Get sound data if pad has sound
    let sound: SoundData | null = null;
    if (mapping?.hasSound && mapping.soundIndex !== undefined) {
      const pageSound = page?.sounds.get(mapping.soundIndex);
      if (pageSound) {
        // Clone the sound data
        sound = {
          ...pageSound,
          samples: new Float32Array(pageSound.samples),
        };
      }
    }
    
    // Get page jump target
    const pageJumpTarget = page?.padPageJumps.get(keyCode) ?? -1;
    
    return {
      keyCode,
      mapping: mapping ? { ...mapping } : createDefaultKeyMapping(keyCode),
      sound,
      pageJumpTarget,
    };
  }
  
  /**
   * Record an action for undo/redo
   * @param actionType Type of action
   * @param description Human-readable description
   * @param affectedPads KeyCodes of affected pads
   * @param beforeStates Snapshots BEFORE the action (call createPadSnapshot before making changes)
   * @param afterStates Snapshots AFTER the action (call createPadSnapshot after making changes)
   */
  recordAction(
    actionType: HistoryActionType,
    description: string,
    affectedPads: number[],
    beforeStates: PadSnapshot[],
    afterStates: PadSnapshot[]
  ): void {
    const history = this.getCurrentHistory();
    
    // Convert arrays to maps
    const beforeMap = new Map<number, PadSnapshot>();
    const afterMap = new Map<number, PadSnapshot>();
    
    for (const snapshot of beforeStates) {
      beforeMap.set(snapshot.keyCode, snapshot);
    }
    for (const snapshot of afterStates) {
      afterMap.set(snapshot.keyCode, snapshot);
    }
    
    // Create history entry
    const entry: HistoryEntry = {
      actionType,
      description,
      affectedPads,
      beforeState: beforeMap,
      afterState: afterMap,
      timestamp: Date.now(),
    };
    
    // Add to undo stack
    history.undoStack.push(entry);
    
    // Enforce max history size
    while (history.undoStack.length > MAX_HISTORY_SIZE) {
      history.undoStack.shift();
    }
    
    // Clear redo stack (new action invalidates redo)
    history.redoStack = [];
    
    this.notifyChange();
  }
  
  /**
   * Undo the last action
   * @returns True if undo was performed
   */
  undo(): boolean {
    const history = this.getCurrentHistory();
    
    if (history.undoStack.length === 0) {
      return false;
    }
    
    // Pop from undo stack
    const entry = history.undoStack.pop()!;
    
    // Restore before states
    this.restoreStates(entry.beforeState);
    
    // Push to redo stack
    history.redoStack.push(entry);
    
    // Enforce max redo size
    while (history.redoStack.length > MAX_HISTORY_SIZE) {
      history.redoStack.shift();
    }
    
    this.notifyChange();
    
    return true;
  }
  
  /**
   * Redo the last undone action
   * @returns True if redo was performed
   */
  redo(): boolean {
    const history = this.getCurrentHistory();
    
    if (history.redoStack.length === 0) {
      return false;
    }
    
    // Pop from redo stack
    const entry = history.redoStack.pop()!;
    
    // Restore after states
    this.restoreStates(entry.afterState);
    
    // Push to undo stack
    history.undoStack.push(entry);
    
    this.notifyChange();
    
    return true;
  }
  
  /**
   * Restore pad states from snapshots
   */
  private restoreStates(states: Map<number, PadSnapshot>): void {
    const page = pageManager.getActivePage();
    if (!page) return;
    
    for (const [keyCode, snapshot] of states) {
      // Restore mapping
      modeManager.setMapping(snapshot.mapping);
      pageManager.setKeyMapping(keyCode, snapshot.mapping);
      
      // Restore sound data if present
      if (snapshot.sound) {
        const soundIndex = snapshot.mapping.soundIndex;
        
        // Store in page manager
        pageManager.storeSoundData(soundIndex, snapshot.sound);
        pageManager.setKeySoundIndex(keyCode, soundIndex);
        
        // Load into audio engine
        audioEngine.loadSoundFromSamples(
          soundIndex,
          snapshot.sound.name,
          snapshot.sound.samples
        );
      } else if (snapshot.mapping.hasSound === false) {
        // Clear sound association
        const existingIndex = pageManager.getKeySoundIndex(keyCode);
        if (existingIndex !== undefined) {
          page.sounds.delete(existingIndex);
          page.keySoundIndices.delete(keyCode);
        }
      }
      
      // Restore page jump target
      if (snapshot.pageJumpTarget >= 0) {
        pageManager.setPadPageJump(keyCode, snapshot.pageJumpTarget);
      } else {
        page.padPageJumps.delete(keyCode);
      }
    }
    
    // Save page state
    pageManager.saveCurrentPageState();
  }
  
  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.getCurrentHistory().undoStack.length > 0;
  }
  
  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.getCurrentHistory().redoStack.length > 0;
  }
  
  /**
   * Get undo stack size for current page
   */
  getUndoCount(): number {
    return this.getCurrentHistory().undoStack.length;
  }
  
  /**
   * Get redo stack size for current page
   */
  getRedoCount(): number {
    return this.getCurrentHistory().redoStack.length;
  }
  
  /**
   * Clear history for current page
   */
  clearCurrentPage(): void {
    const pageIndex = pageManager.getActivePageIndex();
    this.pageHistories.delete(pageIndex);
    this.notifyChange();
  }
  
  /**
   * Clear all history
   */
  clearAll(): void {
    this.pageHistories.clear();
    this.notifyChange();
  }
  
  /**
   * Notify listeners of history change
   */
  private notifyChange(): void {
    this.onHistoryChange?.(this.canUndo(), this.canRedo());
  }
}

// Singleton instance
export const historyManager = new HistoryManager();
