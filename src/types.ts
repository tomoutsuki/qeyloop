/**
 * Qeyloop Type Definitions
 * 
 * Core types for the launchpad application.
 * These mirror the WASM types for consistency.
 */

// ============================================================================
// PLAYBACK MODES
// ============================================================================

/** How a sound plays when triggered */
export const enum PlaybackMode {
  /** Sound plays once on key down */
  SingleShot = 0,
  /** Sound loops, BPM-synced */
  Loop = 1,
}

/** How sounds in the same group overlap */
export const enum OverlapMode {
  /** Multiple sounds can play simultaneously */
  Polyphonic = 0,
  /** New sound cuts previous sound in same group */
  Monophonic = 1,
}

/** Amplitude modulation presets */
export const enum ModulationPreset {
  /** No modulation */
  None = 0,
  /** 1/4 note fake sidechain */
  QuarterSidechain = 1,
  /** 1/8 note sidechain */
  EighthSidechain = 2,
  /** 1/16 note sidechain */
  SixteenthSidechain = 3,
}

// ============================================================================
// KEY MAPPING
// ============================================================================

/** Complete mapping of a key to sound and settings */
export interface KeyMapping {
  /** Key code (from KeyboardEvent.keyCode) */
  keyCode: number;
  /** Index of assigned sound (0-63) */
  soundIndex: number;
  /** Name of the sound file */
  soundName: string;
  /** Playback mode */
  mode: PlaybackMode;
  /** Overlap behavior mode */
  overlapMode: OverlapMode;
  /** Overlap group ID (0-255) */
  groupId: number;
  /** Volume (0.0 to 1.0) */
  volume: number;
  /** Pitch offset in semitones (-24 to +24) */
  pitchSemitones: number;
  /** Whether modulation is enabled */
  modulationEnabled: boolean;
  /** Whether a sound is assigned */
  hasSound: boolean;
}

/** Create a default key mapping */
export function createDefaultKeyMapping(keyCode: number): KeyMapping {
  return {
    keyCode,
    soundIndex: 0,
    soundName: '',
    mode: PlaybackMode.SingleShot,
    overlapMode: OverlapMode.Polyphonic,
    groupId: 0,
    volume: 1.0,
    pitchSemitones: 0,
    modulationEnabled: false,
    hasSound: false,
  };
}

// ============================================================================
// SOUND DATA
// ============================================================================

/** Loaded sound data */
export interface SoundData {
  /** Sound slot index */
  index: number;
  /** Original filename */
  name: string;
  /** Audio samples (mono, Float32) */
  samples: Float32Array;
  /** Sample rate of original audio */
  sampleRate: number;
  /** Duration in seconds */
  duration: number;
}

// ============================================================================
// PROJECT STATE
// ============================================================================

/** Complete project state for export/import */
export interface ProjectState {
  /** Project format version */
  version: number;
  /** Global BPM */
  bpm: number;
  /** Master volume */
  masterVolume: number;
  /** Metronome settings */
  metronome: {
    enabled: boolean;
    volume: number;
  };
  /** Current modulation preset */
  modulationPreset: ModulationPreset;
  /** All key mappings */
  keyMappings: KeyMapping[];
  /** Sound file names (indexed by soundIndex) */
  soundFiles: { [index: number]: string };
}

/** Default project state */
export function createDefaultProjectState(): ProjectState {
  return {
    version: 1,
    bpm: 120,
    masterVolume: 1.0,
    metronome: {
      enabled: false,
      volume: 0.5,
    },
    modulationPreset: ModulationPreset.None,
    keyMappings: [],
    soundFiles: {},
  };
}

// ============================================================================
// NEW FILE FORMAT SCHEMAS (.keypage / .keyloop)
// ============================================================================

/**
 * Per-pad settings saved in .keypage file
 * Contains ALL pad parameters for complete state restoration
 */
export interface PadSettings {
  /** Key code (from KeyboardEvent.keyCode) */
  keyCode: number;
  /** Volume (0.0 to 1.0) */
  volume: number;
  /** Pitch offset in semitones (-24 to +24) */
  pitchSemitones: number;
  /** Playback mode (0=SingleShot, 1=Loop) */
  playbackMode: PlaybackMode;
  /** Whether modulation is enabled */
  modulationEnabled: boolean;
  /** Overlap mode (0=Polyphonic, 1=Monophonic) */
  overlapMode: OverlapMode;
  /** Overlap group ID (0-255) */
  overlapGroupId: number;
  /** Page jump target (-1 = none, 0-9 = target page) */
  pageJumpTarget: number;
  /** Sound file name (empty if no sound) */
  soundFileName: string;
  /** Sound index within this page (0-63) */
  soundIndex: number;
  /** Whether this pad has a sound assigned */
  hasSound: boolean;
}

/**
 * .keypage file format - represents exactly one page
 * This is a standalone file that can be imported independently
 */
export interface KeyPageFile {
  /** Format identifier */
  format: 'keypage';
  /** Schema version for future compatibility */
  schemaVersion: 1;
  /** Unique page identifier (UUID) */
  pageId: string;
  /** User-defined page name */
  pageName: string;
  /** Modulation preset for this page */
  modulationPreset: ModulationPreset;
  /** All pad settings (only pads with data) */
  pads: PadSettings[];
  /** Sound file references (soundIndex -> filename) */
  soundFiles: { [soundIndex: number]: string };
}

/**
 * Page reference within a .keyloop file
 */
export interface KeyLoopPageEntry {
  /** Page identifier (matches pageId in .keypage) */
  pageId: string;
  /** Filename within the ZIP (e.g., "page_0.keypage") */
  filename: string;
  /** Order index (0 = first page) */
  orderIndex: number;
}

/**
 * .keyloop file format - represents a multi-page project
 * This is a container (ZIP) holding multiple .keypage files
 */
export interface KeyLoopFile {
  /** Format identifier */
  format: 'keyloop';
  /** Schema version for future compatibility */
  schemaVersion: 1;
  /** Global BPM (shared across all pages) */
  bpm: number;
  /** Master volume (shared across all pages) */
  masterVolume: number;
  /** Metronome settings (shared across all pages) */
  metronome: {
    enabled: boolean;
    volume: number;
  };
  /** Active page index when saved */
  activePageIndex: number;
  /** Total page count */
  pageCount: number;
  /** Page references (ordered) */
  pages: KeyLoopPageEntry[];
}

/**
 * Generate a unique page ID
 */
export function generatePageId(): string {
  return crypto.randomUUID();
}

// ============================================================================
// AUDIO ENGINE INTERFACE
// ============================================================================

/** Messages sent to AudioWorklet */
export type WorkletMessage =
  | { type: 'init'; data: { wasmBytes: ArrayBuffer } }
  | { type: 'noteOn'; data: { keyCode: number } }
  | { type: 'noteOff'; data: { keyCode: number } }
  | { type: 'loadSound'; data: { index: number; samples: Float32Array } }
  | { type: 'setKeyMapping'; data: Omit<KeyMapping, 'soundName' | 'hasSound'> & { modulationEnabled: boolean } }
  | { type: 'setKeyMode'; data: { keyCode: number; mode: PlaybackMode } }
  | { type: 'setKeyVolume'; data: { keyCode: number; volume: number } }
  | { type: 'setKeyPitch'; data: { keyCode: number; semitones: number } }
  | { type: 'setKeyModulation'; data: { keyCode: number; enabled: boolean } }
  | { type: 'setKeyOverlap'; data: { keyCode: number; mode: OverlapMode; groupId: number } }
  | { type: 'setBpm'; data: { bpm: number } }
  | { type: 'setMetronome'; data: { enabled: boolean; volume: number } }
  | { type: 'setModulationPreset'; data: { preset: ModulationPreset } }
  | { type: 'setMasterVolume'; data: { volume: number } }
  | { type: 'panic' }
  | { type: 'resetTiming' }
  | { type: 'getState' };

/** Messages received from AudioWorklet */
export type WorkletResponse =
  | { type: 'wasmInitialized' }
  | { type: 'soundLoaded'; index: number }
  | { type: 'error'; message: string }
  | { type: 'state'; data: { bpm: number; activeVoices: number } };

// ============================================================================
// KEYBOARD LAYOUT
// ============================================================================

/** Standard QWERTY keyboard layout for the launchpad grid */
export const KEYBOARD_LAYOUT = [
  // Row 1: Number keys
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  // Row 2: QWERTY row
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  // Row 3: ASDF row
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';'],
  // Row 4: ZXCV row
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/'],
] as const;

/** Map key character to keyCode */
export const KEY_CODES: { [key: string]: number } = {
  '1': 49, '2': 50, '3': 51, '4': 52, '5': 53,
  '6': 54, '7': 55, '8': 56, '9': 57, '0': 48,
  'Q': 81, 'W': 87, 'E': 69, 'R': 82, 'T': 84,
  'Y': 89, 'U': 85, 'I': 73, 'O': 79, 'P': 80,
  'A': 65, 'S': 83, 'D': 68, 'F': 70, 'G': 71,
  'H': 72, 'J': 74, 'K': 75, 'L': 76, ';': 186,
  'Z': 90, 'X': 88, 'C': 67, 'V': 86, 'B': 66,
  'N': 78, 'M': 77, ',': 188, '.': 190, '/': 191,
};

/** Get all key codes used in the layout */
export function getAllKeyCodes(): number[] {
  return Object.values(KEY_CODES);
}
