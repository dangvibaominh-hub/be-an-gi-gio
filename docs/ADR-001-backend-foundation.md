# ADR-001 — Nền tảng backend catalog

- **Trạng thái:** Chấp nhận
- **Ngày:** 2026-06-23

## Quyết định

Backend được khởi tạo bằng scaffold chính thức `express-generator --no-view`,
sau đó chuyển sang Node.js, Express 5, TypeScript strict và PostgreSQL qua `pg`.
Lifecycle `app` + `bin/www` của generator được giữ lại.
Schema được quản lý bằng migration SQL có version, phù hợp để chạy trực tiếp
trên Supabase PostgreSQL. REST API được version hóa dưới `/api/v1`; OpenAPI là
contract công khai với frontend.

Domain catalog tách model, controller, service, repository và HTTP route. Cách
tách này cho phép test API bằng repository giả mà không cần database, đồng thời
giữ SQL trong repository PostgreSQL.

## Lý do

- Tuân thủ stack đã chốt trong PRD.
- SQL migration minh bạch, dùng được với Supabase và Railway.
- Không khóa dự án vào ORM khi backend ban đầu chưa có kiến trúc cần bảo toàn.
- Contract trả về giữ tên field tương thích với type hiện tại của frontend.
