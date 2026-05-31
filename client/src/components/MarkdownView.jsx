import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css';

// Heavy renderer (pulls in highlight.js) — loaded lazily via Markdown.jsx so it
// only ships on the question-thread route, keeping the main bundle lean.
export default function MarkdownView({ children }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          // Strip the AST `node` prop and open links in a new tab.
          a: ({ node: _node, ...props }) => <a target="_blank" rel="noreferrer" {...props} />,
        }}
      >
        {children ?? ''}
      </ReactMarkdown>
    </div>
  );
}
