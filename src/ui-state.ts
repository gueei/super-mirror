import type { Point, Rect } from './preview-model';

export type LockedEdge = {
  id: string;
  label: string;
  a: Point;
  b: Point;
};

export function canCommitMirror(hasSelection: boolean, selectedEdge: LockedEdge | null): boolean {
  return hasSelection && !!selectedEdge;
}

export function resolveCommitAxis(args: {
  selectedEdge: LockedEdge | null;
}): { kind: 'custom'; a: Point; b: Point } | null {
  if (args.selectedEdge) {
    return { kind: 'custom', a: args.selectedEdge.a, b: args.selectedEdge.b };
  }
  return null;
}
