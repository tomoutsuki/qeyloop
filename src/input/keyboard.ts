/**
 * Qeyloop Keyboard Input Handler
 * 
 * Captures keyboard events and translates them to note triggers.
 * Handles key repeat prevention and tracks held keys.
 * Supports pad-triggered page jumps.
 */

import { audioEngine } from '../audio/engine';
import { pageManager } from '../pages/manager';
import { KEY_CODES } from '../types';

// ============================================================================
// KEYBOARD HANDLER
// ============================================================================

export class KeyboardHandler {
  /** Set of currently held keys (prevents key repeat triggers) */
  private heldKeys: Set<number> = new Set();
  
  /** Whether keyboard input is enabled */
  private enabled = true;
  
  /** Track if RShift (playable pad) is currently held */
  private isRightShiftHeld = false;
  
  /** Callback for key state changes (for UI) */
  private onKeyStateChange: ((keyCode: number, pressed: boolean) => void) | null = null;
  
  /**
   * Initialize keyboard handling
   */
  initialize(): void {
    // Use capture phase for lowest latency
    document.addEventListener('keydown', this.handleKeyDown.bind(this), { capture: true });
    document.addEventListener('keyup', this.handleKeyUp.bind(this), { capture: true });
    
    // Handle window blur (release all keys)
    window.addEventListener('blur', this.releaseAllKeys.bind(this));
  }
  
  /**
   * Set callback for key state changes
   */
  setKeyStateCallback(callback: (keyCode: number, pressed: boolean) => void): void {
    this.onKeyStateChange = callback;
  }
  
  /**
   * Handle key down event
   */
  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.enabled) return;
    
    // Ignore if typing in an input field
    if (this.isTypingContext(event)) return;
    
    // Get the key code
    const keyCode = this.getKeyCode(event);
    
    // Check if this key is in our launchpad layout
    if (!this.isLaunchpadKey(keyCode)) return;
    
    // Ignore if using hotkey modifiers for combinations (but allow RShift itself)
    // Only block when LEFT shift is pressed (for hotkeys), not RIGHT shift (which is a pad)
    const isRightShift = event.code === 'ShiftRight';
    // If shiftKey is true but RShift is held, it's RShift not left shift
    const isLeftShiftPressed = event.shiftKey && !this.isRightShiftHeld;
    if (!isRightShift && (isLeftShiftPressed || event.ctrlKey || event.altKey || event.metaKey)) return;
    
    // Prevent key repeat
    if (this.heldKeys.has(keyCode)) return;
    
    // Prevent default browser behavior for our keys
    event.preventDefault();
    
    // Mark key as held
    this.heldKeys.add(keyCode);
    
    // Track RShift state
    if (isRightShift) {
      this.isRightShiftHeld = true;
    }
    
    console.log(`KeyboardHandler: noteOn(${keyCode}) triggered by event.code=${event.code}, event.key=${event.key}`);
    
    // Debug: check what mapping this key has
    const mapping = (window as any).modeManager?.getMapping?.(keyCode);
    if (mapping) {
      console.log(`  → Key ${keyCode} mapping: soundIndex=${mapping.soundIndex}, hasSound=${mapping.hasSound}, soundName=${mapping.soundName}`);
    }
    
    // === PAD-TRIGGERED PAGE JUMP ===
    // Check if this pad should trigger a page jump (but don't execute yet)
    const targetPage = pageManager.checkPadJump(keyCode);
    
    // Trigger note FIRST (on current page)
    audioEngine.noteOn(keyCode);
    
    // Execute page jump AFTER sound triggers (if configured)
    if (targetPage >= 0) {
      pageManager.executePageJump(targetPage);
    }
    
    // Notify UI
    this.onKeyStateChange?.(keyCode, true);
  }
  
  /**
   * Handle key up event
   */
  private handleKeyUp(event: KeyboardEvent): void {
    if (!this.enabled) return;
    
    const keyCode = this.getKeyCode(event);
    
    // Check if this key is in our launchpad layout
    if (!this.isLaunchpadKey(keyCode)) return;
    
    // Prevent default
    event.preventDefault();
    
    // Mark key as released
    this.heldKeys.delete(keyCode);
    
    // Track RShift state
    if (event.code === 'ShiftRight') {
      this.isRightShiftHeld = false;
    }
    
    // Release note
    audioEngine.noteOff(keyCode);
    
    // Notify UI
    this.onKeyStateChange?.(keyCode, false);
  }
  
  /**
   * Get normalized key code from event
   * Uses event.code for layout-independent mapping
   */
  private getKeyCode(event: KeyboardEvent): number {
    // Map event.code directly to keyCodes for consistent behavior
    const codeToKeyCode: { [code: string]: number } = {
      // Main grid
      'Digit1': 49, 'Digit2': 50, 'Digit3': 51, 'Digit4': 52, 'Digit5': 53,
      'Digit6': 54, 'Digit7': 55, 'Digit8': 56, 'Digit9': 57, 'Digit0': 48,
      'KeyQ': 81, 'KeyW': 87, 'KeyE': 69, 'KeyR': 82, 'KeyT': 84,
      'KeyY': 89, 'KeyU': 85, 'KeyI': 73, 'KeyO': 79, 'KeyP': 80,
      'KeyA': 65, 'KeyS': 83, 'KeyD': 68, 'KeyF': 70, 'KeyG': 71,
      'KeyH': 72, 'KeyJ': 74, 'KeyK': 75, 'KeyL': 76, 'Semicolon': 186,
      'KeyZ': 90, 'KeyX': 88, 'KeyC': 67, 'KeyV': 86, 'KeyB': 66,
      'KeyN': 78, 'KeyM': 77, 'Comma': 188, 'Period': 190, 'Slash': 191,
      // Extended keys
      'ShiftRight': 16,
      'BracketLeft': 219, 'BracketRight': 221,
      'Backslash': 220, 'Minus': 189, 'Equal': 187,
      'Enter': 13, 'Quote': 222, 'Backquote': 192,
    };
    
    return codeToKeyCode[event.code] || 0;
  }
  
  /**
   * Check if a key code is part of the launchpad layout
   */
  private isLaunchpadKey(keyCode: number): boolean {
    const validCodes = new Set(Object.values(KEY_CODES));
    return validCodes.has(keyCode);
  }
  
  /**
   * Check if user is typing in an input field
   */
  private isTypingContext(event: KeyboardEvent): boolean {
    const target = event.target as HTMLElement;
    const tagName = target.tagName.toLowerCase();
    
    // Allow typing in input fields
    if (tagName === 'input' || tagName === 'textarea') {
      return true;
    }
    
    // Check for contenteditable
    if (target.isContentEditable) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Release all held keys (e.g., on window blur)
   */
  releaseAllKeys(): void {
    for (const keyCode of this.heldKeys) {
      audioEngine.noteOff(keyCode);
      this.onKeyStateChange?.(keyCode, false);
    }
    this.heldKeys.clear();
    this.isRightShiftHeld = false;
  }
  
  /**
   * Check if right shift (playable pad) is currently held
   */
  isRightShiftPressed(): boolean {
    return this.isRightShiftHeld;
  }
  
  /**
   * Enable keyboard input
   */
  enable(): void {
    this.enabled = true;
  }
  
  /**
   * Disable keyboard input
   */
  disable(): void {
    this.enabled = false;
    this.releaseAllKeys();
  }
  
  /**
   * Check if a key is currently held
   */
  isKeyHeld(keyCode: number): boolean {
    return this.heldKeys.has(keyCode);
  }
  
  /**
   * Get all currently held keys
   */
  getHeldKeys(): number[] {
    return Array.from(this.heldKeys);
  }
}

// Singleton instance
export const keyboardHandler = new KeyboardHandler();
