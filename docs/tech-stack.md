# Tech Stack

This document details all technologies, dependencies, and tooling used in the Qeyloop project.

## Core Technologies

### TypeScript

- **Version**: 5.3.3
- **Configuration**: ES2022 target, ESNext modules
- **Purpose**: Primary development language for type safety and tooling

Key TypeScript configuration (`tsconfig.json`):
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "paths": { "@/*": ["src/*"] }
  }
}
```

### Vite

- **Version**: 5.0.12
- **Purpose**: Development server and production bundler
- **Features Used**:
  - Hot Module Replacement (HMR)
  - TypeScript compilation
  - Static asset handling
  - Production bundling with tree-shaking

Key Vite configuration (`vite.config.ts`):
```typescript
export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    target: 'esnext',
  },
  server: {
    headers: {
      // Required for SharedArrayBuffer (WASM)
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
```

## Runtime Dependencies

### JSZip

- **Version**: 3.10.1
- **Purpose**: Create and read ZIP archives for project files
- **Usage**: `.keypage` and `.keyloop` file I/O
- **License**: MIT

```typescript
import JSZip from 'jszip';

// Creating a project file
const zip = new JSZip();
zip.file('project.json', JSON.stringify(manifest));
zip.folder('sounds').file('sound.wav', wavData);
const blob = await zip.generateAsync({ type: 'blob' });
```

## Web APIs

### Web Audio API

The core audio functionality relies on modern Web Audio API:

| API | Purpose |
|-----|---------|
| `AudioContext` | Main audio graph container |
| `AudioWorkletNode` | Custom audio processing node |
| `decodeAudioData()` | Decode audio files to buffers |

```typescript
// Audio context initialization
const audioContext = new AudioContext({
  latencyHint: 'interactive',
  sampleRate: 48000,
});

// Load AudioWorklet processor
await audioContext.audioWorklet.addModule('/worklet/processor.js');
```

### AudioWorklet API

Custom real-time audio processing:

```javascript
// processor.js - runs in audio thread
class QeyloopProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const output = outputs[0];
    // Real-time audio processing here
    return true; // Keep processor alive
  }
}

registerProcessor('qeyloop-processor', QeyloopProcessor);
```

### File APIs

| API | Purpose |
|-----|---------|
| `File` | Represent dropped audio files |
| `FileReader` / `arrayBuffer()` | Read file contents |
| `Blob` | Create downloadable files |
| `URL.createObjectURL()` | Generate download links |

### Keyboard APIs

| API | Purpose |
|-----|---------|
| `KeyboardEvent` | Capture key press/release |
| `event.code` | Physical key identification |
| `event.key` | Logical key value |

## Development Dependencies

### TypeScript

- **Purpose**: Type checking and compilation
- **CLI**: `tsc` (via Vite)

### Vite

- **Purpose**: Dev server and bundler
- **Scripts**:
  - `npm run dev` - Start dev server
  - `npm run build` - Production build
  - `npm run preview` - Preview production build

## Optional: Rust/WASM

The project includes optional WASM DSP module:

### Rust

- **Edition**: 2021
- **Purpose**: High-performance DSP (optional enhancement)

### wasm-pack

- **Version**: Latest
- **Purpose**: Compile Rust to WebAssembly
- **Command**: `npm run build:wasm`

```toml
# Cargo.toml
[package]
name = "qeyloop-dsp"
version = "1.0.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
wasm-bindgen = "0.2.89"

[profile.release]
opt-level = 3
lto = true
codegen-units = 1
panic = "abort"
```

## Browser Compatibility

### Required Features

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| AudioWorklet | 66+ | 76+ | 14.1+ | 79+ |
| ES2022 | 94+ | 93+ | 15.4+ | 94+ |
| Web Audio API | 35+ | 25+ | 6.1+ | 12+ |
| CSS Grid | 57+ | 52+ | 10.1+ | 16+ |

### Optional Features

| Feature | Purpose | Fallback |
|---------|---------|----------|
| SharedArrayBuffer | WASM optimization | JS DSP |
| WebAssembly | Enhanced DSP | JS DSP |

## Project Structure by Technology

```
qeyloop/
├── TypeScript Sources
│   └── src/**/*.ts
│
├── JavaScript (AudioWorklet)
│   └── public/worklet/processor.js
│
├── CSS
│   └── public/styles.css
│
├── HTML
│   └── index.html
│
├── Rust/WASM (Optional)
│   └── src/wasm/
│       ├── Cargo.toml
│       └── src/lib.rs
│
└── Configuration
    ├── package.json
    ├── tsconfig.json
    └── vite.config.ts
```

## Build Pipeline

### Development Mode

```
TypeScript Source → Vite Dev Server → Browser (HMR)
                        ↓
              esbuild (fast transform)
```

### Production Build

```
TypeScript Source → Vite Build → Minified JS Bundle
       ↓                              ↓
   Type Check               Tree-shaking + Minification
                                      ↓
                              dist/ folder
```

### WASM Build (Optional)

```
Rust Source → wasm-pack → .wasm + .js bindings
    ↓              ↓
Cargo.toml    public/wasm/
```

## Dependency Philosophy

Qeyloop follows a **minimal dependency** philosophy:

1. **Runtime Dependencies**: Only JSZip (essential for file I/O)
2. **Dev Dependencies**: Only TypeScript + Vite (essential tooling)
3. **No UI Frameworks**: Vanilla DOM manipulation
4. **No CSS Frameworks**: Custom CSS
5. **No Audio Libraries**: Pure Web Audio API

This approach ensures:
- Fast load times
- Minimal security surface
- Full control over audio latency
- Long-term maintainability

## Version Requirements

| Tool | Minimum Version | Recommended |
|------|-----------------|-------------|
| Node.js | 18.0.0 | 20.x LTS |
| npm | 8.0.0 | 10.x |
| Rust | 1.70.0 | Latest stable |
| wasm-pack | 0.12.0 | Latest |

## Package Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "npm run build:wasm && vite build",
    "build:wasm": "cd src/wasm && wasm-pack build --target web --out-dir ../../public/wasm",
    "preview": "vite preview"
  }
}
```

| Script | Purpose |
|--------|---------|
| `dev` | Start development server with HMR |
| `build` | Full production build (WASM + JS) |
| `build:wasm` | Compile Rust to WASM only |
| `preview` | Serve production build locally |
