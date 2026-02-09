/* tslint:disable */
/* eslint-disable */

export class DspEngine {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Get number of active voices (for UI feedback)
     */
    get_active_voice_count(): number;
    /**
     * Get current BPM
     */
    get_bpm(): number;
    get_key_group_id(key_code: number): number;
    get_key_has_sound(key_code: number): boolean;
    /**
     * Get key mapping info (for serialization)
     */
    get_key_mode(key_code: number): PlaybackMode;
    get_key_modulation(key_code: number): boolean;
    get_key_overlap_mode(key_code: number): OverlapMode;
    get_key_pitch(key_code: number): number;
    get_key_sound_index(key_code: number): number;
    get_key_volume(key_code: number): number;
    /**
     * Check if a specific key is currently playing
     */
    is_key_playing(key_code: number): boolean;
    /**
     * Load audio data into a sound slot
     *
     * # Arguments
     * * `sound_index` - Which slot to load into (0-63)
     * * `samples` - Audio samples (mono f32)
     */
    load_sound(sound_index: number, samples: Float32Array): void;
    /**
     * Create a new DSP engine
     */
    constructor(sample_rate: number);
    /**
     * Release a sound (key up)
     */
    note_off(key_code: number): void;
    /**
     * Trigger a sound (key down)
     */
    note_on(key_code: number): void;
    /**
     * Stop all sounds immediately
     */
    panic(): void;
    /**
     * Process a single audio block
     *
     * This is the main audio callback - called from AudioWorklet.
     * CRITICAL: No allocations, no panics, no async operations allowed here.
     *
     * # Arguments
     * * `output` - Mutable slice to write audio output (stereo interleaved)
     */
    process(output: Float32Array): void;
    /**
     * Reset timing (call when starting/stopping transport)
     */
    reset_timing(): void;
    /**
     * Set global BPM
     */
    set_bpm(bpm: number): void;
    /**
     * Map a key to a sound with settings
     */
    set_key_mapping(key_code: number, sound_index: number, mode: PlaybackMode, overlap_mode: OverlapMode, group_id: number, volume: number, pitch_semitones: number, modulation_enabled: boolean): void;
    /**
     * Update just the playback mode for a key
     */
    set_key_mode(key_code: number, mode: PlaybackMode): void;
    /**
     * Update just the modulation setting for a key
     */
    set_key_modulation(key_code: number, enabled: boolean): void;
    /**
     * Set overlap mode and group for a key
     */
    set_key_overlap(key_code: number, mode: OverlapMode, group_id: number): void;
    /**
     * Update pitch for a key (in semitones)
     */
    set_key_pitch(key_code: number, semitones: number): void;
    /**
     * Update volume for a key
     */
    set_key_volume(key_code: number, volume: number): void;
    /**
     * Set master volume
     */
    set_master_volume(volume: number): void;
    /**
     * Enable/disable metronome
     */
    set_metronome(enabled: boolean, volume: number): void;
    /**
     * Set modulation preset
     */
    set_modulation_preset(preset: ModulationPreset): void;
    /**
     * Unload a sound from a slot
     */
    unload_sound(sound_index: number): void;
}

export enum ModulationPreset {
    /**
     * No modulation
     */
    None = 0,
    /**
     * 1/4 note fake sidechain (duck on each beat)
     */
    QuarterSidechain = 1,
    /**
     * 1/8 note sidechain
     */
    EighthSidechain = 2,
    /**
     * 1/16 note sidechain
     */
    SixteenthSidechain = 3,
}

export enum OverlapMode {
    /**
     * Multiple sounds can play simultaneously
     */
    Polyphonic = 0,
    /**
     * New sound cuts previous sound in same group
     */
    Monophonic = 1,
}

export enum PlaybackMode {
    /**
     * Sound plays once on key down
     */
    SingleShot = 0,
    /**
     * Sound loops, BPM-synced
     */
    Loop = 1,
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_dspengine_free: (a: number, b: number) => void;
    readonly dspengine_get_active_voice_count: (a: number) => number;
    readonly dspengine_get_bpm: (a: number) => number;
    readonly dspengine_get_key_group_id: (a: number, b: number) => number;
    readonly dspengine_get_key_has_sound: (a: number, b: number) => number;
    readonly dspengine_get_key_mode: (a: number, b: number) => number;
    readonly dspengine_get_key_modulation: (a: number, b: number) => number;
    readonly dspengine_get_key_overlap_mode: (a: number, b: number) => number;
    readonly dspengine_get_key_pitch: (a: number, b: number) => number;
    readonly dspengine_get_key_sound_index: (a: number, b: number) => number;
    readonly dspengine_get_key_volume: (a: number, b: number) => number;
    readonly dspengine_is_key_playing: (a: number, b: number) => number;
    readonly dspengine_load_sound: (a: number, b: number, c: number, d: number) => void;
    readonly dspengine_new: (a: number) => number;
    readonly dspengine_note_off: (a: number, b: number) => void;
    readonly dspengine_note_on: (a: number, b: number) => void;
    readonly dspengine_panic: (a: number) => void;
    readonly dspengine_process: (a: number, b: number, c: number, d: any) => void;
    readonly dspengine_reset_timing: (a: number) => void;
    readonly dspengine_set_bpm: (a: number, b: number) => void;
    readonly dspengine_set_key_mapping: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => void;
    readonly dspengine_set_key_mode: (a: number, b: number, c: number) => void;
    readonly dspengine_set_key_modulation: (a: number, b: number, c: number) => void;
    readonly dspengine_set_key_overlap: (a: number, b: number, c: number, d: number) => void;
    readonly dspengine_set_key_pitch: (a: number, b: number, c: number) => void;
    readonly dspengine_set_key_volume: (a: number, b: number, c: number) => void;
    readonly dspengine_set_master_volume: (a: number, b: number) => void;
    readonly dspengine_set_metronome: (a: number, b: number, c: number) => void;
    readonly dspengine_set_modulation_preset: (a: number, b: number) => void;
    readonly dspengine_unload_sound: (a: number, b: number) => void;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
