import { lazy, Suspense } from 'react';

// Lazy wrapper so highlight.js + the Markdown pipeline are code-split into their
// own chunk (loaded only when a thread renders). Falls back to plain text while
// the chunk loads — React still escapes it, so this stays safe.
const MarkdownView = lazy(() => import('./MarkdownView.jsx'));

export default function Markdown({ children }) {
  return (
    <Suspense fallback={<div className="markdown">{children ?? ''}</div>}>
      <MarkdownView>{children}</MarkdownView>
    </Suspense>
  );
}
