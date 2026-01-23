/**
 * Qeyloop Page Selector UI
 * 
 * Minimal page tabs (1-10) for switching between pages.
 * No animations, instant switching.
 */

import { pageManager, MAX_PAGES, PageState } from '../pages/manager';

// ============================================================================
// PAGE SELECTOR
// ============================================================================

export class PageSelector {
  /** Container element */
  private container: HTMLElement;
  
  /** Tab elements (0-9) */
  private tabElements: HTMLElement[] = [];
  
  /** Add page button */
  private addButton: HTMLElement | null = null;
  
  constructor(containerId: string) {
    const el = document.getElementById(containerId);
    if (!el) {
      // Create container if not exists
      const newEl = document.createElement('div');
      newEl.id = containerId;
      document.querySelector('.header')?.appendChild(newEl);
      this.container = newEl;
    } else {
      this.container = el;
    }
  }
  
  /**
   * Initialize the page selector
   */
  initialize(): void {
    this.render();
    this.setupCallbacks();
    this.updateTabs(pageManager.getAllPages(), pageManager.getActivePageIndex());
  }
  
  /**
   * Render the page selector tabs
   */
  private render(): void {
    this.container.innerHTML = '';
    this.container.className = 'page-selector';
    this.tabElements = [];
    
    // Create 10 tab slots
    for (let i = 0; i < MAX_PAGES; i++) {
      const tab = document.createElement('button');
      tab.className = 'page-tab';
      tab.dataset.pageIndex = i.toString();
      tab.textContent = (i + 1).toString();
      tab.title = `Page ${i + 1} (Shift+${i === 9 ? '0' : i + 1})`;
      
      // Click to switch page
      tab.addEventListener('click', () => {
        pageManager.switchToPage(i);
      });
      
      // Right-click to rename (future feature)
      tab.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        // Could add rename dialog here
      });
      
      this.container.appendChild(tab);
      this.tabElements.push(tab);
    }
    
    // Add page button
    this.addButton = document.createElement('button');
    this.addButton.className = 'page-add-btn';
    this.addButton.textContent = '+';
    this.addButton.title = 'Add new page';
    this.addButton.addEventListener('click', () => {
      const newIndex = pageManager.createPage();
      if (newIndex >= 0) {
        pageManager.switchToPage(newIndex);
      }
    });
    this.container.appendChild(this.addButton);
  }
  
  /**
   * Setup callbacks for page manager
   */
  private setupCallbacks(): void {
    // Update tabs when pages change
    pageManager.setPagesUpdateCallback((pages, activeIndex) => {
      this.updateTabs(pages, activeIndex);
    });
    
    // Update active tab when page changes
    pageManager.setPageChangeCallback((pageIndex) => {
      this.setActiveTab(pageIndex);
    });
  }
  
  /**
   * Update tab visibility and state
   */
  private updateTabs(pages: PageState[], activeIndex: number): void {
    for (let i = 0; i < MAX_PAGES; i++) {
      const tab = this.tabElements[i];
      if (!tab) continue;
      
      const page = pages[i];
      const exists = !!page;
      
      // Show/hide based on existence
      tab.classList.toggle('hidden', !exists);
      tab.classList.toggle('active', i === activeIndex);
      tab.classList.toggle('has-content', exists && page.isDirty);
      
      // Update label
      if (exists) {
        // Show page number (short form)
        tab.textContent = (i + 1).toString();
      }
    }
    
    // Hide add button if max pages reached
    if (this.addButton) {
      this.addButton.classList.toggle('hidden', pages.length >= MAX_PAGES);
    }
  }
  
  /**
   * Set active tab visually
   */
  private setActiveTab(pageIndex: number): void {
    for (let i = 0; i < this.tabElements.length; i++) {
      this.tabElements[i].classList.toggle('active', i === pageIndex);
    }
  }
}
