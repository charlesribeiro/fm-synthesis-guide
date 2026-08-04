import { Routes } from '@angular/router';

// Every feature route is lazy-loaded (Angular rule: "Route-level features
// should be lazy loaded"), even though each feature is a single placeholder
// component today — the loading boundary is the architectural decision that
// matters, not today's bundle size.
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home').then((m) => m.Home),
    title: 'DX7 Algorithm Lab',
  },
  {
    path: 'learn',
    loadComponent: () => import('./features/learn/learn').then((m) => m.Learn),
    title: 'Learn — DX7 Algorithm Lab',
  },
  {
    path: 'algorithms',
    loadComponent: () => import('./features/algorithms/algorithms').then((m) => m.Algorithms),
    title: 'Algorithms — DX7 Algorithm Lab',
  },
  {
    path: 'playground',
    loadComponent: () => import('./features/playground/playground').then((m) => m.Playground),
    title: 'Playground — DX7 Algorithm Lab',
  },
  {
    path: 'about',
    loadComponent: () => import('./features/about/about').then((m) => m.About),
    title: 'About — DX7 Algorithm Lab',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
