/** Phones and tablets, where a focused text box brings up the on-screen keyboard. */
export const isTouchScreen = () => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches
