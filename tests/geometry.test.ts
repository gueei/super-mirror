import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyToPoint,
  extractAxisPointsFromLineLikeNode,
  reflectionMatrixFromLine,
  type LineLikeNode,
} from '../src/geometry';

test('reflection across vertical axis flips x and preserves y', () => {
  const reflection = reflectionMatrixFromLine({ x: 0, y: 0 }, { x: 0, y: 10 });
  const point = applyToPoint(reflection, { x: 7, y: 3 });

  assert.deepEqual(point, { x: -7, y: 3 });
});

test('reflection across diagonal y=x swaps coordinates', () => {
  const reflection = reflectionMatrixFromLine({ x: 0, y: 0 }, { x: 4, y: 4 });
  const point = applyToPoint(reflection, { x: 2, y: 5 });

  assert.ok(Math.abs(point.x - 5) < 1e-9);
  assert.ok(Math.abs(point.y - 2) < 1e-9);
});

test('line-like axis extraction returns transformed endpoints', () => {
  const fortyFive = Math.PI / 4;
  const cos = Math.cos(fortyFive);
  const sin = Math.sin(fortyFive);

  const mockedLine: LineLikeNode = {
    width: 10,
    absoluteTransform: [
      [cos, -sin, 100],
      [sin, cos, 50],
    ],
  };

  const axis = extractAxisPointsFromLineLikeNode(mockedLine);

  assert.ok(Math.abs(axis.start.x - 100) < 1e-9);
  assert.ok(Math.abs(axis.start.y - 50) < 1e-9);
  assert.ok(Math.abs(axis.end.x - (100 + 10 * cos)) < 1e-9);
  assert.ok(Math.abs(axis.end.y - (50 + 10 * sin)) < 1e-9);
});
