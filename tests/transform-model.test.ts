import test from 'node:test';
import assert from 'node:assert/strict';

import { reflectRelativeTransform } from '../src/transform-model';
import { applyToPoint, type Mat } from '../src/geometry';

test('reflectRelativeTransform mirrors a rectangle across its top edge in world space', () => {
  const absolute: Mat = [
    [1, 0, 10],
    [0, 1, 20],
  ];
  const parentAbsolute: Mat = [
    [1, 0, 0],
    [0, 1, 0],
  ];

  const relative = reflectRelativeTransform({
    absolute,
    parentAbsolute,
    axisStart: { x: 10, y: 20 },
    axisEnd: { x: 50, y: 20 },
  });

  assert.deepEqual(relative, [
    [1, 0, 10],
    [0, -1, 20],
  ]);

  const topLeft = applyToPoint(relative, { x: 0, y: 0 });
  const bottomRight = applyToPoint(relative, { x: 40, y: 20 });
  assert.deepEqual(topLeft, { x: 10, y: 20 });
  assert.deepEqual(bottomRight, { x: 50, y: 0 });
});
