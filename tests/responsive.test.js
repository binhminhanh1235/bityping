import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Responsive Design & Mobile QA Specifications', () => {
  const rootDir = process.cwd();
  const htmlContent = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf-8');
  const cssContent = fs.readFileSync(path.join(rootDir, 'src/styles/index.css'), 'utf-8');
  const headerJsx = fs.readFileSync(path.join(rootDir, 'src/components/Header.jsx'), 'utf-8');
  const stageJsx = fs.readFileSync(path.join(rootDir, 'src/components/BilingualStage.jsx'), 'utf-8');
  const manageJsx = fs.readFileSync(path.join(rootDir, 'src/components/ManageModal.jsx'), 'utf-8');

  describe('1. HTML Viewport & Safe Area Meta', () => {
    it('should have viewport-fit=cover and device-width configured', () => {
      expect(htmlContent).toContain('viewport-fit=cover');
      expect(htmlContent).toContain('width=device-width');
    });

    it('should apply safe-area-inset-top to header and safe-area-inset-bottom to footer', () => {
      expect(cssContent).toContain('env(safe-area-inset-top');
      expect(cssContent).toContain('env(safe-area-inset-bottom');
    });
  });

  describe('2. iOS Zoom Prevention (Font size >= 16px)', () => {
    it('should set font-size: 16px on typing input', () => {
      expect(cssContent).toContain('font-size: 16px');
      expect(stageJsx).toContain('hidden-typing-input');
    });

    it('should enforce font-size >= 16px on mobile inputs, textareas, and selects', () => {
      const mobileInputMatch = cssContent.includes('font-size: 16px !important;');
      expect(mobileInputMatch).toBe(true);
    });
  });

  describe('3. Touch Targets (WCAG AA >= 44x44px)', () => {
    it('should have 44px min touch targets for buttons on mobile', () => {
      expect(cssContent).toContain('min-width: 44px');
      expect(cssContent).toContain('min-height: 44px');
    });

    it('should configure touch-action: manipulation for buttons', () => {
      expect(cssContent).toContain('touch-action: manipulation');
    });
  });

  describe('4. Mobile Header Navigation & Drawer Architecture', () => {
    it('should provide desktop and mobile header variants', () => {
      expect(headerJsx).toContain('desktop-header-right');
      expect(headerJsx).toContain('mobile-header-right');
      expect(headerJsx).toContain('mobile-menu-drawer');
      expect(headerJsx).toContain('session-stats-compact');
    });

    it('should support toggling the mobile menu drawer', () => {
      expect(headerJsx).toContain('isMobileMenuOpen');
      expect(headerJsx).toContain('mobile-menu-toggle');
    });

    it('should render compact session stats on mobile', () => {
      expect(headerJsx).toContain('stat-acc-pill');
    });
  });

  describe('5. Bilingual Stage & Visual Viewport Adaptation', () => {
    it('should listen to window.visualViewport resize and scroll for virtual keyboard', () => {
      expect(stageJsx).toContain('window.visualViewport');
      expect(stageJsx).toContain('handleViewportChange');
    });

    it('should provide responsive word-break and clamp typography', () => {
      expect(cssContent).toContain('word-break: break-word');
      expect(cssContent).toContain('overflow-wrap: break-word');
    });

    it('should adapt the result bar to a vertical stack on mobile screens', () => {
      expect(cssContent).toContain('.result-bar {');
      expect(cssContent).toContain('flex-direction: column');
      expect(cssContent).toContain('.next-card-btn');
    });
  });

  describe('6. ManageModal Mobile Tabs & Responsiveness', () => {
    it('should support switching between pack list and card details on mobile', () => {
      expect(manageJsx).toContain('mobileTab');
      expect(manageJsx).toContain('manage-mobile-tabs');
      expect(manageJsx).toContain('manage-sidebar');
      expect(manageJsx).toContain('manage-main');
    });

    it('should hide desktop text labels on small screens in favor of icons', () => {
      expect(manageJsx).toContain('desktop-btn-label');
      expect(cssContent).toContain('.desktop-btn-label');
    });
  });

  describe('7. Popover & Modal Overlay Responsiveness', () => {
    it('should clamp popover width to viewport bounds on mobile', () => {
      expect(cssContent).toContain('max-width: calc(100vw - 1.5rem)');
    });

    it('should have responsive padding on modal overlay', () => {
      expect(cssContent).toContain('.modal-overlay');
      expect(cssContent).toContain('@media (max-width: 768px)');
    });
  });
});
