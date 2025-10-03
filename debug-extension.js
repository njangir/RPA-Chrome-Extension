// debug-extension.js - Diagnostic script to check extension functionality
(() => {
  'use strict';
  
  console.log('🔍 [DEBUG] Extension diagnostic script loaded');
  
  // Check if enhanced common is loaded
  if (window.__mvpEnhancedCommon) {
    console.log('✅ [DEBUG] Enhanced common utilities loaded');
  } else {
    console.log('❌ [DEBUG] Enhanced common utilities NOT loaded');
  }
  
  // Check if recorder is installed
  if (window.__mvp_enhanced_recorder_installed__) {
    console.log('✅ [DEBUG] Enhanced recorder installed');
  } else {
    console.log('❌ [DEBUG] Enhanced recorder NOT installed');
  }
  
  // Check if player is installed
  if (window.__mvp_enhanced_player_installed__) {
    console.log('✅ [DEBUG] Enhanced player installed');
  } else {
    console.log('❌ [DEBUG] Enhanced player NOT installed');
  }
  
  // Check Chrome runtime
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    console.log('✅ [DEBUG] Chrome runtime available');
    console.log('🔍 [DEBUG] Extension ID:', chrome.runtime.id);
  } else {
    console.log('❌ [DEBUG] Chrome runtime NOT available');
  }
  
  // Test message sending
  if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
    chrome.runtime.sendMessage({ type: 'DEBUG_TEST' }, (response) => {
      if (chrome.runtime.lastError) {
        console.log('❌ [DEBUG] Message sending failed:', chrome.runtime.lastError.message);
      } else {
        console.log('✅ [DEBUG] Message sending works, response:', response);
      }
    });
  }
  
  // Check if we're in a frame
  if (window !== window.top) {
    console.log('🔍 [DEBUG] Running in iframe, frame URL:', window.location.href);
  } else {
    console.log('🔍 [DEBUG] Running in main frame');
  }
  
  // Check for CSP issues
  try {
    eval('console.log("✅ [DEBUG] eval() works - no strict CSP")');
  } catch (e) {
    console.log('⚠️ [DEBUG] eval() blocked by CSP:', e.message);
  }
  
  // Check document ready state
  console.log('🔍 [DEBUG] Document ready state:', document.readyState);
  
  // Check for any existing event listeners
  const hasClickListeners = document.addEventListener.toString().includes('native code');
  console.log('🔍 [DEBUG] Native addEventListener available:', hasClickListeners);
  
  // Test element creation
  try {
    const testEl = document.createElement('div');
    testEl.style.display = 'none';
    document.body.appendChild(testEl);
    document.body.removeChild(testEl);
    console.log('✅ [DEBUG] DOM manipulation works');
  } catch (e) {
    console.log('❌ [DEBUG] DOM manipulation failed:', e.message);
  }
  
  console.log('🔍 [DEBUG] Diagnostic complete');
})();
