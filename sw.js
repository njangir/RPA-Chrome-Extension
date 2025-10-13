// enhanced-sw.js - Improved service worker with better cross-site compatibility
(() => {
  'use strict';
  
  let stepsByTab = new Map();
  let clipsByTab = new Map();
  let seedRowByTab = new Map();
  let startUrls = new Map(); // Store start URLs per tab
  let currentUrls = new Map(); // Track current URLs per tab
  let pendingContinueResolve = null;
  let aborted = false;
  const recordingTabs = new Set();
  const injectionRetries = new Map(); // Track injection retries per tab/frame
  
  function slog(...a) { 
    console.log('[MVP-Enhanced][sw]', ...a); 
  }

  // Enhanced error handling
  function handleError(context, error, additionalInfo = {}) {
    slog(`Error in ${context}:`, error);
    if (additionalInfo.tabId) {
      slog(`Tab ID: ${additionalInfo.tabId}`);
    }
    if (additionalInfo.frameId) {
      slog(`Frame ID: ${additionalInfo.frameId}`);
    }
    return { ok: false, error: error.message || String(error) };
  }

  // Track URL changes and detect redirects
  function trackUrlChange(tabId, url) {
    const previousUrl = currentUrls.get(tabId);
    currentUrls.set(tabId, url);
    
    // If this is the first URL for this tab, set it as start URL
    if (!startUrls.has(tabId)) {
      startUrls.set(tabId, url);
      slog(`Start URL set for tab ${tabId}:`, url);
    }
    
    // Detect redirect
    if (previousUrl && previousUrl !== url) {
      slog(`Redirect detected for tab ${tabId}:`, previousUrl, '->', url);
      return { isRedirect: true, previousUrl, currentUrl: url };
    }
    
    return { isRedirect: false, currentUrl: url };
  }

  // Preserve steps across redirects
  function preserveStepsAcrossRedirect(tabId) {
    const steps = stepsByTab.get(tabId) || [];
    slog(`Preserving ${steps.length} steps across redirect for tab ${tabId}`);
    return steps;
  }

  // Enhanced frame path building with better error handling
  async function buildFramePath(tabId, leafFrameId) {
    try {
      const frames = await chrome.webNavigation.getAllFrames({ tabId });
      if (!frames || frames.length === 0) {
        return [{ frameId: leafFrameId, url: undefined }];
      }
      
      const byId = new Map(frames.map(f => [f.frameId, f]));
      const path = [];
      let current = byId.get(leafFrameId);
      
      while (current) {
        path.unshift({ 
          frameId: current.frameId, 
          url: current.url, 
          parentFrameId: current.parentFrameId 
        });
        
        if (current.parentFrameId === -1) break;
        current = byId.get(current.parentFrameId);
      }
      
      return path;
    } catch (error) {
      slog('buildFramePath error:', error);
      return [{ frameId: leafFrameId, url: undefined }];
    }
  }

  // Enhanced frame ID resolution with better fallback strategies
  async function resolveFrameIdFromPath(tabId, framePath) {
    try {
      const frames = await chrome.webNavigation.getAllFrames({ tabId });
      if (!frames || frames.length === 0) {
        return 0; // Main frame fallback
      }
      
      // Strategy 1: Exact URL matching from root to leaf
      let candidates = frames.filter(f => f.parentFrameId === -1);
      
      for (let i = 0; i < framePath.length; i++) {
        const targetUrl = framePath[i]?.url;
        if (!targetUrl) {
          // If URL unknown, pick any child that continues the chain
          const nextLevel = [];
          for (const candidate of candidates) {
            const children = frames.filter(f => f.parentFrameId === candidate.frameId);
            nextLevel.push(...children);
          }
          candidates = nextLevel.length ? nextLevel : candidates;
          continue;
        }
        
        // Find children with matching URL
        const nextLevel = [];
        for (const candidate of candidates) {
          const children = frames.filter(f => {
            if (f.parentFrameId !== candidate.frameId) return false;
            
            // Exact match first
            if (f.url === targetUrl) return true;
            
            // Partial match (for dynamic URLs)
            const baseUrl = targetUrl.split('#')[0].split('?')[0];
            const frameBaseUrl = f.url.split('#')[0].split('?')[0];
            return frameBaseUrl === baseUrl;
          });
          nextLevel.push(...children);
        }
        
        if (nextLevel.length) {
          candidates = nextLevel;
        } else {
          break; // No matching children found
        }
      }
      
      // Return best candidate
      if (candidates.length === 1) {
        return candidates[0].frameId;
      }
      
      // Fallback to last recorded frameId if it exists
      const leafId = framePath?.[framePath.length - 1]?.frameId ?? 0;
      if (frames.some(f => f.frameId === leafId)) {
        return leafId;
      }
      
      return 0; // Main frame fallback
    } catch (error) {
      slog('resolveFrameIdFromPath error:', error);
      return framePath?.[framePath.length - 1]?.frameId ?? 0;
    }
  }

  // Enhanced script injection with retry and CSP handling
  async function injectScripts(tabId, frameId, files, retryCount = 0) {
    const maxRetries = 3;
    const retryDelay = 1000 * (retryCount + 1);
    
    try {
      await chrome.scripting.executeScript({
        target: { tabId, frameIds: [frameId] },
        files,
        world: 'ISOLATED'
      });
      
      slog(`Successfully injected scripts into frame ${frameId}`);
      return true;
    } catch (error) {
      slog(`Script injection attempt ${retryCount + 1} failed:`, error.message);
      
      if (retryCount < maxRetries) {
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return injectScripts(tabId, frameId, files, retryCount + 1);
      }
      
      // Try alternative injection method for CSP-restricted sites
      try {
        await chrome.scripting.executeScript({
          target: { tabId, frameIds: [frameId] },
          func: () => {
            // Create a script element to bypass some CSP restrictions
            const script = document.createElement('script');
            script.textContent = `
              // Minimal functionality injection
              if (!window.__mvpEnhancedCommon) {
                window.__mvpEnhancedCommon = {
                  log: (...args) => console.log('[MVP-Enhanced]', ...args),
                  buildLocator: () => ({ css: '', signature: {} }),
                  isTextInput: () => false,
                  getFramePath: () => ({ frameIds: [] }),
                  inferPlaceholder: () => ({}),
                  getValueFromRow: (step, row) => step?.originalTextSample || ''
                };
              }
            `;
            (document.head || document.documentElement).appendChild(script);
            script.remove();
          },
          world: 'ISOLATED'
        });
        
        slog(`Fallback injection successful for frame ${frameId}`);
        return true;
      } catch (fallbackError) {
        slog(`All injection methods failed for frame ${frameId}:`, fallbackError.message);
        return false;
      }
    }
  }

  // Enhanced active tab retrieval
  async function getActiveTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return tab;
    } catch (error) {
      slog('Error getting active tab:', error);
      return null;
    }
  }

  // Enhanced recording start with better error handling
  async function startRecording(seedRow) {
    try {
      const tab = await getActiveTab();
      if (!tab) {
        throw new Error('No active tab found');
      }
      
      slog('Starting recording on tab:', tab.id);
      
      // Initialize data structures
      stepsByTab.set(tab.id, []);
      clipsByTab.set(tab.id, []);
      seedRowByTab.set(tab.id, seedRow || null);
      recordingTabs.add(tab.id);
      
      // Inject scripts into all frames
      const frames = await chrome.webNavigation.getAllFrames({ tabId: tab.id });
      const injectionPromises = frames.map(async (frame) => {
        const success = await injectScripts(tab.id, frame.frameId, [
          'enhanced-common.js',
          'enhanced-recorder.js'
        ]);
        if (success) {
          // Send seed data to recorder
          try {
            await chrome.tabs.sendMessage(tab.id, 
              { type: 'RECORDER_START' }, 
              { frameId: frame.frameId }
            );
            await chrome.tabs.sendMessage(tab.id, 
              { type: 'RECORDER_SEED', seedRow }, 
              { frameId: frame.frameId }
            );
          } catch (e) {
            slog('Failed to send seed to frame:', frame.frameId, e.message);
          }
        }
        return success;
      });
      
      const results = await Promise.allSettled(injectionPromises);
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value).length;
      
      slog(`Injection completed: ${successCount}/${frames.length} frames successful`);
      
      if (successCount === 0) {
        throw new Error('Failed to inject scripts into any frame');
      }
      
    } catch (error) {
      slog('Error starting recording:', error);
      throw error;
    }
  }

  // Enhanced recording stop
  async function stopRecording() {
    try {
      const tab = await getActiveTab();
      if (!tab) return [];
      
      slog('Stopping recording on tab:', tab.id);
      
      recordingTabs.delete(tab.id);
      
      // Send stop message to all frames
      const frames = await chrome.webNavigation.getAllFrames({ tabId: tab.id });
      const stopPromises = frames.map(async (frame) => {
        try {
          await chrome.tabs.sendMessage(tab.id, 
            { type: 'RECORDER_STOP' }, 
            { frameId: frame.frameId }
          );
        } catch (e) {
          // Frame might not have the script or be cross-origin
          slog('Failed to send stop message to frame:', frame.frameId);
        }
      });
      
      await Promise.allSettled(stopPromises);
      
      // Persist last flow
      const steps = stepsByTab.get(tab.id) || [];
      try {
        await chrome.storage.local.set({ 
          lastFlow: { 
            when: Date.now(), 
            url: tab.url, 
            steps 
          } 
        });
      } catch (e) {
        slog('Failed to persist last flow:', e);
      }
      
      return steps;
    } catch (error) {
      slog('Error stopping recording:', error);
      return [];
    }
  }

  // Enhanced step execution in frame
  async function runStepInFrame(tabId, step, row) {
    try {
      const frameId = await resolveFrameIdFromPath(tabId, step.framePath || [{ frameId: step.frameId ?? 0 }]);
      
      // Ensure scripts are injected
      const injectionSuccess = await injectScripts(tabId, frameId, [
        'enhanced-common.js',
        'enhanced-player.js'
      ]);
      
      if (!injectionSuccess) {
        throw new Error('Failed to inject player scripts');
      }
      
      // Execute step
      return await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve({ ok: false, error: 'Step execution timeout' });
        }, 30000); // 30 second timeout
        
        chrome.tabs.sendMessage(tabId, 
          { type: 'PLAYER_RUN', steps: [step], row }, 
          { frameId }, 
          (reply) => {
            clearTimeout(timeout);
            if (chrome.runtime.lastError) {
              resolve({ ok: false, error: chrome.runtime.lastError.message });
            } else {
              resolve(reply || { ok: false, error: 'No response from player' });
            }
          }
        );
      });
    } catch (error) {
      slog('Error running step in frame:', error);
      return { ok: false, error: error.message };
    }
  }

  // Test Flow Handlers
  async function handleTestFindElement(msg, send) {
    try {
      const tab = await getActiveTab();
      if (!tab) {
        return send({ ok: false, error: 'No active tab found' });
      }
      
      const step = msg.step;
      const stepIndex = msg.stepIndex;
      
      // Get user-selected selector preference
      const userSelector = await getUserSelectedSelector(stepIndex);
      const selector = userSelector || step.target?.css;
      
      if (!selector) {
        return send({ ok: false, error: 'No selector available for this step' });
      }
      
      // Find element using the selector
      const result = await findElementInTab(tab.id, selector, step.framePath);
      
      if (result.element) {
        return send({ 
          ok: true, 
          element: {
            tagName: result.element.tagName,
            id: result.element.id,
            className: result.element.className,
            textContent: result.element.textContent?.substring(0, 200)
          },
          selector: result.selector
        });
      } else {
        return send({ ok: false, error: result.error || 'Element not found' });
      }
      
    } catch (error) {
      slog('Error in handleTestFindElement:', error);
      return send({ ok: false, error: error.message });
    }
  }
  
  async function handleTestHighlightElement(msg, send) {
    try {
      const tab = await getActiveTab();
      if (!tab) {
        return send({ ok: false, error: 'No active tab found' });
      }
      
      const stepIndex = msg.stepIndex;
      const steps = stepsByTab.get(tab.id) || [];
      const step = steps[stepIndex];
      
      if (!step) {
        return send({ ok: false, error: 'Step not found' });
      }
      
      // Get user-selected selector preference
      const userSelector = await getUserSelectedSelector(stepIndex);
      const selector = userSelector || step.target?.css;
      
      // Send highlight message to content script
      const result = await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve({ ok: false, error: 'Highlight timeout' });
        }, 5000);
        
        chrome.tabs.sendMessage(tab.id, 
          { type: 'TEST_HIGHLIGHT_ELEMENT', selector, stepIndex }, 
          (reply) => {
            clearTimeout(timeout);
            if (chrome.runtime.lastError) {
              resolve({ ok: false, error: chrome.runtime.lastError.message });
            } else {
              resolve(reply || { ok: false, error: 'No response' });
            }
          }
        );
      });
      
      return send(result);
      
    } catch (error) {
      slog('Error in handleTestHighlightElement:', error);
      return send({ ok: false, error: error.message });
    }
  }
  
  async function handleTestSelector(msg, send) {
    try {
      const tab = await getActiveTab();
      if (!tab) {
        return send({ ok: false, error: 'No active tab found' });
      }
      
      const selector = msg.selector;
      const stepIndex = msg.stepIndex;
      
      // Test the selector
      const result = await findElementInTab(tab.id, selector);
      
      if (result.element) {
        // Save the selector preference
        await saveSelectorPreference(stepIndex, selector);
        
        return send({ 
          ok: true, 
          element: {
            tagName: result.element.tagName,
            id: result.element.id,
            className: result.element.className,
            textContent: result.element.textContent?.substring(0, 200)
          },
          selector: result.selector
        });
      } else {
        return send({ ok: false, error: result.error || 'Element not found with this selector' });
      }
      
    } catch (error) {
      slog('Error in handleTestSelector:', error);
      return send({ ok: false, error: error.message });
    }
  }
  
  async function handleTestExecuteStep(msg, send) {
    try {
      const tab = await getActiveTab();
      if (!tab) {
        return send({ ok: false, error: 'No active tab found' });
      }
      
      const step = msg.step;
      const stepIndex = msg.stepIndex;
      const selector = msg.selector;
      
      if (!step || !selector) {
        return send({ ok: false, error: 'Step or selector not provided' });
      }
      
      // Find the element first
      const findResult = await findElementInTab(tab.id, selector, step.framePath);
      
      if (!findResult.element) {
        return send({ ok: false, error: 'Element not found for execution' });
      }
      
      // Inject scripts if needed
      await injectScripts(tab.id, findResult.frameId, [
        'enhanced-common.js',
        'enhanced-player.js'
      ]);
      
      // Execute the step using the player
      const result = await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve({ ok: false, error: 'Execution timeout' });
        }, 10000);
        
        chrome.tabs.sendMessage(tab.id, {
          from: 'sw',
          type: 'EXECUTE_TEST_STEP',
          step: step,
          selector: selector,
          frameId: findResult.frameId
        }, (response) => {
          clearTimeout(timeout);
          resolve(response || { ok: false, error: 'No response from content script' });
        });
      });
      
      if (result.ok) {
        slog(`Test step executed successfully: ${step.type} on ${selector}`);
        return send({ 
          ok: true, 
          result: result.result,
          stepType: step.type,
          selector: selector
        });
      } else {
        return send({ ok: false, error: result.error || 'Step execution failed' });
      }
      
    } catch (error) {
      slog('Error in handleTestExecuteStep:', error);
      return send({ ok: false, error: error.message });
    }
  }
  
  // Step management handlers
  async function handleUpdateStep(msg, send) {
    try {
      const tab = await getActiveTab();
      if (!tab) {
        return send({ ok: false, error: 'No active tab found' });
      }
      
      const steps = stepsByTab.get(tab.id) || [];
      const index = msg.index;
      
      if (index >= 0 && index < steps.length) {
        steps[index] = msg.step;
        stepsByTab.set(tab.id, steps);
        slog(`Updated step ${index} for tab ${tab.id}`);
        return send({ ok: true });
      } else {
        return send({ ok: false, error: 'Invalid step index' });
      }
    } catch (error) {
      slog('Error in handleUpdateStep:', error);
      return send({ ok: false, error: error.message });
    }
  }
  
  async function handleDeleteStep(msg, send) {
    try {
      const tab = await getActiveTab();
      if (!tab) {
        return send({ ok: false, error: 'No active tab found' });
      }
      
      const steps = stepsByTab.get(tab.id) || [];
      const index = msg.index;
      
      if (index >= 0 && index < steps.length) {
        steps.splice(index, 1);
        stepsByTab.set(tab.id, steps);
        slog(`Deleted step ${index} for tab ${tab.id}`);
        return send({ ok: true });
      } else {
        return send({ ok: false, error: 'Invalid step index' });
      }
    } catch (error) {
      slog('Error in handleDeleteStep:', error);
      return send({ ok: false, error: error.message });
    }
  }
  
  async function handleHighlightElement(msg, send) {
    try {
      const tab = await getActiveTab();
      if (!tab) {
        return send({ ok: false, error: 'No active tab found' });
      }
      
      const selector = msg.selector;
      const stepIndex = msg.stepIndex;
      
      if (!selector) {
        return send({ ok: false, error: 'No selector provided' });
      }
      
      // Get the step to find the frame path
      const steps = stepsByTab.get(tab.id) || [];
      const step = steps[stepIndex];
      
      if (!step) {
        return send({ ok: false, error: 'Step not found' });
      }
      
      // Determine target frame
      let targetFrameId = 0;
      if (step.framePath && step.framePath.length > 0) {
        targetFrameId = await resolveFrameIdFromPath(tab.id, step.framePath);
      }
      
      // Inject test scripts if needed
      await injectScripts(tab.id, targetFrameId, [
        'enhanced-common.js',
        'enhanced-player.js'
      ]);
      
      // Send highlight message to content script
      const result = await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve({ ok: false, error: 'Highlight timeout' });
        }, 5000);
        
        chrome.tabs.sendMessage(tab.id, {
          from: 'sw',
          type: 'HIGHLIGHT_ELEMENT',
          selector: selector,
          frameId: targetFrameId
        }, (response) => {
          clearTimeout(timeout);
          resolve(response || { ok: false, error: 'No response from content script' });
        });
      });
      
      if (result.ok) {
        slog(`Element highlighted successfully: ${selector}`);
        return send({ ok: true });
      } else {
        return send({ ok: false, error: result.error || 'Element not found' });
      }
      
    } catch (error) {
      slog('Error in handleHighlightElement:', error);
      return send({ ok: false, error: error.message });
    }
  }
  
  async function findElementInTab(tabId, selector, framePath = null) {
    try {
      // Determine target frame
      let targetFrameId = 0;
      if (framePath && framePath.length > 0) {
        targetFrameId = await resolveFrameIdFromPath(tabId, framePath);
      }
      
      // Inject test scripts if needed
      await injectScripts(tabId, targetFrameId, [
        'enhanced-common.js',
        'enhanced-player.js'
      ]);
      
      // Send message to find element
      const result = await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve({ ok: false, error: 'Element search timeout' });
        }, 10000);
        
        chrome.tabs.sendMessage(tabId, 
          { type: 'TEST_FIND_ELEMENT', selector }, 
          { frameId: targetFrameId },
          (reply) => {
            clearTimeout(timeout);
            if (chrome.runtime.lastError) {
              resolve({ ok: false, error: chrome.runtime.lastError.message });
            } else {
              resolve(reply || { ok: false, error: 'No response' });
            }
          }
        );
      });
      
      return result;
      
    } catch (error) {
      slog('Error in findElementInTab:', error);
      return { ok: false, error: error.message };
    }
  }
  
  async function getUserSelectedSelector(stepIndex) {
    try {
      const { selectorPreferences = {} } = await chrome.storage.local.get('selectorPreferences');
      return selectorPreferences[stepIndex] || null;
    } catch (error) {
      slog('Error getting user selected selector:', error);
      return null;
    }
  }
  
  async function saveSelectorPreference(stepIndex, selector) {
    try {
      const { selectorPreferences = {} } = await chrome.storage.local.get('selectorPreferences');
      selectorPreferences[stepIndex] = selector;
      await chrome.storage.local.set({ selectorPreferences });
    } catch (error) {
      slog('Error saving selector preference:', error);
    }
  }

  // Enhanced playback with better error handling
  async function playAll(rows, { interactive = false, startUrl = null } = {}) {
    try {
      const tab = await getActiveTab();
      if (!tab) {
        throw new Error('No active tab found');
      }
      
      const steps = stepsByTab.get(tab.id) || [];
      if (steps.length === 0) {
        throw new Error('No steps to play');
      }
      
      // Navigate to start URL if provided
      if (startUrl) {
        slog(`Navigating to start URL: ${startUrl}`);
        await chrome.tabs.update(tab.id, { url: startUrl });
        
        // Wait for page to load
        await new Promise((resolve) => {
          const listener = (tabId, changeInfo) => {
            if (tabId === tab.id && changeInfo.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              resolve();
            }
          };
          chrome.tabs.onUpdated.addListener(listener);
          
          // Timeout after 10 seconds
          setTimeout(() => {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }, 10000);
        });
        
        // Additional wait for dynamic content
        await new Promise(resolve => setTimeout(resolve, 1000));
        slog('Navigation to start URL completed');
      }
      
      slog(`Starting playback of ${rows.length} rows with ${steps.length} steps each`);
      
      aborted = false;
      
      for (let i = 0; i < rows.length; i++) {
        if (aborted) {
          slog('Playback aborted by user');
          break;
        }
        
        slog(`Playing row ${i + 1}/${rows.length}`);
        
        for (let k = 0; k < steps.length; k++) {
          if (aborted) break;
          
          const step = steps[k];
          const result = await runStepInFrame(tab.id, step, rows[i]);
          
          if (!result?.ok) {
            throw new Error(`Step ${k + 1} failed: ${result?.error || 'Unknown error'}`);
          }
        }
        
        // Handle interactive mode
        if (interactive && i < rows.length - 1) {
          await new Promise((resolve) => {
            pendingContinueResolve = resolve;
            chrome.runtime.sendMessage({ 
              type: 'SW_AWAITING_USER', 
              index: i, 
              total: rows.length 
            });
          });
        }
      }
      
      slog('Playback completed successfully');
      
    } catch (error) {
      slog('Error during playback:', error);
      throw error;
    }
  }

  // Grouped playback for loop groups
  async function playAllGrouped(rows, { interactive = false, startUrl = null, groupingInfo = null } = {}) {
    try {
      const tab = await getActiveTab();
      if (!tab) {
        throw new Error('No active tab found');
      }
      
      const steps = stepsByTab.get(tab.id) || [];
      if (steps.length === 0) {
        throw new Error('No steps to play');
      }
      
      // Ensure scripts are injected
      await injectScripts(tab.id, 0, [
        'enhanced-common.js',
        'enhanced-player.js',
        'data-grouping-engine.js'
      ]);
      
      // Navigate to start URL if provided
      if (startUrl) {
        slog(`Navigating to start URL: ${startUrl}`);
        await chrome.tabs.update(tab.id, { url: startUrl });
        
        // Wait for page to load
        await new Promise((resolve) => {
          const listener = (tabId, changeInfo) => {
            if (tabId === tab.id && changeInfo.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              resolve();
            }
          };
          chrome.tabs.onUpdated.addListener(listener);
          
          // Timeout after 10 seconds
          setTimeout(() => {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }, 10000);
        });
        
        // Additional wait for dynamic content
        await new Promise(resolve => setTimeout(resolve, 1000));
        slog('Navigation to start URL completed');
      }
      
      slog(`Starting grouped playback with ${rows.length} rows and ${steps.length} steps`);
      
      aborted = false;
      
      // Send grouped execution to player
      const result = await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve({ ok: false, error: 'Grouped playback timeout' });
        }, 300000); // 5 minute timeout for complex flows
        
        chrome.tabs.sendMessage(tab.id, {
          from: 'sw',
          type: 'PLAYER_RUN_WITH_GROUPS',
          steps: steps,
          rows: rows,
          groupingInfo: groupingInfo,
          startUrl: null // Already navigated
        }, (response) => {
          clearTimeout(timeout);
          resolve(response || { ok: false, error: 'No response from player' });
        });
      });
      
      if (!result.ok) {
        throw new Error(result.error || 'Grouped playback failed');
      }
      
      slog('Grouped playback completed successfully');
      
    } catch (error) {
      slog('Error during grouped playback:', error);
      throw error;
    }
  }

  // Storage functions (unchanged)
  async function listFlows() {
    const { flows = {} } = await chrome.storage.local.get('flows');
    return Object.keys(flows).sort();
  }
  
  async function saveFlow(name, steps) {
    const { flows = {} } = await chrome.storage.local.get('flows');
    flows[name] = { steps, when: Date.now() };
    await chrome.storage.local.set({ flows });
  }
  
  async function loadFlow(name) {
    const { flows = {} } = await chrome.storage.local.get('flows');
    return flows[name]?.steps || [];
  }
  
  async function deleteFlow(name) {
    const { flows = {} } = await chrome.storage.local.get('flows');
    delete flows[name];
    await chrome.storage.local.set({ flows });
  }

  // Event listeners
  chrome.runtime.onInstalled.addListener(async () => {
    try {
      await chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true });
    } catch (e) {
      slog('setPanelBehavior failed:', e?.message);
    }
  });

  chrome.action.onClicked.addListener(async (tab) => {
    try {
      if (tab?.id) {
        await chrome.sidePanel.setOptions({ 
          tabId: tab.id, 
          path: 'panel.html', 
          enabled: true 
        });
        await chrome.sidePanel.open({ tabId: tab.id });
      }
    } catch (e) {
      slog('action onClicked failed:', e?.message);
    }
  });

  // Web navigation listeners for redirect detection
  chrome.webNavigation.onBeforeNavigate.addListener((details) => {
    if (details.frameId === 0) { // Main frame only
      const tabId = details.tabId;
      if (recordingTabs.has(tabId)) {
        slog(`Page navigation starting for tab ${tabId}:`, details.url);
        trackUrlChange(tabId, details.url);
      }
    }
  });

  chrome.webNavigation.onCompleted.addListener((details) => {
    if (details.frameId === 0) { // Main frame only
      const tabId = details.tabId;
      if (recordingTabs.has(tabId)) {
        const urlInfo = trackUrlChange(tabId, details.url);
        slog(`Page navigation completed for tab ${tabId}:`, details.url);
        
        if (urlInfo.isRedirect) {
          // Preserve steps across redirect
          const preservedSteps = preserveStepsAcrossRedirect(tabId);
          slog(`Preserved ${preservedSteps.length} steps across redirect`);
        }
      }
    }
  });

  // Enhanced message handling
  chrome.runtime.onMessage.addListener((msg, sender, send) => {
    (async () => {
      try {
        // Handle debug messages
        if (msg?.type === 'DEBUG_TEST') {
          slog('Debug test message received from tab:', sender.tab?.id);
          return send({ ok: true, message: 'Service worker is working' });
        }
        
        // Handle recorder steps
        if (msg?.type === 'RECORDER_STEP' && sender.tab) {
          const tabId = sender.tab.id;
          if (!stepsByTab.has(tabId)) {
            stepsByTab.set(tabId, []);
          }
          
          const framePath = await buildFramePath(tabId, sender.frameId ?? 0);
          const step = { 
            ...msg.payload, 
            frameId: sender.frameId ?? 0, 
            framePath 
          };
          
          stepsByTab.get(tabId).push(step);
          slog('RECORDER_STEP', tabId, step.type, step.target?.css, 'frameId=', step.frameId);
          return send?.({ ok: true });
        }
        
        // Handle recorder clips
        if (msg?.type === 'RECORDER_CLIP' && sender.tab) {
          const tabId = sender.tab.id;
          if (!clipsByTab.has(tabId)) {
            clipsByTab.set(tabId, []);
          }
          
          const framePath = await buildFramePath(tabId, sender.frameId ?? 0);
          const frameUrl = framePath?.[framePath.length - 1]?.url;
          
          clipsByTab.get(tabId).push({ 
            ...msg.payload, 
            frameUrl 
          });
          return send?.({ ok: true });
        }
        
        // Handle panel messages
        if (msg?.from !== 'panel') return;
        
        switch (msg.type) {
          case 'PANEL_START':
            await startRecording(msg.seedRow);
            send({ ok: true });
            break;
            
          case 'PANEL_STOP':
            const steps = await stopRecording();
            send({ ok: true, steps });
            break;
            
          case 'PANEL_GET_STEPS':
            const tab = await getActiveTab();
            send({ ok: true, steps: stepsByTab.get(tab?.id) || [] });
            break;
            
          case 'PANEL_GET_START_URL':
            const urlTab = await getActiveTab();
            const startUrl = urlTab ? startUrls.get(urlTab.id) : null;
            send({ ok: true, startUrl });
            break;
            
          case 'PANEL_CLEAR_STEPS':
            const clearTab = await getActiveTab();
            if (clearTab) stepsByTab.set(clearTab.id, []);
            send({ ok: true });
            break;
            
          case 'PANEL_PLAY_ALL':
            await playAll(msg.rows || [], { 
              interactive: !!msg.interactive,
              startUrl: msg.startUrl 
            });
            send({ ok: true });
            break;
            
          case 'PANEL_CONTINUE':
            if (pendingContinueResolve) pendingContinueResolve();
            send({ ok: true });
            break;
            
          case 'PANEL_STOP_PLAYBACK':
            aborted = true;
            if (pendingContinueResolve) pendingContinueResolve();
            send({ ok: true });
            break;
            
          case 'PANEL_LIST_FLOWS':
            send({ ok: true, names: await listFlows() });
            break;
            
          case 'PANEL_SAVE_FLOW':
            const saveTab = await getActiveTab();
            await saveFlow(msg.name, stepsByTab.get(saveTab?.id) || []);
            send({ ok: true });
            break;
            
          case 'PANEL_LOAD_FLOW':
            const loadSteps = await loadFlow(msg.name);
            const loadTab = await getActiveTab();
            if (loadTab) stepsByTab.set(loadTab.id, loadSteps);
            send({ ok: true });
            break;
            
          case 'PANEL_DELETE_FLOW':
            await deleteFlow(msg.name);
            send({ ok: true });
            break;
            
          case 'PANEL_GET_CLIPS':
            const clipsTab = await getActiveTab();
            send({ ok: true, clips: clipsByTab.get(clipsTab?.id) || [] });
            break;
            
          case 'PANEL_TEST_FIND_ELEMENT':
            await handleTestFindElement(msg, send);
            break;
            
          case 'PANEL_TEST_HIGHLIGHT_ELEMENT':
            await handleTestHighlightElement(msg, send);
            break;
            
          case 'PANEL_TEST_SELECTOR':
            await handleTestSelector(msg, send);
            break;
            
          case 'PANEL_TEST_EXECUTE_STEP':
            await handleTestExecuteStep(msg, send);
            break;
            
          case 'PANEL_UPDATE_STEP':
            await handleUpdateStep(msg, send);
            break;
            
          case 'PANEL_DELETE_STEP':
            await handleDeleteStep(msg, send);
            break;
            
          case 'PANEL_HIGHLIGHT_ELEMENT':
            await handleHighlightElement(msg, send);
            break;
            
          case 'PANEL_SET_STEPS':
            // Allow manual setting of steps (for inserting special steps)
            const setTab = await getActiveTab();
            if (setTab && msg.steps) {
              stepsByTab.set(setTab.id, msg.steps);
              slog(`Set ${msg.steps.length} steps for tab ${setTab.id}`);
              send({ ok: true });
            } else {
              send({ ok: false, error: 'No tab or steps provided' });
            }
            break;
            
          case 'PANEL_PLAY_ALL_GROUPED':
            // Play with grouped execution (for loop groups)
            await playAllGrouped(msg.rows || [], { 
              interactive: !!msg.interactive,
              startUrl: msg.startUrl,
              groupingInfo: msg.groupingInfo
            });
            send({ ok: true });
            break;
            
          case 'DATASET_BUTTON_SUCCESS':
          case 'DATASET_DROP_SUCCESS':
            // These are responses from content script, just acknowledge
            send({ ok: true });
            break;
            
          default:
            send({ ok: false, error: 'Unknown message type' });
        }
      } catch (error) {
        slog('Error handling message:', error);
        send({ ok: false, error: String(error?.stack || error) });
      }
    })();
    return true;
  });

  // Enhanced frame reinjection
  chrome.webNavigation.onCommitted.addListener(async ({ tabId, frameId }) => {
    if (!recordingTabs.has(tabId)) return;
    
    try {
      const success = await injectScripts(tabId, frameId, [
        'enhanced-common.js',
        'enhanced-recorder.js'
      ]);
      
      if (success) {
        // Send seed data to new frame
        const seedRow = seedRowByTab.get(tabId);
        if (seedRow) {
          try {
            await chrome.tabs.sendMessage(tabId, 
              { type: 'RECORDER_START' }, 
              { frameId }
            );
            await chrome.tabs.sendMessage(tabId, 
              { type: 'RECORDER_SEED', seedRow }, 
              { frameId }
            );
          } catch (e) {
            slog('Failed to send seed to new frame:', frameId);
          }
        }
      }
    } catch (e) {
      slog('Frame reinjection failed:', e?.message);
    }
  });

  chrome.webNavigation.onDOMContentLoaded.addListener(async ({ tabId, frameId }) => {
    if (!recordingTabs.has(tabId)) return;
    
    try {
      await injectScripts(tabId, frameId, [
        'enhanced-common.js',
        'enhanced-recorder.js'
      ]);
    } catch (e) {
      slog('DOMContentLoaded reinjection failed:', e?.message);
    }
  });

  slog('Enhanced service worker loaded');
})();
