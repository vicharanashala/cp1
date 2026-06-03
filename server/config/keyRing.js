// Round-robin key ring. Hands out the configured AI provider keys in turn so
// live request load is spread evenly across multiple accounts instead of
// hammering a single key's quota. Pure aside from its own cursor, so it's
// trivial to unit-test without any network or SDK.
export function createKeyRing(keys = []) {
  const ring = [...keys];
  let cursor = 0;
  return {
    size: ring.length,

    // The next key in rotation. Returns null when no keys are configured
    // (the caller then stays in mock mode).
    next() {
      if (ring.length === 0) return null;
      const key = ring[cursor % ring.length];
      cursor += 1;
      return key;
    },

    // Skip the key that would have come next — e.g. after one just hit a rate
    // limit, so the following request lands on a different account.
    advance() {
      cursor += 1;
    },
  };
}

export default { createKeyRing };
