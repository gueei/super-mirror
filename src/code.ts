import {
  extractAxisPointsFromLineLikeNode,
  invert,
  multiply,
  reflectionMatrixFromLine,
  type Mat,
  type Point,
} from './geometry';

type MirrorableNode = SceneNode & LayoutMixin;
type AxisSourceNode = LineNode | VectorNode;

type StatusPayload = {
  type: 'status';
  message: string;
  canMirror: boolean;
};

function isMirrorableNode(node: SceneNode): node is MirrorableNode {
  return 'relativeTransform' in node && 'absoluteTransform' in node;
}

function isAxisSourceNode(node: SceneNode): node is AxisSourceNode {
  return node.type === 'LINE' || node.type === 'VECTOR';
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

function getAxisPointsFromVector(node: VectorNode): { start: Point; end: Point } {
  const network = node.vectorNetwork;

  if (network.segments.length !== 1) {
    throw new Error('Vector axis helper must contain exactly one segment');
  }

  const segment = network.segments[0];
  const startVertex = network.vertices[segment.start];
  const endVertex = network.vertices[segment.end];

  return {
    start: applyLocalPoint(node.absoluteTransform as Mat, startVertex),
    end: applyLocalPoint(node.absoluteTransform as Mat, endVertex),
  };
}

function applyLocalPoint(transform: Mat, point: Point): Point {
  const [[a, b, tx], [c, d, ty]] = transform;
  return {
    x: a * point.x + b * point.y + tx,
    y: c * point.x + d * point.y + ty,
  };
}

function getAxisPoints(node: AxisSourceNode): { start: Point; end: Point } {
  if (node.type === 'LINE') {
    return extractAxisPointsFromLineLikeNode({
      width: node.width,
      absoluteTransform: node.absoluteTransform as Mat,
    });
  }

  return getAxisPointsFromVector(node);
}

function mirrorNodeAcrossLine(node: MirrorableNode, p1: Point, p2: Point) {
  const reflection = reflectionMatrixFromLine(p1, p2);
  const absolute = node.absoluteTransform as Mat;
  const newAbsolute = multiply(reflection, absolute);
  const parentAbsolute = getParentAbsoluteTransform(node);
  const newRelative = multiply(invert(parentAbsolute), newAbsolute);

  node.relativeTransform = newRelative;
}

function describeSelection(selection: readonly SceneNode[]): StatusPayload {
  if (selection.length < 2) {
    return {
      type: 'status',
      message: 'Select at least one target and exactly one line/vector axis helper.',
      canMirror: false,
    };
  }

  const axisNodes = selection.filter(isAxisSourceNode);
  const mirrorableNodes = selection.filter(isMirrorableNode);

  if (axisNodes.length !== 1) {
    return {
      type: 'status',
      message: 'Selection must contain exactly one axis helper of type LINE or VECTOR.',
      canMirror: false,
    };
  }

  const axisNode = axisNodes[0];
  const targets = mirrorableNodes.filter((node) => node.id !== axisNode.id);

  if (targets.length === 0) {
    return {
      type: 'status',
      message: 'Select at least one mirrorable target in addition to the axis helper.',
      canMirror: false,
    };
  }

  return {
    type: 'status',
    message: `Ready: ${targets.length} target(s) will mirror across ${axisNode.name || axisNode.type}.`,
    canMirror: true,
  };
}

function postSelectionStatus() {
  figma.ui.postMessage(describeSelection(figma.currentPage.selection));
}

function mirrorCurrentSelection() {
  const selection = figma.currentPage.selection;
  const axisNodes = selection.filter(isAxisSourceNode);
  const mirrorableNodes = selection.filter(isMirrorableNode);

  if (axisNodes.length !== 1) {
    throw new Error('Select exactly one axis helper of type LINE or VECTOR.');
  }

  const axisNode = axisNodes[0];
  const targets = mirrorableNodes.filter((node) => node.id !== axisNode.id);

  if (targets.length === 0) {
    throw new Error('Select at least one target in addition to the axis helper.');
  }

  const { start, end } = getAxisPoints(axisNode);

  figma.currentPage.selection = targets;
  figma.viewport.scrollAndZoomIntoView([...targets, axisNode]);

  for (const target of targets) {
    mirrorNodeAcrossLine(target, start, end);
  }

  figma.notify(`Mirrored ${targets.length} layer(s).`);
  postSelectionStatus();
}

figma.showUI(__html__, { width: 320, height: 220 });
postSelectionStatus();
figma.on('selectionchange', postSelectionStatus);

figma.ui.onmessage = (message: { type: 'mirror' | 'cancel' }) => {
  if (message.type === 'cancel') {
    figma.closePlugin();
    return;
  }

  if (message.type !== 'mirror') {
    return;
  }

  try {
    mirrorCurrentSelection();
  } catch (error) {
    const text = error instanceof Error ? error.message : 'Mirror failed.';
    figma.notify(text, { error: true });
    figma.ui.postMessage({ type: 'status', message: text, canMirror: false } satisfies StatusPayload);
  }
};
