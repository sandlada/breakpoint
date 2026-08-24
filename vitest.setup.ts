import { vi } from 'vitest'

// --- matchMedia mock (viewport strategy) ---
// TASK 6 Viewport: generate media queries per key, Map cache + addEventListener('change')
// jsdom has no matchMedia by default, provide minimal mock, tests can override as needed
if (typeof window !== 'undefined' && !window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })),
    })
}

// --- ResizeObserver mock (element strategy) ---
// TASK 6 Element: singleton ResizeObserver + rAF coalescing, read entry.contentRect.width/height
if (typeof globalThis !== 'undefined' && !(globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver) {
    class MockResizeObserver {
        observe = vi.fn()
        unobserve = vi.fn()
        disconnect = vi.fn()
    }
    ; (globalThis as unknown as { ResizeObserver: typeof MockResizeObserver }).ResizeObserver = MockResizeObserver
}

// rAF coalescing test-friendly: fallback to setTimeout when jsdom lacks rAF (TASK mentions rafId dedup)
if (typeof window !== 'undefined' && !window.requestAnimationFrame) {
    // @ts-ignore
    window.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 0) as unknown as number
    // @ts-ignore
    window.cancelAnimationFrame = (id: number) => clearTimeout(id)
}
