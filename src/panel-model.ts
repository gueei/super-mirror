export type Vec2 = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };

export type SelectionNodeMeta = Rect & {
  id: string;
  name: string;
  type: string;
};

export type PreviewRect = Rect & { id: string };

export type SelectionSummary = {
  count: number;
  label: string;
  width: number;
  height: number;
  bounds: Rect | null;
  canMirror: boolean;
};

export function summarizeSelection(nodes: SelectionNodeMeta[]): SelectionSummary {
  if (nodes.length === 0) {
    return {
      count: 0,
      label: 'Select an object to mirror',
      width: 0,
      height: 0,
      bounds: null,
      canMirror: false,
    };
  }

  const bounds = unionBounds(nodes);
  const roundedWidth = Math.round(bounds.width);
  const roundedHeight = Math.round(bounds.height);

  return {
    count: nodes.length,
    label: nodes.length === 1 ? `1 ${nodes[0].type.toLowerCase()} · ${roundedWidth} × ${roundedHeight}` : `${nodes.length} objects selected`,
    width: roundedWidth,
    height: roundedHeight,
    bounds,
    canMirror: true,
  };
}

export function unionBounds(rects: Rect[]): Rect {
  const minX = Math.min(...rects.map((rect) => rect.x));
  const minY = Math.min(...rects.map((rect) => rect.y));
  const maxX = Math.max(...rects.map((rect) => rect.x + rect.width));
  const maxY = Math.max(...rects.map((rect) => rect.y + rect.height));

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function normalizePreviewRects(
  rects: PreviewRect[],
  viewport: { width: number; height: number; padding: number },
): { rects: PreviewRect[]; bounds: Rect; scale: number } {
  if (rects.length === 0) {
    return {
      rects: [],
      bounds: { x: viewport.padding, y: viewport.padding, width: 0, height: 0 },
      scale: 1,
    };
  }

  const source = unionBounds(rects);
  const availableWidth = Math.max(1, viewport.width - viewport.padding * 2);
  const availableHeight = Math.max(1, viewport.height - viewport.padding * 2);
  const scale = Math.min(availableWidth / Math.max(source.width, 1), availableHeight / Math.max(source.height, 1));

  const scaledWidth = source.width * scale;
  const scaledHeight = source.height * scale;
  const offsetX = (viewport.width - scaledWidth) / 2;
  const offsetY = (viewport.height - scaledHeight) / 2;

  const normalizedRects = rects.map((rect) => ({
    ...rect,
    x: offsetX + (rect.x - source.x) * scale,
    y: offsetY + (rect.y - source.y) * scale,
    width: rect.width * scale,
    height: rect.height * scale,
  }));

  return {
    rects: normalizedRects,
    bounds: {
      x: offsetX,
      y: offsetY,
      width: scaledWidth,
      height: scaledHeight,
    },
    scale,
  };
}
