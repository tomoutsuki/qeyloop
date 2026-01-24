/**
 * Qeyloop Hotkey Handler
 * 
 * Handles keyboard shortcuts for clipboard operations and undo/redo.
 * Separate from the launchpad keyboard handler to avoid conflicts.
 */

import { Command, commandExecutor } from '../edit/commands';
import { clipboardManager } from '../edit/clipboard';

// ============================================================================
// HOTKEY DEFINITIONS
// ============================================================================

interface HotkeyDef {
  key: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  command: Command;
  description: string;
}

/** All registered hotkeys */
const HOTKEYS: HotkeyDef[] = [
  // Clipboard - Audio only
  { key: 'c', ctrl: true, shift: false, alt: false, command: Command.CopyAudio, description: 'Copy audio' },
  { key: 'x', ctrl: true, shift: false, alt: false, command: Command.CutAudio, description: 'Cut audio' },
  { key: 'v', ctrl: true, shift: false, alt: false, command: Command.Paste, description: 'Paste' },
  
  // Clipboard - Full pad
  { key: 'c', ctrl: true, shift: true, alt: false, command: Command.CopyPad, description: 'Copy pad (full)' },
  { key: 'x', ctrl: true, shift: true, alt: false, command: Command.CutPad, description: 'Cut pad (full)' },
  
  // Undo/Redo
  { key: 'z', ctrl: true, shift: false, alt: false, command: Command.Undo, description: 'Undo' },
  { key: 'y', ctrl: true, shift: false, alt: false, command: Command.Redo, description: 'Redo' },
  { key: 'z', ctrl: true, shift: true, alt: false, command: Command.Redo, description: 'Redo (alt)' },
  
  // File operations
  { key: 's', ctrl: true, shift: false, alt: false, command: Command.ExportProject, description: 'Save project' },
  { key: 's', ctrl: true, shift: true, alt: false, command: Command.ExportPage, description: 'Save current page' },
  { key: 'o', ctrl: true, shift: false, alt: false, command: Command.ImportProject, description: 'Open project' },
  { key: 'o', ctrl: true, shift: true, alt: false, command: Command.ImportPage, description: 'Import page' },
];

// ============================================================================
// HOTKEY HANDLER
// ============================================================================

export class HotkeyHandler {
  /** Whether hotkey handling is enabled */
  private enabled = true;
  
  /** Callback for clipboard state changes (for UI updates) */
  private onClipboardChange: (() => void) | null = null;
  
  /**
   * Initialize hotkey handling
   */
  initialize(): void {
    // Use capture phase for priority over other handlers
    document.addEventListener('keydown', this.handleKeyDown.bind(this), { capture: true });
  }
  
  /**
   * Set clipboard change callback
   */
  setClipboardChangeCallback(callback: () => void): void {
    this.onClipboardChange = callback;
  }
  
  /**
   * Handle keydown for hotkeys
   */
  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.enabled) return;
    
    // Skip if typing in input field
    if (this.isTypingContext(event)) return;
    
    // Check for matching hotkey
    const hotkey = this.findMatchingHotkey(event);
    if (!hotkey) return;
    
    // Prevent default browser behavior
    event.preventDefault();
    event.stopPropagation();
    
    // Execute the command
    const success = commandExecutor.execute(hotkey.command);
    
    // Notify UI of clipboard changes if relevant
    if (success && this.isClipboardCommand(hotkey.command)) {
      this.onClipboardChange?.();
    }
  }
  
  /**
   * Find hotkey that matches the event
   */
  private findMatchingHotkey(event: KeyboardEvent): HotkeyDef | null {
    const key = event.key.toLowerCase();
    
    for (const hotkey of HOTKEYS) {
      if (hotkey.key === key &&
          hotkey.ctrl === event.ctrlKey &&
          hotkey.shift === event.shiftKey &&
          hotkey.alt === event.altKey) {
        return hotkey;
      }
    }
    
    return null;
  }
  
  /**
   * Check if command affects clipboard
   */
  private isClipboardCommand(command: Command): boolean {
    return command === Command.CopyAudio ||
           command === Command.CutAudio ||
           command === Command.CopyPad ||
           command === Command.CutPad ||
           command === Command.Paste;
  }
  
  /**
   * Check if user is typing in an input field
   */
  private isTypingContext(event: KeyboardEvent): boolean {
    const target = event.target as HTMLElement;
    const tagName = target.tagName.toLowerCase();
    
    if (tagName === 'input' || tagName === 'textarea') {
      return true;
    }
    
    if (target.isContentEditable) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Enable hotkey handling
   */
  enable(): void {
    this.enabled = true;
  }
  
  /**
   * Disable hotkey handling
   */
  disable(): void {
    this.enabled = false;
  }
  
  /**
   * Get all registered hotkeys for help/menu display
   */
  static getHotkeyList(): Array<{ key: string; description: string }> {
    return HOTKEYS.map(h => {
      let keyStr = '';
      if (h.ctrl) keyStr += 'Ctrl+';
      if (h.shift) keyStr += 'Shift+';
      if (h.alt) keyStr += 'Alt+';
      keyStr += h.key.toUpperCase();
      return { key: keyStr, description: h.description };
    });
  }
}

// Singleton instance
export const hotkeyHandler = new HotkeyHandler();
