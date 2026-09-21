import type {
  MidiAccessLike,
  MidiConnectionEventLike,
  MidiInputLike,
  MidiMessageEventLike,
  MidiRequestOptionsLike,
  RequestMidiAccessLike,
} from '../../browser/midi-access.token';

/** Hand-rolled MIDIInput fake — `emit` delivers a complete message to `onmidimessage`. */
export class FakeMidiInput implements MidiInputLike {
  state: 'connected' | 'disconnected' = 'connected';
  onmidimessage: ((event: MidiMessageEventLike) => void) | null = null;

  constructor(
    readonly id: string,
    readonly name: string,
  ) {}

  emit(data: Uint8Array): void {
    this.onmidimessage?.({ data });
  }
}

/**
 * Map-backed MIDIAccess fake. `inputs.values()` follows insertion order (D-03).
 * Disconnect matches Web MIDI: the port leaves the map and `onstatechange`
 * receives that port so MidiSession can keep a sticky selected row (D-04).
 */
export class FakeMidiAccess implements MidiAccessLike {
  onstatechange: ((event?: MidiConnectionEventLike) => void) | null = null;
  private readonly inputMap = new Map<string, FakeMidiInput>();
  private readonly disconnectedInputs = new Map<string, FakeMidiInput>();

  constructor(inputs: readonly FakeMidiInput[] = []) {
    for (const input of inputs) {
      this.inputMap.set(input.id, input);
    }
  }

  readonly inputs = {
    values: (): IterableIterator<FakeMidiInput> => this.inputMap.values(),
    get: (id: string): FakeMidiInput | undefined => this.inputMap.get(id),
  };

  addInput(input: FakeMidiInput): void {
    input.state = 'connected';
    this.disconnectedInputs.delete(input.id);
    this.inputMap.set(input.id, input);
    this.onstatechange?.({ port: input });
  }

  disconnectInput(id: string): void {
    const input = this.inputMap.get(id);
    if (input === undefined) {
      return;
    }
    input.state = 'disconnected';
    this.inputMap.delete(id);
    this.disconnectedInputs.set(id, input);
    this.onstatechange?.({ port: input });
  }

  reconnectInput(id: string): void {
    const input = this.inputMap.get(id) ?? this.disconnectedInputs.get(id);
    if (input === undefined) {
      return;
    }
    input.state = 'connected';
    this.disconnectedInputs.delete(id);
    this.inputMap.set(id, input);
    this.onstatechange?.({ port: input });
  }
}

export interface FakeRequestMidiAccess extends RequestMidiAccessLike {
  callCount: number;
  lastOptions: MidiRequestOptionsLike | null;
}

export function createFakeRequestMidiAccess(options: {
  rejectWith?: DOMException;
  access?: FakeMidiAccess;
} = {}): FakeRequestMidiAccess {
  const fake = (async (requestOptions?: MidiRequestOptionsLike): Promise<FakeMidiAccess> => {
    fake.callCount += 1;
    fake.lastOptions = requestOptions ?? null;
    if (options.rejectWith !== undefined) {
      throw options.rejectWith;
    }
    return options.access ?? new FakeMidiAccess();
  }) as unknown as FakeRequestMidiAccess;
  fake.callCount = 0;
  fake.lastOptions = null;
  return fake;
}
