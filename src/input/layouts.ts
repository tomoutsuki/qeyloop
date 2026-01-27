/**
 * Qeyloop Keyboard Layout System
 * 
 * Provides keyboard layout abstraction for different physical layouts.
 * Uses KeyboardEvent.code for layout-independent key detection.
 * Supports QWERTY, AZERTY, QWERTZ, and ABNT2 layouts.
 */

// ============================================================================
// TYPES
// ============================================================================

/** Available keyboard layout presets */
export const enum KeyboardLayoutPreset {
  QWERTY = 'qwerty',
  AZERTY = 'azerty',
  QWERTZ = 'qwertz',
  ABNT2 = 'abnt2',
}

/** Physical key code to pad index mapping */
export interface KeyLayoutMapping {
  /** KeyboardEvent.code → pad index (0-39 for 4x10 grid) */
  codeToIndex: Map<string, number>;
  /** Pad index → display label */
  indexToLabel: Map<number, string>;
}

// ============================================================================
// PHYSICAL KEY CODES (KeyboardEvent.code values)
// ============================================================================

/** All physical key codes used in the launchpad grid (50 keys: 4 rows with extended keys) */
export const PHYSICAL_KEYS = {
  // Row 1: Number row (` 1 2 3 4 5 6 7 8 9 0 - =)
  row1: ['Backquote', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal'],
  // Row 2: Top letter row (Q W E R T Y U I O P [ ] \)
  row2: ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft', 'BracketRight', 'Backslash'],
  // Row 3: Home row (A S D F G H J K L ; ' Enter)
  row3: ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote', 'Enter'],
  // Row 4: Bottom row (Shift Z X C V B N M , . / Shift)
  row4: ['ShiftLeft', 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash', 'ShiftRight'],
} as const;

/** Extended keys for future mapping (right-side and special keys) */
export const EXTENDED_KEYS = [
  'ShiftLeft', 'ShiftRight',
  'BracketLeft', 'BracketRight',
  'Backslash',
  'Minus', 'Equal',
  'Enter',
  'Quote',
  'Backquote',
] as const;

/** All standard grid keys flattened */
export const ALL_GRID_KEYS = [
  ...PHYSICAL_KEYS.row1,
  ...PHYSICAL_KEYS.row2,
  ...PHYSICAL_KEYS.row3,
  ...PHYSICAL_KEYS.row4,
] as const;

// ============================================================================
// LAYOUT LABEL DEFINITIONS
// ============================================================================

/** QWERTY layout labels (US/UK standard) */
const QWERTY_LABELS: { [code: string]: string } = {
  'Digit1': '1', 'Digit2': '2', 'Digit3': '3', 'Digit4': '4', 'Digit5': '5',
  'Digit6': '6', 'Digit7': '7', 'Digit8': '8', 'Digit9': '9', 'Digit0': '0',
  'KeyQ': 'Q', 'KeyW': 'W', 'KeyE': 'E', 'KeyR': 'R', 'KeyT': 'T',
  'KeyY': 'Y', 'KeyU': 'U', 'KeyI': 'I', 'KeyO': 'O', 'KeyP': 'P',
  'KeyA': 'A', 'KeyS': 'S', 'KeyD': 'D', 'KeyF': 'F', 'KeyG': 'G',
  'KeyH': 'H', 'KeyJ': 'J', 'KeyK': 'K', 'KeyL': 'L', 'Semicolon': ';',
  'KeyZ': 'Z', 'KeyX': 'X', 'KeyC': 'C', 'KeyV': 'V', 'KeyB': 'B',
  'KeyN': 'N', 'KeyM': 'M', 'Comma': ',', 'Period': '.', 'Slash': '/',
  // Extended keys
  'ShiftLeft': '⇧L', 'ShiftRight': '⇧R',
  'BracketLeft': '[', 'BracketRight': ']',
  'Backslash': '\\', 'Minus': '-', 'Equal': '=',
  'Enter': '↵', 'Quote': "'", 'Backquote': '`',
};

/** AZERTY layout labels (French) */
const AZERTY_LABELS: { [code: string]: string } = {
  'Digit1': '&', 'Digit2': 'é', 'Digit3': '"', 'Digit4': "'", 'Digit5': '(',
  'Digit6': '-', 'Digit7': 'è', 'Digit8': '_', 'Digit9': 'ç', 'Digit0': 'à',
  'KeyQ': 'A', 'KeyW': 'Z', 'KeyE': 'E', 'KeyR': 'R', 'KeyT': 'T',
  'KeyY': 'Y', 'KeyU': 'U', 'KeyI': 'I', 'KeyO': 'O', 'KeyP': 'P',
  'KeyA': 'Q', 'KeyS': 'S', 'KeyD': 'D', 'KeyF': 'F', 'KeyG': 'G',
  'KeyH': 'H', 'KeyJ': 'J', 'KeyK': 'K', 'KeyL': 'L', 'Semicolon': 'M',
  'KeyZ': 'W', 'KeyX': 'X', 'KeyC': 'C', 'KeyV': 'V', 'KeyB': 'B',
  'KeyN': 'N', 'KeyM': ',', 'Comma': ';', 'Period': ':', 'Slash': '!',
  // Extended keys
  'ShiftLeft': '⇧L', 'ShiftRight': '⇧R',
  'BracketLeft': '^', 'BracketRight': '$',
  'Backslash': '*', 'Minus': ')', 'Equal': '=',
  'Enter': '↵', 'Quote': 'ù', 'Backquote': '²',
};

/** QWERTZ layout labels (German) */
const QWERTZ_LABELS: { [code: string]: string } = {
  'Digit1': '1', 'Digit2': '2', 'Digit3': '3', 'Digit4': '4', 'Digit5': '5',
  'Digit6': '6', 'Digit7': '7', 'Digit8': '8', 'Digit9': '9', 'Digit0': '0',
  'KeyQ': 'Q', 'KeyW': 'W', 'KeyE': 'E', 'KeyR': 'R', 'KeyT': 'T',
  'KeyY': 'Z', 'KeyU': 'U', 'KeyI': 'I', 'KeyO': 'O', 'KeyP': 'P',
  'KeyA': 'A', 'KeyS': 'S', 'KeyD': 'D', 'KeyF': 'F', 'KeyG': 'G',
  'KeyH': 'H', 'KeyJ': 'J', 'KeyK': 'K', 'KeyL': 'L', 'Semicolon': 'Ö',
  'KeyZ': 'Y', 'KeyX': 'X', 'KeyC': 'C', 'KeyV': 'V', 'KeyB': 'B',
  'KeyN': 'N', 'KeyM': 'M', 'Comma': ',', 'Period': '.', 'Slash': '-',
  // Extended keys
  'ShiftLeft': '⇧L', 'ShiftRight': '⇧R',
  'BracketLeft': 'Ü', 'BracketRight': '+',
  'Backslash': '#', 'Minus': 'ß', 'Equal': '´',
  'Enter': '↵', 'Quote': 'Ä', 'Backquote': '^',
};

/** ABNT2 layout labels (Brazilian Portuguese) */
const ABNT2_LABELS: { [code: string]: string } = {
  'Digit1': '1', 'Digit2': '2', 'Digit3': '3', 'Digit4': '4', 'Digit5': '5',
  'Digit6': '6', 'Digit7': '7', 'Digit8': '8', 'Digit9': '9', 'Digit0': '0',
  'KeyQ': 'Q', 'KeyW': 'W', 'KeyE': 'E', 'KeyR': 'R', 'KeyT': 'T',
  'KeyY': 'Y', 'KeyU': 'U', 'KeyI': 'I', 'KeyO': 'O', 'KeyP': 'P',
  'KeyA': 'A', 'KeyS': 'S', 'KeyD': 'D', 'KeyF': 'F', 'KeyG': 'G',
  'KeyH': 'H', 'KeyJ': 'J', 'KeyK': 'K', 'KeyL': 'L', 'Semicolon': 'Ç',
  'KeyZ': 'Z', 'KeyX': 'X', 'KeyC': 'C', 'KeyV': 'V', 'KeyB': 'B',
  'KeyN': 'N', 'KeyM': 'M', 'Comma': ',', 'Period': '.', 'Slash': ';',
  // Extended keys
  'ShiftLeft': '⇧L', 'ShiftRight': '⇧R',
  'BracketLeft': '´', 'BracketRight': '[',
  'Backslash': ']', 'Minus': '-', 'Equal': '=',
  'Enter': '↵', 'Quote': '~', 'Backquote': "'",
};

/** Map preset to labels */
const LAYOUT_LABELS: { [preset: string]: { [code: string]: string } } = {
  [KeyboardLayoutPreset.QWERTY]: QWERTY_LABELS,
  [KeyboardLayoutPreset.AZERTY]: AZERTY_LABELS,
  [KeyboardLayoutPreset.QWERTZ]: QWERTZ_LABELS,
  [KeyboardLayoutPreset.ABNT2]: ABNT2_LABELS,
};

// ============================================================================
// LAYOUT MANAGER
// ============================================================================

class LayoutManager {
  /** Current layout preset */
  private currentPreset: KeyboardLayoutPreset = KeyboardLayoutPreset.QWERTY;
  
  /** Cached layout mapping */
  private cachedMapping: KeyLayoutMapping | null = null;
  
  /** Callback for layout changes */
  private onLayoutChange: ((preset: KeyboardLayoutPreset) => void) | null = null;
  
  /**
   * Get current layout preset
   */
  getCurrentPreset(): KeyboardLayoutPreset {
    return this.currentPreset;
  }
  
  /**
   * Set layout change callback
   */
  setLayoutChangeCallback(callback: (preset: KeyboardLayoutPreset) => void): void {
    this.onLayoutChange = callback;
  }
  
  /**
   * Switch to a different layout preset
   * Does NOT alter pad data, only changes display labels
   */
  setLayout(preset: KeyboardLayoutPreset): void {
    if (this.currentPreset === preset) return;
    
    this.currentPreset = preset;
    this.cachedMapping = null; // Invalidate cache
    this.onLayoutChange?.(preset);
  }
  
  /**
   * Get the current layout mapping
   */
  getMapping(): KeyLayoutMapping {
    if (this.cachedMapping) return this.cachedMapping;
    
    const codeToIndex = new Map<string, number>();
    const indexToLabel = new Map<number, string>();
    const labels = LAYOUT_LABELS[this.currentPreset] || QWERTY_LABELS;
    
    // Map physical keys to pad indices
    let padIndex = 0;
    for (const code of ALL_GRID_KEYS) {
      codeToIndex.set(code, padIndex);
      indexToLabel.set(padIndex, labels[code] || '?');
      padIndex++;
    }
    
    this.cachedMapping = { codeToIndex, indexToLabel };
    return this.cachedMapping;
  }
  
  /**
   * Get pad index from KeyboardEvent.code
   * Returns -1 if key is not part of the grid
   */
  getPadIndex(code: string): number {
    const mapping = this.getMapping();
    return mapping.codeToIndex.get(code) ?? -1;
  }
  
  /**
   * Get display label for a pad index
   */
  getPadLabel(padIndex: number): string {
    const mapping = this.getMapping();
    return mapping.indexToLabel.get(padIndex) ?? '?';
  }
  
  /**
   * Get display label for a physical key code
   */
  getKeyLabel(code: string): string {
    const labels = LAYOUT_LABELS[this.currentPreset] || QWERTY_LABELS;
    return labels[code] || '?';
  }
  
  /**
   * Check if a key code is part of the launchpad grid
   */
  isGridKey(code: string): boolean {
    return ALL_GRID_KEYS.includes(code as any);
  }
  
  /**
   * Get all available layout presets
   */
  getAvailablePresets(): KeyboardLayoutPreset[] {
    return [
      KeyboardLayoutPreset.QWERTY,
      KeyboardLayoutPreset.AZERTY,
      KeyboardLayoutPreset.QWERTZ,
      KeyboardLayoutPreset.ABNT2,
    ];
  }
  
  /**
   * Get human-readable name for a preset
   */
  getPresetName(preset: KeyboardLayoutPreset): string {
    switch (preset) {
      case KeyboardLayoutPreset.QWERTY: return 'QWERTY';
      case KeyboardLayoutPreset.AZERTY: return 'AZERTY';
      case KeyboardLayoutPreset.QWERTZ: return 'QWERTZ';
      case KeyboardLayoutPreset.ABNT2: return 'ABNT2';
      default: return 'Unknown';
    }
  }
}

// Singleton instance
export const layoutManager = new LayoutManager();
