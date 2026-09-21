import { Injectable, inject } from '@angular/core';
import { isAlgorithmId } from '../domain/dx7/models/algorithm';
import { OPERATOR_IDS } from '../domain/dx7/models/operator';
import { validateOperatorParameters } from '../domain/dx7/models/operator-parameters';
import { validateFeedbackLevel, type InstrumentPatch } from '../domain/dx7/models/patch';
import { SavedDocumentStore } from './saved-document-store';

/**
 * Dedicated Playground patch field (D-21, D-22). Call-site origin is the
 * isolation rule: only Playground-originated commands write here. Does not
 * subscribe to `InstrumentState.patch()`.
 */
@Injectable({ providedIn: 'root' })
export class PlaygroundPatchSlot {
  private readonly store = inject(SavedDocumentStore);

  read(): InstrumentPatch {
    return this.store.document().playgroundPatch;
  }

  write(patch: InstrumentPatch): void {
    if (!isAlgorithmId(patch.algorithmId)) {
      throw new RangeError(`algorithmId ${patch.algorithmId} is not a known algorithm (expected 1..32)`);
    }
    for (const operatorId of OPERATOR_IDS) {
      validateOperatorParameters(patch.operators[operatorId]);
    }
    validateFeedbackLevel(patch.feedback);
    this.store.writePlaygroundPatch(patch);
  }
}
