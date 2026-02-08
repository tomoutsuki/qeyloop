# Development Guide

This guide covers setting up the development environment, building the project, and contributing to Qeyloop.

## Prerequisites

### Required

- **Node.js** 18.0.0 or higher (20.x LTS recommended)
- **npm** 8.0.0 or higher (comes with Node.js)
- A modern browser (Chrome, Firefox, Edge, Safari)

### Optional (for WASM development)

- **Rust** 1.70.0 or higher
- **wasm-pack** 0.12.0 or higher

## Quick Start

```bash
# Clone the repository
git clone https://github.com/your-repo/qeyloop.git
cd qeyloop

# Install dependencies
npm install

# Start development server
npm run dev
```

The development server runs at `http://localhost:5173` with hot module replacement.

## Project Setup

### Installing Dependencies

```bash
npm install
```

This installs:
- **typescript**: Type checking
- **vite**: Development server and bundler
- **jszip**: ZIP file handling (runtime dependency)

### Development Server

```bash
npm run dev
```

Features:
- Hot Module Replacement (HMR)
- TypeScript compilation on-the-fly
- CORS headers for WASM support
- Source maps for debugging

### Production Build

```bash
npm run build
```

Output goes to `dist/` folder:
```
dist/
├── index.html
├── assets/
│   └── index-[hash].js
├── styles.css
└── worklet/
    └── processor.js
```

### Preview Production Build

```bash
npm run preview
```

Serves the production build locally for testing.

## Project Structure

```
qeyloop/
├── src/                    # TypeScript source code
│   ├── main.ts            # Application entry point
│   ├── types.ts           # Type definitions
│   ├── audio/             # Audio engine
│   ├── edit/              # Clipboard, history, commands
│   ├── input/             # Keyboard handling
│   ├── modes/             # Playback mode management
│   ├── pages/             # Multi-page system
│   ├── project/           # Import/export
│   ├── timing/            # BPM and metronome
│   ├── ui/                # UI components
│   └── wasm/              # Optional Rust WASM module
├── public/                 # Static assets
│   ├── styles.css         # Global styles
│   └── worklet/
│       └── processor.js   # AudioWorklet processor
├── assets/                 # Logo and images
├── docs/                   # Documentation
├── scripts/                # Build scripts
├── index.html             # HTML entry point
├── package.json           # Dependencies
├── tsconfig.json          # TypeScript config
└── vite.config.ts         # Vite config
```

## Development Workflow

### Code Organization

Each module follows a consistent pattern:

```typescript
/**
 * Module description
 */

// ============================================================================
// TYPES
// ============================================================================

interface SomeType { ... }

// ============================================================================
// MODULE CLASS
// ============================================================================

export class SomeManager {
  private state: ...;
  private callbacks: ...;
  
  initialize(): void { ... }
  
  // Public methods
  
  // Private methods
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const someManager = new SomeManager();
```

### Adding a New Feature

1. **Define types** in `src/types.ts` if needed
2. **Create module** in appropriate folder
3. **Wire up** in `src/main.ts`
4. **Add UI** in `src/ui/` if needed
5. **Add tests** (when test infrastructure is added)
6. **Update documentation**

### Module Communication

Modules communicate via:

1. **Direct method calls** (for immediate actions)
2. **Callbacks** (for async events)
3. **Custom events** (for cross-cutting concerns)

```typescript
// Callback pattern
manager.setSomeCallback((data) => {
  // React to change
});

// Custom event pattern
window.dispatchEvent(new CustomEvent('qeyloop:event', {
  detail: { data }
}));
```

## TypeScript Configuration

### Key Settings

```json
{
  "compilerOptions": {
    "target": "ES2022",           // Modern JavaScript
    "module": "ESNext",           // ES modules
    "moduleResolution": "bundler", // Vite resolution
    "strict": true,               // Strict type checking
    "noEmit": true,               // Vite handles emit
    "isolatedModules": true       // Required for esbuild
  }
}
```

### Path Aliases

```json
{
  "paths": {
    "@/*": ["src/*"]
  }
}
```

Use as:
```typescript
import { audioEngine } from '@/audio/engine';
```

## Vite Configuration

### Key Settings

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

## AudioWorklet Development

### Important Constraints

The AudioWorklet processor (`public/worklet/processor.js`) has strict requirements:

1. **No ES modules** - Must be a standalone file
2. **No async/await** in process()
3. **No DOM access**
4. **Pre-allocate all arrays**
5. **No memory allocation in render loop**

### Testing Changes

AudioWorklet changes require a full page reload:

1. Make changes to `processor.js`
2. Refresh the browser
3. Click "Start" to reinitialize

### Debugging

AudioWorklet runs in a separate thread. Debug with:

```javascript
// In processor.js
console.log('Debug:', someValue);
```

Check browser console for worklet logs.

## WASM Development (Optional)

### Setup

Install Rust and wasm-pack:

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install wasm-pack
cargo install wasm-pack
```

### Building WASM

```bash
npm run build:wasm
```

This compiles `src/wasm/src/lib.rs` to `public/wasm/`.

### WASM Structure

```rust
// src/wasm/src/lib.rs
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct DspEngine {
    // Engine state
}

#[wasm_bindgen]
impl DspEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(sample_rate: f32) -> DspEngine { ... }
    
    pub fn process(&mut self, output_l: &mut [f32], output_r: &mut [f32]) { ... }
}
```

### Using WASM in Worklet

```javascript
// In processor.js
const wasmModule = await WebAssembly.instantiate(wasmBytes);
this.dsp = new wasmModule.DspEngine(sampleRate);
```

## Code Style

### TypeScript

- Use `const enum` for numeric enums
- Use `interface` over `type` for objects
- Use explicit return types on public methods
- Document with JSDoc comments

### CSS

- Use CSS custom properties for theming
- BEM-like naming: `.component-element--modifier`
- No animations (performance requirement)

### Comments

```typescript
/**
 * Brief description of the function.
 * 
 * @param param1 Description of parameter
 * @returns Description of return value
 */
function example(param1: string): number {
  // Implementation comment if needed
  return 42;
}
```

## Debugging

### Browser DevTools

- **Console**: Check for errors and logs
- **Network**: Verify file loading
- **Performance**: Profile audio callback timing
- **Memory**: Watch for leaks

### Audio Debugging

```typescript
// Check audio context state
console.log(audioContext.state); // 'running', 'suspended', 'closed'

// Check latency
console.log(audioContext.baseLatency);
console.log(audioContext.outputLatency);
```

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| No sound | Context suspended | User interaction needed |
| Clicks/pops | Allocation in render | Pre-allocate arrays |
| High latency | Wrong latency hint | Use 'interactive' |
| Worklet error | Syntax error | Check processor.js |

## Testing

### Manual Testing Checklist

- [ ] Sound loading (drag-drop, upload)
- [ ] Keyboard playback (all keys)
- [ ] Mode toggle (single/loop)
- [ ] Volume/pitch adjustment
- [ ] Page switching
- [ ] Copy/paste operations
- [ ] Undo/redo
- [ ] Project export/import
- [ ] Page export/import

### Browser Testing

Test on:
- Chrome (primary target)
- Firefox
- Safari
- Edge

## Building for Production

### Full Build

```bash
npm run build
```

### Deployment Checklist

1. Run production build
2. Test with `npm run preview`
3. Verify all features work
4. Check console for errors
5. Deploy `dist/` folder

### Server Requirements

The production build requires:
- Static file serving
- Correct MIME types for `.js`, `.css`, `.wasm`
- CORS headers if using WASM with SharedArrayBuffer

## Contributing

### Pull Request Process

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

### Commit Messages

Use conventional commits:

```
feat: add new modulation preset
fix: resolve page jump timing issue
docs: update API reference
refactor: simplify voice allocation
```

### Code Review Criteria

- [ ] Code follows project style
- [ ] No TypeScript errors
- [ ] No console errors
- [ ] Performance not degraded
- [ ] Documentation updated

## Resources

### Web Audio API

- [MDN Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [AudioWorklet Documentation](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet)

### TypeScript

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)

### Vite

- [Vite Documentation](https://vitejs.dev/)

### Rust/WASM

- [wasm-bindgen Guide](https://rustwasm.github.io/wasm-bindgen/)
- [Rust and WebAssembly](https://rustwasm.github.io/docs/book/)
