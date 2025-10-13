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
      
      // Priority 3: ID (with fallbacks for dynamic IDs)
      if (sig.id) {
        const escapedId = C.cssEscapeIdent ? C.cssEscapeIdent(sig.id) : sig.id;
        selectors.push(`#${escapedId}`);
        
        // Fallback for dynamic IDs - try partial matches
        if (C.isDynamicId && C.isDynamicId(sig.id)) {
          // Extract the stable part of the ID (after the last --)
          const stablePart = sig.id.split('--').pop();
          if (stablePart && stablePart !== sig.id) {
            selectors.push(`[id$="${stablePart}"]`); // Ends with stable part
            selectors.push(`[id*="${stablePart}"]`); // Contains stable part
          }
          selectors.push(`[id*="${sig.id}"]`); // Contains full ID
          selectors.push(`[id$="${sig.id}"]`); // Ends with full ID
          selectors.push(`[id^="${sig.id}"]`); // Starts with full ID
        }
        
        // Special handling for SAP UI5 elements
        if (sig.id.includes('__xmlview') || sig.id.includes('--')) {
          // Try to find by the control ID part (after the last --)
          const controlId = sig.id.split('--').pop();
          if (controlId) {
            selectors.push(`[id$="${controlId}"]`);
            selectors.push(`[id*="${controlId}"]`);
          }
          
          // Try to find by the view part (before the last --)
          const viewPart = sig.id.split('--')[0];
          if (viewPart) {
            selectors.push(`[id^="${viewPart}"]`);
          }
        }
      }
      
      // Priority 4: aria-label with tag specificity
      if (sig.ariaLabel) {
        const tag = sig.tag || '*';
        selectors.push(`${tag}[aria-label="${sig.ariaLabel}"]`);
        // Also try without tag for broader matching
        selectors.push(`[aria-label="${sig.ariaLabel}"]`);
      }
      
      // Priority 5: placeholder with tag specificity
      if (sig.placeholder) {
        const tag = sig.tag || '*';
        selectors.push(`${tag}[placeholder="${sig.placeholder}"]`);
        // Also try without tag for broader matching
        selectors.push(`[placeholder="${sig.placeholder}"]`);
      }
      
      // Priority 6: role attribute
      if (sig.role) {
        const tag = sig.tag || '*';
        selectors.push(`${tag}[role="${sig.role}"]`);
      }
      
      // Priority 7: Class-based selectors with tag
      if (sig.classes && sig.classes.length > 0) {
        const tag = sig.tag || '*';
        // Try different combinations of classes
        selectors.push(`${tag}.${sig.classes.join('.')}`);
        if (sig.classes.length > 1) {
          selectors.push(`${tag}.${sig.classes[0]}`); // Just first class
        }
        // Try without tag
        selectors.push(`.${sig.classes.join('.')}`);
        if (sig.classes.length > 1) {
          selectors.push(`.${sig.classes[0]}`);
        }
      }
      
      // Priority 8: Type attribute for inputs
      if (sig.type) {
        const tag = sig.tag || 'input';
        selectors.push(`${tag}[type="${sig.type}"]`);
      }
      
      // Priority 9: Multiple attribute combinations
      if (sig.ariaLabel && sig.placeholder) {
        const tag = sig.tag || '*';
        selectors.push(`${tag}[aria-label="${sig.ariaLabel}"][placeholder="${sig.placeholder}"]`);
      }
      
      if (sig.ariaLabel && sig.type) {
        const tag = sig.tag || '*';
        selectors.push(`${tag}[aria-label="${sig.ariaLabel}"][type="${sig.type}"]`);
      }
      
      if (sig.placeholder && sig.type) {
        const tag = sig.tag || '*';
        selectors.push(`${tag}[placeholder="${sig.placeholder}"][type="${sig.type}"]`);
      }
      
      // Priority 10: Text content matching
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

  // Get user-selected selector preference
  function getUserSelectedSelector(stepIndex) {
    try {
      const preferences = JSON.parse(localStorage.getItem('selectorPreferences') || '{}');
      return preferences[stepIndex] || null;
    } catch (error) {
      log('Error loading user selector preference:', error);
      return null;
    }
  }

  // SAP UI5 specific element finding
  function findSAPElement(sig) {
    if (!sig) return null;
    
    try {
      // For SAP UI5, try to find elements by their control properties
      if (sig.id && sig.id.includes('__xmlview')) {
        // Try to find by control ID pattern
        const controlId = sig.id.split('--').pop();
        if (controlId) {
          // Look for elements with similar control IDs
          const allElements = document.querySelectorAll('*[id]');
          for (const el of allElements) {
            if (el.id.includes(controlId) || el.id.endsWith(controlId)) {
              if (isInteractable(el)) {
                log('Found SAP element by control ID:', el.id);
                return el;
              }
            }
          }
        }
      }
      
      // Try to find by aria-label and type combination
      if (sig.ariaLabel && sig.type) {
        const elements = document.querySelectorAll(`${sig.tag || 'input'}[aria-label="${sig.ariaLabel}"][type="${sig.type}"]`);
        for (const el of elements) {
          if (isInteractable(el)) {
            log('Found SAP element by aria-label and type:', el.id);
            return el;
          }
        }
      }
      
      // Try to find by class and aria-label
      if (sig.classes && sig.classes.length > 0 && sig.ariaLabel) {
        const classSelector = sig.classes.map(c => `.${c}`).join('');
        const elements = document.querySelectorAll(`${sig.tag || 'input'}${classSelector}[aria-label="${sig.ariaLabel}"]`);
        for (const el of elements) {
          if (isInteractable(el)) {
            log('Found SAP element by class and aria-label:', el.id);
            return el;
          }
        }
      }
      
    } catch (error) {
      log('Error in SAP element finding:', error);
    }
    
    return null;
  }

  // Enhanced element location with multiple strategies
  async function locate(locator, timeoutMs = 15000, stepIndex = null) {
    const start = performance.now();
    let lastError;
    let foundElements = [];
    
    if (!locator) {
      throw new Error('No locator provided');
    }
    
    const sig = locator?.signature || {};
    let allSelectors = [];
    
    // Check for user-selected selector preference
    if (stepIndex !== null) {
      const userSelector = getUserSelectedSelector(stepIndex);
      if (userSelector) {
        log('Using user-selected selector:', userSelector);
        allSelectors = [userSelector];
      } else {
        // Fall back to generated selectors
        const primarySelectors = [locator?.css].filter(Boolean);
        const fallbackSelectors = candidateSelectors(sig);
        allSelectors = [...primarySelectors, ...fallbackSelectors];
      }
    } else {
      // Default behavior - try all selectors
      const primarySelectors = [locator?.css].filter(Boolean);
      const fallbackSelectors = candidateSelectors(sig);
      allSelectors = [...primarySelectors, ...fallbackSelectors];
    }
    
    log('Locating element with selectors:', allSelectors.slice(0, 5)); // Log first 5 for debugging
    log('Element signature:', sig);
    
    while (performance.now() - start < timeoutMs) {
      // Try all selectors
      for (const selector of allSelectors) {
        try {
          const el = deepQuerySelector(selector);
          if (el) {
            foundElements.push({ selector, element: el, interactable: isInteractable(el) });
            if (isInteractable(el)) {
              log('Found interactable element with selector:', selector);
              return el;
            } else {
              log('Found element but not interactable:', selector, 'Element:', el);
            }
          }
        } catch (e) {
          lastError = e;
          log('Selector failed:', selector, 'Error:', e.message);
        }
      }
      
      // Try label text matching
      try {
        const el = findByLabelText(sig.labelText);
        if (el) {
          foundElements.push({ selector: 'labelText', element: el, interactable: isInteractable(el) });
          if (isInteractable(el)) {
            log('Found element by label text:', sig.labelText);
            return el;
          }
        }
      } catch (e) {
        lastError = e;
      }
      
      // Try SAP UI5 specific finding
      try {
        const el = findSAPElement(sig);
        if (el) {
          foundElements.push({ selector: 'sapUI5', element: el, interactable: isInteractable(el) });
          if (isInteractable(el)) {
            log('Found element by SAP UI5 method');
            return el;
          }
        }
      } catch (e) {
        lastError = e;
      }
      
      // Wait before retry
      await sleep(250);
    }
    
    // Enhanced error reporting
    const errorMsg = `Element not found after ${timeoutMs}ms.`;
    log(errorMsg);
    log('Tried selectors:', allSelectors);
    log('Found elements (but not interactable):', foundElements.map(f => ({
      selector: f.selector,
      tagName: f.element.tagName,
      id: f.element.id,
      classes: f.element.className,
      interactable: f.interactable
    })));
    
    // Try to find similar elements for debugging
    try {
      const allInputs = document.querySelectorAll('input');
      const similarInputs = Array.from(allInputs).filter(input => {
        return (sig.ariaLabel && input.getAttribute('aria-label') === sig.ariaLabel) ||
               (sig.placeholder && input.getAttribute('placeholder') === sig.placeholder) ||
               (sig.type && input.getAttribute('type') === sig.type);
      });
      
      if (similarInputs.length > 0) {
        log('Found similar elements:', similarInputs.map(el => ({
          tagName: el.tagName,
          id: el.id,
          ariaLabel: el.getAttribute('aria-label'),
          placeholder: el.getAttribute('placeholder'),
          type: el.getAttribute('type'),
          classes: el.className
        })));
      }
    } catch (e) {
      log('Error finding similar elements:', e);
    }
    
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
  // Navigate to start URL if provided
  async function navigateToStartUrl(startUrl) {
    if (!startUrl) return;
    
    try {
      log(`Navigating to start URL: ${startUrl}`);
      
      // Check if we're already on the start URL
      if (window.location.href === startUrl) {
        log('Already on start URL');
        return;
      }
      
      // Navigate to start URL
      window.location.href = startUrl;
      
      // Wait for page to load
      await new Promise((resolve) => {
        if (document.readyState === 'complete') {
          resolve();
        } else {
          window.addEventListener('load', resolve, { once: true });
        }
      });
      
      // Additional wait for dynamic content
      await sleep(1000);
      
      log('Successfully navigated to start URL');
      
    } catch (error) {
      log('Error navigating to start URL:', error);
      throw error;
    }
  }

  /**
   * Execute steps with loop group support
   * @param {Array} steps - Array of step objects
   * @param {Array} rows - Array of data rows (for grouped execution)
   * @param {Object} groupingInfo - Optional grouping information
   * @param {String} startUrl - Optional start URL
   * @returns {Promise<Boolean>} Success status
   */
  async function runStepsWithGroups(steps, rows, groupingInfo = null, startUrl = null) {
    if (!Array.isArray(steps)) {
      throw new Error('Steps must be an array');
    }
    
    // If no grouping info or no loop groups in steps, run normally
    const hasLoopGroups = steps.some(s => s.type === 'loop_group');
    if (!hasLoopGroups || !groupingInfo) {
      // Run steps for each row sequentially
      for (let i = 0; i < rows.length; i++) {
        log(`Processing row ${i + 1}/${rows.length}`);
        await runSteps(steps, rows[i], i === 0 ? startUrl : null);
      }
      return true;
    }
    
    // Process with loop groups
    log('Processing steps with loop groups');
    
    // Build loop group structure
    const loopStructure = [];
    const stack = [];
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      
      if (step.type === 'loop_group' && step.action === 'start') {
        stack.push({ start: i, groupBy: step.groupBy, steps: [] });
      } else if (step.type === 'loop_group' && step.action === 'end') {
        if (stack.length > 0) {
          const loopDef = stack.pop();
          loopDef.end = i;
          
          if (stack.length === 0) {
            loopStructure.push(loopDef);
          } else {
            // Nested loop
            stack[stack.length - 1].steps.push(loopDef);
          }
        }
      } else if (stack.length > 0) {
        stack[stack.length - 1].steps.push(step);
      } else {
        // Step outside any loop
        loopStructure.push(step);
      }
    }
    
    // Execute with grouping
    async function executeWithGrouping(structure, dataRows, level = 0) {
      for (const item of structure) {
        if (item.type === 'loop_group') {
          // This is a loop definition
          const groupBy = item.groupBy;
          
          // Group data by column
          const groups = {};
          for (const row of dataRows) {
            const key = row[groupBy];
            if (!groups[key]) groups[key] = [];
            groups[key].push(row);
          }
          
          log(`Loop group by "${groupBy}": ${Object.keys(groups).length} groups`);
          
          // Execute steps for each group
          for (const [groupKey, groupRows] of Object.entries(groups)) {
            log(`Processing group: ${groupKey} (${groupRows.length} rows)`);
            
            // Execute loop steps with grouped rows
            if (item.steps && item.steps.length > 0) {
              await executeWithGrouping(item.steps, groupRows, level + 1);
            }
          }
        } else {
          // Regular step - execute for all rows in current group
          for (const row of dataRows) {
            await executeStep(item, row);
          }
        }
      }
    }
    
    async function executeStep(step, row) {
      // Execute single step (similar to runSteps but for one step)
      const steps = [step];
      await runSteps(steps, row, null);
    }
    
    // Navigate to start URL once at the beginning
    if (startUrl) {
      await navigateToStartUrl(startUrl);
    }
    
    // Execute the grouped structure
    await executeWithGrouping(loopStructure, rows, 0);
    
    return true;
  }

  async function runSteps(steps, row, startUrl = null) {
    if (!Array.isArray(steps)) {
      throw new Error('Steps must be an array');
    }
    
    log(`Running ${steps.length} steps`);
    
    // Navigate to start URL if provided
    if (startUrl) {
      await navigateToStartUrl(startUrl);
    }
    
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
        const el = step.target ? await locate(step.target, 10000, i) : document.body;
        
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
          case 'navigate_url': {
            // Navigate to URL from dataset column
            const url = C.getValueFromRowEnhanced ? C.getValueFromRowEnhanced(step, row) : (step.value || step.url || '');
            if (url) {
              log('Navigating to URL:', url);
              await navigateToStartUrl(url);
            }
            break;
          }
            
          case 'find_by_value': {
            // Find element by text value from dataset
            const searchValue = C.getValueFromRowEnhanced ? C.getValueFromRowEnhanced(step, row) : (step.value || '');
            if (searchValue) {
              log('Finding element by value:', searchValue);
              const foundEl = C.findElementByValue ? C.findElementByValue(searchValue, step.options || {}) : null;
              
              if (foundEl) {
                // Scroll into view
                foundEl.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
                await sleep(100);
                
                // Perform action on found element
                if (step.action === 'click') {
                  foundEl.click();
                  log('Clicked found element');
                } else if (step.action === 'hover') {
                  foundEl.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
                  log('Hovered over found element');
                } else if (step.action === 'focus') {
                  foundEl.focus();
                  log('Focused found element');
                }
              } else {
                throw new Error(`Element not found with value: "${searchValue}"`);
              }
            }
            break;
          }
            
          case 'find_by_index': {
            // Find element by index in collection
            const selector = step.selector || step.target?.css;
            let index = step.index;
            
            // Support dataset-driven index
            if (typeof index === 'string' && index.startsWith('{')) {
              const columnName = index.slice(1, -1);
              index = parseInt(row[columnName], 10);
            }
            
            if (selector && typeof index === 'number') {
              log(`Finding element by index: ${selector}[${index}]`);
              const foundEl = C.findElementByIndex ? C.findElementByIndex(selector, index) : null;
              
              if (foundEl) {
                // Scroll into view
                foundEl.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
                await sleep(100);
                
                // Perform action on found element
                if (step.action === 'click') {
                  foundEl.click();
                  log('Clicked indexed element');
                } else if (step.action === 'hover') {
                  foundEl.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
                  log('Hovered over indexed element');
                }
              } else {
                throw new Error(`Element not found at index ${index} for selector: "${selector}"`);
              }
            }
            break;
          }
            
          case 'loop_group':
            // Loop group markers are handled at a higher level (see runStepsWithGroups)
            // Skip execution here
            log(`Loop group ${step.action} marker: ${step.groupBy || ''}`);
            break;
            
          case 'click':
            if (el) {
              el.click();
              log('Clicked element');
            }
            break;
            
          case 'input':
            if (el) {
              const value = C.getValueFromRowEnhanced ? C.getValueFromRowEnhanced(step, row) : 
                           (C.getValueFromRow ? C.getValueFromRow(step, row) : (step.originalTextSample || ''));
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

  // Test Flow Functions
  async function findElementForTest(selector) {
    try {
      const element = deepQuerySelector(selector);
      if (element) {
        return {
          ok: true,
          element: {
            tagName: element.tagName,
            id: element.id,
            className: element.className,
            textContent: element.textContent?.substring(0, 200)
          },
          selector: selector
        };
      } else {
        return { ok: false, error: 'Element not found with selector: ' + selector };
      }
    } catch (error) {
      log('Error finding element for test:', error);
      return { ok: false, error: error.message };
    }
  }
  
  async function highlightElementForTest(selector) {
    try {
      const element = deepQuerySelector(selector);
      if (!element) {
        return { ok: false, error: 'Element not found' };
      }
      
      // Remove any existing highlights
      removeElementHighlight();
      
      // Add highlight styles
      const originalStyle = element.style.cssText;
      element.style.cssText = originalStyle + '; outline: 3px solid #ff0000 !important; outline-offset: 2px !important; background-color: rgba(255, 0, 0, 0.1) !important;';
      
      // Store reference for cleanup
      window.__mvpTestHighlightedElement = element;
      window.__mvpTestOriginalStyle = originalStyle;
      
      // Scroll element into view
      element.scrollIntoView({ 
        block: 'center', 
        inline: 'center',
        behavior: 'smooth'
      });
      
      return { ok: true };
      
    } catch (error) {
      log('Error highlighting element for test:', error);
      return { ok: false, error: error.message };
    }
  }
  
  function removeElementHighlight() {
    try {
      if (window.__mvpTestHighlightedElement && window.__mvpTestOriginalStyle !== undefined) {
        window.__mvpTestHighlightedElement.style.cssText = window.__mvpTestOriginalStyle;
        window.__mvpTestHighlightedElement = null;
        window.__mvpTestOriginalStyle = null;
      }
    } catch (error) {
      log('Error removing element highlight:', error);
    }
  }
  
  async function executeTestStep(step, selector, frameId) {
    try {
      log(`Executing test step: ${step.type} with selector: ${selector}`);
      
      // Find the element using the provided selector
      const element = deepQuerySelector(selector);
      if (!element) {
        return { ok: false, error: 'Element not found for execution' };
      }
      
      // Remove any existing highlights
      removeElementHighlight();
      
      // Execute the step based on its type
      let result = { ok: true, result: 'Step executed successfully' };
      
      switch (step.type) {
        case 'click':
          // Simulate a click
          element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
          await new Promise(resolve => setTimeout(resolve, 500)); // Wait for scroll
          
          // Create and dispatch click event
          const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: element.getBoundingClientRect().left + element.getBoundingClientRect().width / 2,
            clientY: element.getBoundingClientRect().top + element.getBoundingClientRect().height / 2
          });
          element.dispatchEvent(clickEvent);
          
          result.result = `Clicked element: ${element.tagName}${element.id ? '#' + element.id : ''}`;
          break;
          
        case 'input':
          // Clear existing value and set new text
          element.focus();
          element.value = '';
          
          // Get text from step data or use placeholder
          const inputText = step.originalTextSample || step.text || 'test input';
          
          // Simulate typing
          for (let i = 0; i < inputText.length; i++) {
            const char = inputText[i];
            const inputEvent = new InputEvent('input', {
              bubbles: true,
              cancelable: true,
              inputType: 'insertText',
              data: char
            });
            element.value += char;
            element.dispatchEvent(inputEvent);
            await new Promise(resolve => setTimeout(resolve, 50)); // Simulate typing delay
          }
          
          // Trigger change event
          const changeEvent = new Event('change', { bubbles: true, cancelable: true });
          element.dispatchEvent(changeEvent);
          
          result.result = `Typed "${inputText}" into ${element.tagName}${element.id ? '#' + element.id : ''}`;
          break;
          
        case 'text_selection':
          // Select and replace text
          if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            element.focus();
            element.select();
            
            const newText = step.selectedText || step.text || 'replaced text';
            element.value = newText;
            
            const changeEvent = new Event('change', { bubbles: true, cancelable: true });
            element.dispatchEvent(changeEvent);
            
            result.result = `Selected and replaced text with "${newText}"`;
          } else {
            // For other elements, try to select text content
            const range = document.createRange();
            range.selectNodeContents(element);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            
            result.result = `Selected text content of ${element.tagName}`;
          }
          break;
          
        case 'shortcut':
          // Execute keyboard shortcut
          const keyEvent = new KeyboardEvent('keydown', {
            bubbles: true,
            cancelable: true,
            key: step.action || 'Enter',
            code: step.action || 'Enter',
            keyCode: step.action === 'Enter' ? 13 : 0
          });
          element.dispatchEvent(keyEvent);
          
          result.result = `Executed keyboard shortcut: ${step.action || 'Enter'}`;
          break;
          
        case 'copy':
          // Copy text to clipboard
          if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            element.select();
            document.execCommand('copy');
            result.result = `Copied text from ${element.tagName}`;
          } else {
            const text = element.textContent || element.innerText;
            navigator.clipboard.writeText(text).then(() => {
              result.result = `Copied text: "${text.substring(0, 50)}..."`;
            });
          }
          break;
          
        case 'cut':
          // Cut text
          if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            element.select();
            document.execCommand('cut');
            result.result = `Cut text from ${element.tagName}`;
          }
          break;
          
        case 'paste':
          // Paste text
          if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            element.focus();
            document.execCommand('paste');
            result.result = `Pasted text into ${element.tagName}`;
          }
          break;
          
        default:
          return { ok: false, error: `Unsupported step type: ${step.type}` };
      }
      
      // Add a brief highlight to show the element was interacted with
      const originalStyle = element.style.cssText;
      element.style.cssText = originalStyle + '; outline: 2px solid #00ff00 !important; outline-offset: 1px !important;';
      
      // Remove highlight after 1 second
      setTimeout(() => {
        element.style.cssText = originalStyle;
      }, 1000);
      
      log(`Test step executed successfully: ${step.type}`);
      return result;
      
    } catch (error) {
      log('Error executing test step:', error);
      return { ok: false, error: error.message };
    }
  }

  // Message handling
  chrome.runtime.onMessage.addListener((msg, sender, send) => {
    if (msg?.type === 'PLAYER_RUN') {
      runSteps(msg.steps || [], msg.row || {}, msg.startUrl || null)
        .then(() => send({ ok: true }))
        .catch(err => {
          log('Error running steps:', err);
          send({ ok: false, error: String(err?.stack || err) });
        });
      return true; // Keep message channel open for async response
    }
    
    if (msg?.type === 'PLAYER_RUN_WITH_GROUPS') {
      runStepsWithGroups(msg.steps || [], msg.rows || [], msg.groupingInfo || null, msg.startUrl || null)
        .then(() => send({ ok: true }))
        .catch(err => {
          log('Error running steps with groups:', err);
          send({ ok: false, error: String(err?.stack || err) });
        });
      return true; // Keep message channel open for async response
    }
    
    // Test Flow Messages
    if (msg?.type === 'TEST_FIND_ELEMENT') {
      findElementForTest(msg.selector)
        .then(result => send(result))
        .catch(err => {
          log('Error in TEST_FIND_ELEMENT:', err);
          send({ ok: false, error: String(err?.stack || err) });
        });
      return true;
    }
    
    if (msg?.type === 'TEST_HIGHLIGHT_ELEMENT') {
      highlightElementForTest(msg.selector)
        .then(result => send(result))
        .catch(err => {
          log('Error in TEST_HIGHLIGHT_ELEMENT:', err);
          send({ ok: false, error: String(err?.stack || err) });
        });
      return true;
    }
    
    if (msg?.type === 'HIGHLIGHT_ELEMENT') {
      highlightElementForTest(msg.selector)
        .then(result => send(result))
        .catch(err => {
          log('Error in HIGHLIGHT_ELEMENT:', err);
          send({ ok: false, error: String(err?.stack || err) });
        });
      return true;
    }
    
    if (msg?.type === 'EXECUTE_TEST_STEP') {
      executeTestStep(msg.step, msg.selector, msg.frameId)
        .then(result => send(result))
        .catch(err => {
          log('Error in EXECUTE_TEST_STEP:', err);
          send({ ok: false, error: String(err?.stack || err) });
        });
      return true;
    }
  });

  log('Enhanced player ready');
})();
