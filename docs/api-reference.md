# API Reference

This document provides a comprehensive reference for all public APIs in the Qeyloop codebase.

## Table of Contents

- [Types](#types)
- [Audio Engine](#audio-engine)
- [Mode Manager](#mode-manager)
- [Page Manager](#page-manager)
- [BPM Controller](#bpm-controller)
- [Keyboard Handler](#keyboard-handler)
- [Clipboard Manager](#clipboard-manager)
- [History Manager](#history-manager)
- [Command Executor](#command-executor)
- [Project I/O](#project-io)
- [Layout Manager](#layout-manager)

---

## Types

### Enums

```typescript
/** How a sound plays when triggered */
const enum PlaybackMode {
  SingleShot = 0,  // Sound plays once on key down
  Loop = 1,        // Sound loops, BPM-synced
}

/** Playback type: Gate vs One-Shot behavior */
const enum PlaybackType {
  Gate = 0,     // Audio plays only while key is held
  OneShot = 1,  // Audio plays until end of buffer
}

/** How sounds in the same group overlap */
const enum OverlapMode {
  Polyphonic = 0,  // Multiple sounds can play simultaneously
  Monophonic = 1,  // New sound cuts previous sound in same group
}

/** Amplitude modulation presets */
const enum ModulationPreset {
  None = 0,              // No modulation
  QuarterSidechain = 1,  // 1/4 note sidechain
  EighthSidechain = 2,   // 1/8 note sidechain
  SixteenthSidechain = 3 // 1/16 note sidechain
}
```

### Interfaces

```typescript
/** Complete mapping of a key to sound and settings */
interface KeyMapping {
  keyCode: number;           // KeyboardEvent.keyCode
  soundIndex: number;        // Index of assigned sound
  soundName: string;         // Name of the sound file
  mode: PlaybackMode;        // SingleShot or Loop
  playbackType: PlaybackType; // Gate or OneShot
  overlapMode: OverlapMode;  // Polyphonic or Monophonic
  groupId: number;           // Overlap group ID (0-255)
  volume: number;            // Volume (0.0 to 1.0)
  pitchSemitones: number;    // Pitch offset (-24 to +24)
  modulationEnabled: boolean; // Whether modulation is enabled
  hasSound: boolean;         // Whether a sound is assigned
}

/** Loaded sound data */
interface SoundData {
  index: number;             // Sound slot index
  name: string;              // Original filename
  samples: Float32Array;     // Audio samples (mono)
  sampleRate: number;        // Sample rate
  duration: number;          // Duration in seconds
}
```

---

## Audio Engine

**Location**: `src/audio/engine.ts`  
**Export**: `audioEngine` (singleton)

### Methods

#### `initialize(): Promise<void>`
Initialize the audio engine. Must be called after user interaction.

```typescript
await audioEngine.initialize();
```

#### `resume(): Promise<void>`
Resume audio context if suspended.

#### `noteOn(keyCode: number): void`
Trigger a note (key pressed).

```typescript
audioEngine.noteOn(65); // 'A' key
```

#### `noteOff(keyCode: number): void`
Release a note (key released).

```typescript
audioEngine.noteOff(65);
```

#### `loadSound(index: number, file: File): Promise<SoundData>`
Load an audio file into a sound slot.

```typescript
const soundData = await audioEngine.loadSound(0, file);
```

#### `loadSoundFromSamples(index: number, name: string, samples: Float32Array): void`
Load sound from raw samples (for import).

#### `setKeyMapping(mapping: KeyMapping): void`
Set complete key mapping.

#### `setKeyMode(keyCode: number, mode: PlaybackMode): void`
Set playback mode for a key.

#### `setKeyVolume(keyCode: number, volume: number): void`
Set volume for a key (0.0 to 1.0).

#### `setKeyPitch(keyCode: number, semitones: number): void`
Set pitch offset for a key (-24 to +24 semitones).

#### `setBpm(bpm: number): void`
Set global BPM.

#### `setMetronome(enabled: boolean, volume: number): void`
Configure metronome.

#### `setMasterVolume(volume: number): void`
Set master output volume.

#### `panic(): void`
Stop all sounds immediately.

---

## Mode Manager

**Location**: `src/modes/manager.ts`  
**Export**: `modeManager` (singleton)

### Methods

#### `initialize(): void`
Initialize mode manager with default mappings.

#### `getMapping(keyCode: number): KeyMapping | undefined`
Get mapping for a key.

```typescript
const mapping = modeManager.getMapping(65);
if (mapping?.hasSound) {
  console.log(mapping.soundName);
}
```

#### `getAllMappings(): KeyMapping[]`
Get all key mappings.

#### `setMapping(mapping: KeyMapping): void`
Set complete mapping for a key.

#### `assignSound(keyCode: number, soundIndex: number, soundName: string): void`
Assign a sound to a key.

#### `removeSound(keyCode: number): void`
Remove sound from a key.

#### `setKeyMode(keyCode: number, mode: PlaybackMode): void`
Set playback mode.

#### `toggleKeyMode(keyCode: number): PlaybackMode`
Toggle between SingleShot and Loop.

#### `setKeyVolume(keyCode: number, volume: number): void`
Set key volume (0.0 to 1.0).

#### `setKeyPitch(keyCode: number, semitones: number): void`
Set key pitch (-24 to +24).

#### `setKeyModulation(keyCode: number, enabled: boolean): void`
Enable/disable modulation.

#### `setKeyOverlap(keyCode: number, mode: OverlapMode, groupId: number): void`
Set overlap behavior.

### Callbacks

#### `setMappingChangeCallback(callback: (keyCode: number, mapping: KeyMapping) => void): void`
Listen for mapping changes.

---

## Page Manager

**Location**: `src/pages/manager.ts`  
**Export**: `pageManager` (singleton)

### Constants

```typescript
const MAX_PAGES = 10; // Maximum number of pages
```

### Methods

#### `initialize(): void`
Initialize with one empty page.

#### `createPage(): number`
Create a new page. Returns index or -1 if max reached.

#### `switchToPage(pageIndex: number): void`
Switch to a specific page.

#### `getActivePageIndex(): number`
Get current active page index.

#### `getActivePage(): PageState | undefined`
Get current page state.

#### `getAllPages(): PageState[]`
Get all page states.

#### `clearActivePage(): void`
Clear all data from active page.

#### `saveCurrentPageState(): void`
Save current mode mappings to page state.

#### `restorePageState(pageIndex: number): void`
Restore mappings from a page state.

#### `setPadPageJump(keyCode: number, targetPage: number): void`
Configure pad to trigger page jump.

#### `checkPadJump(keyCode: number): number`
Check if pad should trigger page jump. Returns target or -1.

#### `executePageJump(targetPage: number): void`
Execute a page jump.

### Callbacks

#### `setPageChangeCallback(callback: (pageIndex: number) => void): void`
Listen for page changes.

#### `setPagesUpdateCallback(callback: (pages: PageState[], activeIndex: number) => void): void`
Listen for page list updates.

---

## BPM Controller

**Location**: `src/timing/bpm.ts`  
**Export**: `bpmController` (singleton)

### Methods

#### `initialize(): void`
Initialize with default values.

#### `setBpm(bpm: number): void`
Set BPM (clamped to 20-300).

#### `getBpm(): number`
Get current BPM.

#### `incrementBpm(amount?: number): void`
Increment BPM by amount (default 1).

#### `decrementBpm(amount?: number): void`
Decrement BPM by amount (default 1).

#### `doubleBpm(): void`
Double the current BPM.

#### `halveBpm(): void`
Halve the current BPM.

#### `getBpmRange(): { min: number; max: number }`
Get BPM limits.

#### `setMetronome(enabled: boolean, volume?: number): void`
Set metronome state.

#### `toggleMetronome(): boolean`
Toggle metronome on/off. Returns new state.

#### `isMetronomeEnabled(): boolean`
Check if metronome is enabled.

#### `getMetronomeVolume(): number`
Get metronome volume.

#### `resetTiming(): void`
Reset timing to beat 1.

### Callbacks

#### `setBpmChangeCallback(callback: (bpm: number) => void): void`
Listen for BPM changes.

#### `setMetronomeChangeCallback(callback: (enabled: boolean, volume: number) => void): void`
Listen for metronome changes.

---

## Keyboard Handler

**Location**: `src/input/keyboard.ts`  
**Export**: `keyboardHandler` (singleton)

### Methods

#### `initialize(): void`
Start capturing keyboard events.

#### `releaseAllKeys(): void`
Force release all held keys.

#### `isRightShiftPressed(): boolean`
Check if right shift (playable pad) is pressed.

### Callbacks

#### `setKeyStateCallback(callback: (keyCode: number, pressed: boolean) => void): void`
Listen for key state changes.

---

## Clipboard Manager

**Location**: `src/edit/clipboard.ts`  
**Export**: `clipboardManager` (singleton)

### Enums

```typescript
const enum ClipboardType {
  Empty = 0,
  AudioOnly = 1,
  FullPad = 2,
}
```

### Methods

#### `copyAudio(keyCode: number, sound: SoundData): void`
Copy audio only from a pad.

#### `cutAudio(keyCode: number, sound: SoundData): void`
Cut audio only from a pad.

#### `copyFullPad(keyCode: number, mapping: KeyMapping, sound: SoundData | null, pageJumpTarget: number): void`
Copy full pad (audio + settings).

#### `cutFullPad(keyCode: number, mapping: KeyMapping, sound: SoundData | null, pageJumpTarget: number): void`
Cut full pad (audio + settings).

#### `hasContent(): boolean`
Check if clipboard has content.

#### `getContent(): ClipboardData`
Get clipboard content.

#### `getSourceKeyCode(): number | null`
Get source pad keyCode.

#### `wasCut(): boolean`
Check if last operation was cut.

#### `clear(): void`
Clear clipboard.

### Callbacks

#### `setClipboardChangeCallback(callback: (hasContent: boolean, sourceKeyCode: number | null, wasCut: boolean) => void): void`
Listen for clipboard changes.

---

## History Manager

**Location**: `src/edit/history.ts`  
**Export**: `historyManager` (singleton)

### Methods

#### `createPadSnapshot(keyCode: number): PadSnapshot`
Create a snapshot of a pad's current state.

#### `recordAction(actionType: HistoryActionType, description: string, affectedPads: number[], beforeStates: Map<number, PadSnapshot>, afterStates: Map<number, PadSnapshot>): void`
Record an action for undo/redo.

#### `undo(): boolean`
Undo last action. Returns success.

#### `redo(): boolean`
Redo last undone action. Returns success.

#### `canUndo(): boolean`
Check if undo is available.

#### `canRedo(): boolean`
Check if redo is available.

#### `clearHistory(): void`
Clear all history.

### Callbacks

#### `setHistoryChangeCallback(callback: (canUndo: boolean, canRedo: boolean) => void): void`
Listen for history state changes.

---

## Command Executor

**Location**: `src/edit/commands.ts`  
**Export**: `commandExecutor` (singleton)

### Commands

```typescript
const enum Command {
  // Clipboard
  CopyAudio = 'copy_audio',
  CutAudio = 'cut_audio',
  CopyPad = 'copy_pad',
  CutPad = 'cut_pad',
  Paste = 'paste',
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
```

### Methods

#### `setSelectedPad(keyCode: number | null): void`
Set the currently selected pad.

#### `getSelectedPad(): number | null`
Get the currently selected pad.

#### `execute(command: Command): boolean`
Execute a command. Returns success.

```typescript
commandExecutor.setSelectedPad(65); // Select 'A' key
commandExecutor.execute(Command.CopyAudio);
```

### Callbacks

#### `setRefreshCallback(callback: () => void): void`
Set UI refresh callback.

#### `setStatusCallback(callback: (message: string) => void): void`
Set status message callback.

---

## Project I/O

**Location**: `src/project/io.ts`  
**Export**: `projectIO` (singleton)

### Methods

#### `exportPage(pageIndex?: number, fileName?: string): Promise<void>`
Export a single page as `.keypage` file.

```typescript
await projectIO.exportPage(0, 'my-page.keypage');
```

#### `importPage(file: File, targetPageIndex?: number): Promise<void>`
Import a `.keypage` file.

```typescript
await projectIO.importPage(file, 0);
```

#### `exportProject(fileName?: string): Promise<void>`
Export entire project as `.keyloop` file.

```typescript
await projectIO.exportProject('my-project.keyloop');
```

#### `importProject(file: File): Promise<void>`
Import a `.keyloop` project file.

```typescript
await projectIO.importProject(file);
```

---

## Layout Manager

**Location**: `src/input/layouts.ts`  
**Export**: `layoutManager` (singleton)

### Presets

```typescript
const enum KeyboardLayoutPreset {
  QWERTY = 'qwerty',
  AZERTY = 'azerty',
  QWERTZ = 'qwertz',
  ABNT2 = 'abnt2',
}
```

### Methods

#### `setLayout(preset: KeyboardLayoutPreset): void`
Set keyboard layout preset.

#### `getLayout(): KeyboardLayoutPreset`
Get current layout.

#### `getKeyLabel(code: string): string`
Get display label for a physical key code.

```typescript
layoutManager.setLayout(KeyboardLayoutPreset.AZERTY);
const label = layoutManager.getKeyLabel('KeyQ'); // Returns 'A'
```

### Callbacks

#### `setLayoutChangeCallback(callback: () => void): void`
Listen for layout changes.

---

## UI Components

### PadGrid

**Location**: `src/ui/grid.ts`

```typescript
class PadGrid {
  constructor(containerId: string);
  initialize(): void;
  refreshAll(): void;
  selectPad(keyCode: number): void;
  updateClipboardHighlight(): void;
  setPadSelectCallback(callback: (keyCode: number) => void): void;
}
```

### ControlPanel

**Location**: `src/ui/controls.ts`

```typescript
class ControlPanel {
  constructor(containerId: string);
  initialize(): void;
  refresh(): void;
  selectPad(keyCode: number): void;
}
```

### Toolbar

**Location**: `src/ui/toolbar.ts`

```typescript
class Toolbar {
  constructor(containerId: string);
  initialize(): void;
  setRefreshCallback(callback: () => void): void;
}
```

### PageSelector

**Location**: `src/ui/pages.ts`

```typescript
class PageSelector {
  constructor(containerId: string);
  initialize(): void;
}
```
