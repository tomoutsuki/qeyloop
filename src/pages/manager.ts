/**
 * Qeyloop Page Manager
 * 
 * Manages multiple independent pages (up to 10).
 * Each page represents a complete project state:
 * - Sound assignments
 * - Key mappings
 * - Mode settings
 * 
 * BPM is shared globally across all pages for consistent timing.
 */

import { audioEngine } from '../audio/engine';
import { modeManager } from '../modes/manager';
import {
  KeyMapping,
  ModulationPreset,
  SoundData,
  createDefaultKeyMapping,
  getAllKeyCodes,
} from '../types';

// ============================================================================
// PAGE TYPES
// ============================================================================

/** Maximum number of pages */
export const MAX_PAGES = 10;

/** State for a single page */
export interface PageState {
  /** Page index (0-9) */
  index: number;
  /** Page name (optional user label) */
  name: string;
  /** Whether page has been modified */
  isDirty: boolean;
  /** Key mappings for this page */
  keyMappings: Map<number, KeyMapping>;
  /** Map of keyCode to sound index for this page */
  keySoundIndices: Map<number, number>;
  /** Modulation preset for this page */
  modulationPreset: ModulationPreset;
  /** Sound data for export (index -> SoundData) */
  sounds: Map<number, SoundData>;
  /** Next available sound slot for this page */
  nextSoundIndex: number;
  /** Optional: target page to jump to when pad is pressed */
  padPageJumps: Map<number, number>;
}

/** Serializable page state for export/import */
export interface SerializablePageState {
  index: number;
  name: string;
  keyMappings: KeyMapping[];
  keySoundIndices: { [keyCode: number]: number };
  modulationPreset: ModulationPreset;
  soundFiles: { [soundIndex: number]: string };
  padPageJumps: { [keyCode: number]: number };
}

/** Full multi-page project for export/import */
export interface MultiPageProject {
  version: number;
  bpm: number;
  masterVolume: number;
  metronome: {
    enabled: boolean;
    volume: number;
  };
  activePageIndex: number;
  pages: SerializablePageState[];
}

// ============================================================================
// PAGE MANAGER
// ============================================================================

export class PageManager {
  /** All pages */
  private pages: PageState[] = [];
  
  /** Current active page index */
  private activePageIndex = 0;
  
  /** Callback for page changes */
  private onPageChange: ((pageIndex: number) => void) | null = null;
  
  /** Callback for page list changes */
  private onPagesUpdate: ((pages: PageState[], activeIndex: number) => void) | null = null;
  
  /**
   * Initialize page manager with one empty page
   */
  initialize(): void {
    this.pages = [];
    this.activePageIndex = 0;
    
    // Create first page
    this.createPage();
  }
  
  /**
   * Create a new empty page
   * @returns The index of the new page, or -1 if max pages reached
   */
  createPage(): number {
    // Check max pages limit
    if (this.pages.length >= MAX_PAGES) {
      console.warn(`Cannot create more than ${MAX_PAGES} pages`);
      return -1;
    }
    
    const pageIndex = this.pages.length;
    const page = this.createEmptyPage(pageIndex);
    this.pages.push(page);
    
    // Notify listeners
    this.onPagesUpdate?.(this.pages, this.activePageIndex);
    
    return pageIndex;
  }
  
  /**
   * Create an empty page state
   */
  private createEmptyPage(index: number): PageState {
    const keyMappings = new Map<number, KeyMapping>();
    
    // Initialize default mappings for all keys
    for (const keyCode of getAllKeyCodes()) {
      keyMappings.set(keyCode, createDefaultKeyMapping(keyCode));
    }
    
    return {
      index,
      name: `Page ${index + 1}`,
      isDirty: false,
      keyMappings,
      keySoundIndices: new Map(),
      modulationPreset: ModulationPreset.None,
      sounds: new Map(),
      nextSoundIndex: index * 64, // Each page gets its own sound slot range
      padPageJumps: new Map(),
    };
  }
  
  /**
   * Switch to a specific page
   * @param pageIndex Target page (0-9)
   */
  switchToPage(pageIndex: number): boolean {
    // Validate page index
    if (pageIndex < 0 || pageIndex >= MAX_PAGES) {
      return false;
    }
    
    // Create page if it doesn't exist yet
    while (this.pages.length <= pageIndex) {
      this.createPage();
    }
    
    // If already on this page, do nothing
    if (this.activePageIndex === pageIndex) {
      return true;
    }
    
    // === PAGE SWITCH: Save current page state ===
    this.saveCurrentPageState();
    
    // === PAGE SWITCH: Activate new page (sounds continue playing) ===
    this.activePageIndex = pageIndex;
    
    // === PAGE SWITCH: Load new page state ===
    this.loadPageState(pageIndex);
    
    // Notify listeners
    this.onPageChange?.(pageIndex);
    this.onPagesUpdate?.(this.pages, this.activePageIndex);
    
    return true;
  }
  
  /**
   * Save current ModeManager state to the active page
   */
  saveCurrentPageState(): void {
    const page = this.pages[this.activePageIndex];
    if (!page) return;
    
    // Save all key mappings from mode manager
    const mappings = modeManager.getAllMappings();
    let savedMappingsWithSounds = 0;
    for (const mapping of mappings) {
      page.keyMappings.set(mapping.keyCode, { ...mapping });
      if (mapping.hasSound) savedMappingsWithSounds++;
    }
    
    console.log(`Saved page ${this.activePageIndex + 1}: ${savedMappingsWithSounds} keys with sounds, ${page.sounds.size} sound files`);
    
    // Save modulation preset
    page.modulationPreset = modeManager.getModulationPreset();
    
    // Save sounds from audio engine
    const sounds = audioEngine.getAllLoadedSounds();
    for (const sound of sounds) {
      // Only save sounds that belong to this page's slot range
      const pageStart = page.index * 64;
      const pageEnd = pageStart + 64;
      if (sound.index >= pageStart && sound.index < pageEnd) {
        page.sounds.set(sound.index, sound);
      }
    }
    
    // NOTE: keySoundIndices are managed by grid and stored via setKeySoundIndex
    // They persist in the PageState and don't need to be explicitly saved here
    
    page.isDirty = true;
  }
  
  /**
   * Load page state into ModeManager and AudioEngine
   */
  private loadPageState(pageIndex: number): void {
    const page = this.pages[pageIndex];
    if (!page) return;
    
    console.log(`Loading page ${pageIndex + 1} with ${page.sounds.size} sounds and ${Array.from(page.keyMappings.values()).filter(m => m.hasSound).length} mapped keys`);
    
    // Reset mode manager to defaults first
    modeManager.initialize();
    
    // === CRITICAL: Only load sounds that belong to this page ===
    // Clear and reload sounds to prevent cross-page contamination
    // Each page has its own sound slot range: page N uses slots [N*64, N*64+63]
    const pageStart = page.index * 64;
    const pageEnd = pageStart + 64;
    
    // Load sounds for this page only
    for (const [index, sound] of page.sounds) {
      // Verify sound index is in this page's range
      if (index >= pageStart && index < pageEnd) {
        audioEngine.loadSoundFromSamples(index, sound.name, sound.samples);
      }
    }
    
    // === CRITICAL: Only apply mappings that have sounds ===
    // Keys without sounds should remain at defaults (hasSound: false)
    let appliedMappings = 0;
    for (const [keyCode, mapping] of page.keyMappings) {
      // Only apply mapping if it actually has a sound assigned
      if (mapping.hasSound) {
        // Verify the sound index is in this page's range
        if (mapping.soundIndex >= pageStart && mapping.soundIndex < pageEnd) {
          modeManager.setMapping(mapping);
          appliedMappings++;
        }
      }
    }
    
    console.log(`Applied ${appliedMappings} key mappings to page ${pageIndex + 1}`);
    
    // Apply modulation preset
    modeManager.setModulationPreset(page.modulationPreset);
  }
  
  /**
   * Get current active page index
   */
  getActivePageIndex(): number {
    return this.activePageIndex;
  }
  
  /**
   * Get current active page
   */
  getActivePage(): PageState {
    return this.pages[this.activePageIndex];
  }
  
  /**
   * Get all pages
   */
  getAllPages(): PageState[] {
    return this.pages;
  }
  
  /**
   * Get page count
   */
  getPageCount(): number {
    return this.pages.length;
  }
  
  /**
   * Check if page exists
   */
  hasPage(pageIndex: number): boolean {
    return pageIndex >= 0 && pageIndex < this.pages.length;
  }
  
  /**
   * Set page name
   */
  setPageName(pageIndex: number, name: string): void {
    const page = this.pages[pageIndex];
    if (page) {
      page.name = name;
      page.isDirty = true;
      this.onPagesUpdate?.(this.pages, this.activePageIndex);
    }
  }
  
  // ==========================================================================
  // PAD PAGE JUMPS
  // ==========================================================================
  
  /**
   * Set a pad to jump to a specific page when pressed
   * @param keyCode The pad's key code
   * @param targetPage Target page index (0-9), or -1 to remove jump
   */
  setPadPageJump(keyCode: number, targetPage: number): void {
    const page = this.getActivePage();
    if (!page) return;
    
    if (targetPage < 0) {
      page.padPageJumps.delete(keyCode);
    } else if (targetPage < MAX_PAGES) {
      page.padPageJumps.set(keyCode, targetPage);
    }
    
    page.isDirty = true;
  }
  
  /**
   * Get the page jump target for a pad (if any)
   * @returns Target page index, or -1 if no jump configured
   */
  getPadPageJump(keyCode: number): number {
    const page = this.getActivePage();
    return page?.padPageJumps.get(keyCode) ?? -1;
  }
  
  /**
   * Check if pad should trigger page jump
   * @returns Target page index if jump configured, or -1 if no jump
   */
  checkPadJump(keyCode: number): number {
    const targetPage = this.getPadPageJump(keyCode);
    
    if (targetPage >= 0 && targetPage !== this.activePageIndex) {
      return targetPage;
    }
    
    return -1;
  }
  
  /**
   * Execute delayed page jump (called after sound triggers)
   * @param targetPage The page to jump to
   */
  executePageJump(targetPage: number): void {
    if (targetPage >= 0 && targetPage !== this.activePageIndex) {
      // === PAGE JUMP: Switch page after sound has been triggered ===
      // Delay to ensure sound starts playing on current page before switch
      setTimeout(() => {
        this.switchToPage(targetPage);
      }, 150); // 150ms allows sound to start before page change
    }
  }
  
  // ==========================================================================
  // CALLBACKS
  // ==========================================================================
  
  /**
   * Set callback for page change events
   */
  setPageChangeCallback(callback: (pageIndex: number) => void): void {
    this.onPageChange = callback;
  }
  
  /**
   * Set callback for page list updates
   */
  setPagesUpdateCallback(callback: (pages: PageState[], activeIndex: number) => void): void {
    this.onPagesUpdate = callback;
  }
  
  // ==========================================================================
  // EXPORT / IMPORT
  // ==========================================================================
  
  /**
   * Export all pages to serializable format
   */
  exportProject(): MultiPageProject {
    // Save current state first
    this.saveCurrentPageState();
    
    const pages: SerializablePageState[] = this.pages.map(page => {
      // Convert key mappings to array
      const keyMappings = Array.from(page.keyMappings.values())
        .filter(m => m.hasSound);
      
      // Convert keySoundIndices map to object
      const keySoundIndices: { [keyCode: number]: number } = {};
      for (const [keyCode, soundIndex] of page.keySoundIndices) {
        keySoundIndices[keyCode] = soundIndex;
      }
      
      // Convert sound names for export
      const soundFiles: { [soundIndex: number]: string } = {};
      for (const [index, sound] of page.sounds) {
        soundFiles[index] = sound.name;
      }
      
      // Convert pad page jumps to object
      const padPageJumps: { [keyCode: number]: number } = {};
      for (const [keyCode, targetPage] of page.padPageJumps) {
        padPageJumps[keyCode] = targetPage;
      }
      
      return {
        index: page.index,
        name: page.name,
        keyMappings,
        keySoundIndices,
        modulationPreset: page.modulationPreset,
        soundFiles,
        padPageJumps,
      };
    });
    
    return {
      version: 2, // Version 2 for multi-page support
      bpm: audioEngine.getBpm(),
      masterVolume: audioEngine.getMasterVolume(),
      metronome: audioEngine.getMetronome(),
      activePageIndex: this.activePageIndex,
      pages,
    };
  }
  
  /**
   * Import pages from serializable format
   */
  importProject(project: MultiPageProject): void {
    // Clear existing pages
    this.pages = [];
    
    // Import each page
    for (const serializedPage of project.pages) {
      const page = this.createEmptyPage(serializedPage.index);
      
      page.name = serializedPage.name;
      page.modulationPreset = serializedPage.modulationPreset;
      
      // Restore keySoundIndices
      for (const [keyCodeStr, soundIndex] of Object.entries(serializedPage.keySoundIndices)) {
        page.keySoundIndices.set(parseInt(keyCodeStr), soundIndex as number);
      }
      
      // Find next sound index for this page
      const pageStart = page.index * 64;
      let maxSoundIndex = pageStart;
      for (const soundIndex of Object.values(serializedPage.keySoundIndices)) {
        if ((soundIndex as number) >= maxSoundIndex) {
          maxSoundIndex = (soundIndex as number) + 1;
        }
      }
      page.nextSoundIndex = maxSoundIndex;
      
      // Restore key mappings
      for (const mapping of serializedPage.keyMappings) {
        page.keyMappings.set(mapping.keyCode, mapping);
      }
      
      // Restore pad page jumps
      for (const [keyCodeStr, targetPage] of Object.entries(serializedPage.padPageJumps)) {
        page.padPageJumps.set(parseInt(keyCodeStr), targetPage as number);
      }
      
      this.pages.push(page);
    }
    
    // Ensure at least one page exists
    if (this.pages.length === 0) {
      this.createPage();
    }
    
    // Switch to saved active page
    this.activePageIndex = project.activePageIndex;
    if (this.activePageIndex >= this.pages.length) {
      this.activePageIndex = 0;
    }
    
    // Load the active page state
    this.loadPageState(this.activePageIndex);
    
    // Notify listeners
    this.onPagesUpdate?.(this.pages, this.activePageIndex);
    this.onPageChange?.(this.activePageIndex);
  }
  
  /**
   * Store sound data for a page (called when sound is loaded)
   */
  storeSoundData(soundIndex: number, soundData: SoundData): void {
    const page = this.getActivePage();
    if (page) {
      page.sounds.set(soundIndex, soundData);
      console.log(`Stored sound ${soundData.name} (index ${soundIndex}) in page ${page.index + 1}`);
    }
  }
  
  /**
   * Get sound data from current page
   */
  getSoundData(soundIndex: number): SoundData | undefined {
    const page = this.getActivePage();
    return page?.sounds.get(soundIndex);
  }
  
  /**
   * Get all sounds from current page
   */
  getAllSounds(): SoundData[] {
    const page = this.getActivePage();
    return page ? Array.from(page.sounds.values()) : [];
  }
  
  /**
   * Get/set keySoundIndices for current page
   */
  getKeySoundIndex(keyCode: number): number | undefined {
    return this.getActivePage()?.keySoundIndices.get(keyCode);
  }
  
  setKeySoundIndex(keyCode: number, soundIndex: number): void {
    const page = this.getActivePage();
    if (page) {
      page.keySoundIndices.set(keyCode, soundIndex);
      page.isDirty = true;
    }
  }
  
  /**
   * Get next sound index for current page
   */
  getNextSoundIndex(): number {
    return this.getActivePage()?.nextSoundIndex ?? 0;
  }
  
  /**
   * Increment next sound index for current page
   * Ensures index stays within page's allocated range [pageIndex*64, pageIndex*64+63]
   */
  incrementNextSoundIndex(): number {
    const page = this.getActivePage();
    if (page) {
      const pageStart = page.index * 64;
      const pageEnd = pageStart + 64;
      
      // Ensure next index is within page range
      if (page.nextSoundIndex < pageStart) {
        page.nextSoundIndex = pageStart;
      }
      
      // Check if we've exceeded the page's sound slot limit
      if (page.nextSoundIndex >= pageEnd) {
        console.warn(`Page ${page.index + 1} has reached maximum sound slots (64)`);
        return pageEnd - 1; // Return last valid index
      }
      
      return page.nextSoundIndex++;
    }
    return 0;
  }
  
  /**
   * Clear all data from active page
   */
  clearActivePage(): void {
    const page = this.getActivePage();
    if (!page) return;
    
    console.log(`Clearing page ${page.index + 1}`);
    
    // Clear sounds
    page.sounds.clear();
    
    // Clear key mappings
    page.keyMappings.clear();
    
    // Clear key-sound indices
    page.keySoundIndices.clear();
    
    // Clear pad page jumps
    page.padPageJumps.clear();
    
    // Reset next sound index to page start
    page.nextSoundIndex = page.index * 64;
    
    // Reset mode manager to defaults
    modeManager.initialize();
  }
  
  /**
   * Set a key mapping in the active page
   */
  setKeyMapping(keyCode: number, mapping: KeyMapping): void {
    const page = this.getActivePage();
    if (!page) return;
    
    page.keyMappings.set(keyCode, mapping);
  }
  
  /**
   * Reload the active page (used after import to refresh everything)
   */
  reloadActivePage(): void {
    console.log(`Reloading active page ${this.activePageIndex + 1}`);
    
    // Load page state to apply all mappings
    this.loadPageState(this.activePageIndex);
    
    // Notify UI to refresh
    this.onPageChange?.(this.activePageIndex);
    this.onPagesUpdate?.(this.pages, this.activePageIndex);
  }
}

// Singleton instance
export const pageManager = new PageManager();
