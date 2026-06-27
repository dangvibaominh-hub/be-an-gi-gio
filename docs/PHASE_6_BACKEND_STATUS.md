# Phase 6 backend status

Phase 6 backend admin baseline is implemented.

Implemented:

- Migration `005_admin_phase.sql`.
- `admin_audit_logs` table and indexes.
- Admin RBAC via JWT + `requireRole("ADMIN")`.
- `GET /api/v1/admin/recipes`.
- `POST /api/v1/admin/recipes`.
- `GET /api/v1/admin/recipes/:id`.
- `PATCH /api/v1/admin/recipes/:id`.
- `DELETE /api/v1/admin/recipes/:id` as soft delete by setting recipe `status = HIDDEN`.
- `PATCH /api/v1/admin/recipes/:id/moderation` for Gemini recipe approve/reject.
- `POST /api/v1/admin/recipes/:id/approve`.
- `POST /api/v1/admin/recipes/:id/reject`.
- `GET /api/v1/admin/users`.
- `PATCH /api/v1/admin/users/:id/status`.
- `GET /api/v1/admin/audit-logs`.
- Audit logs for recipe create/update/hide/moderation and user status changes.
- Suspending a user revokes active refresh tokens.
- Admin self-suspend is blocked.
- OpenAPI and ERD updated.
- API tests added for admin RBAC, recipe management, moderation, user status and audit logs.

Still outside this backend repo:

- Frontend `/admin` layout and screens.
- Admin recipe form UX and moderation queue UI.
- Account management UI.
- Production admin bootstrapping policy, for example how the first admin account is granted.
