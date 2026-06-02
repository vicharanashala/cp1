# Authentication & User Accounts

Curio implements a secure authentication model using JSON Web Tokens (JWT) and a stateful refresh token database.

## 1. Register & Login Flow
* **Registration (server/services/authService.js):** Validates credentials, hashes passwords using bcrypt, and starts a 1-day login streak.
* **Login:** Verifies credentials, updates consecutive login streaks, and returns access/refresh token pairs.

## 2. JWT Access & Refresh-Token Rotation
* **Access Token:** Short-lived JWT stored in-memory containing user ID and role, sent in Authorization: Bearer headers.
* **Refresh Token Rotation:** One-time use refresh tokens stored hashed (SHA-256) in the DB for instant revocation upon logout.
* **Axios Interceptor (client/src/api/client.js):** Catches 401s, executes a single in-flight refresh post, and replays failed requests.

## 3. Roles & Authorization
* **Roles:** Supports user, moderator (delete/regulate content), and admin (global control) defined in ROLES constant.
* **Middleware (server/middleware/auth.js):** auth requires valid tokens; optionalAuth sets context; admin restricts access.

## 4. User Profiles & Settings
* **Profiles (server/services/userService.js):** Public route returning user stats, reputation tiers, and earned/custom badges.
* **Settings:** Form enabling display name updates and toggling notification preferences (answers, mentions, system).

## 5. Ban & Unban Flow
* **Bans:** Admins ban users temporarily (hourly duration) or permanently, triggering audit logs and system notifications.
* **Unban & Check:** banCheck middleware blocks write routes. Expired bans are lifted automatically via an hourly cron job.
