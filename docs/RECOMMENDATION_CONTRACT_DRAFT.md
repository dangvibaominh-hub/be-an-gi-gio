# Recommendation contract draft — Phase 2

> Status: database matching endpoint has been promoted to `docs/openapi.yaml`.
> This draft remains as implementation notes for matching and Gemini fallback.

Tài liệu này là bản nháp chuẩn bị cho Giai đoạn 2. Chưa đưa vào `docs/openapi.yaml`
cho tới khi backend endpoint được triển khai và có test contract tương ứng.

## Endpoint dự kiến

`POST /api/v1/recommendations`

## Request

```json
{
  "ingredients": ["trứng", "cà chua", "hành lá"],
  "filters": {
    "maxCookTimeMinutes": 30,
    "servings": 2,
    "difficulties": ["de", "trung-binh"]
  },
  "page": 1,
  "limit": 12
}
```

Quy tắc validation dự kiến:

- `ingredients`: bắt buộc, từ 1 đến 30 nguyên liệu.
- Mỗi nguyên liệu trim, không rỗng, tối đa 80 ký tự.
- `page`: số nguyên từ 1, mặc định 1.
- `limit`: số nguyên từ 1 đến 100, mặc định 12.
- `filters.maxCookTimeMinutes`: 1 đến 1440.
- `filters.servings`: 1 đến 100.
- `filters.difficulties`: chỉ gồm `de`, `trung-binh`, `kho`.

## Response

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "slug": "trung-chien-ca-chua",
      "title": "Trứng chiên cà chua",
      "description": "Món nhanh cho bữa cơm gia đình.",
      "image": "/images/recipes/trung-chien-ca-chua.png",
      "imageAlt": "Đĩa trứng chiên cà chua",
      "difficulty": "de",
      "cookTimeMinutes": 15,
      "baseServings": 2,
      "category": "Món chiên",
      "match": {
        "score": 0.83,
        "matchedIngredients": ["trứng", "cà chua"],
        "missingIngredients": ["hành tím", "gia vị cơ bản"]
      }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 12,
    "total": 1,
    "totalPages": 1,
    "source": "database"
  }
}
```

`meta.source` dự kiến:

- `database`: có candidate trong Supabase PostgreSQL.
- `gemini`: database không có candidate đạt ngưỡng và Gemini tạo công thức hợp lệ.
- `empty`: database không có candidate đạt ngưỡng và Gemini không khả dụng hoặc bị tắt.

## Matching preparation

- Normalize bằng `normalizeIngredientName`.
- So khớp chính xác trên `ingredients.normalized_name` trước.
- Sau đó so khớp alias trong `ingredients.aliases`.
- Tính `matchedIngredients`, `missingIngredients` theo từng recipe.
- Chỉ gọi Gemini khi không có candidate đạt `RECOMMENDATION_MATCH_THRESHOLD`.

## Gemini guardrails

- Không gọi Gemini nếu database có candidate đạt ngưỡng.
- Structured output phải map được vào schema recipe hiện tại.
- Recipe do Gemini tạo lưu `source = GEMINI`, `ai_model`, `moderation_status = PENDING`.
- Recipe `PENDING` chỉ trả về cho lượt request hiện tại, không xuất hiện trong catalog công khai.
