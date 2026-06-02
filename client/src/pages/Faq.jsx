import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listFaqs, searchFaqs } from '../api/faq.js';
import { searchQueries } from '../api/queries.js';

const PREVIEW_COUNT = 5; // items shown before "View all" expands a category

export default function Faq() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [term, setTerm] = useState('');
  const [results, setResults] = useState(null);
  const [forumResults, setForumResults] = useState(null); // null until the user opts in
  const [checkingForum, setCheckingForum] = useState(false);
  const [openItems, setOpenItems] = useState({});
  const [openCats, setOpenCats] = useState({});
  const [showAll, setShowAll] = useState({});

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await listFaqs();
        if (active) {
          setGroups(data);
          // Open the first category by default (matches the reference).
          if (data[0]) setOpenCats({ [data[0].category]: true });
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Dynamic search: query the FAQ semantically as the user types (debounced).
  // The community forum is NOT searched here — only after the user opts in via
  // the "check the forum" prompt shown when the FAQ has no match.
  useEffect(() => {
    if (!term.trim()) {
      setResults(null);
      setForumResults(null);
      return undefined;
    }
    let active = true;
    // A new search invalidates any previous forum opt-in.
    setForumResults(null);
    const t = setTimeout(async () => {
      try {
        const faq = await searchFaqs(term);
        if (active) setResults(faq);
      } catch {
        /* ignore transient search errors */
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [term]);

  const onSearch = (e) => e.preventDefault();

  // The user said "yes, check the forum" → now search the community database.
  const checkForum = async () => {
    if (checkingForum) return;
    setCheckingForum(true);
    try {
      const forum = await searchQueries(term).catch(() => []);
      setForumResults(forum);
    } finally {
      setCheckingForum(false);
    }
  };

  const toggleItem = (key) => setOpenItems((o) => ({ ...o, [key]: !o[key] }));
  const toggleCat = (cat) => setOpenCats((o) => ({ ...o, [cat]: !o[cat] }));

  return (
    <div className="container">
      <h1>Browse FAQs</h1>
      <p className="lead">
        Definitive answers for clarity. Browse categories below or search to pinpoint guidance.
      </p>

      <form className="search-bar faq-search" onSubmit={onSearch}>
        <span className="material-symbols-outlined">search</span>
        <input
          placeholder="Search by keyword, concept, or natural-language query…"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
        <button className="btn-primary">Search</button>
        {results !== null && (
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setTerm('');
              setResults(null);
              setForumResults([]);
            }}
          >
            Clear
          </button>
        )}
      </form>
      <p className="search-hint">
        <span className="material-symbols-outlined">bolt</span>
        Semantic search is active — try asking full questions like “how do I report data?”
      </p>
      <p className="search-hint">
        Can't find an answer? Check the forum or <Link to="/ask">raise a Query</Link>.
      </p>

      {results !== null ? (
        <>
          <section>
            <h2>FAQ results</h2>
            {results.length === 0 ? (
              // Not in the general FAQ → offer to check the forum (consent-gated).
              forumResults === null ? (
                <div className="forum-offer card">
                  <p>
                    <strong>Not in the FAQ.</strong> Do you want me to check in the forum?
                  </p>
                  <button className="btn-primary" onClick={checkForum} disabled={checkingForum}>
                    {checkingForum ? 'Checking the forum…' : 'Yes, check the forum'}
                  </button>
                </div>
              ) : null
            ) : (
              <div className="faq-accordion">
                {results.map((r) => (
                  <FaqItem key={r.id} entry={r} open={openItems[r.id]} onToggle={() => toggleItem(r.id)} />
                ))}
              </div>
            )}
          </section>
          {forumResults !== null && (
            <section>
              <h2>Community questions</h2>
              {forumResults.length === 0 ? (
                <p className="muted">
                  Nothing in the forum either. <Link to="/ask">Raise a Query</Link> and the community
                  will help.
                </p>
              ) : (
                <ul className="forum-results">
                  {forumResults.map((r) => (
                    <li key={r.id}>
                      <Link to={`/queries/${r.id}`}>{r.title}</Link>
                      <span className={`badge status-${r.status}`}>{r.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      ) : loading ? (
        <p>Loading…</p>
      ) : groups.length === 0 ? (
        <p className="muted">No FAQ entries yet.</p>
      ) : (
        <div className="faq-categories">
          {groups.map((g) => {
            const isOpen = !!openCats[g.category];
            const all = !!showAll[g.category];
            const visible = all ? g.items : g.items.slice(0, PREVIEW_COUNT);
            return (
              <section key={g.category} className={`faq-cat ${isOpen ? 'open' : ''}`}>
                <button className="faq-cat-head" onClick={() => toggleCat(g.category)}>
                  <span className="faq-cat-name">{g.category}</span>
                  <span className="chip">{g.items.length} Articles</span>
                  <span className="material-symbols-outlined chev">
                    {isOpen ? 'expand_less' : 'expand_more'}
                  </span>
                </button>
                {isOpen && (
                  <div className="faq-accordion">
                    {visible.map((item) => (
                      <FaqItem
                        key={item.id}
                        entry={item}
                        open={openItems[item.id]}
                        onToggle={() => toggleItem(item.id)}
                      />
                    ))}
                    {g.items.length > PREVIEW_COUNT && (
                      <button
                        className="btn-ghost view-all"
                        onClick={() => setShowAll((s) => ({ ...s, [g.category]: !all }))}
                      >
                        {all ? 'Show fewer' : `View all ${g.items.length} articles`}
                      </button>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      <div className="card ticket-cta">
        <div>
          <strong>Still can't find the answer?</strong>
          <p className="muted">Our community and team can help with deeper questions.</p>
        </div>
        <Link to="/ask" className="btn-primary">
          Raise a Query
        </Link>
      </div>
    </div>
  );
}

function FaqItem({ entry, open, onToggle }) {
  return (
    <div className={`faq-item ${open ? 'open' : ''}`}>
      <button className="faq-q" onClick={onToggle}>
        <span className="faq-q-text">
          {entry.question}
          {entry.source === 'qa' && <span className="chip promoted">Promoted from Q&amp;A</span>}
        </span>
        <span className="chevron">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="faq-a">{entry.answer}</div>}
    </div>
  );
}
