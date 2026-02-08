# Architecture Overview

This document describes the high-level architecture of Qeyloop, including module responsibilities, data flow, and design decisions.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Browser                                     │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                        Main Thread                                │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐              │   │
│  │  │   UI    │  │  Input  │  │  Modes  │  │ Project │              │   │
│  │  │ (Grid,  │  │(Keyboard│  │ Manager │  │   I/O   │              │   │
│  │  │Controls)│  │ Hotkeys)│  │         │  │         │              │   │
│  │  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘              │   │
│  │       │            │            │            │                    │   │
│  │       └────────────┼────────────┼────────────┘                    │   │
│  │                    ▼            ▼                                 │   │
│  │              ┌───────────────────────┐                            │   │
│  │              │     Audio Engine      │                            │   │
│  │              │   (Message Passing)   │                            │   │
│  │              └───────────┬───────────┘                            │   │
│  └──────────────────────────┼────────────────────────────────────────┘   │
│                             │ postMessage()                              │
│  ┌──────────────────────────┼────────────────────────────────────────┐   │
│  │                  Audio Worklet Thread                             │   │
│  │              ┌───────────▼───────────┐                            │   │
│  │              │  AudioWorklet Node    │                            │   │
│  │              │  (processor.js)       │                            │   │
│  │              └───────────┬───────────┘                            │   │
│  │                          │                                        │   │
│  │              ┌───────────▼───────────┐                            │   │
│  │              │    JS DSP Engine      │                            │   │
│  │              │  (Real-time audio)    │                            │   │
│  │              └───────────┬───────────┘                            │   │
│  │                          │                                        │   │
│  │              ┌───────────▼───────────┐                            │   │
│  │              │   Audio Output        │                            │   │
│  │              │  (AudioContext.dest)  │                            │   │
│  │              └───────────────────────┘                            │   │
│  └───────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Thread Model

Qeyloop uses a **two-thread architecture** for optimal audio performance:

### Main Thread
- Handles all user interactions (keyboard, mouse, drag-drop)
- Manages application state and UI rendering
- Decodes audio files and sends samples to worklet
- Never performs real-time audio processing

### Audio Worklet Thread
- Runs with real-time priority
- Processes audio in 128-sample blocks (AudioWorklet quantum)
- Zero memory allocation in render path
- Communicates via `postMessage()` (one-way most of the time)

## Module Architecture

### Core Modules

```
┌─────────────────────────────────────────────────────────────────┐
│                        main.ts                                   │
│                   (Application Entry)                           │
└─────────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   audio/        │  │    input/       │  │     ui/         │
│   engine.ts     │  │  keyboard.ts    │  │   grid.ts       │
│                 │  │  hotkeys.ts     │  │   controls.ts   │
│ • AudioContext  │  │  layouts.ts     │  │   toolbar.ts    │
│ • WorkletNode   │  │                 │  │   pages.ts      │
│ • Message bus   │  │ • Key capture   │  │                 │
└────────┬────────┘  │ • Shortcuts     │  │ • DOM rendering │
         │           │ • Multi-layout  │  │ • Event binding │
         ▼           └─────────────────┘  └─────────────────┘
┌─────────────────┐
│   worklet/      │
│  processor.js   │
│                 │
│ • Voice mixer   │
│ • Modulation    │
│ • Metronome     │
└─────────────────┘
```

### State Management Modules

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   modes/        │  │    pages/       │  │    timing/      │
│   manager.ts    │  │   manager.ts    │  │    bpm.ts       │
│                 │  │                 │  │                 │
│ • KeyMappings   │  │ • PageStates    │  │ • BPM control   │
│ • Mode toggle   │  │ • Sound slots   │  │ • Metronome     │
│ • Settings      │  │ • Page jumps    │  │ • Sync/reset    │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

### Edit & Project Modules

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│    edit/        │  │    edit/        │  │   project/      │
│  clipboard.ts   │  │   history.ts    │  │     io.ts       │
│                 │  │                 │  │                 │
│ • Cut/Copy/Paste│  │ • Undo stack    │  │ • .keypage I/O  │
│ • Audio/Full pad│  │ • Redo stack    │  │ • .keyloop I/O  │
│ • In-memory     │  │ • Snapshots     │  │ • WAV encoding  │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

## Data Flow

### 1. Sound Loading Flow

```
User drags file    →    File decoded      →    Samples sent    →    DSP stores
onto pad                 (Main Thread)          to Worklet          samples
     │                        │                     │                   │
     ▼                        ▼                     ▼                   ▼
┌─────────┐           ┌──────────────┐       ┌─────────────┐    ┌───────────┐
│Drop Event│  ────▶   │AudioContext. │ ────▶ │postMessage()│ ──▶│loadSound()│
│ on Pad  │           │decodeAudio() │       │ to Worklet  │    │  stores   │
└─────────┘           └──────────────┘       └─────────────┘    └───────────┘
```

### 2. Note Trigger Flow

```
Key pressed    →    KeyboardHandler    →    AudioEngine    →    Worklet DSP
     │                    │                      │                   │
     ▼                    ▼                      ▼                   ▼
┌─────────┐        ┌─────────────┐        ┌───────────┐       ┌─────────┐
│keydown  │  ────▶ │Maps keyCode │  ────▶ │noteOn()   │ ────▶ │Activates│
│ event   │        │to pad       │        │postMessage│       │ voice   │
└─────────┘        └─────────────┘        └───────────┘       └─────────┘
```

### 3. Project Export Flow

```
Export clicked    →    Collect state    →    Build ZIP    →    Download
       │                     │                   │               │
       ▼                     ▼                   ▼               ▼
┌────────────┐       ┌─────────────┐      ┌──────────┐    ┌───────────┐
│User clicks │ ────▶ │PageManager  │ ───▶ │JSZip adds│ ──▶│Blob URL   │
│Export      │       │getAllPages()│      │manifest + │    │triggers   │
└────────────┘       └─────────────┘      │WAV files │    │download   │
                                          └──────────┘    └───────────┘
```

## Key Design Decisions

### 1. AudioWorklet over ScriptProcessorNode

**Decision**: Use AudioWorklet API instead of deprecated ScriptProcessorNode.

**Rationale**:
- AudioWorklet runs on dedicated audio thread with real-time priority
- ScriptProcessorNode runs on main thread, causing jank
- AudioWorklet supports SharedArrayBuffer for zero-copy audio

### 2. JavaScript DSP over Pure WASM

**Decision**: Primary DSP implementation is in JavaScript within the AudioWorklet.

**Rationale**:
- WASM instantiation in AudioWorklet is complex and browser-dependent
- JavaScript DSP provides sufficient performance for 64 voices
- Simpler debugging and development
- WASM module exists as optional enhancement

### 3. In-Memory Clipboard

**Decision**: Custom in-memory clipboard instead of browser Clipboard API.

**Rationale**:
- Browser Clipboard API requires async operations
- Custom clipboard supports rich data (audio samples + settings)
- Avoids permission prompts and security restrictions

### 4. Page-Scoped State

**Decision**: Each page maintains independent state (sounds, mappings).

**Rationale**:
- Users expect isolated pages like DAW scenes
- Prevents accidental sound bleeding between pages
- Sound indices use page-based ranges (page0: 0-63, page1: 64-127, etc.)

### 5. File Format Design

**Decision**: Two-tier format: `.keypage` (single page) and `.keyloop` (multi-page).

**Rationale**:
- Single pages can be shared/imported independently
- Multi-page projects bundle everything with manifest
- ZIP-based format allows for embedded audio and metadata

## Performance Considerations

### Audio Thread Rules

The AudioWorklet processor follows strict rules to maintain real-time performance:

1. **No memory allocation** in `process()` method
2. **No async operations** (no promises, no fetch)
3. **No DOM access** (worklet has no DOM)
4. **Pre-allocated arrays** for all voice and sound data
5. **Fixed maximum limits** (64 voices, 640 sounds)

### Main Thread Optimization

- UI updates batched where possible
- File decoding is async and non-blocking
- Heavy operations (export) run with progress indication
- Event listeners use capture phase for lowest latency

## Module Dependency Graph

```
main.ts
├── audio/engine.ts
│   └── types.ts
├── input/keyboard.ts
│   ├── audio/engine.ts
│   ├── pages/manager.ts
│   └── types.ts
├── input/hotkeys.ts
│   ├── edit/commands.ts
│   └── edit/clipboard.ts
├── modes/manager.ts
│   ├── audio/engine.ts
│   └── types.ts
├── pages/manager.ts
│   ├── audio/engine.ts
│   ├── modes/manager.ts
│   └── types.ts
├── timing/bpm.ts
│   └── audio/engine.ts
├── edit/commands.ts
│   ├── audio/engine.ts
│   ├── modes/manager.ts
│   ├── pages/manager.ts
│   ├── project/io.ts
│   ├── edit/clipboard.ts
│   └── edit/history.ts
├── project/io.ts
│   ├── audio/engine.ts
│   ├── modes/manager.ts
│   ├── pages/manager.ts
│   ├── timing/bpm.ts
│   └── types.ts
└── ui/*.ts
    └── (various managers)
```

## Event System

Qeyloop uses a simple callback-based event system:

```typescript
// Pattern used throughout the codebase
class Manager {
  private onSomeEvent: ((data: T) => void) | null = null;
  
  setSomeEventCallback(callback: (data: T) => void): void {
    this.onSomeEvent = callback;
  }
  
  private triggerEvent(data: T): void {
    this.onSomeEvent?.(data);
  }
}
```

Custom DOM events are also dispatched for cross-module communication:

```typescript
// Example: Sound loaded event
window.dispatchEvent(new CustomEvent('qeyloop:soundLoaded', {
  detail: { index: soundIndex }
}));
```

## Future Architecture Considerations

1. **Web Workers for Export**: Move heavy ZIP operations to worker thread
2. **WASM DSP Integration**: Complete WASM module for enhanced performance
3. **IndexedDB Storage**: Persistent local storage for projects
4. **MIDI Support**: MIDI input/output for external controllers
