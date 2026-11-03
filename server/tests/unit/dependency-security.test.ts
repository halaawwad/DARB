import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

// Resolve through Prisma's config package, the exact scope of the override.
const require = createRequire(import.meta.url);
const configRequire = createRequire(require.resolve('@prisma/config'));
const { deepmerge } = configRequire('deepmerge-ts') as {
  deepmerge: (...values: Record<string, unknown>[]) => Record<string, unknown>;
};

describe('patched dependency compatibility', () => {
  it('preserves Prisma-style plain config merging without mutating inputs', () => {
    const first = { schema: 'prisma/schema.prisma', migrations: { path: 'prisma/migrations' } };
    expect(deepmerge(first, { migrations: { seed: 'tsx prisma/seed.ts' } })).toEqual({
      schema: 'prisma/schema.prisma', migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
    });
    expect(first.migrations).toEqual({ path: 'prisma/migrations' });
  });
  it('handles a circular config graph without recursive stack exhaustion', () => {
    const input: Record<string, unknown> = { enabled: true };
    input.self = input;
    const merged = deepmerge(input, { schema: 'prisma/schema.prisma' });
    expect(merged.enabled).toBe(true);
    expect(merged.self).toBe(merged);
  });
  it('rejects oversized constrained arrays without allocating one issue per invalid item', () => {
    const parsed = z.array(z.number()).max(3).safeParse(Array.from({ length: 10000 }, () => 'invalid'));
    expect(parsed.success).toBe(false);
    expect(parsed.error!.issues.length).toBeLessThan(10);
    expect(parsed.error!.issues.some((issue) => issue.code === 'too_big')).toBe(true);
  });
});
