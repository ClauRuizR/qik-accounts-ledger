import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/env.js';
import { CacheStore } from './cache-store.js';
import { RedisCacheStore } from './redis-cache-store.js';

@Global()
@Module({
  providers: [
    {
      provide: CacheStore,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => new RedisCacheStore(config.REDIS_URL),
    },
  ],
  exports: [CacheStore],
})
export class CacheModule {}
