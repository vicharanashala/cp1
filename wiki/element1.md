# Curio Gatekeeper: Secure Identity & Community Governance

**Curio** is a self-contained community knowledge platform that unifies everything a team needs to capture, organize, and grow its collective knowledge. It features a curated FAQ, an AI-powered chatbot, and a community Q&A forum. Instead of decaying as it ages, Curio is designed to improve itself over time by promoting community answers into the canonical FAQ, archiving inactive threads, and filtering out low-quality inputs.

At the heart of this system is the Curio Gatekeeper, which manages user identities, system permissions, and community governance. It ensures that every contribution is attributed, every session is secure, and the community remains safe and productive.

---

## What Makes Curio's Identity System Unique?

1. **Accountability by Design**: Anonymous posting is disabled. Every question, answer, and comment is linked to a verified user profile, encouraging constructive and high-quality participation.
2. **Invisible Security Shield**: User sessions are guarded using a dual-token system (short-lived access keys and one-time rotating refresh keys). If a session is interrupted or suspicious, the system automatically handles security in the background without forcing constant logins.
3. **Real-Time Role Enforcement**: Permissions are validated against live database records on every single action. If an admin promotes a user or bans a bad actor, the permissions take effect instantly across the platform.
4. **Self-Safety Lockout Guard**: Administrators cannot demote, restrict, or ban their own accounts. This built-in guardrail prevents accidental locking out of the system's caretakers.

---

## The Guided Tour of Identity & Governance

Here is an overview of how user accounts, permissions, and security rules operate in Curio, explained in simple language:

### 1. Secure Registration & Login
Creating an account and logging in are the entry points to Curio.
- **Registration**: New users register with their name, email, and password. The system checks that emails are unique and enforces a secure password length.
- **Password Hashing**: Passwords are encrypted before they ever reach the database, ensuring that user credentials remain completely secure.

### 2. The Calendar Login Streak
To encourage daily engagement, Curio tracks consecutive login streaks.
- When a user logs in on a new calendar day, their streak increments by one.
- If they miss a day, the streak resets to one.
- Multiple logins within the same calendar day do not affect the streak, ensuring a fair tracking system across timezone changes.

### 3. Dynamic User Profiles
Every user has a public profile page that showcases their contributions and reputation.
- It displays their total questions asked, answers posted, and registration date.
- It highlights their current community standing, points total, and badge checklist.
- If the user is currently banned or restricted, a prominent status banner is shown on their profile page.

### 4. The Automatic Standing Engine
As users answer questions and receive upvotes, they earn reputation points.
- The standing engine dynamically calculates their tier: Helper (30 points), Contributor (100 points), Expert (200 points), or Legend (300 points).
- The profile displays progress indicators showing how close they are to achieving the next level.

### 5. Bespoke Notification Preferences
Users can control how they want to receive system and community updates.
- Under their private settings, users can toggle alerts for three categories: answers to their own questions, mentions or replies, and system or moderation notices.

### 6. Expert-to-Moderator Roster Applications
Reaching the Expert tier unlocks the ability to apply for moderation powers.
- Eligible users see a button in their settings to request moderator privileges.
- Submitting a request flags the user for administrative review, helping scale the moderation team organically from within the community.

### 7. Core Access Control Roles
The platform operates on a clear hierarchical permissions system:
- **Standard Users**: Can browse the FAQ, ask queries, answer forum threads, comment, upvote, and bookmark posts.
- **Moderators**: Trusted contributors who can edit categories, flag content for admin review, and delete offensive questions or answers.
- **Administrators**: Control the entire platform, including editing categories, managing database jobs, promoting questions to the FAQ, and issuing bans or badges.

### 8. Admin-Issued Custom Badges
Administrators can award custom badges to users to highlight specialized expertise or achievements (such as "Documentation Hero").
- **Admin Verified Badge**: Automatically awarded to a user when an administrator marks one of their forum answers as authoritative. This badge remains pinned to their profile permanently.

### 9. Account Ban Controls
When users violate community guidelines, administrators can lock their accounts.
- **Temporary Bans**: Admins can specify a duration (e.g., 24 hours). The user is blocked from making any contributions, and their ban is lifted automatically by a background safety job once the timer expires.
- **Permanent Bans**: Locks the account indefinitely.
- The banned user is greeted with a ban banner displaying the reason for the lockout and the remaining time.

### 10. Moderation Flags (Negative Badges)
Administrators can issue specific behavioral penalties:
- **Warning**: A formal notification shown on their profile that does not restrict their current permissions.
- **Restricted**: Gates the user behind a post-approval wall. Any question they submit is automatically hidden from the public forum until approved by a moderator.
- **Suspended**: Causes an immediate, permanent ban on the account.
