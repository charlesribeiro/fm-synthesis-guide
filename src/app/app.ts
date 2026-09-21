import { Component, ViewChild, ElementRef, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { MotionPreference } from './core/browser/motion-preference';
import { SavedDocumentStore } from './state/saved-document-store';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly motionPreference = inject(MotionPreference);
  private readonly savedDocumentStore = inject(SavedDocumentStore);

  /** Read-only signal, surfaced in the footer as a live accessibility cue. */
  protected readonly prefersReducedMotion = this.motionPreference.prefersReducedMotion;
  @ViewChild('mainContent') private readonly mainContent?: ElementRef<HTMLElement>;
  private readonly router = inject(Router);

  constructor() {
    this.savedDocumentStore.hydrateLive();

    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.mainContent?.nativeElement.focus();
      });
  }
}
