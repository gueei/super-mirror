import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPreviewScene, type PreviewPrimitive } from '../src/preview-model';

const rect: PreviewPrimitive = {
  id: 'rect',
  kind: 'polygon',
  points: [
    { x: 0, y: 0 },
    { x: 40, y: 0 },
    { x: 40, y: 20 },
    { x: 0, y: 20 },
  ],
};

test('buildPreviewScene fits original and reflected geometry inside the viewport', () => {
  const scene = buildPreviewScene({
    primitives: [rect],
    axis: { start: { x: 0, y: 0 }, end: { x: 40, y: 0 }, locked: true },
    viewport: { width: 278, height: 110, padding: 10 },
  });

  const originalYs = scene.originalPrimitives[0].points.map((point) => point.y);
  const reflectedYs = scene.reflectedPrimitives[0].points.map((point) => point.y);

  assert.equal(scene.reflectedPrimitives.length, 1);
  assert.equal(Math.min(...originalYs) >= 10, true);
  assert.equal(Math.max(...originalYs) <= 100, true);
  assert.equal(Math.min(...reflectedYs) >= 10, true);
  assert.equal(Math.max(...reflectedYs) <= 100, true);
});

test('buildPreviewScene keeps original at same position regardless of mirror direction', () => {
  const viewport = { width: 278, height: 110, padding: 10 };

  // Mirror up: axis at top edge
  const sceneUp = buildPreviewScene({
    primitives: [rect],
    axis: { start: { x: 0, y: 0 }, end: { x: 40, y: 0 }, locked: true },
    viewport,
  });

  // Mirror down: axis at bottom edge
  const sceneDown = buildPreviewScene({
    primitives: [rect],
    axis: { start: { x: 0, y: 20 }, end: { x: 40, y: 20 }, locked: false },
    viewport,
  });

  // Mirror left: axis at left edge
  const sceneLeft = buildPreviewScene({
    primitives: [rect],
    axis: { start: { x: 0, y: 0 }, end: { x: 0, y: 20 }, locked: false },
    viewport,
  });

  // Original shape must be at the exact same position for ALL directions
  const origUp = sceneUp.originalPrimitives[0].points;
  const origDown = sceneDown.originalPrimitives[0].points;
  const origLeft = sceneLeft.originalPrimitives[0].points;

  for (let i = 0; i < origUp.length; i++) {
    assert.equal(Math.abs(origUp[i].x - origDown[i].x) < 0.01, true, `point ${i} x differs between up and down`);
    assert.equal(Math.abs(origUp[i].y - origDown[i].y) < 0.01, true, `point ${i} y differs between up and down`);
    assert.equal(Math.abs(origUp[i].x - origLeft[i].x) < 0.01, true, `point ${i} x differs between up and left`);
    assert.equal(Math.abs(origUp[i].y - origLeft[i].y) < 0.01, true, `point ${i} y differs between up and left`);
  }
});
