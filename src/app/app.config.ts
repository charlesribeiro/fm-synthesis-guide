import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Explicit per CLAUDE.md's "Zoneless." rule — no zone.js is installed,
    // and this makes the app's reactivity model self-documenting instead of
    // relying on an implicit framework default.
    provideZonelessChangeDetection(),
    provideRouter(routes),
  ],
};
