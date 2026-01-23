/**
 * Qeyloop Main Application Entry Point
 * 
 * Initializes all modules and starts the application.
 * Includes multi-page support with Shift+1-0 hotkeys.
 */

import { audioEngine } from './audio/engine';
import { keyboardHandler } from './input/keyboard';
import { modeManager } from './modes/manager';
import { bpmController } from './timing/bpm';
import { pageManager } from './pages/manager';
import { PadGrid } from './ui/grid';
import { ControlPanel } from './ui/controls';
import { PageSelector } from './ui/pages';

// ============================================================================
// APPLICATION STATE
// ============================================================================

let padGrid: PadGrid;
let controlPanel: ControlPanel;
let pageSelector: PageSelector;
let isInitialized = false;

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the application after user interaction
 */
async function initializeApp(): Promise<void> {
  if (isInitialized) {
    await audioEngine.resume();
    return;
  }
  
  const startButton = document.getElementById('start-button');
  const startScreen = document.getElementById('start-screen');
  const mainApp = document.getElementById('main-app');
  
  if (startButton) {
    startButton.textContent = 'Starting...';
    startButton.setAttribute('disabled', 'true');
  }
  
  try {
    // Initialize audio engine (requires user interaction)
    await audioEngine.initialize();
    
    // Initialize other modules
    modeManager.initialize();
    bpmController.initialize();
    keyboardHandler.initialize();
    
    // === PAGE SYSTEM: Initialize page manager ===
    pageManager.initialize();
    
    // Initialize UI
    padGrid = new PadGrid('pad-grid');
    padGrid.initialize();
    
    controlPanel = new ControlPanel('control-panel');
    controlPanel.initialize();
    
    // === PAGE SYSTEM: Initialize page selector UI ===
    pageSelector = new PageSelector('page-selector');
    pageSelector.initialize();
    
    // Connect pad selection to control panel
    padGrid.setPadSelectCallback((keyCode) => {
      controlPanel.selectPad(keyCode);
    });
    
    // === PAGE SYSTEM: Refresh pad grid on page change ===
    pageManager.setPageChangeCallback((pageIndex) => {
      padGrid.refreshAll();
      controlPanel.refresh();
      console.log(`Switched to page ${pageIndex + 1}`);
    });
    
    // Hide start screen, show main app
    if (startScreen) startScreen.style.display = 'none';
    if (mainApp) mainApp.style.display = 'flex';
    
    isInitialized = true;
    
    console.log('Qeyloop initialized successfully');
    
  } catch (error) {
    console.error('Failed to initialize Qeyloop:', error);
    
    if (startButton) {
      startButton.textContent = 'Error - Click to Retry';
      startButton.removeAttribute('disabled');
    }
    
    throw error;
  }
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

/**
 * Handle visibility change (pause/resume audio)
 */
function handleVisibilityChange(): void {
  if (document.hidden) {
    // Release all keys when tab becomes hidden
    keyboardHandler.releaseAllKeys();
  }
}

/**
 * Handle before unload (cleanup)
 */
function handleBeforeUnload(): void {
  keyboardHandler.releaseAllKeys();
  audioEngine.panic();
}

// ============================================================================
// PAGE SWITCHING HOTKEYS
// ============================================================================

/** Map of key codes to page indices for Shift+1-0 */
const PAGE_HOTKEYS: { [key: string]: number } = {
  'Digit1': 0, 'Digit2': 1, 'Digit3': 2, 'Digit4': 3, 'Digit5': 4,
  'Digit6': 5, 'Digit7': 6, 'Digit8': 7, 'Digit9': 8, 'Digit0': 9,
};

/**
 * Handle page switching hotkeys (Shift + 1-0)
 */
function handlePageHotkey(event: KeyboardEvent): boolean {
  if (!isInitialized || !event.shiftKey) return false;
  
  const pageIndex = PAGE_HOTKEYS[event.code];
  if (pageIndex !== undefined) {
    // === PAGE SWITCH VIA HOTKEY ===
    pageManager.switchToPage(pageIndex);
    event.preventDefault();
    return true;
  }
  
  return false;
}

// ============================================================================
// STARTUP
// ============================================================================

/**
 * Setup start screen and event listeners
 */
function setup(): void {
  // Start button click handler
  const startButton = document.getElementById('start-button');
  if (startButton) {
    startButton.addEventListener('click', () => {
      initializeApp().catch(console.error);
    });
  }
  
  // Global event handlers
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('beforeunload', handleBeforeUnload);
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (event) => {
    if (!isInitialized) return;
    
    // Panic (Escape)
    if (event.key === 'Escape') {
      audioEngine.panic();
      return;
    }
    
    // === PAGE SWITCHING: Shift + 1-0 ===
    if (handlePageHotkey(event)) {
      return;
    }
    
    // Copy pad (Ctrl+C or Cmd+C)
    if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
      const selectedPad = padGrid?.getSelectedPad();
      if (selectedPad !== null) {
        padGrid.setCopiedPadKeyCode(selectedPad);
        event.preventDefault();
      }
      return;
    }
    
    // Paste pad (Ctrl+V or Cmd+V)
    if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
      const selectedPad = padGrid?.getSelectedPad();
      const copiedPad = padGrid?.getCopiedPadKeyCode();
      if (selectedPad !== null && copiedPad !== null) {
        padGrid?.copySoundToKey(copiedPad, selectedPad);
        event.preventDefault();
      }
      return;
    }
  });
  
  // Prevent spacebar from scrolling
  document.addEventListener('keydown', (event) => {
    if (event.code === 'Space' && event.target === document.body) {
      event.preventDefault();
    }
  });
}

// Run setup when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setup);
} else {
  setup();
}
