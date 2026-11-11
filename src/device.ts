/** Phones and tablets, where a focused text box brings up the on-screen keyboard. */
export const isTouchScreen = () => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches

/** iPhones and iPads (an iPad can call itself a Mac, but has a touch screen). */
export const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
