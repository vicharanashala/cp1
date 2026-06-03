# Ask a Query & Forum

## Overview

The Ask a Query & Forum Engine enables users to post questions, receive answers, participate in discussions, and discover existing solutions. The module focuses on structured query management, content quality validation, search, and community-driven problem solving.

Key capabilities include:

- Structured query submission
- Category and tag taxonomy enforcement
- Screenshot attachments
- AI-assisted grammar correction
- Noise detection
- Duplicate query detection
- Search and filtering
- Answer and comment management
- Voting and bookmarking
- Accepted answer workflows
- Automated solution finalization


---

# Question Posting Workflow

## Query Submission Interface


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

## Category & Tag Validation

Categories and tags are managed through the taxonomy system.

The backend validates:

- Category exists
- Tags are valid
- Invalid values are rejected

This helps maintain consistent organization across forum content.

---

## Attachment Support

Users can upload screenshots while creating a query.

### Features

- Multiple image uploads
- Preview before submission
- Image viewing in query details


### Features

- Multiple image uploads
- Preview before submission
- Image viewing in query details

Attachments provide additional context for discussions.

---

## Grammar Correction Workflow

Before submitting a query, users may optionally perform grammar correction.

A diff modal presents the proposed corrections.

The user may:

* Accept all changes
* Keep the original content

When corrections are accepted, both corrected content and original content are submitted.

---

## Query Creation Pipeline

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

Only administrator-approved taxonomy values may be used.

---


# Noise Detection

---


# Noise Detection

All submitted query content is evaluated for quality before it is accepted. The system checks for:

* Minimum content length
* Repeated or nonsensical characters
* Insufficient use of recognizable words

Content that fails quality checks is rejected. Repeated violations lead to progressive penalties — from warning notifications to temporary bans, moderator-approval requirements, and eventual permanent suspension.

---

## Duplicate Detection Logic

Duplicate queries are detected using semantic similarity.

### Workflow

1. Generate embeddings
2. Compare against existing queries
3. Calculate similarity scores
4. Flag potential duplicates

This reduces repeated discussions and improves knowledge reuse.

# Query Discovery & Search

The query discovery system enables users to browse, search, and filter community questions through the `QueryList.jsx` interface and the query service layer.

The backend supports:

* Status filtering
* Category filtering
* Tag filtering
* Pagination
* Full-text search
* Resolved-last ordering

All filter values received through request parameters are coerced to strings before entering MongoDB filters to prevent malformed query injection.

All submitted query content is evaluated for quality before it is accepted. The system checks for:

* Minimum content length
* Repeated or nonsensical characters
* Insufficient use of recognizable words

Content that fails quality checks is rejected. Repeated violations lead to progressive penalties — from warning notifications to temporary bans, moderator-approval requirements, and eventual permanent suspension.

---

## Duplicate Detection Logic

Duplicate queries are detected using semantic similarity.

### Workflow

1. Generate embeddings
2. Compare against existing queries
3. Calculate similarity scores
4. Flag potential duplicates

This reduces repeated discussions and improves knowledge reuse.

# Query Discovery & Search

The query discovery system enables users to browse, search, and filter community questions through the `QueryList.jsx` interface and the query service layer.

The backend supports:

* Status filtering
* Category filtering
* Tag filtering
* Pagination
* Full-text search
* Resolved-last ordering

## Search Functionality

The platform supports two search mechanisms:

* **Full-text search** — keyword-based search using text indexes.
* **Semantic search** — embedding-based search that finds conceptually similar queries even when exact keywords differ.

---
 
# Answers & Threaded Comments

 ## Answer Creation

Community members can answer open queries. Restrictions:

* Banned users cannot post answers.
* Query authors cannot answer their own questions.
* Resolved or archived queries do not accept new answers.

When an answer is submitted, the query status changes from Open to Answered and the query author receives a notification.

---

## Answer Editing & Deletion

Answers may be edited within a 15-minute window by the author, a moderator, or an administrator. The original body is preserved on edit. Deletion is soft — deleted answers are flagged rather than permanently removed. Query status is automatically reconciled when answers are deleted.

---

## Threaded Comments

Comments can be posted under individual answers. Only the query author and the answer author may participate in a comment thread. Notifications are sent to the other participant on each new comment. Comments may be soft-deleted by the comment author, a moderator, or an administrator.

---

# Voting & Bookmarking

## Voting

Both queries and answers support upvoting and downvoting. Self-voting is not permitted. For answers, only upvotes contribute to the author's reputation score; downvotes are recorded but do not reduce reputation.

---

## Bookmarking

Users can save useful queries for later reference. Saved queries are accessible from a dedicated bookmarks view and can be added or removed at any time.

---

# Helpful Answer & Resolution

## Mark Helpful

The query author, a moderator, or an administrator can mark an answer as the accepted solution. This:

* Marks the answer with a ✓ Solution badge.
* Changes the query status to Resolved.
* Prioritizes the accepted answer at the top of the thread.
* Awards reputation points to the answer author.

---

## Unmark Helpful

Authorized users may reopen a resolved discussion by removing the accepted answer. The query returns to Answered status. Previously awarded reputation points are not reversed.

---

# Automated Solution Finalization

The platform runs an automated engine that resolves queries that remain open after 48 hours.

## Eligibility

A query is eligible when its status is Answered and it is more than 48 hours old.

---

## Resolution

* If a manually accepted answer exists, it is retained and the query is marked Resolved with reputation awarded.
* If no accepted answer exists, the highest-voted answer is automatically selected as the solution. No reputation is awarded in this case.

To keep resolved threads concise, a maximum of three answers are preserved; lower-value answers are soft-deleted. Every finalization event is recorded in an audit log.

---

# Frontend Responsibilities

| Component       | Responsibility                                                                 |
| --------------- | ------------------------------------------------------------------------------ |
| AskQuery.jsx    | Query submission, attachments, grammar correction, duplicate warnings          |
| QueryList.jsx   | Search, filtering, pagination, query discovery                                 |
| QueryDetail.jsx | Full thread view, voting, bookmarking, answers, comments, resolution workflows |

---

# Service Layer Responsibilities

| Service          | Responsibility                                                        |
| ---------------- | --------------------------------------------------------------------- |
| queryService     | Query lifecycle, validation, duplicate detection, voting, bookmarking |
| answerService    | Answer management, comments, helpful workflow, verification           |
| solutionService  | Automatic solution finalization and cron execution                    |
| gibberishService | Content quality validation                                            |
| spamService      | Spam penalty enforcement                                              |
| vectorService    | Semantic similarity search and duplicate detection                    |

---
A moderation record is also created.

# Query Discovery & Search

The query discovery system enables users to browse, search, and filter community questions through the `QueryList.jsx` interface and the query service layer.

## Query Listing

Queries are retrieved through:

```http
GET /api/queries
```

The backend supports:

* Status filtering
* Category filtering
* Tag filtering
* Pagination
* Full-text search
* Resolved-last ordering

All filter values received through request parameters are coerced to strings before entering MongoDB filters to prevent malformed query injection.

---

## Search Functionality

The platform supports two search mechanisms:

* **Full-text search** — keyword-based search using text indexes.
* **Semantic search** — embedding-based search that finds conceptually similar queries even when exact keywords differ.

The platform supports two search mechanisms:

### Full-Text Search

MongoDB text indexes are used for keyword-based searching.

```http
GET /api/queries?q=<search-term>
```

### Semantic Search

The search service also performs embedding-based similarity search.

```http
GET /api/queries/search
```

Semantic search uses stored embeddings and cosine similarity calculations to locate conceptually similar queries even when exact keywords differ.

---
 
# Answers & Threaded Comments

 ## Answer Creation

Community members can answer open queries. Restrictions:

* Banned users cannot post answers.
* Query authors cannot answer their own questions.
* Resolved or archived queries do not accept new answers.

When an answer is submitted, the query status changes from Open to Answered and the query author receives a notification.

---

## Answer Editing & Deletion

Answers may be edited within a 15-minute window by the author, a moderator, or an administrator. The original body is preserved on edit. Deletion is soft — deleted answers are flagged rather than permanently removed. Query status is automatically reconciled when answers are deleted.

---

## Threaded Comments

Comments can be posted under individual answers. Only the query author and the answer author may participate in a comment thread. Notifications are sent to the other participant on each new comment. Comments may be soft-deleted by the comment author, a moderator, or an administrator.

---

# Voting & Bookmarking

## Voting

Both queries and answers support upvoting and downvoting. Self-voting is not permitted. For answers, only upvotes contribute to the author's reputation score; downvotes are recorded but do not reduce reputation.

---

## Bookmarking

Users can save useful queries for later reference. Saved queries are accessible from a dedicated bookmarks view and can be added or removed at any time.

---

# Helpful Answer & Resolution

## Mark Helpful

The query author, a moderator, or an administrator can mark an answer as the accepted solution. This:

* Marks the answer with a ✓ Solution badge.
* Changes the query status to Resolved.
* Prioritizes the accepted answer at the top of the thread.
* Awards reputation points to the answer author.

---

## Unmark Helpful

Authorized users may reopen a resolved discussion by removing the accepted answer. The query returns to Answered status. Previously awarded reputation points are not reversed.

---

# Automated Solution Finalization

The platform runs an automated engine that resolves queries that remain open after 48 hours.

## Eligibility

A query is eligible when its status is Answered and it is more than 48 hours old.

---

## Resolution

* If a manually accepted answer exists, it is retained and the query is marked Resolved with reputation awarded.
* If no accepted answer exists, the highest-voted answer is automatically selected as the solution. No reputation is awarded in this case.

To keep resolved threads concise, a maximum of three answers are preserved; lower-value answers are soft-deleted. Every finalization event is recorded in an audit log.
## Pagination

Query listings support page-based navigation.

Returned metadata includes:

* page
* limit
* total

The frontend renders navigation controls using these values.

---

## Query Ordering

Resolved queries are intentionally pushed toward the bottom of search results.

Sorting behavior:

```text
Resolved Queries → Bottom
Newest Queries → Top
```

This ensures active discussions remain visible.

---

# Answers & Threaded Comments

Answer management is implemented through `answerService.js` and rendered through `QueryDetail.jsx`.

## Answer Creation

Answers are submitted through:

```http
POST /api/queries/:id/answers
```

Validation rules:

* User must not be banned.
* Query author cannot answer their own question.
* Query status must be Open or Answered.
* Resolved or Archived queries cannot receive new answers.

When an answer is successfully created:

1. Answer document is saved.
2. Query status changes from Open to Answered.
3. Query author receives a notification.

---

## Answer Editing

Answers may be edited only within a 15-minute window.

Conditions:

* User is the answer author.
* User is a moderator.
* User is an administrator.

The original answer body is preserved when modifications occur.

---

## Answer Deletion

The platform uses soft deletion.

Deleted answers receive:

```text
isdeleted
deletedat
deletedby
```

Status reconciliation is automatically performed.

Examples:

* Removing an accepted answer clears the accepted answer reference.
* Queries never remain resolved without a valid accepted answer.
* If all answers are removed, the query returns to Open status.

---

## Threaded Comments

Comments provide limited discussion under answers.

### Permissions

Only two users may participate:

* Query author
* Answer author

Any other user receives an authorization error.

---

## Comment Creation

```http
POST /api/answers/:id/comments
```

Workflow:

1. Permission validation.
2. Comment creation.
3. Notification sent to the other participant.

---

## Comment Deletion

Comments use soft deletion and may be removed by:

* Comment author
* Moderator
* Administrator

---

# Helpful Answer & Resolution Workflow

The platform follows a support-ticket-style resolution model.

## Mark Helpful

Authorized users:

* Query author
* Moderator
* Administrator

Endpoint:

```http
POST /api/queries/:id/answers/:answerId/helpful
```

Actions performed:

1. Answer marked as accepted.
2. Accepted answer ID stored on the query.
3. Query status changed to Resolved.
4. Thread closure enforced.
5. Answer author awarded reputation points.
6. Notification generated.

---

## Accepted Answer Display

Accepted answers appear with:

```text
✓ Solution
```

Accepted answers are always prioritized in thread ordering.

---

## Unmark Helpful

Authorized users may reopen discussions.

Actions:

1. Remove accepted answer association.
2. Clear acceptance flag.
3. Change query status back to Answered.

Previously awarded points remain unchanged.

---

# Voting & Bookmarking

The platform supports voting on both queries and answers.

---

## Query Voting

Endpoint:

```http
POST /api/queries/:id/vote
```

Features:

* Upvote
* Downvote
* Self-vote prevention

Votes are stored separately and aggregated into a query vote score.

---

# Frontend Responsibilities

| Component       | Responsibility                                                                 |
| --------------- | ------------------------------------------------------------------------------ |
| AskQuery.jsx    | Query submission, attachments, grammar correction, duplicate warnings          |
| QueryList.jsx   | Search, filtering, pagination, query discovery                                 |
| QueryDetail.jsx | Full thread view, voting, bookmarking, answers, comments, resolution workflows |

---

# Service Layer Responsibilities

| Service          | Responsibility                                                        |
| ---------------- | --------------------------------------------------------------------- |
| queryService     | Query lifecycle, validation, duplicate detection, voting, bookmarking |
| answerService    | Answer management, comments, helpful workflow, verification           |
| solutionService  | Automatic solution finalization and cron execution                    |
| gibberishService | Content quality validation                                            |
| spamService      | Spam penalty enforcement                                              |
| vectorService    | Semantic similarity search and duplicate detection                    |

---
## Answer Voting

Endpoint:

```http
POST /api/answers/:id/vote
```

Answer votes use signed values:

```text
+1 = Upvote
-1 = Downvote
```

Rules:

* Self-voting is blocked.
* Only positive votes contribute to reputation.
* Downvotes are recorded but do not reduce reputation.

---

## Bookmarking

Users can save useful queries.

Endpoints:

```http
POST /api/queries/:id/save
DELETE /api/queries/:id/save
```

Bookmarks are stored using a dedicated bookmark model.

Saved queries are accessible through:

```http
GET /api/queries/bookmarks
```

---

# Solution Finalization Engine

Automated solution resolution is implemented in `solutionService.js`.

## Finalization Trigger

The engine runs:

* Daily through cron scheduling.
* Manually through an administrative endpoint.

---

## Eligibility Rules

Queries become eligible when:

```text
Status = Answered
Age > 48 Hours
```

---

## Manual Resolution Path

If a query already contains an accepted answer:

1. Accepted answer retained.
2. High-quality answers retained.
3. Excess answers pruned.
4. Query marked Resolved.
5. Reputation awarded.

---

## Automatic Resolution Path

If no accepted answer exists after 48 hours:

1. Highest-voted answer selected.
2. Answer marked accepted.
3. Query resolved automatically.
4. No reputation awarded.

---

## Answer Pruning

To keep resolved discussions concise:

* Accepted answers are retained.
* High-value answers are retained.
* Remaining answers may be soft-deleted.

A maximum of three answers are preserved.

---

## Audit Logging

Every finalization event creates an audit record.

Stored information includes:

* Query identifier
* Resolution action
* Timestamp
* System activity metadata

---

# Frontend Responsibilities

| Component       | Responsibility                                                                 |
| --------------- | ------------------------------------------------------------------------------ |
| AskQuery.jsx    | Query submission, attachments, grammar correction, duplicate warnings          |
| QueryList.jsx   | Search, filtering, pagination, query discovery                                 |
| QueryDetail.jsx | Full thread view, voting, bookmarking, answers, comments, resolution workflows |

---

# Service Layer Responsibilities

| Service          | Responsibility                                                        |
| ---------------- | --------------------------------------------------------------------- |
| queryService     | Query lifecycle, validation, duplicate detection, voting, bookmarking |
| answerService    | Answer management, comments, helpful workflow, verification           |
| solutionService  | Automatic solution finalization and cron execution                    |
| gibberishService | Content quality validation                                            |
| spamService      | Spam penalty enforcement                                              |
| vectorService    | Semantic similarity search and duplicate detection                    |

---

# API Summary

| Method | Endpoint                                   | Purpose             |
| ------ | ------------------------------------------ | ------------------- |
| POST   | /api/queries                               | Create query        |
| GET    | /api/queries                               | List queries        |
| GET    | /api/queries/search                        | Hybrid search       |
| GET    | /api/queries/:id                           | Query details       |
| POST   | /api/queries/:id/vote                      | Vote on query       |
| POST   | /api/queries/:id/save                      | Save query          |
| POST   | /api/queries/:id/answers                   | Create answer       |
| POST   | /api/answers/:id/vote                      | Vote on answer      |
| POST   | /api/answers/:id/comments                  | Create comment      |
| POST   | /api/queries/:id/answers/:answerId/helpful | Mark helpful        |
| POST   | /api/admin/answers/:id/verify              | Verify answer       |
| POST   | /api/jobs/solution-finalization/run        | Manual finalization |

---

# End-to-End Workflow

1. User opens AskQuery page.
2. Categories and tags are loaded from taxonomy endpoints.
3. User submits a query with required metadata and optional attachments.
4. Query passes taxonomy validation.
5. Query passes gibberish detection.
6. Spam penalties are applied if validation fails.
7. Embeddings are generated.
8. Duplicate detection is performed.
9. Query is stored.
10. Community members submit answers.
11. Eligible users participate in threaded comments.
12. Answers receive votes.
13. Users bookmark useful discussions.
14. Query author marks an answer as helpful, or the automated finalization engine resolves the query after 48 hours.
15. Query status becomes Resolved.
16. Audit logs and notifications are generated.

---

# Conclusion

The Ask a Query & Forum Engine combines structured query submission, taxonomy-based organization, AI-assisted content validation, semantic duplicate detection, community-driven answering, voting, bookmarking, and automated solution finalization. The module ensures that discussions remain searchable, moderated, and resolution-oriented while maintaining data integrity through validation, soft deletion, audit logging, and controlled workflow transitions.
