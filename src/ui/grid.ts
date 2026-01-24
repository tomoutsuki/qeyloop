/**
 * Qeyloop Launchpad Grid UI
 * 
 * Renders the keyboard-like grid of pad buttons.
 * Minimal, no animations, optimized for responsiveness.
 */

import { audioEngine } from '../audio/engine';
import { modeManager } from '../modes/manager';
import { keyboardHandler } from '../input/keyboard';
import { pageManager } from '../pages/manager';
import { clipboardManager } from '../edit/clipboard';
import { commandExecutor } from '../edit/commands';
import {
  KEYBOARD_LAYOUT,
  KEY_CODES,
  PlaybackMode,
  OverlapMode,
  KeyMapping,
} from '../types';

// ============================================================================
// PAD GRID
// ============================================================================

export class PadGrid {
  /** Container element */
  private container: HTMLElement;
  
  /** Map of keyCode to pad element */
  private padElements: Map<number, HTMLElement> = new Map();
  
  /** Currently selected pad for editing */
  private selectedPad: number | null = null;
  
  /** Copied pad keyCode for copy/paste functionality */
  private copiedPadKeyCode: number | null = null;
  
  /** Callback for pad selection */
  private onPadSelect: ((keyCode: number) => void) | null = null;
  
  constructor(containerId: string) {
    const el = document.getElementById(containerId);
    if (!el) {
      throw new Error(`Container element not found: ${containerId}`);
    }
    this.container = el;
  }
  
  /**
   * Initialize the pad grid
   */
  initialize(): void {
    this.render();
    this.setupKeyboardFeedback();
    this.setupEventListeners();
  }
  
  /**
   * Set pad selection callback
   */
  setPadSelectCallback(callback: (keyCode: number) => void): void {
    this.onPadSelect = callback;
  }
  
  /**
   * Render the pad grid
   */
  private render(): void {
    this.container.innerHTML = '';
    this.container.className = 'pad-grid';
    
    for (const row of KEYBOARD_LAYOUT) {
      const rowEl = document.createElement('div');
      rowEl.className = 'pad-row';
      
      for (const key of row) {
        const keyCode = KEY_CODES[key];
        const padEl = this.createPadElement(key, keyCode);
        rowEl.appendChild(padEl);
        this.padElements.set(keyCode, padEl);
      }
      
      this.container.appendChild(rowEl);
    }
  }
  
  /**
   * Create a single pad element
   */
  private createPadElement(key: string, keyCode: number): HTMLElement {
    const pad = document.createElement('div');
    pad.className = 'pad';
    pad.dataset.keycode = keyCode.toString();
    
    // Key label
    const label = document.createElement('span');
    label.className = 'pad-label';
    label.textContent = key;
    pad.appendChild(label);
    
    // Sound name (initially empty)
    const soundName = document.createElement('span');
    soundName.className = 'pad-sound';
    soundName.textContent = '';
    pad.appendChild(soundName);
    
    // Mode indicator
    const modeIndicator = document.createElement('span');
    modeIndicator.className = 'pad-mode';
    modeIndicator.textContent = '';
    pad.appendChild(modeIndicator);
    
    return pad;
  }
  
  /**
   * Setup keyboard feedback (visual press indication)
   */
  private setupKeyboardFeedback(): void {
    keyboardHandler.setKeyStateCallback((keyCode, pressed) => {
      const pad = this.padElements.get(keyCode);
      if (pad) {
        if (pressed) {
          pad.classList.add('active');
        } else {
          pad.classList.remove('active');
        }
      }
    });
  }
  
  /**
   * Setup pad click and context menu events
   */
  private setupEventListeners(): void {
    for (const [keyCode, pad] of this.padElements) {
      // Left click: select pad / trigger sound
      pad.addEventListener('click', (e) => {
        e.preventDefault();
        this.selectPad(keyCode);
      });
      
      // Right click: cycle mode
      pad.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.cyclePadMode(keyCode);
      });
      
      // Drag and drop for sound files
      pad.addEventListener('dragover', (e) => {
        e.preventDefault();
        pad.classList.add('dragover');
      });
      
      pad.addEventListener('dragleave', () => {
        pad.classList.remove('dragover');
      });
      
      pad.addEventListener('drop', (e) => {
        e.preventDefault();
        pad.classList.remove('dragover');
        this.handleSoundDrop(keyCode, e);
      });
    }
    
    // Listen for mapping changes
    modeManager.setMappingChangeCallback((keyCode, mapping) => {
      this.updatePadDisplay(keyCode, mapping);
    });
  }
  
  /**
   * Select a pad for editing
   */
  private selectPad(keyCode: number): void {
    // Deselect previous
    if (this.selectedPad !== null) {
      this.padElements.get(this.selectedPad)?.classList.remove('selected');
    }
    
    // Select new
    this.selectedPad = keyCode;
    this.padElements.get(keyCode)?.classList.add('selected');
    
    // Update command executor
    commandExecutor.setSelectedPad(keyCode);
    
    this.onPadSelect?.(keyCode);
  }
  
  /**
   * Cycle through playback modes for a pad (right-click)
   */
  private cyclePadMode(keyCode: number): void {
    const mapping = modeManager.getMapping(keyCode);
    if (!mapping?.hasSound) return;
    
    modeManager.toggleKeyMode(keyCode);
  }
  
  /**
   * Handle sound file drop on a pad
   */
  private async handleSoundDrop(keyCode: number, event: DragEvent): Promise<void> {
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    if (!file.type.startsWith('audio/')) {
      console.warn('Not an audio file:', file.type);
      return;
    }
    
    try {
      // === PAGE-AWARE SOUND LOADING ===
      // Check if this key already has a sound index assigned on current page
      let soundIndex = pageManager.getKeySoundIndex(keyCode);
      
      if (soundIndex === undefined) {
        // Allocate new sound slot for this key on current page
        soundIndex = pageManager.incrementNextSoundIndex();
        pageManager.setKeySoundIndex(keyCode, soundIndex);
      }
      
      // Load sound into the key's dedicated slot
      const soundData = await audioEngine.loadSound(soundIndex, file);
      
      // Store sound data in page manager for export
      pageManager.storeSoundData(soundIndex, soundData);
      
      // Assign to key
      modeManager.assignSound(keyCode, soundIndex, file.name);
      
    } catch (error) {
      console.error('Failed to load sound:', error);
    }
  }
  
  /**
   * Update pad display based on mapping
   */
  updatePadDisplay(keyCode: number, mapping: KeyMapping): void {
    const pad = this.padElements.get(keyCode);
    if (!pad) return;
    
    // Update sound name
    const soundEl = pad.querySelector('.pad-sound') as HTMLElement;
    if (soundEl) {
      soundEl.textContent = mapping.hasSound
        ? this.truncateName(mapping.soundName, 8)
        : '';
    }
    
    // Update mode indicator
    const modeEl = pad.querySelector('.pad-mode') as HTMLElement;
    if (modeEl) {
      if (mapping.hasSound) {
        const modeSymbol = mapping.mode === PlaybackMode.Loop ? '↻' : '▶';
        const modSymbol = mapping.modulationEnabled ? '◈' : '';
        modeEl.textContent = modeSymbol + modSymbol;
      } else {
        modeEl.textContent = '';
      }
    }
    
    // Update classes
    pad.classList.toggle('has-sound', mapping.hasSound);
    pad.classList.toggle('loop-mode', mapping.mode === PlaybackMode.Loop);
    pad.classList.toggle('modulated', mapping.modulationEnabled);
  }
  
  /**
   * Truncate filename for display
   */
  private truncateName(name: string, maxLength: number): string {
    // Remove extension
    const baseName = name.replace(/\.[^/.]+$/, '');
    if (baseName.length <= maxLength) return baseName;
    return baseName.substring(0, maxLength - 1) + '…';
  }
  
  /**
   * Get next available sound slot (from page manager)
   */
  getNextSoundIndex(): number {
    return pageManager.getNextSoundIndex();
  }
  
  /**
   * Copy sound from one key to another
   */
  copySoundToKey(fromKeyCode: number, toKeyCode: number): void {
    const fromMapping = modeManager.getMapping(fromKeyCode);
    if (!fromMapping?.hasSound) return;
    
    // === PAGE-AWARE COPY ===
    // Assign the same sound index to the target key on current page
    pageManager.setKeySoundIndex(toKeyCode, fromMapping.soundIndex);
    modeManager.assignSound(toKeyCode, fromMapping.soundIndex, fromMapping.soundName);
  }
  
  /**
   * Refresh all pad displays
   */
  refreshAll(): void {
    console.log('Grid: Refreshing all pads...');
    let padsWithSounds = 0;
    for (const keyCode of this.padElements.keys()) {
      const mapping = modeManager.getMapping(keyCode);
      if (mapping) {
        if (mapping.hasSound) padsWithSounds++;
        this.updatePadDisplay(keyCode, mapping);
      }
    }
    // Update clipboard highlight
    this.updateClipboardHighlight();
    console.log(`Grid: Refreshed ${this.padElements.size} pads, ${padsWithSounds} have sounds`);
  }
  
  /**
   * Update clipboard source highlight
   */
  updateClipboardHighlight(): void {
    // Clear all clipboard highlights
    for (const pad of this.padElements.values()) {
      pad.classList.remove('clipboard-source', 'clipboard-cut');
    }
    
    // Apply highlight to source pad if clipboard has content
    if (clipboardManager.hasContent()) {
      const sourceKeyCode = clipboardManager.getSourceKeyCode();
      if (sourceKeyCode !== null) {
        const pad = this.padElements.get(sourceKeyCode);
        if (pad) {
          pad.classList.add('clipboard-source');
          if (clipboardManager.wasCut()) {
            pad.classList.add('clipboard-cut');
          }
        }
      }
    }
  }
  
  /**
   * Get currently selected pad
   */
  getSelectedPad(): number | null {
    return this.selectedPad;
  }
  
  /**
   * Get copied pad key code for copy/paste
   */
  getCopiedPadKeyCode(): number | null {
    return this.copiedPadKeyCode;
  }
  
  /**
   * Set copied pad key code for copy/paste
   */
  setCopiedPadKeyCode(keyCode: number | null): void {
    this.copiedPadKeyCode = keyCode;
  }
}
