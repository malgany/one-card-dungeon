import { vi } from 'vitest';

if (!HTMLCanvasElement.prototype.getContext) {
  HTMLCanvasElement.prototype.getContext = vi.fn();
}

Object.defineProperty(window, 'devicePixelRatio', {
  value: 1,
  writable: true,
});
