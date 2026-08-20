import type { CanvasRenderingContext2DLike } from '../canvas-2d.token';

/** One recorded call: the method name and its arguments, in call order. */
export interface RecordedCanvasCall {
  readonly method: string;
  readonly args: readonly unknown[];
}

/**
 * Recording 2D context double (mirrors `fake-audio-context.ts`'s
 * `FakeAudioParam`/`FakeAudioNode` conventions: every interesting call
 * recorded in an ordered array a spec can assert against). Every writable
 * property is a plain field; every method pushes a record onto `calls`.
 */
export class FakeCanvas2dContext implements CanvasRenderingContext2DLike {
  fillStyle = '';
  strokeStyle = '';
  lineWidth = 1;
  font = '';
  textAlign = '';

  readonly calls: RecordedCanvasCall[] = [];

  private record(method: string, args: readonly unknown[]): void {
    this.calls.push({ method, args });
  }

  save(): void {
    this.record('save', []);
  }

  restore(): void {
    this.record('restore', []);
  }

  scale(x: number, y: number): void {
    this.record('scale', [x, y]);
  }

  clearRect(x: number, y: number, w: number, h: number): void {
    this.record('clearRect', [x, y, w, h]);
  }

  fillRect(x: number, y: number, w: number, h: number): void {
    this.record('fillRect', [x, y, w, h]);
  }

  beginPath(): void {
    this.record('beginPath', []);
  }

  moveTo(x: number, y: number): void {
    this.record('moveTo', [x, y]);
  }

  lineTo(x: number, y: number): void {
    this.record('lineTo', [x, y]);
  }

  stroke(): void {
    this.record('stroke', []);
  }

  fillText(text: string, x: number, y: number): void {
    this.record('fillText', [text, x, y]);
  }

  /** How many times `method` was called. */
  callCount(method: string): number {
    return this.calls.filter((call) => call.method === method).length;
  }

  /** The recorded arguments of every occurrence of `method`, in call order. */
  argsFor(method: string): readonly (readonly unknown[])[] {
    return this.calls.filter((call) => call.method === method).map((call) => call.args);
  }
}
