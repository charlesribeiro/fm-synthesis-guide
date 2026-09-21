import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { App } from './app';
import { routes } from './app.routes';
import { STORAGE } from './core/persistence/storage.token';
import { FakeStorage } from './core/persistence/testing/fake-storage';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes), { provide: STORAGE, useValue: new FakeStorage() }],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('renders a skip link before the primary navigation', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.skip-link')?.getAttribute('href')).toBe('#main-content');
  });

  it('exposes all five primary nav links', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const navLabels = Array.from(compiled.querySelectorAll('.primary-nav a')).map((a) =>
      a.textContent?.trim(),
    );
    expect(navLabels).toEqual(['Learn', 'Algorithms', 'Playground', 'Settings', 'About']);
  });

  it('keeps the motion-preference footer line and does not add a MIDI status', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const footer = compiled.querySelector('.shell-footer');
    expect(footer?.querySelector('.motion-indicator')?.textContent).toContain('Motion preference:');
    expect(footer?.querySelectorAll('p').length).toBe(2);
    expect(footer?.textContent).not.toMatch(/MIDI/i);
  });

  it('places the lazy settings route after playground and before about', () => {
    const playgroundIndex = routes.findIndex((route) => route.path === 'playground');
    const settings = routes[playgroundIndex + 1];
    expect(settings?.path).toBe('settings');
    expect(settings?.title).toBe('Settings — DX7 Algorithm Lab');
    expect(routes[playgroundIndex + 2]?.path).toBe('about');
    expect(routes.at(-1)?.path).toBe('**');
  });

  it('routes main content to a landmark the skip link can target', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('main#main-content')).not.toBeNull();
  });
});
