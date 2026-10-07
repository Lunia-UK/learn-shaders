import { describe, expect, it } from 'vitest';
import { site } from '../../src/config/site';

describe('site config', () => {
  it('has a non-empty name', () => {
    expect(site.name.trim()).not.toBe('');
  });
});
