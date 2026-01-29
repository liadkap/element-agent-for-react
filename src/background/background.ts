interface Settings {
  cursorApiKey?: string;
  workspacePath?: string;
}

const devtoolsPorts = new Map<number, chrome.runtime.Port>();

function getReactInfoScript(selector: string) {
  return `
    (function() {
      function getReactFiber(element) {
        if (!element) return null;
        for (const key in element) {
          if (key.startsWith("__reactFiber$") || key.startsWith("__reactInternalInstance$")) {
            return element[key];
          }
        }
        return null;
      }

      function getDebugSource(fiber) {
        if (!fiber) return null;
        const source = fiber._debugSource;
        if (source && source.fileName) {
          return {
            fileName: source.fileName,
            lineNumber: source.lineNumber || 0,
            columnNumber: source.columnNumber
          };
        }
        return null;
      }

      function getComponentDisplayName(fiber) {
        if (!fiber || !fiber.type) return null;
        const type = fiber.type;
        
        if (typeof type === "function") {
          return type.displayName || type.name || null;
        }
        if (typeof type === "object") {
          if (type.displayName) return type.displayName;
          if (type.render) {
            return type.render.displayName || type.render.name || null;
          }
          if (type.$$typeof) {
            const typeStr = type.$$typeof.toString();
            if (typeStr.includes("forward_ref")) {
              if (type.displayName) return type.displayName;
              if (type.render) return type.render.displayName || type.render.name || "ForwardRef";
              return "ForwardRef";
            }
            if (typeStr.includes("memo")) {
              if (type.displayName) return type.displayName;
              if (type.type) return type.type.displayName || type.type.name || "Memo";
              return "Memo";
            }
          }
        }
        if (typeof type === "string") {
          return type;
        }
        return null;
      }

      function getSafeProps(fiber) {
        if (!fiber) return undefined;
        const props = fiber.memoizedProps;
        if (!props) return undefined;
        const safe = {};
        const skip = ["children", "ref", "key", "__self", "__source"];
        
        for (const key in props) {
          if (skip.includes(key)) continue;
          const value = props[key];
          if (typeof value === "function") {
            safe[key] = "[Function]";
          } else if (typeof value === "object" && value !== null) {
            if (Array.isArray(value)) {
              safe[key] = "[Array(" + value.length + ")]";
            } else if (value.$$typeof) {
              safe[key] = "[React Element]";
            } else {
              safe[key] = "[Object]";
            }
          } else if (typeof value === "string" && value.length > 100) {
            safe[key] = value.slice(0, 100) + "...";
          } else if (value !== undefined) {
            safe[key] = value;
          }
        }
        return Object.keys(safe).length > 0 ? safe : undefined;
      }

      function getReactInfoForElement(element) {
        if (!element) {
          return { error: "No element provided" };
        }

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
          return { hasReact: false };
        }

        let depth = 0;
        const maxDepth = 30;

        while (fiber && depth < maxDepth) {
          const name = getComponentDisplayName(fiber);
          if (name && !name.startsWith("_") && name !== "Fragment") {
            const source = getDebugSource(fiber);
            const props = depth < 5 ? getSafeProps(fiber) : undefined;
            tree.push({ 
              name, 
              source: source || undefined, 
              props,
              isUserComponent: /^[A-Z]/.test(name)
            });
          }
          fiber = fiber.return;
          depth++;
        }

        const userComponents = tree.filter(c => c.isUserComponent);
        const firstComponent = userComponents[0];

        return {
          hasReact: true,
          componentName: firstComponent?.name || null,
          sourceFile: firstComponent?.source?.fileName || null,
          sourceLine: firstComponent?.source?.lineNumber || null,
          sourceColumn: firstComponent?.source?.columnNumber || null,
          props: firstComponent?.props || null,
          componentHierarchy: userComponents.map(c => c.name),
          fullReactTree: tree.map(c => c.name),
          componentStack: userComponents.slice(0, 10).map(c => ({
            name: c.name,
            source: c.source
          }))
        };
      }

      const selector = ${JSON.stringify(selector)};
      const element = document.querySelector(selector);
      return getReactInfoForElement(element);
    })();
  `;
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name.startsWith('devtools-')) {
    const tabId = parseInt(port.name.split('-')[1], 10);
    devtoolsPorts.set(tabId, port);

    port.onDisconnect.addListener(() => {
      devtoolsPorts.delete(tabId);
    });

    port.onMessage.addListener((msg) => {
      if (msg.type === 'START_PICKER' || msg.type === 'STOP_PICKER') {
        chrome.tabs.sendMessage(tabId, { type: msg.type }, () => {
          if (chrome.runtime.lastError) {
            port.postMessage({ type: 'ERROR', error: 'Content script not ready. Try refreshing the page.' });
          }
        });
      }
    });
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'ELEMENT_PICKED' || msg.type === 'PICKER_CANCELLED') {
    const tabId = sender.tab?.id;
    if (tabId) {
      const port = devtoolsPorts.get(tabId);
      if (port) {
        try {
          port.postMessage(msg);
        } catch (e) {
          console.log('[ElementAgent] Port disconnected, removing from map');
          devtoolsPorts.delete(tabId);
        }
      }
    }
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === 'GET_REACT_INFO') {
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({ error: 'No tab ID' });
      return true;
    }

    chrome.scripting
      .executeScript({
        target: { tabId },
        world: 'MAIN',
        func: (selector: string) => {
          function getReactFiber(element: Element | null): Record<string, unknown> | null {
            if (!element) return null;
            for (const key in element) {
              if (key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$')) {
                return (element as unknown as Record<string, unknown>)[key] as Record<string, unknown>;
              }
            }
            return null;
          }

          function getDebugSource(fiber: Record<string, unknown>) {
            if (!fiber) return null;
            const source = fiber._debugSource as { fileName?: string; lineNumber?: number; columnNumber?: number } | undefined;
            if (source && source.fileName) {
              return {
                fileName: source.fileName,
                lineNumber: source.lineNumber || 0,
                columnNumber: source.columnNumber,
              };
            }
            return null;
          }

          function getComponentDisplayName(fiber: Record<string, unknown>): string | null {
            if (!fiber || !fiber.type) return null;
            const type = fiber.type as Record<string, unknown> | ((...args: unknown[]) => unknown) | string;

            if (typeof type === 'function') {
              const fn = type as { displayName?: string; name?: string };
              return fn.displayName || fn.name || null;
            }
            if (typeof type === 'object' && type !== null) {
              const obj = type as {
                displayName?: string;
                render?: { displayName?: string; name?: string };
                type?: { displayName?: string; name?: string };
                $$typeof?: symbol;
              };
              if (obj.displayName) return obj.displayName;
              if (obj.render) return obj.render.displayName || obj.render.name || null;
              if (obj.$$typeof) {
                const typeStr = obj.$$typeof.toString();
                if (typeStr.includes('forward_ref')) {
                  if (obj.displayName) return obj.displayName;
                  return 'ForwardRef';
                }
                if (typeStr.includes('memo')) {
                  if (obj.displayName) return obj.displayName;
                  if (obj.type) return obj.type.displayName || obj.type.name || 'Memo';
                  return 'Memo';
                }
              }
            }
            if (typeof type === 'string') return type;
            return null;
          }

          function getSafeProps(fiber: Record<string, unknown>) {
            if (!fiber) return undefined;
            const props = fiber.memoizedProps as Record<string, unknown> | undefined;
            if (!props) return undefined;
            const safe: Record<string, unknown> = {};
            const skip = ['children', 'ref', 'key', '__self', '__source'];

            for (const key in props) {
              if (skip.includes(key)) continue;
              const value = props[key];
              if (typeof value === 'function') {
                safe[key] = '[Function]';
              } else if (typeof value === 'object' && value !== null) {
                if (Array.isArray(value)) {
                  safe[key] = '[Array(' + value.length + ')]';
                } else {
                  safe[key] = '[Object]';
                }
              } else if (typeof value === 'string' && value.length > 100) {
                safe[key] = value.slice(0, 100) + '...';
              } else if (value !== undefined) {
                safe[key] = value;
              }
            }
            return Object.keys(safe).length > 0 ? safe : undefined;
          }

          const element = document.querySelector(selector);
          if (!element) return { error: 'Element not found' };

          const tree: Array<{
            name: string;
            source?: { fileName: string; lineNumber: number; columnNumber?: number };
            props?: Record<string, unknown>;
            isUserComponent: boolean;
          }> = [];
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

          if (!fiber) return { hasReact: false };

          let depth = 0;
          while (fiber && depth < 30) {
            const name = getComponentDisplayName(fiber);
            if (name && !name.startsWith('_') && name !== 'Fragment') {
              const source = getDebugSource(fiber);
              const props = depth < 5 ? getSafeProps(fiber) : undefined;
              tree.push({ name, source: source || undefined, props, isUserComponent: /^[A-Z]/.test(name) });
            }
            fiber = fiber.return as Record<string, unknown> | null;
            depth++;
          }

          const userComponents = tree.filter((c) => c.isUserComponent);
          const firstComponent = userComponents[0];

          return {
            hasReact: true,
            componentName: firstComponent?.name || null,
            sourceFile: firstComponent?.source?.fileName || null,
            sourceLine: firstComponent?.source?.lineNumber || null,
            sourceColumn: firstComponent?.source?.columnNumber || null,
            props: firstComponent?.props || null,
            componentHierarchy: userComponents.map((c) => c.name),
            fullReactTree: tree.map((c) => c.name),
            componentStack: userComponents.slice(0, 10).map((c) => ({ name: c.name, source: c.source })),
          };
        },
        args: [msg.selector],
      })
      .then((results) => {
        const result = results?.[0]?.result;
        sendResponse({ result: result || {} });
      })
      .catch((err) => {
        sendResponse({ error: err.message });
      });

    return true;
  }

  if (msg.type === 'COPY_TO_CLIPBOARD') {
    navigator.clipboard
      .writeText(msg.text)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === 'SAVE_SETTINGS') {
    chrome.storage.local.set({ settings: msg.settings }, () => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (msg.type === 'GET_SETTINGS') {
    chrome.storage.local.get('settings', (result) => {
      sendResponse({ settings: (result.settings as Settings) || {} });
    });
    return true;
  }

  return true;
});
