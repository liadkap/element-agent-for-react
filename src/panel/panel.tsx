import { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';

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
  displayName?: string;
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
}

interface Fix {
  id: string;
  selector: string;
  meta: ElementMeta;
  request: string;
  confirmed: boolean;
}

type AgentProvider = 'cursor' | 'cloudCode';

interface Settings {
  cursorApiKey: string;
  cloudCodeApiKey: string;
  repositoryUrl: string;
  baseBranch: string;
  autoCreatePr: boolean;
  preferredProvider: AgentProvider;
  prTitleFormat: string;
}

interface PRInfo {
  title: string;
  ticketUrl: string;
}

type View = 'main' | 'settings' | 'preview';
type SendStatus = 'idle' | 'sending' | 'success' | 'error';

const styles = {
  container: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    background: '#1e1e1e',
    color: '#e0e0e0',
    minHeight: '100vh',
    fontSize: 13,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid #333',
    background: '#252526',
  },
  title: {
    margin: 0,
    fontSize: 14,
    fontWeight: 600,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    background: 'transparent',
    border: 'none',
    color: '#888',
    cursor: 'pointer',
    padding: 6,
    borderRadius: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s',
  },
  toolbar: {
    display: 'flex',
    gap: 8,
    padding: '12px 16px',
    borderBottom: '1px solid #333',
    background: '#252526',
    flexWrap: 'wrap' as const,
  },
  pickerBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    background: '#0e639c',
    color: 'white',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 500,
    transition: 'all 0.15s',
  },
  pickerBtnActive: {
    background: '#d97706',
  },
  pageInfo: {
    padding: '8px 16px',
    background: '#2d2d2d',
    fontSize: 11,
    color: '#888',
    borderBottom: '1px solid #333',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  section: {
    padding: '12px 16px',
    borderBottom: '1px solid #333',
  },
  sectionTitle: {
    fontSize: 11,
    color: '#888',
    marginBottom: 8,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  content: {
    padding: 16,
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: '40px 20px',
    color: '#666',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
    opacity: 0.3,
  },
  fixCard: {
    background: '#2d2d2d',
    borderRadius: 6,
    marginBottom: 12,
    overflow: 'hidden',
    border: '1px solid #3c3c3c',
  },
  fixHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '10px 12px',
    borderBottom: '1px solid #3c3c3c',
    background: '#333',
  },
  componentName: {
    color: '#c586c0',
    fontWeight: 600,
    fontSize: 13,
  },
  componentHierarchy: {
    color: '#888',
    fontSize: 10,
    marginTop: 2,
    fontFamily: 'monospace',
  },
  tagName: {
    color: '#4ec9b0',
    fontSize: 12,
  },
  textPreview: {
    color: '#ce9178',
    fontSize: 11,
    marginTop: 2,
  },
  metaRow: {
    fontSize: 10,
    marginTop: 3,
    fontFamily: 'monospace',
    color: '#9cdcfe',
  },
  selector: {
    padding: '6px 12px',
    background: '#252526',
    fontSize: 10,
    color: '#6a9955',
    fontFamily: 'monospace',
    wordBreak: 'break-all' as const,
    borderBottom: '1px solid #3c3c3c',
  },
  classesRow: {
    padding: '6px 12px',
    background: '#1e1e1e',
    fontSize: 10,
    color: '#dcdcaa',
    fontFamily: 'monospace',
    wordBreak: 'break-all' as const,
    borderBottom: '1px solid #3c3c3c',
    maxHeight: 60,
    overflow: 'auto',
  },
  textarea: {
    width: '100%',
    padding: 10,
    border: 'none',
    background: '#1e1e1e',
    color: '#e0e0e0',
    fontSize: 12,
    resize: 'vertical' as const,
    minHeight: 60,
    boxSizing: 'border-box' as const,
    outline: 'none',
  },
  removeBtn: {
    background: 'transparent',
    border: 'none',
    color: '#666',
    cursor: 'pointer',
    padding: 4,
    fontSize: 16,
    lineHeight: 1,
  },
  footer: {
    position: 'fixed' as const,
    bottom: 0,
    left: 0,
    right: 0,
    padding: '12px 16px',
    background: '#252526',
    borderTop: '1px solid #333',
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap' as const,
  },
  submitBtn: {
    flex: 1,
    padding: '10px 16px',
    background: '#0e639c',
    color: 'white',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
    minWidth: 100,
  },
  submitBtnDisabled: {
    background: '#3c3c3c',
    color: '#666',
    cursor: 'not-allowed',
  },
  sendBtn: {
    flex: 1,
    padding: '10px 16px',
    background: '#059669',
    color: 'white',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
    minWidth: 100,
  },
  previewBtn: {
    padding: '10px 16px',
    background: '#3c3c3c',
    color: '#e0e0e0',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 13,
  },
  settingsPanel: {
    padding: 20,
    paddingBottom: 100,
  },
  settingsSection: {
    marginBottom: 24,
  },
  settingsSectionTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: '#888',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottom: '1px solid #3c3c3c',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    display: 'block',
    marginBottom: 6,
    fontSize: 12,
    color: '#ccc',
  },
  labelOptional: {
    color: '#666',
    fontWeight: 400,
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    background: '#3c3c3c',
    border: '1px solid #555',
    borderRadius: 4,
    color: '#e0e0e0',
    fontSize: 13,
    boxSizing: 'border-box' as const,
    outline: 'none',
  },
  inputSmall: {
    padding: '8px 10px',
    fontSize: 12,
  },
  helpText: {
    marginTop: 6,
    fontSize: 11,
    color: '#888',
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer',
  },
  previewPanel: {
    padding: 16,
    paddingBottom: 100,
  },
  previewBox: {
    background: '#2d2d2d',
    borderRadius: 6,
    padding: 16,
    fontFamily: 'monospace',
    fontSize: 10,
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap' as const,
    color: '#d4d4d4',
    maxHeight: 'calc(100vh - 200px)',
    overflow: 'auto',
  },
  toast: {
    position: 'fixed' as const,
    bottom: 80,
    left: 16,
    right: 16,
    padding: 12,
    borderRadius: 6,
    fontSize: 13,
    textAlign: 'center' as const,
    zIndex: 100,
  },
  toastSuccess: {
    background: '#2d4a3e',
    color: '#4ade80',
  },
  toastError: {
    background: '#4a2d2d',
    color: '#f87171',
  },
  badge: {
    display: 'inline-block',
    padding: '2px 6px',
    borderRadius: 3,
    fontSize: 10,
    marginLeft: 6,
    background: '#3c3c3c',
    color: '#aaa',
  },
  warningBox: {
    background: '#4a3c00',
    border: '1px solid #6b5900',
    borderRadius: 4,
    padding: 12,
    marginBottom: 16,
    fontSize: 12,
    color: '#fcd34d',
  },
  sourceFile: {
    fontSize: 10,
    marginTop: 4,
    fontFamily: 'monospace',
    color: '#60a5fa',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  propsRow: {
    padding: '6px 12px',
    background: '#1a1a2e',
    fontSize: 10,
    color: '#a78bfa',
    fontFamily: 'monospace',
    wordBreak: 'break-all' as const,
    borderBottom: '1px solid #3c3c3c',
    maxHeight: 60,
    overflow: 'auto',
  },
  fixCardCompact: {
    background: '#2d2d2d',
    borderRadius: 6,
    marginBottom: 8,
    border: '1px solid #3c3c3c',
    overflow: 'hidden',
    transition: 'border-color 0.15s',
  },
  fixCardCompactHover: {
    borderColor: '#7b61ff',
  },
  fixCardBody: {
    padding: '10px 12px',
    cursor: 'pointer',
  },
  fixCardEditing: {
    padding: '10px 12px',
    borderTop: '1px solid #3c3c3c',
    background: '#252526',
  },
  requestDisplay: {
    marginTop: 8,
    padding: '8px 10px',
    background: '#1e1e1e',
    borderRadius: 4,
    fontSize: 12,
    color: '#d4d4d4',
    lineHeight: 1.4,
  },
  confirmBtn: {
    padding: '6px 12px',
    background: '#059669',
    color: 'white',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 500,
    marginRight: 8,
  },
  editBtn: {
    padding: '4px 8px',
    background: 'transparent',
    color: '#888',
    border: '1px solid #555',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 11,
  },
  inputRow: {
    display: 'flex',
    gap: 8,
    marginTop: 8,
  },
  inputFlex: {
    flex: 1,
    padding: '8px 10px',
    background: '#3c3c3c',
    border: '1px solid #555',
    borderRadius: 4,
    color: '#e0e0e0',
    fontSize: 12,
    outline: 'none',
    resize: 'none' as const,
  },
  tooltipContainer: {
    position: 'relative' as const,
    display: 'inline-flex',
    alignItems: 'center',
  },
  infoIconBtn: {
    background: 'transparent',
    border: 'none',
    color: '#888',
    cursor: 'help',
    padding: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  tooltip: {
    position: 'absolute' as const,
    bottom: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#1e1e1e',
    border: '1px solid #555',
    borderRadius: 6,
    padding: '10px 12px',
    fontSize: 11,
    color: '#e0e0e0',
    whiteSpace: 'nowrap' as const,
    zIndex: 1000,
    marginBottom: 8,
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
    lineHeight: 1.5,
  },
  tooltipArrow: {
    position: 'absolute' as const,
    top: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 0,
    height: 0,
    borderLeft: '6px solid transparent',
    borderRight: '6px solid transparent',
    borderTop: '6px solid #555',
  },
};

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

function SettingsIcon() {
  return (
    <svg width='16' height='16' viewBox='0 0 16 16' fill='currentColor'>
      <path d='M9.1 4.4L8.6 2H7.4l-.5 2.4-.7.3-2-1.3-.9.8 1.3 2-.2.7-2.4.5v1.2l2.4.5.3.8-1.3 2 .8.8 2-1.3.8.3.4 2.3h1.2l.5-2.4.8-.3 2 1.3.8-.8-1.3-2 .3-.8 2.3-.4V7.4l-2.4-.5-.3-.8 1.3-2-.8-.8-2 1.3-.7-.2zM9.4 1l.5 2.4L12 2.1l2 2-1.4 2.1 2.4.4v2.8l-2.4.5L14 12l-2 2-2.1-1.4-.5 2.4H6.6l-.5-2.4L4 13.9l-2-2 1.4-2.1L1 9.4V6.6l2.4-.5L2.1 4l2-2 2.1 1.4.4-2.4h2.8zm.6 7c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zM8 9c.6 0 1-.4 1-1s-.4-1-1-1-1 .4-1 1 .4 1 1 1z' />
    </svg>
  );
}

function PickerIcon() {
  return (
    <svg width='14' height='14' viewBox='0 0 16 16' fill='currentColor'>
      <path d='M14 1H9v1h3.3L7.5 6.8l.7.7L13 2.7V6h1V1zM2 13.3V10H1v5h5v-1H2.7l4.8-4.8-.7-.7L2 13.3z' />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width='16' height='16' viewBox='0 0 16 16' fill='currentColor'>
      <path d='M5.9 7.5L10.4 3l.7.7L7.3 7.5l3.8 3.8-.7.7-4.5-4.5z' />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width='14' height='14' viewBox='0 0 16 16' fill='currentColor'>
      <path d='M8 1C4.13 1 1 4.13 1 8s3.13 7 7 7 7-3.13 7-7-3.13-7-7-7zm0 13c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z' />
      <path d='M7 6h2v6H7V6zm0-3h2v2H7V3z' />
    </svg>
  );
}

const ELEMENT_CAPTURE_SCRIPT = `(() => {
  const el = $0;
  if (!el) return null;

  function getFullDomPath(node) {
    const parts = [];
    let current = node;
    while (current && current !== document.body && parts.length < 15) {
      let part = current.nodeName.toLowerCase();
      const id = current.getAttribute?.("id");
      const testId = current.getAttribute?.("data-testid") || current.getAttribute?.("data-test-id");
      const classes = current.className && typeof current.className === "string" ? current.className.split(/\\s+/).filter(Boolean) : [];
      
      if (id) part += "#" + id;
      else if (testId) part += "[data-testid='" + testId + "']";
      else if (classes.length > 0) part += "." + classes.slice(0, 2).join(".");
      
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(c => c.nodeName === current.nodeName);
        if (siblings.length > 1) {
          const idx = siblings.indexOf(current) + 1;
          part += ":nth-of-type(" + idx + ")";
        }
      }
      parts.unshift(part);
      current = current.parentElement;
    }
    return parts.join(" > ");
  }

  function getParentChain(node, maxDepth = 8) {
    const chain = [];
    let current = node.parentElement;
    let depth = 0;
    while (current && current !== document.body && depth < maxDepth) {
      const id = current.getAttribute?.("id");
      const testId = current.getAttribute?.("data-testid") || current.getAttribute?.("data-test-id");
      const classes = current.className && typeof current.className === "string" ? current.className.split(/\\s+/).filter(Boolean) : [];
      chain.push({
        tag: current.nodeName.toLowerCase(),
        id: id || undefined,
        classes: classes.length > 0 ? classes : undefined,
        testId: testId || undefined
      });
      current = current.parentElement;
      depth++;
    }
    return chain;
  }

  function getReactFiber(element) {
    for (const key in element) {
      if (key.startsWith("__reactFiber$") || key.startsWith("__reactInternalInstance$")) {
        return element[key];
      }
    }
    return null;
  }

  function getDebugSource(fiber) {
    const source = fiber._debugSource;
    if (source && source.fileName) {
      return { fileName: source.fileName, lineNumber: source.lineNumber || 0, columnNumber: source.columnNumber };
    }
    return null;
  }

  function getComponentDisplayName(fiber) {
    if (!fiber.type) return null;
    if (typeof fiber.type === "function") return fiber.type.displayName || fiber.type.name || null;
    if (typeof fiber.type === "object") {
      if (fiber.type.displayName) return fiber.type.displayName;
      if (fiber.type.render) return fiber.type.render.displayName || fiber.type.render.name || null;
    }
    if (typeof fiber.type === "string") return fiber.type;
    return null;
  }

  function getSafeProps(fiber) {
    const props = fiber.memoizedProps;
    if (!props) return undefined;
    const safe = {};
    const skip = ["children", "ref", "key", "__self", "__source"];
    for (const [k, v] of Object.entries(props)) {
      if (skip.includes(k)) continue;
      if (typeof v === "function") safe[k] = "[Function]";
      else if (typeof v === "object" && v !== null) {
        if (Array.isArray(v)) safe[k] = "[Array(" + v.length + ")]";
        else safe[k] = "[Object]";
      } else if (typeof v === "string" && v.length > 100) safe[k] = v.slice(0, 100) + "...";
      else safe[k] = v;
    }
    return Object.keys(safe).length > 0 ? safe : undefined;
  }

  function getFullReactTreeWithSources(element, maxDepth = 30) {
    const tree = [];
    let fiber = getReactFiber(element);
    
    if (!fiber) {
      let parent = element.parentElement;
      let attempts = 0;
      while (parent && !fiber && attempts < 10) {
        fiber = getReactFiber(parent);
        parent = parent.parentElement;
        attempts++;
      }
    }
    
    if (!fiber) {
      console.log("[ElementAgent] No React fiber found for element or parents");
      return tree;
    }
    
    let depth = 0;
    while (fiber && depth < maxDepth) {
      const name = getComponentDisplayName(fiber);
      if (name && !name.startsWith("_") && name !== "Fragment") {
        const source = getDebugSource(fiber);
        const props = depth < 5 ? getSafeProps(fiber) : undefined;
        tree.push({ name, source: source || undefined, props });
      }
      fiber = fiber.return;
      depth++;
    }
    return tree;
  }

  function getAllAttributes(element) {
    const attrs = {};
    for (const attr of element.attributes || []) {
      if (!attr.name.startsWith("__react")) {
        attrs[attr.name] = attr.value.slice(0, 200);
      }
    }
    return attrs;
  }

  function getRelevantStyles(element) {
    const computed = window.getComputedStyle(element);
    const relevant = [
      "display", "position", "flex-direction", "justify-content", "align-items",
      "width", "height", "padding", "margin", "background-color", "color",
      "font-size", "font-weight", "border", "border-radius", "opacity", "visibility"
    ];
    const styles = {};
    for (const prop of relevant) {
      const val = computed.getPropertyValue(prop);
      if (val && val !== "none" && val !== "normal" && val !== "auto" && val !== "0px") {
        styles[prop] = val;
      }
    }
    return styles;
  }

  const reactTreeWithSources = getFullReactTreeWithSources(el);
  const componentHierarchy = reactTreeWithSources.filter(c => /^[A-Z]/.test(c.name)).map(c => c.name);
  const fullReactTree = reactTreeWithSources.map(c => c.name);
  
  const firstComponent = reactTreeWithSources.find(c => /^[A-Z]/.test(c.name));
  const componentName = firstComponent?.name || null;
  const sourceFile = firstComponent?.source?.fileName;
  const sourceLine = firstComponent?.source?.lineNumber;
  const sourceColumn = firstComponent?.source?.columnNumber;
  const props = firstComponent?.props;
  
  const componentStack = reactTreeWithSources
    .filter(c => /^[A-Z]/.test(c.name))
    .slice(0, 10)
    .map(c => ({ name: c.name, source: c.source }));

  const testId = el.getAttribute("data-testid") || el.getAttribute("data-test-id");
  const allClasses = el.className && typeof el.className === "string" ? el.className.split(/\\s+/).filter(Boolean) : [];
  const allAttributes = getAllAttributes(el);
  const computedStyles = getRelevantStyles(el);
  const parentChain = getParentChain(el);
  const siblingIndex = el.parentElement ? Array.from(el.parentElement.children).indexOf(el) : 0;

  el.style.outline = "3px solid #0e639c";
  el.style.outlineOffset = "2px";
  setTimeout(() => {
    el.style.outline = "";
    el.style.outlineOffset = "";
  }, 2000);

  return {
    selector: getFullDomPath(el),
    meta: {
      tag: el.tagName.toLowerCase(),
      text: (el.innerText || "").trim().slice(0, 200),
      innerHTML: el.innerHTML.slice(0, 500),
      componentName: componentName || undefined,
      displayName: componentName || undefined,
      componentHierarchy: componentHierarchy.length > 0 ? componentHierarchy : undefined,
      fullReactTree: fullReactTree.length > 0 ? fullReactTree : undefined,
      testId: testId || undefined,
      allClasses: allClasses.length > 0 ? allClasses : undefined,
      allAttributes: Object.keys(allAttributes).length > 0 ? allAttributes : undefined,
      computedStyles: Object.keys(computedStyles).length > 0 ? computedStyles : undefined,
      domPath: getFullDomPath(el),
      parentChain: parentChain.length > 0 ? parentChain : undefined,
      siblingIndex,
      childCount: el.children.length,
      sourceFile: sourceFile || undefined,
      sourceLine: sourceLine || undefined,
      sourceColumn: sourceColumn || undefined,
      componentStack: componentStack.length > 0 ? componentStack : undefined,
      props: props || undefined
    }
  };
})()`;

function App() {
  const [fixes, setFixes] = useState<Fix[]>([]);
  const [view, setView] = useState<View>('main');
  const [pageUrl, setPageUrl] = useState('');
  const [pickerActive, setPickerActive] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    cursorApiKey: '',
    cloudCodeApiKey: '',
    repositoryUrl: '',
    baseBranch: 'main',
    autoCreatePr: true,
    preferredProvider: 'cursor',
    prTitleFormat: '[ElementAgent] {title}',
  });
  const [prInfo, setPrInfo] = useState<PRInfo>({ title: '', ticketUrl: '' });
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [port, setPort] = useState<chrome.runtime.Port | null>(null);
  const [sendStatus, setSendStatus] = useState<SendStatus>('idle');
  const [agentUrl, setAgentUrl] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  }, []);

  useEffect(() => {
    chrome.devtools.inspectedWindow.eval('location.href', (url) => {
      if (typeof url === 'string') setPageUrl(url);
    });

    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response?.settings) {
        setSettings((prev) => ({ ...prev, ...response.settings }));
      }
    });
  }, []);

  useEffect(() => {
    const tabId = chrome.devtools.inspectedWindow.tabId;
    let currentPort: chrome.runtime.Port | null = null;
    let isCleaningUp = false;

    const messageHandler = (msg: { type: string; payload?: { selector: string; meta: ElementMeta }; error?: string }) => {
      try {
        if (msg.type === 'ELEMENT_PICKED' && msg.payload) {
          const newId = generateId();
          setFixes((prev) => [...prev, { id: newId, ...msg.payload!, request: '', confirmed: false }]);
          setEditingId(newId);
          setPickerActive(false);
        } else if (msg.type === 'PICKER_CANCELLED') {
          setPickerActive(false);
        } else if (msg.type === 'ERROR' && msg.error) {
          setPickerActive(false);
          showToast('error', msg.error);
        }
      } catch (e) {
        console.error('[ElementAgent] Error handling message:', e);
      }
    };

    const connectPort = () => {
      if (isCleaningUp) return;
      
      try {
        currentPort = chrome.runtime.connect({ name: `devtools-${tabId}` });
        setPort(currentPort);

        currentPort.onMessage.addListener(messageHandler);

        currentPort.onDisconnect.addListener(() => {
          setPort(null);
          currentPort = null;
          if (!isCleaningUp) {
            setTimeout(connectPort, 100);
          }
        });
      } catch (e) {
        console.error('[ElementAgent] Failed to connect port:', e);
        if (!isCleaningUp) {
          setTimeout(connectPort, 500);
        }
      }
    };

    connectPort();

    return () => {
      isCleaningUp = true;
      try {
        if (currentPort) {
          currentPort.disconnect();
        }
      } catch {
        // Port may already be disconnected
      }
    };
  }, [showToast]);

  const togglePicker = useCallback(() => {
    if (!port) {
      showToast('error', 'Extension not ready. Try refreshing.');
      return;
    }

    try {
      if (pickerActive) {
        port.postMessage({ type: 'STOP_PICKER' });
        setPickerActive(false);
      } else {
        port.postMessage({ type: 'START_PICKER' });
        setPickerActive(true);
      }
    } catch (e) {
      showToast('error', 'Connection lost. Please refresh the page.');
      setPort(null);
      setPickerActive(false);
    }
  }, [pickerActive, port, showToast]);

  const captureFromDevtools = useCallback(() => {
    chrome.devtools.inspectedWindow.eval(ELEMENT_CAPTURE_SCRIPT, (res: { selector: string; meta: ElementMeta } | null, err) => {
      if (err || !res) {
        showToast('error', 'Select an element in the Elements panel first');
        return;
      }
      const newId = generateId();
      setFixes((prev) => [...prev, { id: newId, ...res, request: '', confirmed: false }]);
      setEditingId(newId);
      showToast('success', 'Element captured!');
    });
  }, [showToast]);

  const setRequest = useCallback((id: string, request: string) => {
    setFixes((prev) => prev.map((f) => (f.id === id ? { ...f, request } : f)));
  }, []);

  const removeFix = useCallback(
    (id: string) => {
      setFixes((prev) => prev.filter((f) => f.id !== id));
      if (editingId === id) setEditingId(null);
    },
    [editingId],
  );

  const confirmFix = useCallback((id: string) => {
    setFixes((prev) => prev.map((f) => (f.id === id ? { ...f, confirmed: true } : f)));
    setEditingId(null);
  }, []);

  const startEditing = useCallback((id: string) => {
    setEditingId(id);
    setFixes((prev) => prev.map((f) => (f.id === id ? { ...f, confirmed: false } : f)));
  }, []);

  const highlightElement = useCallback((selector: string) => {
    chrome.devtools.inspectedWindow.eval(
      `(function() {
        const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
        if (!el) return;
        const rect = el.getBoundingClientRect();
        let overlay = document.getElementById('element-agent-hover-overlay');
        if (!overlay) {
          overlay = document.createElement('div');
          overlay.id = 'element-agent-hover-overlay';
          overlay.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483646;border:2px solid #7b61ff;background:rgba(123,97,255,0.1);transition:all 0.1s ease-out;';
          document.body.appendChild(overlay);
        }
        overlay.style.left = rect.left + 'px';
        overlay.style.top = rect.top + 'px';
        overlay.style.width = rect.width + 'px';
        overlay.style.height = rect.height + 'px';
        overlay.style.display = 'block';
      })()`,
    );
  }, []);

  const removeHighlight = useCallback(() => {
    chrome.devtools.inspectedWindow.eval(
      `(function() {
        const overlay = document.getElementById('element-agent-hover-overlay');
        if (overlay) overlay.style.display = 'none';
      })()`,
    );
  }, []);

  const generatePrompt = useCallback((): string => {
    const validFixes = fixes.filter((f) => f.confirmed && f.request.trim());
    if (validFixes.length === 0) return '';

    const fixDescriptions = validFixes
      .map((f, i) => {
        const lines: string[] = [];

        lines.push(`## Element ${i + 1}`);
        lines.push('');

        lines.push('### Identification');
        if (f.meta.componentName) {
          lines.push(`- **React Component:** \`${f.meta.componentName}\``);
        }
        if (f.meta.sourceFile) {
          lines.push(
            `- **Source File:** \`${f.meta.sourceFile}\`${f.meta.sourceLine ? `:${f.meta.sourceLine}` : ''}${f.meta.sourceColumn ? `:${f.meta.sourceColumn}` : ''}`,
          );
        }
        if (f.meta.componentHierarchy && f.meta.componentHierarchy.length > 1) {
          lines.push(`- **Component Hierarchy:** \`${f.meta.componentHierarchy.join(' → ')}\``);
        }
        if (f.meta.componentStack && f.meta.componentStack.length > 0) {
          lines.push('');
          lines.push('**Component Stack with Source Files:**');
          f.meta.componentStack.forEach((c) => {
            if (c.source) {
              lines.push(`- \`${c.name}\` → \`${c.source.fileName}:${c.source.lineNumber}\``);
            } else {
              lines.push(`- \`${c.name}\``);
            }
          });
        }
        if (f.meta.fullReactTree && f.meta.fullReactTree.length > 0) {
          lines.push(`- **Full React Tree:** \`${f.meta.fullReactTree.join(' > ')}\``);
        }
        if (f.meta.testId) {
          lines.push(`- **data-testid:** \`"${f.meta.testId}"\``);
        }
        if (f.meta.props && Object.keys(f.meta.props).length > 0) {
          lines.push('');
          lines.push('### Component Props');
          lines.push('```json');
          lines.push(JSON.stringify(f.meta.props, null, 2));
          lines.push('```');
        }

        lines.push('');
        lines.push('### DOM Information');
        lines.push(`- **Tag:** \`<${f.meta.tag}>\``);
        lines.push(`- **DOM Path:** \`${f.meta.domPath || f.selector}\``);
        if (f.meta.siblingIndex !== undefined) {
          lines.push(`- **Sibling Index:** ${f.meta.siblingIndex}`);
        }
        if (f.meta.childCount !== undefined) {
          lines.push(`- **Child Count:** ${f.meta.childCount}`);
        }

        if (f.meta.parentChain && f.meta.parentChain.length > 0) {
          lines.push('');
          lines.push('### Parent Chain (innermost to outermost)');
          f.meta.parentChain.forEach((p, idx) => {
            let desc = `\`<${p.tag}>\``;
            if (p.id) desc += ` id="${p.id}"`;
            if (p.testId) desc += ` data-testid="${p.testId}"`;
            if (p.classes && p.classes.length > 0) desc += ` class="${p.classes.join(' ')}"`;
            lines.push(`${idx + 1}. ${desc}`);
          });
        }

        if (f.meta.allClasses && f.meta.allClasses.length > 0) {
          lines.push('');
          lines.push('### CSS Classes');
          lines.push('```');
          lines.push(f.meta.allClasses.join(' '));
          lines.push('```');
        }

        if (f.meta.allAttributes && Object.keys(f.meta.allAttributes).length > 0) {
          lines.push('');
          lines.push('### All Attributes');
          lines.push('```json');
          lines.push(JSON.stringify(f.meta.allAttributes, null, 2));
          lines.push('```');
        }

        if (f.meta.computedStyles && Object.keys(f.meta.computedStyles).length > 0) {
          lines.push('');
          lines.push('### Computed Styles');
          lines.push('```json');
          lines.push(JSON.stringify(f.meta.computedStyles, null, 2));
          lines.push('```');
        }

        if (f.meta.text) {
          lines.push('');
          lines.push('### Visible Text Content');
          lines.push('```');
          lines.push(f.meta.text.slice(0, 150));
          lines.push('```');
        }

        if (f.meta.innerHTML) {
          lines.push('');
          lines.push('### Inner HTML (truncated)');
          lines.push('```html');
          lines.push(f.meta.innerHTML.slice(0, 300));
          lines.push('```');
        }

        lines.push('');
        lines.push('### Requested Change');
        lines.push(f.request);

        return lines.join('\n');
      })
      .join('\n\n---\n\n');

    const formattedPrTitle = prInfo.title && settings.prTitleFormat
      ? settings.prTitleFormat.replace('{title}', prInfo.title)
      : prInfo.title;

    const prSection =
      prInfo.title || prInfo.ticketUrl
        ? `
## Pull Request
${formattedPrTitle ? `- **Title:** ${formattedPrTitle}` : ''}
${prInfo.ticketUrl ? `- **Ticket:** ${prInfo.ticketUrl}` : ''}
`
        : '';

    return `# ElementAgent Request
${prSection}
## Context
- **Page URL:** ${pageUrl}
- **Repository:** ${settings.repositoryUrl || 'Not configured'}
- **Elements to Fix:** ${validFixes.length}

## How to Find These Components

Use these search strategies in order of reliability:

1. **Search by React component name:**
   \`\`\`bash
   grep -r "function ComponentName" --include="*.tsx" --include="*.jsx"
   grep -r "const ComponentName" --include="*.tsx" --include="*.jsx"
   \`\`\`

2. **Search by data-testid:**
   \`\`\`bash
   grep -r 'data-testid="value"' --include="*.tsx" --include="*.jsx"
   \`\`\`

3. **Search by CSS classes (especially unique Tailwind classes):**
   \`\`\`bash
   grep -r "className.*specific-class" --include="*.tsx" --include="*.jsx"
   \`\`\`

4. **Search by visible text:**
   \`\`\`bash
   grep -r "visible text" --include="*.tsx" --include="*.jsx"
   \`\`\`

5. **Search by aria-label or other attributes:**
   \`\`\`bash
   grep -r 'aria-label="value"' --include="*.tsx" --include="*.jsx"
   \`\`\`

---

${fixDescriptions}

---

## Instructions

1. Use the identification info above to locate each React component
2. The Component Hierarchy shows the path from the element up to parent components
3. CSS classes can help identify Tailwind/styled-components usage
4. Apply the requested changes while maintaining existing functionality
5. **IMPORTANT: If the selected element is a repeatable item (e.g., list item, card in a grid, table row, or any item rendered in a loop/map), apply the change to the component or template that generates ALL similar items, not just one instance. Look for .map(), .forEach(), or array rendering patterns.**
6. Ensure TypeScript types are correct
7. Run \`yarn lint\` and \`yarn type-check\` after changes
${formattedPrTitle ? `8. Create PR with title: "${formattedPrTitle}"` : ''}
${prInfo.ticketUrl ? `9. Reference: ${prInfo.ticketUrl}` : ''}
`;
  }, [fixes, pageUrl, settings.repositoryUrl, settings.prTitleFormat, prInfo]);

  const copyPrompt = useCallback(async () => {
    const prompt = generatePrompt();
    if (!prompt) {
      showToast('error', 'No changes to copy');
      return;
    }

    try {
      await navigator.clipboard.writeText(prompt);
      showToast('success', 'Copied to clipboard!');
    } catch (clipErr) {
      const textArea = document.createElement('textarea');
      textArea.value = prompt;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        showToast('success', 'Copied to clipboard!');
      } catch {
        showToast('error', 'Copy failed - check browser permissions');
      }
      document.body.removeChild(textArea);
    }
  }, [generatePrompt, showToast]);

  const sendToAgent = useCallback(async () => {
    const provider = settings.preferredProvider;
    const apiKey = provider === 'cursor' ? settings.cursorApiKey : settings.cloudCodeApiKey;
    
    if (!apiKey) {
      showToast('error', `Configure ${provider === 'cursor' ? 'Cursor' : 'Cloud Code'} API key in settings first`);
      setView('settings');
      return;
    }
    if (!settings.repositoryUrl) {
      showToast('error', 'Configure repository URL in settings first');
      setView('settings');
      return;
    }

    const prompt = generatePrompt();
    if (!prompt) {
      showToast('error', 'No changes to send');
      return;
    }

    setSendStatus('sending');
    setAgentUrl(null);

    try {
      if (provider === 'cursor') {
        const response = await fetch('https://api.cursor.com/v0/agents', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Basic ' + btoa(settings.cursorApiKey + ':'),
          },
          body: JSON.stringify({
            prompt: {
              text: prompt,
            },
            source: {
              repository: settings.repositoryUrl,
              ref: settings.baseBranch || 'main',
            },
            target: {
              autoCreatePr: settings.autoCreatePr,
              branchName: prInfo.title
                ? `element-agent/${(settings.prTitleFormat ? settings.prTitleFormat.replace('{title}', prInfo.title) : prInfo.title)
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .slice(0, 40)}`
                : `element-agent/${Date.now()}`,
            },
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API error ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        setSendStatus('success');
        setAgentUrl(data.target?.url || `https://cursor.com/agents?id=${data.id}`);
        showToast('success', 'Cursor agent launched successfully!');
      } else {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': settings.cloudCodeApiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-beta': 'interleaved-thinking-2025-05-14',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 16000,
            messages: [
              {
                role: 'user',
                content: prompt,
              },
            ],
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API error ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        setSendStatus('success');
        showToast('success', 'Cloud Code response received!');
        console.log('[Cloud Code Response]', data);
      }
    } catch (err) {
      setSendStatus('error');
      showToast('error', `Failed: ${(err as Error).message}`);
    }
  }, [settings, prInfo, generatePrompt, showToast]);

  const saveSettings = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', settings }, (response) => {
      if (response?.ok) {
        showToast('success', 'Settings saved!');
        setView('main');
      }
    });
  }, [settings, showToast]);

  const hasValidFixes = fixes.some((f) => f.confirmed && f.request.trim());
  const isConfigured = settings.preferredProvider === 'cursor' 
    ? Boolean(settings.cursorApiKey && settings.repositoryUrl)
    : Boolean(settings.cloudCodeApiKey && settings.repositoryUrl);

  if (view === 'settings') {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <button style={styles.iconBtn} onClick={() => setView('main')}>
            <BackIcon />
          </button>
          <h3 style={styles.title}>Settings</h3>
          <div style={{ width: 28 }} />
        </div>
        <div style={styles.settingsPanel}>
          <div style={styles.settingsSection}>
            <div style={styles.settingsSectionTitle}>AI Provider</div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Preferred Provider</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  style={{
                    ...styles.pickerBtn,
                    flex: 1,
                    background: settings.preferredProvider === 'cursor' ? '#0e639c' : '#3c3c3c',
                  }}
                  onClick={() => setSettings({ ...settings, preferredProvider: 'cursor', cloudCodeApiKey: '' })}
                >
                  Cursor
                </button>
                <button
                  style={{
                    ...styles.pickerBtn,
                    flex: 1,
                    background: settings.preferredProvider === 'cloudCode' ? '#0e639c' : '#3c3c3c',
                  }}
                  onClick={() => setSettings({ ...settings, preferredProvider: 'cloudCode', cursorApiKey: '' })}
                >
                  Cloud Code
                </button>
              </div>
            </div>

            <div style={styles.warningBox}>
              {settings.preferredProvider === 'cursor' ? (
                <>
                  Get your Cursor API key from{' '}
                  <a href='https://cursor.com/settings' target='_blank' rel='noreferrer' style={{ color: '#fcd34d' }}>
                    cursor.com/settings
                  </a>
                </>
              ) : (
                <>
                  Get your Cloud Code API key from{' '}
                  <a href='https://console.anthropic.com/settings/keys' target='_blank' rel='noreferrer' style={{ color: '#fcd34d' }}>
                    console.anthropic.com
                  </a>
                </>
              )}
            </div>

            {settings.preferredProvider === 'cursor' && (
              <div style={styles.inputGroup}>
                <label style={styles.label}>Cursor API Key *</label>
                <input
                  type='password'
                  style={styles.input}
                  value={settings.cursorApiKey}
                  onChange={(e) => setSettings({ ...settings, cursorApiKey: e.target.value })}
                  placeholder='cur_...'
                />
              </div>
            )}

            {settings.preferredProvider === 'cloudCode' && (
              <div style={styles.inputGroup}>
                <label style={styles.label}>Cloud Code API Key *</label>
                <input
                  type='password'
                  style={styles.input}
                  value={settings.cloudCodeApiKey}
                  onChange={(e) => setSettings({ ...settings, cloudCodeApiKey: e.target.value })}
                  placeholder='sk-ant-...'
                />
              </div>
            )}
          </div>

          <div style={styles.settingsSection}>
            <div style={styles.settingsSectionTitle}>Repository</div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Repository URL *</label>
              <input
                type='text'
                style={styles.input}
                value={settings.repositoryUrl}
                onChange={(e) => setSettings({ ...settings, repositoryUrl: e.target.value })}
                placeholder='https://github.com/your-org/your-repo'
              />
              <div style={styles.helpText}>The GitHub repository URL where changes will be made</div>
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Base Branch</label>
              <input
                type='text'
                style={styles.input}
                value={settings.baseBranch}
                onChange={(e) => setSettings({ ...settings, baseBranch: e.target.value })}
                placeholder='main'
              />
              <div style={styles.helpText}>Branch to base changes on (default: main)</div>
            </div>
          </div>

          <div style={styles.settingsSection}>
            <div style={styles.settingsSectionTitle}>Pull Request</div>
            <div style={styles.inputGroup}>
              <label style={styles.checkbox}>
                <input
                  type='checkbox'
                  checked={settings.autoCreatePr}
                  onChange={(e) => setSettings({ ...settings, autoCreatePr: e.target.checked })}
                />
                <span>Automatically create Pull Request</span>
              </label>
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>PR Title Format</label>
              <input
                type='text'
                style={styles.input}
                value={settings.prTitleFormat}
                onChange={(e) => setSettings({ ...settings, prTitleFormat: e.target.value })}
                placeholder='[ElementAgent] {title}'
              />
              <div style={styles.helpText}>Use {'{title}'} as placeholder for the PR title you enter</div>
            </div>
          </div>

          <button style={{ ...styles.submitBtn, width: '100%' }} onClick={saveSettings}>
            Save Settings
          </button>
        </div>
      </div>
    );
  }

  if (view === 'preview') {
    const prompt = generatePrompt();
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <button style={styles.iconBtn} onClick={() => setView('main')}>
            <BackIcon />
          </button>
          <h3 style={styles.title}>Preview Prompt</h3>
          <div style={{ width: 28 }} />
        </div>
        <div style={styles.previewPanel}>
          <pre style={styles.previewBox}>{prompt || 'No changes to preview'}</pre>
        </div>
        <div style={styles.footer}>
          <button style={styles.previewBtn} onClick={() => setView('main')}>
            Back
          </button>
          <button
            style={{ ...styles.submitBtn, ...(hasValidFixes ? {} : styles.submitBtnDisabled) }}
            onClick={copyPrompt}
            disabled={!hasValidFixes}
          >
            Copy
          </button>
          <button
            style={{ ...styles.sendBtn, ...(hasValidFixes ? {} : styles.submitBtnDisabled) }}
            onClick={isConfigured ? sendToAgent : () => setView('settings')}
            disabled={!hasValidFixes || sendStatus === 'sending'}
          >
            {sendStatus === 'sending' 
              ? 'Sending...' 
              : isConfigured 
                ? `Send to ${settings.preferredProvider === 'cursor' ? 'Cursor' : 'Cloud Code'}`
                : 'Configure Settings'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>
          <span style={{ color: '#0e639c' }}>⬡</span> ElementAgent for React
        </h3>
        <button style={styles.iconBtn} onClick={() => setView('settings')} title='Settings'>
          <SettingsIcon />
        </button>
      </div>

      <div style={styles.toolbar}>
        <button style={{ ...styles.pickerBtn, ...(pickerActive ? styles.pickerBtnActive : {}) }} onClick={togglePicker}>
          <PickerIcon />
          {pickerActive ? 'Click element or ESC' : 'Pick Element'}
        </button>
        <div style={styles.tooltipContainer}>
          <button style={{ ...styles.pickerBtn, background: '#3c3c3c' }} onClick={captureFromDevtools}>
            Capture from DevTools
          </button>
          <div style={styles.tooltipContainer}>
            <button
              style={styles.infoIconBtn}
              onMouseEnter={(e) => {
                const tooltip = e.currentTarget.nextElementSibling as HTMLElement;
                if (tooltip) tooltip.style.display = 'block';
              }}
              onMouseLeave={(e) => {
                const tooltip = e.currentTarget.nextElementSibling as HTMLElement;
                if (tooltip) tooltip.style.display = 'none';
              }}
            >
              <InfoIcon />
            </button>
            <div style={{ ...styles.tooltip, display: 'none' }}>
              <div>1. Go to Elements panel in DevTools</div>
              <div>2. Select an element you want to capture</div>
              <div>3. Click this button to capture it</div>
              <div style={styles.tooltipArrow} />
            </div>
          </div>
        </div>
        {fixes.length > 0 && (
          <button
            style={{ ...styles.pickerBtn, background: 'transparent', color: '#f87171', marginLeft: 'auto' }}
            onClick={() => setFixes([])}
          >
            Clear All
          </button>
        )}
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>
          PR Info <span style={{ ...styles.labelOptional, textTransform: 'none' }}>(optional)</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            style={{ ...styles.input, ...styles.inputSmall, flex: 1 }}
            value={prInfo.title}
            onChange={(e) => setPrInfo({ ...prInfo, title: e.target.value })}
            placeholder='PR Title...'
          />
          <input
            style={{ ...styles.input, ...styles.inputSmall, flex: 1 }}
            value={prInfo.ticketUrl}
            onChange={(e) => setPrInfo({ ...prInfo, ticketUrl: e.target.value })}
            placeholder='Ticket URL...'
          />
        </div>
      </div>

      <div style={styles.pageInfo}>
        <span style={{ color: '#4ec9b0' }}>●</span>
        <span style={{ color: '#aaa', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {pageUrl || 'Loading...'}
        </span>
        {fixes.length > 0 && (
          <span style={styles.badge}>
            {fixes.length} element{fixes.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {!isConfigured && (
        <div style={{ ...styles.warningBox, margin: '12px 16px' }}>
          Configure your {settings.preferredProvider === 'cursor' ? 'Cursor' : 'Cloud Code'} API key in{' '}
          <button
            onClick={() => setView('settings')}
            style={{ background: 'none', border: 'none', color: '#fcd34d', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
          >
            Settings
          </button>{' '}
          to send directly to {settings.preferredProvider === 'cursor' ? 'Cursor Cloud Agent' : 'Claude'}
        </div>
      )}

      {agentUrl && (
        <div style={{ ...styles.section, background: '#2d4a3e', borderColor: '#4ade80' }}>
          <div style={{ color: '#4ade80', fontSize: 12 }}>
            {settings.preferredProvider === 'cursor' ? (
              <>
                Agent launched!{' '}
                <a href={agentUrl} target='_blank' rel='noreferrer' style={{ color: '#4ade80' }}>
                  View in Cursor →
                </a>
              </>
            ) : (
              'Request sent to Cloud Code!'
            )}
          </div>
        </div>
      )}

      <div style={{ ...styles.content, paddingBottom: fixes.length > 0 ? 100 : 16 }}>
        {fixes.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>⬡</div>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>No elements captured</div>
            <div style={{ fontSize: 12, color: '#666', lineHeight: 1.5 }}>
              Click <strong>"Pick Element"</strong> to select elements directly on the page,
              <br />
              or select in Elements panel and click <strong>"Capture from DevTools"</strong>
            </div>
          </div>
        ) : (
          fixes.map((f, index) => {
            const isEditing = editingId === f.id;
            return (
              <div
                key={f.id}
                style={styles.fixCardCompact}
                onMouseEnter={() => highlightElement(f.selector)}
                onMouseLeave={removeHighlight}
              >
                <div style={styles.fixCardBody}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ color: '#888', fontSize: 11 }}>#{index + 1}</span>
                        {f.meta.componentName && <span style={styles.componentName}>{f.meta.componentName}</span>}
                        <span style={styles.tagName}>&lt;{f.meta.tag}&gt;</span>
                      </div>
                      {f.meta.sourceFile && (
                        <div style={styles.sourceFile}>
                          📁 {f.meta.sourceFile.split('/').slice(-2).join('/')}
                          {f.meta.sourceLine ? `:${f.meta.sourceLine}` : ''}
                        </div>
                      )}
                      {f.meta.text && !f.confirmed && (
                        <div style={styles.textPreview}>
                          "{f.meta.text.slice(0, 50)}
                          {f.meta.text.length > 50 ? '...' : ''}"
                        </div>
                      )}
                      {f.confirmed && f.request && <div style={styles.requestDisplay}>{f.request}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {f.confirmed ? (
                        <button style={styles.editBtn} onClick={() => startEditing(f.id)}>
                          Edit
                        </button>
                      ) : null}
                      <button style={styles.removeBtn} onClick={() => removeFix(f.id)} title='Remove'>
                        ×
                      </button>
                    </div>
                  </div>
                </div>

                {(isEditing || !f.confirmed) && (
                  <div style={styles.fixCardEditing}>
                    <textarea
                      style={{ ...styles.inputFlex, minHeight: 80, width: '100%', boxSizing: 'border-box' as const }}
                      placeholder='Describe the change you want...'
                      value={f.request}
                      onChange={(e) => setRequest(f.id, e.target.value)}
                      autoFocus={isEditing}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8, gap: 8 }}>
                      {f.request.trim() && (
                        <button style={styles.confirmBtn} onClick={() => confirmFix(f.id)}>
                          Confirm
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {fixes.length > 0 && (
        <div style={styles.footer}>
          <button style={styles.previewBtn} onClick={() => setView('preview')}>
            Preview
          </button>
          <button
            style={{ ...styles.submitBtn, ...(hasValidFixes ? {} : styles.submitBtnDisabled) }}
            onClick={copyPrompt}
            disabled={!hasValidFixes}
          >
            Copy
          </button>
          <button
            style={{ ...styles.sendBtn, ...(hasValidFixes ? {} : styles.submitBtnDisabled) }}
            onClick={isConfigured ? sendToAgent : () => setView('settings')}
            disabled={!hasValidFixes || sendStatus === 'sending'}
          >
            {sendStatus === 'sending' 
              ? 'Sending...' 
              : isConfigured 
                ? `Send to ${settings.preferredProvider === 'cursor' ? 'Cursor' : 'Cloud Code'}`
                : 'Configure Settings'}
          </button>
        </div>
      )}

      {toast && (
        <div style={{ ...styles.toast, ...(toast.type === 'success' ? styles.toastSuccess : styles.toastError) }}>{toast.message}</div>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
