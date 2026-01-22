# Qeyloop

A minimalist, low-latency web-based launchpad application that transforms your computer keyboard into a sound performance device.

## Features

- **Low-latency audio playback** using Web Audio API + AudioWorklet
- **Keyboard-to-sound mapping** - Each key triggers a sound
- **Multiple playback modes**:
  - Single Shot: Sound plays once on key press
  - Loop: Sound loops (BPM-synced)
- **Modulation system** with sidechain-style presets (1/4, 1/8, 1/16 note)
- **Sound overlap control** - Polyphonic or Monophonic per group
- **Per-key volume and pitch control** (±24 semitones)
- **Global BPM control** with optional metronome
- **Project export/import** - Save and load complete projects as .qeyloop files
- **No external dependencies** for audio processing

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
cd qeyloop

# Install dependencies
npm install

# Start development server
npm run dev
```

### Usage

1. Click "Start" to initialize the audio engine
2. Drag audio files onto pad buttons to load sounds
3. Press keyboard keys to play sounds
4. Right-click on a pad to toggle between Single Shot and Loop mode
5. Use the control panel to adjust volume, pitch, modulation, and overlap settings

### Keyboard Layout

```
Row 1: 1 2 3 4 5 6 7 8 9 0
Row 2: Q W E R T Y U I O P
Row 3: A S D F G H J K L ;
Row 4: Z X C V B N M , . /
```

### Controls

- **ESC**: Panic (stop all sounds)
- **Left Click on Pad**: Select pad for editing
- **Right Click on Pad**: Toggle playback mode (Single/Loop)
- **Drag & Drop**: Load audio file onto pad

### Control Panel

- **BPM**: Set global tempo (20-300)
- **Metronome**: Toggle click track
- **Master Volume**: Overall volume control
- **Modulation Preset**: None, 1/4, 1/8, or 1/16 sidechain
- **Per-Pad Settings**:
  - Mode: Single Shot / Loop
  - Volume: 0-100%
  - Pitch: ±24 semitones
  - Modulation: On/Off
  - Overlap: Polyphonic / Monophonic
  - Group: Overlap group ID

### Project Files

- **Export**: Saves all sounds, mappings, and settings to a .qeyloop ZIP file
- **Import**: Restores complete project state from .qeyloop file

## Technical Architecture

### Audio Pipeline

```
Keyboard Input → AudioWorklet Message → JS DSP Engine → Web Audio Output
```

### Key Components

1. **AudioWorklet Processor** (`public/worklet/processor.js`)
   - Runs in dedicated audio thread
   - Contains pure JavaScript DSP engine
   - Zero allocation during processing

2. **Audio Engine** (`src/audio/engine.ts`)
   - Manages Web Audio context
   - Handles sound loading and decoding
   - Message passing to AudioWorklet

3. **Mode Manager** (`src/modes/manager.ts`)
   - Tracks key mappings and settings
   - Manages playback modes and modulation

4. **BPM Controller** (`src/timing/bpm.ts`)
   - Global tempo control
   - Metronome state

5. **Project IO** (`src/project/io.ts`)
   - ZIP-based project serialization
   - Sound and settings export/import

### WASM DSP Engine (Optional)

The Rust WASM module (`src/wasm/`) provides an optimized DSP implementation. The application works with the pure JavaScript engine by default.

To build the WASM module:

```bash
# Install Rust and wasm-pack
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
cargo install wasm-pack

# Build WASM
npm run build:wasm
```

## Performance Notes

- Audio latency target: <10ms perceived
- Block size: 128 samples
- Sample rate: 48kHz
- No main thread audio processing
- Pre-allocated voice pool (64 voices)
- Pre-allocated sound slots (64 sounds)

## Browser Requirements

- Chrome 66+ / Edge 79+ / Firefox 76+ / Safari 14.1+
- AudioWorklet support required
- Web Audio API support required

## Project Structure

```
qeyloop/
├── public/
│   ├── worklet/
│   │   └── processor.js      # AudioWorklet processor with JS DSP
│   └── styles.css            # Minimal UI styles
├── src/
│   ├── audio/
│   │   └── engine.ts         # Web Audio management
│   ├── input/
│   │   └── keyboard.ts       # Keyboard input handling
│   ├── modes/
│   │   └── manager.ts        # Mode system
│   ├── project/
│   │   └── io.ts             # Project import/export
│   ├── timing/
│   │   └── bpm.ts            # BPM control
│   ├── ui/
│   │   ├── controls.ts       # Control panel
│   │   └── grid.ts           # Pad grid
│   ├── wasm/
│   │   ├── Cargo.toml        # Rust config
│   │   └── src/lib.rs        # Rust DSP module
│   ├── types.ts              # TypeScript types
│   └── main.ts               # Application entry
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## License

MIT
