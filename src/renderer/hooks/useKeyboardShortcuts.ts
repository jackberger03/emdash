import { useEffect } from 'react';
import type { ShortcutConfig, GlobalShortcutHandlers } from '../types/shortcuts';

/**
 * ==============================================================================
 * SHORTCUTS CONFIGURATION (Single Source of Truth)
 * ==============================================================================
 */

export const APP_SHORTCUTS = {
  // Command Palette
  COMMAND_PALETTE: {
    key: 'k',
    modifier: 'cmd' as const,
    description: 'Open command palette',
    category: 'Navigation',
  },

  // Settings & Config
  SETTINGS: {
    key: ',',
    modifier: 'cmd' as const,
    description: 'Open settings',
    category: 'Navigation',
  },

  // Sidebar Controls
  TOGGLE_LEFT_SIDEBAR: {
    key: 'b',
    modifier: 'cmd' as const,
    description: 'Toggle left sidebar',
    category: 'View',
  },

  TOGGLE_RIGHT_SIDEBAR: {
    key: '.',
    modifier: 'cmd' as const,
    description: 'Toggle right sidebar',
    category: 'View',
  },

  // Modal Controls
  CLOSE_MODAL: {
    key: 'Escape',
    description: 'Close modal/dialog',
    category: 'Navigation',
  },
} as const;

/**
 * ==============================================================================
 * HELPER FUNCTIONS
 * ==============================================================================
 */

export function formatShortcut(shortcut: ShortcutConfig): string {
  const modifier = shortcut.modifier
    ? shortcut.modifier === 'cmd'
      ? '⌘'
      : shortcut.modifier === 'option'
        ? '⌥'
        : shortcut.modifier === 'shift'
          ? '⇧'
          : shortcut.modifier === 'alt'
            ? 'Alt'
            : 'Ctrl'
    : '';

  const key = shortcut.key === 'Escape' ? 'Esc' : shortcut.key.toUpperCase();

  return modifier ? `${modifier}${key}` : key;
}

export function getShortcutsByCategory(): Record<string, ShortcutConfig[]> {
  const shortcuts = Object.values(APP_SHORTCUTS);
  const grouped: Record<string, ShortcutConfig[]> = {};

  shortcuts.forEach((shortcut) => {
    const category = shortcut.category || 'Other';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(shortcut);
  });

  return grouped;
}

export function hasShortcutConflict(shortcut1: ShortcutConfig, shortcut2: ShortcutConfig): boolean {
  return (
    shortcut1.key.toLowerCase() === shortcut2.key.toLowerCase() &&
    shortcut1.modifier === shortcut2.modifier
  );
}

/**
 * ==============================================================================
 * GLOBAL SHORTCUT HOOK
 * ==============================================================================
 */

/**
 * Single global keyboard shortcuts hook
 * Call this once in your App component with all handlers
 */
export function useKeyboardShortcuts(handlers: GlobalShortcutHandlers) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const hasModifier = event.metaKey || event.ctrlKey;

      // Priority 1: Modal Escape (if any modal is open)
      if (key === 'escape') {
        if (handlers.isCommandPaletteOpen || handlers.isSettingsOpen) {
          event.preventDefault();
          handlers.onCloseModal?.();
          return;
        }
      }

      // Only handle Cmd/Ctrl shortcuts below this point
      if (!hasModifier) return;

      // Priority 2: Command Palette Toggle (Cmd+K)
      if (key === 'k') {
        event.preventDefault();
        handlers.onToggleCommandPalette?.();
        return;
      }

      // Priority 3: Modal shortcuts (when modals are open, they intercept)
      if (handlers.isCommandPaletteOpen) {
        // Command palette is open - it handles its own shortcuts
        if (key === ',') {
          event.preventDefault();
          handlers.onCloseModal?.();
          setTimeout(() => handlers.onOpenSettings?.(), 100);
          return;
        }
        if (key === 'b') {
          event.preventDefault();
          handlers.onCloseModal?.();
          setTimeout(() => handlers.onToggleLeftSidebar?.(), 100);
          return;
        }
        if (key === '.') {
          event.preventDefault();
          handlers.onCloseModal?.();
          setTimeout(() => handlers.onToggleRightSidebar?.(), 100);
          return;
        }
        return; // Prevent other shortcuts when command palette is open
      }

      // Priority 4: Global shortcuts (when no modal is open)
      if (key === ',') {
        event.preventDefault();
        handlers.onOpenSettings?.();
        return;
      }

      if (key === 'b') {
        event.preventDefault();
        handlers.onToggleLeftSidebar?.();
        return;
      }

      if (key === '.') {
        event.preventDefault();
        handlers.onToggleRightSidebar?.();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
}
