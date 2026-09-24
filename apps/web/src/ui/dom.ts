type Attrs = Record<string, string | boolean | ((event: Event) => void)>;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (typeof value === 'function') el.addEventListener(key.replace(/^on/, ''), value);
    else if (typeof value === 'boolean') el.toggleAttribute(key, value);
    else el.setAttribute(key, value);
  }
  el.append(...children);
  return el;
}
