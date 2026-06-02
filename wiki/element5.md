# Curio Admin: Smart Curation & Automated Maintenance

Every community knowledge base faces a common enemy: **decay**. As time passes, duplicate questions pile up, stale answers mislead users, and moderators burn out trying to manually garden the platform.

What makes Curio's administration system unique is that it is built to **improve itself over time** with minimum manual effort. Instead of manual policing, Curio uses a smart, collaborative control panel that blends human wisdom with automated guardrails.

Here is a simple, feature-first guide to how the Curio Control Room keeps our platform fresh, accurate, and healthy.

---

## What Makes Curio Unique?

1. **Self-Intelligent Moderation**: Curio doesn't wait for moderators to find duplicates. Our AI scans new questions as they are submitted and automatically groups similar topics, suggesting merges to the admin team.
2. **"Time-Machine" Recovery**: Accidentally deleted a great answer? No database surgery is needed. Curio gives moderators a 15-minute window to undo any deletion with a single click.
3. **Set-and-Forget Hygiene**: Eight invisible background jobs constantly sweep the database—resolving tickets, lifting temporary bans, pruning clutter, and checking for stale documentation.
4. **Accountability by Design**: Every single administrative action is automatically logged in an immutable feed, ensuring transparency and trust within the team.

---

## The Guided Tour of Admin Features

Here is what you can do from the Curio Control Room, explained in simple language:

### 1. System Overview (Flight Deck)
Think of this as the main dashboard showing real-time stats. It displays:
* How many users are active vs. banned.
* The percentage of questions that have been successfully resolved by the community.
* A "Needs Attention" panel that alerts you only when tasks are waiting for you (like reports to check or new users to approve).
* A breakdown of queries by topic so you can see what users are asking about most.

### 2. The Expert Escalation Queue (Attention Tab)
Sometimes, a standard user query gets stuck or requires official admin clearance.
- When an experienced member (an "Expert") flags a question for attention, it routes here.
- It shows the asker's email and joining date, letting you quickly review and resolve the issue.

### 3. The Flag Review (Moderation Tab)
This is where flagged content goes. Curio automatically catches gibberish text, potential spam, and user reports. Admins can:
- **Dismiss**: Clear the flag and return the question to the forum.
- **Resolve**: Confirm the flag and close the issue.
- **Merge**: If a question is flagged as a duplicate of an existing thread, clicking "Merge" automatically transfers all answers over to the main thread, archives the duplicate, and notifies the author.

### 4. AI Amalgamation Suggestions
Instead of leaving duplicate questions scattered across the forum, Curio's AI continuously runs in the background. It finds groups of questions that ask the same thing in different ways and groups them. You can merge the entire cluster into one canonical thread with a single click.

### 5. The FAQ Manager & Duplicate Guard
The FAQ is Curio's primary knowledge base. Admins can create and edit FAQs here.
- To prevent redundant articles, Curio has an **AI Duplicate Guard**. If you write a question that is highly similar to an existing FAQ, Curio will alert you before publishing so you don't create duplicate FAQs.
- You can also mark outdated FAQ articles to warn users.

### 6. Curated Categories & Tags (Taxonomy)
To prevent users from creating a messy list of free-form tags, admins curate a standard list of Categories (like "Technical" or "Registration") and Tags (like "Urgent" or "Question"). Users can only pick from this vetted list or use the built-in "Others" fallback, keeping search organized.

### 7. User Directory & Ban Management (Users Tab)
Manage all community profiles in one list:
- **Roles**: Toggle user roles between Standard User and Admin.
- **Moderator Power**: Promote reliable contributors to moderators.
- **Ban Controls**: Ban accounts temporarily (e.g., for 24 hours due to spam) or permanently with a documented reason.
- **Self-Safety Guard**: Admins cannot ban or demote their own accounts.

### 8. The Audit Log (History Feed)
An immutable, timeline feed of every administrative action (e.g., "Admin set Surya as moderator", "Admin deleted FAQ article"). It shows exactly *who* did *what* and *when*, keeping the moderation team accountable.

### 9. The Rollback Console (Undo Window)
If a moderator or user deletes a question or answer by mistake, they have a **15-minute window** to restore it. 
- Deleted items appear in the Rollback tab.
- Clicking "Restore" instantly recovers the content, all its answers, and its resolved status. 
- After 15 minutes, the item is locked out and scheduled for permanent deletion.

### 10. The On-Demand Job Runner (Maintenance Tab)
Lists the 8 background maintenance jobs that keep Curio running. You can click "Run now" on any of them to trigger them instantly instead of waiting for their scheduled time.

---

## The 8 Invisible Ground Crew Jobs

Curio has eight background scheduled tasks that keep the platform clean and healthy:

1. **finalize-solutions**: Daily checks to resolve tickets past their 48-hour deadline. It chooses the best answer, prunes extra replies, and awards points.
2. **expire-bans**: Hourly checks to lift temporary bans automatically once their time runs out.
3. **badge-recalc**: Daily checks to update users' badges (Helper, Contributor, Expert, Legend) based on their reputation points.
4. **lru-eviction**: Archives resolved questions that haven't been opened in 90 days. Viewing them later automatically un-archives them.
5. **staleness-check**: Weekly checks that flag answers older than 180 days as outdated, alerting moderators to update them.
6. **orphan-cleanup**: Weekly cleanup of likes pointing to deleted answers and chatbot sessions of deleted users.
7. **embedding-refresh**: Weekly refresh of AI search parameters for questions that were edited.
8. **soft-delete-purge**: Monthly permanent deletion of soft-deleted items older than 30 days, logging the action for audit safety.
