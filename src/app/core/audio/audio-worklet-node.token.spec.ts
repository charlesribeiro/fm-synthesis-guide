import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { AUDIO_WORKLET_MODULE_URL } from './audio-worklet-node.token';

describe('worklet deployment URL', () => {
  for (const baseURI of ['https://example.test/', 'https://example.test/fm-synthesis-guide/']) {
    it(`resolves the fixed module relative to ${baseURI}`, () => {
      TestBed.configureTestingModule({
        providers: [{ provide: DOCUMENT, useValue: { baseURI } }],
      });
      expect(TestBed.inject(AUDIO_WORKLET_MODULE_URL)).toBe(
        `${baseURI}worklets/dx7-worklet-processor.js`,
      );
    });
  }
});
