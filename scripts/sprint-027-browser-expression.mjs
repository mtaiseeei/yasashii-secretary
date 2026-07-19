// Keep the browser-side DOM expression in a small, directly testable module.
// Runtime.evaluate validates this string only when Chrome parses it, so the
// standalone fixture test also compiles and executes the same expression.
export function buildObserveExpression() {
  return `(() => {
    const app = document.querySelector('#app');
    const operations = [...app.querySelectorAll('button,a,summary,label.choice,label.consent')]
      .filter((node) => {
        let current = node;
        while (current) {
          const style = getComputedStyle(current);
          if (current.hidden || current.inert || current.getAttribute?.('aria-hidden') === 'true' ||
              style.display === 'none' || style.visibility === 'hidden' ||
              style.visibility === 'collapse' || style.opacity === '0' ||
              style.pointerEvents === 'none' || (current.tagName === 'DETAILS' && !current.open && current !== node && node.tagName !== 'SUMMARY')) {
            return false;
          }
          current = current.parentElement;
        }
        if (node.disabled || node.getAttribute?.('aria-disabled') === 'true') return false;
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
    const rect = (node) => {
      const r = node.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    };
    const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const boxes = operations.map(rect);
    let overlapCount = 0;
    for (let i = 0; i < operations.length; i += 1) {
      for (let j = i + 1; j < operations.length; j += 1) {
        if (operations[i].contains(operations[j]) || operations[j].contains(operations[i])) continue;
        if (overlaps(boxes[i], boxes[j])) overlapCount += 1;
      }
    }
    return {
      screen: app.dataset.screen,
      heading: app.querySelector('h1')?.textContent,
      active: {
        tag: document.activeElement?.tagName,
        id: document.activeElement?.id,
        name: document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent?.trim().slice(0, 80),
      },
      overflow: document.documentElement.scrollWidth > innerWidth,
      controlMinHeight: operations.length ? Math.min(...boxes.map((box) => box.height)) : 0,
      overlapCount,
      controls: operations.length,
      summaryCount: app.querySelectorAll('summary').length,
      summaryClosed: [...app.querySelectorAll('details')].every((detail) => !detail.open),
      serviceName: app.getAttribute('aria-label'),
      focusName: document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent?.trim() || '',
    };
  })()`;
}
