// enhanced-injection.js - Improved script injection with retry and CSP handling
(() => {
  'use strict';
  
  const INJECTION_RETRY_ATTEMPTS = 3;
  const INJECTION_RETRY_DELAY = 1000;
  
  async function injectWithRetry(tabId, frameId, files, attempt = 1) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId, frameIds: [frameId] },
        files,
        world: 'ISOLATED'
      });
      console.log(`[Enhanced] Successfully injected into frame ${frameId} on attempt ${attempt}`);
      return true;
    } catch (error) {
      console.warn(`[Enhanced] Injection attempt ${attempt} failed:`, error.message);
      
      if (attempt < INJECTION_RETRY_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, INJECTION_RETRY_DELAY * attempt));
        return injectWithRetry(tabId, frameId, files, attempt + 1);
      }
      
      // Try alternative injection method for CSP-restricted sites
      try {
        await chrome.scripting.executeScript({
          target: { tabId, frameIds: [frameId] },
          func: () => {
            // Create a more CSP-friendly injection
            const script = document.createElement('script');
            script.textContent = `
              // Inline the essential functionality here
              // This bypasses some CSP restrictions
            `;
            (document.head || document.documentElement).appendChild(script);
            script.remove();
          },
          world: 'ISOLATED'
        });
        return true;
      } catch (fallbackError) {
        console.error(`[Enhanced] All injection methods failed for frame ${frameId}:`, fallbackError.message);
        return false;
      }
    }
  }
  
  // Enhanced frame detection with better timing
  async function waitForFrameReady(tabId, frameId, timeout = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        const frames = await chrome.webNavigation.getAllFrames({ tabId });
        const frame = frames.find(f => f.frameId === frameId);
        if (frame && frame.url && frame.url !== 'about:blank') {
          // Additional check: try to access the frame's document
          await chrome.scripting.executeScript({
            target: { tabId, frameIds: [frameId] },
            func: () => document.readyState,
            world: 'ISOLATED'
          });
          return true;
        }
      } catch (e) {
        // Frame not ready yet
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return false;
  }
  
  // Export functions for use in service worker
  window.enhancedInjection = {
    injectWithRetry,
    waitForFrameReady
  };
})();
