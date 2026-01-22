/**
 * Qeyloop Main Application Entry Point
 * 
 * Initializes all modules and starts the application.
 */

import { audioEngine } from './audio/engine';
import { keyboardHandler } from './input/keyboard';
import { modeManager } from './modes/manager';
import { bpmController } from './timing/bpm';
import { PadGrid } from './ui/grid';
import { ControlPanel } from './ui/controls';

// ============================================================================
// APPLICATION STATE
// ============================================================================

let padGrid: PadGrid;
let controlPanel: ControlPanel;
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
    
    // Initialize UI
    padGrid = new PadGrid('pad-grid');
    padGrid.initialize();
    
    controlPanel = new ControlPanel('control-panel');
    controlPanel.initialize();
    
    // Connect pad selection to control panel
    padGrid.setPadSelectCallback((keyCode) => {
      controlPanel.selectPad(keyCode);
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
  
  // Keyboard shortcut for panic (Escape)
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isInitialized) {
      audioEngine.panic();
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
