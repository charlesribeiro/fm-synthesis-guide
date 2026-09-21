import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

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

  constructor() {
    this.savedDocumentStore.hydrateLive();
  }
}
