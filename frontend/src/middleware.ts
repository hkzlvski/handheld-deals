import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (context, next) => {
  // Get device from cookie or default to 'all'
  const deviceCookie = context.cookies.get('handheld_device');
  const selectedDevice = deviceCookie?.value || 'all';

  // DEBUG LOG
  console.log('[MIDDLEWARE] Device cookie:', deviceCookie);
  console.log('[MIDDLEWARE] Selected device:', selectedDevice);

  // Make device available to all pages via locals
  context.locals.device = selectedDevice as 'all' | 'steam_deck' | 'rog_ally' | 'legion_go';

  return next();
});