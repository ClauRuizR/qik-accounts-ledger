import { Logger } from '@nestjs/common';
import { RedisCacheStore } from './redis-cache-store.js';

describe('RedisCacheStore when Redis is unreachable', () => {
  let store: RedisCacheStore;

  beforeAll(() => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    // Port 1 on localhost: connection refused immediately.
    store = new RedisCacheStore('redis://127.0.0.1:1');
    store.onModuleInit();
  });

  afterAll(async () => {
    await store.onModuleDestroy();
    vi.restoreAllMocks();
  });

  it('fails open: reads miss, writes are no-ops, nothing throws', async () => {
    const started = Date.now();
    await expect(store.get('k')).resolves.toBeNull();
    await expect(store.set('k', 'v', 10)).resolves.toBeUndefined();
    await expect(store.delete('k')).resolves.toBeUndefined();
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  it('reports itself unhealthy', async () => {
    await expect(store.isHealthy()).resolves.toBe(false);
  });
});
