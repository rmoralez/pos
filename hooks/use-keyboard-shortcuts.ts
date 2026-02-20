import { useEffect, useCallback } from 'react'

export interface KeyboardShortcut {
  key: string
  action: () => void
  description: string
  disabled?: boolean
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input field,
      // UNLESS the key is a function key (F1-F12) which doesn't interfere with typing
      const target = event.target as HTMLElement
      const isFunctionKey = /^F\d+$/.test(event.key)
      if (
        !isFunctionKey &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return
      }

      const shortcut = shortcuts.find((s) => {
        // Support both with and without 'F' prefix for function keys
        const key = event.key.toUpperCase()
        const shortcutKey = s.key.toUpperCase()

        return (
          !s.disabled &&
          (key === shortcutKey ||
           key === `F${shortcutKey}` ||
           `F${key}` === shortcutKey)
        )
      })

      if (shortcut) {
        event.preventDefault()
        shortcut.action()
      }
    },
    [shortcuts]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
