import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { MotionPreference } from './core/browser/motion-preference';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly motionPreference = inject(MotionPreference);

  /** Read-only signal, surfaced in the footer as a live accessibility cue. */
  protected readonly prefersReducedMotion = this.motionPreference.prefersReducedMotion;
}
