import { listTopics, createPackFromMarkdown, getAllExistingCardHashes, getKv } from '../_lib/store.js';
import { validateCards } from '../../shared/validate.js';
import { generatePackId } from '../../shared/hash.js';
import { json, corsPreflight } from '../_lib/response.js';
import { gistGetPacks, gistSavePacks } from '../../src/lib/storage/gist.js';
import { loadNodeStorageConfig, collectAllTopics } from '../../src/lib/storage/node-sync.js';

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
    name: 'get_storage_status',
    description: 'Kiểm tra tình trạng lưu trữ hiện tại (EdgeOne Cloud KV và GitHub Gist).',
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
    description: 'Tạo pack mới từ nội dung Markdown và tự động lưu vào GitHub Gist hoặc EdgeOne KV.',
    inputSchema: {
      type: 'object',
      properties: {
        markdown: {
          type: 'string',
          description: 'Nội dung file Markdown của pack'
        },
        gistToken: {
          type: 'string',
          description: 'Tùy chọn: GitHub Personal Access Token nếu muốn lưu thẳng vào Gist cá nhân'
        },
        gistId: {
          type: 'string',
          description: 'Tùy chọn: GitHub Gist ID nếu muốn lưu vào Gist cụ thể'
        }
      },
      required: ['markdown']
    }
  }
];

function isCloudKvAvailable() {
  if (typeof globalThis !== 'undefined') {
    const kv = globalThis.my_kv || globalThis.BITYPING_KV || globalThis.TYPELEARN_KV;
    if (kv && kv.constructor?.name !== 'MemoryKv') {
      return true;
    }
  }
  return false;
}

function resolveGistConfig(args = {}, context = {}) {
  let token = (args.gistToken || '').trim();
  let gistId = (args.gistId || '').trim();

  // 1. Kiểm tra header của request
  if (context?.request?.headers) {
    if (!token) token = context.request.headers.get('x-gist-token') || '';
    if (!gistId) gistId = context.request.headers.get('x-gist-id') || '';
    if (!token) {
      const auth = context.request.headers.get('authorization') || '';
      if (auth.startsWith('Bearer ') && !auth.toLowerCase().includes('write_key')) {
        token = auth.slice(7).trim();
      }
    }
  }

  // 2. Kiểm tra EdgeOne Pages Environment Variables
  if (context?.env) {
    if (!token) token = context.env.GITHUB_TOKEN || context.env.GIST_TOKEN || '';
    if (!gistId) gistId = context.env.GIST_ID || '';
  }

  // 3. Fallback sang local config nếu chạy trên Node / Vite
  if (!token || !gistId) {
    try {
      const nodeCfg = loadNodeStorageConfig();
      if (nodeCfg?.gist?.token && !token) token = nodeCfg.gist.token;
      if (nodeCfg?.gist?.gistId && !gistId) gistId = nodeCfg.gist.gistId;
    } catch {}
  }

  return {
    enabled: Boolean(token && gistId),
    token,
    gistId
  };
}

/**
 * Xử lý lệnh gọi tool
 * @param {string} name
 * @param {any} args
 * @param {any} [context]
 * @returns {Promise<{ isError?: boolean, data: any }>}
 */
async function handleToolCall(name, args = {}, context = {}) {
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

    case 'get_storage_status': {
      const gistCfg = resolveGistConfig(args, context);
      const cloudKv = isCloudKvAvailable();
      return {
        data: {
          cloudKv: {
            available: cloudKv,
            status: cloudKv ? 'Tencent EdgeOne KV đã kết nối' : 'Chưa có KV binding (đang chờ duyệt)'
          },
          gist: {
            configured: gistCfg.enabled,
            gistId: gistCfg.gistId ? `${gistCfg.gistId.slice(0, 6)}...` : 'Chưa có',
            hasToken: Boolean(gistCfg.token)
          },
          message: gistCfg.enabled
            ? 'GitHub Gist đã sẵn sàng! Mọi pack tạo mới qua MCP sẽ tự động lưu lên Gist của bạn.'
            : (cloudKv
              ? 'EdgeOne KV sẵn sàng! Pack sẽ được lưu vào Tencent Cloud KV.'
              : '⚠️ CẢNH BÁO: Cả EdgeOne KV và GitHub Gist đều chưa được kích hoạt trên endpoint này. Nếu tạo pack, dữ liệu sẽ chỉ nằm tạm trong RAM worker và mất khi worker đóng. Hãy truyền gistToken & gistId hoặc cấu hình biến môi trường trên EdgeOne!')
        }
      };
    }

    case 'list_topics': {
      const gistCfg = resolveGistConfig(args, context);
      if (gistCfg.enabled) {
        try {
          const topics = await collectAllTopics({ config: { gist: gistCfg } });
          return { data: { topics } };
        } catch {}
      }
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

      const gistCfg = resolveGistConfig(args, context);
      const cloudKv = isCloudKvAvailable();

      // Thu thập existing hashes từ Gist nếu có
      let existingHashes = new Set();
      let gistExistingPacks = [];
      if (gistCfg.enabled) {
        try {
          const gRes = await gistGetPacks(gistCfg.token, gistCfg.gistId);
          if (gRes.ok && Array.isArray(gRes.packs)) {
            gistExistingPacks = gRes.packs;
            for (const p of gistExistingPacks) {
              for (const c of (p.cards || [])) {
                if (c.hash) existingHashes.add(c.hash);
              }
            }
          }
        } catch {}
      }

      const kvHashes = await getAllExistingCardHashes();
      for (const h of kvHashes) existingHashes.add(h);

      const validation = validateCards(markdown, existingHashes);
      if (!validation.valid) {
        return {
          isError: true,
          data: { saved: false, errors: validation.errors }
        };
      }

      if (validation.uniqueCards.length === 0) {
        return {
          isError: true,
          data: {
            saved: false,
            errors: [{ code: 'ALL_CARDS_DUPLICATE', message: 'Tất cả các thẻ trong pack đều đã tồn tại' }],
            duplicateCount: validation.duplicateCount,
            duplicates: validation.duplicates
          }
        };
      }

      const topic = validation.meta.topic || 'General';
      const packId = generatePackId(topic);
      const now = new Date().toISOString();
      const packRecord = {
        id: packId,
        topic,
        tags: validation.meta.tags || [],
        level: validation.meta.level || '',
        cards: validation.uniqueCards,
        createdAt: now,
        updatedAt: now
      };

      const targets = [];
      let gistError = null;

      // 1. Lưu lên Gist nếu có cấu hình
      if (gistCfg.enabled) {
        const existIdx = gistExistingPacks.findIndex((p) => p.id === packId);
        if (existIdx >= 0) gistExistingPacks[existIdx] = packRecord;
        else gistExistingPacks.unshift(packRecord);

        const saveRes = await gistSavePacks(gistCfg.token, gistCfg.gistId, gistExistingPacks);
        if (saveRes.ok) {
          targets.push('gist');
        } else {
          gistError = saveRes.error;
        }
      }

      // 2. Lưu vào KV (Cloud KV hoặc in-memory KV)
      const kvRes = await createPackFromMarkdown(markdown);
      if (kvRes.success) {
        targets.push(cloudKv ? 'edgeone_kv' : 'memory_kv');
      }

      const isPersistent = targets.includes('gist') || targets.includes('edgeone_kv');
      let warning = null;
      if (!isPersistent) {
        warning = 'CẢNH BÁO: Cả EdgeOne Cloud KV lẫn GitHub Gist đều chưa được kích hoạt trên endpoint này. Dữ liệu chỉ nằm tạm trong worker RAM và sẽ mất khi worker đóng. Hãy truyền gistToken & gistId hoặc thiết lập biến môi trường GITHUB_TOKEN & GIST_ID trên EdgeOne!';
      }

      let message = `Đã lưu pack "${topic}" (${packRecord.cards.length} thẻ)`;
      if (targets.includes('gist')) {
        message += ' và đã đồng bộ lên GitHub Gist thành công!';
      } else if (targets.includes('edgeone_kv')) {
        message += ' vào EdgeOne KV thành công!';
      } else {
        message += ' vào bộ nhớ tạm worker (Cần Gist để lưu trữ vĩnh viễn)!';
      }

      return {
        data: {
          saved: true,
          packId,
          topic,
          tags: packRecord.tags,
          level: packRecord.level,
          savedCount: packRecord.cards.length,
          duplicateCount: validation.duplicateCount,
          duplicates: validation.duplicates,
          targets,
          warning,
          message
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
 * @param {any} [context]
 * @returns {Promise<any>}
 */
async function handleJsonRpc(body, context = {}) {
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
            version: '1.1.0'
          }
        }
      };

    case 'notifications/initialized':
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
      const { isError, data } = await handleToolCall(toolName, toolArgs, context);

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
    const response = await handleJsonRpc(body, context);

    if (response === null) {
      return new Response(null, { status: 204 });
    }

    return json(response);
  } catch (err) {
    return json(
      {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: `Parse error: ${err.message}` }
      },
      400
    );
  }
}

export async function onRequestGet() {
  return json({
    name: 'BiTyping MCP Server',
    description: 'MCP Server cho BiTyping — luyện gõ song ngữ Anh-Việt',
    version: '1.1.0',
    transport: 'HTTP JSON-RPC 2.0 (POST /mcp)',
    tools: TOOLS_MANIFEST.map((t) => t.name)
  });
}

export async function onRequestOptions() {
  return corsPreflight();
}
