/**
 * Shared color field UI for table/cell property dialogs (and reusable elsewhere).
 * Uses the same swatch list + hex + native picker pattern as the toolbar foreColor control.
 */

/** Convert rgb()/rgba()/hex color strings to #RRGGBB (or null). */
export function normalizeHex(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let v = String(raw).trim();
  if (!v) return null;

  const rgbMatch = v.match(
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*[\d.]+)?\s*\)$/i
  );
  if (rgbMatch) {
    const toHex = (n: string) => {
      const x = Math.max(0, Math.min(255, parseInt(n, 10) || 0));
      return (x < 16 ? '0' : '') + x.toString(16).toUpperCase();
    };
    return '#' + toHex(rgbMatch[1]) + toHex(rgbMatch[2]) + toHex(rgbMatch[3]);
  }

  if (v.charAt(0) !== '#') v = '#' + v;
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    v = '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(v)) return null;
  return v.toUpperCase();
}

export interface ColorFieldHandle {
  root: HTMLElement;
  getValue: () => string;
  setValue: (hex: string) => void;
  /** Empty string means "no color" / transparent */
  getValueOrEmpty: () => string;
}

/**
 * Build an inline color field: label, swatches, hex input, native color picker, optional clear.
 */
export function createColorField(options: {
  id: string;
  label: string;
  colors?: string[];
  initial?: string;
  allowEmpty?: boolean;
}): ColorFieldHandle {
  const colors = options.colors || [];
  const allowEmpty = !!options.allowEmpty;
  let current = normalizeHex(options.initial) || '';

  const root = document.createElement('div');
  root.className = 'rte-color-field';
  root.setAttribute('data-color-field', options.id);

  const labelEl = document.createElement('label');
  labelEl.className = 'rte-color-field-label';
  labelEl.textContent = options.label;
  labelEl.htmlFor = options.id + '-hex';
  root.appendChild(labelEl);

  const row = document.createElement('div');
  row.className = 'rte-color-field-row';

  const preview = document.createElement('button');
  preview.type = 'button';
  preview.className = 'rte-color-field-preview';
  preview.title = 'Current color';
  preview.setAttribute('aria-label', options.label + ' preview');

  const hexInput = document.createElement('input');
  hexInput.type = 'text';
  hexInput.id = options.id + '-hex';
  hexInput.className = 'rte-color-field-hex';
  hexInput.placeholder = allowEmpty ? 'none' : '#000000';
  hexInput.spellcheck = false;
  hexInput.autocomplete = 'off';
  hexInput.maxLength = 7;

  const native = document.createElement('input');
  native.type = 'color';
  native.className = 'rte-color-field-native';
  native.title = 'Pick color';
  native.value = current || '#000000';

  const applyPreview = () => {
    if (current) {
      preview.style.background = current;
      preview.classList.remove('is-empty');
      hexInput.value = current;
      native.value = current;
    } else {
      preview.style.background = 'transparent';
      preview.classList.add('is-empty');
      hexInput.value = '';
      native.value = '#000000';
    }
  };

  const setValue = (hex: string) => {
    const n = normalizeHex(hex);
    current = n || (allowEmpty ? '' : current);
    if (!allowEmpty && !n && hex) {
      // keep previous
    } else if (!n && allowEmpty) {
      current = '';
    } else if (n) {
      current = n;
    }
    applyPreview();
  };

  hexInput.addEventListener('change', () => {
    const n = normalizeHex(hexInput.value);
    if (n) {
      setValue(n);
    } else if (allowEmpty && !hexInput.value.trim()) {
      setValue('');
    } else {
      applyPreview();
    }
  });
  hexInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      hexInput.dispatchEvent(new Event('change'));
    }
  });
  native.addEventListener('input', () => {
    setValue(native.value);
  });
  preview.addEventListener('click', (e) => {
    e.preventDefault();
    native.click();
  });

  row.appendChild(preview);
  row.appendChild(hexInput);
  row.appendChild(native);

  if (allowEmpty) {
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'rte-color-field-clear';
    clearBtn.textContent = 'Clear';
    clearBtn.addEventListener('click', (e) => {
      e.preventDefault();
      setValue('');
    });
    row.appendChild(clearBtn);
  }

  root.appendChild(row);

  if (colors.length) {
    const swatches = document.createElement('div');
    swatches.className = 'rte-color-field-swatches';
    colors.forEach((c) => {
      const sw = document.createElement('button');
      sw.type = 'button';
      sw.className = 'rte-color-field-swatch';
      sw.title = c;
      sw.style.background = c;
      sw.addEventListener('click', (e) => {
        e.preventDefault();
        setValue(c);
      });
      swatches.appendChild(sw);
    });
    root.appendChild(swatches);
  }

  applyPreview();

  return {
    root,
    getValue: () => current || '#000000',
    getValueOrEmpty: () => current,
    setValue,
  };
}
