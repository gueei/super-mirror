"use strict";

var AXIS_PLUGIN_NAMESPACE = "mirror-across-axis";
var AXIS_PLUGIN_KEY = "isExtractedAxis";

function multiply(m1, m2) {
  const [[a1, b1, tx1], [c1, d1, ty1]] = m1;
  const [[a2, b2, tx2], [c2, d2, ty2]] = m2;
  return [
    [a1 * a2 + b1 * c2, a1 * b2 + b1 * d2, a1 * tx2 + b1 * ty2 + tx1],
    [c1 * a2 + d1 * c2, c1 * b2 + d1 * d2, c1 * tx2 + d1 * ty2 + ty1],
  ];
}

function invert(m) {
  const [[a, b, tx], [c, d, ty]] = m;
  const det = a * d - b * c;
  if (Math.abs(det) < 1e-10) throw new Error("Transform is not invertible");
  return [
    [d / det, -b / det, (b * ty - d * tx) / det],
    [-c / det, a / det, (c * tx - a * ty) / det],
  ];
}

function applyToPoint(m, pt) {
  return {
    x: m[0][0] * pt.x + m[0][1] * pt.y + m[0][2],
    y: m[1][0] * pt.x + m[1][1] * pt.y + m[1][2],
  };
}

function reflectionMatrixFromLine(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) throw new Error("Mirror axis is too short.");
  const ux = dx / len;
  const uy = dy / len;
  const r00 = 2 * ux * ux - 1;
  const r01 = 2 * ux * uy;
  const r10 = r01;
  const r11 = 2 * uy * uy - 1;
  const tx = a.x - r00 * a.x - r01 * a.y;
  const ty = a.y - r10 * a.x - r11 * a.y;
  return [[r00, r01, tx], [r10, r11, ty]];
}

function isMirrorable(node) {
  return !!node && "relativeTransform" in node && "absoluteTransform" in node;
}

function getBoundsOfNodes(nodes) {
  if (!nodes || nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    var corners = localRectCorners(node).map(function(pt) {
      return applyToPoint(node.absoluteTransform, pt);
    });

    for (var j = 0; j < corners.length; j++) {
      var c = corners[j];
      if (c.x < minX) minX = c.x;
      if (c.y < minY) minY = c.y;
      if (c.x > maxX) maxX = c.x;
      if (c.y > maxY) maxY = c.y;
    }
  }

  return {
    minX: minX,
    minY: minY,
    maxX: maxX,
    maxY: maxY,
    width: maxX - minX,
    height: maxY - minY
  };
}

function parentAbsTransform(node) {
  var p = node.parent;
  if (!p || p.type === "PAGE" || p.type === "DOCUMENT") return [[1, 0, 0], [0, 1, 0]];
  if ("absoluteTransform" in p) return p.absoluteTransform;
  return [[1, 0, 0], [0, 1, 0]];
}

function localRectCorners(node) {
  return [
    { x: 0, y: 0 },
    { x: Number(node.width) || 0, y: 0 },
    { x: Number(node.width) || 0, y: Number(node.height) || 0 },
    { x: 0, y: Number(node.height) || 0 },
  ];
}

function getAxisPoints(node) {
  if (!node || !("absoluteTransform" in node)) {
    throw new Error("Node cannot be used as an axis.");
  }

  if (node.type === "LINE") {
    return {
      start: applyToPoint(node.absoluteTransform, { x: 0, y: 0 }),
      end: applyToPoint(node.absoluteTransform, { x: node.width, y: 0 }),
    };
  }

  if ("vectorNetwork" in node && node.vectorNetwork && node.vectorNetwork.segments && node.vectorNetwork.vertices) {
    var net = node.vectorNetwork;
    if (net.segments.length === 1) {
      var seg = net.segments[0];
      return {
        start: applyToPoint(node.absoluteTransform, net.vertices[seg.start]),
        end: applyToPoint(node.absoluteTransform, net.vertices[seg.end]),
      };
    }
  }

  if ("width" in node && "height" in node) {
    var w = Number(node.width) || 0;
    var h = Number(node.height) || 0;
    if (w > 0 || h > 0) {
      if (h <= 1) {
        return {
          start: applyToPoint(node.absoluteTransform, { x: 0, y: 0 }),
          end: applyToPoint(node.absoluteTransform, { x: w, y: 0 }),
        };
      }
      if (w <= 1) {
        return {
          start: applyToPoint(node.absoluteTransform, { x: 0, y: 0 }),
          end: applyToPoint(node.absoluteTransform, { x: 0, y: h }),
        };
      }
    }
  }

  throw new Error("Axis helper must be a LINE, a single-segment VECTOR, or an ultra-thin shape.");
}

function canBeAxis(node) {
  try {
    getAxisPoints(node);
    return true;
  } catch (_) {
    return false;
  }
}

function describeNode(node) {
  var name = node && node.name ? ' \"' + node.name + '\"' : "";
  return (node && node.type ? node.type : "UNKNOWN") + name;
}

function mirrorNode(node, p1, p2) {
  var reflection = reflectionMatrixFromLine(p1, p2);
  var newAbs = multiply(reflection, node.absoluteTransform);
  var newRel = multiply(invert(parentAbsTransform(node)), newAbs);
  node.relativeTransform = newRel;
}

function cloneTarget(node) {
  if (!node || typeof node.clone !== "function") {
    throw new Error("Selected target cannot be cloned.");
  }
  var clone = node.clone();
  if (clone.parent !== node.parent && node.parent && "appendChild" in node.parent) {
    node.parent.appendChild(clone);
  }
  return clone;
}

function getAxisPointsForMode(mode, selection) {
  if (mode === "horizontal") {
    var targets = selection.filter(isMirrorable);
    if (targets.length === 0) {
      throw new Error("No mirrorable layers selected for horizontal mirror.");
    }
    var bounds = getBoundsOfNodes(targets);
    var centerX = bounds.minX + bounds.width / 2;
    return {
      start: { x: centerX, y: bounds.minY },
      end: { x: centerX, y: bounds.maxY },
      mode: "horizontal"
    };
  }

  if (mode === "vertical") {
    var targets = selection.filter(isMirrorable);
    if (targets.length === 0) {
      throw new Error("No mirrorable layers selected for vertical mirror.");
    }
    var bounds = getBoundsOfNodes(targets);
    var centerY = bounds.minY + bounds.height / 2;
    return {
      start: { x: bounds.minX, y: centerY },
      end: { x: bounds.maxX, y: centerY },
      mode: "vertical"
    };
  }

  throw new Error("Unknown mirror mode: " + mode);
}

function analyzeSelection(sel, mode) {
  if (!mode) mode = "arbitrary";

  if (mode === "horizontal" || mode === "vertical") {
    if (sel.length === 0) {
      return { canApply: false, message: "Select at least one layer to mirror." };
    }
    var targets = sel.filter(isMirrorable);
    if (targets.length === 0) {
      return { canApply: false, message: "No mirrorable layers selected." };
    }
    return {
      canApply: true,
      canExtract: false,
      axis: null,
      targets: targets,
      message: "Ready to " + mode + " mirror " + targets.length + " layer(s)."
    };
  }

  // Arbitrary axis mode (original behavior)
  if (sel.length < 2) {
    return { canApply: false, message: "Select at least one target layer and one axis helper." };
  }

  var axes = sel.filter(canBeAxis);
  if (axes.length !== 1) {
    return {
      canApply: false,
      message: "Need exactly one valid axis helper. Selected: " + sel.map(describeNode).join(", ")
    };
  }

  var axis = axes[0];
  var targets = sel.filter(isMirrorable).filter(function(n) { return n.id !== axis.id; });
  if (targets.length === 0) {
    return { canApply: false, message: "No mirrorable target layers selected." };
  }

  return {
    canApply: true,
    canExtract: sel.length === 1 && canExtractAxisLines(sel[0]),
    axis: axis,
    targets: targets,
    message: "Ready: " + targets.length + " target(s) across " + describeNode(axis) + "."
  };
}

function segmentPointsFromVectorNode(node) {
  if (!("vectorNetwork" in node) || !node.vectorNetwork || !node.vectorNetwork.segments || !node.vectorNetwork.vertices) {
    return [];
  }
  var net = node.vectorNetwork;
  var out = [];
  for (var i = 0; i < net.segments.length; i++) {
    var seg = net.segments[i];
    var start = applyToPoint(node.absoluteTransform, net.vertices[seg.start]);
    var end = applyToPoint(node.absoluteTransform, net.vertices[seg.end]);
    if (Math.hypot(end.x - start.x, end.y - start.y) > 1e-6) {
      out.push({ start: start, end: end, label: "segment " + (i + 1) });
    }
  }
  return out;
}

function segmentPointsFromBounds(node) {
  if (!("width" in node) || !("height" in node)) return [];
  var w = Number(node.width) || 0;
  var h = Number(node.height) || 0;
  if (w <= 0 || h <= 0) return [];
  var corners = localRectCorners(node).map(function(pt) {
    return applyToPoint(node.absoluteTransform, pt);
  });
  return [
    { start: corners[0], end: corners[1], label: "top edge" },
    { start: corners[1], end: corners[2], label: "right edge" },
    { start: corners[2], end: corners[3], label: "bottom edge" },
    { start: corners[3], end: corners[0], label: "left edge" },
  ];
}

function extractableSegments(node) {
  var vectorSegments = segmentPointsFromVectorNode(node);
  if (vectorSegments.length > 0) return vectorSegments;
  return segmentPointsFromBounds(node);
}

function canExtractAxisLines(node) {
  return extractableSegments(node).length > 0;
}

function isExtractedAxisLine(node) {
  return !!node && node.type === "LINE" && typeof node.getPluginData === "function" && node.getPluginData(AXIS_PLUGIN_KEY) === "1";
}

function allExtractedAxisLinesOnPage() {
  return figma.currentPage.findAll(function(node) {
    return isExtractedAxisLine(node);
  });
}

function canRemoveAxisLines() {
  return allExtractedAxisLinesOnPage().length > 0;
}

function createAxisLine(start, end, name) {
  var dx = end.x - start.x;
  var dy = end.y - start.y;
  var len = Math.hypot(dx, dy);
  if (len < 1e-6) return null;

  var line = figma.createLine();
  line.name = name;
  if (typeof line.setPluginData === "function") {
    line.setPluginData(AXIS_PLUGIN_KEY, "1");
    line.setPluginData("sourcePlugin", AXIS_PLUGIN_NAMESPACE);
  }
  line.strokes = [{ type: "SOLID", color: { r: 0.85, g: 0.2, b: 0.2 } }];
  line.strokeWeight = 1;
  line.strokeCap = "ROUND";
  if ("dashPattern" in line) {
    line.dashPattern = [8, 4];
  }
  line.resize(len, 0.0001);
  line.x = start.x;
  line.y = start.y;
  line.rotation = Math.atan2(dy, dx) * 180 / Math.PI;
  return line;
}

function runExtractAxisLines() {
  var sel = figma.currentPage.selection;
  if (sel.length !== 1) {
    throw new Error("Select exactly one shape to extract axis lines from.");
  }

  var source = sel[0];
  var segments = extractableSegments(source);
  if (segments.length === 0) {
    throw new Error("Selected node has no extractable segments.");
  }

  var created = [];
  for (var i = 0; i < segments.length; i++) {
    var seg = segments[i];
    var line = createAxisLine(seg.start, seg.end, "Axis • " + (source.name || source.type) + " • " + seg.label);
    if (line) created.push(line);
  }

  if (created.length === 0) {
    throw new Error("No non-zero axis lines could be created.");
  }

  figma.currentPage.selection = created;
  figma.notify("Extracted " + created.length + " axis line(s).");
  postStatus("Extracted " + created.length + " axis line(s) from " + describeNode(source) + ".");
}

function runRemoveAxisLines() {
  var lines = allExtractedAxisLinesOnPage();
  if (lines.length === 0) {
    throw new Error("No extracted axis lines found on this page.");
  }

  var selectionIds = {};
  for (var i = 0; i < figma.currentPage.selection.length; i++) {
    selectionIds[figma.currentPage.selection[i].id] = true;
  }

  for (var j = 0; j < lines.length; j++) {
    lines[j].remove();
  }

  var nextSelection = figma.currentPage.selection.filter(function(node) {
    return !selectionIds[node.id];
  });
  figma.currentPage.selection = nextSelection;
  figma.notify("Removed " + lines.length + " extracted axis line(s).");
  postStatus("Removed " + lines.length + " extracted axis line(s).");
}

function postStatus(extra, mode) {
  if (!mode) mode = "arbitrary";
  var sel = figma.currentPage.selection;
  var state = analyzeSelection(sel, mode);
  var canExtract = mode === "arbitrary" && sel.length === 1 && canExtractAxisLines(sel[0]);
  var canRemoveAxis = canRemoveAxisLines();
  figma.ui.postMessage({
    canApply: state.canApply,
    canExtract: canExtract,
    canRemoveAxis: canRemoveAxis,
    message: extra || (canExtract && !state.canApply ? "Ready to extract axis lines from " + describeNode(sel[0]) + "." : state.message)
  });
}

function runApply(options) {
  var mode = options && options.mode ? options.mode : "arbitrary";
  var sel = figma.currentPage.selection;
  var state = analyzeSelection(sel, mode);
  if (!state.canApply) {
    throw new Error(state.message);
  }

  var pts;
  if (mode === "horizontal" || mode === "vertical") {
    pts = getAxisPointsForMode(mode, sel);
  } else {
    pts = getAxisPoints(state.axis);
  }

  var outputs = [];
  for (var i = 0; i < state.targets.length; i++) {
    var target = state.targets[i];
    var node = options && options.clone ? cloneTarget(target) : target;
    mirrorNode(node, pts.start, pts.end);
    outputs.push(node);
  }

  if (outputs.length > 0) {
    figma.currentPage.selection = outputs;
  }

  var verb = options && options.clone ? "Cloned and " + mode + " mirrored " : mode + " mirrored ";
  var axisDesc = mode === "horizontal" || mode === "vertical" ? mode + " axis" : describeNode(state.axis);
  figma.notify(verb + outputs.length + " layer(s).");
  postStatus(verb + outputs.length + " layer(s) across " + axisDesc + ".", mode);
}

figma.showUI(__html__, { width: 360, height: 340, themeColors: true });
var currentTab = "quick";
postStatus(null, null);
figma.on("selectionchange", function() {
  var modeForStatus = currentTab === "axis" ? "arbitrary" : null;
  postStatus(null, modeForStatus);
});

figma.ui.onmessage = function(msg) {
  if (!msg) return;
  if (msg.type === "cancel") {
    figma.closePlugin();
    return;
  }
  try {
    if (msg.type === "switch-tab") {
      currentTab = msg.tab;
      var modeForStatus = msg.tab === "axis" ? "arbitrary" : null;
      postStatus(null, modeForStatus);
      return;
    }
    if (msg.type === "quick-mirror") {
      runApply({ clone: !!msg.clone, mode: msg.mode });
      return;
    }
    if (msg.type === "axis-mirror") {
      runApply({ clone: !!msg.clone, mode: "arbitrary" });
      return;
    }
    if (msg.type === "extract-axis-lines") {
      runExtractAxisLines();
      return;
    }
    if (msg.type === "remove-axis-lines") {
      runRemoveAxisLines();
      return;
    }
  } catch (e) {
    var text = e && e.message ? e.message : "Action failed.";
    figma.notify(text, { error: true });
    postStatus(text, currentTab === "axis" ? "arbitrary" : null);
  }
};
