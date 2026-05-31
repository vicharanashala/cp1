import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { askChatbot, getChatSession } from '../api/chatbot.js';

const TOKEN_KEY = 'chatbotSession';
const TIER_LABEL = { faq: 'FAQ', community: 'Community Q&A', ai: 'AI', fallback: '' };

export default function Chatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const token = useRef(localStorage.getItem(TOKEN_KEY));
  const scrollRef = useRef(null);

  // Allow other parts of the app (e.g. the Home "Ask the Assistant" card) to
  // open the assistant by dispatching a window event.
  useEffect(() => {
    const openIt = () => setOpen(true);
    window.addEventListener('open-chatbot', openIt);
    return () => window.removeEventListener('open-chatbot', openIt);
  }, []);

  // Restore prior conversation when the panel first opens.
  useEffect(() => {
    if (!open || !token.current || messages.length) return;
    (async () => {
      try {
        const s = await getChatSession(token.current);
        setMessages(s.messages ?? []);
      } catch {
        /* start fresh */
      }
    })();
  }, [open, messages.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, busy]);

  const send = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setBusy(true);
    try {
      const res = await askChatbot(text, token.current);
      token.current = res.session_token;
      localStorage.setItem(TOKEN_KEY, res.session_token);
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: res.content,
          source_tier: res.source_tier,
          citations: res.citations,
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: 'Sorry, I had trouble answering. Please try again.', source_tier: 'fallback' },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button className="chat-fab" onClick={() => setOpen((o) => !o)} aria-label="Open chatbot">
        {open ? '×' : '💬'}
      </button>

      {open && (
        <div className="chat-panel">
          <div className="chat-header">Ask the assistant</div>
          <div className="chat-messages" ref={scrollRef}>
            {messages.length === 0 && (
              <p className="muted chat-hint">
                Ask a question and I'll search the FAQ and community answers.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`chat-msg ${m.role}`}>
                <div className="bubble">{m.content}</div>
                {m.role === 'assistant' && m.source_tier && m.source_tier !== 'fallback' && (
                  <div className="chat-cite">
                    Source: {TIER_LABEL[m.source_tier] ?? m.source_tier}
                    {m.citations?.map((c) =>
                      c.kind === 'query' ? (
                        <Link key={c.ref_id} to={`/queries/${c.ref_id}`}>
                          {c.title}
                        </Link>
                      ) : (
                        <span key={c.ref_id} className="cite-faq">
                          {c.title}
                        </span>
                      ),
                    )}
                  </div>
                )}
              </div>
            ))}
            {busy && <div className="chat-msg assistant"><div className="bubble">…</div></div>}
          </div>
          <form className="chat-input" onSubmit={send}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your question…"
              disabled={busy}
            />
            <button className="btn-primary" disabled={busy || !input.trim()}>
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
