import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Opts a resolver/controller out of the global JWT guard.
 * Every operation is protected unless explicitly marked public.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
