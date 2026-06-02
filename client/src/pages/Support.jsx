import { Link } from 'react-router-dom';

// Support / help landing. Routes users to the self-service tools that already
// exist (FAQ, chatbot, forum) before they open a formal query.
export default function Support() {
  return (
    <div className="container">
      <h1>Support</h1>
      <p className="lead">Need a hand? Start with the knowledge base, then ask the community.</p>

      <ul className="feature-grid">
        <li>
          <strong>Browse the FAQ</strong>
          <p className="muted">Curated answers with semantic search.</p>
          <Link to="/faq" className="btn-secondary">
            Open FAQ
          </Link>
        </li>
        <li>
          <strong>Ask the Assistant</strong>
          <p className="muted">The chatbot answers from the knowledge base — bottom-right.</p>
        </li>
        <li>
          <strong>Ask the Community</strong>
          <p className="muted">Post a question and get help from contributors.</p>
          <Link to="/ask" className="btn-secondary">
            Raise a Query
          </Link>
        </li>
      </ul>
    </div>
  );
}
