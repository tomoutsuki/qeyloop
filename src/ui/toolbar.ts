/**
 * Qeyloop Toolbar UI
 * 
 * Top menubar with File, Edit, and Help menus.
 * Provides access to all commands via menus.
 */

import { Command, commandExecutor } from '../edit/commands';
import { clipboardManager, ClipboardType } from '../edit/clipboard';
import { historyManager } from '../edit/history';
import { HotkeyHandler } from '../input/hotkeys';

// ============================================================================
// MENU DEFINITIONS
// ============================================================================

interface MenuItem {
  type: 'item' | 'separator';
  label?: string;
  shortcut?: string;
  command?: Command;
  enabled?: () => boolean;
  action?: () => void;
}

interface Menu {
  label: string;
  items: MenuItem[];
}

// ============================================================================
// TOOLBAR
// ============================================================================

export class Toolbar {
  /** Container element */
  private container: HTMLElement;
  
  /** Currently open menu */
  private openMenu: HTMLElement | null = null;
  
  /** Menu definitions */
  private menus: Menu[] = [];
  
  /** Status message element */
  private statusEl: HTMLElement | null = null;
  
  /** Callback for UI refresh */
  private onRefresh: (() => void) | null = null;
  
  constructor(containerId: string) {
    const el = document.getElementById(containerId);
    if (!el) {
      throw new Error(`Toolbar container not found: ${containerId}`);
    }
    this.container = el;
    this.setupMenus();
  }
  
  /**
   * Set refresh callback
   */
  setRefreshCallback(callback: () => void): void {
    this.onRefresh = callback;
  }
  
  /**
   * Setup menu definitions
   */
  private setupMenus(): void {
    this.menus = [
      {
        label: 'File',
        items: [
          { type: 'item', label: 'Import Page...', shortcut: 'Ctrl+Shift+O', command: Command.ImportPage },
          { type: 'item', label: 'Import Project...', shortcut: 'Ctrl+O', command: Command.ImportProject },
          { type: 'separator' },
          { type: 'item', label: 'Export Page...', shortcut: 'Ctrl+Shift+S', command: Command.ExportPage },
          { type: 'item', label: 'Export Project...', shortcut: 'Ctrl+S', command: Command.ExportProject },
          { type: 'separator' },
          { type: 'item', label: 'Convert Old .qeyloop...', command: Command.ConvertOldProject },
        ],
      },
      {
        label: 'Edit',
        items: [
          { 
            type: 'item', 
            label: 'Undo', 
            shortcut: 'Ctrl+Z', 
            command: Command.Undo,
            enabled: () => historyManager.canUndo(),
          },
          { 
            type: 'item', 
            label: 'Redo', 
            shortcut: 'Ctrl+Y', 
            command: Command.Redo,
            enabled: () => historyManager.canRedo(),
          },
          { type: 'separator' },
          { 
            type: 'item', 
            label: 'Copy Audio', 
            shortcut: 'Ctrl+C', 
            command: Command.CopyAudio,
            enabled: () => commandExecutor.getSelectedPad() !== null,
          },
          { 
            type: 'item', 
            label: 'Copy Pad (Full)', 
            shortcut: 'Ctrl+Shift+C', 
            command: Command.CopyPad,
            enabled: () => commandExecutor.getSelectedPad() !== null,
          },
          { type: 'separator' },
          { 
            type: 'item', 
            label: 'Cut Audio', 
            shortcut: 'Ctrl+X', 
            command: Command.CutAudio,
            enabled: () => commandExecutor.getSelectedPad() !== null,
          },
          { 
            type: 'item', 
            label: 'Cut Pad (Full)', 
            shortcut: 'Ctrl+Shift+X', 
            command: Command.CutPad,
            enabled: () => commandExecutor.getSelectedPad() !== null,
          },
          { type: 'separator' },
          { 
            type: 'item', 
            label: 'Paste', 
            shortcut: 'Ctrl+V', 
            command: Command.Paste,
            enabled: () => clipboardManager.hasContent() && commandExecutor.getSelectedPad() !== null,
          },
        ],
      },
      {
        label: 'Help',
        items: [
          { 
            type: 'item', 
            label: 'Keyboard Shortcuts', 
            action: () => this.showKeyboardShortcuts(),
          },
          { type: 'separator' },
          { 
            type: 'item', 
            label: 'GitHub Repository', 
            action: () => window.open('https://github.com/tomoutsuki/qeyloop', '_blank'),
          },
          { type: 'separator' },
          { 
            type: 'item', 
            label: 'About Qeyloop', 
            action: () => this.showAbout(),
          },
        ],
      },
    ];
  }
  
  /**
   * Initialize and render the toolbar
   */
  initialize(): void {
    this.render();
    this.setupEventListeners();
    this.setupStatusCallback();
  }
  
  /**
   * Setup status message callback
   */
  private setupStatusCallback(): void {
    commandExecutor.setStatusCallback((message) => {
      this.showStatus(message);
    });
  }
  
  /**
   * Render the toolbar
   */
  private render(): void {
    this.container.innerHTML = '';
    this.container.className = 'toolbar';
    
    // Menu bar
    const menuBar = document.createElement('div');
    menuBar.className = 'toolbar-menubar';
    
    for (const menu of this.menus) {
      const menuEl = this.createMenuButton(menu);
      menuBar.appendChild(menuEl);
    }
    
    this.container.appendChild(menuBar);
    
    // Status bar
    const statusBar = document.createElement('div');
    statusBar.className = 'toolbar-status';
    this.statusEl = statusBar;
    this.container.appendChild(statusBar);
  }
  
  /**
   * Create a menu button with dropdown
   */
  private createMenuButton(menu: Menu): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'menu-wrapper';
    
    // Menu button
    const btn = document.createElement('button');
    btn.className = 'menu-button';
    btn.textContent = menu.label;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMenu(wrapper, menu);
    });
    wrapper.appendChild(btn);
    
    return wrapper;
  }
  
  /**
   * Toggle menu dropdown
   */
  private toggleMenu(wrapper: HTMLElement, menu: Menu): void {
    // Close any open menu
    if (this.openMenu) {
      this.closeMenu();
      if (this.openMenu === wrapper) {
        return; // Toggle closed
      }
    }
    
    // Create dropdown
    const dropdown = document.createElement('div');
    dropdown.className = 'menu-dropdown';
    
    for (const item of menu.items) {
      const itemEl = this.createMenuItem(item);
      dropdown.appendChild(itemEl);
    }
    
    wrapper.appendChild(dropdown);
    wrapper.classList.add('open');
    this.openMenu = wrapper;
  }
  
  /**
   * Create a menu item
   */
  private createMenuItem(item: MenuItem): HTMLElement {
    if (item.type === 'separator') {
      const sep = document.createElement('div');
      sep.className = 'menu-separator';
      return sep;
    }
    
    const itemEl = document.createElement('button');
    itemEl.className = 'menu-item';
    
    // Check enabled state
    const isEnabled = item.enabled ? item.enabled() : true;
    if (!isEnabled) {
      itemEl.classList.add('disabled');
      itemEl.disabled = true;
    }
    
    // Label
    const label = document.createElement('span');
    label.className = 'menu-item-label';
    label.textContent = item.label ?? '';
    itemEl.appendChild(label);
    
    // Shortcut
    if (item.shortcut) {
      const shortcut = document.createElement('span');
      shortcut.className = 'menu-item-shortcut';
      shortcut.textContent = item.shortcut;
      itemEl.appendChild(shortcut);
    }
    
    // Click handler
    itemEl.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeMenu();
      
      if (item.command !== undefined) {
        commandExecutor.execute(item.command);
        this.onRefresh?.();
      } else if (item.action) {
        item.action();
      }
    });
    
    return itemEl;
  }
  
  /**
   * Close open menu
   */
  private closeMenu(): void {
    if (this.openMenu) {
      const dropdown = this.openMenu.querySelector('.menu-dropdown');
      dropdown?.remove();
      this.openMenu.classList.remove('open');
      this.openMenu = null;
    }
  }
  
  /**
   * Setup global event listeners
   */
  private setupEventListeners(): void {
    // Close menu when clicking outside
    document.addEventListener('click', () => {
      this.closeMenu();
    });
    
    // Close menu on escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeMenu();
      }
    });
  }
  
  /**
   * Show status message
   */
  showStatus(message: string, duration = 3000): void {
    if (!this.statusEl) return;
    
    this.statusEl.textContent = message;
    this.statusEl.classList.add('visible');
    
    setTimeout(() => {
      if (this.statusEl?.textContent === message) {
        this.statusEl.classList.remove('visible');
      }
    }, duration);
  }
  
  /**
   * Show keyboard shortcuts modal
   */
  private showKeyboardShortcuts(): void {
    const shortcuts = HotkeyHandler.getHotkeyList();
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal">
        <h2>Keyboard Shortcuts</h2>
        <div class="shortcut-list">
          ${shortcuts.map(s => `
            <div class="shortcut-item">
              <span class="shortcut-key">${s.key}</span>
              <span class="shortcut-desc">${s.description}</span>
            </div>
          `).join('')}
        </div>
        <button class="modal-close">Close</button>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close handlers
    modal.querySelector('.modal-close')?.addEventListener('click', () => {
      modal.remove();
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }
  
  /**
   * Show about modal
   */
  private showAbout(): void {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal">
        <h2>Qeyloop</h2>
        <p>A web-based audio launchpad.</p>
        <p>Drop audio files onto pads to load sounds.</p>
        <p>Click pads to select, right-click to cycle modes.</p>
        <p>Use keyboard to trigger sounds.</p>
        <button class="modal-close">Close</button>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close handlers
    modal.querySelector('.modal-close')?.addEventListener('click', () => {
      modal.remove();
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }
  
  /**
   * Update clipboard indicator (visual feedback)
   */
  updateClipboardIndicator(): void {
    const hasClipboard = clipboardManager.hasContent();
    const clipboardType = clipboardManager.getContent().type;
    const wasCut = clipboardManager.wasCut();
    
    // This would update any visual clipboard indicator in the toolbar
    // For now just log
    if (hasClipboard) {
      const typeStr = clipboardType === ClipboardType.AudioOnly ? 'audio' : 'pad';
      const actionStr = wasCut ? 'Cut' : 'Copied';
      console.log(`[Toolbar] Clipboard: ${actionStr} ${typeStr}`);
    }
  }
}

// Factory function (not singleton - container ID needed)
export function createToolbar(containerId: string): Toolbar {
  return new Toolbar(containerId);
}
