// enhanced-recorder.js - Improved cross-site compatibility recorder
(() => {
  'use strict';
  
  const C = window.__mvpEnhancedCommon || window.__mvpCommon || {};
  const log = (...a) => (C.log ? C.log('[enhanced-recorder]', ...a) : console.log('[MVP][enhanced-recorder]', ...a));
  
  if (window.__mvp_enhanced_recorder_installed__) { 
    log('already installed, skipping'); 
    return; 
  }
  window.__mvp_enhanced_recorder_installed__ = true;
  
  let seedRow = null;
  let mutationObserver = null;
  let isRecording = false;
  
  log('attaching enhanced listeners… (frame url=' + location.href + ')');
  
  const listeners = [];
  const eventQueue = [];
  let processingQueue = false;

  // Enhanced seed matching with better pattern recognition
  function matchFromSeed(value) {
    try {
      if (!seedRow) return {};
      
      const searchValue = String(value ?? '').trim();
      if (!searchValue) return {};
      
      // Array-based matching
      if (Array.isArray(seedRow)) {
        const index = seedRow.findIndex(x => 
          String(x ?? '').trim().toLowerCase() === searchValue.toLowerCase()
        );
        if (index >= 0) {
          return { placeholderIndex: index + 1, matchedBy: 'seedRow' };
        }
      } 
      // Object-based matching
      else if (seedRow && typeof seedRow === 'object') {
        for (const [key, val] of Object.entries(seedRow)) {
          if (String(val ?? '').trim().toLowerCase() === searchValue.toLowerCase()) {
            return { placeholderKey: key, matchedBy: 'seedRow' };
          }
        }
      }
    } catch (error) {
      log('Error in matchFromSeed:', error);
    }
    return {};
  }

  // Enhanced step sending with retry mechanism
  function sendStep(step) {
    const sendWithRetry = (attempt = 1) => {
      chrome.runtime.sendMessage(
        { type: 'RECORDER_STEP', payload: step }, 
        (response) => {
          if (chrome.runtime.lastError) {
            log(`Send attempt ${attempt} failed:`, chrome.runtime.lastError.message);
            if (attempt < 3) {
              setTimeout(() => sendWithRetry(attempt + 1), 100 * attempt);
            }
          }
        }
      );
    };
    sendWithRetry();
  }

  // Enhanced click handler with better element detection
  function onClick(e) {
    if (!isRecording) return;
    
    try {
      const el = e.target;
      if (!el || !(el instanceof Element)) return;
      
      // Skip recording for certain elements
      if (el.closest('[data-mvp-skip]') || 
          el.classList.contains('mvp-skip') ||
          el.tagName === 'SCRIPT' ||
          el.tagName === 'STYLE') {
        return;
      }
      
      const step = {
        id: crypto.randomUUID(),
        type: 'click',
        target: C.buildLocator ? C.buildLocator(el) : { css: '', signature: {} },
        framePath: C.getFramePath ? C.getFramePath() : { frameIds: [] },
        timestamp: Date.now(),
        url: location.href
      };
      
      log('record click', step.target.css);
      sendStep(step);
    } catch (err) {
      log('ERR onClick', err);
    }
  }

  // Enhanced input handler with better text input detection
  function onChange(e) {
    if (!isRecording) return;
    
    try {
      const el = e.target;
      if (!el || !(el instanceof Element)) return;
      
      if (!C.isTextInput ? C.isTextInput(el) : false) return;
      
      const value = el.isContentEditable ? el.innerText : el.value;
      let placeholder = C.inferPlaceholder ? C.inferPlaceholder(value) : {};
      
      if (!placeholder.placeholderKey && !placeholder.placeholderIndex) {
        placeholder = { ...placeholder, ...matchFromSeed(value) };
      }
      
      const step = {
        id: crypto.randomUUID(),
        type: 'input',
        target: C.buildLocator ? C.buildLocator(el) : { css: '', signature: {} },
        framePath: C.getFramePath ? C.getFramePath() : { frameIds: [] },
        originalTextSample: value,
        ...placeholder,
        timestamp: Date.now(),
        url: location.href
      };
      
      log('record input', step.target.css, 'value:', value.slice(0, 20));
      sendStep(step);
    } catch (err) {
      log('ERR onChange', err);
    }
  }

  // Enhanced keyboard handler
  function onKeydown(e) {
    if (!isRecording) return;
    
    try {
      const mod = (e.ctrlKey || e.metaKey) && !e.altKey;
      if (!mod) return;
      
      const key = String(e.key || '').toLowerCase();
      let action = null;
      
      if (key === 'a') action = 'selectAll';
      else if (key === 'c') action = 'copy';
      else if (key === 'v') action = 'paste';
      else if (key === 'x') action = 'cut';
      else if (key === 'z') action = 'undo';
      else if (key === 'y') action = 'redo';
      
      if (!action) return;
      
      const el = document.activeElement || e.target;
      const step = {
        id: crypto.randomUUID(),
        type: 'shortcut',
        action,
        target: C.buildLocator ? C.buildLocator(el instanceof Element ? el : document.body) : { css: '', signature: {} },
        framePath: C.getFramePath ? C.getFramePath() : { frameIds: [] },
        timestamp: Date.now(),
        url: location.href
      };
      
      log('record shortcut', action, step.target.css);
      sendStep(step);
    } catch (err) {
      log('ERR onKeydown', err);
    }
  }

  // Text selection handler
  function onTextSelection() {
    if (!isRecording) return;
    
    try {
      // Small delay to ensure selection is complete
      setTimeout(() => {
        if (!isRecording) return;
        
        const selection = C.getCurrentSelection ? C.getCurrentSelection() : null;
        if (!selection || !selection.text) return;
        
        const context = C.getSelectionContext ? C.getSelectionContext(selection) : null;
        if (!context) return;
        
        // Check if this is a meaningful selection (not just a click)
        if (selection.text.length < 2) return;
        
        // Infer placeholder for replacement
        let placeholder = C.inferPlaceholder ? C.inferPlaceholder(selection.text) : {};
        if (!placeholder.placeholderKey && !placeholder.placeholderIndex) {
          placeholder = { ...placeholder, ...matchFromSeed(selection.text) };
        }
        
        const step = {
          id: crypto.randomUUID(),
          type: 'text_selection',
          target: context.locator,
          framePath: C.getFramePath ? C.getFramePath() : { frameIds: [] },
          selectedText: selection.text,
          elementText: context.elementText,
          selectionStart: selection.startOffset,
          selectionEnd: selection.endOffset,
          originalTextSample: selection.text,
          ...placeholder,
          timestamp: Date.now(),
          url: location.href
        };
        
        log('record text selection', selection.text, 'in', step.target.css);
        sendStep(step);
      }, 100); // Small delay to ensure selection is stable
    } catch (err) {
      log('ERR onTextSelection', err);
    }
  }

  // Enhanced clipboard handlers with better text extraction
  function getActiveSelectionText() {
    const el = document.activeElement;
    try {
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
        const start = el.selectionStart || 0;
        const end = el.selectionEnd || 0;
        return (el.value || '').slice(start, end);
      }
    } catch (e) {
      // Cross-origin or other restrictions
    }
    
    try {
      const sel = window.getSelection?.();
      return sel?.toString?.() || '';
    } catch (e) {
      return '';
    }
  }

  function onCopy(e) {
    if (!isRecording) return;
    
    try {
      const text = getActiveSelectionText();
      chrome.runtime.sendMessage({
        type: 'RECORDER_CLIP',
        payload: {
          action: 'copy',
          text,
          timestamp: Date.now(),
          url: location.href
        }
      });
    } catch (err) {
      log('ERR onCopy', err);
    }
  }

  function onCut(e) {
    if (!isRecording) return;
    
    try {
      const text = getActiveSelectionText();
      chrome.runtime.sendMessage({
        type: 'RECORDER_CLIP',
        payload: {
          action: 'cut',
          text,
          timestamp: Date.now(),
          url: location.href
        }
      });
    } catch (err) {
      log('ERR onCut', err);
    }
  }

  function onPaste(e) {
    if (!isRecording) return;
    
    try {
      const text = e.clipboardData?.getData?.('text/plain') || '';
      chrome.runtime.sendMessage({
        type: 'RECORDER_CLIP',
        payload: {
          action: 'paste',
          text,
          timestamp: Date.now(),
          url: location.href
        }
      });
    } catch (err) {
      log('ERR onPaste', err);
    }
  }

  // Enhanced event listener management
  function addListener(type, handler, options = { capture: true, passive: true }) {
    try {
      document.addEventListener(type, handler, options);
      listeners.push({ type, handler, options });
    } catch (err) {
      log(`Failed to add ${type} listener:`, err);
    }
  }

  // Text selection event listener with debouncing
  let selectionTimeout = null;
  function onSelectionChange() {
    if (!isRecording) return;
    
    // Debounce selection events to avoid multiple recordings
    if (selectionTimeout) {
      clearTimeout(selectionTimeout);
    }
    
    selectionTimeout = setTimeout(() => {
      onTextSelection();
    }, 150);
  }

  function removeAllListeners() {
    listeners.forEach(({ type, handler, options }) => {
      try {
        document.removeEventListener(type, handler, options);
      } catch (err) {
        log(`Failed to remove ${type} listener:`, err);
      }
    });
    listeners.length = 0;
  }

  // Setup mutation observer for dynamic content
  function setupDynamicContentObserver() {
    if (mutationObserver) return;
    
    mutationObserver = C.setupMutationObserver ? C.setupMutationObserver(() => {
      log('DOM changes detected, ensuring listeners are attached');
      // Re-attach listeners to new elements if needed
    }) : null;
  }

  // Enhanced initialization
  function startRecording() {
    if (isRecording) return;
    
    isRecording = true;
    log('Starting enhanced recording...');
    
    // Add event listeners
    addListener('click', onClick);
    addListener('change', onChange);
    addListener('input', onChange);
    addListener('keydown', onKeydown);
    addListener('copy', onCopy);
    addListener('cut', onCut);
    addListener('paste', onPaste);
    
    // Add text selection listeners
    addListener('mouseup', onSelectionChange);
    addListener('keyup', onSelectionChange);
    addListener('selectionchange', onSelectionChange);
    
    // Setup dynamic content observer
    setupDynamicContentObserver();
    
    // Add visual indicator
    document.body.style.outline = '2px solid #4CAF50';
    document.body.style.outlineOffset = '2px';
  }

  function stopRecording() {
    if (!isRecording) return;
    
    isRecording = false;
    log('Stopping enhanced recording...');
    
    // Remove event listeners
    removeAllListeners();
    
    // Clean up mutation observer
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }
    
    // Remove visual indicator
    document.body.style.outline = '';
    document.body.style.outlineOffset = '';
  }

  // Message handling
  chrome.runtime.onMessage.addListener((msg, sender, send) => {
    try {
      log('Received message:', msg?.type, 'from frame:', sender?.frameId);
      
      if (msg?.type === 'RECORDER_SEED') {
        seedRow = msg.seedRow || null;
        log('seed received', !!seedRow);
        send?.({ ok: true });
      } else if (msg?.type === 'RECORDER_START') {
        log('Starting recording via message');
        startRecording();
        send?.({ ok: true });
      } else if (msg?.type === 'RECORDER_STOP') {
        log('Stopping recording via message');
        stopRecording();
        send?.({ ok: true });
      }
    } catch (err) {
      log('Error handling message:', err);
      send?.({ ok: false, error: err.message });
    }
  });

  // Auto-start if we're in recording mode
  if (window.location.search.includes('mvp-recording=true')) {
    startRecording();
  }

  log('Enhanced recorder ready');
})();
