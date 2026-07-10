CREATE TEMP TABLE refined_seed_recipe_ingredients (
  slug TEXT NOT NULL,
  display_order SMALLINT NOT NULL,
  name TEXT NOT NULL,
  normalized_name VARCHAR(150) NOT NULL,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  amount NUMERIC(10, 2) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  prep_note TEXT NOT NULL DEFAULT ''
) ON COMMIT DROP;

INSERT INTO refined_seed_recipe_ingredients (
  slug,
  display_order,
  name,
  normalized_name,
  aliases,
  amount,
  unit,
  prep_note
) VALUES
  ('thit-bo-xao-bong-cai', 1, 'Thịt bò', 'thit bo', ARRAY['bo']::TEXT[], 300, 'g', 'Thái lát mỏng ngang thớ'),
  ('thit-bo-xao-bong-cai', 2, 'Bông cải xanh', 'bong cai xanh', ARRAY['bong cai', 'broccoli']::TEXT[], 300, 'g', 'Tách miếng vừa ăn, chần sơ'),
  ('thit-bo-xao-bong-cai', 3, 'Tỏi', 'toi', ARRAY[]::TEXT[], 3, 'tép', 'Băm nhỏ'),
  ('thit-bo-xao-bong-cai', 4, 'Hành tím', 'hanh tim', ARRAY[]::TEXT[], 1, 'củ', 'Thái mỏng'),
  ('thit-bo-xao-bong-cai', 5, 'Dầu hào', 'dau hao', ARRAY[]::TEXT[], 1, 'muỗng canh', ''),
  ('thit-bo-xao-bong-cai', 6, 'Nước tương', 'nuoc tuong', ARRAY['xi dau']::TEXT[], 1, 'muỗng canh', ''),
  ('thit-bo-xao-bong-cai', 7, 'Dầu ăn', 'dau an', ARRAY[]::TEXT[], 2, 'muỗng canh', ''),
  ('thit-bo-xao-bong-cai', 8, 'Tiêu', 'tieu', ARRAY[]::TEXT[], 0.5, 'muỗng cà phê', ''),

  ('rau-muong-xao-toi', 1, 'Rau muống', 'rau muong', ARRAY[]::TEXT[], 500, 'g', 'Nhặt sạch, cắt khúc'),
  ('rau-muong-xao-toi', 2, 'Tỏi', 'toi', ARRAY[]::TEXT[], 4, 'tép', 'Băm nhỏ'),
  ('rau-muong-xao-toi', 3, 'Dầu ăn', 'dau an', ARRAY[]::TEXT[], 2, 'muỗng canh', ''),
  ('rau-muong-xao-toi', 4, 'Nước mắm', 'nuoc mam', ARRAY[]::TEXT[], 1, 'muỗng canh', ''),
  ('rau-muong-xao-toi', 5, 'Đường', 'duong', ARRAY[]::TEXT[], 0.5, 'muỗng cà phê', ''),

  ('suon-xao-chua-ngot', 1, 'Sườn non', 'suon non', ARRAY[]::TEXT[], 600, 'g', 'Chặt miếng, chần nhanh rồi rửa sạch'),
  ('suon-xao-chua-ngot', 2, 'Hành tím', 'hanh tim', ARRAY[]::TEXT[], 2, 'củ', 'Băm nhỏ'),
  ('suon-xao-chua-ngot', 3, 'Tỏi', 'toi', ARRAY[]::TEXT[], 3, 'tép', 'Băm nhỏ'),
  ('suon-xao-chua-ngot', 4, 'Nước mắm', 'nuoc mam', ARRAY[]::TEXT[], 2, 'muỗng canh', ''),
  ('suon-xao-chua-ngot', 5, 'Đường', 'duong', ARRAY[]::TEXT[], 2, 'muỗng canh', ''),
  ('suon-xao-chua-ngot', 6, 'Giấm', 'giam', ARRAY[]::TEXT[], 1, 'muỗng canh', ''),
  ('suon-xao-chua-ngot', 7, 'Tương cà', 'tuong ca', ARRAY[]::TEXT[], 2, 'muỗng canh', ''),
  ('suon-xao-chua-ngot', 8, 'Dầu ăn', 'dau an', ARRAY[]::TEXT[], 2, 'muỗng canh', ''),

  ('canh-chua-ca-loc', 1, 'Cá lóc', 'ca loc', ARRAY['ca']::TEXT[], 700, 'g', 'Làm sạch, cắt khoanh'),
  ('canh-chua-ca-loc', 2, 'Dứa', 'dua', ARRAY['thom']::TEXT[], 150, 'g', 'Cắt lát'),
  ('canh-chua-ca-loc', 3, 'Cà chua', 'ca chua', ARRAY[]::TEXT[], 2, 'quả', 'Cắt múi cau'),
  ('canh-chua-ca-loc', 4, 'Bạc hà', 'bac ha', ARRAY[]::TEXT[], 150, 'g', 'Tước vỏ, cắt lát xéo'),
  ('canh-chua-ca-loc', 5, 'Đậu bắp', 'dau bap', ARRAY[]::TEXT[], 100, 'g', 'Cắt xéo'),
  ('canh-chua-ca-loc', 6, 'Giá đỗ', 'gia do', ARRAY[]::TEXT[], 100, 'g', 'Rửa sạch'),
  ('canh-chua-ca-loc', 7, 'Me chua', 'me chua', ARRAY[]::TEXT[], 40, 'g', 'Dầm lấy nước cốt'),
  ('canh-chua-ca-loc', 8, 'Rau om', 'rau om', ARRAY[]::TEXT[], 1, 'nhánh', 'Cắt nhỏ'),
  ('canh-chua-ca-loc', 9, 'Ngò gai', 'ngo gai', ARRAY[]::TEXT[], 2, 'lá', 'Cắt nhỏ'),
  ('canh-chua-ca-loc', 10, 'Nước mắm', 'nuoc mam', ARRAY[]::TEXT[], 2, 'muỗng canh', ''),
  ('canh-chua-ca-loc', 11, 'Đường', 'duong', ARRAY[]::TEXT[], 1, 'muỗng canh', ''),

  ('chao-ga-xe-phay', 1, 'Thịt gà', 'thit ga', ARRAY['ga']::TEXT[], 400, 'g', 'Rửa sạch, luộc chín rồi xé sợi'),
  ('chao-ga-xe-phay', 2, 'Gạo tẻ', 'gao te', ARRAY[]::TEXT[], 150, 'g', 'Vo sạch, rang sơ nếu thích'),
  ('chao-ga-xe-phay', 3, 'Hành tím', 'hanh tim', ARRAY[]::TEXT[], 2, 'củ', 'Băm nhỏ'),
  ('chao-ga-xe-phay', 4, 'Gừng', 'gung', ARRAY[]::TEXT[], 20, 'g', 'Thái lát'),
  ('chao-ga-xe-phay', 5, 'Hành lá', 'hanh la', ARRAY[]::TEXT[], 2, 'nhánh', 'Cắt nhỏ'),
  ('chao-ga-xe-phay', 6, 'Rau răm', 'rau ram', ARRAY[]::TEXT[], 1, 'nhánh', 'Cắt nhỏ'),
  ('chao-ga-xe-phay', 7, 'Nước mắm', 'nuoc mam', ARRAY[]::TEXT[], 1, 'muỗng canh', ''),
  ('chao-ga-xe-phay', 8, 'Muối', 'muoi', ARRAY[]::TEXT[], 1, 'muỗng cà phê', ''),

  ('cha-gio-hai-san', 1, 'Tôm', 'tom', ARRAY[]::TEXT[], 200, 'g', 'Bóc vỏ, băm thô'),
  ('cha-gio-hai-san', 2, 'Mực', 'muc', ARRAY[]::TEXT[], 150, 'g', 'Làm sạch, thái hạt lựu'),
  ('cha-gio-hai-san', 3, 'Khoai môn', 'khoai mon', ARRAY[]::TEXT[], 100, 'g', 'Bào sợi'),
  ('cha-gio-hai-san', 4, 'Cà rốt', 'ca rot', ARRAY[]::TEXT[], 1, 'củ', 'Bào sợi'),
  ('cha-gio-hai-san', 5, 'Bánh tráng bò bía', 'banh trang bo bia', ARRAY['banh trang']::TEXT[], 20, 'cái', ''),
  ('cha-gio-hai-san', 6, 'Hành tím', 'hanh tim', ARRAY[]::TEXT[], 2, 'củ', 'Băm nhỏ'),
  ('cha-gio-hai-san', 7, 'Tỏi', 'toi', ARRAY[]::TEXT[], 2, 'tép', 'Băm nhỏ'),
  ('cha-gio-hai-san', 8, 'Trứng gà', 'trung ga', ARRAY['trung']::TEXT[], 1, 'quả', 'Đánh tan để quét mép cuốn'),
  ('cha-gio-hai-san', 9, 'Dầu ăn', 'dau an', ARRAY[]::TEXT[], 400, 'ml', 'Để chiên ngập dầu'),

  ('banh-xeo-mien-tay', 1, 'Bột bánh xèo', 'bot banh xeo', ARRAY['banh xeo']::TEXT[], 300, 'g', 'Pha theo hướng dẫn gói bột'),
  ('banh-xeo-mien-tay', 2, 'Nước cốt dừa', 'nuoc cot dua', ARRAY[]::TEXT[], 200, 'ml', ''),
  ('banh-xeo-mien-tay', 3, 'Bia', 'bia', ARRAY[]::TEXT[], 100, 'ml', 'Giúp vỏ bánh giòn hơn'),
  ('banh-xeo-mien-tay', 4, 'Tôm', 'tom', ARRAY[]::TEXT[], 200, 'g', 'Rửa sạch'),
  ('banh-xeo-mien-tay', 5, 'Thịt ba chỉ', 'thit ba chi', ARRAY[]::TEXT[], 200, 'g', 'Thái mỏng'),
  ('banh-xeo-mien-tay', 6, 'Giá đỗ', 'gia do', ARRAY[]::TEXT[], 200, 'g', 'Rửa sạch'),
  ('banh-xeo-mien-tay', 7, 'Hành lá', 'hanh la', ARRAY[]::TEXT[], 3, 'nhánh', 'Cắt nhỏ'),
  ('banh-xeo-mien-tay', 8, 'Rau sống', 'rau song', ARRAY[]::TEXT[], 1, 'rổ', 'Rửa sạch, để ráo'),
  ('banh-xeo-mien-tay', 9, 'Dầu ăn', 'dau an', ARRAY[]::TEXT[], 4, 'muỗng canh', ''),

  ('ca-hap-gung', 1, 'Cá diêu hồng', 'ca dieu hong', ARRAY['ca']::TEXT[], 1, 'con', 'Làm sạch, khứa nhẹ hai mặt'),
  ('ca-hap-gung', 2, 'Gừng', 'gung', ARRAY[]::TEXT[], 50, 'g', 'Thái sợi'),
  ('ca-hap-gung', 3, 'Hành lá', 'hanh la', ARRAY[]::TEXT[], 4, 'nhánh', 'Cắt khúc'),
  ('ca-hap-gung', 4, 'Hành tây', 'hanh tay', ARRAY[]::TEXT[], 1, 'củ', 'Cắt múi cau'),
  ('ca-hap-gung', 5, 'Nước tương', 'nuoc tuong', ARRAY['xi dau']::TEXT[], 2, 'muỗng canh', ''),
  ('ca-hap-gung', 6, 'Dầu hào', 'dau hao', ARRAY[]::TEXT[], 1, 'muỗng canh', ''),
  ('ca-hap-gung', 7, 'Dầu ăn', 'dau an', ARRAY[]::TEXT[], 1, 'muỗng canh', 'Để phi hành'),

  ('nam-xao-dau-hu-chay', 1, 'Nấm rơm', 'nam rom', ARRAY['nam']::TEXT[], 200, 'g', 'Lau sạch, cắt đôi'),
  ('nam-xao-dau-hu-chay', 2, 'Đậu hũ', 'dau hu', ARRAY['dau phu']::TEXT[], 2, 'miếng', 'Cắt miếng vuông'),
  ('nam-xao-dau-hu-chay', 3, 'Ớt chuông', 'ot chuong', ARRAY[]::TEXT[], 1, 'quả', 'Cắt miếng vừa ăn'),
  ('nam-xao-dau-hu-chay', 4, 'Tỏi', 'toi', ARRAY[]::TEXT[], 2, 'tép', 'Băm nhỏ'),
  ('nam-xao-dau-hu-chay', 5, 'Hành boa rô', 'hanh boa ro', ARRAY[]::TEXT[], 1, 'nhánh', 'Thái lát'),
  ('nam-xao-dau-hu-chay', 6, 'Nước tương', 'nuoc tuong', ARRAY['xi dau']::TEXT[], 1, 'muỗng canh', ''),
  ('nam-xao-dau-hu-chay', 7, 'Dầu hào chay', 'dau hao chay', ARRAY[]::TEXT[], 1, 'muỗng canh', ''),
  ('nam-xao-dau-hu-chay', 8, 'Dầu ăn', 'dau an', ARRAY[]::TEXT[], 2, 'muỗng canh', ''),

  ('pho-bo-gia-truyen', 1, 'Xương ống bò', 'xuong ong bo', ARRAY['xuong ong']::TEXT[], 1000, 'g', 'Chần sạch trước khi hầm'),
  ('pho-bo-gia-truyen', 2, 'Thịt bò', 'thit bo', ARRAY['bo']::TEXT[], 500, 'g', 'Thái lát mỏng ngang thớ'),
  ('pho-bo-gia-truyen', 3, 'Bánh phở', 'banh pho', ARRAY[]::TEXT[], 600, 'g', 'Trụng nóng trước khi ăn'),
  ('pho-bo-gia-truyen', 4, 'Hành tây', 'hanh tay', ARRAY[]::TEXT[], 1, 'củ', 'Nướng sơ'),
  ('pho-bo-gia-truyen', 5, 'Gừng', 'gung', ARRAY[]::TEXT[], 50, 'g', 'Nướng sơ, đập dập'),
  ('pho-bo-gia-truyen', 6, 'Hoa hồi', 'hoa hoi', ARRAY[]::TEXT[], 3, 'cái', 'Rang thơm'),
  ('pho-bo-gia-truyen', 7, 'Quế', 'que', ARRAY[]::TEXT[], 1, 'thanh', 'Rang thơm'),
  ('pho-bo-gia-truyen', 8, 'Thảo quả', 'thao qua', ARRAY[]::TEXT[], 1, 'quả', 'Rang thơm'),
  ('pho-bo-gia-truyen', 9, 'Đinh hương', 'dinh huong', ARRAY[]::TEXT[], 5, 'nụ', 'Rang thơm'),
  ('pho-bo-gia-truyen', 10, 'Nước mắm', 'nuoc mam', ARRAY[]::TEXT[], 3, 'muỗng canh', ''),
  ('pho-bo-gia-truyen', 11, 'Đường phèn', 'duong phen', ARRAY[]::TEXT[], 20, 'g', ''),
  ('pho-bo-gia-truyen', 12, 'Hành lá', 'hanh la', ARRAY[]::TEXT[], 3, 'nhánh', 'Cắt nhỏ'),
  ('pho-bo-gia-truyen', 13, 'Rau thơm', 'rau thom', ARRAY[]::TEXT[], 1, 'rổ', 'Rửa sạch, để ráo');

INSERT INTO ingredients (name, normalized_name, aliases)
SELECT DISTINCT ON (normalized_name)
  name,
  normalized_name,
  aliases
FROM refined_seed_recipe_ingredients
ORDER BY normalized_name, display_order
ON CONFLICT (normalized_name) DO UPDATE SET
  name = EXCLUDED.name,
  aliases = EXCLUDED.aliases,
  updated_at = NOW();

DELETE FROM recipe_ingredients ri
USING recipes r
WHERE ri.recipe_id = r.id
  AND r.source = 'SEED'
  AND r.slug IN (
    SELECT DISTINCT slug
    FROM refined_seed_recipe_ingredients
  );

INSERT INTO recipe_ingredients (
  recipe_id,
  ingredient_id,
  amount,
  unit,
  prep_note,
  display_order
)
SELECT
  r.id,
  i.id,
  refined.amount,
  refined.unit,
  refined.prep_note,
  refined.display_order
FROM refined_seed_recipe_ingredients refined
JOIN recipes r ON r.slug = refined.slug
JOIN ingredients i ON i.normalized_name = refined.normalized_name
WHERE r.source = 'SEED'
ON CONFLICT (recipe_id, ingredient_id) DO UPDATE SET
  amount = EXCLUDED.amount,
  unit = EXCLUDED.unit,
  prep_note = EXCLUDED.prep_note,
  display_order = EXCLUDED.display_order;
