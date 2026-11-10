/**
 * Build an element. Props: `class`, `for`, `on<event>` handlers, `dataset`, and anything else as an
 * attribute (false/null/undefined are left out; true becomes an empty attribute). `value`, `checked`
 * and `selected` are set as properties so form controls show them.
 * Children: strings, elements, arrays of those; null/false are skipped.
 */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === false || value === null || value === undefined) continue;
    if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'class') el.className = value;
    else if (key === 'for') el.htmlFor = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key === 'value' || key === 'checked' || key === 'selected') { el[key] = value; if (value === true) el.setAttribute(key, ''); else if (key === 'value') el.setAttribute('value', value); }
    else el.setAttribute(key, value === true ? '' : value);
  }
  const add = (child) => {
    if (child === null || child === undefined || child === false) return;
    if (Array.isArray(child)) child.forEach(add);
    else el.append(child instanceof Node ? child : String(child));
  };
  children.forEach(add);
  return el;
}

/** A <label> and its control, tied together by id. */
export function field(labelText, control, { error, hint, cls = 'field' } = {}) {
  const id = control.id;
  if (error) {
    control.setAttribute('aria-invalid', 'true');
    control.setAttribute('aria-describedby', `${id}-error`);
  }
  return h('div', { class: cls },
    h('label', { for: id }, labelText),
    control,
    hint && h('p', { class: 'hint' }, hint),
    error && h('p', { class: 'field-error', id: `${id}-error` }, error));
}
