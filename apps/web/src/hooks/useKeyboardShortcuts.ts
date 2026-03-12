import { useEffect } from 'react';

interface ShortcutConfig {
  onPersonaSwitch?: (index: number) => void;
  onEscape?: () => void;
  onToggleExpand?: () => void;
  onToggleQuestions?: () => void;
  onPrint?: () => void;
}

/**
 * Global keyboard shortcuts for Eden.
 *
 * Number keys 1-9  → switch persona tab
 * Escape           → close active panel / modal
 * E                → toggle expand all cards
 * Q                → toggle cross-cutting questions panel
 * P                → print the current view
 *
 * All shortcuts are suppressed when the user is typing inside an input,
 * textarea, select, or contenteditable element.
 */
export function useKeyboardShortcuts(config: ShortcutConfig) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;

      // Skip when focus is inside an editable element
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      // Skip when modifier keys are held (allow browser & OS shortcuts)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key;

      // Number keys 1-9 → persona switch
      if (key >= '1' && key <= '9') {
        config.onPersonaSwitch?.(parseInt(key, 10));
        return;
      }

      switch (key) {
        case 'Escape':
          config.onEscape?.();
          break;

        case 'e':
        case 'E':
          config.onToggleExpand?.();
          break;

        case 'q':
        case 'Q':
          config.onToggleQuestions?.();
          break;

        case 'p':
        case 'P':
          e.preventDefault(); // prevent browser print dialog race
          if (config.onPrint) {
            config.onPrint();
          } else {
            window.print();
          }
          break;
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [config]);
}
