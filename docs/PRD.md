# PRD — Ăn Gì Giờ?

> Phiên bản: 1.1  
> Ngày cập nhật: 22/06/2026  
> Trạng thái: Bản đặc tả triển khai ban đầu  
> Phạm vi: Web application, bao gồm front-end và back-end

## 1. Tổng quan sản phẩm

**Ăn Gì Giờ?** là website tiếng Việt dùng AI để:

- Gợi ý công thức dựa trên những nguyên liệu người dùng đang có.
- Cung cấp hướng dẫn nấu đầy đủ, dễ hiểu và có giải thích thuật ngữ.
- Hỗ trợ nấu theo từng bước trong chế độ tập trung.
- Thu thập phản hồi sau khi nấu.
- Cá nhân hóa những lần gợi ý tiếp theo dựa trên phản hồi trước đó.
- Trả lời câu hỏi và gợi ý món nhanh qua trợ lý **Phụ Bếp**.

Người dùng khách được phép tìm kiếm và xem chi tiết công thức. Các chức năng lưu công thức, bắt đầu nấu, đánh giá, lịch sử, cá nhân hóa và Phụ Bếp yêu cầu đăng nhập.

## 2. Nguồn yêu cầu

PRD này được tổng hợp từ:

- `docs/design-reference.md`
- `docs/UI_Component.md`
- `docs/page_structure.md`
- `docs/FRONTEND_RULES.md`
- `docs/AGENT.md`
- Các thiết kế tham khảo trong `docs/stitch_design/`
- Hiện trạng source code tại thời điểm lập tài liệu

Các yêu cầu về tên gọi, route, luồng người dùng, cấu trúc trang, component và design token trong các tài liệu trên được xem là yêu cầu đã chốt.

Các quyết định kỹ thuật đã chốt bổ sung cho PRD:

- Backend sử dụng Node.js + Express.js và nằm trong repository riêng.
- Database sử dụng Supabase PostgreSQL.
- AI sử dụng Google Gemini.
- Authentication sử dụng JWT.
- Backend triển khai trên Railway, front-end triển khai trên Vercel.
- Hệ thống có vai trò Admin để quản trị công thức và tài khoản.

## 3. Vấn đề cần giải quyết

Người dùng thường:

- Không biết nên nấu món gì từ nguyên liệu có sẵn.
- Khó tìm được công thức phù hợp với thời gian, khẩu phần và kỹ năng.
- Gặp khó khăn với thuật ngữ hoặc kỹ thuật nấu ăn.
- Bỏ sót nguyên liệu hoặc không biết cần mua thêm gì.
- Cần hỗ trợ ngay trong lúc chuẩn bị hoặc nấu.
- Nhận những gợi ý lặp lại, không phản ánh khó khăn từng gặp.

Sản phẩm cần rút ngắn quá trình từ “đang có nguyên liệu gì” đến “hoàn thành món ăn”, đồng thời cải thiện chất lượng gợi ý sau mỗi lần sử dụng.

## 4. Mục tiêu sản phẩm

### 4.1 Mục tiêu chính

1. Cho phép người dùng tìm món phù hợp từ danh sách nguyên liệu trong ít thao tác.
2. Cung cấp hướng dẫn đủ chi tiết để người mới vẫn có thể thực hiện.
3. Duy trì trải nghiệm tập trung khi nấu theo từng bước.
4. Thu thập phản hồi có cấu trúc sau mỗi lần nấu.
5. Biến phản hồi thành điều chỉnh cụ thể cho lần gợi ý tiếp theo.
6. Cho phép khách tìm kiếm và đánh giá giá trị của công thức trước khi quyết định đăng nhập.
7. Chỉ dùng Gemini tạo công thức mới khi database không có công thức phù hợp.

### 4.2 Chỉ số thành công đề xuất

Các chỉ số dưới đây cần được gắn analytics và chốt target sau giai đoạn thử nghiệm:

- Tỷ lệ người nhập nguyên liệu và nhận được ít nhất một kết quả.
- Tỷ lệ từ trang kết quả đi đến chi tiết công thức.
- Tỷ lệ từ chi tiết công thức bắt đầu Cooking Mode.
- Tỷ lệ hoàn thành Cooking Mode.
- Tỷ lệ gửi đánh giá sau khi hoàn thành.
- Tỷ lệ quay lại sử dụng trong 7 ngày.
- Tỷ lệ gợi ý được lưu.
- Tỷ lệ câu hỏi Phụ Bếp nhận được phản hồi thành công.
- Thời gian phản hồi trung vị của tìm kiếm AI và Phụ Bếp.
- Tỷ lệ lỗi API và lỗi AI.

## 5. Đối tượng người dùng

### 5.1 Người mới nấu ăn

- Cần hướng dẫn cụ thể.
- Cần giải thích thuật ngữ.
- Cần cảnh báo các bước khó hoặc có rủi ro.
- Thích món đơn giản và thời gian chuẩn bị ngắn.

### 5.2 Người nấu ăn hằng ngày

- Muốn tận dụng nguyên liệu đang có.
- Muốn tìm món nhanh theo thời gian và khẩu phần.
- Muốn lưu món yêu thích và xem lại lịch sử.

### 5.3 Người dùng khách

- Muốn thử sản phẩm ngay.
- Không muốn đăng ký trước khi thấy giá trị.
- Được tìm kiếm, khám phá và xem chi tiết công thức.
- Không được lưu công thức, bắt đầu Cooking Mode, gửi đánh giá, xem lịch sử, dùng cá nhân hóa hoặc Phụ Bếp.

### 5.4 Người dùng đã đăng nhập

- Muốn đồng bộ công thức đã lưu.
- Muốn xem lịch sử nấu và phản hồi cũ.
- Muốn nhận gợi ý cá nhân hóa qua nhiều phiên sử dụng.

### 5.5 Quản trị viên

- Quản lý tài khoản và trạng thái hoạt động của người dùng.
- Tạo, cập nhật, ẩn hoặc xóa công thức.
- Kiểm duyệt công thức do Gemini tạo.
- Theo dõi nguồn tạo và trạng thái kiểm duyệt của công thức.

## 6. Phạm vi sản phẩm

### 6.1 Trong phạm vi MVP

- Trang chủ nhập nguyên liệu.
- Khám phá công thức theo danh mục.
- Gợi ý công thức theo nguyên liệu.
- Bộ lọc thời gian, khẩu phần và độ khó.
- Chi tiết công thức.
- Điều chỉnh lượng nguyên liệu theo khẩu phần.
- Phân loại nguyên liệu “Bạn đã có” và “Cần mua thêm”.
- Cooking Mode theo từng bước, có progress và timer.
- Đánh giá sau khi nấu.
- Đăng ký, đăng nhập, đăng xuất và Google OAuth.
- Lưu/bỏ lưu công thức.
- Lịch sử nấu.
- Hồ sơ và thông tin cá nhân hóa.
- Phụ Bếp dạng chat.
- Chế độ khách giới hạn ở tìm kiếm, khám phá và xem chi tiết.
- Trang quản trị công thức và tài khoản.
- Gemini tạo công thức mới khi database không có kết quả phù hợp.
- Responsive, accessibility và các trạng thái loading/error/empty.

### 6.2 Ngoài phạm vi MVP

- Mạng xã hội, theo dõi người dùng hoặc bình luận công khai.
- Người dùng tự đăng công thức.
- Thanh toán hoặc gói thuê bao.
- Đặt hàng nguyên liệu.
- Livestream hoặc video call với đầu bếp.
- Ứng dụng mobile native.
- Dinh dưỡng chuyên sâu hoặc tư vấn y tế.

Các nội dung ngoài phạm vi chỉ được bổ sung khi có thay đổi PRD được phê duyệt.

## 7. Nguyên tắc trải nghiệm bắt buộc

- Toàn bộ UI hiển thị bằng tiếng Việt.
- Tên sản phẩm luôn là **Ăn Gì Giờ?**.
- Tên trợ lý luôn là **Phụ Bếp**.
- Badge độ khó chỉ gồm **Dễ**, **Trung bình**, **Khó**.
- Mọi trang, trừ Cooking Mode, sử dụng cùng một Navbar.
- Khách chỉ được tìm kiếm, khám phá và xem chi tiết công thức.
- Lưu công thức, bắt đầu nấu, đánh giá, lịch sử, hồ sơ, cá nhân hóa và Phụ Bếp yêu cầu đăng nhập.
- Chi tiết công thức luôn là bản đầy đủ, không rút gọn theo trình độ.
- Mỗi màn hình chỉ có một hành động primary nổi bật nhất tại một thời điểm.
- Hệ thống luôn tìm trong database trước; chỉ gọi Gemini tạo công thức khi không có công thức phù hợp.
- Công thức do Gemini tạo phải đúng schema, được validate, lưu nguồn tạo và có trạng thái kiểm duyệt.
- Khi Gemini không khả dụng, người dùng vẫn phải duyệt, tìm kiếm và xem các công thức có sẵn trong database.

## 8. Luồng người dùng

### 8.1 Luồng A — Nấu lần đầu

`Đăng nhập → Trang chủ → nhập nguyên liệu → Tìm món ngay → Kết quả công thức → Chi tiết công thức → Bắt đầu nấu → Cooking Mode → Hoàn thành món ăn → Đánh giá → Trang chủ + toast`

### 8.2 Luồng B — Cá nhân hóa

`Gửi đánh giá → lưu feedback → cập nhật sở thích/khó khăn → điều chỉnh xếp hạng hoặc nội dung hỗ trợ lần sau → hiển thị Insight Card trong Hồ sơ`

### 8.3 Luồng C — Phụ Bếp

`Đăng nhập → bất kỳ trang nào → mở Phụ Bếp → gửi câu hỏi → nhận trả lời hoặc Recipe Card → Xem chi tiết → Chi tiết công thức`

### 8.4 Luồng D — Người dùng khách

`Mở website → nhập nguyên liệu hoặc khám phá → xem kết quả → xem chi tiết → chọn Bắt đầu nấu/Lưu công thức → được yêu cầu đăng nhập`

### 8.5 Luồng E — Lưu và xem lại

`Đăng nhập → Recipe Card/Chi tiết → Lưu công thức → Công thức đã lưu → mở lại chi tiết → bắt đầu nấu`

### 8.6 Luồng F — Không có công thức phù hợp trong database

`Tìm theo nguyên liệu → backend không tìm thấy công thức đạt ngưỡng match → gọi Gemini → validate dữ liệu có cấu trúc → lưu công thức với nguồn AI → trả kết quả → đưa vào hàng chờ Admin kiểm duyệt`

### 8.7 Luồng G — Quản trị

`Admin đăng nhập → trang quản trị → quản lý tài khoản hoặc công thức → kiểm duyệt công thức Gemini → xuất bản/ẩn/chỉnh sửa`

## 9. Danh sách trang và yêu cầu chức năng

### 9.1 Trang chủ — `/`

Thành phần:

1. Navbar cố định.
2. Hero với heading “Bạn đang có gì trong bếp?”.
3. Ingredient Pill Input.
4. Dải “Gợi ý hôm nay”.
5. Bốn Category Card: Món xào, Món canh, Món chiên, Món hấp.
6. Nút “Tìm món ngay”.
7. Phụ Bếp.

Yêu cầu:

- Nhập nguyên liệu bằng Enter hoặc dấu phẩy.
- Không thêm nguyên liệu trùng, không phân biệt hoa thường.
- Xóa từng pill được.
- Khi tìm kiếm, lưu danh sách nguyên liệu vào query state hoặc search session.
- Hiển thị loading trong khi chờ kết quả.
- Category Card điều hướng đến `/kham-pha`.

Tiêu chí chấp nhận:

- Không cho tìm khi danh sách nguyên liệu rỗng.
- Dữ liệu nguyên liệu vẫn còn khi người dùng quay lại từ trang kết quả trong cùng phiên.
- Lỗi API có thông báo và cho phép thử lại.

### 9.2 Khám phá công thức — `/kham-pha`

Thành phần:

- Navbar với link active phù hợp.
- Category Tabs.
- Recipe Card Grid.
- Phụ Bếp.

Yêu cầu:

- Các danh mục: Món xào, Món canh, Món chiên, Món hấp, Món chay, Tráng miệng.
- Chuyển tab cập nhật danh sách công thức.
- Có thể đồng bộ danh mục lên URL để hỗ trợ chia sẻ và reload.
- Nếu không có dữ liệu, hiển thị Empty State.

### 9.3 Kết quả công thức — `/ket-qua`

Thành phần:

- Navbar.
- Filter Sidebar sticky.
- Recipe Card Grid.
- Loading, empty và error state.
- Phụ Bếp.

Yêu cầu:

- Nhận danh sách nguyên liệu từ trang chủ.
- Mặc định sắp xếp từ dễ đến khó.
- Lọc theo thời gian nấu, số người ăn và độ khó.
- Hiển thị mức độ khớp nguyên liệu nếu backend cung cấp.
- Không tạo công thức giả khi không có kết quả phù hợp.

### 9.4 Chi tiết công thức — `/cong-thuc/[slug]`

Thành phần:

- Ảnh, tên món, độ khó, thời gian và danh mục.
- Hành động lưu, chia sẻ, in.
- Serving Stepper.
- Ingredient Checklist.
- Step List.
- Nút “Bắt đầu nấu”.
- Phụ Bếp.

Yêu cầu:

- Dữ liệu được tải theo slug.
- Thay đổi khẩu phần cập nhật lượng nguyên liệu theo tỷ lệ.
- Checklist chia đúng hai nhóm “Bạn đã có” và “Cần mua thêm”.
- Thuật ngữ có tooltip cho hover, focus và tap.
- Bước khó có cảnh báo.
- Nếu khách chọn “Bắt đầu nấu”, mở Modal đăng nhập thay vì điều hướng vào Cooking Mode.
- Hành động lưu công thức cũng yêu cầu đăng nhập.
- Recipe không tồn tại trả về trang 404 phù hợp.

### 9.5 Cooking Mode — `/cong-thuc/[slug]/nau`

Thành phần:

- Không có Navbar.
- Nút đóng quay về chi tiết.
- Progress Bar.
- Một bước nấu trên mỗi màn hình.
- Timer ở bước có thời gian chờ.
- Nút bước trước/bước sau.
- Nút hoàn thành ở bước cuối.

Yêu cầu:

- Chỉ người dùng đã đăng nhập mới truy cập được.
- Lưu bước hiện tại để tránh mất tiến độ khi refresh.
- Timer có bắt đầu, tạm dừng, tiếp tục và reset.
- Không cho đi lùi trước bước đầu hoặc đi tiếp sau bước cuối.
- Hoàn thành tạo/cập nhật Cooking Session.
- Sau khi hoàn thành mở Feedback Modal.

### 9.6 Feedback Modal

Yêu cầu:

- Rating từ 1 đến 5.
- Multi-select feedback:
  - Cắt thịt khó quá.
  - Chiên bị bắn dầu.
  - Mất nhiều thời gian hơn dự kiến.
  - Thiếu nguyên liệu.
- Ghi chú không bắt buộc.
- Rating là bắt buộc.
- Gửi thành công điều hướng về `/` và hiển thị toast cảm ơn.
- Gửi thất bại giữ nguyên dữ liệu để người dùng thử lại.

### 9.7 Lịch sử nấu — `/lich-su`

Yêu cầu:

- Hiển thị timeline gồm ảnh, món, ngày nấu, rating và feedback.
- Sắp xếp theo gần đây nhất hoặc đánh giá cao nhất.
- Route yêu cầu đăng nhập và lấy dữ liệu từ server.
- Khách truy cập route được yêu cầu đăng nhập.
- Có Empty State khi chưa hoàn thành món nào.

### 9.8 Công thức đã lưu — `/da-luu`

Yêu cầu:

- Hiển thị các công thức đã bookmark.
- Cho phép bỏ lưu ngay trên Recipe Card.
- Route và hành động lưu yêu cầu đăng nhập.
- Dữ liệu được lưu trên server theo tài khoản.
- Khách chọn bookmark được yêu cầu đăng nhập; không lưu tạm bằng local storage.
- Có Empty State “Bạn chưa lưu công thức nào”.

### 9.9 Hồ sơ và Cá nhân hóa — `/ho-so`

Yêu cầu:

- Chỉ dành cho người đã đăng nhập.
- Sub-nav: Thông tin cá nhân, Cá nhân hóa, Cài đặt.
- Tab cá nhân hóa đọc từ `?tab=ca-nhan-hoa`.
- Hiển thị mức độ tự tin nấu ăn.
- Hiển thị 2–3 Insight Card gần nhất hoặc quan trọng nhất.
- Cho phép chỉnh sửa thông tin cá nhân cơ bản.

### 9.10 Modal đăng nhập/đăng ký

Yêu cầu:

- Tab đăng nhập và đăng ký.
- Email, password; đăng ký có thêm tên.
- Đăng nhập Google.
- Luôn có “Dùng thử không cần đăng nhập”.
- Sau khi đăng nhập thành công, người dùng quay lại hành động hoặc route đã yêu cầu xác thực.
- Validate tại client và server.
- Modal có focus trap, đóng bằng Escape và khôi phục focus.

### 9.11 Phụ Bếp

Yêu cầu:

- Chỉ người dùng đã đăng nhập mới sử dụng được; khách chọn trigger được yêu cầu đăng nhập.
- Nút trigger fixed ở góc dưới phải.
- Chat panel chỉ lazy mount khi mở lần đầu.
- Hỗ trợ text, quick reply và Recipe Card nhúng.
- Hiển thị typing indicator khi chờ.
- Lưu context trong conversation hiện tại.
- Trả lời phải ưu tiên dữ liệu công thức có trong hệ thống.
- Nếu không chắc chắn, phải nói rõ và đưa ra lựa chọn an toàn.
- Cooking Mode ẩn Phụ Bếp để giữ tập trung.

### 9.12 Trang quản trị — `/admin`

Yêu cầu chung:

- Chỉ tài khoản có role `ADMIN` được truy cập.
- Route con tối thiểu:
  - `/admin/cong-thuc`: danh sách, tìm kiếm, lọc và quản lý công thức.
  - `/admin/cong-thuc/[id]`: tạo mới hoặc chỉnh sửa công thức.
  - `/admin/tai-khoan`: danh sách, tìm kiếm và quản lý trạng thái tài khoản.
- Admin có thể tạo, chỉnh sửa, ẩn, xuất bản và xóa mềm công thức.
- Công thức do Gemini tạo phải hiển thị nhãn nguồn AI và trạng thái kiểm duyệt.
- Admin có thể duyệt, từ chối hoặc chỉnh sửa công thức AI trước khi xuất bản chính thức.
- Admin có thể khóa/mở khóa tài khoản nhưng không được xem password hoặc token.
- Mọi thao tác quản trị quan trọng phải có xác nhận và được ghi audit log.

## 10. Logic cá nhân hóa

| Feedback | Điều chỉnh bắt buộc |
|---|---|
| Cắt thịt khó quá | Ưu tiên món không cần cắt nhỏ hoặc thêm mẹo tại bước liên quan |
| Chiên bị bắn dầu | Thêm cảnh báo/kỹ thuật an toàn trước bước chiên |
| Mất nhiều thời gian hơn dự kiến | Điều chỉnh ước tính và ưu tiên món nhanh hơn |
| Thiếu nguyên liệu | Tăng trọng số khớp nguyên liệu, giảm món cần mua thêm |

### 10.1 Cách triển khai MVP đề xuất

- Chuyển feedback thành các preference có trọng số.
- Recommendation service dùng preference để rerank danh sách công thức.
- Recipe detail service chèn cảnh báo/mẹo đã được kiểm duyệt vào đúng bước.
- Mỗi thay đổi tạo một Personalization Insight để giải thích cho người dùng.
- Không cho mô hình AI tự sửa dữ liệu gốc của công thức.

## 11. Yêu cầu front-end

### 11.1 Công nghệ đã có

- Next.js 16, App Router.
- React 19.
- TypeScript strict.
- Tailwind CSS 4.
- `next/font`, `next/image`, `next/link`.

### 11.2 Kiến trúc front-end

- Server Component là mặc định.
- Client Component chỉ dùng cho state, effect hoặc browser API.
- Fetch dữ liệu ban đầu tại Server Component khi phù hợp.
- Tách lớp gọi API vào `src/lib/api/` hoặc `src/services/`.
- Tách type API dùng chung khỏi mock data.
- Có `loading.tsx`, `error.tsx`, `not-found.tsx` ở các route phù hợp.
- Dùng URL search params cho filter/tab cần chia sẻ.
- Không để page component chứa toàn bộ logic tương tác.

### 11.3 Quản lý trạng thái đề xuất

- URL: category, filter, query tìm kiếm.
- Server state: dữ liệu công thức, lịch sử, hồ sơ, saved recipes.
- Local state: modal, stepper, checklist, timer, chat panel.
- Khách chỉ lưu tạm nguyên liệu/filter phục vụ tìm kiếm trong phiên; không lưu dữ liệu protected.
- Khi tích hợp API phức tạp, có thể dùng TanStack Query cho mutation/cache phía client; không bắt buộc nếu Server Actions/fetch đáp ứng đủ.

### 11.4 Form và validation

- Dùng schema dùng chung hoặc tương đương Zod.
- Hiển thị lỗi theo field.
- Disable submit khi đang gửi.
- Không làm mất dữ liệu khi request lỗi.
- Server luôn validate lại, không tin dữ liệu từ client.

### 11.5 Accessibility

- Semantic HTML.
- Điều hướng được bằng bàn phím.
- Icon-only button có `aria-label`.
- Modal có `role="dialog"`, `aria-modal`, focus trap và Escape.
- Tooltip hoạt động bằng hover, focus và tap.
- Progress Bar có label và thuộc tính ARIA.
- Contrast tối thiểu WCAG AA.

### 11.6 Hiệu năng

- Dùng `next/image` với `sizes`.
- Lazy load Phụ Bếp và modal nặng.
- Hạn chế JavaScript phía client.
- Recipe Card có key ổn định.
- Tránh request trùng và loading nhấp nháy.
- Mục tiêu đề xuất: LCP < 2,5 giây và CLS < 0,1 ở mạng di động phổ biến.

## 12. Yêu cầu back-end

### 12.1 Kiến trúc đã chốt

- Runtime: Node.js.
- Framework: Express.js.
- Kiểu API: REST JSON, version hóa `/api/v1`.
- Database: Supabase PostgreSQL.
- ORM/database client: tuân theo kiến trúc đang có trong backend repository; không tự ý thay đổi thư viện nếu chưa cần thiết.
- Cache/rate limit: Redis ở giai đoạn production hoặc khi cần.
- Auth: JWT; API bảo vệ đọc token từ `Authorization: Bearer <token>`.
- AI provider: Google Gemini, được bọc qua service/adapter riêng.
- Lưu ảnh: object storage/CDN; MVP có thể dùng asset tĩnh.
- Deployment: backend trên Railway, front-end trên Vercel.

Front-end và backend nằm ở hai repository riêng. Agent phải đọc API contract hoặc source backend hiện có trước khi thay đổi contract, không tự tạo endpoint trùng hoặc khác chuẩn đang dùng.

### 12.2 Module backend

1. **Auth**
   - Đăng ký, đăng nhập, refresh, đăng xuất.
   - Google OAuth.
   - Hash password bằng Argon2 hoặc bcrypt.
   - Role-based access control cho `USER` và `ADMIN`.

2. **Users/Profile**
   - Hồ sơ người dùng.
   - Mức độ tự tin nấu ăn.
   - Preference và insight cá nhân hóa.

3. **Recipes**
   - Danh sách, danh mục, chi tiết theo slug.
   - Ingredient, step, cooking term.
   - Filter và pagination.

4. **Recommendations**
   - Match nguyên liệu.
   - Tính nguyên liệu thiếu.
   - Rerank theo độ khó, thời gian và preference.
   - Chỉ gọi Gemini tạo công thức khi không có candidate đạt ngưỡng match.
   - Validate và lưu công thức AI với nguồn, model và trạng thái kiểm duyệt.

5. **Saved Recipes**
   - Lưu, bỏ lưu, danh sách đã lưu.

6. **Cooking Sessions**
   - Bắt đầu phiên nấu.
   - Lưu tiến độ.
   - Hoàn thành phiên.

7. **Feedback**
   - Rating, chip, ghi chú.
   - Cập nhật personalization.

8. **History**
   - Lịch sử nấu và sắp xếp.

9. **Phụ Bếp**
   - Conversation và message.
   - Gọi AI có context.
   - Trả về text và recipe references có cấu trúc.

10. **Observability**
    - Structured log.
    - Error tracking.
    - Metrics cho API/AI.

11. **Admin**
    - CRUD và kiểm duyệt công thức.
    - Quản lý trạng thái tài khoản.
    - Audit log cho thao tác quản trị.

## 13. Mô hình dữ liệu đề xuất

### 13.1 User

- `id`
- `name`
- `email`
- `passwordHash` nullable với OAuth account
- `avatarUrl`
- `role` (`USER` hoặc `ADMIN`)
- `status` (`ACTIVE` hoặc `BLOCKED`)
- `cookingConfidence`
- `createdAt`
- `updatedAt`

### 13.2 Account / RefreshToken

- Thông tin provider OAuth.
- Refresh token đã hash.
- Thời gian hết hạn và thu hồi.

### 13.3 Recipe

- `id`
- `slug` unique
- `title`
- `description`
- `imageUrl`
- `imageAlt`
- `difficulty`
- `cookTimeMinutes`
- `baseServings`
- `categoryId`
- `status`
- `source` (`ADMIN`, `SEED` hoặc `GEMINI`)
- `aiModel` nullable
- `moderationStatus` (`PENDING`, `APPROVED`, `REJECTED`)
- `createdBy` nullable
- `createdAt`
- `updatedAt`

### 13.4 Ingredient

- `id`
- `name`
- `normalizedName`
- `aliases`

### 13.5 RecipeIngredient

- `recipeId`
- `ingredientId`
- `amount`
- `unit`
- `prepNote`
- `order`

### 13.6 RecipeStep

- `id`
- `recipeId`
- `order`
- `content`
- `estimatedMinutes`
- `techniqueIcon`
- `isTricky`
- `timerSeconds` nullable

### 13.7 CookingTerm

- `term`
- `definition`

Quan hệ giữa term và step cần hỗ trợ đánh dấu vị trí hiển thị tooltip.

### 13.8 SavedRecipe

- `userId`
- `recipeId`
- `createdAt`
- Unique `(userId, recipeId)`

### 13.9 CookingSession

- `id`
- `userId`
- `recipeId`
- `currentStep`
- `servings`
- `startedAt`
- `completedAt`
- `status`

### 13.10 Feedback

- `id`
- `cookingSessionId`
- `userId`
- `rating`
- `tags`
- `note`
- `createdAt`

### 13.11 UserPreference

- `userId`
- `key`
- `weight`
- `sourceFeedbackId`
- `updatedAt`

### 13.12 PersonalizationInsight

- `id`
- `userId`
- `type`
- `message`
- `isActive`
- `createdAt`

### 13.13 ChatConversation / ChatMessage

- Conversation thuộc người dùng đã đăng nhập.
- Message có role, content, recipe references, token/latency metadata và thời gian tạo.
- Không lưu dữ liệu nhạy cảm không cần thiết trong prompt hoặc log.

### 13.14 AuditLog

- `id`
- `adminUserId`
- `action`
- `entityType`
- `entityId`
- `metadata`
- `createdAt`

## 14. API contract đề xuất

### 14.1 Auth

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/google`
- `GET /api/v1/auth/google/callback`
- `GET /api/v1/auth/me`

### 14.2 Recipes

- `GET /api/v1/categories`
- `GET /api/v1/recipes`
- `GET /api/v1/recipes/:slug`
- `POST /api/v1/recommendations`

Request recommendation tối thiểu:

```json
{
  "ingredients": ["thịt bò", "bông cải"],
  "servings": 2,
  "filters": {
    "difficulties": ["de"],
    "maxCookTimeMinutes": 30
  }
}
```

Response phải trả dữ liệu có cấu trúc, gồm recipe, match score, matched ingredients và missing ingredients.

### 14.3 Saved recipes

- `GET /api/v1/me/saved-recipes`
- `PUT /api/v1/me/saved-recipes/:recipeId`
- `DELETE /api/v1/me/saved-recipes/:recipeId`

### 14.4 Cooking và feedback

- `POST /api/v1/cooking-sessions`
- `PATCH /api/v1/cooking-sessions/:id`
- `POST /api/v1/cooking-sessions/:id/complete`
- `POST /api/v1/cooking-sessions/:id/feedback`
- `GET /api/v1/me/cooking-history`

### 14.5 Profile và personalization

- `GET /api/v1/me/profile`
- `PATCH /api/v1/me/profile`
- `GET /api/v1/me/personalization`
- `GET /api/v1/me/insights`

### 14.6 Phụ Bếp

- `POST /api/v1/chat/conversations`
- `GET /api/v1/chat/conversations/:id/messages`
- `POST /api/v1/chat/conversations/:id/messages`

Các endpoint chat yêu cầu JWT hợp lệ. Có thể dùng SSE để stream câu trả lời. Nếu chưa triển khai streaming, API phải trả trạng thái loading và timeout rõ ràng.

### 14.7 Admin

- `GET /api/v1/admin/recipes`
- `POST /api/v1/admin/recipes`
- `GET /api/v1/admin/recipes/:id`
- `PATCH /api/v1/admin/recipes/:id`
- `DELETE /api/v1/admin/recipes/:id`
- `POST /api/v1/admin/recipes/:id/approve`
- `POST /api/v1/admin/recipes/:id/reject`
- `GET /api/v1/admin/users`
- `PATCH /api/v1/admin/users/:id/status`
- `GET /api/v1/admin/audit-logs`

Tất cả endpoint `/admin` yêu cầu JWT hợp lệ và role `ADMIN`.

### 14.8 Chuẩn response và lỗi

```json
{
  "data": {},
  "meta": {},
  "error": null
}
```

Lỗi tối thiểu gồm:

- `code` ổn định để front-end xử lý.
- `message` an toàn cho người dùng.
- `fieldErrors` cho validation.
- `requestId` để truy vết.

## 15. Quy tắc matching và recommendation

### 15.1 Chuẩn hóa nguyên liệu

- Trim khoảng trắng.
- Chuyển về chữ thường theo locale tiếng Việt.
- Chuẩn hóa alias, ví dụ “cà chua” và tên gọi tương đương đã được cấu hình.
- Không gộp hai nguyên liệu khác nhau chỉ bằng fuzzy matching thiếu kiểm soát.

### 15.2 Điểm gợi ý MVP

Điểm tổng hợp có thể gồm:

- Tỷ lệ nguyên liệu đã có.
- Số nguyên liệu còn thiếu.
- Độ khó phù hợp.
- Thời gian phù hợp.
- Khẩu phần phù hợp.
- Preference từ feedback.
- Độ phổ biến hoặc chất lượng công thức.

Thuật toán phải xác định candidate trong Supabase PostgreSQL trước và cá nhân hóa thứ tự cho người dùng đã đăng nhập.

Nếu không có candidate đạt ngưỡng match:

1. Backend gửi nguyên liệu, filter và schema công thức bắt buộc đến Gemini.
2. Gemini trả structured output.
3. Backend validate schema, đơn vị, bước nấu và dữ liệu bắt buộc.
4. Công thức hợp lệ được lưu với `source = GEMINI`, model đã dùng và `moderationStatus = PENDING`.
5. Công thức được trả cho lượt tìm kiếm hiện tại và xuất hiện trong hàng chờ kiểm duyệt Admin.
6. Công thức `PENDING` không xuất hiện trong catalog công khai cho người dùng khác cho đến khi được duyệt.
7. Công thức bị lỗi validation không được lưu hoặc trả cho người dùng.

## 16. AI, an toàn và fallback

- Sử dụng Google Gemini.
- Với recommendation thông thường, hệ thống ưu tiên công thức trong database và cá nhân hóa thứ tự kết quả.
- Gemini chỉ tạo công thức mới khi không có công thức đạt ngưỡng match.
- Prompt tạo công thức phải yêu cầu structured output đúng schema backend.
- Recipe reference từ Phụ Bếp phải dùng ID/slug tồn tại trong database.
- Lưu metadata về model, thời gian tạo và nguồn AI.
- Không đưa lời khuyên y tế hoặc khẳng định an toàn tuyệt đối.
- Cảnh báo phù hợp với thực phẩm sống, dầu nóng, dao và dị ứng khi có dữ liệu.
- Thiết lập timeout, retry có giới hạn và circuit breaker.
- Nếu AI lỗi:
  - Không tạo công thức mới.
  - Trả Empty State phù hợp nếu database không có kết quả.
  - Phụ Bếp thông báo chưa thể trả lời và gợi ý duyệt công thức.
- Theo dõi chi phí, latency, token và tỷ lệ lỗi.
- Không ghi password, token, cookie hoặc prompt chứa thông tin nhạy cảm vào log.

## 17. Yêu cầu phi chức năng

### 17.1 Bảo mật

- HTTPS ở production.
- Password hash an toàn.
- Access JWT được gửi qua `Authorization: Bearer <token>`.
- Không lưu JWT trong log, URL hoặc source code.
- Refresh token, nếu backend có sử dụng, phải có cơ chế hết hạn và thu hồi an toàn.
- Rate limit cho auth, recommendation và chat.
- Validate và sanitize toàn bộ input.
- Phân quyền route `/me`.
- Không lộ stack trace hoặc secret.
- Cấu hình CORS cho domain Vercel của front-end và các origin development được cho phép.
- Role `ADMIN` phải được kiểm tra tại backend, không chỉ ẩn UI ở front-end.

### 17.2 Hiệu năng và độ tin cậy

- P95 API đọc dữ liệu thông thường đề xuất dưới 500 ms.
- P95 recommendation không AI đề xuất dưới 1 giây.
- Phản hồi AI đầu tiên đề xuất dưới 3 giây khi streaming.
- Pagination cho danh sách công thức/lịch sử.
- Database có index cho slug, category, normalized ingredient, user history và saved recipes.
- API idempotent cho hành động lưu/bỏ lưu và hoàn thành phiên nấu.

### 17.3 Khả năng bảo trì

- TypeScript strict ở cả hai phía.
- OpenAPI/Swagger là nguồn contract backend.
- Migration database có version.
- Không hardcode secret.
- Tách domain logic khỏi controller và UI.
- Có seed data cho development/test.

### 17.4 Quyền riêng tư

- Chỉ thu thập dữ liệu cần cho tính năng.
- Không lưu history, feedback, saved recipe hoặc Cooking Session cho khách.
- Không tạo hoặc lưu Chat Conversation cho khách vì Phụ Bếp yêu cầu đăng nhập.
- Người dùng có thể đăng xuất và làm mất hiệu lực token theo cơ chế backend.
- Trước production cần bổ sung chính sách quyền riêng tư và cơ chế xóa tài khoản/dữ liệu.

## 18. Testing và tiêu chuẩn hoàn thành

### 18.1 Front-end

- Unit test cho normalize ingredient, filter, serving calculation và local persistence.
- Component test cho input, modal, timer, feedback và bookmark.
- E2E cho bốn luồng chính.
- Kiểm tra responsive trên mobile, tablet và desktop.
- Kiểm tra keyboard navigation và accessibility.
- `npm run lint`, `npm run typecheck`, `npm run build` phải thành công.

### 18.2 Back-end

- Unit test cho auth, matching, personalization và permission.
- Integration test với database.
- Contract test cho endpoint front-end sử dụng.
- Test refresh token, rate limit và validation.
- Test trường hợp AI timeout hoặc trả dữ liệu sai schema.

### 18.3 Definition of Done

Một tính năng chỉ hoàn thành khi:

- Đạt acceptance criteria.
- Có loading, error, empty và success state liên quan.
- Có test phù hợp với mức rủi ro.
- Không vi phạm quy tắc UI/docs.
- Không còn mock/TODO trong phạm vi tính năng.
- API contract và tài liệu được cập nhật.
- Lint, typecheck, test và build thành công.

## 19. Hiện trạng dự án ngày 22/06/2026

### 19.1 Đã có ở front-end

- Khung Next.js, TypeScript strict và Tailwind.
- Navbar.
- Trang chủ.
- Trang khám phá.
- Trang kết quả và filter.
- Trang chi tiết công thức.
- Trang công thức đã lưu.
- Auth Modal ở mức UI/mock.
- Recipe Card và các component nền tảng chính.
- Mock recipe data.
- Bookmark bằng local storage.

### 19.2 Chưa hoàn thiện hoặc chưa có

- Backend đã tồn tại ở repository riêng nhưng chưa được đối chiếu trong PRD này.
- Tích hợp front-end với backend và Supabase PostgreSQL.
- API client/contract.
- Auth/session thật và Google OAuth thật.
- Recommendation theo nguyên liệu thật.
- Cooking Mode.
- Feedback Modal và lưu feedback.
- Lịch sử nấu.
- Hồ sơ/cá nhân hóa.
- Phụ Bếp.
- Đồng bộ saved recipes theo tài khoản.
- Loại bỏ bookmark local storage cho khách khi tích hợp auth thật.
- Trang và API quản trị công thức/tài khoản.
- Workflow kiểm duyệt công thức do Gemini tạo.
- Analytics, monitoring và test suite đầy đủ.
- Một số route-level error/not-found state.

## 20. Kế hoạch triển khai từng bước

Kế hoạch dưới đây ưu tiên hoàn thành một lát cắt end-to-end trước, sau đó mở rộng. Mỗi giai đoạn chỉ chuyển tiếp khi contract và kiểm thử của giai đoạn trước ổn định.

### Giai đoạn 0 — Khảo sát backend hiện có và chốt hợp đồng

**Front-end**

1. Kiểm tra lại toàn bộ route/component với docs.
2. Tách type khỏi `mockRecipes.ts`.
3. Thiết lập lớp API client và biến môi trường.
4. Bổ sung quy ước loading/error/not-found.

**Back-end**

1. Khảo sát repository Node.js + Express.js hiện có.
2. Đối chiếu schema Supabase PostgreSQL, JWT flow, route và middleware.
3. Bổ sung hoặc cập nhật ERD và OpenAPI theo contract thực tế.
4. Kiểm tra migration, seed, lint, test và env validation.
5. Không thay đổi kiến trúc hoặc thư viện backend đang hoạt động nếu không cần cho yêu cầu.

**Đầu ra**

- Architecture Decision Record.
- ERD.
- OpenAPI bản đầu.
- Hai repository chạy được ở local và kết nối qua API.

### Giai đoạn 1 — Recipe catalog end-to-end

**Back-end**

1. Tạo schema Category, Recipe, Ingredient, RecipeIngredient, RecipeStep và CookingTerm.
2. Import mock recipe hiện tại thành seed data.
3. Xây API danh sách, filter và chi tiết theo slug.
4. Thêm pagination, validation và index.

**Front-end**

1. Thay mock data tại Khám phá, Kết quả và Chi tiết bằng API.
2. Bổ sung loading, error, retry và 404.
3. Giữ Server Component cho initial fetch.
4. Kiểm tra Recipe Card, filter và chi tiết với dữ liệu thật.

**Đầu ra**

- Có thể duyệt và xem công thức từ database.

### Giai đoạn 2 — Tìm món theo nguyên liệu

**Back-end**

1. Xây chuẩn hóa nguyên liệu và alias.
2. Xây recommendation/matching service.
3. Trả matched/missing ingredients và score.
4. Cá nhân hóa thứ tự kết quả cho người dùng đã đăng nhập.
5. Nếu không có candidate đạt ngưỡng, gọi Gemini tạo công thức, validate, lưu và đưa vào hàng chờ kiểm duyệt.

**Front-end**

1. Kết nối Ingredient Pill Input với recommendation API.
2. Truyền search session sang `/ket-qua`.
3. Hiển thị nguyên liệu khớp/thiếu.
4. Hoàn thiện loading, empty và error state.

**Đầu ra**

- Luồng Trang chủ → Kết quả → Chi tiết hoạt động với dữ liệu thật.

### Giai đoạn 3 — JWT Authentication và saved recipes

**Back-end**

1. Đăng ký, đăng nhập, refresh, logout.
2. Google OAuth.
3. User/Profile schema.
4. Saved Recipe API.
5. Middleware JWT và phân quyền `USER`/`ADMIN`.

**Front-end**

1. Kết nối Auth Modal.
2. Quản lý session và trạng thái Navbar.
3. Kết nối bookmark với server khi đăng nhập.
4. Khách chọn bookmark hoặc bắt đầu nấu được yêu cầu đăng nhập.
5. Xóa cơ chế lưu bookmark local dành cho khách.

**Đầu ra**

- JWT auth thật, route guard và saved recipes hoạt động theo tài khoản.

### Giai đoạn 4 — Cooking Mode và lịch sử

**Back-end**

1. Cooking Session API.
2. Lưu current step, servings, start/completion time.
3. History API và sort.

**Front-end**

1. Xây route Cooking Mode không Navbar.
2. Xây progress, timer và navigation.
3. Khôi phục tiến độ.
4. Xây trang Lịch sử nấu.
5. Bảo vệ route, yêu cầu đăng nhập trước khi bắt đầu nấu.

**Đầu ra**

- Người dùng có thể bắt đầu, tiếp tục, hoàn thành và xem lại phiên nấu.

### Giai đoạn 5 — Feedback và cá nhân hóa

**Back-end**

1. Feedback API.
2. Preference rule engine theo bốn loại feedback.
3. Personalization Insight.
4. Rerank recommendation theo preference.

**Front-end**

1. Xây Feedback Modal.
2. Gửi feedback và hiển thị toast.
3. Xây trang Hồ sơ và tab Cá nhân hóa.
4. Hiển thị confidence và Insight Card.

**Đầu ra**

- Hoàn chỉnh vòng lặp feedback → điều chỉnh → insight.

### Giai đoạn 6 — Admin

**Back-end**

1. CRUD công thức, soft delete và trạng thái xuất bản.
2. API kiểm duyệt công thức Gemini.
3. API quản lý trạng thái tài khoản.
4. RBAC middleware và Audit Log.

**Front-end**

1. Xây layout và route `/admin`.
2. Xây màn hình danh sách/chỉnh sửa công thức.
3. Xây hàng chờ kiểm duyệt công thức Gemini.
4. Xây màn hình quản lý tài khoản.
5. Bảo vệ route theo role `ADMIN`.

**Đầu ra**

- Admin quản trị được công thức, công thức AI và tài khoản.

### Giai đoạn 7 — Phụ Bếp

**Back-end**

1. Conversation/message API.
2. AI adapter và structured output.
3. Retrieval theo recipe database.
4. Recipe reference validation.
5. Rate limit, timeout, moderation và fallback.
6. SSE streaming nếu phù hợp.

**Front-end**

1. Trigger và lazy chat panel.
2. Message bubble, quick replies, typing indicator.
3. Recipe Card nhúng.
4. Streaming/error/retry.
5. Điều hướng từ chat đến chi tiết.

**Đầu ra**

- Phụ Bếp trả lời dựa trên dữ liệu hệ thống và gợi ý được công thức hợp lệ.

### Giai đoạn 8 — Hoàn thiện chất lượng và triển khai

**Cả hai phía**

1. E2E toàn bộ user flow.
2. Accessibility audit.
3. Performance audit.
4. Security review.
5. Analytics và error monitoring.
6. Kiểm thử responsive và trình duyệt.
7. Xử lý toàn bộ TODO/mock còn lại.
8. Triển khai backend lên Railway.
9. Triển khai front-end lên Vercel.
10. Cấu hình biến môi trường, CORS, Supabase, backup và rollback.

**Đầu ra**

- Release candidate sẵn sàng cho UAT.

## 21. Thứ tự ưu tiên backlog

### P0 — Bắt buộc để có MVP sử dụng được

- Recipe database/API.
- Tìm theo nguyên liệu.
- Chi tiết công thức.
- Cooking Mode.
- Guest search/view flow và authentication gate.
- Feedback.
- Loading/error/empty state.

### P1 — Bắt buộc để đạt đầy đủ giá trị sản phẩm

- Auth.
- Saved recipes đồng bộ.
- Lịch sử.
- Cá nhân hóa.
- Phụ Bếp.
- Admin quản trị công thức và tài khoản.

### P2 — Hoàn thiện sau MVP

- Streaming chat.
- Analytics dashboard.
- Recommendation ranking nâng cao.

## 22. Rủi ro và phương án giảm thiểu

| Rủi ro | Ảnh hưởng | Giảm thiểu |
|---|---|---|
| Gemini tạo công thức không hợp lệ | Mất tin cậy, rủi ro an toàn | Structured output, schema validation, metadata nguồn và Admin kiểm duyệt |
| Matching tên nguyên liệu tiếng Việt kém | Kết quả không liên quan | Alias dictionary, normalize, test dataset |
| Backend contract thay đổi liên tục | FE/BE chặn nhau | OpenAPI, mock server, contract test |
| Khách truy cập nhầm chức năng cần auth | Sai nghiệp vụ, lỗi dữ liệu | Guard ở cả front-end và backend |
| Cooking progress bị mất | Trải nghiệm kém | Local persistence + server checkpoint |
| Chat chậm hoặc tốn chi phí | UX và chi phí kém | Streaming, cache, rate limit, fallback |
| Thiếu dữ liệu recipe chất lượng | AI không giải quyết được | Seed có kiểm duyệt, schema bắt buộc, content QA |
| Scope quá lớn | Trễ tiến độ | Bám P0/P1, hoàn thành theo vertical slice |

## 23. Ràng buộc thực thi cho Agent

1. Không giả định backend nằm trong front-end repository.
2. Trước khi sửa tích hợp, phải đọc route, middleware JWT, schema và API contract trong backend repository.
3. Không đổi Express.js, Supabase PostgreSQL, Gemini, Railway hoặc Vercel sang công nghệ khác nếu không có yêu cầu mới.
4. Không cấp quyền Cooking Mode, saved recipes, feedback, history, personalization hoặc Phụ Bếp cho khách.
5. Không gọi Gemini tạo công thức nếu database vẫn có candidate đạt ngưỡng match.
6. Không tin role hoặc user ID do client tự gửi; phải lấy từ JWT đã xác thực.
7. Không cho công thức AI trở thành công thức chính thức mà thiếu metadata nguồn và trạng thái kiểm duyệt.
8. Không lưu dữ liệu guest để merge vào tài khoản sau khi đăng nhập.

## 24. Mốc nghiệm thu đề xuất

- **M1 — Catalog:** duyệt, lọc và xem chi tiết từ database.
- **M2 — Recommendation:** nhập nguyên liệu và nhận kết quả thật.
- **M3 — Identity:** JWT auth, route guard và saved recipes.
- **M4 — Cooking:** Cooking Mode và history.
- **M5 — Learning:** feedback và personalization.
- **M6 — Administration:** quản trị công thức, công thức Gemini và tài khoản.
- **M7 — Assistant:** Phụ Bếp.
- **M8 — Release candidate:** test, bảo mật, hiệu năng, Railway và Vercel hoàn tất.
