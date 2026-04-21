export type Point = { x: number; y: number };
export type Mat = [
  [number, number, number],
  [number, number, number],
];

export type LineLikeNode = {
  width: number;
  absoluteTransform: Mat;
};

export function multiply(m1: Mat, m2: Mat): Mat {
  const [[a1, b1, tx1], [c1, d1, ty1]] = m1;
  const [[a2, b2, tx2], [c2, d2, ty2]] = m2;

  return [
    [
      a1 * a2 + b1 * c2,
      a1 * b2 + b1 * d2,
      a1 * tx2 + b1 * ty2 + tx1,
    ],
    [
      c1 * a2 + d1 * c2,
      c1 * b2 + d1 * d2,
      c1 * tx2 + d1 * ty2 + ty1,
    ],
  ];
}

export function invert(m: Mat): Mat {
  const [[a, b, tx], [c, d, ty]] = m;
  const det = a * d - b * c;

  if (Math.abs(det) < 1e-10) {
    throw new Error('Transform is not invertible');
  }

  return [
    [d / det, -b / det, (b * ty - d * tx) / det],
    [-c / det, a / det, (c * tx - a * ty) / det],
  ];
}

export function applyToPoint(m: Mat, point: Point): Point {
  const [[a, b, tx], [c, d, ty]] = m;
  return {
    x: a * point.x + b * point.y + tx,
    y: c * point.x + d * point.y + ty,
  };
}

export function reflectionMatrixFromLine(a: Point, b: Point): Mat {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);

  if (len < 1e-6) {
    throw new Error('Mirror axis is too short');
  }

  const ux = dx / len;
  const uy = dy / len;

  const r00 = 2 * ux * ux - 1;
  const r01 = 2 * ux * uy;
  const r10 = 2 * ux * uy;
  const r11 = 2 * uy * uy - 1;

  const tx = a.x - r00 * a.x - r01 * a.y;
  const ty = a.y - r10 * a.x - r11 * a.y;

  return [
    [r00, r01, tx],
    [r10, r11, ty],
  ];
}

export function extractAxisPointsFromLineLikeNode(node: LineLikeNode): {
  start: Point;
  end: Point;
} {
  return {
    start: applyToPoint(node.absoluteTransform, { x: 0, y: 0 }),
    end: applyToPoint(node.absoluteTransform, { x: node.width, y: 0 }),
  };
}
