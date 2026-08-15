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

  /** The currently sounding note (a plain number, never an `AudioNode` —
   * CLAUDE.md forbids audio nodes in signal state), or `null`. */
  private readonly _heldNote = signal<number | null>(null);
  protected readonly heldNote = this._heldNote.asReadonly();

  /** The `KeyboardEvent.code` of the physical key currently held down via
   * the document-level keyboard path (`onDocumentKeydown`), or `null` when
   * no keyboard-originated note is in progress. Tracks one continuous
   * press/release pair so `onDocumentKeyup` can tell "this is that key's
   * own release" apart from an unrelated keyup — see the guard note on
   * `onDocumentKeyup` for why that distinction matters. */
  private keyboardHeldCode: string | null = null;

  /** The note currently held via a *primary-button* pointer press on a key
   * (`onKeyPointerDown`), or `null`. Mirrors `keyboardHeldCode`'s role: lets
   * `onKeyPointerUp` (bound to `pointerup`/`pointerleave`/`pointercancel`)
   * release only the note a primary-button press actually started, so a
   * right-click's own release events — reachable even though its
   * `pointerdown` is ignored — can never silence a note sounding via a
   * different input path. See `onKeyPointerDown`'s WR-07 note. */
  private pointerHeldNote: number | null = null;

  /** The note currently held via a Space/Enter activation on a focused
   * on-screen key button (`onKeyButtonKeydown`), or `null`. Mirrors
   * `pointerHeldNote`/`keyboardHeldCode`'s role: a key button's keyup is
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
      // OnPush: flush the ready-state bindings (`disabled`/`tabindex`) before
      // focusing so the first `.key` is actually enabled in the DOM.
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
    if (!this.pressKey(note)) {
      return;
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
   * `noteForKeyCode` first. */
  protected pressKey(note: number): boolean {
    if (!this.isReady()) {
      return false;
    }
    this.engine.noteOn(note, PLAYABLE_VELOCITY);
    this._heldNote.set(note);
    this.notePlayed.emit(note);
    return true;
  }

  /** Always tells the engine to release `note` — the engine's own stale-
   * release rule (D-04) is what makes a superseded release harmless. Only
   * clears local `heldNote` state when it still equals `note`, so a stale
   * release can never clear the state of the note now sounding. */
  protected releaseKey(note: number): void {
    this.engine.noteOff(note);
    if (this._heldNote() === note) {
      this._heldNote.set(null);
    }
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
    this.keyboardHeldCode = event.code;
    this.pressKey(note);
  }

  /** Release ownership is `keyboardHeldCode` for the document play path, and
   * `buttonHeldNote` for Space/Enter activations that started on a focused
   * key button. The activation-code branch is what ends a note when Tab
   * moved focus while Space/Enter was still held — the keyup then lands on
   * a different button (so `onKeyButtonKeyup` correctly refuses it) but
   * still reaches the document. Clearing `buttonHeldNote` here before
   * `releaseKey` means a later matching `onKeyButtonKeyup` is a no-op and
   * cannot double-release. Modifier/editable-target guards belong on the
   * keydown path only. Readiness is intentionally not re-checked. */
  protected onDocumentKeyup(event: KeyboardEvent): void {
    if (event.code === this.keyboardHeldCode) {
      const note = noteForKeyCode(event.code);
      this.keyboardHeldCode = null;
      if (note !== null) {
        this.releaseKey(note);
      }
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
    this._heldNote.set(null);
    this.keyboardHeldCode = null;
    this.pointerHeldNote = null;
    this.buttonHeldNote = null;
  }
}
