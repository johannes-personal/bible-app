import { useSyncExternalStore } from 'react'

// Adding the app to the home screen (or installing it on a computer). Only the person can do
// that. Chrome and Edge let the page offer a button for it; on an iPhone it's in the Share menu.

interface InstallPromptEvent extends Event {
  prompt(): Promise<unknown>
}

let promptEvent: InstallPromptEvent | null = null
const listeners = new Set<() => void>()
const emit = () => {
  for (const listener of listeners) listener()
}

if (typeof window !== 'undefined') {
  // Not prevented, so the browser's own offer (an icon in the address bar, a banner) still shows.
  window.addEventListener('beforeinstallprompt', (e) => {
    promptEvent = e as InstallPromptEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    promptEvent = null
    emit()
  })
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Opens the browser's install dialog, or null where the browser doesn't offer one to the page. */
export function useInstallPrompt(): (() => void) | null {
  const event = useSyncExternalStore(subscribe, () => promptEvent)
  if (!event) return null
  return () => {
    promptEvent = null
    emit()
    void event.prompt().catch(() => {})
  }
}

/** Opened from the home screen (or as an installed app), rather than in a browser tab. */
export const isInstalled = () =>
  !!window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
