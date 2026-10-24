import {
  rumbleEnvelope,
  sandEnvelope,
  SILENT_AT,
  windEnvelope,
} from './snap-sound-envelopes';

describe('snap sound envelopes', () => {
  const peakOf = (envelope: (progress: number) => number): number => {
    let peak = 0;
    for (let progress = 0; progress <= 1; progress += 0.01) {
      if (envelope(progress) > envelope(peak)) {
        peak = progress;
      }
    }
    return peak;
  };

  describe('rumble', () => {
    it('should break loudly right at the start', () => {
      expect(peakOf(rumbleEnvelope)).toBeLessThan(0.05);
      expect(rumbleEnvelope(0.01)).toBeGreaterThan(0.85);
    });

    it('should have rumbled away after the first third', () => {
      expect(rumbleEnvelope(0.34)).toBeLessThan(0.02);
    });
  });

  describe('wind', () => {
    it('should start quietly', () => {
      expect(windEnvelope(0.05)).toBeLessThan(0.3);
    });

    it('should slowly grow stronger', () => {
      expect(windEnvelope(0.2)).toBeLessThan(windEnvelope(0.4));
      expect(windEnvelope(0.4)).toBeLessThan(windEnvelope(0.58));
      expect(peakOf(windEnvelope)).toBeGreaterThan(0.5);
    });

    it('should fade away in the last third', () => {
      expect(windEnvelope(0.75)).toBeLessThan(windEnvelope(0.6) * 0.7);
      expect(windEnvelope(SILENT_AT)).toBe(0);
    });
  });

  describe('sand', () => {
    it('should crackle with the growing wind', () => {
      expect(sandEnvelope(0.1)).toBeLessThan(sandEnvelope(0.3));
      expect(sandEnvelope(0.3)).toBeLessThan(sandEnvelope(0.55));
    });

    it('should get weaker in the last third and fade away', () => {
      expect(sandEnvelope(0.72)).toBeLessThan(sandEnvelope(0.6));
      expect(sandEnvelope(0.8)).toBeLessThan(sandEnvelope(0.72));
      expect(sandEnvelope(SILENT_AT)).toBe(0);
    });
  });

  it('should be silent from SILENT_AT on', () => {
    for (const envelope of [rumbleEnvelope, windEnvelope, sandEnvelope]) {
      expect(envelope(SILENT_AT)).toBe(0);
      expect(envelope(1)).toBe(0);
    }
  });

  it('should stay between 0 and 1', () => {
    for (let progress = 0; progress <= 1; progress += 0.01) {
      for (const envelope of [rumbleEnvelope, windEnvelope, sandEnvelope]) {
        expect(envelope(progress)).toBeGreaterThanOrEqual(0);
        expect(envelope(progress)).toBeLessThanOrEqual(1);
      }
    }
  });
});
