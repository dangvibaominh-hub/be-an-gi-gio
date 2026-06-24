# Ăn Gì Giờ? — Backend

Backend REST API cho dự án **Ăn Gì Giờ?**, xây dựng bằng Node.js, Express,
TypeScript và PostgreSQL (Supabase).

Project được khởi tạo từ scaffold chính thức của `express-generator --no-view`,
sau đó nâng cấp sang TypeScript strict. Entry point giữ cấu trúc generator tại
`src/bin/www.ts`; `src/app.ts` chỉ cấu hình Express application.

## Yêu cầu

- Node.js 22+
- PostgreSQL 15+ hoặc một Supabase project

## Khởi động

```bash
copy .env.example .env
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

### Supabase database

Backend co 2 che do ket noi:

- `DATABASE_DRIVER=supabase`: runtime API doc du lieu qua Supabase SDK bang
  `SUPABASE_URL` va `SUPABASE_PUBLISHABLE_KEY`.
- `DATABASE_DRIVER=postgres`: runtime API dung truc tiep PostgreSQL qua `pg`.
  Che do nay, cung nhu `npm run db:migrate` va `npm run db:seed`, can
  `DATABASE_URL` co database password cua Supabase va `DATABASE_SSL=true`.

Project da load ca `.env` va `.env.local`; `.env.local` phu hop de giu cau
hinh Supabase tren may local.

API mặc định chạy tại `http://localhost:4000`. Swagger UI có tại
`http://localhost:4000/api-docs`.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
npm test
npm run db:migrate
npm run db:seed
```

## API Giai đoạn 1

- `GET /health`
- `GET /api/v1/categories`
- `GET /api/v1/recipes`
- `GET /api/v1/recipes/:slug`

Danh sách công thức hỗ trợ `page`, `limit`, `category`, `difficulty`,
`maxCookTimeMinutes`, `servings` và `sort`.

## Cấu trúc module

Mỗi domain được tách theo luồng:

```text
route → controller → service → repository → PostgreSQL
               ↘ model / validation schema
```

- `model`: entity/type dữ liệu nghiệp vụ.
- `controller`: nhận HTTP request và tạo response.
- `service`: nghiệp vụ độc lập với Express và SQL.
- `repository`: truy cập PostgreSQL.
- `route`: ánh xạ URL, validation và controller.

Xem thêm [PRD](docs/PRD.md), [OpenAPI](docs/openapi.yaml) và
[ERD](docs/ERD.md).
