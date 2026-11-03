---
name: typelearn-design
description: >-
  Design system and UX/UI specifications tailored specifically for TypeLearn
  (knowledge typing web application). Enforces typing screen rules, Vietnamese IME handling,
  color and typography tokens, mobile virtual keyboard checklist, contrast standards,
  and zero-mouse keyboard shortcuts.
metadata:
  author: typelearn
  version: "1.0.0"
---

# TypeLearn Design System & UX Guidelines

Tài liệu quy tắc thiết kế và chuẩn UX/UI dành riêng cho dự án **TypeLearn** — ứng dụng web học tập & luyện gõ kiến thức từ Markdown.

Mục tiêu cốt lõi: **Zen, tối giản, phản xạ tức thì, không gây xao nhãng thị giác (Cognitive Ease)**.

---

## 1. Triết lý Giao diện & Trải nghiệm

1. **Một việc mỗi màn hình (Single-Focus Viewports)**:
   - **Thư viện / Kho**: Tìm kiếm, lọc category/tag, duyệt danh sách.
   - **Thêm bài**: Paste markdown, xem trước các khối (khối gõ, code, flow), lưu.
   - **Đọc bài**: Xem trọn vẹn văn bản, code syntax highlight, sơ đồ Mermaid, mục lục heading.
   - **Luyện gõ**: Ẩn mọi thanh công cụ rườm rà. Chỉ tập trung vào khối văn bản đang gõ, con trỏ và chỉ số tối thiểu (WPM, độ chính xác).
   - **Tổng kết**: Thống kê kết quả, từ gõ sai, nút luyện lại hoặc chuyển bài.
2. **Zero-Mouse Flow**: Toàn bộ thao tác học và chuyển đổi trạng thái phải thực hiện được 100% bằng bàn phím.
3. **Phản hồi không chỉ dựa vào màu sắc**: Để hỗ trợ người dùng mù màu hoặc màn hình giảm ánh sáng xanh, lỗi sai phải được thể hiện qua cả màu sắc lẫn ký hiệu trực quan (gạch chân lượn sóng hoặc nền tương phản).

---

## 2. Quy tắc Màn hình Luyện Gõ (Typing Screen)

### 2.1 Cấu trúc & Vị trí hiển thị
- Khối văn bản đang luyện luôn được neo ở **trung tâm trục thị giác** của màn hình (`viewport vertical center`).
- Tránh để khối văn bản nhảy vị trí (Layout Shift / CLS) khi người dùng gõ từ dòng này sang dòng khác.
- Khoảng cách dòng (`line-height`) thoáng đãng (1.8 - 2.0) để mắt không bị nhảy dòng khi đối chiếu.

### 2.2 Trạng thái Ký tự trong Khối gõ
- **Chưa gõ (Untyped)**: Độ tương phản vừa phải (muted text), không quá tối để vẫn dễ đọc, nhưng không sáng bằng ký tự đã gõ đúng.
- **Con trỏ (Active Cursor)**: Vị trí ký tự tiếp theo cần gõ. Dùng con trỏ dọc mỏng hoặc gạch chân nhấp nháy êm dịu (animation mượt, tắt khi người dùng đang gõ liên tục).
- **Đã gõ đúng (Correct)**: Tô màu sáng rõ ràng, tăng độ tương phản so với nền.
- **Đã gõ sai (Incorrect)**:
  - Màu cảnh báo (đỏ dịu, không chói gắt).
  - Kết hợp với đường gạch chân đứt nét hoặc lượn sóng (`text-decoration: underline wavy` hoặc viền đỏ mờ dưới chân).
  - Nếu ký tự gõ sai là phím cách (`space`), hiển thị ký hiệu khoảng trắng `␣` màu đỏ để người học nhận biết.

### 2.3 Xử lý Bộ gõ Tiếng Việt (IME - Telex / VNI)
> ⚠️ **Quy tắc sống còn cho tiếng Việt**:
> Bộ gõ tiếng Việt trên OS (Unikey, EVKey, macOS Telex, Gboard) liên tục gửi chuỗi ký tự tạm và backspace tự động khi người dùng bỏ dấu (ví dụ: gõ `t` `o` `a` `n` `s` -> `toán`).
> - **Bắt buộc** lắng nghe sự kiện `compositionstart`, `compositionupdate`, `compositionend`.
> - Trong khi `isComposing === true`, **tuyệt đối không chấm điểm đúng/sai tức thì**, không nhảy con trỏ làm gãy từ.
> - Chỉ cập nhật trạng thái khối gõ và tính lỗi sau khi sự kiện `compositionend` kết thúc một âm tiết.

---

## 3. Design Tokens (Màu sắc & Kiểu chữ)

### 3.1 Bảng màu (Tokens)

Hỗ trợ cả chế độ Sáng (Light) và Tối (Dark). Mặc định ưu tiên Dark theme cho không gian học tập yên tĩnh, dịu mắt.

| Token Semantics | Dark Mode (Primary) | Light Mode | Ý nghĩa & Tiêu chuẩn WCAG |
|---|---|---|---|
| `--bg-app` | `#0f141c` | `#f8fafc` | Nền chính của ứng dụng |
| `--bg-surface` | `#18202c` | `#ffffff` | Nền thẻ bài viết, ô modal |
| `--bg-subtle` | `#222d3d` | `#f1f5f9` | Nền badge, nút phụ, khối code |
| `--text-primary` | `#f1f5f9` | `#0f172a` | Tiêu đề, nội dung đọc chính (≥ 7:1) |
| `--text-untyped` | `#627284` | `#94a3b8` | Chữ chưa gõ trong khối (≥ 4.5:1) |
| `--text-correct` | `#e2e8f0` (hoặc `#4ade80`) | `#0f172a` (hoặc `#16a34a`) | Chữ đã gõ đúng |
| `--text-error` | `#f87171` | `#dc2626` | Chữ gõ sai |
| `--bg-error` | `rgba(239, 68, 68, 0.15)` | `rgba(239, 68, 68, 0.12)` | Nền highlight ký tự sai |
| `--accent` | `#38bdf8` | `#0284c7` | Điểm nhấn phím tắt, link, con trỏ |
| `--border-focus` | `#38bdf8` | `#0284c7` | Viền focus-visible |

### 3.2 Kiểu chữ (Typography)
- **Phông chữ màn hình gõ**: Ưu tiên Monospace hoặc Sans có hình khối ký tự rõ ràng, khoảng cách đồng đều:
  ```css
  font-family: "JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  ```
- **Kích thước chữ vùng gõ**:
  - Desktop: `1.25rem` (20px) đến `1.375rem` (22px), `line-height: 1.85`.
  - Mobile: `1.125rem` (18px), `line-height: 1.75`.
- **Phông chữ nội dung đọc & hệ thống**:
  ```css
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  ```
- **Chỉ số WPM & Thời gian**: Luôn áp dụng `font-variant-numeric: tabular-nums` để các chữ số không làm giật khung chữ khi biến thiên liên tục.

---

## 4. Bàn phím & Phím tắt (Zero-Mouse Navigation)

Hiển thị gợi ý phím tắt tinh tế ở cạnh dưới màn hình (`<kbd>`) để người dùng dễ ghi nhớ:

| Phím tắt | Ngữ cảnh | Hành động |
|---|---|---|
| `Enter` | Sau khi gõ hết khối | Chuyển sang khối gõ kế tiếp |
| `Tab` hoặc `Ctrl + R` | Màn hình Gõ | Luyện lại khối văn bản hiện tại từ đầu |
| `Esc` | Màn hình Gõ | Thoát ra chế độ Đọc hoặc danh sách bài |
| `Ctrl + J` / `Cmd + J` | Màn hình Gõ / Đọc | Bật phát âm thanh TTS đọc đoạn văn |
| `Ctrl + K` / `Cmd + K` | Màn hình Kho | Focus nhanh vào ô tìm kiếm bài học |
| `Space` | Đang gõ | Nhảy sang từ tiếp theo |

---

## 5. Checklist Tối ưu cho Mobile & Bàn phím Ảo

Khi chạy trên thiết bị di động (iOS Safari, Android Chrome):
- [ ] **Bàn phím ảo không che khối gõ**: Lắng nghe `window.visualViewport.addEventListener('resize', ...)` hoặc sử dụng `dvh` / `scrollIntoView({ block: 'center' })` để đảm bảo vùng gõ luôn nổi bên trên bàn phím ảo.
- [ ] **Chống zoom ngoài ý muốn trên iOS**:
  - Đảm bảo thẻ input ẩn/thật dùng để bắt phím có `font-size: 16px` trở lên (iOS Safari sẽ phóng to màn hình nếu font input < 16px).
  - Thiết lập `touch-action: manipulation` trên các nút điều khiển.
- [ ] **Thuộc tính input tối ưu**:
  ```html
  <input
    type="text"
    autocomplete="off"
    autocorrect="off"
    autocapitalize="off"
    spellcheck="false"
    inputmode="text"
  />
  ```
- [ ] **Vùng an toàn (Safe Area)**:
  - Header: `padding-top: env(safe-area-inset-top, 16px);`
  - Footer / Thanh phím tắt: `padding-bottom: env(safe-area-inset-bottom, 16px);`
- [ ] **Touch Target**: Mọi nút bấm (Back, TTS, Settings) có kích thước chạm tối thiểu `44×44px` với khoảng cách tối thiểu `8px`.

---

## 6. Ngôn ngữ & Viết Copy (Microcopy Tiếng Việt)

- Ngắn gọn, súc tích, mang tính thúc đẩy nhẹ nhàng.
- **Đo lường**:
  - `Tốc độ`: `... WPM` (hoặc `... từ/phút`)
  - `Độ chính xác`: `... %`
  - `Thời gian`: `mm:ss`
- **Nút bấm**:
  - Dùng động từ rõ ràng: `"Luyện gõ"`, `"Luyện lại"`, `"Thêm bài mới"`, `"Lưu bài"`, `"Tiếp tục"`.
  - Không dùng các câu chung chung như `"Bấm vào đây"`, `"OK"`.
- **Thông báo trạng thái**:
  - Đang lưu: `"Đang lưu bài học…"`
  - Thành công: `"Đã lưu bài học vào kho"`
  - Lỗi: `"Không thể tải bài học. Vui lòng kiểm tra kết nối."`

---

## 7. Tiêu chuẩn Hoàn thành (Definition of Done)

Một màn hình của TypeLearn chỉ được coi là hoàn thiện khi thỏa mãn:
1. **Performance**: Không có độ trễ phím (input latency < 16ms), gõ nhanh >100 WPM vẫn mượt mà.
2. **Accessibility**: Kiểm tra độ tương phản màu đạt chuẩn WCAG AA (tối thiểu 4.5:1 với body text). Focus ring rõ ràng khi dùng phím `Tab`.
3. **Cross-Device**: Đã kiểm tra cả màn hình máy tính (bàn phím cơ) và điện thoại (bàn phím ảo iOS/Android).
4. **Empty & Error States**: Có giao diện rõ ràng khi kho chưa có bài viết nào, hoặc khi paste file markdown bị sai cú pháp.
