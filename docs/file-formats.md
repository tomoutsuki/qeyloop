# File Formats

This document specifies the `.keypage` and `.keyloop` file formats used by Qeyloop for saving and sharing projects.

## Overview

Qeyloop uses two complementary file formats:

| Format | Extension | Purpose |
|--------|-----------|---------|
| KeyPage | `.keypage` | Single page (standalone, shareable) |
| KeyLoop | `.keyloop` | Multi-page project (complete project) |

Both formats are **ZIP archives** containing a JSON manifest and WAV audio files.

## .keypage Format

A `.keypage` file represents a single page that can be:
- Exported independently
- Shared with other users
- Imported into any page slot

### Structure

```
mypage.keypage (ZIP archive)
├── page.json           # Page manifest
└── sounds/
    ├── 0_kick.wav      # Sound file (index_name.wav)
    ├── 1_snare.wav
    └── 5_hihat.wav
```

### Manifest Schema (page.json)

```typescript
interface KeyPageFile {
  /** Format identifier (always "keypage") */
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
```

### Pad Settings Schema

```typescript
interface PadSettings {
  /** Key code (KeyboardEvent.keyCode) */
  keyCode: number;
  
  /** Volume (0.0 to 1.0) */
  volume: number;
  
  /** Pitch offset in semitones (-24 to +24) */
  pitchSemitones: number;
  
  /** Playback mode (0=SingleShot, 1=Loop) */
  playbackMode: PlaybackMode;
  
  /** Playback type (0=Gate, 1=OneShot) */
  playbackType: PlaybackType;
  
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
```

### Example page.json

```json
{
  "format": "keypage",
  "schemaVersion": 1,
  "pageId": "550e8400-e29b-41d4-a716-446655440000",
  "pageName": "Drums",
  "modulationPreset": 0,
  "pads": [
    {
      "keyCode": 65,
      "volume": 0.8,
      "pitchSemitones": 0,
      "playbackMode": 0,
      "playbackType": 1,
      "modulationEnabled": false,
      "overlapMode": 0,
      "overlapGroupId": 0,
      "pageJumpTarget": -1,
      "soundFileName": "kick.wav",
      "soundIndex": 0,
      "hasSound": true
    },
    {
      "keyCode": 83,
      "volume": 1.0,
      "pitchSemitones": 2,
      "playbackMode": 1,
      "playbackType": 0,
      "modulationEnabled": true,
      "overlapMode": 1,
      "overlapGroupId": 1,
      "pageJumpTarget": -1,
      "soundFileName": "snare.wav",
      "soundIndex": 1,
      "hasSound": true
    }
  ],
  "soundFiles": {
    "0": "kick.wav",
    "1": "snare.wav"
  }
}
```

### Sound File Naming

Sound files are stored in the `sounds/` folder with the naming convention:

```
{localIndex}_{originalFilename}.wav
```

Where:
- `localIndex` is 0-63 (within-page index)
- `originalFilename` is preserved (sanitized)

Examples:
- `0_kick.wav`
- `5_my_sample.wav`
- `32_fx_riser.wav`

### Audio Format

All audio is stored as **WAV format**:
- Sample rate: 48000 Hz (or source sample rate)
- Bit depth: 32-bit float
- Channels: Mono

## .keyloop Format

A `.keyloop` file represents a complete multi-page project.

### Structure

```
myproject.keyloop (ZIP archive)
├── project.json        # Project manifest
├── page_0.keypage      # Embedded page 0
├── page_1.keypage      # Embedded page 1
├── page_2.keypage      # Embedded page 2
└── sounds/
    ├── 0/              # Page 0 sounds
    │   ├── 0_kick.wav
    │   └── 1_snare.wav
    ├── 1/              # Page 1 sounds
    │   └── 0_bass.wav
    └── 2/              # Page 2 sounds
        └── 0_lead.wav
```

### Project Manifest Schema (project.json)

```typescript
interface KeyLoopFile {
  /** Format identifier (always "keyloop") */
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

interface KeyLoopPageEntry {
  /** Page identifier (matches pageId in .keypage) */
  pageId: string;
  
  /** Filename within the ZIP (e.g., "page_0.keypage") */
  filename: string;
  
  /** Order index (0 = first page) */
  orderIndex: number;
}
```

### Example project.json

```json
{
  "format": "keyloop",
  "schemaVersion": 1,
  "bpm": 128,
  "masterVolume": 0.9,
  "metronome": {
    "enabled": false,
    "volume": 0.5
  },
  "activePageIndex": 0,
  "pageCount": 3,
  "pages": [
    {
      "pageId": "550e8400-e29b-41d4-a716-446655440000",
      "filename": "page_0.keypage",
      "orderIndex": 0
    },
    {
      "pageId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "filename": "page_1.keypage",
      "orderIndex": 1
    },
    {
      "pageId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "filename": "page_2.keypage",
      "orderIndex": 2
    }
  ]
}
```

## Import/Export Behavior

### Exporting a Page

1. Current page state is captured
2. All sounds are converted to WAV
3. Manifest is generated
4. ZIP is created and downloaded

```typescript
await projectIO.exportPage(0, 'drums.keypage');
```

### Importing a Page

1. ZIP is parsed
2. Manifest is validated
3. Sounds are loaded into target page's slot range
4. Pad settings are applied

```typescript
await projectIO.importPage(file, 0); // Import to page 0
```

### Exporting a Project

1. All pages are saved to their current state
2. Global settings (BPM, master volume) are captured
3. Each page is embedded as a `.keypage`
4. Project manifest is generated
5. ZIP is created and downloaded

```typescript
await projectIO.exportProject('my-project.keyloop');
```

### Importing a Project

1. ZIP is parsed
2. Project manifest is validated
3. All existing data is cleared
4. Pages are restored in order
5. Global settings are applied

```typescript
await projectIO.importProject(file);
```

## Sound Index Mapping

Sound indices are scoped to pages:

| Page | Sound Index Range |
|------|-------------------|
| 0 | 0-63 |
| 1 | 64-127 |
| 2 | 128-191 |
| ... | ... |
| 9 | 576-639 |

When exporting:
- Global indices are converted to local (0-63)

When importing:
- Local indices are mapped to target page's range

## Version Compatibility

### Schema Version 1

Current version. All fields are required.

### Future Versions

Future schema versions will:
1. Be backward compatible where possible
2. Include migration logic for older files
3. Document changes in this file

## Validation Rules

### .keypage Validation

- `format` must be `"keypage"`
- `schemaVersion` must be supported
- `pageId` must be valid UUID
- `pads` array contains valid pad settings
- All referenced sounds must exist in `sounds/` folder

### .keyloop Validation

- `format` must be `"keyloop"`
- `schemaVersion` must be supported
- `bpm` must be 20-300
- `masterVolume` must be 0.0-1.0
- All referenced page files must exist
- `pageCount` must match `pages.length`

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| "Invalid format" | Wrong `format` field | Check file type |
| "Unsupported version" | Unknown `schemaVersion` | Update Qeyloop |
| "Missing manifest" | No `page.json` or `project.json` | File is corrupted |
| "Missing sound" | Referenced WAV not found | Re-export source |

## MIME Types

For server configuration:

```
.keypage  →  application/zip
.keyloop  →  application/zip
```

Or custom:

```
.keypage  →  application/x-keypage+zip
.keyloop  →  application/x-keyloop+zip
```
