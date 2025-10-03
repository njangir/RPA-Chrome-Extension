// enhanced-common.js - Improved cross-site compatibility utilities
(() => {
  'use strict';
  
  if (window.__mvpEnhancedCommon) return;

  function log(...args) {
    console.log('[MVP-Enhanced]', ...args);
  }

  // Enhanced CSS escaping with better browser compatibility
  function cssEscapeIdent(ident) {
    if (window.CSS && CSS.escape) {
      return CSS.escape(ident);
    }
    // More robust fallback for older browsers
    return String(ident).replace(/[^a-zA-Z0-9_\-]/g, c => {
      const code = c.codePointAt(0);
      return code <= 0xFF ? `\\${code.toString(16).padStart(2, '0')}` : `\\${code.toString(16)} `;
    });
  }

  // Enhanced nth-of-type calculation with better performance
  function nthOfType(el) {
    if (!el || !el.parentElement) return 0;
    
    const tag = el.tagName;
    const parent = el.parentElement;
    let index = 0;
    let count = 0;
    
    // Use querySelectorAll for better performance on large DOMs
    const siblings = parent.querySelectorAll(tag);
    for (let i = 0; i < siblings.length; i++) {
      count++;
      if (siblings[i] === el) {
        index = count;
        break;
      }
    }
    return index;
  }

  // More robust CSS path generation with multiple fallback strategies
  function cssPath(el) {
    if (!(el instanceof Element)) return '';
    
    const path = [];
    let current = el;
    
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let selector = current.nodeName.toLowerCase();
      
      // Strategy 1: Use ID if available and stable
      if (current.id && !isDynamicId(current.id)) {
        selector += `#${cssEscapeIdent(current.id)}`;
        path.unshift(selector);
        break;
      }
      
      // Strategy 2: Use data attributes (more stable)
      const dataTestId = current.getAttribute('data-testid') || 
                        current.getAttribute('data-test') ||
                        current.getAttribute('data-cy') ||
                        current.getAttribute('data-qa');
      if (dataTestId) {
        selector += `[data-testid="${cssEscapeIdent(dataTestId)}"]`;
        path.unshift(selector);
        break;
      }
      
      // Strategy 3: Use aria-label or title
      const ariaLabel = current.getAttribute('aria-label');
      if (ariaLabel) {
        selector += `[aria-label="${cssEscapeIdent(ariaLabel)}"]`;
        path.unshift(selector);
        break;
      }
      
      // Strategy 4: Use name attribute for form elements
      const name = current.getAttribute('name');
      if (name && ['input', 'select', 'textarea', 'button'].includes(current.tagName.toLowerCase())) {
        selector += `[name="${cssEscapeIdent(name)}"]`;
        path.unshift(selector);
        break;
      }
      
      // Strategy 5: Use nth-of-type as fallback
      const nth = nthOfType(current);
      if (nth > 0) {
        selector += `:nth-of-type(${nth})`;
      }
      
      path.unshift(selector);
      current = current.parentElement;
    }
    
    return path.join(' > ');
  }

  // Detect if an ID is likely to be dynamically generated
  function isDynamicId(id) {
    if (!id) return false;
    // Common patterns for dynamic IDs
    const dynamicPatterns = [
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i, // UUID
      /^\d+$/, // Pure numbers
      /^[a-f0-9]{24}$/i, // MongoDB ObjectId
      /^react-select-\d+$/i, // React Select
      /^mui-\d+$/i, // Material-UI
      /^__xmlview\d+--/i, // SAP UI5
      /^ember\d+$/i, // Ember.js
    ];
    
    return dynamicPatterns.some(pattern => pattern.test(id));
  }

  // Enhanced text extraction with better handling of various content types
  function getTextSnippet(el) {
    if (!el) return undefined;
    
    let text = '';
    
    // Try different text extraction methods
    if (el.innerText) {
      text = el.innerText;
    } else if (el.textContent) {
      text = el.textContent;
    } else if (el.value) {
      text = el.value;
    } else if (el.placeholder) {
      text = el.placeholder;
    }
    
    // Clean and truncate
    text = text.trim().replace(/\s+/g, ' ');
    return text ? text.slice(0, 50) : undefined;
  }

  // Enhanced label text finding with multiple strategies
  function nearestLabelText(el) {
    if (!el) return undefined;
    
    try {
      // Strategy 1: For attribute
      const id = el.getAttribute('id');
      if (id) {
        const label = document.querySelector(`label[for="${cssEscapeIdent(id)}"]`);
        if (label) return label.innerText?.trim();
      }
      
      // Strategy 2: Wrapped in label
      const wrappedLabel = el.closest('label');
      if (wrappedLabel) return wrappedLabel.innerText?.trim();
      
      // Strategy 3: Adjacent text nodes
      const parent = el.parentElement;
      if (parent) {
        const textNodes = Array.from(parent.childNodes)
          .filter(node => node.nodeType === Node.TEXT_NODE)
          .map(node => node.textContent?.trim())
          .filter(text => text && text.length > 0);
        
        if (textNodes.length > 0) return textNodes[0];
      }
      
      // Strategy 4: Previous sibling text
      let sibling = el.previousElementSibling;
      while (sibling) {
        const text = sibling.innerText?.trim();
        if (text) return text;
        sibling = sibling.previousElementSibling;
      }
      
    } catch (error) {
      log('Error finding label text:', error);
    }
    
    return undefined;
  }

  // Enhanced locator building with multiple fallback strategies
  function buildLocator(el) {
    if (!(el instanceof Element)) return { css: '', signature: {} };
    
    const tag = el.tagName.toLowerCase();
    const signature = {
      tag,
      id: el.id || undefined,
      classes: Array.from(el.classList || []),
      nameAttr: el.getAttribute('name') || undefined,
      dataTestId: el.getAttribute('data-testid') || 
                  el.getAttribute('data-test') ||
                  el.getAttribute('data-cy') ||
                  el.getAttribute('data-qa') ||
                  undefined,
      ariaLabel: el.getAttribute('aria-label') || undefined,
      labelText: nearestLabelText(el) || undefined,
      placeholder: el.getAttribute('placeholder') || undefined,
      nthOfType: nthOfType(el),
      textSnippet: getTextSnippet(el),
      role: el.getAttribute('role') || undefined,
      type: el.getAttribute('type') || undefined
    };

    // Build CSS selector with priority order
    let css = '';
    
    // Priority 1: data-testid (most stable)
    if (signature.dataTestId) {
      css = `[data-testid="${cssEscapeIdent(signature.dataTestId)}"]`;
    }
    // Priority 2: Stable ID
    else if (el.id && !isDynamicId(el.id)) {
      css = `#${cssEscapeIdent(el.id)}`;
    }
    // Priority 3: Name attribute for form elements
    else if (signature.nameAttr && ['input', 'select', 'textarea', 'button'].includes(tag)) {
      css = `${tag}[name="${cssEscapeIdent(signature.nameAttr)}"]`;
    }
    // Priority 4: Aria-label
    else if (signature.ariaLabel) {
      css = `${tag}[aria-label="${cssEscapeIdent(signature.ariaLabel)}"]`;
    }
    // Priority 5: Placeholder
    else if (signature.placeholder) {
      css = `${tag}[placeholder="${cssEscapeIdent(signature.placeholder)}"]`;
    }
    // Priority 6: Role attribute
    else if (signature.role) {
      css = `${tag}[role="${cssEscapeIdent(signature.role)}"]`;
    }
    // Fallback: CSS path
    else {
      css = cssPath(el);
    }

    return { css, signature };
  }

  // Enhanced text input detection
  function isTextInput(el) {
    if (!el) return false;
    
    // ContentEditable elements
    if (el.isContentEditable) return true;
    
    const tag = el.tagName?.toLowerCase();
    
    // Textarea
    if (tag === 'textarea') return true;
    
    // Input elements
    if (tag === 'input') {
      const type = (el.getAttribute('type') || 'text').toLowerCase();
      const textInputTypes = [
        'text', 'email', 'number', 'search', 'tel', 'url', 'password',
        'date', 'datetime-local', 'time', 'month', 'week'
      ];
      return textInputTypes.includes(type);
    }
    
    // Select elements
    if (tag === 'select') return true;
    
    return false;
  }

  // Enhanced frame path detection
  function getFramePath() {
    try {
      // Try to get frame information from various sources
      const frameIds = [];
      
      // Method 1: Check if we're in a frame
      if (window !== window.top) {
        // We're in an iframe, try to determine frame hierarchy
        try {
          const frames = window.parent.frames;
          for (let i = 0; i < frames.length; i++) {
            try {
              if (frames[i] === window) {
                frameIds.push(i);
                break;
              }
            } catch (e) {
              // Cross-origin frame, can't access
            }
          }
        } catch (e) {
          // Cross-origin restriction
        }
      }
      
      return { frameIds };
    } catch (error) {
      log('Error getting frame path:', error);
      return { frameIds: [] };
    }
  }

  // Enhanced placeholder inference with better pattern matching
  function inferPlaceholder(raw) {
    const s = (raw ?? '').toString().trim();
    
    // Check for numeric index
    const n = Number(s);
    if (Number.isInteger(n) && n >= 1 && n <= 1000) {
      return { placeholderIndex: n };
    }
    
    // Check for template patterns
    const templatePatterns = [
      /^\s*\{\{([^}]+)\}\}\s*$/,  // {{key}}
      /^\s*<<([^>]+)>>\s*$/,       // <<key>>
      /^\s*\[([^\]]+)\]\s*$/,      // [key]
      /^\s*\$([^$]+)\$\s*$/,       // $key$
    ];
    
    for (const pattern of templatePatterns) {
      const match = s.match(pattern);
      if (match) {
        return { placeholderKey: match[1].trim() };
      }
    }
    
    return {};
  }

  // Enhanced value extraction from row data
  function getValueFromRow(step, row) {
    if (!step || !row) return step?.originalTextSample || '';
    
    // Try placeholder key first
    if (step.placeholderKey && Object.prototype.hasOwnProperty.call(row, step.placeholderKey)) {
      return row[step.placeholderKey];
    }
    
    // Try placeholder index
    if (step.placeholderIndex) {
      const vals = Array.isArray(row) ? row : Object.values(row || {});
      const index = step.placeholderIndex - 1;
      if (index >= 0 && index < vals.length) {
        return vals[index];
      }
    }
    
    // Fallback to original text
    return step.originalTextSample || '';
  }

  // Mutation observer for dynamic content
  function setupMutationObserver(callback) {
    if (!window.MutationObserver) return null;
    
    const observer = new MutationObserver((mutations) => {
      const hasRelevantChanges = mutations.some(mutation => 
        mutation.type === 'childList' && 
        mutation.addedNodes.length > 0
      );
      
      if (hasRelevantChanges) {
        callback();
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false
    });
    
    return observer;
  }

  // Enhanced error handling
  function safeExecute(fn, context = 'Unknown') {
    try {
      return fn();
    } catch (error) {
      log(`Error in ${context}:`, error);
      return null;
    }
  }

  // Text selection utilities
  function getCurrentSelection() {
    try {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return null;
      
      const range = selection.getRangeAt(0);
      const selectedText = selection.toString().trim();
      
      if (!selectedText) return null;
      
      return {
        text: selectedText,
        range: range.cloneRange(),
        startContainer: range.startContainer,
        startOffset: range.startOffset,
        endContainer: range.endContainer,
        endOffset: range.endOffset,
        isCollapsed: range.collapsed
      };
    } catch (error) {
      log('Error getting current selection:', error);
      return null;
    }
  }

  function getSelectionContext(selection) {
    if (!selection) return null;
    
    try {
      // Find the containing element
      let container = selection.startContainer;
      if (container.nodeType === Node.TEXT_NODE) {
        container = container.parentElement;
      }
      
      // Build locator for the containing element
      const locator = buildLocator(container);
      
      // Get text content of the element for context
      const elementText = container?.textContent || container?.innerText || '';
      
      return {
        container: container,
        locator: locator,
        elementText: elementText,
        selectionInElement: elementText.includes(selection.text)
      };
    } catch (error) {
      log('Error getting selection context:', error);
      return null;
    }
  }

  function replaceSelectedText(newText) {
    try {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return false;
      
      const range = selection.getRangeAt(0);
      
      // Check if we're in an input field
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        // Handle input/textarea selection replacement
        const start = activeElement.selectionStart || 0;
        const end = activeElement.selectionEnd || 0;
        const value = activeElement.value || '';
        
        activeElement.value = value.substring(0, start) + newText + value.substring(end);
        activeElement.selectionStart = activeElement.selectionEnd = start + newText.length;
        
        // Trigger events
        activeElement.dispatchEvent(new InputEvent('input', { bubbles: true }));
        activeElement.dispatchEvent(new Event('change', { bubbles: true }));
        
        return true;
      } else if (activeElement && activeElement.isContentEditable) {
        // Handle contentEditable elements
        range.deleteContents();
        range.insertNode(document.createTextNode(newText));
        
        // Clear selection and set cursor after inserted text
        selection.removeAllRanges();
        const newRange = document.createRange();
        newRange.setStartAfter(range.endContainer);
        newRange.collapse(true);
        selection.addRange(newRange);
        
        // Trigger events
        activeElement.dispatchEvent(new InputEvent('input', { bubbles: true }));
        activeElement.dispatchEvent(new Event('change', { bubbles: true }));
        
        return true;
      } else {
        // Handle regular text content
        range.deleteContents();
        range.insertNode(document.createTextNode(newText));
        
        // Clear selection
        selection.removeAllRanges();
        
        return true;
      }
    } catch (error) {
      log('Error replacing selected text:', error);
      return false;
    }
  }

  function selectTextInElement(element, textToSelect) {
    if (!element || !textToSelect) return false;
    
    try {
      const elementText = element.textContent || element.innerText || '';
      const textIndex = elementText.indexOf(textToSelect);
      
      if (textIndex === -1) return false;
      
      // Create range for text selection
      const range = document.createRange();
      const textNode = element.childNodes[0]; // Assume single text node for simplicity
      
      if (textNode && textNode.nodeType === Node.TEXT_NODE) {
        range.setStart(textNode, textIndex);
        range.setEnd(textNode, textIndex + textToSelect.length);
        
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        
        return true;
      }
    } catch (error) {
      log('Error selecting text in element:', error);
    }
    
    return false;
  }

  // Export enhanced utilities
  window.__mvpEnhancedCommon = {
    log,
    buildLocator,
    isTextInput,
    getFramePath,
    inferPlaceholder,
    getValueFromRow,
    setupMutationObserver,
    safeExecute,
    cssEscapeIdent,
    nthOfType,
    cssPath,
    getTextSnippet,
    nearestLabelText,
    isDynamicId,
    // Text selection utilities
    getCurrentSelection,
    getSelectionContext,
    replaceSelectedText,
    selectTextInElement
  };

  log('Enhanced common.js loaded');
})();
