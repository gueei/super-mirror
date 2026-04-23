import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canCommitMirror, resolveCommitAxis } from '../src/ui-state';

describe('ui-state', () => {
  it('canCommitMirror enables footer when an edge is selected', () => {
    const edge = { id: 'bounds:top', label: 'Top', a: { x: 0, y: 0 }, b: { x: 100, y: 0 } };
    assert.equal(canCommitMirror(true, edge), true);
    assert.equal(canCommitMirror(true, null), false);
    assert.equal(canCommitMirror(false, edge), false);
  });

  it('resolveCommitAxis returns custom axis from selected edge', () => {
    const edge = { id: 'bounds:left', label: 'Left', a: { x: 10, y: 20 }, b: { x: 10, y: 80 } };
    const result = resolveCommitAxis({ selectedEdge: edge });
    assert.deepEqual(result, { kind: 'custom', a: { x: 10, y: 20 }, b: { x: 10, y: 80 } });
  });

  it('resolveCommitAxis returns null when no edge is selected', () => {
    assert.equal(resolveCommitAxis({ selectedEdge: null }), null);
  });
});
