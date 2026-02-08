/**
 * Qeyloop Control Panel UI
 * 
 * Renders transport controls, BPM, and pad settings.
 * Minimal, functional, no animations.
 */

import { audioEngine } from '../audio/engine';
import { modeManager } from '../modes/manager';
import { bpmController } from '../timing/bpm';
import { projectIO } from '../project/io';
import { pageManager, MAX_PAGES } from '../pages/manager';
import {
  PlaybackMode,
  PlaybackType,
  OverlapMode,
  ModulationPreset,
  KeyMapping,
  KEY_CODES,
} from '../types';

// ============================================================================
// CONTROL PANEL
// ============================================================================

export class ControlPanel {
  /** Container element */
  private container: HTMLElement;
  
  /** Current selected key for editing */
  private selectedKeyCode: number | null = null;
  
  /** File input for sound import */
  private soundFileInput: HTMLInputElement | null = null;
  
  /** Elements for quick access */
  private elements: {
    bpmInput?: HTMLInputElement;
    volumeSlider?: HTMLInputElement;
    pitchSlider?: HTMLInputElement;
    metronomeToggle?: HTMLButtonElement;
    modulationSelect?: HTMLSelectElement;
    overlapSelect?: HTMLButtonElement;
    groupInput?: HTMLInputElement;
    modeToggle?: HTMLButtonElement;
    playbackTypeToggle?: HTMLButtonElement;
    modToggle?: HTMLButtonElement;
    masterVolume?: HTMLInputElement;
    selectedKeyLabel?: HTMLSpanElement;
    pageJumpSelect?: HTMLSelectElement;
  } = {};
  
  constructor(containerId: string) {
    const el = document.getElementById(containerId);
    if (!el) {
      throw new Error(`Container element not found: ${containerId}`);
    }
    this.container = el;
  }
  
  /**
   * Initialize the control panel
   */
  initialize(): void {
    this.render();
    this.setupEventListeners();
    this.updateBpmDisplay(bpmController.getBpm());
  }
  
  /**
   * Render the control panel
   */
  private render(): void {
    this.container.innerHTML = '';
    this.container.className = 'control-panel';
    
    // 1. Selected Key section
    const selectedKeySection = this.createSection('Selected Key');
    selectedKeySection.appendChild(this.createSelectedPadInfo());
    this.container.appendChild(selectedKeySection);
    
    // 2. Load Sound section
    const loadSoundSection = this.createSection('Load Sound');
    loadSoundSection.appendChild(this.createSoundUploadControl());
    this.container.appendChild(loadSoundSection);
    
    // 3. General section
    const generalSection = this.createSection('General');
    generalSection.appendChild(this.createPadVolumeControl());
    generalSection.appendChild(this.createPadPitchControl());
    this.container.appendChild(generalSection);
    
    // 4. Misc section
    const miscSection = this.createSection('Misc');
    miscSection.appendChild(this.createPadModeControl());
    miscSection.appendChild(this.createPadPlaybackTypeControl());
    miscSection.appendChild(this.createPadOverlapControl());
    miscSection.appendChild(this.createPadPageJumpControl());
    this.container.appendChild(miscSection);
    
    // 5. Modulation section
    const modSection = this.createSection('Modulation');
    modSection.appendChild(this.createModulationPresetControl());
    modSection.appendChild(this.createPadModulationControl());
    this.container.appendChild(modSection);
  }
  
  /**
   * Create a section container
   */
  private createSection(title: string): HTMLElement {
    const section = document.createElement('div');
    section.className = 'control-section';
    
    const heading = document.createElement('h3');
    heading.textContent = title;
    section.appendChild(heading);
    
    return section;
  }
  
  /**
   * Create BPM control
   */
  private createBpmControl(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'control-row';
    
    const label = document.createElement('label');
    label.textContent = 'BPM';
    container.appendChild(label);
    
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '20';
    input.max = '300';
    input.value = '120';
    input.className = 'bpm-input';
    this.elements.bpmInput = input;
    container.appendChild(input);
    
    // Halve button
    const halfBtn = document.createElement('button');
    halfBtn.textContent = '÷2';
    halfBtn.className = 'btn-small';
    halfBtn.addEventListener('click', () => bpmController.halveBpm());
    container.appendChild(halfBtn);
    
    // Double button
    const doubleBtn = document.createElement('button');
    doubleBtn.textContent = '×2';
    doubleBtn.className = 'btn-small';
    doubleBtn.addEventListener('click', () => bpmController.doubleBpm());
    container.appendChild(doubleBtn);
    
    // Sync button
    const syncBtn = document.createElement('button');
    syncBtn.textContent = 'Sync';
    syncBtn.className = 'btn-small';
    syncBtn.addEventListener('click', () => bpmController.resetTiming());
    container.appendChild(syncBtn);
    
    return container;
  }
  
  /**
   * Create metronome control
   */
  private createMetronomeControl(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'control-row';
    
    const btn = document.createElement('button');
    btn.textContent = '🔇 Metro';
    btn.className = 'btn';
    this.elements.metronomeToggle = btn;
    container.appendChild(btn);
    
    return container;
  }
  
  /**
   * Create master volume control
   */
  private createMasterVolumeControl(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'control-row';
    
    const label = document.createElement('label');
    label.textContent = 'Master';
    container.appendChild(label);
    
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.value = '100';
    slider.className = 'slider';
    this.elements.masterVolume = slider;
    container.appendChild(slider);
    
    return container;
  }
  
  /**
   * Create modulation preset control
   */
  private createModulationPresetControl(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'control-row';
    
    const label = document.createElement('label');
    label.textContent = 'Preset';
    container.appendChild(label);
    
    const select = document.createElement('select');
    select.className = 'select';
    
    const presets = [
      { value: ModulationPreset.None, label: 'None' },
      { value: ModulationPreset.QuarterSidechain, label: '1/4 Sidechain' },
      { value: ModulationPreset.EighthSidechain, label: '1/8 Sidechain' },
      { value: ModulationPreset.SixteenthSidechain, label: '1/16 Sidechain' },
    ];
    
    for (const preset of presets) {
      const option = document.createElement('option');
      option.value = preset.value.toString();
      option.textContent = preset.label;
      select.appendChild(option);
    }
    
    this.elements.modulationSelect = select;
    container.appendChild(select);
    
    return container;
  }
  
  /**
   * Create selected pad info display
   */
  private createSelectedPadInfo(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'selected-key-display empty';
    container.textContent = 'No key selected';
    this.elements.selectedKeyLabel = container;
    return container;
  }
  
  /**
   * Create pad mode toggle
   */
  private createPadModeControl(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'control-row';
    
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.style.width = '100%';
    
    // Icon + text
    const icon = document.createElement('img');
    icon.src = '/assets/icons/single.svg';
    icon.className = 'icon';
    btn.appendChild(icon);
    
    const text = document.createElement('span');
    text.textContent = 'Single Shot';
    btn.appendChild(text);
    
    this.elements.modeToggle = btn;
    container.appendChild(btn);
    
    return container;
  }
  
  /**
   * Create pad playback type control (Gate / One-Shot)
   */
  private createPadPlaybackTypeControl(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'control-row';
    
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.style.width = '100%';
    btn.title = 'One-Shot: Audio plays to end regardless of key release';
    
    // Icon + text
    const icon = document.createElement('img');
    icon.src = '/assets/icons/gate.svg';
    icon.className = 'icon';
    btn.appendChild(icon);
    
    const text = document.createElement('span');
    text.textContent = 'One-Shot';
    btn.appendChild(text);
    
    this.elements.playbackTypeToggle = btn;
    container.appendChild(btn);
    
    return container;
  }
  
  /**
   * Create pad volume control
   */
  private createPadVolumeControl(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'control-row';
    
    const label = document.createElement('label');
    const icon = document.createElement('img');
    icon.src = '/assets/icons/volume_up.svg';
    icon.className = 'icon icon-small';
    label.appendChild(icon);
    const text = document.createElement('span');
    text.textContent = 'Volume';
    label.appendChild(text);
    container.appendChild(label);
    
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.value = '100';
    slider.className = 'slider';
    this.elements.volumeSlider = slider;
    container.appendChild(slider);
    
    return container;
  }
  
  /**
   * Create pad pitch control
   */
  private createPadPitchControl(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'control-row';
    
    const label = document.createElement('label');
    const icon = document.createElement('img');
    icon.src = '/assets/icons/pitch.svg';
    icon.className = 'icon icon-small';
    label.appendChild(icon);
    const text = document.createElement('span');
    text.textContent = 'Pitch';
    label.appendChild(text);
    container.appendChild(label);
    
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '-24';
    slider.max = '24';
    slider.value = '0';
    slider.className = 'slider';
    this.elements.pitchSlider = slider;
    container.appendChild(slider);
    
    const valueLabel = document.createElement('span');
    valueLabel.textContent = '0 st';
    valueLabel.className = 'value-label';
    container.appendChild(valueLabel);
    
    return container;
  }
  
  /**
   * Create pad modulation toggle
   */
  private createPadModulationControl(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'control-row';
    
    const btn = document.createElement('button');
    btn.className = 'btn btn-icon';
    btn.style.width = '100%';
    btn.title = 'Toggle Modulation';
    
    const icon = document.createElement('img');
    icon.src = '/assets/icons/modulation_off.svg';
    icon.className = 'icon icon-medium';
    btn.appendChild(icon);
    
    this.elements.modToggle = btn;
    container.appendChild(btn);
    
    return container;
  }
  
  /**
   * Create pad overlap control
   */
  private createPadOverlapControl(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'control-row';
    
    const label = document.createElement('label');
    label.textContent = 'Overlap';
    container.appendChild(label);
    
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.style.width = '100%';
    btn.textContent = 'Poly';
    btn.dataset.mode = OverlapMode.Polyphonic.toString();
    
    this.elements.overlapSelect = btn;
    container.appendChild(btn);
    
    // Group ID
    const groupLabel = document.createElement('label');
    groupLabel.textContent = 'Group';
    container.appendChild(groupLabel);
    
    const groupInput = document.createElement('input');
    groupInput.type = 'number';
    groupInput.min = '0';
    groupInput.max = '255';
    groupInput.value = '0';
    groupInput.className = 'group-input';
    this.elements.groupInput = groupInput;
    container.appendChild(groupInput);
    
    return container;
  }
  
  /**
   * Create pad page jump control
   * === PAD-TRIGGERED PAGE JUMP ===
   * Allows configuring a pad to jump to a specific page when pressed
   */
  private createPadPageJumpControl(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'control-row';
    
    const label = document.createElement('label');
    label.textContent = 'Page Jump';
    container.appendChild(label);
    
    const select = document.createElement('select');
    select.className = 'select page-jump-select';
    
    // "None" option
    const noneOption = document.createElement('option');
    noneOption.value = '-1';
    noneOption.textContent = 'None';
    select.appendChild(noneOption);
    
    // Page options (1-10)
    for (let i = 0; i < MAX_PAGES; i++) {
      const option = document.createElement('option');
      option.value = i.toString();
      option.textContent = `Page ${i + 1}`;
      select.appendChild(option);
    }
    
    this.elements.pageJumpSelect = select;
    container.appendChild(select);
    
    return container;
  }
  
  /**
   * Create sound upload control
   */
  private createSoundUploadControl(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'load-sound-container';
    
    // Load sound button
    const btn = document.createElement('button');
    btn.className = 'load-sound-btn';
    
    const icon = document.createElement('img');
    icon.src = '/assets/icons/load_sound.svg';
    icon.className = 'icon';
    btn.appendChild(icon);
    
    const text = document.createElement('span');
    text.textContent = 'Load Sound';
    btn.appendChild(text);
    
    container.appendChild(btn);
    
    // Hidden file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.style.display = 'none';
    this.soundFileInput = input;
    container.appendChild(input);
    
    btn.addEventListener('click', () => input.click());
    
    return container;
  }
  
  /**
   * Create project controls
   * Updated for new .keypage / .keyloop file system
   */
  private createProjectControls(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'control-row project-controls';
    
    // === PAGE EXPORT (.keypage) ===
    const exportPageBtn = document.createElement('button');
    exportPageBtn.textContent = '📄 Export Page';
    exportPageBtn.className = 'btn';
    exportPageBtn.title = 'Export current page as .keypage file';
    exportPageBtn.addEventListener('click', () => {
      projectIO.exportPage();
    });
    container.appendChild(exportPageBtn);
    
    // === PROJECT EXPORT (.keyloop) ===
    const exportProjectBtn = document.createElement('button');
    exportProjectBtn.textContent = '💾 Export All';
    exportProjectBtn.className = 'btn';
    exportProjectBtn.title = 'Export all pages as .keyloop project';
    exportProjectBtn.addEventListener('click', () => {
      projectIO.exportProject('qeyloop-project');
    });
    container.appendChild(exportProjectBtn);
    
    // === UNIFIED IMPORT (both formats) ===
    const importBtn = document.createElement('button');
    importBtn.textContent = '📂 Import';
    importBtn.className = 'btn';
    importBtn.title = 'Import .keypage (single page) or .keyloop (full project)';
    
    const importInput = projectIO.createImportInput();
    container.appendChild(importInput);
    
    importBtn.addEventListener('click', () => importInput.click());
    container.appendChild(importBtn);
    
    // Reset button
    const resetBtn = document.createElement('button');
    resetBtn.textContent = '🗑️ Reset';
    resetBtn.className = 'btn btn-danger';
    resetBtn.addEventListener('click', () => {
      if (confirm('Reset all settings and sounds?')) {
        modeManager.resetAll();
        audioEngine.panic();
      }
    });
    container.appendChild(resetBtn);
    
    return container;
  }
  
  /**
   * Create panic button
   */
  private createPanicButton(): HTMLElement {
    const btn = document.createElement('button');
    btn.textContent = '⚠️ PANIC';
    btn.className = 'btn btn-panic';
    btn.addEventListener('click', () => audioEngine.panic());
    return btn;
  }
  
  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // BPM input
    this.elements.bpmInput?.addEventListener('change', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      if (!isNaN(value)) {
        bpmController.setBpm(value);
      }
      // Blur after change to restore keyboard focus
      (e.target as HTMLInputElement).blur();
    });
    
    // Blur inputs on Enter key
    this.elements.bpmInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        (e.target as HTMLInputElement).blur();
      }
    });
    this.elements.groupInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        (e.target as HTMLInputElement).blur();
      }
    });
    
    // BPM callback
    bpmController.setBpmChangeCallback((bpm) => {
      this.updateBpmDisplay(bpm);
    });
    
    // Metronome toggle
    this.elements.metronomeToggle?.addEventListener('click', () => {
      const enabled = bpmController.toggleMetronome();
      this.updateMetronomeDisplay(enabled);
    });
    
    // Master volume
    this.elements.masterVolume?.addEventListener('input', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value) / 100;
      audioEngine.setMasterVolume(value);
    });
    
    // Modulation preset
    this.elements.modulationSelect?.addEventListener('change', (e) => {
      const value = parseInt((e.target as HTMLSelectElement).value) as ModulationPreset;
      modeManager.setModulationPreset(value);
    });
    
    // Mode toggle
    this.elements.modeToggle?.addEventListener('click', () => {
      if (this.selectedKeyCode !== null) {
        const newMode = modeManager.toggleKeyMode(this.selectedKeyCode);
        this.updateModeDisplay(newMode);
      }
    });
    
    // Playback type toggle (Gate / One-Shot)
    this.elements.playbackTypeToggle?.addEventListener('click', () => {
      if (this.selectedKeyCode !== null) {
        const newType = modeManager.toggleKeyPlaybackType(this.selectedKeyCode);
        this.updatePlaybackTypeDisplay(newType);
      }
    });
    
    // Volume slider
    this.elements.volumeSlider?.addEventListener('input', (e) => {
      if (this.selectedKeyCode !== null) {
        const value = parseInt((e.target as HTMLInputElement).value) / 100;
        modeManager.setKeyVolume(this.selectedKeyCode, value);
      }
    });
    
    // Prevent sliders from keeping keyboard focus after interaction
    const blurAfterRelease = (slider: HTMLElement) => {
      const onMouseUp = () => {
        slider.blur();
        document.removeEventListener('mouseup', onMouseUp);
      };
      slider.addEventListener('mousedown', () => {
        document.addEventListener('mouseup', onMouseUp);
      });
    };
    
    if (this.elements.volumeSlider) blurAfterRelease(this.elements.volumeSlider);
    if (this.elements.pitchSlider) blurAfterRelease(this.elements.pitchSlider);
    if (this.elements.masterVolume) blurAfterRelease(this.elements.masterVolume);
    
    // Pitch slider
    this.elements.pitchSlider?.addEventListener('input', (e) => {
      if (this.selectedKeyCode !== null) {
        const value = parseInt((e.target as HTMLInputElement).value);
        modeManager.setKeyPitch(this.selectedKeyCode, value);
        
        // Update value label
        const parent = (e.target as HTMLInputElement).parentElement;
        const valueLabel = parent?.querySelector('.value-label');
        if (valueLabel) {
          valueLabel.textContent = `${value} st`;
        }
      }
    });
    
    // Modulation toggle
    this.elements.modToggle?.addEventListener('click', () => {
      if (this.selectedKeyCode !== null) {
        const enabled = modeManager.toggleKeyModulation(this.selectedKeyCode);
        this.updateModDisplay(enabled);
      }
    });
    
    // Overlap select
    this.elements.overlapSelect?.addEventListener('click', () => {
      if (this.selectedKeyCode !== null && this.elements.overlapSelect) {
        const currentMode = parseInt(this.elements.overlapSelect.dataset.mode || '0') as OverlapMode;
        const newMode = currentMode === OverlapMode.Polyphonic ? OverlapMode.Monophonic : OverlapMode.Polyphonic;
        this.elements.overlapSelect.dataset.mode = newMode.toString();
        this.elements.overlapSelect.textContent = newMode === OverlapMode.Polyphonic ? 'Poly' : 'Mono';
        
        const groupId = parseInt(this.elements.groupInput?.value || '0');
        modeManager.setKeyOverlap(this.selectedKeyCode, newMode, groupId);
      }
    });
    
    // Group input
    this.elements.groupInput?.addEventListener('change', (e) => {
      if (this.selectedKeyCode !== null) {
        const mode = parseInt(this.elements.overlapSelect?.dataset.mode || '0') as OverlapMode;
        const groupId = parseInt((e.target as HTMLInputElement).value);
        modeManager.setKeyOverlap(this.selectedKeyCode, mode, groupId);
      }
    });
    
    // === PAGE JUMP SELECT ===
    // Configure pad to jump to a specific page when pressed
    this.elements.pageJumpSelect?.addEventListener('change', (e) => {
      if (this.selectedKeyCode !== null) {
        const targetPage = parseInt((e.target as HTMLSelectElement).value);
        pageManager.setPadPageJump(this.selectedKeyCode, targetPage);
      }
    });
    
    // Sound file input
    this.soundFileInput?.addEventListener('change', async () => {
      const file = this.soundFileInput?.files?.[0];
      if (file && this.selectedKeyCode !== null) {
        try {
          const mapping = modeManager.getMapping(this.selectedKeyCode);
          // If key already has a sound, reuse its index; otherwise get next available
          const soundIndex = mapping?.hasSound ? mapping.soundIndex : this.getNextSoundIndex();
          
          await audioEngine.loadSound(soundIndex, file);
          modeManager.assignSound(this.selectedKeyCode, soundIndex, file.name);
          
        } catch (error) {
          console.error('Failed to load sound:', error);
        }
      }
    });
    
    // Project loaded event
    window.addEventListener('qeyloop:projectLoaded', () => {
      this.refreshFromState();
    });
  }
  
  /**
   * Get next available sound index
   */
  private getNextSoundIndex(): number {
    const sounds = audioEngine.getAllLoadedSounds();
    if (sounds.length === 0) return 0;
    return Math.max(...sounds.map(s => s.index)) + 1;
  }
  
  /**
   * Update selected pad display
   */
  selectPad(keyCode: number): void {
    this.selectedKeyCode = keyCode;
    
    const mapping = modeManager.getMapping(keyCode);
    if (!mapping) return;
    
    // Update key label - show single character
    const keyName = Object.entries(KEY_CODES).find(([, code]) => code === keyCode)?.[0] || '?';
    if (this.elements.selectedKeyLabel) {
      // Remove "empty" class and show just the key character (first char of key name)
      this.elements.selectedKeyLabel.classList.remove('empty');
      // Get the actual key character (e.g., "Q" from "KeyQ", "1" from "Digit1")
      let displayChar = keyName;
      if (keyName.startsWith('Key')) {
        displayChar = keyName.replace('Key', '');
      } else if (keyName.startsWith('Digit')) {
        displayChar = keyName.replace('Digit', '');
      } else if (keyName === 'Backquote') {
        displayChar = '`';
      } else if (keyName === 'Minus') {
        displayChar = '-';
      } else if (keyName === 'Equal') {
        displayChar = '=';
      } else if (keyName === 'BracketLeft') {
        displayChar = '[';
      } else if (keyName === 'BracketRight') {
        displayChar = ']';
      } else if (keyName === 'Backslash') {
        displayChar = '\\\\';
      } else if (keyName === 'Semicolon') {
        displayChar = ';';
      } else if (keyName === 'Quote') {
        displayChar = "'";
      } else if (keyName === 'Comma') {
        displayChar = ',';
      } else if (keyName === 'Period') {
        displayChar = '.';
      } else if (keyName === 'Slash') {
        displayChar = '/';
      } else if (keyName === 'Enter') {
        displayChar = '⏎';
      } else if (keyName === 'ShiftRight') {
        displayChar = '⇧';
      }
      this.elements.selectedKeyLabel.textContent = displayChar;
    }
    
    // Update controls
    this.updateModeDisplay(mapping.mode);
    this.updatePlaybackTypeDisplay(mapping.playbackType);
    this.updateModDisplay(mapping.modulationEnabled);
    
    if (this.elements.volumeSlider) {
      this.elements.volumeSlider.value = (mapping.volume * 100).toString();
    }
    
    if (this.elements.pitchSlider) {
      this.elements.pitchSlider.value = mapping.pitchSemitones.toString();
      const valueLabel = this.elements.pitchSlider.parentElement?.querySelector('.value-label');
      if (valueLabel) {
        valueLabel.textContent = `${mapping.pitchSemitones} st`;
      }
    }
    
    if (this.elements.overlapSelect) {
      this.elements.overlapSelect.dataset.mode = mapping.overlapMode.toString();
      this.elements.overlapSelect.textContent = mapping.overlapMode === OverlapMode.Polyphonic ? 'Poly' : 'Mono';
    }
    
    if (this.elements.groupInput) {
      this.elements.groupInput.value = mapping.groupId.toString();
    }
    
    // === PAGE JUMP: Update page jump select ===
    if (this.elements.pageJumpSelect) {
      const pageJump = pageManager.getPadPageJump(keyCode);
      this.elements.pageJumpSelect.value = pageJump.toString();
    }
  }
  
  /**
   * Update BPM display
   */
  private updateBpmDisplay(bpm: number): void {
    if (this.elements.bpmInput) {
      this.elements.bpmInput.value = Math.round(bpm).toString();
    }
  }
  
  /**
   * Update metronome display
   */
  private updateMetronomeDisplay(enabled: boolean): void {
    if (this.elements.metronomeToggle) {
      const icon = enabled ? 'volume_up.svg' : 'volume_mute.svg';
      this.elements.metronomeToggle.innerHTML = `<img src="/assets/icons/${icon}" class="icon icon-small" alt="${enabled ? 'Metro On' : 'Metro Off'}" /> Metro`;
      this.elements.metronomeToggle.classList.toggle('active', enabled);
    }
  }
  
  /**
   * Update mode display
   */
  private updateModeDisplay(mode: PlaybackMode): void {
    if (this.elements.modeToggle) {
      const icon = mode === PlaybackMode.Loop ? 'loop.svg' : 'single.svg';
      const label = mode === PlaybackMode.Loop ? 'Loop' : 'Single';
      this.elements.modeToggle.innerHTML = `<img src="/assets/icons/${icon}" class="icon icon-small" alt="${label}" /> ${label}`;
      this.elements.modeToggle.classList.toggle('loop', mode === PlaybackMode.Loop);
    }
  }
  
  /**
   * Update playback type display (Gate / One-Shot)
   */
  private updatePlaybackTypeDisplay(playbackType: PlaybackType): void {
    if (this.elements.playbackTypeToggle) {
      if (playbackType === PlaybackType.Gate) {
        this.elements.playbackTypeToggle.innerHTML = '<img src="/assets/icons/gate.svg" class="icon icon-small" alt="Gate" /> Gate';
        this.elements.playbackTypeToggle.title = 'Gate: Audio plays only while key is held';
      } else {
        this.elements.playbackTypeToggle.innerHTML = '<img src="/assets/icons/single.svg" class="icon icon-small" alt="One-Shot" /> One-Shot';
        this.elements.playbackTypeToggle.title = 'One-Shot: Audio plays to end regardless of key release';
      }
      this.elements.playbackTypeToggle.classList.toggle('gate', playbackType === PlaybackType.Gate);
    }
  }
  
  /**
   * Update modulation display
   */
  private updateModDisplay(enabled: boolean): void {
    if (this.elements.modToggle) {
      const icon = enabled ? 'modulation_on.svg' : 'modulation_off.svg';
      const label = enabled ? 'ON' : 'OFF';
      this.elements.modToggle.innerHTML = `<img src="/assets/icons/${icon}" class="icon icon-small" alt="Mod ${label}" /> ${label}`;
      this.elements.modToggle.classList.toggle('active', enabled);
    }
  }
  
  /**
   * Refresh controls from current state
   */
  private refreshFromState(): void {
    this.updateBpmDisplay(bpmController.getBpm());
    this.updateMetronomeDisplay(bpmController.isMetronomeEnabled());
    
    if (this.elements.modulationSelect) {
      this.elements.modulationSelect.value = modeManager.getModulationPreset().toString();
    }
    
    if (this.elements.masterVolume) {
      this.elements.masterVolume.value = (audioEngine.getMasterVolume() * 100).toString();
    }
    
    if (this.selectedKeyCode !== null) {
      this.selectPad(this.selectedKeyCode);
    }
  }
  
  /**
   * Public refresh for page changes
   */
  refresh(): void {
    this.refreshFromState();
  }
}
