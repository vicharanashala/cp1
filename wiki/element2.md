# Ask a Query & Forum Engine

## Overview

The Ask a Query & Forum Engine provides a structured community support system where users can post questions, receive answers, participate in threaded discussions, vote on content, bookmark useful queries, and finalize solutions. The module combines traditional forum functionality with AI-assisted quality control, duplicate detection, and automated solution resolution workflows.

The implementation is distributed across frontend pages (`AskQuery.jsx`, `QueryList.jsx`, `QueryDetail.jsx`) and backend services (`queryService.js`, `answerService.js`, `solutionService.js`, `gibberishService.js`, `spamService.js`, and `vectorService.js`).

Key capabilities include:

* Structured query submission
* Category and tag taxonomy enforcement
* Screenshot attachments
* AI-assisted grammar correction
* Gibberish detection
* Spam prevention and penalty escalation
* Duplicate query detection using vector similarity
* Hybrid keyword and semantic search
* Answer management
* Threaded comments
* Voting and bookmarking
* Helpful answer selection
* Automated solution finalization

---

# Architecture Overview

The Ask a Query module follows a layered architecture:

```text
AskQuery.jsx
    │
    ▼
POST /api/queries
    │
    ▼
queryService.createQuery()
    ├── Taxonomy Validation
    ├── Gibberish Detection
    ├── Spam Enforcement
    ├── Embedding Generation
    ├── Duplicate Detection
    └── Query Storage

QueryList.jsx
    │
    ▼
queryService.listQueries()
    ├── Filtering
    ├── Search
    ├── Pagination
    └── Answer Count Aggregation

QueryDetail.jsx
    │
    ├── Query Voting
    ├── Query Bookmarking
    ├── Answer Creation
    ├── Helpful Marking
    ├── Comment Management
    └── Resolution Workflow

solutionService
    │
    ▼
Automatic Finalization
```

The backend services collaborate to enforce validation, moderation, duplicate prevention, and lifecycle management throughout the query resolution process.

---

# Question Posting Workflow

## Query Submission Interface

The query creation interface is implemented in `AskQuery.jsx`.

Users are required to provide:

| Field         | Required |
| ------------- | -------- |
| Title         | Yes      |
| Body          | Yes      |
| Category      | Yes      |
| Tags          | Yes      |
| Joining Date  | Yes      |
| Contact Email | Yes      |
| Attachments   | Optional |

Anonymous posting is not supported. Any anonymous flag is ignored and forced to `false` on the server.

---

## Category Selection

Categories are loaded dynamically:

```http
GET /api/taxonomy?kind=category
```

The user must select a category from the administrator-maintained taxonomy list.

No free-form categories are accepted.

---

## Tag Selection

Tags are loaded dynamically:

```http
GET /api/taxonomy?kind=tag
```

Tags are selected through predefined checkboxes.

Custom user-generated tags are not permitted.

---

## Attachment Support

The query form supports multiple image uploads.

```html
<input
  type="file"
  multiple
  accept="image/*"
/>
```

Attachments are submitted using:

```text
multipart/form-data
```

Uploaded attachments are displayed within the interface using a lightbox viewer.

The query detail page allows users to view attachment counts and open images in a zoomable preview.

---

## Grammar Correction Workflow

Before submitting a query, users may optionally perform grammar correction.

```http
POST /api/queries/autocorrect
```

The API returns:

```json
{
  "corrected": "...",
  "changes": [...]
}
```

A diff modal presents the proposed corrections.

The user may:

* Accept all changes
* Keep the original content

When corrections are accepted, both corrected content and original content are submitted.

---

## Query Creation Pipeline

Query creation is performed through:

```http
POST /api/queries
```

Backend execution sequence:

```text
queryController.createQuery()
    ↓
queryService.createQuery()
```

The service performs the following operations:

1. Input coercion
2. Taxonomy validation
3. Joining date validation
4. Contact email validation
5. Anonymous flag enforcement
6. Gibberish detection
7. Spam handling
8. Embedding generation
9. Duplicate detection
10. Query persistence

---

# Taxonomy Management

The platform uses a controlled taxonomy model.

Categories and tags are validated against records stored in the taxonomy collection.

Validation occurs during:

* Query creation
* Query update
* Moderator re-categorization

Invalid values immediately generate validation failures.

Example validation:

```text
Taxonomy.findOne({
  kind,
  name
})
```

Only administrator-approved taxonomy values may be used.

---

# Gibberish Detection Pipeline

The system implements a two-layer content quality gate.

---

## Layer 1: Heuristic Validation

Every submitted query body passes through heuristic analysis.

Checks include:

### Minimum Length

Very short submissions are rejected immediately.

### Repeated Character Detection

Examples:

```text
aaaaaaaaaaaa
!!!!!!!!!!!!
```

The service calculates a repeated-character ratio and rejects excessive repetition.

### Dictionary Word Ratio

The service evaluates:

```text
recognized_words / total_words
```

A low ratio indicates nonsensical content.

---

## Layer 1 Outcomes

### Pass

Content is considered valid.

### Fail

Content is immediately rejected.

### Borderline

Content is escalated to Layer 2 AI analysis.

---

## Layer 2: AI Evaluation

Borderline content triggers AI-based validation.

The service calls:

```text
ai.js cheapCall()
```

Expected response:

```json
{
  "isvalid": true,
  "confidence": 0.92,
  "reason": "..."
}
```

The AI determines whether the content appears meaningful.

---

## Fail-Open Strategy

If the AI service:

* Returns HTTP 429
* Times out
* Encounters an error

The submission is treated as valid.

This prevents legitimate users from being blocked during AI quota exhaustion.

---

# Spam Prevention & Penalty System

Spam enforcement is handled by `spamService.js`.

A user's spam history is tracked through:

```text
user.spamflagcount
```

Spam flags are generated when gibberish detection fails.

---

## Penalty Escalation Levels

| Offense Count | Action                                         |
| ------------- | ---------------------------------------------- |
| 1             | Warning notification                           |
| 2             | Warning badge + 24-hour ban                    |
| 5             | Restricted badge + moderator approval required |
| 10            | Permanent suspension                           |

---

## Enforcement Flow

```text
gibberishService.check()
       │
       ├── Pass
       │     ↓
       │   Continue
       │
       └── Fail
             ↓
     Increment spamflagcount
             ↓
     spamService.applySpamPenalty()
```

Each penalty update is persisted to the user record and generates appropriate notifications.

---

# Duplicate Detection & Vector Search

The platform uses embedding-based similarity detection to identify duplicate questions.

## Embedding Generation

After content validation:

```text
ai.js.embed(title + body)
```

An embedding vector is generated and stored with the query.

The embedding becomes the basis for semantic search and duplicate detection.

---

## Similarity Search

Generated embeddings are compared against existing queries using:

```text
vectorService.findSimilarQueries()
```

The service:

1. Loads stored query embeddings
2. Computes cosine similarity
3. Filters by threshold
4. Returns ranked matches

Similarity calculations are performed using:

```text
computeCosineSimilarity()
```

---

## Duplicate Detection Logic

When similarity exceeds the configured threshold:

```text
similarity > 0.80
```

the query is marked as a potential duplicate.

Query fields updated:

```text
isflaggedduplicate
duplicateof
similarityscore
```

A moderation record is also created.
