import { describe, expect, it } from 'vitest';
import { ENGINE_VERSION } from './index';

describe('engine package', () => {
  it('loads without DOM or Node-only imports', () => {
    expect(ENGINE_VERSION).toBe('0.0.0');
  });
});
