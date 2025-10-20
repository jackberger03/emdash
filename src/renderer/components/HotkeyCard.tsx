import React, { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Keyboard } from 'lucide-react';

// Detect platform - use userAgent as fallback since process.platform isn't available in renderer
const isMac = navigator.userAgent.includes('Mac');

export const HotkeyCard: React.FC = () => {
  const [hotkey, setHotkey] = useState<string>('CommandOrControl+Shift+Space');
  const [isRecording, setIsRecording] = useState(false);
  const [recordedKeys, setRecordedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Load saved hotkey
    const saved = localStorage.getItem('floatingWindowHotkey');
    if (saved) {
      setHotkey(saved);
    }
  }, []);

  const formatHotkey = (hotkeyString: string): string => {
    return hotkeyString
      .replace('CommandOrControl', isMac ? '⌘' : 'Ctrl')
      .replace('Command', '⌘')
      .replace('Control', 'Ctrl')
      .replace('Shift', '⇧')
      .replace('Alt', '⌥')
      .replace('Option', '⌥')
      .split('+')
      .join(' + ');
  };

  const electronKeyName = (key: string): string => {
    const keyMap: Record<string, string> = {
      ' ': 'Space',
      Control: 'Control',
      Meta: isMac ? 'Command' : 'Super',
      Shift: 'Shift',
      Alt: 'Alt',
    };
    return keyMap[key] || key.toUpperCase();
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isRecording) return;

      e.preventDefault();
      e.stopPropagation();

      const keys = new Set(recordedKeys);

      // Add modifier keys
      if (e.ctrlKey || e.metaKey) {
        if (isMac && e.metaKey) {
          keys.add('Command');
        } else if (e.ctrlKey) {
          keys.add('Control');
        }
      }
      if (e.shiftKey) keys.add('Shift');
      if (e.altKey) keys.add('Alt');

      // Add the actual key (not modifiers)
      if (!['Control', 'Meta', 'Shift', 'Alt'].includes(e.key)) {
        const keyName = electronKeyName(e.key);
        keys.add(keyName);
      }

      setRecordedKeys(keys);
    },
    [isRecording, recordedKeys]
  );

  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      if (!isRecording || recordedKeys.size === 0) return;

      e.preventDefault();
      e.stopPropagation();

      // Build hotkey string in Electron format
      const parts: string[] = [];
      const keys = Array.from(recordedKeys);

      // Check if we have both Command and Control
      const hasCommand = keys.includes('Command');
      const hasControl = keys.includes('Control');

      // Order: CommandOrControl/Command/Control, Alt, Shift, Key
      if (hasCommand && hasControl) {
        parts.push('CommandOrControl');
      } else if (hasCommand) {
        parts.push('Command');
      } else if (hasControl) {
        parts.push('Control');
      }

      if (keys.includes('Alt')) parts.push('Alt');
      if (keys.includes('Shift')) parts.push('Shift');

      // Add the non-modifier key
      const nonModifiers = keys.filter((k) => !['Command', 'Control', 'Alt', 'Shift'].includes(k));
      if (nonModifiers.length > 0) {
        parts.push(nonModifiers[0]);
      }

      if (parts.length >= 2) {
        // Need at least one modifier + one key
        const newHotkey = parts.join('+');
        setHotkey(newHotkey);
        localStorage.setItem('floatingWindowHotkey', newHotkey);

        // Notify main process to update hotkey
        window.electronAPI.floatingUpdateHotkey?.(newHotkey);
      }

      setIsRecording(false);
      setRecordedKeys(new Set());
    },
    [isRecording, recordedKeys]
  );

  useEffect(() => {
    if (isRecording) {
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);

      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
      };
    }
  }, [isRecording, handleKeyDown, handleKeyUp]);

  const startRecording = () => {
    setRecordedKeys(new Set());
    setIsRecording(true);
  };

  const resetToDefault = () => {
    const defaultHotkey = 'CommandOrControl+Shift+Space';
    setHotkey(defaultHotkey);
    localStorage.setItem('floatingWindowHotkey', defaultHotkey);
    window.electronAPI.floatingUpdateHotkey?.(defaultHotkey);
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-medium">Floating Window Hotkey</h4>
          </div>
          <p className="text-xs text-muted-foreground">
            Global keyboard shortcut to toggle the floating chat window
          </p>
          <div className="mt-3 flex items-center gap-2">
            <kbd className="rounded bg-muted px-3 py-1.5 text-sm font-medium">
              {isRecording ? (
                <span className="animate-pulse text-blue-500">Press keys...</span>
              ) : (
                formatHotkey(hotkey)
              )}
            </kbd>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Button
            size="sm"
            variant={isRecording ? 'default' : 'outline'}
            onClick={startRecording}
            disabled={isRecording}
          >
            {isRecording ? 'Recording...' : 'Change'}
          </Button>
          <Button size="sm" variant="ghost" onClick={resetToDefault}>
            Reset
          </Button>
        </div>
      </div>
    </div>
  );
};

export default HotkeyCard;
