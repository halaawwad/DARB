import { expect, it, vi } from 'vitest';
import http from 'node:http';

vi.mock('../../src/lib/prisma.js', () => ({ default: { $connect: vi.fn() } }));
vi.mock('../../src/lib/redis.js', () => ({ redis: {}, connectRedis: vi.fn() }));
vi.mock('../../src/config/env.js', () => ({ env: { databaseUrl: 'postgresql://unit.invalid/unit', jwtSecret: 'unit-only-fictional-secret-at-least-32-characters', corsOrigin: [] } }));

it('imports the entry point without binding a port and constructs a non-listening app', async () => {
  const listen = vi.spyOn(http.Server.prototype, 'listen');
  const { createApp } = await import('../../src/index.js');
  expect(listen).not.toHaveBeenCalled();
  const server = await createApp();
  expect(server.listening).toBe(false);
  expect(listen).not.toHaveBeenCalled();
  await new Promise<void>((resolve) => server.io.close(() => resolve()));
  listen.mockRestore();
});
