/**
 * The cinematic's tools: scene names and paths, the shots of the reel and
 * how the reel is cut (the films' soundtracks: sound.test.mjs). Run by `npx nx test tools` from the workspace root.
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { describe, it } from 'node:test';
import { crossfades, reelLength, reelStarts } from './reel-cut.ts';
import { sceneName, sceneScript, shots } from './scenes.ts';

void describe('the cinematic tools', () => {
  void it('a scene is named after its script, with dashes', () => {
    assert.equal(sceneName('blender/scenes/dish_duel.py'), 'dish-duel');
    assert.equal(sceneName('dist/title-dish/title_dish.blend'), 'title-dish');
  });

  void it('a scene script is found by name and refused when missing', () => {
    assert.ok(existsSync(sceneScript('bacteria_fight')));
    assert.throws(() => sceneScript('no_such_scene'), /no scene script/);
  });

  void it('every shot of the reel has a scene script', () => {
    const { reel } = shots();
    assert.ok(reel.length >= 2);
    assert.equal(new Set(reel).size, reel.length);
    for (const scene of reel) {
      assert.ok(existsSync(sceneScript(scene)), scene);
    }
  });

  void it('each film fades into the next before the one running ends', () => {
    assert.equal(
      crossfades([5, 5, 4], 0.5),
      '[0:v][1:v]xfade=transition=fade:duration=0.5:offset=4.500[v1];' +
        '[v1][2:v]xfade=transition=fade:duration=0.5:offset=9.000[v2]'
    );
  });

  void it('a single film needs no fade', () => {
    assert.equal(crossfades([5], 0.5), '');
  });

  void it('a film starts in the reel one fade before the one running ends', () => {
    assert.deepEqual(reelStarts([5, 5, 4], 0.5), [0, 4.5, 9]);
    assert.equal(reelLength([5, 5, 4], 0.5), 13);
    assert.deepEqual(reelStarts([5], 0.5), [0]);
  });

  void it('each fade begins where the film fading in starts', () => {
    const lengths = [5, 13.25, 4, 5];
    const offsets = [...crossfades(lengths, 0.5).matchAll(/offset=([\d.]+)/g)];
    assert.deepEqual(
      offsets.map((offset) => Number(offset[1])),
      reelStarts(lengths, 0.5).slice(1)
    );
  });
});
