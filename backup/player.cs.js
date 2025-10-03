
// player.cs.js
(() => {
  const C = window.__mvpCommon || {};
  const log = (...a) => (C.log ? C.log('[player]', ...a) : console.log('[MVP][player]', ...a));
  if (window.__mvp_player_installed__) { log('already installed'); }
  window.__mvp_player_installed__ = true; log('attached');

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // Deep query across open shadow roots
  function* allShadowRoots(root) {
    const walker = document.createTreeWalker(root || document, NodeFilter.SHOW_ELEMENT);
    while (walker.nextNode()) {
      const el = walker.currentNode;
      if (el.shadowRoot) { yield el.shadowRoot; yield* allShadowRoots(el.shadowRoot); }
    }
  }
  function deepQuerySelector(css) {
    let el = document.querySelector(css);
    if (el) return el;
    for (const sr of allShadowRoots(document)) {
      const found = sr.querySelector(css);
      if (found) return found;
    }
    return null;
  }

  function isVisible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect?.();
    const style = el.ownerDocument?.defaultView?.getComputedStyle?.(el);
    return !!rect && rect.width > 0 && rect.height > 0 && style?.visibility !== 'hidden' && style?.display !== 'none';
  }
  function isInteractable(el) {
    return isVisible(el) && !el.disabled;
  }
  function candidateSelectors(sig) {
    const sels = [];
    if (!sig) return sels;
    // Prefer stable attributes first
    if (sig.dataTestId) sels.push(`[data-testid="${sig.dataTestId}"]`);
    if (sig.nameAttr) sels.push(`${sig.tag || '*'}[name="${sig.nameAttr}"]`);
    if (sig.ariaLabel) sels.push(`${sig.tag || '*'}[aria-label="${sig.ariaLabel}"]`);
    if (sig.placeholder) sels.push(`${sig.tag || '*'}[placeholder="${sig.placeholder}"]`);
    // If we recorded a raw id, try exact, then suffix-match (UI5)
    if (sig.id) {
      const esc = (window.CSS && CSS.escape) ? CSS.escape(sig.id) : sig.id;
      sels.push(`#${esc}`);
      sels.push(`[id$="${sig.id}"]`);   // UI5 __xmlviewX--<id>
    }
    // Light best-effort class-based fallback
    if (sig.classes && sig.classes.length) {
      sels.push(`${sig.tag || '*'}.${sig.classes.join('.')}`);
    }
    return [...new Set(sels)].filter(Boolean);
  }
  function findByLabelText(labelText) {
    if (!labelText) return null;
    const labels = Array.from(document.querySelectorAll('label'));
    const lab = labels.find(l => (l.textContent || '').trim() === labelText.trim());
    if (!lab) return null;
    const forId = lab.getAttribute('for');
    if (forId) {
      const esc = (window.CSS && CSS.escape) ? CSS.escape(forId) : forId;
      return deepQuerySelector(`#${esc}`) || lab.ownerDocument.getElementById?.(forId);
    }
    // Wrapped input inside label
    return lab.querySelector('input,textarea,select');
  }

  async function locate(locator, timeoutMs = 12000) {
    const start = performance.now(); let lastErr;
    const sig = locator?.signature || {};
    const firstTry = [locator?.css].filter(Boolean);
    const fallbacks = candidateSelectors(sig);
    const all = [...firstTry, ...fallbacks];
    while (performance.now() - start < timeoutMs) {
      for (const css of all) {
        try {
          const el = deepQuerySelector(css);
          if (el && isInteractable(el)) return el;
        } catch (e) { lastErr = e; }
      }
      // Try labelText last
      try {
        const el = findByLabelText(sig.labelText);
        if (el && isInteractable(el)) return el;
      } catch (e) { lastErr = e; }
      await sleep(250);
    }
    throw new Error('Element not found for selector: ' + (locator?.css || JSON.stringify(fallbacks)));
  }



  function setInputValueCompat(el, val) {
    if (el.isContentEditable) { el.focus(); el.innerText = val; el.dispatchEvent(new InputEvent('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return; }
    const tag = el.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea') {
      const proto = tag === 'input' ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
      const desc = Object.getOwnPropertyDescriptor(proto, 'value');
      if (desc?.set) desc.set.call(el, val); else el.value = val;
      el.dispatchEvent(new InputEvent('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  async function runSteps(steps, row) {
    for (const step of steps) {
      if (step.type === 'sleep') { await sleep(step.value || 300); continue; }
      log('step', step.type, step.target?.css);
      const el = step.target ? await locate(step.target, 8000) : document.body;
      el.scrollIntoView({ block: 'center', inline: 'center' });
      await sleep(50);
      if (step.type === 'click') { el.click(); log('clicked'); }
      else if (step.type === 'input') { const val = (C.getValueFromRow ? C.getValueFromRow(step, row) : step.originalTextSample) ?? ''; setInputValueCompat(el, val); log('input ->', val); }
      else if (step.type === 'shortcut') { el.focus(); const a = step.action; if (a === 'selectAll') { if (el.isContentEditable) { const rng = document.createRange(); rng.selectNodeContents(el); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(rng); } else if (el.select) el.select(); } /* copy/paste/cut handled by page */ }
      await sleep(step.waitAfterMs || 150);
    }
    return true;
  }

  chrome.runtime.onMessage.addListener((msg, sender, send) => {
    if (msg?.type === 'PLAYER_RUN') {
      runSteps(msg.steps || [], msg.row || {})
        .then(() => send({ ok: true }))
        .catch(err => { log('ERR run', err); send({ ok: false, error: String(err?.stack || err) }); });
      return true; // async
    }
  });
})();
