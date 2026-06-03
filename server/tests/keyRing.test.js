import { createKeyRing } from '../config/keyRing.js';

describe('createKeyRing', () => {
  test('rotates round-robin through the keys and wraps around', () => {
    const ring = createKeyRing(['a', 'b', 'c']);
    expect(ring.size).toBe(3);
    expect([ring.next(), ring.next(), ring.next(), ring.next()]).toEqual(['a', 'b', 'c', 'a']);
  });

  test('returns null and reports size 0 with no keys configured', () => {
    const ring = createKeyRing([]);
    expect(ring.size).toBe(0);
    expect(ring.next()).toBeNull();
  });

  test('a single key is always handed back', () => {
    const ring = createKeyRing(['solo']);
    expect([ring.next(), ring.next(), ring.next()]).toEqual(['solo', 'solo', 'solo']);
  });

  test('advance skips the next key in the rotation', () => {
    const ring = createKeyRing(['a', 'b', 'c']);
    expect(ring.next()).toBe('a');
    ring.advance(); // skip 'b' (e.g. it just hit a rate limit)
    expect(ring.next()).toBe('c');
  });
});
