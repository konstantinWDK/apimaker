import '@testing-library/jest-dom'

// Mock crypto.randomUUID if not available in node/jsdom
if (typeof globalThis !== 'undefined' && !globalThis.crypto) {
  (globalThis as any).crypto = {
    randomUUID: () => Math.random().toString(36).substring(2) + Date.now().toString(36)
  }
}
