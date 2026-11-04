# BiTyping ⚡

[![CI](https://github.com/binhminhanh1235/bityping/actions/workflows/ci.yml/badge.svg)](https://github.com/binhminhanh1235/bityping/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Framework: Preact](https://img.shields.io/badge/Framework-Preact-673ab8.svg)](https://preactjs.com/)
[![Built with Vite](https://img.shields.io/badge/Vite-6.x-646cff.svg)](https://vitejs.dev/)
[![Tested with Vitest](https://img.shields.io/badge/Tested%20with-Vitest-yellow.svg)](https://vitest.dev/)

**BiTyping** là ứng dụng web luyện gõ phím song ngữ Anh - Việt dạng thẻ ngắn (flashcard). Tiếng Việt hiển thị phía trên, người học gõ lại câu tiếng Anh bên dưới. Khi con trỏ gõ di chuyển qua cụm từ tiếng Anh, cụm từ tiếng Việt tương ứng được highlight đồng bộ theo thời gian thực, giúp kết nối nghĩa với từ ngay trong lúc gõ.

---

## ✨ Điểm nổi bật (Key Features)

- 🎯 **Highlight đồng bộ ngữ nghĩa (Clause-Aligned Highlighting)**: Cụm từ tiếng Việt và tiếng Anh được liên kết 1-1 bằng đánh dấu `[cụm từ]{id}`. Khi gõ, cụm tiếng Việt tương ứng sáng lên giúp người học liên hệ ngữ cảnh và phản xạ từ vựng.
- 🎲 **Chuyển thẻ ngẫu nhiên không gián đoạn (Zero-Friction Next Random)**: Sau khi gõ xong một thẻ, nhấn `Enter` để nhảy ngay sang thẻ ngẫu nhiên kế tiếp theo chủ đề, không cần quay về danh sách.
- ⌨️ **Tối ưu trải nghiệm không chuột (Keyboard-First)**: Mọi thao tác từ đổi chủ đề, bỏ qua thẻ, gõ lại, đến mở cấu hình đều hỗ trợ phím tắt chuyên dụng.
- 🔊 **Phát âm tiếng Anh (Text-to-Speech)**: Tích hợp sẵn `speechSynthesis` của trình duyệt để nghe đọc câu tiếng Anh, có thể bật tự động đọc khi nạp thẻ mới.
- 🤖 **Tích hợp sẵn MCP Server cho AI Agent**: Cung cấp giao thức **Model Context Protocol** (`scripts/mcp-stdio.mjs` qua stdio và edge function `/mcp`) cho phép các AI coding assistant (như Antigravity, Claude Desktop, Cursor) tự động sinh nội dung, validate và nạp thẻ mới vào hệ thống.
- ☁️ **Kiến trúc Lean & Serverless**: Triển khai trên Tencent EdgeOne Pages, sử dụng V8 Edge Functions và KV store để lưu trữ. Tự động dự phòng với bộ starter packs nếu chạy ngoại tuyến hoặc không có kết nối API.

---

## ⌨️ Bảng phím tắt (Keyboard Shortcuts)

| Phím tắt | Chức năng |
|---|---|
| `Enter` *(sau khi hoàn thành)* | Chuyển sang thẻ ngẫu nhiên kế tiếp |
| `Ctrl + Enter` / `Cmd + Enter` | Bỏ qua thẻ hiện tại, bốc thẻ khác |
| `Ctrl + Backspace` / `Cmd + Backspace` | Bắt đầu gõ lại thẻ hiện tại từ đầu |
| `Esc` | Mở nhanh cửa sổ chọn chủ đề (Topic Popover) |

---

## 📝 Định dạng nội dung (Content Format)

Một pack là một file Markdown gồm front matter và danh sách các thẻ câu:

```markdown
---
topic: Microservices
tags: [saga, distributed]
level: B1
---

en: A saga is a [sequence]{1} of [local transactions]{2}.
vi: Saga là một [chuỗi]{1} [giao dịch cục bộ]{2}.
note: Mỗi giao dịch cục bộ có một bước bù trừ (compensation) đi kèm.

en: If a step fails, the saga [runs]{1} [compensating transactions]{2}.
vi: Nếu một bước thất bại, saga sẽ [chạy]{1} [các giao dịch bù trừ]{2}.
```

### Quy tắc đánh dấu:
- Cặp thẻ bao gồm dòng `en:` và `vi:` liền nhau, cách nhau giữa các thẻ bằng dòng trống.
- `[cụm từ]{n}`: `n` là số nguyên định danh. Mỗi số `n` phải xuất hiện đúng **1 lần** ở `en:` và đúng **1 lần** ở `vi:`.
- Dòng `note:` là tuỳ chọn, xuất hiện ngắn gọn dưới dạng chú thích sau khi người dùng gõ xong thẻ.
- Mỗi pack tối đa 200 thẻ, kích thước file không vượt quá 100 KB.

---

## 🛠️ Cấu trúc dự án (Project Structure)

```text
bityping/
├── .github/workflows/       # GitHub Actions CI/CD workflows
├── edge-functions/          # V8 Serverless functions cho EdgeOne Pages
│   ├── _lib/                # Logic KV store và helper
│   ├── api/                 # Endpoints REST (topics, packs, validate)
│   └── mcp/                 # Edge MCP server endpoint
├── scripts/
│   └── mcp-stdio.mjs        # Local stdio MCP Server cho AI agents
├── shared/                  # Code dùng chung giữa frontend và backend
│   ├── parseCards.js        # Parser chuyển Markdown thành card object
│   ├── validate.js          # Validator kiểm tra cú pháp đánh dấu
│   ├── exportMarkdown.js    # Xuất dữ liệu thẻ ngược ra Markdown
│   └── hash.js              # Hash nội dung thẻ để chống trùng lặp
├── src/
│   ├── components/          # Preact components (BilingualStage, Header, Modals, Popovers)
│   ├── data/                # Dữ liệu khởi tạo mặc định (Starter packs)
│   ├── lib/                 # Core logic: typingEngine, picker, api, audio, stats
│   ├── styles/              # CSS Design Tokens & Stylesheet
│   ├── App.jsx              # Main application entry component
│   └── main.jsx
├── tests/                   # Bộ test suite Vitest
└── vite.config.js
```

---

## 🚀 Khởi chạy dự án (Getting Started)

### Yêu cầu môi trường
- **Node.js**: >= 18.0.0
- **npm**: >= 9.0.0

### Cài đặt dependencies

```bash
git clone https://github.com/binhminhanh1235/bityping.git
cd bityping
npm install
```

### Chạy môi trường phát triển (Local Dev)

```bash
npm run dev
```

Mở trình duyệt tại [http://localhost:5173](http://localhost:5173) để trải nghiệm.

### Kiểm thử (Unit & Integration Tests)

```bash
# Chạy toàn bộ test suites
npm test

# Chạy watch mode khi phát triển
npm run test:watch
```

### Đóng gói ứng dụng (Build Production)

```bash
npm run build
```

Thư mục đầu ra tĩnh nằm tại `dist/`.

---

## 🤖 Kết nối AI Agent qua MCP (Model Context Protocol)

BiTyping tích hợp sẵn MCP Server qua standard I/O:

```bash
npm run mcp:stdio
```

Cấu hình cho Claude Desktop / Antigravity / Cursor (`claude_desktop_config.json` hoặc cấu hình MCP tương ứng):

```json
{
  "mcpServers": {
    "bityping": {
      "command": "node",
      "args": ["/path/to/bityping/scripts/mcp-stdio.mjs"]
    }
  }
}
```

Các công cụ (tools) được cung cấp:
- `get_format_spec`: Lấy tài liệu định dạng Markdown và quy tắc thẻ.
- `list_topics`: Liệt kê các chủ đề hiện có trên Gist, file cục bộ và KV để tránh trùng lặp.
- `validate_content`: Xác thực nội dung Markdown trước khi lưu (kiểm tra trùng hash với toàn bộ hệ thống).
- `create_pack`: Tạo pack mới từ Markdown và tự động đồng bộ lên GitHub Gist, `data/local-packs.json` và KV.
- `get_storage_status`: Kiểm tra trạng thái kết nối GitHub Gist và file lưu trữ.
- `set_storage_config`: Thiết lập cấu hình GitHub Gist (Token & Gist ID) trực tiếp qua MCP.

### 🔄 Cấu hình GitHub Gist cho MCP Server
Để MCP Server đẩy pack thẳng vào GitHub Gist của bạn (để hiển thị trên Web ngay lập tức):
1. **Cách 1 (Tự động từ Web)**: Vào **Cài đặt** trên giao diện Web (`http://localhost:5173`), cấu hình Gist -> hệ thống sẽ tự động tạo file `.storage-config.json` cho MCP.
2. **Cách 2 (File cấu hình)**: Tạo file `.storage-config.json` ở thư mục gốc:
```json
{
  "gist": {
    "enabled": true,
    "token": "ghp_your_personal_access_token",
    "gistId": "your_gist_id"
  }
}
```
3. **Cách 3 (Biến môi trường)**: Thêm vào file `.env` hoặc cấu hình MCP:
```bash
GITHUB_TOKEN=ghp_your_personal_access_token
GIST_ID=your_gist_id
```

---

## 🚢 CI/CD & Triển khai (Deployment)

- **GitHub Actions**: Tự động kích hoạt khi có commit/pull request tới nhánh `main` để kiểm thử (`npm test`) và đóng gói (`npm run build`).
- **EdgeOne Pages**:
  - Kết nối repository với EdgeOne Pages.
  - Cấu hình KV namespace cho chức năng lưu trữ pack và chủ đề.
  - Build command: `npm run build`, Output directory: `dist`.

---

## 📄 Bản quyền (License)

Dự án phát hành theo giấy phép [MIT](LICENSE).
