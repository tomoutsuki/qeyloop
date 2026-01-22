/**
 * Qeyloop Project Import/Export
 * 
 * Handles saving and loading complete projects as ZIP files.
 * Includes:
 * - All sound files
 * - Key mappings
 * - Mode settings
 * - BPM settings
 */

import JSZip from 'jszip';
import { audioEngine } from '../audio/engine';
import { modeManager } from '../modes/manager';
import { bpmController } from '../timing/bpm';
import {
  ProjectState,
  KeyMapping,
  ModulationPreset,
  createDefaultProjectState,
} from '../types';

// ============================================================================
// PROJECT IO
// ============================================================================

export class ProjectIO {
  /** Project file extension */
  private readonly extension = '.qeyloop';
  
  /** Manifest file name in ZIP */
  private readonly manifestName = 'project.json';
  
  /** Sounds folder in ZIP */
  private readonly soundsFolder = 'sounds/';
  
  /**
   * Export current project to a downloadable ZIP file
   */
  async exportProject(projectName: string = 'project'): Promise<void> {
    const zip = new JSZip();
    
    // Collect project state
    const state = this.collectState();
    
    // Add manifest
    zip.file(this.manifestName, JSON.stringify(state, null, 2));
    
    // Add sound files
    const soundsFolder = zip.folder(this.soundsFolder);
    if (soundsFolder) {
      const sounds = audioEngine.getAllLoadedSounds();
      for (const sound of sounds) {
        // Convert Float32Array to WAV format
        const wavData = this.float32ToWav(sound.samples, sound.sampleRate);
        soundsFolder.file(sound.name.replace(/\.[^/.]+$/, '.wav'), wavData);
      }
    }
    
    // Generate ZIP file
    const blob = await zip.generateAsync({ type: 'blob' });
    
    // Trigger download
    this.downloadBlob(blob, `${projectName}${this.extension}`);
  }
  
  /**
   * Import project from a ZIP file
   */
  async importProject(file: File): Promise<void> {
    const zip = await JSZip.loadAsync(file);
    
    // Read manifest
    const manifestFile = zip.file(this.manifestName);
    if (!manifestFile) {
      throw new Error('Invalid project file: missing manifest');
    }
    
    const manifestText = await manifestFile.async('text');
    const state: ProjectState = JSON.parse(manifestText);
    
    // Validate version
    if (state.version !== 1) {
      throw new Error(`Unsupported project version: ${state.version}`);
    }
    
    // Load sounds
    const soundsFolder = zip.folder(this.soundsFolder);
    if (soundsFolder) {
      // Build map of sound file names to indices
      const soundNameToIndex: Map<string, number> = new Map();
      for (const [index, name] of Object.entries(state.soundFiles)) {
        soundNameToIndex.set(name, parseInt(index));
      }
      
      // Load each sound file
      const soundPromises: Promise<void>[] = [];
      
      soundsFolder.forEach((relativePath, file) => {
        if (file.dir) return;
        
        const promise = (async () => {
          const arrayBuffer = await file.async('arraybuffer');
          const samples = await this.wavToFloat32(arrayBuffer);
          
          // Find the index for this sound
          const baseName = relativePath.replace(/\.wav$/, '');
          const originalName = Object.entries(state.soundFiles).find(
            ([, name]) => name.replace(/\.[^/.]+$/, '') === baseName
          );
          
          if (originalName) {
            const index = parseInt(originalName[0]);
            audioEngine.loadSoundFromSamples(index, originalName[1], samples);
          }
        })();
        
        soundPromises.push(promise);
      });
      
      await Promise.all(soundPromises);
    }
    
    // Apply state
    this.applyState(state);
  }
  
  /**
   * Collect current state for export
   */
  private collectState(): ProjectState {
    const bpmState = bpmController.exportState();
    const mappings = modeManager.exportMappings();
    
    // Build sound files map
    const soundFiles: { [index: number]: string } = {};
    const sounds = audioEngine.getAllLoadedSounds();
    for (const sound of sounds) {
      soundFiles[sound.index] = sound.name;
    }
    
    return {
      version: 1,
      bpm: bpmState.bpm,
      masterVolume: audioEngine.getMasterVolume(),
      metronome: bpmState.metronome,
      modulationPreset: modeManager.getModulationPreset(),
      keyMappings: mappings,
      soundFiles,
    };
  }
  
  /**
   * Apply imported state
   */
  private applyState(state: ProjectState): void {
    // Apply BPM and metronome
    bpmController.importState({
      bpm: state.bpm,
      metronome: state.metronome,
    });
    
    // Apply master volume
    audioEngine.setMasterVolume(state.masterVolume);
    
    // Apply modulation preset
    modeManager.setModulationPreset(state.modulationPreset);
    
    // Apply key mappings
    modeManager.importMappings(state.keyMappings);
  }
  
  /**
   * Convert Float32Array audio to WAV format
   */
  private float32ToWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
    const numChannels = 1;
    const bytesPerSample = 2; // 16-bit
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = samples.length * bytesPerSample;
    const bufferSize = 44 + dataSize;
    
    const buffer = new ArrayBuffer(bufferSize);
    const view = new DataView(buffer);
    
    // Write WAV header
    // "RIFF" chunk descriptor
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, bufferSize - 8, true);
    this.writeString(view, 8, 'WAVE');
    
    // "fmt " sub-chunk
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size (PCM)
    view.setUint16(20, 1, true); // AudioFormat (PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bytesPerSample * 8, true);
    
    // "data" sub-chunk
    this.writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);
    
    // Write audio data
    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      // Convert float to 16-bit integer
      const sample = Math.max(-1, Math.min(1, samples[i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
    
    return buffer;
  }
  
  /**
   * Convert WAV ArrayBuffer to Float32Array
   */
  private async wavToFloat32(arrayBuffer: ArrayBuffer): Promise<Float32Array> {
    // Use OfflineAudioContext to decode
    const audioContext = new OfflineAudioContext(1, 1, 48000);
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Get mono data
    const samples = new Float32Array(audioBuffer.length);
    const channelData = audioBuffer.getChannelData(0);
    samples.set(channelData);
    
    return samples;
  }
  
  /**
   * Write string to DataView
   */
  private writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
  
  /**
   * Trigger file download
   */
  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  
  /**
   * Create file input for importing
   */
  createImportInput(): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = this.extension;
    
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (file) {
        try {
          await this.importProject(file);
          window.dispatchEvent(new CustomEvent('qeyloop:projectLoaded'));
        } catch (error) {
          console.error('Failed to import project:', error);
          window.dispatchEvent(new CustomEvent('qeyloop:projectError', {
            detail: { error: (error as Error).message }
          }));
        }
      }
    });
    
    return input;
  }
}

// Singleton instance
export const projectIO = new ProjectIO();
