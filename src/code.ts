import { type Mat, type Point, invert, multiply } from './geometry';
import { summarizeSelection, type SelectionNodeMeta } from './panel-model';
import { reflectRelativeTransform } from './transform-model';

type MirrorableNode = SceneNode & LayoutMixin;
type LineLikeSceneNode = SceneNode & LayoutMixin & VectorLikeMixin;

type PreviewPrimitive = {
  id: string;
  kind: 'polygon' | 'polyline';
  points: Point[];
};

type PreviewEdge = {
  id: string;
  nodeId: string;
  label: string;
  a: Point;
  b: Point;
};

type SelectionChangedMessage = {
  type: 'selection-changed';
  summary: ReturnType<typeof summarizeSelection>;
  nodes: Array<{ id: string; name: string; type: string; width: number; height: number }>;
  primitives: PreviewPrimitive[];
  edges: PreviewEdge[];
};

type CommitMirrorMessage = {
  type: 'commit-mirror';
  axis: { kind: 'custom'; a: Point; b: Point };
  clone: boolean;
};

type ResizeUiMessage = {
  type: 'resize-ui';
  height: number;
};

type OpenExternalMessage = {
  type: 'open-external';
  url: string;
};

type UiMessage =
  | { type: 'request-selection-sync' }
  | ResizeUiMessage
  | CommitMirrorMessage
  | OpenExternalMessage;

const PANEL_WIDTH = 300;
const DEFAULT_HEIGHT = 300;

function isMirrorableNode(node: SceneNode): node is MirrorableNode {
  return 'relativeTransform' in node && 'absoluteTransform' in node && 'width' in node && 'height' in node;
}

function isVectorLikeNode(node: SceneNode): node is LineLikeSceneNode {
  return isMirrorableNode(node) && 'vectorNetwork' in node;
}

function isContainerNode(node: SceneNode): node is SceneNode & ChildrenMixin {
  return 'children' in node;
}

function applyLocalPoint(transform: Mat, point: Point): Point {
  const [[a, b, tx], [c, d, ty]] = transform;
  return {
    x: a * point.x + b * point.y + tx,
    y: c * point.x + d * point.y + ty,
  };
}

function getParentAbsoluteTransform(node: SceneNode): Mat {
  const parent = node.parent;
  if (!parent || parent.type === 'PAGE' || parent.type === 'DOCUMENT') {
    return [
      [1, 0, 0],
      [0, 1, 0],
    ];
  }

  if ('absoluteTransform' in parent) {
    return parent.absoluteTransform as Mat;
  }

  return [
    [1, 0, 0],
    [0, 1, 0],
  ];
}

function localRectCorners(node: Pick<LayoutMixin, 'width' | 'height'>): Point[] {
  return [
    { x: 0, y: 0 },
    { x: node.width, y: 0 },
    { x: node.width, y: node.height },
    { x: 0, y: node.height },
  ];
}

function transformedRectCorners(node: MirrorableNode): Point[] {
  return localRectCorners(node).map((point) => applyLocalPoint(node.absoluteTransform as Mat, point));
}

function boundsFromPoints(points: Point[]): { x: number; y: number; width: number; height: number } {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function nodeMeta(node: MirrorableNode): SelectionNodeMeta {
  const bounds = boundsFromPoints(transformedRectCorners(node));
  return {
    id: node.id,
    name: node.name,
    type: node.type,
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
  };
}

function vectorSegments(node: LineLikeSceneNode): Array<{ a: Point; b: Point; label: string }> {
  const network = node.vectorNetwork;
  if (!network || !network.segments || !network.vertices || network.segments.length === 0) {
    return [];
  }

  const transform = node.absoluteTransform as Mat;
  const segments: Array<{ a: Point; b: Point; label: string }> = [];

  for (let index = 0; index < network.segments.length; index += 1) {
    const segment = network.segments[index];
    const start = network.vertices[segment.start];
    const end = network.vertices[segment.end];
    if (!start || !end) {
      continue;
    }

    const a = applyLocalPoint(transform, start);
    const b = applyLocalPoint(transform, end);
    if (Math.hypot(b.x - a.x, b.y - a.y) < 1e-6) {
      continue;
    }

    segments.push({
      a,
      b,
      label: network.segments.length === 1 ? (node.name || 'Line segment') : `${node.name || node.type} · Segment ${index + 1}`,
    });
  }

  return segments;
}

function rectEdges(node: MirrorableNode): Array<{ a: Point; b: Point; label: string }> {
  const corners = transformedRectCorners(node);
  return [
    { a: corners[0], b: corners[1], label: `${node.name || node.type} · Top edge` },
    { a: corners[1], b: corners[2], label: `${node.name || node.type} · Right edge` },
    { a: corners[2], b: corners[3], label: `${node.name || node.type} · Bottom edge` },
    { a: corners[3], b: corners[0], label: `${node.name || node.type} · Left edge` },
  ];
}

// ── Preview geometry: recurse into groups/frames to show actual children ──

function previewPrimitiveForNode(node: MirrorableNode): PreviewPrimitive[] {
  if (node.type === 'LINE') {
    const corners = transformedRectCorners(node);
    return [{
      id: node.id,
      kind: 'polyline',
      points: [corners[0], corners[1]],
    }];
  }

  if (isVectorLikeNode(node)) {
    const segments = vectorSegments(node);
    if (segments.length > 0) {
      return segments.map((segment, index) => ({
        id: `${node.id}:segment:${index}`,
        kind: 'polyline' as const,
        points: [segment.a, segment.b],
      }));
    }
  }

  // For groups/frames, recurse into children to show actual shapes
  if (isContainerNode(node) && node.children.length > 0) {
    return node.children
      .filter(isMirrorableNode)
      .flatMap(previewPrimitiveForNode);
  }

  return [{
    id: node.id,
    kind: 'polygon',
    points: transformedRectCorners(node),
  }];
}

function previewEdgesForNode(node: MirrorableNode): PreviewEdge[] {
  // For groups/frames, recurse into children so inner edges can be selected.
  if (isContainerNode(node) && node.children.length > 0) {
    return node.children
      .filter(isMirrorableNode)
      .flatMap(previewEdgesForNode);
  }

  const rawEdges = isVectorLikeNode(node) ? vectorSegments(node) : [];
  const segments = rawEdges.length > 0 ? rawEdges : rectEdges(node);
  return segments.map((edge, index) => ({
    id: `${node.id}:edge:${index}`,
    nodeId: node.id,
    label: edge.label,
    a: edge.a,
    b: edge.b,
  }));
}

function collectSelectionState(selection: readonly SceneNode[]): SelectionChangedMessage {
  const mirrorable = selection.filter(isMirrorableNode);
  const nodes = mirrorable.map(nodeMeta);
  const summary = summarizeSelection(nodes);

  // Bounding box edges from the combined selection bounds — these replace the old direction buttons
  const boundsEdges: PreviewEdge[] = [];
  if (summary.bounds) {
    const b = summary.bounds;
    const l = b.x;
    const r = b.x + b.width;
    const t = b.y;
    const bo = b.y + b.height;
    boundsEdges.push(
      { id: 'bounds:top', nodeId: '__bounds__', label: 'Top', a: { x: l, y: t }, b: { x: r, y: t } },
      { id: 'bounds:right', nodeId: '__bounds__', label: 'Right', a: { x: r, y: t }, b: { x: r, y: bo } },
      { id: 'bounds:bottom', nodeId: '__bounds__', label: 'Bottom', a: { x: l, y: bo }, b: { x: r, y: bo } },
      { id: 'bounds:left', nodeId: '__bounds__', label: 'Left', a: { x: l, y: t }, b: { x: l, y: bo } },
    );
  }

  return {
    type: 'selection-changed',
    summary,
    nodes: nodes.map((node) => ({
      id: node.id,
      name: node.name,
      type: node.type,
      width: node.width,
      height: node.height,
    })),
    primitives: mirrorable.flatMap(previewPrimitiveForNode),
    edges: [...boundsEdges, ...mirrorable.flatMap(previewEdgesForNode)],
  };
}

function postSelectionState() {
  figma.ui.postMessage(collectSelectionState(figma.currentPage.selection));
}

// ── Clone handling: place clone outside groups to avoid auto-fit drift ──

function isGroupLike(node: SceneNode): boolean {
  return node.type === 'GROUP';
}

/**
 * Find the nearest non-group ancestor — we want to place clones at a level
 * where the parent doesn't auto-fit to its children.
 */
function nearestNonGroupParent(node: SceneNode): { parent: BaseNode & ChildrenMixin; insertAfter: BaseNode | null } {
  let current: BaseNode | null = node.parent;
  let insertAfter: BaseNode = node;

  while (current) {
    if (current.type === 'PAGE' || !isGroupLike(current as SceneNode)) {
      if ('appendChild' in current) {
        return { parent: current as BaseNode & ChildrenMixin, insertAfter };
      }
    }
    insertAfter = current;
    current = current.parent;
  }

  // Fallback: insert in current page
  return { parent: figma.currentPage, insertAfter: null };
}

function cloneTarget(node: MirrorableNode): MirrorableNode {
  if (typeof node.clone !== 'function') {
    throw new Error(`Cannot clone ${node.name || node.type}.`);
  }

  // Save the absolute position BEFORE cloning (clone will have the same position initially)
  const originalAbsolute = [
    [...node.absoluteTransform[0]],
    [...node.absoluteTransform[1]],
  ] as Mat;

  const clone = node.clone() as MirrorableNode;

  // If the node is inside a group, the clone must be moved outside the group
  // before we set its transform. Groups auto-fit to children, so placing the
  // mirrored clone inside the group would shift the group's position, which
  // invalidates the coordinate system and causes the clone to land wrong.
  if (node.parent && isGroupLike(node.parent)) {
    const { parent: targetParent, insertAfter } = nearestNonGroupParent(node);
    if (insertAfter && 'index' in insertAfter) {
      const idx = (insertAfter as { index: number }).index;
      targetParent.insertChild(idx + 1, clone);
    } else {
      targetParent.appendChild(clone);
    }

    // Figma does NOT adjust relativeTransform when re-parenting.
    // The clone kept its old group-relative transform, which is wrong
    // relative to the new parent. Fix it by recomputing from the saved
    // absolute position and the new parent's absolute transform.
    const newParentAbsolute = getParentAbsoluteTransform(clone);
    clone.relativeTransform = multiply(invert(newParentAbsolute), originalAbsolute);
  } else if (clone.parent !== node.parent && node.parent && 'appendChild' in node.parent) {
    node.parent.appendChild(clone);
  }

  return clone;
}

function mirrorNodeAcrossLine(node: MirrorableNode, start: Point, end: Point) {
  const absolute = node.absoluteTransform as Mat;
  const parentAbsolute = getParentAbsoluteTransform(node);
  node.relativeTransform = reflectRelativeTransform({
    absolute,
    parentAbsolute,
    axisStart: start,
    axisEnd: end,
  });
}

function selectionBounds(selection: MirrorableNode[]) {
  const summary = summarizeSelection(selection.map(nodeMeta));
  if (!summary.bounds) {
    throw new Error('Select at least one object to mirror.');
  }
  return summary.bounds;
}

function resolveAxis(axis: CommitMirrorMessage['axis']): { start: Point; end: Point } {
  return { start: axis.a, end: axis.b };
}

function commitMirror(message: CommitMirrorMessage) {
  const selection = figma.currentPage.selection.filter(isMirrorableNode);
  if (selection.length === 0) {
    throw new Error('Select at least one object to mirror.');
  }

  const { start, end } = resolveAxis(message.axis);
  const targets = message.clone ? selection.map(cloneTarget) : selection;

  for (const target of targets) {
    mirrorNodeAcrossLine(target, start, end);
  }

  figma.currentPage.selection = targets;
  figma.notify(`${message.clone ? 'Cloned and mirrored' : 'Mirrored'} ${targets.length} layer(s).`);
  postSelectionState();
}

figma.showUI(__html__, { width: PANEL_WIDTH, height: DEFAULT_HEIGHT, themeColors: true });
postSelectionState();
figma.on('selectionchange', postSelectionState);

figma.ui.onmessage = (message: UiMessage) => {
  if (!message) {
    return;
  }

  try {
    if (message.type === 'request-selection-sync') {
      postSelectionState();
      return;
    }

    if (message.type === 'resize-ui') {
      const height = Math.max(120, Math.min(560, Math.round(message.height)));
      figma.ui.resize(PANEL_WIDTH, height);
      return;
    }

    if (message.type === 'commit-mirror') {
      commitMirror(message);
      return;
    }

    if (message.type === 'open-external') {
      figma.openExternal(message.url);
      return;
    }
  } catch (error) {
    const text = error instanceof Error ? error.message : 'Action failed.';
    figma.notify(text, { error: true });
    postSelectionState();
  }
};
