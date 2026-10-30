import { describe, expect, it } from 'vitest';
import { ENGINE_VERSION, customEngine } from './index';

describe('engine package', () => {
  it('exposes a version and the formula engine', () => {
    expect(ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(customEngine.name).toBe('custom');
  });
});
