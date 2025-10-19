import { useEffect } from 'react';

export type KeyboardShortcut = {
  key: string;
  modifier?: 'cmd' | 'ctrl' | 'shift' | 'alt' | 'option';
  handler: (event: KeyboardEvent) => void;
  preventDefault?: boolean;
  stopPropagation?: boolean;
  description?: string;
};

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  shortcuts: KeyboardShortcut[];
}

/**
 * Custom hook to handle keyboard shortcuts
 * @param options - Configuration options including shortcuts array
 */
export function useKeyboardShortcuts({ enabled = true, shortcuts }: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;

    const handler = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const code = event.code?.toLowerCase();

      // Check each shortcut
      for (const shortcut of shortcuts) {
        const shortcutKey = shortcut.key.toLowerCase();
        const keyMatches =
          key === shortcutKey || code === shortcutKey || code === `key${shortcutKey}`;

        if (!keyMatches) continue;

        // Check modifier requirements
        const modifierPressed =
          shortcut.modifier === 'cmd' || shortcut.modifier === 'ctrl'
            ? event.metaKey || event.ctrlKey
            : shortcut.modifier === 'shift'
              ? event.shiftKey
              : shortcut.modifier === 'alt' || shortcut.modifier === 'option'
                ? event.altKey
                : true; // No modifier required

        if (modifierPressed) {
          if (shortcut.preventDefault !== false) {
            event.preventDefault();
          }
          if (shortcut.stopPropagation) {
            event.stopPropagation();
          }
          shortcut.handler(event);
          return; // Stop after first match
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, shortcuts]);
}

/**
 * Helper to check if a keyboard event matches a shortcut
 */
export function matchesShortcut(
  event: KeyboardEvent,
  key: string,
  modifier?: 'cmd' | 'ctrl' | 'shift' | 'alt' | 'option'
): boolean {
  const eventKey = event.key.toLowerCase();
  const eventCode = event.code?.toLowerCase();
  const targetKey = key.toLowerCase();

  const keyMatches =
    eventKey === targetKey || eventCode === targetKey || eventCode === `key${targetKey}`;

  if (!keyMatches) return false;

  switch (modifier) {
    case 'cmd':
    case 'ctrl':
      return event.metaKey || event.ctrlKey;
    case 'shift':
      return event.shiftKey;
    case 'alt':
    case 'option':
      return event.altKey;
    default:
      return true;
  }
}
