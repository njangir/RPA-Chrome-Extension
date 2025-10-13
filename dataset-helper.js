// dataset-helper.js - Content script for dataset button functionality
(() => {
  'use strict';
  
  console.log('[Dataset Helper] Content script loaded');
  
  let isDragActive = false;
  let highlightedElements = [];
  
  // Function to find all input fields on the page
  function findInputFields() {
    const selectors = [
      'input[type="text"]',
      'input[type="email"]',
      'input[type="password"]',
      'input[type="search"]',
      'input[type="url"]',
      'input[type="tel"]',
      'input[type="number"]',
      'textarea',
      '[contenteditable="true"]',
      '[contenteditable=""]',
      'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"])'
    ];
    
    const elements = [];
    selectors.forEach(selector => {
      try {
        const found = document.querySelectorAll(selector);
        found.forEach(el => {
          if (isVisible(el) && !elements.includes(el)) {
            elements.push(el);
          }
        });
      } catch (e) {
        // Some selectors might not work in all contexts
      }
    });
    
    return elements;
  }
  
  // Check if element is visible
  function isVisible(element) {
    if (!element) return false;
    
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           style.opacity !== '0' &&
           element.offsetWidth > 0 && 
           element.offsetHeight > 0;
  }
  
  // Highlight input fields during drag
  function highlightInputFields() {
    if (isDragActive) return;
    
    isDragActive = true;
    highlightedElements = findInputFields();
    
    highlightedElements.forEach(el => {
      el.classList.add('input-field-highlight');
      el.addEventListener('dragover', handleDragOver);
      el.addEventListener('drop', handleDrop);
    });
    
    console.log(`[Dataset Helper] Highlighted ${highlightedElements.length} input fields`);
  }
  
  // Remove highlight from input fields
  function removeInputFieldHighlight() {
    if (!isDragActive) return;
    
    isDragActive = false;
    
    highlightedElements.forEach(el => {
      el.classList.remove('input-field-highlight');
      el.removeEventListener('dragover', handleDragOver);
      el.removeEventListener('drop', handleDrop);
    });
    
    highlightedElements = [];
    console.log('[Dataset Helper] Removed highlight from input fields');
  }
  
  // Handle drag over input fields
  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }
  
  // Handle drop on input fields
  function handleDrop(e) {
    e.preventDefault();
    
    try {
      const textData = e.dataTransfer.getData('text/plain');
      const jsonData = e.dataTransfer.getData('application/json');
      
      let value = textData;
      let key = 'unknown';
      
      if (jsonData) {
        try {
          const data = JSON.parse(jsonData);
          value = data.value || textData;
          key = data.key || 'unknown';
        } catch (err) {
          console.warn('[Dataset Helper] Could not parse JSON data:', err);
        }
      }
      
      // Insert the value into the input field
      insertValueIntoField(e.target, value);
      
      console.log(`[Dataset Helper] Dropped "${key}" value into input field:`, value);
      
      // Send success response back to panel
      chrome.runtime.sendMessage({
        type: 'DATASET_DROP_SUCCESS',
        key: key,
        value: value,
        element: {
          tagName: e.target.tagName,
          type: e.target.type,
          id: e.target.id,
          className: e.target.className
        }
      });
      
    } catch (error) {
      console.error('[Dataset Helper] Error handling drop:', error);
    }
  }
  
  // Insert value into input field
  function insertValueIntoField(element, value) {
    try {
      if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
        // For input and textarea elements
        const start = element.selectionStart || 0;
        const end = element.selectionEnd || 0;
        
        // Replace selected text or insert at cursor position
        element.value = element.value.substring(0, start) + value + element.value.substring(end);
        
        // Set cursor position after inserted text
        const newPosition = start + value.length;
        element.setSelectionRange(newPosition, newPosition);
        
        // Trigger input events
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        
      } else if (element.contentEditable === 'true' || element.contentEditable === '') {
        // For contenteditable elements
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          range.insertNode(document.createTextNode(value));
          
          // Move cursor after inserted text
          range.setStartAfter(range.endContainer);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
        } else {
          element.textContent = value;
        }
        
        // Trigger input events
        element.dispatchEvent(new Event('input', { bubbles: true }));
        
      } else {
        // Fallback: try to set value property
        element.value = value;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }
      
    } catch (error) {
      console.error('[Dataset Helper] Error inserting value into field:', error);
    }
  }
  
  // Handle button click to paste value
  function handleButtonClick(key, value) {
    try {
      // Find the currently focused input field
      const activeElement = document.activeElement;
      
      if (activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA' || 
        activeElement.contentEditable === 'true' ||
        activeElement.contentEditable === ''
      )) {
        insertValueIntoField(activeElement, value);
        
        console.log(`[Dataset Helper] Pasted "${key}" value into focused field:`, value);
        
        // Send success response
        chrome.runtime.sendMessage({
          type: 'DATASET_BUTTON_SUCCESS',
          key: key,
          value: value,
          success: true
        });
        
      } else {
        // No focused input field, copy to clipboard as fallback
        navigator.clipboard.writeText(value).then(() => {
          console.log(`[Dataset Helper] Copied "${key}" value to clipboard:`, value);
          
          chrome.runtime.sendMessage({
            type: 'DATASET_BUTTON_SUCCESS',
            key: key,
            value: value,
            success: false,
            fallback: 'clipboard'
          });
        }).catch(err => {
          console.error('[Dataset Helper] Failed to copy to clipboard:', err);
          
          chrome.runtime.sendMessage({
            type: 'DATASET_BUTTON_SUCCESS',
            key: key,
            value: value,
            success: false,
            error: err.message
          });
        });
      }
      
    } catch (error) {
      console.error('[Dataset Helper] Error handling button click:', error);
      
      chrome.runtime.sendMessage({
        type: 'DATASET_BUTTON_SUCCESS',
        key: key,
        value: value,
        success: false,
        error: error.message
      });
    }
  }
  
  // Message listener
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
      switch (message.type) {
        case 'DATASET_DRAG_START':
          highlightInputFields();
          sendResponse({ success: true });
          break;
          
        case 'DATASET_DRAG_END':
          removeInputFieldHighlight();
          sendResponse({ success: true });
          break;
          
        case 'DATASET_BUTTON_CLICK':
          handleButtonClick(message.key, message.value);
          sendResponse({ success: true });
          break;
          
        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('[Dataset Helper] Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  });
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    removeInputFieldHighlight();
  });
  
  console.log('[Dataset Helper] Content script ready');
})();
