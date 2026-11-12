import { loadConfig } from './env.js';

const valid = {
  DATABASE_USER: 'u',
  DATABASE_PASSWORD: 'p',
  DATABASE_NAME: 'db',
  JWT_SECRET: 'x'.repeat(32),
};

describe('loadConfig', () => {
  it('applies defaults', () => {
    const config = loadConfig(valid);
    expect(config.PORT).toBe(3000);
    expect(config.JWT_EXPIRES_IN_SECONDS).toBe(3600);
    expect(config.DATABASE_LOGGING).toBe(false);
  });

  it('rejects a short JWT secret without echoing its value', () => {
    expect(() => loadConfig({ ...valid, JWT_SECRET: 'tooshort' })).toThrow(
      /JWT_SECRET: JWT_SECRET must be at least 32 characters/,
    );
    expect(() => loadConfig({ ...valid, JWT_SECRET: 'tooshort' })).not.toThrow(
      /tooshort/,
    );
  });

  it('reports missing database credentials', () => {
    expect(() => loadConfig({ JWT_SECRET: 'x'.repeat(32) })).toThrow(
      /DATABASE_USER/,
    );
  });
});
