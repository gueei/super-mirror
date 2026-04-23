import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizePreviewRects,
  summarizeSelection,
  type PreviewRect,
  type SelectionNodeMeta,
} from '../src/panel-model';

const sampleNodes: SelectionNodeMeta[] = [
  { id: '1', name: 'Card', type: 'FRAME', width: 120, height: 80, x: 40, y: 20 },
  { id: '2', name: 'Badge', type: 'RECTANGLE', width: 40, height: 24, x: 180, y: 52 },
];

test('summarizeSelection returns empty-state metadata when nothing is selected', () => {
  const summary = summarizeSelection([]);

  assert.equal(summary.count, 0);
  assert.equal(summary.label, 'Select an object to mirror');
  assert.equal(summary.canMirror, false);
});

test('summarizeSelection reports aggregate bounds for multiple selected nodes', () => {
  const summary = summarizeSelection(sampleNodes);

  assert.equal(summary.count, 2);
  assert.equal(summary.label, '2 objects selected');
  assert.equal(summary.width, 180);
  assert.equal(summary.height, 80);
  assert.equal(summary.canMirror, true);
});

test('normalizePreviewRects fits shapes inside preview viewport with padding', () => {
  const rects: PreviewRect[] = [
    { id: 'a', x: 40, y: 20, width: 120, height: 80 },
    { id: 'b', x: 180, y: 52, width: 40, height: 24 },
  ];

  const normalized = normalizePreviewRects(rects, { width: 278, height: 94, padding: 12 });

  assert.equal(normalized.bounds.width > 0, true);
  assert.equal(normalized.bounds.height > 0, true);
  assert.equal(normalized.rects.length, 2);
  assert.equal(normalized.rects[0].x >= 12, true);
  assert.equal(normalized.rects[0].y >= 12, true);
  assert.equal(normalized.rects[1].x + normalized.rects[1].width <= 266, true);
  assert.equal(normalized.rects[0].y + normalized.rects[0].height <= 82, true);
});
