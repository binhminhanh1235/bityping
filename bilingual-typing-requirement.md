# BiTyping: luyện gõ song ngữ Anh-Việt

Requirement và kế hoạch phát triển. Lean, miễn phí, deploy trên EdgeOne Pages. App độc lập với TypeLearn nhưng dùng cùng hạ tầng (có thể cùng repo, khác KV namespace).

## 1. Mô tả ngắn

Mỗi lần luyện là một **thẻ** gồm câu/đoạn ngắn song ngữ. Tiếng Việt hiển thị phía trên, người học gõ lại phần tiếng Anh bên dưới. Khi con trỏ gõ đi qua một cụm tiếng Anh, cụm tiếng Việt tương ứng được highlight, giúp nối nghĩa với từ ngay lúc gõ.

Gõ xong thẻ nào thì bấm một phím để sang thẻ **random** kế tiếp, không phải quay về danh sách. Có thể lọc theo chủ đề và random trong chủ đề đã chọn.

Nội dung được tạo chủ yếu bởi AI agent qua **MCP server**, hoặc dán tay vào web theo cùng một format.

**Nguyên tắc lean:**
- Không đăng nhập, không database ngoài, không backend riêng.
- Parse và chọn random ở client, server chỉ lưu và trả dữ liệu.
- Âm thanh (đọc tiếng Anh) là tuỳ chọn, dùng `speechSynthesis` của trình duyệt.

## 2. Khác biệt so với TypeLearn

| | TypeLearn | BiTyping |
|---|---|---|
| Đơn vị luyện | Đoạn văn trong một bài dài | Thẻ ngắn song ngữ |
| Ngôn ngữ gõ | Theo `lang` của file | Luôn tiếng Anh |
| Hỗ trợ khi gõ | Không | Highlight cụm tiếng Việt tương ứng |
| Chuyển nội dung | Về kho, chọn bài | Next random ngay tại màn hình gõ |
| Tạo nội dung | Paste md + admin token | MCP cho AI agent hoặc paste md, không token |

## 3. Format nội dung (markdown)

Một file là một **pack** (nhóm thẻ cùng chủ đề). Mỗi cặp dòng `en:` và `vi:` là một thẻ.

### 3.1 Front matter

```yaml
---
topic: Microservices
tags: [saga, distributed]
level: B1
---
```

- `topic`: bắt buộc, một giá trị, dùng để lọc và random theo chủ đề.
- `tags`: tuỳ chọn. `level`: tuỳ chọn (`A1` đến `C2`), dùng để lọc về sau.

### 3.2 Thẻ và đánh dấu cụm tương ứng

- Mỗi thẻ gồm dòng `en:` và dòng `vi:` liền nhau. Các thẻ cách nhau bằng một dòng trống.
- Dòng `note:` (tuỳ chọn) ngay sau `vi:` là ghi chú ngắn, hiện sau khi gõ xong.
- Cụm cần liên kết đánh dấu bằng `[văn bản]{n}`. Cùng số `n` ở hai bên là một cặp tương ứng.
- Từ không đánh dấu thì vẫn hiển thị nhưng không highlight.

```markdown
---
topic: Microservices
tags: [saga]
level: B1
---

en: A saga is a [sequence]{1} of [local transactions]{2}.
vi: Saga là một [chuỗi]{1} [giao dịch cục bộ]{2}.
note: Mỗi giao dịch cục bộ có một bước bù trừ (compensation) đi kèm.

en: If a step fails, the saga [runs]{1} [compensating transactions]{2}.
vi: Nếu một bước thất bại, saga sẽ [chạy]{1} [các giao dịch bù trừ]{2}.
```

### 3.3 Quy tắc hợp lệ (validate)

| Quy tắc | Lý do |
|---|---|
| Mỗi `n` xuất hiện đúng 1 lần ở `en:` và đúng 1 lần ở `vi:` | Đảm bảo có cặp để highlight |
| Không lồng nhau, không chồng nhau | Parser đơn giản, highlight rõ |
| Cụm có thể gồm nhiều từ (`[local transactions]{2}`) | Tiếng Việt nhiều âm tiết, không ghép 1 từ - 1 từ |
| `[` `]` `{` `}` không dùng ngoài đánh dấu | Tránh nhầm khi parse |
| `en:` tối đa 500 ký tự, `vi:` tối đa 600 ký tự | Thẻ ngắn để chuyển nhanh |
| Mỗi pack tối đa 200 thẻ và 100 KB | Giới hạn lạm dụng và kích thước tải |
| Thẻ trùng (so khớp `en:` đã chuẩn hoá) bị bỏ qua, báo lại số thẻ trùng | Tránh AI agent tạo lặp |

Khi parse, phần đánh dấu bị gỡ ra để lấy văn bản gõ (`en` thuần) và danh sách cụm: `[{id, enStart, enEnd, viStart, viEnd}]`. Cụm tiếng Anh không có cặp vi (hoặc ngược lại) là lỗi validate, không phải cảnh báo.

## 4. Luồng gõ và next random

**Màn hình gõ là màn hình chính của app.**

1. Mở app là vào luôn màn gõ với một thẻ random (theo chủ đề đã chọn lần trước).
2. Tiếng Việt hiện ở trên, có đánh dấu mờ các cụm đã liên kết. Tiếng Anh hiện bên dưới để gõ.
3. Khi con trỏ nằm trong một cụm tiếng Anh, cụm tiếng Việt tương ứng được highlight đậm. Cụm đã gõ xong chuyển sang trạng thái "xong" (nhạt hơn).
4. Gõ xong thẻ: hiện một dòng kết quả mảnh (WPM, độ chính xác) và ghi chú `note:` nếu có.
5. Bấm `Enter` để sang thẻ random kế tiếp. Có tuỳ chọn tự chuyển sau 1 giây.

**Phím tắt:**

| Phím | Tác dụng |
|---|---|
| `Enter` (sau khi gõ xong) | Thẻ kế tiếp |
| `Ctrl+Enter` | Bỏ qua thẻ hiện tại |
| `Esc` | Mở bộ chọn chủ đề (popover, không rời màn gõ) |
| `Ctrl+Backspace` | Gõ lại thẻ hiện tại từ đầu |

**Chọn chủ đề:**
- Chip chủ đề ở đầu màn hình, chọn một hoặc nhiều, hoặc "Tất cả".
- Lựa chọn được nhớ ở localStorage.
- Random chỉ lấy thẻ thuộc chủ đề đang chọn.

**Thuật toán random:**
- Không lặp lại trong 20 thẻ gần nhất (hoặc trong cả nhóm nếu nhóm nhỏ hơn).
- Có thể bật chế độ "ưu tiên thẻ yếu": thẻ chưa gặp hoặc có độ chính xác thấp được chọn thường xuyên hơn (trọng số theo lỗi và lần gặp gần nhất).
- Tải trước thẻ kế tiếp để chuyển ngay không chờ mạng.

**Tuỳ chọn gõ:**
- Bỏ phân biệt hoa thường, bỏ qua dấu câu (mặc định bật cả hai).
- Chế độ sửa lỗi: sửa từng ký tự bằng Backspace (mặc định) hoặc chốt từng từ bằng Space.
- Chế độ nhớ: ẩn tiếng Anh gợi ý, chỉ nhìn tiếng Việt rồi gõ (giai đoạn sau).
- Âm thanh: tự đọc tiếng Anh khi vào thẻ, hoặc phím `Ctrl+P` đọc lại (tuỳ chọn, mặc định tắt).

## 5. Tính năng

### MVP
1. Parse và validate format ở mục 3.
2. Màn gõ song ngữ với highlight cụm tương ứng.
3. Next random và lọc chủ đề tại chỗ.
4. Tạo nội dung bằng cách dán md vào web (xem trước, báo lỗi validate).
5. MCP server cho AI agent tạo nội dung (mục 8).
6. Thống kê trên thiết bị: số thẻ trong phiên, WPM, độ chính xác, chuỗi liên tiếp.

### Giai đoạn sau
- Ưu tiên thẻ yếu, chế độ nhớ (ẩn gợi ý tiếng Anh).
- Đọc tiếng Anh bằng TTS.
- Danh sách thẻ để xem lại, sửa, xoá (có xác nhận).
- Đồng bộ thống kê qua nhiều thiết bị.
- Xuất/nhập toàn bộ nội dung dạng md.

## 6. Kiến trúc

```
AI agent ──MCP (HTTP)──┐
                       ▼
Trình duyệt ──REST──▶ EdgeOne Pages
(static SPA)           ├─ static hosting
                       ├─ Edge Functions: /api/*  và  /mcp
                       └─ KV (packs + index)
```

- Một Edge Function `/mcp` (MCP qua HTTP) và các Edge Function `/api/*` (REST) dùng chung module lưu và validate.
- KV chỉ dùng được trong Edge Functions (theo tài liệu EdgeOne hiện tại), nhất quán cuối cùng, đồng bộ toàn cầu trong khoảng 60 giây. Gói miễn phí hiện ghi 1 GB, 10 namespace. Hãy kiểm tra lại khi triển khai.
- Frontend: Vite + Preact (hoặc vanilla JS), không thư viện UI nặng.
- Parser và validate viết một lần ở `shared/`, dùng cho cả client và Edge Function để kết quả luôn giống nhau.

## 7. Dữ liệu và REST API

**KV:**

| Key | Giá trị |
|---|---|
| `index` | `[{id, topic, tags, level, cards, createdAt}]` metadata các pack |
| `pack:{id}` | `{id, topic, tags, level, cards:[{id, en, vi, note, links}], createdAt}` |

- Mỗi lần tạo là một pack mới với `id` duy nhất. "Thêm thẻ vào chủ đề" cũng tạo pack mới cùng `topic`, nên không cần đọc-sửa-ghi trên pack cũ (tránh mất dữ liệu do đồng bộ chậm).
- Chủ đề là nhóm các pack cùng `topic`.
- `cards[].id` là hash của `en` đã chuẩn hoá, dùng để chống trùng và lưu thống kê.

**REST:**

| Method | Đường dẫn | Mô tả |
|---|---|---|
| GET | `/api/topics` | Danh sách chủ đề và số thẻ |
| GET | `/api/packs?topic=` | Metadata pack theo chủ đề |
| GET | `/api/packs/:id` | Toàn bộ thẻ của một pack |
| POST | `/api/packs` | Tạo pack từ md (validate rồi lưu) |
| POST | `/api/validate` | Chỉ validate, không lưu |
| DELETE | `/api/packs/:id` | Xoá pack (chỉ gọi từ web, có xác nhận) |

**Phía client:** lấy danh sách pack theo chủ đề đang chọn, tải các pack đó một lần rồi cache (IndexedDB hoặc localStorage), chọn random hoàn toàn ở client. Chuyển thẻ không phát sinh request mạng.

## 8. MCP server cho AI agent

Mục tiêu: agent tạo nội dung theo đúng format mà không cần người dán tay.

**Giao thức:** MCP qua HTTP (stateless, JSON-RPC qua `POST /mcp`), triển khai trong Edge Function. Giai đoạn 0 cần chạy thử nhanh để chắc môi trường Edge Function hỗ trợ cách này.

**Tools:**

| Tool | Đầu vào | Đầu ra | Ghi chú |
|---|---|---|---|
| `get_format_spec` | không | Quy tắc format và ví dụ (mục 3) | Agent gọi đầu tiên để biết cách viết |
| `list_topics` | không | Chủ đề hiện có và số thẻ | Để dùng lại chủ đề, tránh tạo chủ đề gần trùng tên |
| `validate_content` | `markdown` | Hợp lệ hay danh sách lỗi theo thẻ | Không lưu |
| `create_pack` | `markdown` | `{packId, topic, saved, duplicates, errors}` | Validate rồi lưu; nếu có lỗi thì không lưu và trả lỗi chi tiết để agent tự sửa |

Cố ý **không** đưa tool xoá hay sửa pack vào MCP. Agent chỉ thêm, việc xoá làm trên web.

**Ví dụ phản hồi lỗi (để agent tự sửa):**

```json
{
  "saved": false,
  "errors": [
    { "card": 3, "line": 14, "code": "LINK_UNPAIRED",
      "message": "Cụm {2} có ở en nhưng không có ở vi" }
  ]
}
```

**Prompt mẫu cho agent** (đưa vào `get_format_spec` hoặc prompt MCP):

> Tạo 10 thẻ song ngữ về chủ đề "Microservices", mức B1. Mỗi thẻ là một câu tiếng Anh tự nhiên (10-25 từ) và bản dịch tiếng Việt tự nhiên. Đánh dấu 1-3 cụm quan trọng bằng `[...]{n}` ở cả hai bên theo đúng format. Gọi `validate_content` trước, sửa lỗi nếu có, rồi gọi `create_pack`.

**Cách kết nối:**
- Client hỗ trợ MCP từ xa: thêm URL `https://<domain>/mcp` (ví dụ Claude Code: `claude mcp add --transport http bityping https://<domain>/mcp`).
- Client chỉ hỗ trợ stdio: giai đoạn sau, viết một wrapper Node rất mỏng gọi REST `/api/packs`.

## 9. Bảo mật khi không có token

Theo yêu cầu, ghi nội dung **không cần token**. Hệ quả cần chấp nhận rõ: ai biết URL đều có thể tạo pack. Vì app là công cụ cá nhân nên có thể chấp nhận, đi kèm các lớp giảm thiểu rẻ tiền:

- Giới hạn kích thước (mục 3.3) và validate chặt, đầu vào sai sẽ bị từ chối.
- Chỉ có chức năng thêm qua MCP; xoá chỉ từ web và có xác nhận.
- Giới hạn tốc độ theo IP bằng bộ đếm trong KV (chỉ mang tính tương đối do KV nhất quán cuối cùng).
- Không giữ URL `/mcp` ở nơi công khai; coi nó như một địa chỉ riêng.
- Làm sạch (escape) mọi văn bản khi render để tránh XSS; không render HTML thô.
- Nút xuất toàn bộ nội dung để sao lưu.
- **Công tắc dự phòng:** nếu có biến môi trường `WRITE_KEY` thì ghi bắt buộc kèm khoá đó; để trống thì ghi tự do. Bật khi bị spam, không cần sửa code.

## 10. Thiết kế giao diện

**Nguyên tắc:**
- Màn gõ có ba lớp: dòng tiếng Việt (trên), dòng tiếng Anh để gõ (giữa), kết quả mảnh (dưới).
- Cụm tiếng Việt đang gõ phải nổi rõ ngay cả khi lướt mắt nhanh: dùng nền đậm và gạch chân, không chỉ đổi màu.
- Không bắt người dùng rời màn gõ: chọn chủ đề bằng popover, chuyển thẻ bằng phím.
- Đúng/sai thể hiện bằng màu cộng thêm dấu hiệu khác (gạch chân, nền).
- Dùng được trên điện thoại: ô nhập hiện rõ, bàn phím ảo không che hai dòng chữ.
- Tôn trọng `prefers-reduced-motion` và `prefers-color-scheme`.
- Trạng thái rỗng (chưa có nội dung): hướng dẫn rõ cách thêm bằng MCP hoặc dán md.

## 11. Cấu trúc thư mục

```
bityping/
├─ shared/
│  ├─ parseCards.js      # md -> {meta, cards[]}, tách cụm liên kết
│  └─ validate.js        # quy tắc mục 3.3, trả lỗi theo thẻ
├─ src/
│  ├─ pages/             # Typing (chính), Add, Manage
│  ├─ components/        # BilingualLine, TopicChips, ResultBar
│  ├─ lib/
│  │  ├─ typingEngine.js # so khớp ký tự, vị trí con trỏ -> cụm đang gõ
│  │  ├─ picker.js       # random, không lặp, ưu tiên thẻ yếu
│  │  ├─ stats.js        # lưu thống kê localStorage
│  │  └─ api.js
│  └─ styles/
├─ edge-functions/
│  ├─ api/
│  │  ├─ topics.js
│  │  ├─ validate.js
│  │  └─ packs/index.js, packs/[id].js
│  └─ mcp/index.js       # JSON-RPC: tools/list, tools/call
└─ package.json
```

## 12. Kế hoạch phát triển

### Giai đoạn 0: Chuẩn bị và thử nghiệm (0.5-1 ngày)
- [ ] Tạo repo, project Vite, kết nối EdgeOne Pages, bật KV và bind namespace `my_kv`.
- [ ] Thử nhanh Edge Function trả lời một request MCP `initialize` và `tools/list`, kết nối thử từ một client MCP.
- [ ] Chốt token màu, chữ, khoảng cách cho màn gõ.

**Xong khi:** client MCP gọi được một tool giả và đọc/ghi được KV.

### Giai đoạn 1: Parser, validate, typing engine (1-2 ngày)
- [ ] `parseCards.js` và `validate.js` với bộ test (ví dụ hợp lệ và từng loại lỗi ở mục 3.3).
- [ ] `typingEngine.js`: so khớp ký tự, tính cụm đang gõ theo vị trí con trỏ.
- [ ] Màn gõ chạy với dữ liệu mẫu cục bộ, highlight cụm tiếng Việt đúng.

**Xong khi:** gõ đến đâu thì cụm tiếng Việt đúng cặp được highlight, mọi test validate qua.

### Giai đoạn 2: Lưu, random, chuyển nhanh (1-2 ngày)
- [ ] Edge Functions REST (`topics`, `packs`, `validate`) dùng `shared/`.
- [ ] Chọn chủ đề bằng chip và popover, `picker.js` (không lặp 20 thẻ gần nhất).
- [ ] Cache phía client, tải trước thẻ kế tiếp, phím `Enter` / `Esc` / `Ctrl+Enter`.
- [ ] Trang dán md: xem trước và báo lỗi theo thẻ.

**Xong khi:** thêm nội dung, mở trên thiết bị khác, gõ liên tục nhiều thẻ mà không phải rời màn gõ và không có độ trễ mạng giữa các thẻ.

### Giai đoạn 3: MCP server (1 ngày)
- [ ] Tools `get_format_spec`, `list_topics`, `validate_content`, `create_pack`.
- [ ] Phản hồi lỗi có cấu trúc, phát hiện thẻ trùng.
- [ ] Kết nối từ một AI agent thật, cho tạo thử 10-20 thẻ và gõ thử.
- [ ] Giới hạn kích thước, giới hạn tốc độ, công tắc `WRITE_KEY`.

**Xong khi:** agent tạo được pack hợp lệ chỉ bằng các tool, không cần người sửa tay, và pack hiện ra trong màn gõ.

### Giai đoạn 4: Hoàn thiện MVP (1-2 ngày)
- [ ] Thống kê phiên, chuỗi liên tiếp, lưu localStorage.
- [ ] Responsive, dark mode, trạng thái rỗng/lỗi/đang tải.
- [ ] Kiểm tra a11y cơ bản, trang quản lý (xem, xoá có xác nhận), xuất md.

**Xong khi:** dùng thật một tuần mà không gặp lỗi chặn.

### Giai đoạn 5: Mở rộng (tuỳ chọn)
- [ ] Ưu tiên thẻ yếu, chế độ nhớ.
- [ ] TTS đọc tiếng Anh.
- [ ] Wrapper stdio cho client chưa hỗ trợ MCP từ xa.
- [ ] Đồng bộ thống kê qua nhiều thiết bị.

## 13. Rủi ro và cách xử lý

| Rủi ro | Cách xử lý |
|---|---|
| Ai cũng ghi được (không token) | Mục 9: giới hạn kích thước, chỉ thêm qua MCP, giới hạn tốc độ, công tắc `WRITE_KEY` |
| Hai lần tạo cùng lúc làm lệch `index` (KV nhất quán cuối cùng) | `pack:{id}` là nguồn dữ liệu chính, `index` chỉ là bản tổng hợp; có thao tác "dựng lại index" từ danh sách key |
| AI agent đánh dấu cụm sai hoặc dịch gượng | Validate chặt, trả lỗi để agent tự sửa; xem lại và xoá trên web |
| Edge Function không hợp với MCP qua HTTP | Giai đoạn 0 thử trước; phương án dự phòng: REST + wrapper stdio |
| Cụm tiếng Việt và tiếng Anh khác thứ tự | Highlight dựa theo cặp `{n}`, không phụ thuộc thứ tự |
| Giới hạn gói miễn phí thay đổi | Kiểm tra tài liệu EdgeOne; nội dung là md nên dễ chuyển nơi khác |
| Gõ trên điện thoại bị gợi ý/tự sửa của bàn phím | Tắt `autocorrect`, `autocapitalize`, `spellcheck` trên ô nhập |

## 14. Các quyết định thiết kế đã chốt (Design Decisions)

1. **Cấu trúc dự án & Stack**: Project độc lập ngay tại repo `typing-ev`, sử dụng **Preact + Vite + EdgeOne Pages**, kế thừa bảng màu và design system từ TypeLearn.
2. **Độ dài thẻ**: Hỗ trợ 1-3 câu ngắn trên 1 dòng đơn (`en:` <= 500 ký tự, `vi:` <= 600 ký tự; khuyên dùng 10-30 từ trong prompt mẫu).
3. **Luồng chuyển thẻ**: Mặc định chờ bấm `Enter` (hoặc `Space`) sau khi gõ xong để người học kịp nhìn lại toàn câu và đọc `note:`; có nút bật/tắt nhanh **"Auto-next (1.2s)"** ngay trên thanh trạng thái/cài đặt.
4. **Bảo mật & `WRITE_KEY`**: Không dùng `WRITE_KEY` ở MVP, mở tự do 100% để thao tác qua web và MCP không vướng xác thực.
5. **Bỏ phân biệt hoa thường & dấu câu (mặc định bật)**: Hiển thị nguyên văn câu tiếng Anh đầy đủ (có hoa/thường và dấu câu), nhưng khi gõ sẽ tự động khớp không phân biệt hoa/thường và **tự động nhảy qua (auto-skip)** các dấu câu sát từ để người học chỉ cần gõ chữ cái, chữ số và phím Space.
6. **Chế độ sửa lỗi khi gõ**: Mặc định gõ tự do theo ký tự kèm `Backspace` (gõ sai vẫn tiến con trỏ và tô đỏ gạch chân); có tuỳ chọn **"Chặn khi gõ sai (Stop on error)"** và **"Chốt từng từ bằng Space"** trong cài đặt.
7. **Thị giác cụm liên kết `[văn bản]{n}`**:
   - Hiển thị badge số thứ tự nhỏ (`¹`, `²`, `³`) kèm bảng màu phân biệt nhẹ cho từng cặp.
   - Khi con trỏ đi vào cụm `{n}`, cụm tiếng Việt `{n}` tương ứng sáng rực (nền + gạch chân đậm). Hỗ trợ di chuột (hover) vào cụm để xem cặp tương ứng.
   - Khi hoàn thành thẻ, toàn bộ các cặp cụm liên kết `{1}`, `{2}`... đều sáng rõ theo màu cặp (**full-review state**) cùng với `note:`.
8. **Dữ liệu khởi đầu (Starter Pack)**: Có sẵn bộ **Starter Pack** mặc định (bundled ở client) để mở app lần đầu là gõ thử được ngay (hoặc khi chạy local chưa kết nối KV), tự động ưu tiên dữ liệu thật khi đã có pack trên KV.
9. **Tổ chức KV & Chống trùng thẻ**:
   - Biến global KV mặc định là `my_kv` (kèm fallback `BITYPING_KV` / `TYPELEARN_KV` và bộ in-memory KV giả lập khi chạy dev local).
   - Lưu `pack:{id}` và `index` (kèm `cardHashes`), có thêm endpoint `POST /api/rebuild-index` quét `pack:*` để phục hồi `index` bất cứ lúc nào.
   - Khi gọi `create_pack` (REST hoặc MCP): chặn toàn bộ nếu có lỗi cú pháp, nhưng **cho phép lọc bỏ thẻ trùng (`duplicates`)** và lưu các thẻ mới còn lại (`{ saved: true, savedCount, duplicateCount, duplicates }`).
10. **Điều hướng & Quản lý (Single-Page Zero-Navigation)**:
    - Toàn bộ trang phụ (**Thêm thẻ**, **Quản lý**, **Cài đặt**) mở dạng Modal/Drawer đè lên màn hình gõ, bấm `Esc` đóng ngay về màn gõ.
    - Modal Quản lý cho phép xem chi tiết từng thẻ trong pack, xoá từng thẻ lẻ hoặc xoá nguyên pack (có xác nhận), và có nút **"Xuất tất cả (.md)"** để sao lưu.
11. **Tính năng tích hợp ngay trong MVP**:
    - Đưa luôn **TTS (`speechSynthesis`)** (chọn giọng đọc, tốc độ, tự đọc hoặc bấm `Ctrl+P`) và thuật toán **"Ưu tiên thẻ yếu"** vào MVP.
    - **MCP Server**: Hỗ trợ cả Edge Function `/mcp` (Streamable HTTP JSON-RPC) lẫn script `scripts/mcp-stdio.mjs` gọi REST API để kết nối mượt với mọi AI agent.
