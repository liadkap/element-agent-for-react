interface DebugSource {
  fileName: string;
  lineNumber: number;
  columnNumber?: number;
}

interface ElementMeta {
  tag: string;
  text: string;
  innerHTML?: string;
  componentName?: string;
  componentHierarchy?: string[];
  fullReactTree?: string[];
  testId?: string;
  allClasses?: string[];
  allAttributes?: Record<string, string>;
  computedStyles?: Record<string, string>;
  domPath?: string;
  parentChain?: Array<{ tag: string; id?: string; classes?: string[]; testId?: string }>;
  siblingIndex?: number;
  childCount?: number;
  sourceFile?: string;
  sourceLine?: number;
  sourceColumn?: number;
  componentStack?: Array<{ name: string; source?: DebugSource }>;
  props?: Record<string, unknown>;
  displayName?: string;
}

interface ElementInfo {
  selector: string;
  meta: ElementMeta;
}

interface ReactInfo {
  hasReact?: boolean;
  componentName?: string | null;
  sourceFile?: string | null;
  sourceLine?: number | null;
  sourceColumn?: number | null;
  props?: Record<string, unknown> | null;
  componentHierarchy?: string[];
  fullReactTree?: string[];
  componentStack?: Array<{ name: string; source?: DebugSource }>;
  error?: string;
}

function getReactInfoFromBackground(selector: string): Promise<ReactInfo> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_REACT_INFO', selector }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({});
        return;
      }
      resolve(response?.result || {});
    });
  });
}

let pickerActive = false;
let hoveredElement: HTMLElement | null = null;
let overlay: HTMLElement | null = null;
let tooltip: HTMLElement | null = null;
let cachedReactInfo: ReactInfo | null = null;
let currentSelector: string | null = null;

function createOverlayElements() {
  if (overlay) return;

  overlay = document.createElement('div');
  overlay.id = 'element-agent-overlay';
  overlay.style.cssText = `
    position: fixed;
    pointer-events: none;
    z-index: 2147483646;
    border: 2px solid #7b61ff;
    background: rgba(123, 97, 255, 0.1);
    transition: all 0.05s ease-out;
    display: none;
  `;

  tooltip = document.createElement('div');
  tooltip.id = 'element-agent-tooltip';
  tooltip.style.cssText = `
    position: fixed;
    z-index: 2147483647;
    background: #1a1a2e;
    border-radius: 6px;
    font-family: "SF Mono", SFMono-Regular, ui-monospace, Menlo, Monaco, Consolas, monospace;
    font-size: 11px;
    pointer-events: none;
    display: none;
    padding: 6px 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
    max-width: 400px;
    line-height: 1.4;
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(tooltip);
}

function removeOverlayElements() {
  if (overlay) {
    overlay.remove();
    overlay = null;
  }
  if (tooltip) {
    tooltip.remove();
    tooltip = null;
  }
}

function getFullDomPath(node: Element): string {
  const parts: string[] = [];
  let current: Element | null = node;
  while (current && current !== document.body && parts.length < 15) {
    let part = current.nodeName.toLowerCase();
    const id = current.getAttribute?.('id');
    const testId = current.getAttribute?.('data-testid') || current.getAttribute?.('data-test-id');
    const classes = current.className && typeof current.className === 'string' ? current.className.split(/\s+/).filter(Boolean) : [];

    if (id) part += '#' + id;
    else if (testId) part += `[data-testid='${testId}']`;
    else if (classes.length > 0) part += '.' + classes.slice(0, 2).join('.');

    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter((c) => c.nodeName === current!.nodeName);
      if (siblings.length > 1) {
        const idx = siblings.indexOf(current) + 1;
        part += `:nth-of-type(${idx})`;
      }
    }
    parts.unshift(part);
    current = current.parentElement;
  }
  return parts.join(' > ');
}

function getUniqueSelector(element: HTMLElement): string {
  if (element.id) {
    return `#${element.id}`;
  }

  const testId = element.getAttribute('data-testid') || element.getAttribute('data-test-id');
  if (testId) {
    return `[data-testid="${testId}"]`;
  }

  const path: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();

    if (current.id) {
      selector = `#${current.id}`;
      path.unshift(selector);
      break;
    }

    const parentEl: Element | null = current.parentElement;
    if (parentEl) {
      const currentTag = current.tagName;
      const children = parentEl.children;
      const siblings: Element[] = [];
      for (let i = 0; i < children.length; i++) {
        if (children[i].tagName === currentTag) {
          siblings.push(children[i]);
        }
      }
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }

    path.unshift(selector);
    current = parentEl;
  }

  return path.join(' > ');
}

function getParentChain(node: Element, maxDepth = 8): Array<{ tag: string; id?: string; classes?: string[]; testId?: string }> {
  const chain: Array<{ tag: string; id?: string; classes?: string[]; testId?: string }> = [];
  let current = node.parentElement;
  let depth = 0;
  while (current && current !== document.body && depth < maxDepth) {
    const id = current.getAttribute?.('id');
    const testId = current.getAttribute?.('data-testid') || current.getAttribute?.('data-test-id');
    const classes = current.className && typeof current.className === 'string' ? current.className.split(/\s+/).filter(Boolean) : [];
    chain.push({
      tag: current.nodeName.toLowerCase(),
      id: id || undefined,
      classes: classes.length > 0 ? classes : undefined,
      testId: testId || undefined,
    });
    current = current.parentElement;
    depth++;
  }
  return chain;
}

function getAllAttributes(element: HTMLElement): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const attr of Array.from(element.attributes || [])) {
    if (!attr.name.startsWith('__react') && !attr.name.startsWith('data-element-agent')) {
      attrs[attr.name] = attr.value.slice(0, 200);
    }
  }
  return attrs;
}

function getRelevantStyles(element: HTMLElement): Record<string, string> {
  const computed = window.getComputedStyle(element);
  const relevant = [
    'display',
    'position',
    'flex-direction',
    'justify-content',
    'align-items',
    'width',
    'height',
    'padding',
    'margin',
    'background-color',
    'color',
    'font-size',
    'font-weight',
    'border',
    'border-radius',
    'opacity',
    'visibility',
  ];
  const styles: Record<string, string> = {};
  for (const prop of relevant) {
    const val = computed.getPropertyValue(prop);
    if (val && val !== 'none' && val !== 'normal' && val !== 'auto' && val !== '0px') {
      styles[prop] = val;
    }
  }
  return styles;
}

async function getElementInfo(el: HTMLElement): Promise<ElementInfo> {
  const selector = getUniqueSelector(el);
  const reactInfo = await getReactInfoFromBackground(selector);

  const testId = el.getAttribute('data-testid') || el.getAttribute('data-test-id');
  const allClasses = el.className && typeof el.className === 'string' ? el.className.split(/\s+/).filter(Boolean) : [];
  const allAttributes = getAllAttributes(el);
  const computedStyles = getRelevantStyles(el);
  const parentChain = getParentChain(el);
  const siblingIndex = el.parentElement ? Array.from(el.parentElement.children).indexOf(el) : 0;

  return {
    selector: getFullDomPath(el),
    meta: {
      tag: el.tagName.toLowerCase(),
      text: (el.innerText || '').trim().slice(0, 200),
      innerHTML: el.innerHTML.slice(0, 500),
      componentName: reactInfo.componentName || undefined,
      displayName: reactInfo.componentName || undefined,
      componentHierarchy: reactInfo.componentHierarchy,
      fullReactTree: reactInfo.fullReactTree,
      testId: testId || undefined,
      allClasses: allClasses.length > 0 ? allClasses : undefined,
      allAttributes: Object.keys(allAttributes).length > 0 ? allAttributes : undefined,
      computedStyles: Object.keys(computedStyles).length > 0 ? computedStyles : undefined,
      domPath: getFullDomPath(el),
      parentChain: parentChain.length > 0 ? parentChain : undefined,
      siblingIndex,
      childCount: el.children.length,
      sourceFile: reactInfo.sourceFile || undefined,
      sourceLine: reactInfo.sourceLine || undefined,
      sourceColumn: reactInfo.sourceColumn || undefined,
      componentStack: reactInfo.componentStack,
      props: reactInfo.props || undefined,
    },
  };
}

function formatSourcePath(fileName: string): string {
  const parts = fileName.split('/');
  const srcIndex = parts.findIndex((p) => p === 'src' || p === 'app' || p === 'components' || p === 'pages');
  if (srcIndex >= 0) {
    return parts.slice(srcIndex).join('/');
  }
  return parts.slice(-3).join('/');
}

async function updateOverlay(element: HTMLElement) {
  if (!overlay || !tooltip) return;

  const rect = element.getBoundingClientRect();

  overlay.style.left = `${rect.left}px`;
  overlay.style.top = `${rect.top}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;
  overlay.style.display = 'block';

  const tag = element.tagName.toLowerCase();
  const width = Math.round(rect.width);
  const height = Math.round(rect.height);

  let html = `<span style="color: #93c5fd;">&lt;${tag}&gt;</span>`;
  html += `<span style="color: #6b7280; margin-left: 8px;">${width} × ${height}</span>`;
  html += `<span style="color: #4b5563; margin-left: 6px; font-size: 10px;">...</span>`;

  tooltip.innerHTML = html;
  tooltip.style.display = 'block';
  positionTooltip(rect);

  const selector = getUniqueSelector(element);
  currentSelector = selector;
  cachedReactInfo = await getReactInfoFromBackground(selector);

  if (hoveredElement !== element || currentSelector !== selector) return;

  html = '';
  if (cachedReactInfo.componentName) {
    html += `<span style="color: #a78bfa; font-weight: 500;">${cachedReactInfo.componentName}</span>`;
    html += ` <span style="color: #6b7280;">&lt;${tag}&gt;</span>`;
  } else {
    html += `<span style="color: #93c5fd;">&lt;${tag}&gt;</span>`;
  }

  html += `<span style="color: #6b7280; margin-left: 8px;">${width} × ${height}</span>`;

  if (cachedReactInfo.sourceFile) {
    html += `<div style="color: #4ade80; margin-top: 4px; font-size: 10px; opacity: 0.9;">`;
    html += `${formatSourcePath(cachedReactInfo.sourceFile)}`;
    if (cachedReactInfo.sourceLine) {
      html += `:${cachedReactInfo.sourceLine}`;
    }
    html += `</div>`;
  }

  tooltip.innerHTML = html;
  positionTooltip(rect);
}

function positionTooltip(elementRect: DOMRect) {
  if (!tooltip) return;

  let tooltipX = elementRect.left;
  let tooltipY = elementRect.top - tooltip.offsetHeight - 8;

  if (tooltipY < 4) {
    tooltipY = elementRect.bottom + 8;
  }

  if (tooltipX < 4) {
    tooltipX = 4;
  }

  const tooltipRect = tooltip.getBoundingClientRect();
  if (tooltipX + tooltipRect.width > window.innerWidth - 4) {
    tooltipX = window.innerWidth - tooltipRect.width - 4;
  }

  tooltip.style.left = `${tooltipX}px`;
  tooltip.style.top = `${tooltipY}px`;
}

function hideOverlay() {
  if (overlay) {
    overlay.style.display = 'none';
  }
  if (tooltip) {
    tooltip.style.display = 'none';
  }
}

function isOurElement(el: Element | null): boolean {
  if (!el) return false;
  return el.id === 'element-agent-overlay' || el.id === 'element-agent-tooltip';
}

function handleMouseMove(e: MouseEvent) {
  if (!pickerActive) return;

  const target = e.target as HTMLElement;
  if (isOurElement(target)) return;

  if (hoveredElement !== target) {
    hoveredElement = target;
    cachedReactInfo = null;
    updateOverlay(target);
  }
}

function handleMouseOver(e: MouseEvent) {
  if (!pickerActive) return;
  const target = e.target as HTMLElement;
  if (isOurElement(target)) return;
  if (hoveredElement !== target) {
    hoveredElement = target;
    cachedReactInfo = null;
    updateOverlay(target);
  }
}

async function handleClick(e: MouseEvent) {
  if (!pickerActive) return;

  const target = e.target as HTMLElement;
  if (isOurElement(target)) return;

  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();

  hideOverlay();
  removeOverlayElements();

  const info = await getElementInfo(target);
  chrome.runtime.sendMessage({ type: 'ELEMENT_PICKED', payload: info });
  stopPicker();
}

function handleKeyDown(e: KeyboardEvent) {
  if (pickerActive && e.key === 'Escape') {
    stopPicker();
    chrome.runtime.sendMessage({ type: 'PICKER_CANCELLED' });
  }
}

function handleScroll() {
  if (pickerActive && hoveredElement) {
    const rect = hoveredElement.getBoundingClientRect();
    if (overlay) {
      overlay.style.left = `${rect.left}px`;
      overlay.style.top = `${rect.top}px`;
      overlay.style.width = `${rect.width}px`;
      overlay.style.height = `${rect.height}px`;
    }
    if (tooltip) {
      positionTooltip(rect);
    }
  }
}

function startPicker() {
  pickerActive = true;
  createOverlayElements();

  document.addEventListener('mousemove', handleMouseMove, true);
  document.addEventListener('mouseover', handleMouseOver, true);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('keydown', handleKeyDown, true);
  window.addEventListener('scroll', handleScroll, true);
  window.addEventListener('resize', handleScroll, true);

  document.body.style.cursor = 'crosshair';
}

function stopPicker() {
  pickerActive = false;
  hoveredElement = null;
  cachedReactInfo = null;
  currentSelector = null;
  hideOverlay();

  document.removeEventListener('mousemove', handleMouseMove, true);
  document.removeEventListener('mouseover', handleMouseOver, true);
  document.removeEventListener('click', handleClick, true);
  document.removeEventListener('keydown', handleKeyDown, true);
  window.removeEventListener('scroll', handleScroll, true);
  window.removeEventListener('resize', handleScroll, true);

  document.body.style.cursor = '';

  setTimeout(() => {
    if (!pickerActive) {
      removeOverlayElements();
    }
  }, 500);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'START_PICKER') {
    startPicker();
    sendResponse({ ok: true });
  } else if (msg.type === 'STOP_PICKER') {
    stopPicker();
    sendResponse({ ok: true });
  } else if (msg.type === 'HIGHLIGHT') {
    (async () => {
      try {
        const element = document.querySelector(msg.selector);
        if (element instanceof HTMLElement) {
          createOverlayElements();
          if (overlay) {
            const rect = element.getBoundingClientRect();
            overlay.style.left = `${rect.left}px`;
            overlay.style.top = `${rect.top}px`;
            overlay.style.width = `${rect.width}px`;
            overlay.style.height = `${rect.height}px`;
            overlay.style.borderColor = '#22c55e';
            overlay.style.background = 'rgba(34, 197, 94, 0.15)';
            overlay.style.display = 'block';
            setTimeout(() => {
              hideOverlay();
              removeOverlayElements();
            }, 2000);
          }
        }
      } catch {
        /* ignore */
      }
    })();
    sendResponse({ ok: true });
  }
  return true;
});
