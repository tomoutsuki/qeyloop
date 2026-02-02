/**
 * Qeyloop Command System
 * 
 * Unified command execution for clipboard, undo/redo, and file operations.
 * Maps hotkeys and toolbar actions to the same underlying logic.
 */

import { audioEngine } from '../audio/engine';
import { modeManager } from '../modes/manager';
import { pageManager } from '../pages/manager';
import { projectIO } from '../project/io';
import { clipboardManager, ClipboardType } from './clipboard';
import { historyManager, HistoryActionType } from './history';
import { createDefaultKeyMapping, SoundData, PlaybackType } from '../types';

// ============================================================================
// COMMAND TYPES
// ============================================================================

/** All available commands */
export const enum Command {
  // Clipboard - Audio only
  CopyAudio = 'copy_audio',
  CutAudio = 'cut_audio',
  
  // Clipboard - Full pad
  CopyPad = 'copy_pad',
  CutPad = 'cut_pad',
  
  // Paste (works for both)
  Paste = 'paste',
  
  // Delete
  DeleteSound = 'delete_sound',
  
  // Undo/Redo
  Undo = 'undo',
  Redo = 'redo',
  
  // File operations
  ExportPage = 'export_page',
  ExportProject = 'export_project',
  ImportPage = 'import_page',
  ImportProject = 'import_project',
  ConvertOldProject = 'convert_old_project',
}

// ============================================================================
// COMMAND EXECUTOR
// ============================================================================

export class CommandExecutor {
  /** Currently selected pad keyCode */
  private selectedPadKeyCode: number | null = null;
  
  /** Callback for UI refresh */
  private onRefreshUI: (() => void) | null = null;
  
  /** Callback for status messages */
  private onStatusMessage: ((message: string) => void) | null = null;
  
  /**
   * Set the currently selected pad
   */
  setSelectedPad(keyCode: number | null): void {
    this.selectedPadKeyCode = keyCode;
  }
  
  /**
   * Get the currently selected pad
   */
  getSelectedPad(): number | null {
    return this.selectedPadKeyCode;
  }
  
  /**
   * Set UI refresh callback
   */
  setRefreshCallback(callback: () => void): void {
    this.onRefreshUI = callback;
  }
  
  /**
   * Set status message callback
   */
  setStatusCallback(callback: (message: string) => void): void {
    this.onStatusMessage = callback;
  }
  
  /**
   * Execute a command
   */
  execute(command: Command): boolean {
    switch (command) {
      case Command.CopyAudio:
        return this.copyAudio();
      case Command.CutAudio:
        return this.cutAudio();
      case Command.CopyPad:
        return this.copyPad();
      case Command.CutPad:
        return this.cutPad();
      case Command.Paste:
        return this.paste();
      case Command.DeleteSound:
        return this.deleteSound();
      case Command.Undo:
        return this.undo();
      case Command.Redo:
        return this.redo();
      case Command.ExportPage:
        this.exportPage();
        return true;
      case Command.ExportProject:
        this.exportProject();
        return true;
      case Command.ImportPage:
        this.importPage();
        return true;
      case Command.ImportProject:
        this.importProject();
        return true;
      case Command.ConvertOldProject:
        this.convertOldProject();
        return true;
      default:
        return false;
    }
  }
  
  // ==========================================================================
  // CLIPBOARD: AUDIO ONLY
  // ==========================================================================
  
  /**
   * Copy audio only from selected pad
   */
  private copyAudio(): boolean {
    if (this.selectedPadKeyCode === null) {
      this.showStatus('No pad selected');
      return false;
    }
    
    const keyCode = this.selectedPadKeyCode;
    const mapping = modeManager.getMapping(keyCode);
    
    if (!mapping?.hasSound) {
      this.showStatus('Selected pad has no sound');
      return false;
    }
    
    // Get sound data from page manager
    const page = pageManager.getActivePage();
    const sound = page?.sounds.get(mapping.soundIndex);
    
    if (!sound) {
      this.showStatus('Sound data not found');
      return false;
    }
    
    clipboardManager.copyAudio(keyCode, sound);
    this.showStatus('Audio copied');
    return true;
  }
  
  /**
   * Cut audio only from selected pad
   */
  private cutAudio(): boolean {
    if (this.selectedPadKeyCode === null) {
      this.showStatus('No pad selected');
      return false;
    }
    
    const keyCode = this.selectedPadKeyCode;
    const mapping = modeManager.getMapping(keyCode);
    
    if (!mapping?.hasSound) {
      this.showStatus('Selected pad has no sound');
      return false;
    }
    
    // Get sound data from page manager
    const page = pageManager.getActivePage();
    const sound = page?.sounds.get(mapping.soundIndex);
    
    if (!sound) {
      this.showStatus('Sound data not found');
      return false;
    }
    
    // Record state before cut
    const beforeState = historyManager.createPadSnapshot(keyCode);
    
    // Copy to clipboard
    clipboardManager.cutAudio(keyCode, sound);
    
    // Clear the pad's sound
    this.clearPadSound(keyCode);
    
    // Record state after cut
    const afterState = historyManager.createPadSnapshot(keyCode);
    historyManager.recordAction(
      HistoryActionType.Cut,
      `Cut audio from pad`,
      [keyCode],
      [beforeState],
      [afterState]
    );
    
    // Save page state
    pageManager.saveCurrentPageState();
    
    this.onRefreshUI?.();
    this.showStatus('Audio cut');
    return true;
  }
  
  // ==========================================================================
  // CLIPBOARD: FULL PAD
  // ==========================================================================
  
  /**
   * Copy full pad (audio + settings)
   */
  private copyPad(): boolean {
    if (this.selectedPadKeyCode === null) {
      this.showStatus('No pad selected');
      return false;
    }
    
    const keyCode = this.selectedPadKeyCode;
    const mapping = modeManager.getMapping(keyCode);
    
    if (!mapping) {
      this.showStatus('No mapping for selected pad');
      return false;
    }
    
    // Get sound data if present
    const page = pageManager.getActivePage();
    const sound = mapping.hasSound ? page?.sounds.get(mapping.soundIndex) ?? null : null;
    const pageJumpTarget = page?.padPageJumps.get(keyCode) ?? -1;
    
    clipboardManager.copyFullPad(keyCode, mapping, sound, pageJumpTarget);
    this.showStatus('Pad copied');
    return true;
  }
  
  /**
   * Cut full pad (audio + settings)
   */
  private cutPad(): boolean {
    if (this.selectedPadKeyCode === null) {
      this.showStatus('No pad selected');
      return false;
    }
    
    const keyCode = this.selectedPadKeyCode;
    const mapping = modeManager.getMapping(keyCode);
    
    if (!mapping) {
      this.showStatus('No mapping for selected pad');
      return false;
    }
    
    // Get sound data if present
    const page = pageManager.getActivePage();
    const sound = mapping.hasSound ? page?.sounds.get(mapping.soundIndex) ?? null : null;
    const pageJumpTarget = page?.padPageJumps.get(keyCode) ?? -1;
    
    // Record state before cut
    const beforeState = historyManager.createPadSnapshot(keyCode);
    
    // Copy to clipboard
    clipboardManager.cutFullPad(keyCode, mapping, sound, pageJumpTarget);
    
    // Clear the pad completely
    this.clearPad(keyCode);
    
    // Record state after cut
    const afterState = historyManager.createPadSnapshot(keyCode);
    historyManager.recordAction(
      HistoryActionType.Cut,
      `Cut pad`,
      [keyCode],
      [beforeState],
      [afterState]
    );
    
    // Save page state
    pageManager.saveCurrentPageState();
    
    this.onRefreshUI?.();
    this.showStatus('Pad cut');
    return true;
  }
  
  // ==========================================================================
  // PASTE
  // ==========================================================================
  
  /**
   * Paste clipboard content to selected pad
   */
  private paste(): boolean {
    if (this.selectedPadKeyCode === null) {
      this.showStatus('No pad selected');
      return false;
    }
    
    if (!clipboardManager.hasContent()) {
      this.showStatus('Clipboard is empty');
      return false;
    }
    
    const keyCode = this.selectedPadKeyCode;
    const content = clipboardManager.getContent();
    
    // Check if this is a cut operation (to restore source on undo)
    const wasCut = clipboardManager.wasCut();
    const sourceKeyCode = clipboardManager.getSourceKeyCode();
    
    // Record state before paste
    const beforeStates: any[] = [];
    const afterStates: any[] = [];
    const affectedPads: number[] = [keyCode];
    
    beforeStates.push(historyManager.createPadSnapshot(keyCode));
    
    // If pasting from a cut, also capture the source pad for undo
    if (wasCut && sourceKeyCode !== null && sourceKeyCode !== keyCode) {
      beforeStates.push(historyManager.createPadSnapshot(sourceKeyCode));
      affectedPads.push(sourceKeyCode);
    }
    
    // Perform the paste
    if (content.type === ClipboardType.AudioOnly) {
      this.pasteAudio(keyCode, content.sound);
    } else if (content.type === ClipboardType.FullPad) {
      this.pasteFullPad(keyCode, content);
    }
    
    // Record state after paste
    afterStates.push(historyManager.createPadSnapshot(keyCode));
    
    // If it was a cut, the source pad is now empty (already cut), capture that
    if (wasCut && sourceKeyCode !== null && sourceKeyCode !== keyCode) {
      afterStates.push(historyManager.createPadSnapshot(sourceKeyCode));
    }
    
    historyManager.recordAction(
      HistoryActionType.Paste,
      `Paste to pad`,
      affectedPads,
      beforeStates,
      afterStates
    );
    
    // Save page state
    pageManager.saveCurrentPageState();
    
    // Clear clipboard if it was a cut
    clipboardManager.clearAfterPaste();
    
    this.onRefreshUI?.();
    this.showStatus('Pasted');
    return true;
  }
  
  /**
   * Paste audio only to a pad
   */
  private pasteAudio(keyCode: number, sound: SoundData): void {
    const page = pageManager.getActivePage();
    if (!page) return;
    
    // Clear any existing sound at destination pad first
    const existingMapping = modeManager.getMapping(keyCode);
    if (existingMapping?.hasSound) {
      const existingIndex = pageManager.getKeySoundIndex(keyCode);
      if (existingIndex !== undefined) {
        page.sounds.delete(existingIndex);
        page.keySoundIndices.delete(keyCode);
      }
    }
    
    // Allocate new sound slot
    const soundIndex = pageManager.incrementNextSoundIndex();
    
    // Clone sound with new index
    const newSound: SoundData = {
      ...sound,
      index: soundIndex,
      samples: new Float32Array(sound.samples),
    };
    
    // Load into audio engine
    audioEngine.loadSoundFromSamples(soundIndex, newSound.name, newSound.samples);
    
    // Store in page manager
    pageManager.storeSoundData(soundIndex, newSound);
    pageManager.setKeySoundIndex(keyCode, soundIndex);
    
    // Update mapping
    modeManager.assignSound(keyCode, soundIndex, newSound.name);
  }
  
  /**
   * Paste full pad (audio + settings)
   */
  private pasteFullPad(keyCode: number, content: import('./clipboard').FullPadClipboardData): void {
    const page = pageManager.getActivePage();
    if (!page) return;
    
    // Clear any existing sound at destination pad first
    const existingMapping = modeManager.getMapping(keyCode);
    if (existingMapping?.hasSound) {
      const existingIndex = pageManager.getKeySoundIndex(keyCode);
      if (existingIndex !== undefined) {
        page.sounds.delete(existingIndex);
        page.keySoundIndices.delete(keyCode);
      }
    }
    
    // Handle sound
    let soundIndex = 0;
    let hasSound = false;
    
    if (content.sound && content.settings.hasSound) {
      soundIndex = pageManager.incrementNextSoundIndex();
      
      const newSound: SoundData = {
        ...content.sound,
        index: soundIndex,
        samples: new Float32Array(content.sound.samples),
      };
      
      audioEngine.loadSoundFromSamples(soundIndex, newSound.name, newSound.samples);
      pageManager.storeSoundData(soundIndex, newSound);
      pageManager.setKeySoundIndex(keyCode, soundIndex);
      hasSound = true;
    } else {
      // No sound to paste - clear the keyCode's sound association
      page.keySoundIndices.delete(keyCode);
      soundIndex = -1;
    }
    
    // Build new mapping
    const mapping = {
      keyCode,
      soundIndex,
      soundName: hasSound ? content.settings.soundName : '',
      mode: content.settings.mode,
      playbackType: content.settings.playbackType ?? PlaybackType.OneShot,
      overlapMode: content.settings.overlapMode,
      groupId: content.settings.groupId,
      volume: content.settings.volume,
      pitchSemitones: content.settings.pitchSemitones,
      modulationEnabled: content.settings.modulationEnabled,
      hasSound,
    };
    
    // Apply mapping
    modeManager.setMapping(mapping);
    pageManager.setKeyMapping(keyCode, mapping);
    
    // Apply page jump if set
    if (content.settings.pageJumpTarget >= 0) {
      pageManager.setPadPageJump(keyCode, content.settings.pageJumpTarget);
    } else {
      page.padPageJumps.delete(keyCode);
    }
  }
  
  // ==========================================================================
  // UNDO / REDO
  // ==========================================================================
  
  /**
   * Undo last action
   */
  private undo(): boolean {
    if (!historyManager.canUndo()) {
      this.showStatus('Nothing to undo');
      return false;
    }
    
    historyManager.undo();
    this.onRefreshUI?.();
    this.showStatus('Undo');
    return true;
  }
  
  /**
   * Redo last undone action
   */
  private redo(): boolean {
    if (!historyManager.canRedo()) {
      this.showStatus('Nothing to redo');
      return false;
    }
    
    historyManager.redo();
    this.onRefreshUI?.();
    this.showStatus('Redo');
    return true;
  }
  
  // ==========================================================================
  // FILE OPERATIONS
  // ==========================================================================
  
  private exportPage(): void {
    projectIO.exportPage();
    this.showStatus('Exporting page...');
  }
  
  private exportProject(): void {
    projectIO.exportProject('qeyloop-project');
    this.showStatus('Exporting project...');
  }
  
  private importPage(): void {
    const input = projectIO.createPageImportInput();
    input.click();
  }
  
  private importProject(): void {
    const input = projectIO.createProjectImportInput();
    input.click();
  }
  
  private convertOldProject(): void {
    // Create file input for old .qeyloop format
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.qeyloop';
    input.click();
    
    this.showStatus('Select old .qeyloop file to convert');
  }
  
  // ==========================================================================
  // DELETE SOUND
  // ==========================================================================
  
  /**
   * Delete sound from selected pad
   */
  private deleteSound(): boolean {
    if (this.selectedPadKeyCode === null) {
      this.showStatus('No pad selected');
      return false;
    }
    
    const keyCode = this.selectedPadKeyCode;
    const mapping = modeManager.getMapping(keyCode);
    
    if (!mapping?.hasSound) {
      this.showStatus('Selected pad has no sound');
      return false;
    }
    
    // Record state before delete
    const beforeState = historyManager.createPadSnapshot(keyCode);
    
    // Clear the pad's sound and settings
    this.clearPad(keyCode);
    
    // Record state after delete
    const afterState = historyManager.createPadSnapshot(keyCode);
    historyManager.recordAction(
      HistoryActionType.Clear,
      `Delete sound from pad`,
      [keyCode],
      [beforeState],
      [afterState]
    );
    
    // Save page state
    pageManager.saveCurrentPageState();
    
    this.onRefreshUI?.();
    this.showStatus('Sound deleted');
    return true;
  }
  
  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================
  
  /**
   * Clear just the sound from a pad
   */
  private clearPadSound(keyCode: number): void {
    const mapping = modeManager.getMapping(keyCode);
    if (!mapping) return;
    
    const page = pageManager.getActivePage();
    if (!page) return;
    
    // Remove sound data
    if (mapping.hasSound) {
      page.sounds.delete(mapping.soundIndex);
      page.keySoundIndices.delete(keyCode);
    }
    
    // Reset mapping to no sound
    const newMapping = {
      ...mapping,
      hasSound: false,
      soundIndex: -1,
      soundName: '',
    };
    
    modeManager.setMapping(newMapping);
    pageManager.setKeyMapping(keyCode, newMapping);
  }
  
  /**
   * Clear a pad completely (sound + settings)
   */
  private clearPad(keyCode: number): void {
    const page = pageManager.getActivePage();
    if (!page) return;
    
    const mapping = modeManager.getMapping(keyCode);
    
    // Remove sound data
    if (mapping?.hasSound) {
      page.sounds.delete(mapping.soundIndex);
      page.keySoundIndices.delete(keyCode);
    }
    
    // Remove page jump
    page.padPageJumps.delete(keyCode);
    
    // Reset to default mapping
    const defaultMapping = createDefaultKeyMapping(keyCode);
    modeManager.setMapping(defaultMapping);
    pageManager.setKeyMapping(keyCode, defaultMapping);
  }
  
  /**
   * Show status message
   */
  private showStatus(message: string): void {
    this.onStatusMessage?.(message);
    console.log(`[Command] ${message}`);
  }
}

// Singleton instance
export const commandExecutor = new CommandExecutor();
