// common.js
(() => {
  if (window.__mvpCommon) return;

  function log(...args) {
    console.log('[MVP]', ...args);
  }

  function cssEscapeIdent(ident) {
    if (window.CSS && CSS.escape) return CSS.escape(ident);
    return String(ident).replace(/[^a-zA-Z0-9_\-]/g, c => '\\' + c.codePointAt(0).toString(16) + ' ');
  }

  function nthOfType(el) {
    let i = 0, n = 0;
    const tag = el.tagName, p = el.parentElement;
    if (!p) return 0;
    for (const c of p.children) {
      if (c.tagName === tag) {
        n++;
        if (c === el) i = n;
      }
    }
    return i;
  }

  function cssPath(el) {
    if (!(el instanceof Element)) return '';
    const path = [];
    while (el && el.nodeType === Node.ELEMENT_NODE) {
      let sel = el.nodeName.toLowerCase();
      if (el.id) {
        sel += `#${cssEscapeIdent(el.id)}`;
        path.unshift(sel);
        break;
      } else {
        const nth = nthOfType(el);
        if (nth > 0) sel += `:nth-of-type(${nth})`;
        path.unshift(sel);
        el = el.parentElement;
      }
    }
    return path.join(' > ');
  }

  function getTextSnippet(el) {
    const t = (el?.innerText || el?.textContent || '').trim();
    return t ? t.slice(0, 40) : undefined;
  }

  function nearestLabelText(el) {
    try {
      if (!el) return;
      const id = el.getAttribute?.('id');
      if (id) {
        const lab = document.querySelector(`label[for="${cssEscapeIdent(id)}"]`);
        if (lab) return lab.innerText?.trim();
      }
      const wrap = el.closest('label');
      return wrap?.innerText?.trim();
    } catch {}
  }

  function buildLocator(el) {
    const tag = el.tagName.toLowerCase();
    const signature = {
      tag,
      id: el.id || undefined,
      classes: Array.from(el.classList || []),
      nameAttr: el.getAttribute('name') || undefined,
      dataTestId: el.getAttribute('data-testid') || undefined,
      ariaLabel: el.getAttribute('aria-label') || undefined,
      labelText: nearestLabelText(el) || undefined,
      placeholder: el.getAttribute('placeholder') || undefined,
      nthOfType: nthOfType(el),
      textSnippet: getTextSnippet(el)
    };

    let css = null;
    if (el.id) css = `#${cssEscapeIdent(el.id)}`;
    else if (signature.dataTestId) css = `[data-testid="${signature.dataTestId}"]`;
    else if (signature.nameAttr) css = `${tag}[name="${signature.nameAttr}"]`;
    else if (signature.ariaLabel) css = `${tag}[aria-label="${signature.ariaLabel}"]`;
    else if (signature.placeholder) css = `${tag}[placeholder="${signature.placeholder}"]`;
    if (!css) css = cssPath(el);

    return { css, signature };
  }

  function isTextInput(el) {
    if (!el) return false;
    if (el.isContentEditable) return true;
    const tag = el.tagName?.toLowerCase();
    if (tag === 'textarea') return true;
    if (tag === 'input') {
      const type = (el.getAttribute('type') || 'text').toLowerCase();
      return ['text', 'email', 'number', 'search', 'tel', 'url', 'password', 'date', 'datetime-local', 'time'].includes(type);
    }
    return false;
  }

  function getFramePath() {
    return { frameIds: [] }; // placeholder
  }

  function inferPlaceholder(raw) {
    const s = (raw ?? '').toString().trim();
    const n = Number(s);
    if (Number.isInteger(n) && n >= 1 && n <= 1000) return { placeholderIndex: n };
    const m = s.match(/^\s*(?:\{\{([^}]+)\}\}|<<([^>]+)>>)\s*$/);
    if (m) return { placeholderKey: (m[1] || m[2]).trim() };
    return {};
  }

  function getValueFromRow(step, row) {
    if (step.placeholderKey && row && Object.prototype.hasOwnProperty.call(row, step.placeholderKey))
      return row[step.placeholderKey];
    if (step.placeholderIndex) {
      const vals = Array.isArray(row) ? row : Object.values(row || {});
      return vals[step.placeholderIndex - 1];
    }
    return step.originalTextSample || '';
  }

  window.__mvpCommon = {
    log,
    buildLocator,
    isTextInput,
    getFramePath,
    inferPlaceholder,
    getValueFromRow
  };

  log('common.js loaded');
})();
