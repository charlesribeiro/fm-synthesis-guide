import { downloadJson } from './download-json';

describe('downloadJson', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a JSON blob object URL, clicks an anchor with the filename, and revokes the URL', () => {
    const objectUrl = 'blob:test-backup';
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue(objectUrl);
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const click = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = originalCreateElement(tagName);
      if (tagName.toLowerCase() === 'a') {
        element.click = click;
      }
      return element;
    });

    downloadJson('dx7-algorithm-lab-backup.json', '{"ok":true}');

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0]?.[0] as Blob;
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/json');
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith(objectUrl);
  });
});
