import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { InstrumentState } from '../../../state/instrument-state';

/**
 * VIZ-02 (D-09, D-10, D-14, D-15): six explicit controls over `InstrumentState`'s
 * already-complete A/B snapshot facade (Phase 3) and randomize command
 * (`10-03-PLAN.md`). This component deliberately contains no state logic of its
 * own — capture, recall, hasSnapshot, reset and randomize were all built and
 * tested elsewhere. Everything here is dispatching a button press to exactly
 * one facade method and describing the result in words; the two `computed`
 * wrappers below (over `hasSnapshot('a')`/`hasSnapshot('b')`) are the only
 * derived state this component may hold, and the last-action status message
 * is the only writable signal it may hold. There is no notion of a
 * "currently active" slot here — the facade has none, and D-09 rejected
 * inventing one for a toggle switch this panel does not have.
 */
@Component({
  selector: 'app-tools-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './tools-panel.html',
  styleUrl: './tools-panel.scss',
})
export class ToolsPanel {
  private readonly state = inject(InstrumentState);

  /** Whether slot A currently holds a captured patch — read straight
   * through the facade, never mirrored or cached. */
  protected readonly hasSnapshotA = computed(() => this.state.hasSnapshot('a'));

  /** Whether slot B currently holds a captured patch — read straight
   * through the facade, never mirrored or cached. */
  protected readonly hasSnapshotB = computed(() => this.state.hasSnapshot('b'));

  /** D-10: the Recall A button's accessible label states the slot's
   * captured-or-empty state in words, so it can never disagree with the
   * `disabled` binding — both derive from the same `hasSnapshotA` above. */
  protected readonly recallALabel = computed(() =>
    this.hasSnapshotA() ? 'Recall A' : 'Recall A (slot A is empty)',
  );

  /** Mirrors {@link recallALabel} for slot B. */
  protected readonly recallBLabel = computed(() =>
    this.hasSnapshotB() ? 'Recall B' : 'Recall B (slot B is empty)',
  );

  /** D-10: the slot-state line for A, readable independent of the button's
   * disabled attribute or any colour. */
  protected readonly slotALineText = computed(() => (this.hasSnapshotA() ? 'Slot A: captured.' : 'Slot A: empty.'));

  /** Mirrors {@link slotALineText} for slot B. */
  protected readonly slotBLineText = computed(() => (this.hasSnapshotB() ? 'Slot B: captured.' : 'Slot B: empty.'));

  /** The only writable signal this component owns: a plain-text status
   * message describing the most recent action, for a screen-reader user who
   * cannot see a button's visual state change. */
  protected readonly statusMessage = signal('No action taken yet.');

  /** Captures the current patch into slot A. */
  protected captureA(): void {
    this.state.captureSnapshot('a');
    this.statusMessage.set('Captured the current sound to slot A.');
  }

  /** Captures the current patch into slot B. */
  protected captureB(): void {
    this.state.captureSnapshot('b');
    this.statusMessage.set('Captured the current sound to slot B.');
  }

  /** Recalls slot A. Uses the facade's own boolean return so the status
   * message can never claim a recall that did not happen, even though the
   * button is disabled while the slot is empty. */
  protected recallA(): void {
    const recalled = this.state.recallSnapshot('a');
    this.statusMessage.set(recalled ? 'Recalled slot A.' : 'Slot A is empty — nothing to recall.');
  }

  /** Mirrors {@link recallA} for slot B. */
  protected recallB(): void {
    const recalled = this.state.recallSnapshot('b');
    this.statusMessage.set(recalled ? 'Recalled slot B.' : 'Slot B is empty — nothing to recall.');
  }

  /** Restores the default patch. Never touches the captured slots — that
   * guarantee lives in `InstrumentState.reset()` itself. */
  protected resetPatch(): void {
    this.state.reset();
    this.statusMessage.set('Reset to the default patch. Captured slots are unchanged.');
  }

  /** The only call site for `randomize()` in the whole application. */
  protected randomizePatch(): void {
    this.state.randomize();
    this.statusMessage.set('Randomized the current sound.');
  }
}
