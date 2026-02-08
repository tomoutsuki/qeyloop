# Audio Engine

This document provides detailed documentation of Qeyloop's audio system, including the Web Audio API setup, AudioWorklet processor, and DSP implementation.

## Overview

Qeyloop uses a **two-tier audio architecture**:

1. **Main Thread**: Audio file decoding, state management, UI
2. **Audio Thread**: Real-time audio processing via AudioWorklet

```
┌─────────────────────────────────────────────────────────────┐
│                      Main Thread                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  AudioEngine                         │   │
│  │  • AudioContext management                          │   │
│  │  • File decoding (decodeAudioData)                  │   │
│  │  • Message passing to worklet                       │   │
│  │  • State tracking                                   │   │
│  └─────────────────────────┬───────────────────────────┘   │
│                            │ postMessage()                  │
├────────────────────────────┼────────────────────────────────┤
│                      Audio Thread                           │
│  ┌─────────────────────────▼───────────────────────────┐   │
│  │              AudioWorklet Processor                  │   │
│  │  • Voice management (64 voices max)                 │   │
│  │  • Sample playback with pitch shifting              │   │
│  │  • Modulation (sidechain presets)                   │   │
│  │  • Metronome generation                             │   │
│  │  • Output mixing                                    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Audio Context Configuration

### Initialization

```typescript
const audioContext = new AudioContext({
  latencyHint: 'interactive', // Lowest latency mode
  sampleRate: 48000,          // Standard professional sample rate
});
```

### Latency Modes

| `latencyHint` | Typical Latency | Use Case |
|---------------|-----------------|----------|
| `'interactive'` | 2-10ms | Real-time instruments |
| `'balanced'` | 10-50ms | General playback |
| `'playback'` | 50-100ms | Media playback |

Qeyloop uses `'interactive'` for the lowest possible latency.

### CORS Headers

For WASM support (optional), the server must provide:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

These are configured in `vite.config.ts` for the dev server.

## AudioWorklet Processor

### Location

`public/worklet/processor.js`

### Registration

```javascript
class QeyloopProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.sampleRate = options.processorOptions.sampleRate;
    this.dsp = new JsDspEngine(this.sampleRate);
    this.port.onmessage = this.handleMessage.bind(this);
    this.port.postMessage({ type: 'wasmInitialized' });
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    this.dsp.process(output[0], output[1]);
    return true;
  }
}

registerProcessor('qeyloop-processor', QeyloopProcessor);
```

### Message Protocol

Messages are sent via `postMessage()` from main thread to worklet:

| Message Type | Data | Description |
|--------------|------|-------------|
| `noteOn` | `{ keyCode }` | Trigger a note |
| `noteOff` | `{ keyCode }` | Release a note |
| `loadSound` | `{ index, samples }` | Load audio samples |
| `setKeyMapping` | `KeyMapping` | Configure a key |
| `setBpm` | `{ bpm }` | Set tempo |
| `setMetronome` | `{ enabled, volume }` | Configure metronome |
| `setModulationPreset` | `{ preset }` | Set sidechain preset |
| `setMasterVolume` | `{ volume }` | Set master output |
| `panic` | - | Stop all voices |

## DSP Engine

The DSP engine runs entirely in the AudioWorklet thread for real-time performance.

### Voice System

```javascript
// Voice structure (pre-allocated, no runtime allocation)
{
  soundIndex: 0,         // Which sound slot
  position: 0,           // Playback position (fractional for pitch)
  active: false,         // Currently playing
  volume: 1.0,           // Voice volume
  pitch: 1.0,            // Pitch multiplier (1.0 = normal)
  mode: PlaybackMode.SingleShot,
  playbackType: PlaybackType.OneShot,
  groupId: 0,            // For monophonic grouping
  keyCode: 0,            // Triggering key
  modulationEnabled: false,
  finishingLoop: false,  // For OneShot+Loop ending
}
```

### Playback Modes

| Mode | PlaybackType | Behavior |
|------|--------------|----------|
| SingleShot | Gate | Plays while key held; stops on key up |
| SingleShot | OneShot | Plays to end regardless of key |
| Loop | Gate | Loops while key held; stops on key up |
| Loop | OneShot | Loops while held; finishes iteration on key up |

### Pitch Shifting

Pitch shifting uses fractional sample position:

```javascript
// Convert semitones to pitch multiplier
const pitch = Math.pow(2, semitones / 12);

// In render loop: advance position by pitch factor
voice.position += pitch;
const sampleIndex = Math.floor(voice.position);
```

Linear interpolation for smooth playback:

```javascript
const frac = voice.position - sampleIndex;
const sample = samples[sampleIndex] * (1 - frac) 
             + samples[sampleIndex + 1] * frac;
```

### Modulation System

Sidechain-style amplitude modulation synchronized to BPM:

```javascript
// Calculate beat position
const samplesPerBeat = (60 / bpm) * sampleRate;
const beatPosition = globalSamplePosition % samplesPerBeat;
const beatPhase = beatPosition / samplesPerBeat; // 0.0 to 1.0

// Modulation multipliers based on preset
function getModulation(preset, beatPhase) {
  switch (preset) {
    case ModulationPreset.QuarterSidechain:
      // Duck on every beat
      return getSidechainEnvelope(beatPhase);
    case ModulationPreset.EighthSidechain:
      // Duck on every eighth note
      return getSidechainEnvelope((beatPhase * 2) % 1);
    case ModulationPreset.SixteenthSidechain:
      // Duck on every sixteenth note
      return getSidechainEnvelope((beatPhase * 4) % 1);
    default:
      return 1.0;
  }
}

// Sidechain envelope (quick attack, slower release)
function getSidechainEnvelope(phase) {
  if (phase < 0.1) {
    return phase / 0.1; // Attack
  } else {
    return 1.0; // Sustain (ducking releases quickly)
  }
}
```

### Metronome

Built-in metronome generates clicks synchronized to BPM:

```javascript
// Metronome click generation
if (metronomeEnabled) {
  const samplesPerBeat = Math.floor((60 / bpm) * sampleRate);
  const clickSamples = 441; // ~10ms at 48kHz
  
  for (let i = 0; i < blockSize; i++) {
    const sampleInBeat = (globalSamplePosition + i) % samplesPerBeat;
    if (sampleInBeat < clickSamples) {
      const envelope = 1 - (sampleInBeat / clickSamples);
      const frequency = (sampleInBeat === 0) ? 1500 : 1000; // Higher pitch on beat 1
      click = Math.sin(2 * Math.PI * frequency * sampleInBeat / sampleRate) 
            * envelope * metronomeVolume;
    }
  }
}
```

### Overlap Groups

Monophonic mode cuts voices in the same group:

```javascript
function noteOn(keyCode) {
  const mapping = keyMappings[keyCode];
  
  // Handle monophonic mode
  if (mapping.overlapMode === OverlapMode.Monophonic) {
    for (const voice of voices) {
      if (voice.active && voice.groupId === mapping.groupId) {
        voice.active = false; // Cut existing voice
      }
    }
  }
  
  // Find and activate free voice
  // ...
}
```

## Sound Loading

### Audio Decoding

Files are decoded on the main thread:

```typescript
async loadSound(index: number, file: File): Promise<SoundData> {
  const arrayBuffer = await file.arrayBuffer();
  const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
  
  // Convert to mono
  const samples = this.convertToMono(audioBuffer);
  
  // Resample to context sample rate if needed
  const resampled = this.resample(samples, audioBuffer.sampleRate, 48000);
  
  // Send to worklet
  this.workletNode.port.postMessage({
    type: 'loadSound',
    data: { index, samples: resampled }
  });
}
```

### Mono Conversion

```typescript
private convertToMono(buffer: AudioBuffer): Float32Array {
  const channels = buffer.numberOfChannels;
  const length = buffer.length;
  const mono = new Float32Array(length);
  
  if (channels === 1) {
    mono.set(buffer.getChannelData(0));
  } else {
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    for (let i = 0; i < length; i++) {
      mono[i] = (left[i] + right[i]) * 0.5;
    }
  }
  
  return mono;
}
```

### Resampling

Simple linear interpolation resampler:

```typescript
private resample(samples: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return samples;
  
  const ratio = fromRate / toRate;
  const newLength = Math.floor(samples.length / ratio);
  const resampled = new Float32Array(newLength);
  
  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio;
    const index = Math.floor(srcIndex);
    const frac = srcIndex - index;
    resampled[i] = samples[index] * (1 - frac) + (samples[index + 1] || 0) * frac;
  }
  
  return resampled;
}
```

## Performance Considerations

### Memory Limits

| Resource | Limit | Reason |
|----------|-------|--------|
| Max Voices | 64 | Pre-allocated array size |
| Max Sounds | 640 | 10 pages × 64 sounds |
| Max Sample Length | 480,000 | 10 seconds at 48kHz |
| Block Size | 128 | AudioWorklet quantum |

### Real-Time Rules

The `process()` method follows strict rules:

1. **No memory allocation** - All arrays pre-allocated
2. **No async operations** - No promises, fetch, etc.
3. **No DOM access** - Worklet has no DOM
4. **No blocking operations** - Must return within ~2.6ms at 48kHz

### Latency Analysis

```
Total Latency = Audio Context Latency + Processing Time

Where:
- Audio Context Latency ≈ 2-10ms (interactive hint)
- Processing Time = Block Size / Sample Rate
                  = 128 / 48000
                  ≈ 2.67ms per block
```

**Typical end-to-end latency**: 5-15ms

## Optional WASM Module

The Rust/WASM module (`src/wasm/src/lib.rs`) provides an alternative DSP implementation:

### Building

```bash
npm run build:wasm
```

### Advantages

- Potential performance gains for complex DSP
- Zero-allocation guarantees
- SIMD optimization potential

### Current Status

The JavaScript DSP engine is the primary implementation. WASM exists as an optional enhancement but isn't required for normal operation.

## Troubleshooting

### No Sound

1. Check audio context state: `audioContext.state` should be `'running'`
2. Ensure user interaction occurred before initialization
3. Verify sound is loaded: check console for `soundLoaded` events

### High Latency

1. Check `audioContext.baseLatency` and `outputLatency`
2. Ensure `latencyHint: 'interactive'` is set
3. Close other audio applications
4. Check system audio buffer settings

### Clicks/Pops

1. Check for voice stealing (all 64 voices used)
2. Verify sample rate matches
3. Check for CPU overload (process() taking too long)

### Worklet Not Loading

1. Check CORS headers if using WASM
2. Verify processor.js path is correct
3. Check browser console for AudioWorklet errors
