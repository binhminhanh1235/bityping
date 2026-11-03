import { listTopics, createPackFromMarkdown, getAllExistingCardHashes } from '../_lib/store.js';
import { validateCards } from '../../shared/validate.js';
import { json, corsPreflight } from '../_lib/response.js';

const FORMAT_SPEC = `# BiTyping Markdown Format Specification

Một file markdown là một pack (nhóm thẻ cùng chủ đề).
Mỗi cặp dòng en: và vi: là một thẻ song ngữ.

## 1. Front Matter (bắt buộc)
---
topic: Microservices
tags: [saga, distributed]
level: B1
---

- topic: bắt buộc, tên chủ đề ngắn gọn (ví dụ: Microservices, System Design, Algorithms, Networking).
- tags: tuỳ chọn, danh sách từ khoá liên quan.
- level: tuỳ chọn, trình độ tiếng Anh (A1, A2, B1, B2, C1, C2).

## 2. Thẻ song ngữ và Cụm liên kết
- Mỗi thẻ gồm dòng \`en:\` và dòng \`vi:\` liền nhau.
- Các thẻ phân tách nhau bằng một dòng trống.
- Dòng \`note:\` (tuỳ chọn) ngay dưới \`vi:\` để giải thích ngữ cảnh, thuật ngữ.
- Cụm từ tương ứng đánh dấu bằng \`[văn bản]{n}\`. Cùng số \`n\` ở cả hai bên là một cặp tương ứng.
- Mỗi số {n} phải xuất hiện đúng 1 lần ở en: và đúng 1 lần ở vi:.
- Không lồng ngoặc, không dùng ngoặc [, ], {, } thừa ngoài đánh dấu. Cụm không được rỗng.
- en: tối đa 500 ký tự. vi: tối đa 600 ký tự. Mỗi pack tối đa 200 thẻ và 100 KB.

## Ví dụ mẫu:
---
topic: Microservices
tags: [saga]
level: B1
---

en: A saga is a [sequence]{1} of [local transactions]{2}.
vi: Saga là một [chuỗi]{1} [giao dịch cục bộ]{2}.
note: Mỗi giao dịch cục bộ có một bước bù trừ đi kèm.

en: If a step fails, the saga [runs]{1} [compensating transactions]{2}.
vi: Nếu một bước thất bại, saga sẽ [chạy]{1} [các giao dịch bù trừ]{2}.

## Prompt gợi ý cho AI Agent:
Tạo 10 thẻ song ngữ về chủ đề "System Design", mức B1-B2. Mỗi thẻ là một câu tiếng Anh tự nhiên (10-25 từ) và bản dịch tiếng Việt tương ứng. Đánh dấu 1-3 cụm quan trọng bằng [...]{n} ở cả hai bên. Gọi tool validate_content trước, nếu hợp lệ thì gọi create_pack.
`;

const TOOLS_MANIFEST = [
  {
    name: 'get_format_spec',
    description: 'Lấy hướng dẫn chi tiết về định dạng Markdown, quy tắc đánh dấu cụm [text]{n} và ví dụ mẫu.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'list_topics',
    description: 'Lấy danh sách các chủ đề hiện có trong BiTyping và số lượng thẻ để tránh trùng lặp.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'validate_content',
    description: 'Kiểm tra tính hợp lệ của nội dung Markdown trước khi lưu (phát hiện lỗi cú pháp, ngoặc, unpaired links, độ dài).',
    inputSchema: {
      type: 'object',
      properties: {
        markdown: {
          type: 'string',
          description: 'Nội dung file Markdown của pack'
        }
      },
      required: ['markdown']
    }
  },
  {
    name: 'create_pack',
    description: 'Tạo pack mới từ nội dung Markdown. Tự động kiểm tra cú pháp và loại bỏ thẻ trùng lặp trước khi lưu.',
    inputSchema: {
      type: 'object',
      properties: {
        markdown: {
          type: 'string',
          description: 'Nội dung file Markdown của pack'
        }
      },
      required: ['markdown']
    }
  }
];

/**
 * Xử lý lệnh gọi tool
 * @param {string} name
 * @param {any} args
 * @returns {Promise<{ isError?: boolean, data: any }>}
 */
async function handleToolCall(name, args = {}) {
  switch (name) {
    case 'get_format_spec': {
      return {
        data: {
          format: FORMAT_SPEC,
          rules: {
            maxPackBytes: 102400,
            maxPackCards: 200,
            maxEnLength: 500,
            maxViLength: 600,
            requiredTopic: true
          }
        }
      };
    }

    case 'list_topics': {
      const topics = await listTopics();
      return { data: { topics } };
    }

    case 'validate_content': {
      const markdown = args.markdown || '';
      if (!markdown.trim()) {
        return {
          isError: true,
          data: { valid: false, errors: [{ code: 'EMPTY_CONTENT', message: 'Nội dung markdown rỗng' }] }
        };
      }
      const existingHashes = await getAllExistingCardHashes();
      const res = validateCards(markdown, existingHashes);
      return {
        data: {
          valid: res.valid,
          meta: res.meta,
          errors: res.errors,
          duplicateCount: res.duplicateCount,
          duplicates: res.duplicates,
          savedCount: res.savedCount
        }
      };
    }

    case 'create_pack': {
      const markdown = args.markdown || '';
      if (!markdown.trim()) {
        return {
          isError: true,
          data: { saved: false, errors: [{ code: 'EMPTY_CONTENT', message: 'Nội dung markdown rỗng' }] }
        };
      }
      const result = await createPackFromMarkdown(markdown);
      if (!result.success) {
        return {
          isError: true,
          data: {
            saved: false,
            errors: result.errors || [],
            duplicates: result.duplicates || []
          }
        };
      }
      return {
        data: {
          saved: true,
          packId: result.packId,
          topic: result.topic,
          tags: result.tags,
          level: result.level,
          savedCount: result.savedCount,
          duplicateCount: result.duplicateCount,
          duplicates: result.duplicates
        }
      };
    }

    default:
      return {
        isError: true,
        data: { error: `Không tìm thấy tool: ${name}` }
      };
  }
}

/**
 * Xử lý JSON-RPC request
 * @param {any} body
 * @returns {Promise<any>}
 */
async function handleJsonRpc(body) {
  if (!body || typeof body !== 'object') {
    return {
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: 'Parse error' }
    };
  }

  const { id, method, params } = body;

  switch (method) {
    case 'initialize':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: 'bityping-mcp',
            version: '1.0.0'
          }
        }
      };

    case 'notifications/initialized':
      // Không cần trả response đối với notification
      return null;

    case 'ping':
      return {
        jsonrpc: '2.0',
        id,
        result: {}
      };

    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          tools: TOOLS_MANIFEST
        }
      };

    case 'tools/call': {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};
      const { isError, data } = await handleToolCall(toolName, toolArgs);

      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: typeof data === 'string' ? data : JSON.stringify(data, null, 2)
            }
          ],
          isError: Boolean(isError)
        }
      };
    }

    default:
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: `Method not found: ${method}`
        }
      };
  }
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const result = await handleJsonRpc(body);

    if (result === null) {
      return new Response(null, { status: 204 });
    }

    return json(result);
  } catch (err) {
    return json({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32603, message: 'Internal error: ' + err.message }
    });
  }
}

export async function onRequestGet() {
  return json({
    name: 'BiTyping MCP Server',
    description: 'MCP Server cho BiTyping — luyện gõ song ngữ Anh-Việt',
    version: '1.0.0',
    transport: 'HTTP JSON-RPC 2.0 (POST /mcp)',
    tools: TOOLS_MANIFEST.map((t) => ({ name: t.name, description: t.description }))
  });
}

export async function onRequestOptions() {
  return corsPreflight();
}
