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
import {
  PlaybackMode,
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
    overlapSelect?: HTMLSelectElement;
    groupInput?: HTMLInputElement;
    modeToggle?: HTMLButtonElement;
    modToggle?: HTMLButtonElement;
    masterVolume?: HTMLInputElement;
    selectedKeyLabel?: HTMLSpanElement;
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
    
    // Transport section
    const transportSection = this.createSection('Transport');
    transportSection.appendChild(this.createBpmControl());
    transportSection.appendChild(this.createMetronomeControl());
    transportSection.appendChild(this.createMasterVolumeControl());
    this.container.appendChild(transportSection);
    
    // Modulation section
    const modSection = this.createSection('Modulation');
    modSection.appendChild(this.createModulationPresetControl());
    this.container.appendChild(modSection);
    
    // Selected pad section
    const padSection = this.createSection('Selected Pad');
    padSection.id = 'pad-settings';
    padSection.appendChild(this.createSelectedPadInfo());
    padSection.appendChild(this.createPadModeControl());
    padSection.appendChild(this.createPadVolumeControl());
    padSection.appendChild(this.createPadPitchControl());
    padSection.appendChild(this.createPadModulationControl());
    padSection.appendChild(this.createPadOverlapControl());
    padSection.appendChild(this.createSoundUploadControl());
    this.container.appendChild(padSection);
    
    // Project section
    const projectSection = this.createSection('Project');
    projectSection.appendChild(this.createProjectControls());
    this.container.appendChild(projectSection);
    
    // Panic button
    this.container.appendChild(this.createPanicButton());
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
    container.className = 'control-row';
    
    const label = document.createElement('span');
    label.textContent = 'Key: ';
    container.appendChild(label);
    
    const keyLabel = document.createElement('span');
    keyLabel.textContent = 'None';
    keyLabel.className = 'selected-key-label';
    this.elements.selectedKeyLabel = keyLabel;
    container.appendChild(keyLabel);
    
    return container;
  }
  
  /**
   * Create pad mode toggle
   */
  private createPadModeControl(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'control-row';
    
    const btn = document.createElement('button');
    btn.textContent = '▶ Single';
    btn.className = 'btn';
    this.elements.modeToggle = btn;
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
    label.textContent = 'Volume';
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
    label.textContent = 'Pitch';
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
    btn.textContent = '◇ Mod Off';
    btn.className = 'btn';
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
    
    const select = document.createElement('select');
    select.className = 'select';
    
    const modes = [
      { value: OverlapMode.Polyphonic, label: 'Poly' },
      { value: OverlapMode.Monophonic, label: 'Mono' },
    ];
    
    for (const mode of modes) {
      const option = document.createElement('option');
      option.value = mode.value.toString();
      option.textContent = mode.label;
      select.appendChild(option);
    }
    
    this.elements.overlapSelect = select;
    container.appendChild(select);
    
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
   * Create sound upload control
   */
  private createSoundUploadControl(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'control-row';
    
    const btn = document.createElement('button');
    btn.textContent = '📁 Load Sound';
    btn.className = 'btn';
    container.appendChild(btn);
    
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
   */
  private createProjectControls(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'control-row project-controls';
    
    // Export button
    const exportBtn = document.createElement('button');
    exportBtn.textContent = '💾 Export';
    exportBtn.className = 'btn';
    exportBtn.addEventListener('click', () => {
      projectIO.exportProject('qeyloop-project');
    });
    container.appendChild(exportBtn);
    
    // Import button
    const importBtn = document.createElement('button');
    importBtn.textContent = '📂 Import';
    importBtn.className = 'btn';
    
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
    
    // Volume slider
    this.elements.volumeSlider?.addEventListener('input', (e) => {
      if (this.selectedKeyCode !== null) {
        const value = parseInt((e.target as HTMLInputElement).value) / 100;
        modeManager.setKeyVolume(this.selectedKeyCode, value);
      }
    });
    
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
    this.elements.overlapSelect?.addEventListener('change', (e) => {
      if (this.selectedKeyCode !== null) {
        const mode = parseInt((e.target as HTMLSelectElement).value) as OverlapMode;
        const groupId = parseInt(this.elements.groupInput?.value || '0');
        modeManager.setKeyOverlap(this.selectedKeyCode, mode, groupId);
      }
    });
    
    // Group input
    this.elements.groupInput?.addEventListener('change', (e) => {
      if (this.selectedKeyCode !== null) {
        const mode = parseInt(this.elements.overlapSelect?.value || '0') as OverlapMode;
        const groupId = parseInt((e.target as HTMLInputElement).value);
        modeManager.setKeyOverlap(this.selectedKeyCode, mode, groupId);
      }
    });
    
    // Sound file input
    this.soundFileInput?.addEventListener('change', async () => {
      const file = this.soundFileInput?.files?.[0];
      if (file && this.selectedKeyCode !== null) {
        try {
          const mapping = modeManager.getMapping(this.selectedKeyCode);
          const soundIndex = mapping?.soundIndex ?? this.getNextSoundIndex();
          
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
    
    // Update key label
    const keyName = Object.entries(KEY_CODES).find(([, code]) => code === keyCode)?.[0] || '?';
    if (this.elements.selectedKeyLabel) {
      this.elements.selectedKeyLabel.textContent = keyName;
    }
    
    // Update controls
    this.updateModeDisplay(mapping.mode);
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
      this.elements.overlapSelect.value = mapping.overlapMode.toString();
    }
    
    if (this.elements.groupInput) {
      this.elements.groupInput.value = mapping.groupId.toString();
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
      this.elements.metronomeToggle.textContent = enabled ? '🔊 Metro' : '🔇 Metro';
      this.elements.metronomeToggle.classList.toggle('active', enabled);
    }
  }
  
  /**
   * Update mode display
   */
  private updateModeDisplay(mode: PlaybackMode): void {
    if (this.elements.modeToggle) {
      this.elements.modeToggle.textContent = mode === PlaybackMode.Loop ? '↻ Loop' : '▶ Single';
      this.elements.modeToggle.classList.toggle('loop', mode === PlaybackMode.Loop);
    }
  }
  
  /**
   * Update modulation display
   */
  private updateModDisplay(enabled: boolean): void {
    if (this.elements.modToggle) {
      this.elements.modToggle.textContent = enabled ? '◈ Mod On' : '◇ Mod Off';
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
}
