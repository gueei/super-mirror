import { type Point, invert, multiply, reflectionMatrixFromLine, type Mat } from './geometry';

export function reflectRelativeTransform(input: {
  absolute: Mat;
  parentAbsolute: Mat;
  axisStart: Point;
  axisEnd: Point;
}): Mat {
  const reflection = reflectionMatrixFromLine(input.axisStart, input.axisEnd);
  const nextAbsolute = multiply(reflection, input.absolute);
  return multiply(invert(input.parentAbsolute), nextAbsolute);
}
