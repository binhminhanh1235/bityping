#!/usr/bin/env node

import readline from 'node:readline';
import {
  loadNodeStorageConfig,
  saveNodeStorageConfig,
  collectAllTopics,
  collectAllCardHashes,
  syncPackToStorages,
  readLocalPacks
} from '../src/lib/storage/node-sync.js';
import { validateCards } from '../shared/validate.js';
import { getKv } from '../edge-functions/_lib/store.js';

const TOOLS_MANIFEST = [
  {
    name: 'get_format_spec',
    description: 'Lấy hướng dẫn chi tiết về định dạng Markdown, quy tắc đánh dấu cụm [text]{n} và ví dụ mẫu.',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'list_topics',
    description: 'Lấy danh sách các chủ đề hiện có trong BiTyping và số lượng thẻ để tránh trùng lặp.',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'validate_content',
    description: 'Kiểm tra tính hợp lệ của nội dung Markdown trước khi lưu (so sánh hash với cả Gist, Local file và KV).',
    inputSchema: {
      type: 'object',
      properties: { markdown: { type: 'string', description: 'Nội dung file Markdown' } },
      required: ['markdown']
    }
  },
  {
    name: 'create_pack',
    description: 'Tạo pack mới từ nội dung Markdown và tự động đồng bộ lên GitHub Gist, file cục bộ và KV.',
    inputSchema: {
      type: 'object',
      properties: {
        markdown: { type: 'string', description: 'Nội dung file Markdown của pack' },
        gistToken: { type: 'string', description: 'Tùy chọn: GitHub Personal Access Token nếu muốn chỉ định trực tiếp' },
        gistId: { type: 'string', description: 'Tùy chọn: GitHub Gist ID nếu muốn chỉ định trực tiếp' }
      },
      required: ['markdown']
    }
  },
  {
    name: 'get_storage_status',
    description: 'Kiểm tra trạng thái cấu hình lưu trữ hiện tại (GitHub Gist, local file, KV) để biết pack sẽ được lưu vào đâu.',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'set_storage_config',
    description: 'Thiết lập hoặc cập nhật cấu hình GitHub Gist (.storage-config.json) cho MCP.',
    inputSchema: {
      type: 'object',
      properties: {
        token: { type: 'string', description: 'GitHub Personal Access Token (PAT) có quyền gist' },
        gistId: { type: 'string', description: 'ID của Gist (ví dụ: b886e331c...)' }
      },
      required: ['token']
    }
  }
];

const FORMAT_SPEC = `# BiTyping Markdown Format Specification
Một file là một pack:
---
topic: Microservices
tags: [saga]
level: B1
---

en: A saga is a [sequence]{1} of [local transactions]{2}.
vi: Saga là một [chuỗi]{1} [giao dịch cục bộ]{2}.
note: Mỗi giao dịch có một bước bù trừ đi kèm.
`;

async function handleToolCall(name, args = {}) {
  const rootDir = process.cwd();
  const kv = getKv();

  switch (name) {
    case 'get_format_spec':
      return { data: { format: FORMAT_SPEC } };

    case 'get_storage_status': {
      const config = loadNodeStorageConfig(rootDir);
      const localPacks = readLocalPacks(rootDir);
      return {
        data: {
          gist: {
            configured: Boolean(config.gist.token && config.gist.gistId),
            enabled: config.gist.enabled,
            gistId: config.gist.gistId || 'Chưa thiết lập',
            hasToken: Boolean(config.gist.token)
          },
          localFile: {
            enabled: config.localFile.enabled,
            path: config.localFile.path,
            packCount: localPacks.length
          },
          message: config.gist.token && config.gist.gistId
            ? 'GitHub Gist đã được kết nối! Mọi pack tạo mới sẽ tự động đồng bộ lên Gist của bạn.'
            : 'Chưa cấu hình Gist! Pack sẽ được lưu vào data/local-packs.json. Dùng set_storage_config hoặc cập nhật file .storage-config.json để sync lên Gist.'
        }
      };
    }

    case 'set_storage_config': {
      const { token, gistId } = args;
      if (!token) {
        return { isError: true, data: { error: 'Thiếu tham số token' } };
      }
      const saved = saveNodeStorageConfig({ gist: { token, gistId: gistId || '', enabled: true } }, rootDir);
      return {
        isError: !saved,
        data: {
          success: saved,
          message: saved ? 'Đã lưu cấu hình GitHub Gist vào .storage-config.json thành công!' : 'Không thể ghi file cấu hình.'
        }
      };
    }

    case 'list_topics': {
      const config = loadNodeStorageConfig(rootDir);
      const rawIndex = await kv.get('index', 'json');
      const kvIndex = Array.isArray(rawIndex) ? rawIndex : [];
      const topics = await collectAllTopics({ rootDir, config, kvPacks: kvIndex });
      return { data: { topics } };
    }

    case 'validate_content': {
      const markdown = args.markdown || '';
      const config = loadNodeStorageConfig(rootDir);
      const rawIndex = await kv.get('index', 'json');
      const kvIndex = Array.isArray(rawIndex) ? rawIndex : [];
      const existingHashes = await collectAllCardHashes({ rootDir, config, kvIndex });
      const res = validateCards(markdown, existingHashes);
      return { data: res };
    }

    case 'create_pack': {
      const markdown = args.markdown || '';
      let config = loadNodeStorageConfig(rootDir);

      // Nếu agent truyền trực tiếp token/gistId trong tool call
      if (args.gistToken) {
        config = {
          ...config,
          gist: {
            enabled: true,
            token: args.gistToken,
            gistId: args.gistId || config.gist.gistId
          }
        };
      }

      const result = await syncPackToStorages({
        markdown,
        config,
        rootDir,
        kv
      });

      return {
        isError: !result.success,
        data: result
      };
    }

    default:
      return { isError: true, data: { error: `Unknown tool: ${name}` } };
  }
}

async function processLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return;

  let request;
  try {
    request = JSON.parse(trimmed);
  } catch (e) {
    const errRes = { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } };
    process.stdout.write(JSON.stringify(errRes) + '\n');
    return;
  }

  const { id, method, params } = request;

  if (method === 'initialize') {
    const res = {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'bityping-mcp-stdio', version: '1.1.0' }
      }
    };
    process.stdout.write(JSON.stringify(res) + '\n');
    return;
  }

  if (method === 'notifications/initialized') {
    return;
  }

  if (method === 'ping') {
    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result: {} }) + '\n');
    return;
  }

  if (method === 'tools/list') {
    const res = { jsonrpc: '2.0', id, result: { tools: TOOLS_MANIFEST } };
    process.stdout.write(JSON.stringify(res) + '\n');
    return;
  }

  if (method === 'tools/call') {
    const { isError, data } = await handleToolCall(params?.name, params?.arguments);
    const res = {
      jsonrpc: '2.0',
      id,
      result: {
        content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }],
        isError: Boolean(isError)
      }
    };
    process.stdout.write(JSON.stringify(res) + '\n');
    return;
  }

  const notFound = { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } };
  process.stdout.write(JSON.stringify(notFound) + '\n');
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', (line) => {
  processLine(line).catch((err) => {
    process.stderr.write(`Error processing line: ${err.message}\n`);
  });
});
