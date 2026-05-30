import { useRef, useState, useEffect } from 'react';

// Minimal Markdown composer: a formatting toolbar that wraps the current
// textarea selection. Controlled via `value` / `onChange`.
const TOOLS = [
  { icon: 'format_bold', label: 'Bold', before: '**', after: '**', ph: 'bold text' },
  { icon: 'format_italic', label: 'Italic', before: '_', after: '_', ph: 'italic text' },
  { icon: 'code', label: 'Code', before: '`', after: '`', ph: 'code' },
  { icon: 'link', label: 'Link', before: '[', after: '](https://)', ph: 'link text' },
];

export default function MarkdownEditor({ value, onChange, placeholder, rows = 6, ...rest }) {
  const ref = useRef(null);
  const [pending, setPending] = useState(null);

  // Restore the selection after a toolbar insertion re-renders the textarea.
  useEffect(() => {
    if (pending && ref.current) {
      ref.current.focus();
      ref.current.setSelectionRange(pending.start, pending.end);
      setPending(null);
    }
  }, [pending]);

  const apply = (tool) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end) || tool.ph;
    const next = value.slice(0, start) + tool.before + selected + tool.after + value.slice(end);
    onChange(next);
    const cursor = start + tool.before.length;
    setPending({ start: cursor, end: cursor + selected.length });
  };

  return (
    <div className="md-editor">
      <div className="md-toolbar">
        {TOOLS.map((t) => (
          <button type="button" key={t.label} title={t.label} onClick={() => apply(t)}>
            <span className="material-symbols-outlined">{t.icon}</span>
          </button>
        ))}
        <span className="md-hint">Markdown supported</span>
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        {...rest}
      />
    </div>
  );
}
