/**
 * Qeyloop Project Import/Export
 * 
 * NEW FILE FORMAT SYSTEM:
 * - .keypage → Single page file (standalone)
 * - .keyloop → Multi-page project container (ZIP of .keypage files)
 * 
 * All per-pad and per-page parameters are fully persisted.
 * No backward compatibility with old formats (as per requirements).
 */

import JSZip from 'jszip';
import { audioEngine } from '../audio/engine';
import { modeManager } from '../modes/manager';
import { bpmController } from '../timing/bpm';
import { pageManager, PageState } from '../pages/manager';
import {
  KeyMapping,
  ModulationPreset,
  SoundData,
  KeyPageFile,
  KeyLoopFile,
  PadSettings,
  KeyLoopPageEntry,
  generatePageId,
  PlaybackMode,
  PlaybackType,
  OverlapMode,
} from '../types';

// ============================================================================
// CONSTANTS
// ============================================================================

/** File extensions */
const KEYPAGE_EXTENSION = '.keypage';
const KEYLOOP_EXTENSION = '.keyloop';

/** Manifest filenames */
const KEYPAGE_MANIFEST = 'page.json';
const KEYLOOP_MANIFEST = 'project.json';

/** Sounds folder in ZIP */
const SOUNDS_FOLDER = 'sounds/';

// ============================================================================
// PROJECT IO
// ============================================================================

export class ProjectIO {
  
  // ==========================================================================
  // .KEYPAGE EXPORT (Single Page)
  // ==========================================================================
  
  /**
   * Export a single page as .keypage file
   * @param pageIndex Page index to export (defaults to active page)
   * @param fileName Optional custom filename
   */
  async exportPage(pageIndex?: number, fileName?: string): Promise<void> {
    // Default to active page
    const targetIndex = pageIndex ?? pageManager.getActivePageIndex();
    const page = pageManager.getAllPages()[targetIndex];
    
    if (!page) {
      throw new Error(`Page ${targetIndex} does not exist`);
    }
    
    // Save current state first
    pageManager.saveCurrentPageState();
    
    const zip = new JSZip();
    
    // Build the .keypage manifest
    const keyPageFile = this.buildKeyPageManifest(page);
    
    // Add manifest
    zip.file(KEYPAGE_MANIFEST, JSON.stringify(keyPageFile, null, 2));
    
    // Add sound files
    const soundsFolder = zip.folder(SOUNDS_FOLDER);
    if (soundsFolder) {
      for (const [soundIndex, sound] of page.sounds) {
        const wavData = this.float32ToWav(sound.samples, sound.sampleRate);
        // Store as: {localIndex}_{filename}.wav (localIndex is 0-63 within page)
        const localIndex = soundIndex % 64;
        soundsFolder.file(`${localIndex}_${sound.name.replace(/\.[^/.]+$/, '.wav')}`, wavData);
      }
    }
    
    // Generate and download
    const blob = await zip.generateAsync({ type: 'blob' });
    const name = fileName || `${page.name.replace(/\s+/g, '_')}${KEYPAGE_EXTENSION}`;
    this.downloadBlob(blob, name);
  }
  
  /**
   * Build .keypage manifest from page state
   */
  private buildKeyPageManifest(page: PageState): KeyPageFile {
    const pads: PadSettings[] = [];
    const soundFiles: { [soundIndex: number]: string } = {};
    
    // Convert key mappings to pad settings
    for (const [keyCode, mapping] of page.keyMappings) {
      // Get page jump target for this pad
      const pageJumpTarget = page.padPageJumps.get(keyCode) ?? -1;
      
      // Only include pads that have sounds or page jumps
      if (mapping.hasSound || pageJumpTarget >= 0) {
        // Convert sound index to local (0-63) for portability
        const localSoundIndex = mapping.hasSound ? (mapping.soundIndex % 64) : -1;
        
        pads.push({
          keyCode,
          volume: mapping.volume,
          pitchSemitones: mapping.pitchSemitones,
          playbackMode: mapping.mode,
          playbackType: mapping.playbackType,
          modulationEnabled: mapping.modulationEnabled,
          overlapMode: mapping.overlapMode,
          overlapGroupId: mapping.groupId,
          pageJumpTarget,
          soundFileName: mapping.soundName,
          soundIndex: localSoundIndex,
          hasSound: mapping.hasSound,
        });
      }
    }
    
    // Build sound files map (using local indices 0-63)
    for (const [soundIndex, sound] of page.sounds) {
      const localIndex = soundIndex % 64;
      soundFiles[localIndex] = sound.name;
    }
    
    return {
      format: 'keypage',
      schemaVersion: 1,
      pageId: generatePageId(),
      pageName: page.name,
      modulationPreset: page.modulationPreset,
      pads,
      soundFiles,
    };
  }
  
  // ==========================================================================
  // .KEYPAGE IMPORT (Single Page)
  // ==========================================================================
  
  /**
   * Import a .keypage file into a specific page slot
   * @param file The .keypage file to import
   * @param targetPageIndex Target page index (defaults to active page)
   */
  async importPage(file: File, targetPageIndex?: number): Promise<void> {
    const zip = await JSZip.loadAsync(file);
    
    // Read manifest
    const manifestFile = zip.file(KEYPAGE_MANIFEST);
    if (!manifestFile) {
      throw new Error('Invalid .keypage file: missing manifest');
    }
    
    const manifestText = await manifestFile.async('text');
    const keyPageFile = JSON.parse(manifestText) as KeyPageFile;
    
    // Validate format
    if (keyPageFile.format !== 'keypage') {
      throw new Error('Invalid file format: expected .keypage');
    }
    
    // Use active page if not specified
    const pageIndex = targetPageIndex ?? pageManager.getActivePageIndex();
    
    // Switch to target page and clear it
    pageManager.switchToPage(pageIndex);
    pageManager.clearActivePage();
    
    // Calculate target page's sound index range
    const pageStart = pageIndex * 64;
    
    // Load sounds
    const soundsFolder = zip.folder(SOUNDS_FOLDER);
    if (soundsFolder) {
      const soundPromises: Promise<void>[] = [];
      
      soundsFolder.forEach((relativePath, zipFile) => {
        if (zipFile.dir) return;
        
        const promise = (async () => {
          const arrayBuffer = await zipFile.async('arraybuffer');
          const samples = await this.wavToFloat32(arrayBuffer);
          
          // Parse filename: "{localIndex}_{originalName}.wav"
          const match = relativePath.match(/^(\d+)_(.+)\.wav$/);
          if (match) {
            const localIndex = parseInt(match[1]);
            const originalName = match[2] + '.wav';
            
            // Remap local index (0-63) to global index (pageStart + localIndex)
            const globalIndex = pageStart + localIndex;
            
            // Load into audio engine
            audioEngine.loadSoundFromSamples(globalIndex, originalName, samples);
            
            // Store in page manager
            pageManager.storeSoundData(globalIndex, {
              index: globalIndex,
              name: originalName,
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
    
    // Apply pad settings
    this.applyKeyPageSettings(keyPageFile, pageStart);
    
    // Reload page to connect everything
    pageManager.reloadActivePage();
  }
  
  /**
   * Convert legacy keyCode to new extended keyboard layout keyCode
   * Old files used the 40-key layout, new layout has 48 keys with extended keys
   */
  private convertLegacyKeyCode(oldKeyCode: number): number {
    // If keyCode is already in the new system (from newer files), return as-is
    // New keyCodes include: 192 (backtick), 189 (minus), 187 (equal), 219/221/220 (brackets),
    // 13 (enter), 222 (quote), 16 (shift)
    const newKeyCodes = [192, 189, 187, 219, 221, 220, 13, 222, 16];
    if (newKeyCodes.includes(oldKeyCode)) {
      return oldKeyCode;
    }
    
    // Old keyCodes (40-key layout) remain the same in new layout:
    // Numbers: 48-57 (0-9) - but 48 moved from position 9 to position 10
    // Letters: 65-90 (A-Z)
    // Symbols: 186 (;), 188 (,), 190 (.), 191 (/)
    
    // The old layout was: 1-9-0, Q-P, A-;, Z-/
    // The new layout is: `-1-9-0-=, Q-P-[-]-\, A-;-'-Enter, Z-/-Shift
    
    // All old keyCodes are still valid in the new system, no conversion needed
    // The issue is that the old files might not have been using keyCodes at all,
    // but rather array indices. Let me check if the keyCode is in the 0-39 range
    
    if (oldKeyCode >= 0 && oldKeyCode < 40) {
      // Old format used array indices (0-39)
      // Convert to actual keyCodes
      const oldLayout = [
        49, 50, 51, 52, 53, 54, 55, 56, 57, 48,  // 1234567890
        81, 87, 69, 82, 84, 89, 85, 73, 79, 80,  // QWERTYUIOP
        65, 83, 68, 70, 71, 72, 74, 75, 76, 186, // ASDFGHJKL;
        90, 88, 67, 86, 66, 78, 77, 188, 190, 191, // ZXCVBNM,./
      ];
      const converted = oldLayout[oldKeyCode];
      console.log(`Converting legacy keyCode ${oldKeyCode} (index) → ${converted}`);
      return converted;
    }
    
    // KeyCode is already in proper format
    return oldKeyCode;
  }

  /**
   * Apply .keypage pad settings to active page
   */
  private applyKeyPageSettings(keyPageFile: KeyPageFile, pageStart: number): void {
    // Apply modulation preset
    modeManager.setModulationPreset(keyPageFile.modulationPreset);
    
    // Track which keyCodes have been processed to avoid duplicates
    const processedKeys = new Set<number>();
    
    // Apply pad settings
    for (const pad of keyPageFile.pads) {
      // Convert old keyCode format to new format if needed
      const keyCode = this.convertLegacyKeyCode(pad.keyCode);
      
      // Skip if this keyCode was already processed (duplicate in file)
      if (processedKeys.has(keyCode)) {
        console.warn(`Duplicate keyCode ${keyCode} found in .keypage file, skipping`);
        continue;
      }
      processedKeys.add(keyCode);
      
      // Remap sound index to global range
      const globalSoundIndex = pad.hasSound ? (pageStart + pad.soundIndex) : 0;
      
      // Build key mapping
      const mapping: KeyMapping = {
        keyCode: keyCode,
        soundIndex: globalSoundIndex,
        soundName: pad.soundFileName,
        mode: pad.playbackMode,
        playbackType: pad.playbackType ?? PlaybackType.OneShot,  // Default for backward compat
        overlapMode: pad.overlapMode,
        groupId: pad.overlapGroupId,
        volume: pad.volume,
        pitchSemitones: pad.pitchSemitones,
        modulationEnabled: pad.modulationEnabled,
        hasSound: pad.hasSound,
      };
      
      if (pad.hasSound) {
        // Store key-sound association
        pageManager.setKeySoundIndex(keyCode, globalSoundIndex);
        // Store mapping
        pageManager.setKeyMapping(keyCode, mapping);
        // Apply to mode manager and audio engine
        modeManager.setMapping(mapping);
      }
      
      // Set page jump target if configured
      if (pad.pageJumpTarget >= 0) {
        pageManager.setPadPageJump(keyCode, pad.pageJumpTarget);
      }
    }
    
    // Rename page if provided
    if (keyPageFile.pageName) {
      pageManager.renamePage(pageManager.getActivePageIndex(), keyPageFile.pageName);
    }
    
    // Save state
    pageManager.saveCurrentPageState();
  }
  
  // ==========================================================================
  // .KEYLOOP EXPORT (Multi-Page Project)
  // ==========================================================================
  
  /**
   * Export entire project as .keyloop file
   * @param projectName Optional project name
   */
  async exportProject(projectName: string = 'project'): Promise<void> {
    // Save current state first
    pageManager.saveCurrentPageState();
    
    const zip = new JSZip();
    const pages = pageManager.getAllPages();
    const pageEntries: KeyLoopPageEntry[] = [];
    
    // Export each page as embedded .keypage
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const pageId = generatePageId();
      const filename = `page_${i}.keypage`;
      
      // Create page folder
      const pageFolder = zip.folder(filename);
      if (pageFolder) {
        // Build page manifest
        const keyPageFile = this.buildKeyPageManifest(page);
        keyPageFile.pageId = pageId; // Use consistent ID
        
        pageFolder.file(KEYPAGE_MANIFEST, JSON.stringify(keyPageFile, null, 2));
        
        // Add sounds
        const soundsFolder = pageFolder.folder(SOUNDS_FOLDER);
        if (soundsFolder) {
          for (const [soundIndex, sound] of page.sounds) {
            const wavData = this.float32ToWav(sound.samples, sound.sampleRate);
            const localIndex = soundIndex % 64;
            soundsFolder.file(`${localIndex}_${sound.name.replace(/\.[^/.]+$/, '.wav')}`, wavData);
          }
        }
      }
      
      // Add to page entries
      pageEntries.push({
        pageId,
        filename,
        orderIndex: i,
      });
    }
    
    // Build project manifest
    const bpmState = bpmController.exportState();
    const keyLoopFile: KeyLoopFile = {
      format: 'keyloop',
      schemaVersion: 1,
      bpm: bpmState.bpm,
      masterVolume: audioEngine.getMasterVolume(),
      metronome: bpmState.metronome,
      activePageIndex: pageManager.getActivePageIndex(),
      pageCount: pages.length,
      pages: pageEntries,
    };
    
    // Add project manifest
    zip.file(KEYLOOP_MANIFEST, JSON.stringify(keyLoopFile, null, 2));
    
    // Generate and download
    const blob = await zip.generateAsync({ type: 'blob' });
    this.downloadBlob(blob, `${projectName}${KEYLOOP_EXTENSION}`);
  }
  
  // ==========================================================================
  // .KEYLOOP IMPORT (Multi-Page Project)
  // ==========================================================================
  
  /**
   * Import a .keyloop project file
   * Replaces entire project state with imported content
   */
  async importProject(file: File): Promise<void> {
    const zip = await JSZip.loadAsync(file);
    
    // Read project manifest
    const manifestFile = zip.file(KEYLOOP_MANIFEST);
    if (!manifestFile) {
      throw new Error('Invalid .keyloop file: missing project manifest');
    }
    
    const manifestText = await manifestFile.async('text');
    const keyLoopFile = JSON.parse(manifestText) as KeyLoopFile;
    
    // Validate format
    if (keyLoopFile.format !== 'keyloop') {
      throw new Error('Invalid file format: expected .keyloop');
    }
    
    // Apply global settings
    bpmController.importState({
      bpm: keyLoopFile.bpm,
      metronome: keyLoopFile.metronome,
    });
    audioEngine.setMasterVolume(keyLoopFile.masterVolume);
    
    // Clear and reset page manager
    pageManager.initialize();
    
    // Sort pages by order index
    const sortedPages = [...keyLoopFile.pages].sort((a, b) => a.orderIndex - b.orderIndex);
    
    // Import each page
    for (const pageEntry of sortedPages) {
      // Create page slot
      const pageIndex = pageEntry.orderIndex;
      while (pageManager.getAllPages().length <= pageIndex) {
        pageManager.createPage();
      }
      
      // Switch to this page
      pageManager.switchToPage(pageIndex);
      pageManager.clearActivePage();
      
      // Get page folder
      const pageFolder = zip.folder(pageEntry.filename);
      if (!pageFolder) {
        console.warn(`Missing page folder: ${pageEntry.filename}`);
        continue;
      }
      
      // Read page manifest
      const pageManifestFile = pageFolder.file(KEYPAGE_MANIFEST);
      if (!pageManifestFile) {
        console.warn(`Missing page manifest in: ${pageEntry.filename}`);
        continue;
      }
      
      const pageManifestText = await pageManifestFile.async('text');
      const keyPageFile = JSON.parse(pageManifestText) as KeyPageFile;
      
      const pageStart = pageIndex * 64;
      
      // Load sounds
      const soundsFolder = pageFolder.folder(SOUNDS_FOLDER);
      if (soundsFolder) {
        const soundPromises: Promise<void>[] = [];
        
        soundsFolder.forEach((relativePath, zipFile) => {
          if (zipFile.dir) return;
          
          const promise = (async () => {
            const arrayBuffer = await zipFile.async('arraybuffer');
            const samples = await this.wavToFloat32(arrayBuffer);
            
            const match = relativePath.match(/^(\d+)_(.+)\.wav$/);
            if (match) {
              const localIndex = parseInt(match[1]);
              const originalName = match[2] + '.wav';
              const globalIndex = pageStart + localIndex;
              
              audioEngine.loadSoundFromSamples(globalIndex, originalName, samples);
              pageManager.storeSoundData(globalIndex, {
                index: globalIndex,
                name: originalName,
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
      
      // Apply pad settings
      this.applyKeyPageSettings(keyPageFile, pageStart);
    }
    
    // Switch to the originally active page
    pageManager.switchToPage(keyLoopFile.activePageIndex);
  }
  
  // ==========================================================================
  // FILE DETECTION & UNIFIED IMPORT
  // ==========================================================================
  
  /**
   * Detect file type and import appropriately
   * @param file The file to import (.keypage or .keyloop)
   */
  async importFile(file: File): Promise<void> {
    const fileName = file.name.toLowerCase();
    
    if (fileName.endsWith(KEYPAGE_EXTENSION)) {
      await this.importPage(file);
    } else if (fileName.endsWith(KEYLOOP_EXTENSION)) {
      await this.importProject(file);
    } else {
      throw new Error(`Unsupported file type. Use ${KEYPAGE_EXTENSION} or ${KEYLOOP_EXTENSION}`);
    }
  }
  
  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================
  
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
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, bufferSize - 8, true);
    this.writeString(view, 8, 'WAVE');
    
    // "fmt " sub-chunk
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
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
    const audioContext = new OfflineAudioContext(1, 1, 48000);
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    const samples = new Float32Array(audioBuffer.length);
    samples.set(audioBuffer.getChannelData(0));
    
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
   * Create file input for importing .keypage files
   */
  createPageImportInput(): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = KEYPAGE_EXTENSION;
    
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (file) {
        try {
          await this.importPage(file);
          window.dispatchEvent(new CustomEvent('qeyloop:pageLoaded'));
        } catch (error) {
          console.error('Failed to import page:', error);
          window.dispatchEvent(new CustomEvent('qeyloop:pageError', {
            detail: { error: (error as Error).message }
          }));
        }
      }
    });
    
    return input;
  }
  
  /**
   * Create file input for importing .keyloop projects
   */
  createProjectImportInput(): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = KEYLOOP_EXTENSION;
    
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
  
  /**
   * Create unified file input that accepts both formats
   */
  createImportInput(): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = `${KEYPAGE_EXTENSION},${KEYLOOP_EXTENSION}`;
    
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (file) {
        try {
          await this.importFile(file);
          window.dispatchEvent(new CustomEvent('qeyloop:projectLoaded'));
        } catch (error) {
          console.error('Failed to import file:', error);
          window.dispatchEvent(new CustomEvent('qeyloop:projectError', {
            detail: { error: (error as Error).message }
          }));
        }
      }
    });
    
    return input;
  }
  
  /**
   * Get file extensions for UI
   */
  getPageExtension(): string {
    return KEYPAGE_EXTENSION;
  }
  
  getProjectExtension(): string {
    return KEYLOOP_EXTENSION;
  }
}

// Singleton instance
export const projectIO = new ProjectIO();
