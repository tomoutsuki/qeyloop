# User Guide

Welcome to Qeyloop! This guide will help you get started with the web-based launchpad application.

## Getting Started

### 1. Launch the Application

Open Qeyloop in your browser. You'll see a start screen with:

- **Qeyloop** title
- **Start** button
- Quick tips about loading sounds

### 2. Initialize Audio

Click the **Start** button to initialize the audio engine. This is required due to browser autoplay policies - audio cannot be started without user interaction.

### 3. Main Interface

Once initialized, you'll see the main interface:

```
┌─────────────────────────────────────────────────────────────┐
│  [File] [Edit] [Help]    BPM: [120]  🔊 Vol    Pages: 1-10  │
├─────────────────────────────────────────────────────────────┤
│                                          │                  │
│   ` 1 2 3 4 5 6 7 8 9 0 - =             │   Modulation    │
│   Q W E R T Y U I O P [ ] \             │   [None ▼]      │
│   A S D F G H J K L ; ' ↵               │                  │
│   Z X C V B N M , . / ⇧                 │   Selected Pad   │
│                                          │   [Settings...] │
│                                          │                  │
├─────────────────────────────────────────────────────────────┤
│  ESC = Panic | Shift+1-0 = Switch Page | Drag audio to pads│
└─────────────────────────────────────────────────────────────┘
```

## Loading Sounds

### Drag and Drop

1. **Select an audio file** from your file manager (MP3, WAV, OGG, etc.)
2. **Drag it** onto any pad in the grid
3. The pad will light up to indicate a sound is loaded
4. **Press the corresponding key** to play the sound

### Supported Formats

- WAV (recommended)
- MP3
- OGG
- FLAC
- AAC
- WebM Audio

### Upload via Control Panel

1. Click on a pad to select it
2. In the control panel, click **Load Sound**
3. Choose an audio file

## Playing Sounds

### Keyboard Layout

The pad grid maps to your keyboard:

```
Row 1:  `  1  2  3  4  5  6  7  8  9  0  -  =
Row 2:  Q  W  E  R  T  Y  U  I  O  P  [  ]  \
Row 3:  A  S  D  F  G  H  J  K  L  ;  '  ↵
Row 4:  Z  X  C  V  B  N  M  ,  .  /  ⇧
```

**Note**: Right Shift (⇧) is a playable pad, not a modifier key.

### Playback Modes

| Mode | Description |
|------|-------------|
| **Single Shot** | Sound plays once per key press |
| **Loop** | Sound loops continuously (BPM-synced) |

Toggle mode by **right-clicking** on a pad.

### Playback Types

| Type | Behavior |
|------|----------|
| **Gate** | Sound plays while key is held |
| **One-Shot** | Sound plays to completion |

Configure in the control panel.

### Stopping Sounds

- **Release key** (in Gate mode)
- **Press ESC** to stop ALL sounds (Panic)

## Control Panel

### BPM (Tempo)

- Enter a value (20-300 BPM)
- Use **÷2** and **×2** buttons for quick adjustments
- Click **Sync** to reset timing to beat 1

### Metronome

Click the metronome icon to toggle the click track.

### Master Volume

Adjust the overall output level.

### Per-Pad Settings

Select a pad by clicking on it, then adjust:

| Setting | Range | Description |
|---------|-------|-------------|
| **Mode** | Single/Loop | Playback mode |
| **Type** | Gate/OneShot | Key hold behavior |
| **Volume** | 0-100% | Pad volume |
| **Pitch** | ±24 semitones | Pitch shift |
| **Modulation** | On/Off | Sidechain effect |
| **Overlap** | Poly/Mono | Voice behavior |
| **Group** | 0-255 | Overlap group ID |
| **Page Jump** | None/1-10 | Auto page switch |

### Modulation Presets

Global sidechain-style modulation:

| Preset | Effect |
|--------|--------|
| **None** | No modulation |
| **1/4 Note** | Duck on every beat |
| **1/8 Note** | Duck twice per beat |
| **1/16 Note** | Duck four times per beat |

Enable modulation per-pad in the control panel.

### Overlap Groups

When **Monophonic** mode is enabled:
- Sounds in the same group cut each other
- Useful for hi-hat open/closed behavior

Example setup:
- Open hi-hat: Group 1, Mono
- Closed hi-hat: Group 1, Mono
- Pressing closed hi-hat cuts open hi-hat

## Page System

### What are Pages?

Pages are independent sound sets. Each page contains:
- Its own sounds
- Independent pad settings
- Separate modulation configuration

You can have up to **10 pages** per project.

### Switching Pages

**Method 1: Page Tabs**
- Click page numbers (1-10) in the header

**Method 2: Hotkeys**
- Press **Shift + 1** through **Shift + 0** (0 = page 10)

**Method 3: Pad Triggers**
- Configure a pad's "Page Jump" setting
- When pressed, the pad plays its sound AND switches pages

### Page Jump Example

1. Select a pad on Page 1
2. Set "Page Jump" to "2"
3. Load a transition sound
4. When you press this pad:
   - The sound plays
   - Qeyloop switches to Page 2

## Keyboard Shortcuts

### Global

| Shortcut | Action |
|----------|--------|
| **ESC** | Panic (stop all sounds) |
| **Shift + 1-0** | Switch to page 1-10 |

### Clipboard

| Shortcut | Action |
|----------|--------|
| **Ctrl + C** | Copy audio only |
| **Ctrl + Shift + C** | Copy full pad (audio + settings) |
| **Ctrl + X** | Cut audio only |
| **Ctrl + Shift + X** | Cut full pad |
| **Ctrl + V** | Paste |
| **Delete** | Delete sound from pad |

### Edit

| Shortcut | Action |
|----------|--------|
| **Ctrl + Z** | Undo |
| **Ctrl + Y** | Redo |
| **Ctrl + Shift + Z** | Redo (alternative) |

### File

| Shortcut | Action |
|----------|--------|
| **Ctrl + S** | Export project |
| **Ctrl + Shift + S** | Export current page |
| **Ctrl + O** | Import project |
| **Ctrl + Shift + O** | Import page |

## Project Management

### Saving Projects

1. Go to **File → Export Project** (or Ctrl+S)
2. A `.keyloop` file will download
3. This contains ALL pages and sounds

### Loading Projects

1. Go to **File → Import Project** (or Ctrl+O)
2. Select a `.keyloop` file
3. Your current project will be replaced

### Sharing Pages

Export a single page:
1. Go to **File → Export Page**
2. A `.keypage` file will download

Import a shared page:
1. Go to **File → Import Page**
2. Select a `.keypage` file
3. Choose which page slot to load it into

## Keyboard Layouts

Qeyloop supports multiple keyboard layouts:

| Layout | Region |
|--------|--------|
| **QWERTY** | US/UK (default) |
| **AZERTY** | French |
| **QWERTZ** | German |
| **ABNT2** | Brazilian |

Change layout in **Help → Keyboard Layout**.

The physical keys remain the same - only the displayed labels change.

## Tips & Tricks

### Performance Tips

1. **Use WAV files** for lowest latency loading
2. **Keep samples short** for responsive triggering
3. **Close other audio apps** to reduce system latency

### Creative Tips

1. **Use overlap groups** for realistic hi-hat behavior
2. **Set up page jumps** for live performance transitions
3. **Combine Gate mode** with loops for DJ-style effects
4. **Use modulation** for pumping sidechain effects

### Workflow Tips

1. **Copy/paste pads** to duplicate settings quickly
2. **Use Ctrl+Shift+C** to copy ALL settings, not just audio
3. **Organize by page**: drums on page 1, bass on page 2, etc.

## Troubleshooting

### No Sound?

1. Click "Start" if you haven't already
2. Check master volume isn't at 0
3. Check pad has a sound loaded (should be colored)
4. Try pressing ESC to clear any stuck notes

### High Latency?

1. Use a modern browser (Chrome recommended)
2. Close other audio applications
3. Check system audio buffer settings
4. Use shorter audio files

### Sounds Cutting Off?

1. Check overlap mode - might be Monophonic
2. Check playback type - might be Gate mode
3. Make sure you're not pressing too many keys (64 max)

### File Won't Import?

1. Check file extension (`.keypage` or `.keyloop`)
2. File might be from an incompatible version
3. Try re-exporting from the source

## Getting Help

- **Help Menu**: Access documentation and about info
- **Footer Tips**: Quick reference shown at bottom of screen
- **GitHub**: Report issues and request features
