# Phase 7 backend status

Phase 7 backend Phu Bep chat baseline is implemented.

Implemented:

- Migration `006_chat_assistant.sql`.
- Migration `007_gemini_pending_drafts.sql` aligns existing pending Gemini recipes to `DRAFT`.
- `chat_conversations` table for authenticated user conversations.
- `chat_messages` table with role, content, recipe references, model, latency and token metadata.
- `POST /api/v1/chat/conversations`.
- `GET /api/v1/chat/conversations/:id/messages`.
- `POST /api/v1/chat/conversations/:id/messages`.
- JWT required for every chat endpoint; guests cannot create or read conversations.
- Conversation ownership check prevents one user from reading or writing another user's chat.
- Gemini chat adapter separated from recipe-generation adapter.
- Structured assistant output with `content` and `recipeReferences`.
- Gemini prompt is optimized for Vietnamese user messages, including accented and unaccented Vietnamese.
- Gemini prompt pins the assistant name to `Phụ Bếp` and avoids the incorrect `Phú Bếp` wording in generated answers.
- Phu Bep receives feedback-based personalization context when the user has prior cooking feedback.
- Explicit chat requests to create a new recipe can generate a Gemini recipe draft through the existing recipe-generation flow.
- Chat-generated recipe drafts are saved as `source = GEMINI`, `status = DRAFT`, `moderation_status = PENDING`, and remain outside the public catalog until admin approval.
- Pending Gemini drafts are not stored as public chat `recipeReferences`; the assistant message summarizes the draft and tells the user it is waiting for admin review.
- Gemini recipe drafts keep the existing placeholder image; admins should verify content and upload a real/licensed image before approval.
- Recipe references are resolved against public `PUBLISHED` + `APPROVED` recipes before saving.
- Fallback answer is stored when Gemini is not configured, times out or returns invalid data.
- In-memory per-user message rate limit for the Phase 7 baseline.
- OpenAPI updated with chat contracts.
- API tests cover auth, ownership, message flow, recipe reference validation and fallback behavior.

Still outside this backend repo:

- Frontend Phu Bep trigger, lazy chat panel, typing indicator and embedded Recipe Card UI.
- SSE streaming. Current baseline returns a non-streamed JSON response with fallback behavior.
- Production-grade distributed rate limit, for example Redis-backed limiting.
