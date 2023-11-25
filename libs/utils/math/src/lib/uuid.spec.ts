import { uuid, uuidToColor } from './uuid';

const GENERATED_UUIDS = 5000;

describe('uuid', () => {
  const uuidSet: Set<string> = new Set();
  for (let i = 0; i < GENERATED_UUIDS; i++) {
    uuidSet.add(uuid());
  }

  it('should generate uuid', () => {
    expect(uuidSet.size).toBe(GENERATED_UUIDS);
  });

  it.each(Array.from(uuidSet))('%s should have a uuids structure', (uuid) => {
    expect(uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });

  describe('uuid to color hex code', () => {
    it.each(Array.from(uuidSet))(
      'should generate a hex color for uuid: %s',
      (uuid) => {
        const color = uuidToColor(uuid);
        expect(color).toMatch(/^#[0-9a-f]{6}$/);
      }
    );
  });
});
