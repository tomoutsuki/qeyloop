# Qeyloop Documentation

Welcome to the Qeyloop documentation. Qeyloop is a **minimalist, low-latency web-based launchpad application** that transforms your computer keyboard into a sound performance device.

## Documentation Index

| Document | Description |
|----------|-------------|
| [Architecture Overview](./architecture.md) | System design, module interactions, data flow |
| [Tech Stack](./tech-stack.md) | Technologies, dependencies, and tooling |
| [API Reference](./api-reference.md) | Module APIs and interfaces |
| [Audio Engine](./audio-engine.md) | Web Audio API, AudioWorklet, and DSP details |
| [File Formats](./file-formats.md) | .keypage and .keyloop file specifications |
| [User Guide](./user-guide.md) | How to use the application |
| [Development Guide](./development.md) | Setup, building, and contributing |

## Quick Overview

### What is Qeyloop?

Qeyloop is a web-based launchpad that allows users to:
- Map audio samples to keyboard keys
- Play sounds with ultra-low latency using Web Audio API
- Create multi-page projects with up to 10 pages
- Configure per-pad settings (volume, pitch, modulation, overlap)
- Export/import projects as `.keyloop` files

### Key Features

- **Low-latency audio** via AudioWorklet (runs in real-time audio thread)
- **10 independent pages** per project, each with its own sounds
- **Multiple playback modes**: Single Shot, Loop, Gate, One-Shot
- **Sidechain-style modulation** presets (1/4, 1/8, 1/16 note)
- **Per-pad controls**: volume, pitch (±24 semitones), overlap groups
- **Page jump triggers**: configure pads to switch pages when pressed
- **Full project export/import** with embedded audio files
- **Undo/Redo** support with 20-step history
- **Clipboard** operations (copy/cut/paste audio or full pad settings)
- **Multi-layout keyboard support**: QWERTY, AZERTY, QWERTZ, ABNT2

### Tech Stack Summary

| Layer | Technology |
|-------|------------|
| Frontend | TypeScript, Vite |
| Audio | Web Audio API, AudioWorklet |
| DSP | JavaScript (with optional Rust/WASM) |
| File I/O | JSZip |
| Build | Vite 5, TypeScript 5.3 |

---

## Project Structure

```
qeyloop/
├── index.html           # Main HTML entry point
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
├── vite.config.ts       # Vite build configuration
├── public/
│   ├── styles.css       # Global styles
│   └── worklet/
│       └── processor.js # AudioWorklet processor
├── src/
│   ├── main.ts          # Application entry point
│   ├── types.ts         # Type definitions
│   ├── audio/
│   │   └── engine.ts    # Audio engine interface
│   ├── edit/
│   │   ├── clipboard.ts # Copy/paste system
│   │   ├── commands.ts  # Command execution
│   │   └── history.ts   # Undo/redo manager
│   ├── input/
│   │   ├── hotkeys.ts   # Keyboard shortcuts
│   │   ├── keyboard.ts  # Pad key handling
│   │   └── layouts.ts   # Keyboard layout support
│   ├── modes/
│   │   └── manager.ts   # Playback mode management
│   ├── pages/
│   │   └── manager.ts   # Multi-page system
│   ├── project/
│   │   └── io.ts        # Import/export logic
│   ├── timing/
│   │   └── bpm.ts       # BPM and metronome
│   ├── ui/
│   │   ├── controls.ts  # Control panel UI
│   │   ├── grid.ts      # Pad grid UI
│   │   ├── pages.ts     # Page selector UI
│   │   └── toolbar.ts   # Menu bar UI
│   └── wasm/
│       ├── Cargo.toml   # Rust crate config
│       └── src/
│           └── lib.rs   # WASM DSP module
└── docs/                # Documentation (you are here)
```

---

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

For detailed setup instructions, see the [Development Guide](./development.md).
