import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { SYNTH_ENGINE } from '../../core/audio/synth-engine.token';
import { PLAYABLE_KEYS, noteForKeyCode, type PlayableKey } from './keyboard-note-map';

/** D-07/AUDIO-02: a fixed nominal velocity for both input surfaces — this
 * phase has no velocity-sensitive input (pointer pressure, MIDI velocity),
 * so every note-on uses the same mid-range value. */
const PLAYABLE_VELOCITY = 100;

/** The physical `KeyboardEvent.code`s treated as "activate this focused key
 * button" — Space and Enter, matching standard button semantics. */
const ACTIVATION_CODES = new Set(['Space', 'Enter']);

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
}

@Component({
  selector: 'app-play-surface',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './play-surface.html',
  styleUrl: './play-surface.scss',
  host: {
    '(document:keydown)': 'onDocumentKeydown($event)',
    '(document:keyup)': 'onDocumentKeyup($event)',
    '(window:blur)': 'onWindowBlur()',
  },
})
export class PlaySurface {
  private readonly engine = inject(SYNTH_ENGINE);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly changeDetector = inject(ChangeDetectorRef);

  /** The engine's own lifecycle status — never re-derived, always read through. */
  protected readonly status = this.engine.status;

  /** Component-local in-flight state while `initialize()`'s promise is
   * pending (`05-01-PLAN.md` phase decision: not a fifth `AudioEngineStatus`
   * member — that union is a cross-phase contract shared with Phase 7). */
  protected readonly enabling = signal(false);

  protected readonly isReady = computed(() => this.status() === 'ready');

  /** Persistent live-region copy for every `AudioEngineStatus` — one
   * container in the template, text only changes here. */
  protected readonly statusMessage = computed(() => {
    switch (this.status()) {
      case 'unavailable':
        return "Your browser doesn't support Web Audio, so you can't hear sound here. Everything else on this page still works.";
      case 'error':
        return 'Audio failed to start. Enable audio to try again.';
      case 'ready':
        return 'Audio is ready. Play notes on the keyboard below.';
      default:
        return 'Audio is off. Enable audio to play notes on the keyboard below.';
    }
  });

  /** The currently sounding notes (plain numbers, never `AudioNode`s —
   * CLAUDE.md forbids audio nodes in signal state). A Set so every input
   * path can represent its own held keys independently. */
  private readonly _heldNotes = signal(new Set<number>());
  protected readonly heldNotes = this._heldNotes.asReadonly();

  /** Physical `KeyboardEvent.code` → MIDI note started by that keydown.
   * A Map so two held computer-keyboard keys each release independently. */
  private readonly keyboardHeldByCode = new Map<string, number>();

  /** Reference count of input sources currently holding each note. Multiple
   * sources can legitimately hold the identical note at once — e.g. a
   * pointer press on a key while the computer-keyboard key mapped to that
   * same note is also held — so a note must stay sounding (and stay in
   * `heldNotes`) until every owner has released it, not just the first.
   * `pressKey` increments; `releaseKey` decrements and only reaches the
   * engine's `noteOff` (and clears the note from `heldNotes`) when the count
   * drops to zero. */
  private readonly noteHoldCount = new Map<number, number>();

  /** The note currently held via a *primary-button* pointer press on a key
   * (`onKeyPointerDown`), or `null`. Lets `onKeyPointerUp` release only the
   * note a primary-button press actually started. */
  private pointerHeldNote: number | null = null;

  /** The note currently held via a Space/Enter activation on a focused
   * on-screen key button (`onKeyButtonKeydown`), or `null`. Mirrors
   * `pointerHeldNote` / `keyboardHeldByCode`'s role: a key button's keyup is
   * bound to whichever note the template gave *that element*, which is not
   * necessarily the note this path actually started — moving focus with Tab
   * while Space/Enter is still physically held delivers the eventual keyup
   * to the newly-focused button instead, so without this field that keyup
   * would release the wrong (or no) note and strand the one actually
   * sounding. */
  private buttonHeldNote: number | null = null;

  /** D-07: the full fixed one-octave play surface — both input paths read
   * this one table, so they can never disagree about which key is which note. */
  protected readonly keys: readonly PlayableKey[] = PLAYABLE_KEYS;

  /** Emits the MIDI note number every time a note actually starts sounding —
   * i.e. only on the path where {@link pressKey} returns `true` (the engine
   * was ready and `noteOn` actually ran), never on the early-return path.
   * Consumers that only care "a note was played" may ignore the payload. */
  readonly notePlayed = output<number>();

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.engine.allNotesOff();
      this._heldNotes.set(new Set());
      this.keyboardHeldByCode.clear();
      this.noteHoldCount.clear();
      this.pointerHeldNote = null;
      this.buttonHeldNote = null;
    });
  }

  private destroyed = false;

  async enableAudio(): Promise<void> {
    this.enabling.set(true);
    try {
      await this.engine.initialize();
    } catch {
      // Failure reporting stays on the engine's `status` signal — the DOM
      // click handler must not surface an unhandled promise rejection.
    } finally {
      this.enabling.set(false);
    }

    if (this.destroyed) {
      return;
    }

    if (this.isReady()) {
      this.changeDetector.detectChanges();
      const firstKey = this.host.nativeElement.querySelector('.key') as HTMLButtonElement | null;
      firstKey?.focus();
    }
  }

  /** Ignores non-primary pointer buttons (right/middle click): `pointerdown`
   * fires for any button, but a right-click's matching release is
   * unreliable — the native `contextmenu` it opens can swallow the
   * `pointerup`/`pointerleave`/`pointercancel` a left-click always
   * generates, stranding the note until the menu is dismissed and the
   * pointer moves off the key. The template also suppresses the context
   * menu on the keyboard so a right-click never opens it in the first
   * place.
   *
   * WR-07: a right-click still fires its own `pointerup`/`pointerleave`/
   * `pointercancel` (or the browser's context-menu handling can trigger
   * one of them once dismissed) even though this guard skipped its
   * `pointerdown` — those release-side handlers don't get a reliable
   * `button` to check (`pointerleave`/`pointercancel` don't carry the
   * pressed-button semantics `pointerup` does), so `onKeyPointerUp` instead
   * checks `pointerHeldNote`, which is only ever set here after
   * `pressKey` actually starts the note (never when `isReady()` is false). */
  protected onKeyPointerDown(event: PointerEvent, note: number): void {
    if (event.button !== 0) {
      return;
    }
    if (this.pointerHeldNote === note) {
      return;
    }
    if (!this.pressKey(note)) {
      return;
    }
    if (this.pointerHeldNote !== null && this.pointerHeldNote !== note) {
      this.releaseKey(this.pointerHeldNote);
    }
    this.pointerHeldNote = note;
  }

  /** Bound to `pointerup`/`pointerleave`/`pointercancel` on a key — releases
   * `note` only if a primary-button `onKeyPointerDown` actually started it
   * (see WR-07 there). A note already superseded by a newer press (pointer
   * or keyboard) reaches here with `pointerHeldNote` no longer matching, and
   * is correctly ignored — `releaseKey` is never the thing that ends a
   * superseded voice; the newer press already did. */
  protected onKeyPointerUp(note: number): void {
    if (this.pointerHeldNote !== note) {
      return;
    }
    this.pointerHeldNote = null;
    this.releaseKey(note);
  }

  /** Returns `true` when the note started. Returns immediately (and
   * `false`) unless the engine is ready. Never called with an out-of-table
   * note — every caller resolves through `PLAYABLE_KEYS` or
   * `noteForKeyCode` first. Always posts a fresh `noteOn` (existing
   * retrigger-on-repeated-press behavior, unchanged by `noteHoldCount` —
   * that count only gates the *release* side) and increments this note's
   * hold count so a second source pressing the same note becomes a second
   * owner rather than silently colliding with the first. */
  protected pressKey(note: number): boolean {
    if (!this.isReady()) {
      return false;
    }
    this.engine.noteOn(note, PLAYABLE_VELOCITY);
    this.noteHoldCount.set(note, (this.noteHoldCount.get(note) ?? 0) + 1);
    this.markHeld(note);
    this.notePlayed.emit(note);
    return true;
  }

  /** Decrements `note`'s hold count and only reaches the engine's `noteOff`
   * (and clears the local held set) when the LAST owner releases — a note
   * held by two sources at once must not go silent just because one of them
   * let go while the other is still physically held. The engine's own
   * stale-release rule (D-04) remains the backstop for any release that
   * still reaches it out of order. */
  protected releaseKey(note: number): void {
    const remaining = (this.noteHoldCount.get(note) ?? 1) - 1;
    if (remaining > 0) {
      this.noteHoldCount.set(note, remaining);
      return;
    }
    this.noteHoldCount.delete(note);
    this.engine.noteOff(note);
    this.unmarkHeld(note);
  }

  private markHeld(note: number): void {
    const next = new Set(this._heldNotes());
    next.add(note);
    this._heldNotes.set(next);
  }

  private unmarkHeld(note: number): void {
    const next = new Set(this._heldNotes());
    next.delete(note);
    this._heldNotes.set(next);
  }

  /** Space/Enter pressed on a focused key button — keeps the keyboard
   * playable without a pointer. `preventDefault` stops the page scrolling
   * (Space) and stops the browser synthesizing its own click from the
   * keyup, since this handler already calls `pressKey` directly. */
  protected onKeyButtonKeydown(event: KeyboardEvent, note: number): void {
    if (!this.isReady()) {
      return;
    }
    if (!ACTIVATION_CODES.has(event.code)) {
      return;
    }
    event.preventDefault();
    if (event.repeat) {
      return;
    }
    this.pressKey(note);
    if (this.buttonHeldNote !== null && this.buttonHeldNote !== note) {
      this.releaseKey(this.buttonHeldNote);
    }
    this.buttonHeldNote = note;
  }

  /** Release ownership is solely `buttonHeldNote`, mirroring
   * `onKeyPointerUp`/`onDocumentKeyup`: a keyup whose element (and thus
   * `note`) doesn't match the one this path actually started is not this
   * activation's release and must not touch the note now sounding.
   * Readiness is intentionally not re-checked here for the same reason
   * `onDocumentKeyup` doesn't — a release should always be allowed to
   * proceed once a note is playing. */
  protected onKeyButtonKeyup(event: KeyboardEvent, note: number): void {
    if (!ACTIVATION_CODES.has(event.code)) {
      return;
    }
    event.preventDefault();
    if (this.buttonHeldNote !== note) {
      return;
    }
    this.buttonHeldNote = null;
    this.releaseKey(note);
  }

  /** Document-level computer-keyboard play path. Guards run in order: not
   * ready, OS auto-repeat (`05-RESEARCH.md` Pitfall 5), a modifier held
   * (keeps browser/app shortcuts working), an editable target (keeps future
   * Playground text fields working), then an unmapped code. */
  protected onDocumentKeydown(event: KeyboardEvent): void {
    if (!this.isReady()) {
      return;
    }
    if (event.repeat) {
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    if (isEditableTarget(event.target)) {
      return;
    }
    const note = noteForKeyCode(event.code);
    if (note === null) {
      return;
    }
    if (this.keyboardHeldByCode.has(event.code)) {
      return;
    }
    this.keyboardHeldByCode.set(event.code, note);
    this.pressKey(note);
  }

  /** Release ownership is the Map entry for this `event.code` on the
   * document play path, and `buttonHeldNote` for Space/Enter activations
   * that started on a focused key button. The activation-code branch is what
   * ends a note when Tab moved focus while Space/Enter was still held — the
   * keyup then lands on a different button (so `onKeyButtonKeyup` correctly
   * refuses it) but still reaches the document. Clearing `buttonHeldNote`
   * here before `releaseKey` means a later matching `onKeyButtonKeyup` is a
   * no-op and cannot double-release. Modifier/editable-target guards belong
   * on the keydown path only. Readiness is intentionally not re-checked. */
  protected onDocumentKeyup(event: KeyboardEvent): void {
    const mappedNote = this.keyboardHeldByCode.get(event.code);
    if (mappedNote !== undefined) {
      this.keyboardHeldByCode.delete(event.code);
      this.releaseKey(mappedNote);
      return;
    }

    if (!ACTIVATION_CODES.has(event.code) || this.buttonHeldNote === null) {
      return;
    }
    const note = this.buttonHeldNote;
    this.buttonHeldNote = null;
    this.releaseKey(note);
  }

  /** Alt-tabbing (or any focus loss) mid-note must not strand a voice. */
  protected onWindowBlur(): void {
    this.engine.allNotesOff();
    this._heldNotes.set(new Set());
    this.keyboardHeldByCode.clear();
    this.noteHoldCount.clear();
    this.pointerHeldNote = null;
    this.buttonHeldNote = null;
  }
}
