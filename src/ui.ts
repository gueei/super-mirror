import { buildPreviewScene, extendLine, type Point, type PreviewEdge, type PreviewPrimitive, type Rect } from './preview-model';

type SelectionSummary = {
  count: number;
  label: string;
  width: number;
  height: number;
  bounds: Rect | null;
  canMirror: boolean;
};

type SelectionChangedMessage = {
  type: 'selection-changed';
  summary: SelectionSummary;
  nodes: Array<{ id: string; name: string; type: string; width: number; height: number }>;
  primitives: PreviewPrimitive[];
  edges: PreviewEdge[];
};

type AppState = {
  selection: SelectionChangedMessage | null;
  selectedEdge: PreviewEdge | null;
  hoveredEdge: PreviewEdge | null;
  cloneModifierDown: boolean;
  previewZoom: number;
  previewViewportHeight: number;
  showAbout: boolean;
};

const PREVIEW_WIDTH = 278;
const DEFAULT_PREVIEW_HEIGHT = 170;
const PREVIEW_PADDING = 10;
const ZOOM_MIN = 1;
const ZOOM_MAX = 8;
const ZOOM_STEP = 0.15;

const state: AppState = {
  selection: null,
  selectedEdge: null,
  hoveredEdge: null,
  cloneModifierDown: false,
  previewZoom: 1,
  previewViewportHeight: DEFAULT_PREVIEW_HEIGHT,
  showAbout: false,
};

const root = document.getElementById('app') as HTMLDivElement;
let lastResizeHeight = 0;

function postPluginMessage(pluginMessage: unknown) {
  parent.postMessage({ pluginMessage }, '*');
}

function requestSelectionSync() {
  postPluginMessage({ type: 'request-selection-sync' });
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function previewBadge() {
  if (state.selectedEdge) {
    return `Axis: ${state.selectedEdge.label}`;
  }
  return 'Click an edge to set mirror axis';
}

function renderPreviewSvg() {
  const selection = state.selection;
  const worldPrimitives = selection?.primitives || [];
  const worldEdges = selection?.edges || [];
  const zoom = state.previewZoom;
  const previewHeight = state.previewViewportHeight;

  let axis: { start: Point; end: Point; locked: boolean } | null = null;
  if (state.selectedEdge) {
    axis = { start: state.selectedEdge.a, end: state.selectedEdge.b, locked: true };
  }

  const preview = buildPreviewScene({
    primitives: worldPrimitives,
    edges: worldEdges,
    axis,
    viewport: { width: PREVIEW_WIDTH, height: previewHeight, padding: PREVIEW_PADDING },
  });

  const highlightedEdge = state.hoveredEdge
    ? preview.edges.find((edge) => edge.id === state.hoveredEdge!.id) || null
    : null;

  const axisLine = preview.axis
    ? extendLine(preview.axis.start, preview.axis.end)
    : null;

  // Compute zoom transform: zoom toward center of viewport
  const cx = PREVIEW_WIDTH / 2;
  const cy = previewHeight / 2;
  const tx = cx - cx * zoom;
  const ty = cy - cy * zoom;

  const baseMarkup = preview.originalPrimitives.map((primitive) => {
    const path = primitive.points.map((point) => `${point.x},${point.y}`).join(' ');
    if (primitive.kind === 'polygon' && primitive.points.length >= 3) {
      return `<polygon class="shape-base" points="${path}" />`;
    }
    return `<polyline class="shape-line" points="${path}" />`;
  }).join('');

  const ghostMarkup = preview.reflectedPrimitives.map((primitive) => {
    const path = primitive.points.map((point) => `${point.x},${point.y}`).join(' ');
    if (primitive.kind === 'polygon' && primitive.points.length >= 3) {
      return `<polygon class="shape-reflection" points="${path}" />`;
    }
    return `<polyline class="shape-reflection-line" points="${path}" />`;
  }).join('');

  const edgeHintMarkup = preview.edges.map((edge) => {
    const isSelected = state.selectedEdge?.id === edge.id;
    const isBounds = edge.nodeId === '__bounds__';
    return `
    <line class="${isBounds ? 'edge-bounds-hint' : 'edge-hint'}${isSelected ? ' edge-hint-selected' : ''}" x1="${edge.a.x}" y1="${edge.a.y}" x2="${edge.b.x}" y2="${edge.b.y}" />`;
  }).join('');

  const edgeHitMarkup = preview.edges.map((edge) => {
    const isHovered = highlightedEdge?.id === edge.id;
    return `
    <line class="edge-hit" data-edge-id="${edge.id}" x1="${edge.a.x}" y1="${edge.a.y}" x2="${edge.b.x}" y2="${edge.b.y}" />
    ${isHovered ? `<line class="edge-highlight" x1="${edge.a.x}" y1="${edge.a.y}" x2="${edge.b.x}" y2="${edge.b.y}" />` : ''}`;
  }).join('');

  const axisMarkup = axisLine
    ? `<line class="axis-line axis-line-locked" x1="${axisLine.start.x}" y1="${axisLine.start.y}" x2="${axisLine.end.x}" y2="${axisLine.end.y}" />`
    : '';

  const zoomIndicator = zoom > 1
    ? `<div class="zoom-badge">${Math.round(zoom * 100)}%</div>`
    : '';

  return `
    <div class="preview-card" data-preview-root>
      <div class="preview-badge">${escapeHtml(previewBadge())}</div>
      ${zoomIndicator}
      <svg class="preview-svg" viewBox="0 0 ${PREVIEW_WIDTH} ${previewHeight}" role="img" aria-label="Preview">
        <defs>
          <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.8" fill="#E9E9E9"></circle>
          </pattern>
          <clipPath id="preview-clip"><rect x="0" y="0" width="${PREVIEW_WIDTH}" height="${previewHeight}" rx="4" /></clipPath>
        </defs>
        <rect x="0.5" y="0.5" width="${PREVIEW_WIDTH - 1}" height="${previewHeight - 1}" rx="4" fill="url(#grid)" />
        <g clip-path="url(#preview-clip)" transform="translate(${tx},${ty}) scale(${zoom})">
          ${edgeHintMarkup}
          ${axisMarkup}
          ${ghostMarkup}
          ${baseMarkup}
          ${edgeHitMarkup}
        </g>
      </svg>
    </div>`;
}

function renderEmptyState() {
  return `
    <div class="empty-state">
      <div class="empty-illustration" aria-hidden="true">
        <svg width="72" height="60" viewBox="0 0 72 60" fill="none">
          <rect x="8" y="18" width="18" height="24" rx="3" stroke="#9A9A9A" stroke-dasharray="3 3"/>
          <rect x="46" y="12" width="18" height="24" rx="3" fill="#0D99FF" fill-opacity="0.16" stroke="#0D99FF"/>
          <path d="M36 6v48" stroke="#0D99FF" stroke-width="1.5" stroke-dasharray="4 3" stroke-linecap="round"/>
        </svg>
      </div>
      <h2>Select something to mirror</h2>
      <p>Pick one or more layers on the canvas. Super Mirror will flip them across any edge you choose.</p>
      <div class="tip-chip">Tip · Shift-click to select multiple</div>
    </div>`;
}

function footerCaption() {
  if (!state.selection?.summary.canMirror) return 'Pick axis first';
  if (state.selectedEdge) return 'Axis ready';
  return 'Click an edge above';
}

function renderAboutOverlay() {
  return `
    <div class="about-backdrop" data-action="close-about">
      <div class="about-panel" onclick="event.stopPropagation()">
        <div class="about-header">
          <span class="about-title">Super Mirror</span>
          <span class="about-version">v1.0.0</span>
        </div>
        <p class="about-desc">Mirror objects across any edge or axis in your Figma design. Select layers, click an edge in the preview, and mirror or clone.</p>
        <div class="about-links">
          <a data-action="open-github">GitHub</a>
          <a data-action="open-issues">Report a bug</a>
        </div>
        <div class="about-support">
          <span class="about-support-label">Find this plugin useful?</span>
          <a class="bmc-btn" data-action="support">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 8h1a4 4 0 1 1 0 8h-1"/>
              <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/>
              <line x1="6" y1="2" x2="6" y2="4"/>
              <line x1="10" y1="2" x2="10" y2="4"/>
              <line x1="14" y1="2" x2="14" y2="4"/>
            </svg>
            Buy me a coffee
          </a>
        </div>
        <div class="about-footer">Made with care by gueei</div>
      </div>
    </div>`;
}

function renderApp() {
  const selection = state.selection;
  const summary = selection?.summary;
  const empty = !summary || !summary.canMirror;
  const axisEnabled = !!summary?.canMirror && !!state.selectedEdge;

  root.innerHTML = `
    <div class="selection-strip ${empty ? 'empty' : ''}">
      <span class="selection-indicator"></span>
      <span class="selection-text">${escapeHtml(summary?.label || 'Select an object to mirror')}</span>
      <button class="info-btn" data-action="toggle-about" title="About Super Mirror">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="16" x2="12" y2="12"/>
          <line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
      </button>
    </div>

    <div class="content">
      ${empty ? renderEmptyState() : `
        ${renderPreviewSvg()}

        <div class="footer">
          <div class="footer-actions">
            <button class="footer-btn" type="button" data-action="mirror" ${axisEnabled ? '' : 'disabled'}>Mirror</button>
            <button class="footer-btn primary" type="button" data-action="mirror-clone" ${axisEnabled ? '' : 'disabled'}>Mirror &amp; Clone</button>
          </div>
        </div>`}
      ${state.showAbout ? renderAboutOverlay() : ''}
    </div>`;

  bindEvents();
  requestAnimationFrame(() => {
    measurePreviewViewportHeight();
    reportHeight();
  });
}

function measurePreviewViewportHeight() {
  const card = root.querySelector<HTMLElement>('[data-preview-root]');
  if (!card) return;
  const next = Math.max(120, Math.round(card.clientHeight));
  if (Math.abs(next - state.previewViewportHeight) > 2) {
    state.previewViewportHeight = next;
    renderApp();
  }
}

function bindEvents() {
  // Edge hit areas — hover and click
  root.querySelectorAll<HTMLElement>('.edge-hit').forEach((line) => {
    const edgeId = line.dataset.edgeId;
    if (!edgeId) return;

    line.addEventListener('mouseenter', () => {
      const edge = state.selection?.edges.find((candidate) => candidate.id === edgeId) || null;
      state.hoveredEdge = edge;
      renderApp();
    });

    line.addEventListener('mouseleave', () => {
      state.hoveredEdge = null;
      renderApp();
    });

    line.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      const edge = state.selection?.edges.find((candidate) => candidate.id === edgeId) || null;
      if (!edge) return;
      if (state.selectedEdge?.id === edge.id) {
        state.selectedEdge = null;
      } else {
        state.selectedEdge = edge;
      }
      state.hoveredEdge = null;
      renderApp();
    });
  });

  // Mouse wheel zoom on preview
  const previewCard = root.querySelector('[data-preview-root]');
  if (previewCard) {
    previewCard.addEventListener('wheel', (event: WheelEvent) => {
      event.preventDefault();
      const delta = event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      const next = Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, state.previewZoom + delta)) * 100) / 100;
      if (next !== state.previewZoom) {
        state.previewZoom = next;
        renderApp();
      }
    }, { passive: false });
  }

  // Support link (in about overlay)
  const supportLink = root.querySelector<HTMLElement>('[data-action="support"]');
  if (supportLink) {
    supportLink.addEventListener('click', (event) => {
      event.preventDefault();
      postPluginMessage({ type: 'open-external', url: 'https://buymeacoffee.com/gueei' });
    });
  }

  // GitHub link
  const githubLink = root.querySelector<HTMLElement>('[data-action="open-github"]');
  if (githubLink) {
    githubLink.addEventListener('click', (event) => {
      event.preventDefault();
      postPluginMessage({ type: 'open-external', url: 'https://github.com/gueei/super-mirror' });
    });
  }

  // Report a bug
  const issuesLink = root.querySelector<HTMLElement>('[data-action="open-issues"]');
  if (issuesLink) {
    issuesLink.addEventListener('click', (event) => {
      event.preventDefault();
      postPluginMessage({ type: 'open-external', url: 'https://github.com/gueei/super-mirror/issues' });
    });
  }

  // Info button in header
  const infoBtn = root.querySelector<HTMLElement>('[data-action="toggle-about"]');
  if (infoBtn) {
    infoBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      state.showAbout = !state.showAbout;
      renderApp();
    });
  }

  // About backdrop click to close
  const backdrop = root.querySelector<HTMLElement>('[data-action="close-about"]');
  if (backdrop) {
    backdrop.addEventListener('click', () => {
      state.showAbout = false;
      renderApp();
    });
  }

  // Action buttons
  root.querySelectorAll<HTMLElement>('[data-action]').forEach((button) => {
    const action = button.dataset.action;
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      if (action === 'mirror' || action === 'mirror-clone') {
        if (!state.selectedEdge) return;
        postPluginMessage({
          type: 'commit-mirror',
          axis: { kind: 'custom', a: state.selectedEdge.a, b: state.selectedEdge.b },
          clone: action === 'mirror-clone' || state.cloneModifierDown,
        });
      }
    });
  });
}

function reportHeight() {
  const nextHeight = Math.ceil(document.documentElement.scrollHeight);
  if (Math.abs(nextHeight - lastResizeHeight) > 4) {
    lastResizeHeight = nextHeight;
    postPluginMessage({ type: 'resize-ui', height: nextHeight });
  }
}

function syncSelection(message: SelectionChangedMessage) {
  state.selection = message;

  if (message.summary.count === 0) {
    state.selectedEdge = null;
    state.hoveredEdge = null;
  } else {
    if (state.hoveredEdge) {
      state.hoveredEdge = message.edges.find((edge) => edge.id === state.hoveredEdge!.id) || null;
    }
    if (state.selectedEdge) {
      state.selectedEdge = message.edges.find((edge) => edge.id === state.selectedEdge!.id) || null;
    }
  }

  renderApp();
}

window.onmessage = (event: MessageEvent<{ pluginMessage?: SelectionChangedMessage }>) => {
  const message = event.data.pluginMessage;
  if (!message || message.type !== 'selection-changed') return;
  syncSelection(message);
};

window.addEventListener('keydown', (event) => {
  if (event.key === 'Alt') {
    state.cloneModifierDown = true;
    renderApp();
    return;
  }
  if (event.key === 'Escape') {
    if (state.showAbout) {
      state.showAbout = false;
      renderApp();
      return;
    }
    state.selectedEdge = null;
    state.hoveredEdge = null;
    state.previewZoom = 1;
    renderApp();
    return;
  }
  if (event.key === 'Enter') {
    if (!state.selectedEdge) return;
    postPluginMessage({
      type: 'commit-mirror',
      axis: { kind: 'custom', a: state.selectedEdge.a, b: state.selectedEdge.b },
      clone: state.cloneModifierDown,
    });
  }
});

window.addEventListener('keyup', (event) => {
  if (event.key === 'Alt') {
    state.cloneModifierDown = false;
    renderApp();
  }
});

renderApp();
requestSelectionSync();
