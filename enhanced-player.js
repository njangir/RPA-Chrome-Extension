// enhanced-player.js - Improved cross-site compatibility player
(() => {
  'use strict';
  
  const C = window.__mvpEnhancedCommon || window.__mvpCommon || {};
  const log = (...a) => (C.log ? C.log('[enhanced-player]', ...a) : console.log('[MVP][enhanced-player]', ...a));
  
  if (window.__mvp_enhanced_player_installed__) { 
    log('already installed'); 
    return; 
  }
  window.__mvp_enhanced_player_installed__ = true;
  
  log('Enhanced player attached');

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // Enhanced shadow DOM traversal
  function* allShadowRoots(root) {
    if (!root) return;
    
    const walker = document.createTreeWalker(
      root, 
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          if (node.shadowRoot) return NodeFilter.FILTER_ACCEPT;
          return NodeFilter.FILTER_SKIP;
        }
      }
    );
    
    while (walker.nextNode()) {
      const el = walker.currentNode;
      if (el.shadowRoot) {
        yield el.shadowRoot;
        yield* allShadowRoots(el.shadowRoot);
      }
    }
  }

  // Enhanced deep query selector with better error handling
  function deepQuerySelector(css) {
    if (!css) return null;
    
    try {
      // Try main document first
      let el = document.querySelector(css);
      if (el) return el;
      
      // Try shadow DOMs
      for (const sr of allShadowRoots(document)) {
        try {
          const found = sr.querySelector(css);
          if (found) return found;
        } catch (e) {
          // Shadow root might be closed or inaccessible
          continue;
        }
      }
    } catch (error) {
      log('Error in deepQuerySelector:', error);
    }
    
    return null;
  }

  // Enhanced visibility checking
  function isVisible(el) {
    if (!el) return false;
    
    try {
      // Check if element exists in DOM
      if (!document.contains(el)) return false;
      
      // Check bounding rect
      const rect = el.getBoundingClientRect?.();
      if (!rect || rect.width <= 0 || rect.height <= 0) return false;
      
      // Check computed styles
      const style = el.ownerDocument?.defaultView?.getComputedStyle?.(el);
      if (!style) return false;
      
      // Check visibility properties
      if (style.visibility === 'hidden' || 
          style.display === 'none' || 
          style.opacity === '0') return false;
      
      // Check if element is off-screen
      const viewport = {
        width: window.innerWidth || document.documentElement.clientWidth,
        height: window.innerHeight || document.documentElement.clientHeight
      };
      
      if (rect.right < 0 || rect.left > viewport.width ||
          rect.bottom < 0 || rect.top > viewport.height) {
        return false;
      }
      
      return true;
    } catch (error) {
      log('Error checking visibility:', error);
      return false;
    }
  }

  // Enhanced interactability checking
  function isInteractable(el) {
    if (!el) return false;
    
    try {
      if (!isVisible(el)) return false;
      
      // Check if element is disabled
      if (el.disabled) return false;
      
      // Check if element is readonly
      if (el.readOnly) return false;
      
      // Check if element is hidden by CSS
      const style = el.ownerDocument?.defaultView?.getComputedStyle?.(el);
      if (style && (style.pointerEvents === 'none' || style.userSelect === 'none')) {
        return false;
      }
      
      return true;
    } catch (error) {
      log('Error checking interactability:', error);
      return false;
    }
  }

  // Enhanced candidate selector generation
  function candidateSelectors(sig) {
    const selectors = [];
    if (!sig) return selectors;
    
    try {
      // Priority 1: data-testid (most stable)
      if (sig.dataTestId) {
        selectors.push(`[data-testid="${sig.dataTestId}"]`);
      }
      
      // Priority 2: name attribute for form elements
      if (sig.nameAttr) {
        const tag = sig.tag || '*';
        selectors.push(`${tag}[name="${sig.nameAttr}"]`);
      }
      
      // Priority 3: aria-label
      if (sig.ariaLabel) {
        const tag = sig.tag || '*';
        selectors.push(`${tag}[aria-label="${sig.ariaLabel}"]`);
      }
      
      // Priority 4: placeholder
      if (sig.placeholder) {
        const tag = sig.tag || '*';
        selectors.push(`${tag}[placeholder="${sig.placeholder}"]`);
      }
      
      // Priority 5: role attribute
      if (sig.role) {
        const tag = sig.tag || '*';
        selectors.push(`${tag}[role="${sig.role}"]`);
      }
      
      // Priority 6: ID (with fallbacks for dynamic IDs)
      if (sig.id) {
        const escapedId = C.cssEscapeIdent ? C.cssEscapeIdent(sig.id) : sig.id;
        selectors.push(`#${escapedId}`);
        
        // Fallback for dynamic IDs
        if (C.isDynamicId && C.isDynamicId(sig.id)) {
          selectors.push(`[id*="${sig.id}"]`); // Contains
          selectors.push(`[id$="${sig.id}"]`); // Ends with
          selectors.push(`[id^="${sig.id}"]`); // Starts with
        }
      }
      
      // Priority 7: Class-based selectors
      if (sig.classes && sig.classes.length > 0) {
        const tag = sig.tag || '*';
        // Try different combinations of classes
        selectors.push(`${tag}.${sig.classes.join('.')}`);
        if (sig.classes.length > 1) {
          selectors.push(`${tag}.${sig.classes[0]}`); // Just first class
        }
      }
      
      // Priority 8: Text content matching
      if (sig.textSnippet) {
        const tag = sig.tag || '*';
        selectors.push(`${tag}:contains("${sig.textSnippet}")`);
      }
      
    } catch (error) {
      log('Error generating candidate selectors:', error);
    }
    
    return [...new Set(selectors)].filter(Boolean);
  }

  // Enhanced label text finding
  function findByLabelText(labelText) {
    if (!labelText) return null;
    
    try {
      const labels = Array.from(document.querySelectorAll('label'));
      const matchingLabel = labels.find(l => 
        (l.textContent || '').trim().toLowerCase() === labelText.trim().toLowerCase()
      );
      
      if (!matchingLabel) return null;
      
      // Try for attribute first
      const forId = matchingLabel.getAttribute('for');
      if (forId) {
        const escapedId = C.cssEscapeIdent ? C.cssEscapeIdent(forId) : forId;
        return deepQuerySelector(`#${escapedId}`) || 
               document.getElementById?.(forId);
      }
      
      // Try wrapped input
      return matchingLabel.querySelector('input,textarea,select,button');
    } catch (error) {
      log('Error finding by label text:', error);
      return null;
    }
  }

  // Enhanced element location with multiple strategies
  async function locate(locator, timeoutMs = 15000) {
    const start = performance.now();
    let lastError;
    
    if (!locator) {
      throw new Error('No locator provided');
    }
    
    const sig = locator?.signature || {};
    const primarySelectors = [locator?.css].filter(Boolean);
    const fallbackSelectors = candidateSelectors(sig);
    const allSelectors = [...primarySelectors, ...fallbackSelectors];
    
    log('Locating element with selectors:', allSelectors.slice(0, 3)); // Log first 3 for debugging
    
    while (performance.now() - start < timeoutMs) {
      // Try all selectors
      for (const selector of allSelectors) {
        try {
          const el = deepQuerySelector(selector);
          if (el && isInteractable(el)) {
            log('Found element with selector:', selector);
            return el;
          }
        } catch (e) {
          lastError = e;
        }
      }
      
      // Try label text matching
      try {
        const el = findByLabelText(sig.labelText);
        if (el && isInteractable(el)) {
          log('Found element by label text:', sig.labelText);
          return el;
        }
      } catch (e) {
        lastError = e;
      }
      
      // Wait before retry
      await sleep(250);
    }
    
    const errorMsg = `Element not found after ${timeoutMs}ms. Tried selectors: ${allSelectors.slice(0, 5).join(', ')}`;
    log(errorMsg);
    throw new Error(errorMsg + (lastError ? ` Last error: ${lastError.message}` : ''));
  }

  // Enhanced input value setting with better compatibility
  function setInputValueCompat(el, value) {
    if (!el) return;
    
    try {
      // ContentEditable elements
      if (el.isContentEditable) {
        el.focus();
        el.innerText = value;
        el.dispatchEvent(new InputEvent('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return;
      }
      
      const tag = el.tagName.toLowerCase();
      
      // Input and textarea elements
      if (tag === 'input' || tag === 'textarea') {
        // Focus first
        el.focus();
        
        // Clear existing value
        el.value = '';
        
        // Set new value using multiple methods for better compatibility
        const proto = tag === 'input' ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
        const desc = Object.getOwnPropertyDescriptor(proto, 'value');
        
        if (desc?.set) {
          desc.set.call(el, value);
        } else {
          el.value = value;
        }
        
        // Trigger events
        el.dispatchEvent(new InputEvent('input', { 
          bubbles: true, 
          cancelable: true,
          inputType: 'insertText',
          data: value
        }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        
        // For React/Vue components, also trigger focus/blur
        el.dispatchEvent(new Event('focus', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
      }
      
      // Select elements
      else if (tag === 'select') {
        el.focus();
        el.value = value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
      
    } catch (error) {
      log('Error setting input value:', error);
      // Fallback: try direct assignment
      try {
        el.value = value;
      } catch (e) {
        log('Fallback also failed:', e);
      }
    }
  }

  // Handle text selection playback
  async function handleTextSelection(element, step, row) {
    try {
      log('Handling text selection:', step.selectedText);
      
      // Get replacement text from row data
      const replacementText = C.getValueFromRow ? C.getValueFromRow(step, row) : (step.originalTextSample || '');
      
      if (!replacementText) {
        log('No replacement text available for text selection');
        return;
      }
      
      // Focus the element first
      element.focus();
      await sleep(50);
      
      // Try to select the original text in the element
      const textSelected = C.selectTextInElement ? C.selectTextInElement(element, step.selectedText) : false;
      
      if (textSelected) {
        // Text was found and selected, now replace it
        const replaced = C.replaceSelectedText ? C.replaceSelectedText(replacementText) : false;
        
        if (replaced) {
          log('Successfully replaced selected text:', step.selectedText, '->', replacementText);
        } else {
          log('Failed to replace selected text, trying direct input');
          // Fallback: clear and set the entire value
          if (element.value !== undefined) {
            element.value = replacementText;
            element.dispatchEvent(new InputEvent('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
          } else if (element.isContentEditable) {
            element.innerText = replacementText;
            element.dispatchEvent(new InputEvent('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      } else {
        // Original text not found, try to replace the entire element content
        log('Original text not found, replacing entire element content');
        
        if (element.value !== undefined) {
          // Input/textarea element
          element.value = replacementText;
          element.dispatchEvent(new InputEvent('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (element.isContentEditable) {
          // ContentEditable element
          element.innerText = replacementText;
          element.dispatchEvent(new InputEvent('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          // Regular element - try to replace text content
          const textNodes = [];
          const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            null,
            false
          );
          
          let node;
          while (node = walker.nextNode()) {
            textNodes.push(node);
          }
          
          // Replace text in the first text node that contains the original text
          for (const textNode of textNodes) {
            if (textNode.textContent.includes(step.selectedText)) {
              textNode.textContent = textNode.textContent.replace(step.selectedText, replacementText);
              break;
            }
          }
        }
      }
      
    } catch (error) {
      log('Error handling text selection:', error);
      throw error;
    }
  }

  // Enhanced step execution with better error handling
  async function runSteps(steps, row) {
    if (!Array.isArray(steps)) {
      throw new Error('Steps must be an array');
    }
    
    log(`Running ${steps.length} steps`);
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      
      try {
        // Handle sleep steps
        if (step.type === 'sleep') {
          await sleep(step.value || 300);
          continue;
        }
        
        log(`Executing step ${i + 1}/${steps.length}:`, step.type, step.target?.css);
        
        // Locate element
        const el = step.target ? await locate(step.target, 10000) : document.body;
        
        // Scroll element into view
        if (el && el.scrollIntoView) {
          el.scrollIntoView({ 
            block: 'center', 
            inline: 'center',
            behavior: 'smooth'
          });
          await sleep(100); // Wait for scroll
        }
        
        // Execute action
        switch (step.type) {
          case 'click':
            if (el) {
              el.click();
              log('Clicked element');
            }
            break;
            
          case 'input':
            if (el) {
              const value = C.getValueFromRow ? C.getValueFromRow(step, row) : (step.originalTextSample || '');
              setInputValueCompat(el, value);
              log('Set input value:', value.slice(0, 20));
            }
            break;
            
          case 'text_selection':
            if (el) {
              await handleTextSelection(el, step, row);
            }
            break;
            
          case 'shortcut':
            if (el) {
              el.focus();
              const action = step.action;
              
              if (action === 'selectAll') {
                if (el.isContentEditable) {
                  const range = document.createRange();
                  range.selectNodeContents(el);
                  const selection = window.getSelection();
                  selection.removeAllRanges();
                  selection.addRange(range);
                } else if (el.select) {
                  el.select();
                }
              }
              // Other shortcuts (copy/paste/cut) are handled by the browser
            }
            break;
            
          default:
            log('Unknown step type:', step.type);
        }
        
        // Wait after step
        await sleep(step.waitAfterMs || 200);
        
      } catch (error) {
        log(`Error executing step ${i + 1}:`, error);
        throw new Error(`Step ${i + 1} failed: ${error.message}`);
      }
    }
    
    log('All steps completed successfully');
    return true;
  }

  // Message handling
  chrome.runtime.onMessage.addListener((msg, sender, send) => {
    if (msg?.type === 'PLAYER_RUN') {
      runSteps(msg.steps || [], msg.row || {})
        .then(() => send({ ok: true }))
        .catch(err => {
          log('Error running steps:', err);
          send({ ok: false, error: String(err?.stack || err) });
        });
      return true; // Keep message channel open for async response
    }
  });

  log('Enhanced player ready');
})();
