/**
 * Qeyloop Keyboard Input Handler
 * 
 * Captures keyboard events and translates them to note triggers.
 * Handles key repeat prevention and tracks held keys.
 */

import { audioEngine } from '../audio/engine';
import { KEY_CODES } from '../types';

// ============================================================================
// KEYBOARD HANDLER
// ============================================================================

export class KeyboardHandler {
  /** Set of currently held keys (prevents key repeat triggers) */
  private heldKeys: Set<number> = new Set();
  
  /** Whether keyboard input is enabled */
  private enabled = true;
  
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
    
    // Prevent key repeat
    if (this.heldKeys.has(keyCode)) return;
    
    // Prevent default browser behavior for our keys
    event.preventDefault();
    
    // Mark key as held
    this.heldKeys.add(keyCode);
    
    // Trigger note
    audioEngine.noteOn(keyCode);
    
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
    // Map event.code to our key codes for consistent behavior
    // across different keyboard layouts
    const codeToKey: { [code: string]: string } = {
      'Digit1': '1', 'Digit2': '2', 'Digit3': '3', 'Digit4': '4', 'Digit5': '5',
      'Digit6': '6', 'Digit7': '7', 'Digit8': '8', 'Digit9': '9', 'Digit0': '0',
      'KeyQ': 'Q', 'KeyW': 'W', 'KeyE': 'E', 'KeyR': 'R', 'KeyT': 'T',
      'KeyY': 'Y', 'KeyU': 'U', 'KeyI': 'I', 'KeyO': 'O', 'KeyP': 'P',
      'KeyA': 'A', 'KeyS': 'S', 'KeyD': 'D', 'KeyF': 'F', 'KeyG': 'G',
      'KeyH': 'H', 'KeyJ': 'J', 'KeyK': 'K', 'KeyL': 'L', 'Semicolon': ';',
      'KeyZ': 'Z', 'KeyX': 'X', 'KeyC': 'C', 'KeyV': 'V', 'KeyB': 'B',
      'KeyN': 'N', 'KeyM': 'M', 'Comma': ',', 'Period': '.', 'Slash': '/',
    };
    
    const key = codeToKey[event.code];
    if (key && KEY_CODES[key] !== undefined) {
      return KEY_CODES[key];
    }
    
    // Fallback to keyCode (deprecated but reliable)
    return event.keyCode;
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
