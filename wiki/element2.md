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

---

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

Duplicate queries are detected using semantic similarity.

This reduces repeated discussions and improves knowledge reuse.
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

| Service          | Responsibility                                                        |
| ---------------- | --------------------------------------------------------------------- |
| queryService     | Query lifecycle, validation, duplicate detection, voting, bookmarking |
| answerService    | Answer management, comments, helpful workflow, verification           |
| solutionService  | Automatic solution finalization and cron execution                    |
| gibberishService | Content quality validation                                            |
| spamService      | Spam penalty enforcement                                              |
| vectorService    | Semantic similarity search and duplicate detection                    |
