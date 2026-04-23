export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };

export type PreviewPrimitive = {
  id: string;
  kind: 'polygon' | 'polyline';
  points: Point[];
};

export type PreviewEdge = {
  id: string;
  nodeId: string;
  label: string;
  a: Point;
  b: Point;
};

export type PreviewAxis = {
  start: Point;
  end: Point;
  locked: boolean;
};

export type PreviewViewport = {
  width: number;
  height: number;
  padding: number;
};

function boundsFromPoints(points: Point[]): Rect {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}

export function reflectPoint(point: Point, a: Point, b: Point): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-6) {
    return point;
  }

  const t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / len2;
  const footX = a.x + t * dx;
  const footY = a.y + t * dy;
  return {
    x: 2 * footX - point.x,
    y: 2 * footY - point.y,
  };
}

export function extendLine(a: Point, b: Point, distance = 80) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) {
    return { start: a, end: b };
  }
  const ux = dx / len;
  const uy = dy / len;
  return {
    start: { x: a.x - ux * distance, y: a.y - uy * distance },
    end: { x: b.x + ux * distance, y: b.y + uy * distance },
  };
}

function normalizePoint(point: Point, bounds: Rect, scale: number, viewport: PreviewViewport): Point {
  const offsetX = (viewport.width - bounds.width * scale) / 2;
  const offsetY = (viewport.height - bounds.height * scale) / 2;
  return {
    x: offsetX + (point.x - bounds.x) * scale,
    y: offsetY + (point.y - bounds.y) * scale,
  };
}

/**
 * Build a stable frame that's 3x the original bounds (original centered,
 * with original-width padding on each side horizontally and original-height
 * padding vertically). This ensures the original shape never moves when
 * the user switches mirror directions — any reflection fits within the frame.
 */
function stableFrame(originalBounds: Rect): Rect {
  return {
    x: originalBounds.x - originalBounds.width,
    y: originalBounds.y - originalBounds.height,
    width: originalBounds.width * 3,
    height: originalBounds.height * 3,
  };
}

export function buildPreviewScene(input: {
  primitives: PreviewPrimitive[];
  edges?: PreviewEdge[];
  axis?: PreviewAxis | null;
  viewport: PreviewViewport;
}) {
  const originalPrimitives = input.primitives;
  const reflectedPrimitives = input.axis
    ? input.primitives.map((primitive) => ({
        ...primitive,
        points: primitive.points.map((point) => reflectPoint(point, input.axis!.start, input.axis!.end)),
      }))
    : [];

  const originalPoints = originalPrimitives.flatMap((p) => p.points);

  if (originalPoints.length === 0) {
    return {
      originalPrimitives: [] as PreviewPrimitive[],
      reflectedPrimitives: [] as PreviewPrimitive[],
      edges: [] as PreviewEdge[],
      axis: null as { start: Point; end: Point; locked: boolean } | null,
      bounds: { x: input.viewport.padding, y: input.viewport.padding, width: 0, height: 0 },
    };
  }

  // Use a stable frame anchored to the original shape, not the combined bounds.
  // This prevents the original from shifting when the reflection direction changes.
  const frame = stableFrame(boundsFromPoints(originalPoints));
  const availableWidth = Math.max(1, input.viewport.width - input.viewport.padding * 2);
  const availableHeight = Math.max(1, input.viewport.height - input.viewport.padding * 2);
  const scale = Math.min(
    availableWidth / Math.max(frame.width, 1),
    availableHeight / Math.max(frame.height, 1),
  );

  const mapPoint = (point: Point) => normalizePoint(point, frame, scale, input.viewport);

  return {
    originalPrimitives: originalPrimitives.map((primitive) => ({
      ...primitive,
      points: primitive.points.map(mapPoint),
    })),
    reflectedPrimitives: reflectedPrimitives.map((primitive) => ({
      ...primitive,
      points: primitive.points.map(mapPoint),
    })),
    edges: (input.edges || []).map((edge) => ({
      ...edge,
      a: mapPoint(edge.a),
      b: mapPoint(edge.b),
    })),
    axis: input.axis
      ? {
          start: mapPoint(input.axis.start),
          end: mapPoint(input.axis.end),
          locked: input.axis.locked,
        }
      : null,
    bounds: {
      x: (input.viewport.width - frame.width * scale) / 2,
      y: (input.viewport.height - frame.height * scale) / 2,
      width: frame.width * scale,
      height: frame.height * scale,
    },
  };
}
