import "@testing-library/jest-dom/vitest";

class RO { observe() {} unobserve() {} disconnect() {} }
// Recharts' ResponsiveContainer needs ResizeObserver, which jsdom lacks.
(globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;
window.scrollTo = () => {};
