# Implementation status — 2026-06-24

## PRD checkpoint

Theo `docs/PRD.md`, kế hoạch triển khai nằm ở mục 20:

- Giai đoạn 0: khảo sát backend hiện có và chốt hợp đồng.
- Giai đoạn 1: recipe catalog end-to-end.
- Giai đoạn 2: tìm món theo nguyên liệu.
- Giai đoạn 3: JWT authentication và saved recipes.
- Giai đoạn 4: Cooking Mode và lịch sử.
- Giai đoạn 5: Feedback và cá nhân hóa.
- Giai đoạn 6: Admin — kiểm duyệt công thức, CRUD và quản lý tài khoản.

Repo hiện tại là backend Express riêng. Vì vậy đánh giá dưới đây chỉ áp dụng cho backend, không kết luận thay cho frontend repository.

## Trạng thái hiện tại

Backend đã hoàn tất **Giai đoạn 0 → 6** (phần backend).

Mốc nghiệm thu tương ứng:

- M1 — Catalog: ✅ backend đã sẵn sàng.
- M2 — Recommendation: ✅ database matching + Gemini fallback. Workflow Admin kiểm duyệt recipe `PENDING` đã có từ Giai đoạn 6.
- M3 — Identity: ✅ JWT auth + saved recipes.
- M4 — Cooking: ✅ Cooking Session + history.
- M5 — Learning: ✅ Feedback + personalization.
- M6 — Administration: ✅ Admin CRUD + moderation + user management + audit log.
- M7 — Assistant (Phụ Bếp): ❌ chưa triển khai.

## Đối chiếu Giai đoạn 0

| Yêu cầu backend | Trạng thái | Bằng chứng |
|---|---|---|
| Khảo sát repo Node.js + Express.js | Đã xong | `src/app.ts`, `src/bin/www.ts`, module route/controller/service/repository |
| Đối chiếu schema Supabase PostgreSQL | Đã xong | `database/migrations/001_recipe_catalog.sql`, Supabase đã migrate |
| Đối chiếu route và middleware | Đã xong cho catalog | `/health`, `/api/v1/categories`, `/api/v1/recipes`, `/api/v1/recipes/:slug` |
| JWT flow | Chưa có | Phù hợp vì auth thuộc Giai đoạn 3, không phải blocker cho catalog |
| ERD | Đã có | `docs/ERD.md` |
| OpenAPI | Đã có | `docs/openapi.yaml` |
| ADR | Đã có | `docs/ADR-001-backend-foundation.md` |
| Migration, seed, lint, test, env validation | Đã xong | Kết quả kiểm tra ngày 2026-06-23 |

## Đối chiếu Giai đoạn 1 backend

| Yêu cầu backend | Trạng thái | Bằng chứng |
|---|---|---|
| Schema Category, Recipe, Ingredient, RecipeIngredient, RecipeStep, CookingTerm | Đã xong | Migration `001_recipe_catalog.sql` |
| Import mock recipe thành seed data | Đã xong | `src/database/seed-data.ts`, `src/database/seed.ts` |
| API danh sách, filter, chi tiết theo slug | Đã xong | `recipe.routes.ts`, `recipe.controller.ts`, `recipe.repository.ts` |
| Pagination, validation, index | Đã xong | `recipe.schemas.ts`, migration index, response meta |
| Database thật trên Supabase | Đã xong | 6 categories, 10 recipes, 13 ingredients, 30 recipe steps |

## Kiểm tra đã chạy

- `npm run typecheck`: pass.
- `npm run lint`: pass.
- `npm test`: pass, 5/5 tests.
- `npm run build`: pass.
- Supabase PostgreSQL count:
  - `categories`: 6
  - `recipes`: 10
  - `ingredients`: 13
  - `recipe_steps`: 30
- Express runtime qua Supabase SDK:
  - `GET /api/v1/categories`: 200, 6 items.
  - `GET /api/v1/recipes?limit=2`: 200, total 10.

## Chuẩn bị trước khi sang Giai đoạn 2

Backend đã đủ nền để bắt đầu Giai đoạn 2, nhưng nên chuẩn bị thêm các đầu việc sau trước khi code recommendation:

1. Chốt contract endpoint recommendation trong OpenAPI, ví dụ `POST /api/v1/recommendations`.
2. Chốt request/response cho matched ingredients, missing ingredients và score.
3. Bổ sung test dataset nhỏ cho normalize ingredient và alias tiếng Việt.
4. Thêm unit test cho normalize/matching trước khi gọi Gemini.
5. Thêm biến môi trường Gemini ở `.env.example`, nhưng chưa gọi Gemini cho tới khi database matching hoàn tất.

Các việc này là chuẩn bị cho Giai đoạn 2, không phải thiếu sót của Giai đoạn 0 hoặc phần backend Giai đoạn 1.

## Chuẩn bị đã bổ sung trong lượt kiểm tra này

- `docs/RECOMMENDATION_CONTRACT_DRAFT.md`: contract nháp cho recommendation trước khi đưa vào OpenAPI chính thức.
- `src/modules/recommendations/ingredient-normalizer.ts`: helper normalize/tokenize/alias cho nguyên liệu tiếng Việt.
- `tests/ingredient-normalizer.test.ts`: unit test cho normalize nguyên liệu và alias.
- `.env.example`: thêm `RECOMMENDATION_MATCH_THRESHOLD`, `GEMINI_API_KEY`, `GEMINI_MODEL`.

## Giai đoạn 2 — Đã triển khai backend matching + Gemini fallback

Đã triển khai phần backend database matching:

- `POST /api/v1/recommendations`.
- Validation request cho `ingredients`, `filters`, `page`, `limit`.
- Normalize/dedupe nguyên liệu người dùng nhập.
- Matching theo `ingredients.normalized_name`, `ingredients.aliases` và token subset.
- Score theo input coverage và recipe ingredient coverage.
- Trả `matchedIngredients`, `missingIngredients`, `score` và `meta.source`.
- Nếu request có Bearer token hợp lệ, recommendation boost nhẹ công thức user đã lưu.
- Gemini fallback chỉ chạy khi không có recipe database đạt `RECOMMENDATION_MATCH_THRESHOLD`.
- Gemini output bị ép JSON schema, validate lại bằng Zod trước khi lưu.
- Recipe AI được lưu với `source = GEMINI`, `ai_model = GEMINI_MODEL`, `moderation_status = PENDING`.
- Recipe `PENDING` chỉ trả về cho request hiện tại, không xuất hiện trong catalog công khai.
- OpenAPI chính thức đã có contract recommendation.
- Seed cập nhật alias cho các nguyên liệu phổ biến và nguyên liệu ghép.

## Giai đoạn 3 — Đã triển khai backend nền tảng

Đã triển khai:

- Migration `002_identity_saved_recipes.sql`.
- Bảng `app_users`, `refresh_tokens`, `saved_recipes`.
- Email/password register và login.
- JWT access token qua `Authorization: Bearer <token>`.
- Refresh token rotation và logout thu hồi refresh token.
- `GET /api/v1/me` và `PATCH /api/v1/me`.
- `GET /api/v1/me/saved-recipes`.
- `POST /api/v1/me/saved-recipes/:slug`.
- `DELETE /api/v1/me/saved-recipes/:slug`.
- Password hashing bằng Node `scrypt`.
- Token hash trước khi lưu refresh token.
- OpenAPI cập nhật contract Phase 3.
- Tests API cho auth và saved recipes.

Đã kiểm tra runtime Supabase thật:

- `POST /api/v1/auth/register`: 201.
- `GET /api/v1/me`: 200.
- `POST /api/v1/me/saved-recipes/rau-muong-xao-toi`: 201.
- `GET /api/v1/me/saved-recipes`: 200.

Chưa hoàn tất end-to-end:

- Google OAuth cần `GOOGLE_OAUTH_CLIENT_ID` và id token thật từ frontend để kiểm thử đầy đủ.
- Frontend chưa được nối vào auth/session/saved recipes trong lượt này.

## Giai đoạn 4 — Đã triển khai backend Cooking Session + history

Đã triển khai trong backend:

- Migration `003_cooking_sessions.sql`.
- Bảng `cooking_sessions` với `current_step`, `servings`, `started_at`, `completed_at`, `status`.
- Unique active session theo user + recipe để `POST /api/v1/cooking-sessions` có thể resume phiên `IN_PROGRESS`.
- `POST /api/v1/cooking-sessions`.
- `PATCH /api/v1/cooking-sessions/:id`.
- `POST /api/v1/cooking-sessions/:id/complete`.
- `GET /api/v1/me/cooking-history`.
- Route yêu cầu JWT, không tạo cooking session/history cho khách.
- Validate current step không vượt quá số bước công thức.
- Complete session idempotent.
- History có pagination và sort `completed-at-desc` hoặc `started-at-desc`.
- OpenAPI đã cập nhật contract Phase 4.
- Tests API cho start/resume/update/complete/history.

Chưa hoàn tất end-to-end trong repo này:

- Frontend Cooking Mode `/cong-thuc/[slug]/nau` chưa được nối với API mới.
- Frontend `/lich-su` chưa được nối với `GET /api/v1/me/cooking-history`.

## Giai đoạn 5 — Đã triển khai backend Feedback + Personalization

Đã triển khai:

- Migration `004_feedback_personalization.sql`.
- Bảng `cooking_feedback`: lưu 1 feedback cho mỗi cooking session đã hoàn thành.
- Bảng `user_personalization_insights`: lưu confidence, average rating, issue counts và rerank signals.
- `POST /api/v1/cooking-sessions/:id/feedback`: gửi rating, issues và ghi chú sau khi nấu xong.
- `GET /api/v1/me/personalization`: lấy insight cá nhân hóa của user hiện tại.
- Feedback issues được hỗ trợ:
  - `cutting-meat-hard` — Cắt thịt khó quá.
  - `oil-splatter` — Chiên bị bắn dầu.
  - `took-longer-than-expected` — Mất nhiều thời gian hơn dự kiến.
  - `missing-ingredients` — Thiếu nguyên liệu.
- Rule engine cập nhật personalization insight sau mỗi lần submit feedback:
  - `preferEasyRecipes` — tăng khi hay gặp khó khăn kỹ thuật.
  - `preferQuickRecipes` — tăng khi hay mất nhiều thời gian hơn dự kiến.
  - `preferIngredientFit` — tăng khi hay thiếu nguyên liệu.
  - `preferTechniqueGuidance` — tăng khi hay bắn dầu hoặc cắt thịt khó.
- `GET /api/v1/me/cooking-history` trả về feedback kèm theo và hỗ trợ `sort=rating-desc`.
- Recommendation API rerank kết quả cho user đã đăng nhập dựa trên personalization insight.
- OpenAPI và ERD đã cập nhật.
- Tests cho feedback API, personalization insight và recommendation reranking.

Chưa hoàn tất end-to-end:

- Frontend Feedback Modal chưa được nối với `POST /api/v1/cooking-sessions/:id/feedback`.
- Frontend tab Cá nhân hóa trong `/ho-so` chưa được nối với `GET /api/v1/me/personalization`.

## Giai đoạn 6 — Đã triển khai backend Admin

### Mục đích

Giai đoạn 6 giải quyết 3 vấn đề cốt lõi cho vận hành hệ thống:

1. **Kiểm duyệt công thức Gemini**: Gemini tạo ra công thức mới khi database không có kết quả phù hợp và lưu với `moderation_status = PENDING`. Công thức `PENDING` không xuất hiện công khai cho đến khi Admin duyệt. Không có Giai đoạn 6, công thức AI sẽ mãi mãi `PENDING` và không bao giờ được public — khiến toàn bộ tính năng Gemini fallback vô dụng.

2. **Quản lý công thức**: Admin có thể tạo, sửa, ẩn (soft delete) công thức thủ công. Đây là kênh chính để đội nội dung bổ sung công thức chất lượng cao vào hệ thống mà không cần can thiệp trực tiếp vào database.

3. **Quản lý tài khoản**: Admin có thể khóa/mở tài khoản vi phạm. Backend kiểm tra `status = ACTIVE` khi xác thực JWT, nên user bị khóa (`BLOCKED`) không thể đăng nhập dù có token cũ.

### Đã triển khai

- Migration `005_admin_audit_log.sql`.
- Bảng `admin_audit_logs`: ghi lại mọi thao tác quản trị quan trọng (action, entity_type, entity_id, metadata, thời gian).
- Module `src/modules/admin/` gồm: `model`, `schemas`, `repository`, `service`, `controller`, `routes`.
- Toàn bộ route `/api/v1/admin/*` yêu cầu JWT hợp lệ **và** `role = ADMIN` — kiểm tra tại backend, không chỉ ẩn UI.

### API endpoints

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/v1/admin/recipes` | Danh sách tất cả recipe — có thể filter theo `status`, `moderationStatus`, `source`, `search` |
| `POST` | `/api/v1/admin/recipes` | Tạo recipe mới (source tự động là `ADMIN`, moderation tự động là `APPROVED`) |
| `GET` | `/api/v1/admin/recipes/:id` | Chi tiết recipe theo ID (bao gồm HIDDEN và PENDING) |
| `PATCH` | `/api/v1/admin/recipes/:id` | Sửa một hoặc nhiều field của recipe |
| `DELETE` | `/api/v1/admin/recipes/:id` | Ẩn recipe (soft delete — chuyển `status = HIDDEN`, không xóa khỏi DB) |
| `POST` | `/api/v1/admin/recipes/:id/approve` | Duyệt recipe PENDING → `moderation_status = APPROVED`, `status = PUBLISHED` |
| `POST` | `/api/v1/admin/recipes/:id/reject` | Từ chối recipe → `moderation_status = REJECTED`, `status = HIDDEN` |
| `GET` | `/api/v1/admin/users` | Danh sách tất cả user — có thể filter theo `status`, `role`, `search` |
| `PATCH` | `/api/v1/admin/users/:id/status` | Khóa (`BLOCKED`) hoặc mở (`ACTIVE`) tài khoản |
| `GET` | `/api/v1/admin/audit-logs` | Lịch sử thao tác quản trị — có thể filter theo `entityType` |

### Audit log

Mọi thao tác quan trọng đều tự động ghi audit log với các action:

- `CREATE_RECIPE`, `UPDATE_RECIPE`, `DELETE_RECIPE`
- `APPROVE_RECIPE`, `REJECT_RECIPE`
- `BLOCK_USER`, `UNBLOCK_USER`

### Kiểm tra đã chạy

- `npm run typecheck`: pass.
- `npm run lint`: pass.

### Việc cần làm trước khi dùng được

- Chạy migration `005_admin_audit_log.sql` lên Supabase (lệnh `npm run db:migrate` hoặc paste SQL vào Supabase SQL Editor).
- Frontend trang `/admin` chưa được xây dựng.

## Giai đoạn tiếp theo — Giai đoạn 7 (Phụ Bếp)

Giai đoạn 7 sẽ triển khai tính năng chat AI "Phụ Bếp":

- Migration bảng `chat_conversations` và `chat_messages`.
- `POST /api/v1/chat/conversations` — tạo conversation mới.
- `GET /api/v1/chat/conversations/:id/messages` — lấy lịch sử tin nhắn.
- `POST /api/v1/chat/conversations/:id/messages` — gửi tin nhắn và nhận phản hồi từ Gemini.
- Gemini adapter cho chat có context công thức trong database.
- (Tùy chọn) SSE streaming để phản hồi xuất hiện từng phần.
- Tất cả endpoint yêu cầu JWT — khách không dùng được Phụ Bếp.


