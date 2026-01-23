/**
 * Qeyloop Project Import/Export
 * 
 * Handles saving and loading complete projects as ZIP files.
 * Supports multi-page projects (version 2).
 * Includes:
 * - All sound files (per page)
 * - Key mappings
 * - Mode settings
 * - BPM settings
 * - Page configurations
 */

import JSZip from 'jszip';
import { audioEngine } from '../audio/engine';
import { modeManager } from '../modes/manager';
import { bpmController } from '../timing/bpm';
import { pageManager, MultiPageProject, SerializablePageState } from '../pages/manager';
import {
  ProjectState,
  KeyMapping,
  ModulationPreset,
  SoundData,
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
   * === MULTI-PAGE EXPORT ===
   */
  async exportProject(projectName: string = 'project'): Promise<void> {
    const zip = new JSZip();
    
    // Collect multi-page project state
    const projectState = pageManager.exportProject();
    
    // Add manifest
    zip.file(this.manifestName, JSON.stringify(projectState, null, 2));
    
    // Add sound files for all pages
    const soundsFolder = zip.folder(this.soundsFolder);
    if (soundsFolder) {
      // Get all sounds from all pages
      const allPages = pageManager.getAllPages();
      for (const page of allPages) {
        const pageFolder = soundsFolder.folder(`page_${page.index}`);
        if (pageFolder) {
          for (const [soundIndex, sound] of page.sounds) {
            // Convert Float32Array to WAV format
            const wavData = this.float32ToWav(sound.samples, sound.sampleRate);
            pageFolder.file(`${soundIndex}_${sound.name.replace(/\.[^/.]+$/, '.wav')}`, wavData);
          }
        }
      }
    }
    
    // Generate ZIP file
    const blob = await zip.generateAsync({ type: 'blob' });
    
    // Trigger download
    this.downloadBlob(blob, `${projectName}${this.extension}`);
  }
  
  /**
   * Import project from a ZIP file
   * === MULTI-PAGE IMPORT ===
   */
  async importProject(file: File): Promise<void> {
    const zip = await JSZip.loadAsync(file);
    
    // Read manifest
    const manifestFile = zip.file(this.manifestName);
    if (!manifestFile) {
      throw new Error('Invalid project file: missing manifest');
    }
    
    const manifestText = await manifestFile.async('text');
    const manifest = JSON.parse(manifestText);
    
    // Check version and delegate to appropriate importer
    if (manifest.version === 1) {
      await this.importLegacyProject(zip, manifest as ProjectState);
    } else if (manifest.version === 2) {
      await this.importMultiPageProject(zip, manifest as MultiPageProject);
    } else {
      throw new Error(`Unsupported project version: ${manifest.version}`);
    }
  }
  
  /**
   * Import legacy single-page project (version 1)
   * === REMAPS TO ACTIVE PAGE RANGE ===
   */
  private async importLegacyProject(zip: JSZip, state: ProjectState): Promise<void> {
    // === CRITICAL: Get target page range ===
    const activePage = pageManager.getActivePage();
    const pageStart = activePage.index * 64;
    const pageEnd = pageStart + 64;
    
    console.log(`Importing legacy project into page ${activePage.index + 1}, remapping sounds to range ${pageStart}-${pageEnd - 1}`);
    
    // === CLEAR EVERYTHING FIRST ===
    audioEngine.panic();
    pageManager.clearActivePage();
    
    // Build mapping from old indices to new indices
    const indexRemap = new Map<number, number>();
    let nextIndex = pageStart;
    
    // Load sounds
    const soundsFolder = zip.folder(this.soundsFolder);
    if (soundsFolder) {
      const soundNameToIndex: Map<string, number> = new Map();
      for (const [index, name] of Object.entries(state.soundFiles)) {
        soundNameToIndex.set(name, parseInt(index));
      }
      
      const soundPromises: Promise<void>[] = [];
      
      soundsFolder.forEach((relativePath, file) => {
        if (file.dir) return;
        
        const promise = (async () => {
          const arrayBuffer = await file.async('arraybuffer');
          const samples = await this.wavToFloat32(arrayBuffer);
          
          const baseName = relativePath.replace(/\.wav$/, '');
          const originalName = Object.entries(state.soundFiles).find(
            ([, name]) => name.replace(/\.[^/.]+$/, '') === baseName
          );
          
          if (originalName) {
            const oldIndex = parseInt(originalName[0]);
            
            // === REMAP: Assign new index in target page range ===
            if (nextIndex >= pageEnd) {
              console.warn(`Page ${activePage.index + 1} sound limit reached, skipping sound`);
              return;
            }
            const newIndex = nextIndex++;
            indexRemap.set(oldIndex, newIndex);
            
            audioEngine.loadSoundFromSamples(newIndex, originalName[1], samples);
            // Store in page manager with new index
            pageManager.storeSoundData(newIndex, {
              index: newIndex,
              name: originalName[1],
              samples,
              sampleRate: 48000,
              duration: samples.length / 48000,
            });
          }
        })();
        
        soundPromises.push(promise);
      });
      
      await Promise.all(soundPromises);
    }
    
    // Apply state using legacy method, with remapped indices
    this.applyStateWithRemap(state, indexRemap);
  }
  
  /**
   * Import multi-page project (version 2)
   */
  private async importMultiPageProject(zip: JSZip, project: MultiPageProject): Promise<void> {
    // Apply global settings first
    bpmController.importState({
      bpm: project.bpm,
      metronome: project.metronome,
    });
    audioEngine.setMasterVolume(project.masterVolume);
    
    // Load sounds for each page
    const soundsFolder = zip.folder(this.soundsFolder);
    
    for (const pageState of project.pages) {
      const pageFolder = soundsFolder?.folder(`page_${pageState.index}`);
      
      if (pageFolder) {
        const soundPromises: Promise<{index: number; name: string; samples: Float32Array} | null>[] = [];
        
        pageFolder.forEach((relativePath, file) => {
          if (file.dir) return;
          
          const promise = (async () => {
            const arrayBuffer = await file.async('arraybuffer');
            const samples = await this.wavToFloat32(arrayBuffer);
            
            // Parse filename: "{soundIndex}_{originalName}.wav"
            const match = relativePath.match(/^(\d+)_(.+)\.wav$/);
            if (match) {
              const soundIndex = parseInt(match[1]);
              const originalName = match[2] + '.wav';
              return { index: soundIndex, name: originalName, samples };
            }
            return null;
          })();
          
          soundPromises.push(promise);
        });
        
        const loadedSounds = await Promise.all(soundPromises);
        
        // Store sounds in project for this page
        for (const sound of loadedSounds) {
          if (sound) {
            // Temporarily store - will be loaded when page is activated
            const soundData: SoundData = {
              index: sound.index,
              name: sound.name,
              samples: sound.samples,
              sampleRate: 48000,
              duration: sound.samples.length / 48000,
            };
            
            // Store in the page state before import
            pageState.soundFiles[sound.index] = sound.name;
          }
        }
      }
    }
    
    // Import pages into page manager
    pageManager.importProject(project);
    
    // Now load sounds for all pages into audio engine
    for (const pageState of project.pages) {
      const pageFolder = soundsFolder?.folder(`page_${pageState.index}`);
      
      if (pageFolder) {
        const soundPromises: Promise<void>[] = [];
        
        pageFolder.forEach((relativePath, file) => {
          if (file.dir) return;
          
          const promise = (async () => {
            const arrayBuffer = await file.async('arraybuffer');
            const samples = await this.wavToFloat32(arrayBuffer);
            
            const match = relativePath.match(/^(\d+)_(.+)\.wav$/);
            if (match) {
              const soundIndex = parseInt(match[1]);
              const originalName = match[2];
              
              // Load sound into audio engine
              audioEngine.loadSoundFromSamples(soundIndex, originalName, samples);
              
              // Store in page manager
              const page = pageManager.getAllPages()[pageState.index];
              if (page) {
                page.sounds.set(soundIndex, {
                  index: soundIndex,
                  name: originalName,
                  samples,
                  sampleRate: 48000,
                  duration: samples.length / 48000,
                });
              }
            }
          })();
          
          soundPromises.push(promise);
        });
        
        await Promise.all(soundPromises);
      }
    }
  }
  
  /**
   * Apply imported state with remapped sound indices
   */
  private applyStateWithRemap(state: ProjectState, indexRemap: Map<number, number>): void {
    // Apply BPM and metronome
    bpmController.importState({
      bpm: state.bpm,
      metronome: state.metronome,
    });
    
    // Apply master volume
    audioEngine.setMasterVolume(state.masterVolume);
    
    // Apply modulation preset
    modeManager.setModulationPreset(state.modulationPreset);
    
    // Apply key mappings with remapped sound indices
    const remappedMappings = state.keyMappings.map(mapping => {
      const newSoundIndex = indexRemap.get(mapping.soundIndex) ?? mapping.soundIndex;
      return {
        ...mapping,
        soundIndex: newSoundIndex,
      };
    });
    
    // === Apply mappings to active page (stores in page state) ===
    for (const mapping of remappedMappings) {
      if (mapping.hasSound) {
        // Store key-sound association in page
        pageManager.setKeySoundIndex(mapping.keyCode, mapping.soundIndex);
        // Store full mapping in page
        pageManager.setKeyMapping(mapping.keyCode, mapping);
        // Apply to mode manager and audio engine
        modeManager.setMapping(mapping);
      }
    }
    
    // Save the imported state to the page
    pageManager.saveCurrentPageState();
    
    // === Reload page to ensure everything is properly connected ===
    pageManager.reloadActivePage();
  }
  
  /**
   * Collect current state for export (legacy compatibility)
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
