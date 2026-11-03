#!/usr/bin/env node

import readline from 'node:readline';
import { listTopics, createPackFromMarkdown, getAllExistingCardHashes } from '../edge-functions/_lib/store.js';
import { validateCards } from '../shared/validate.js';

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
    description: 'Kiểm tra tính hợp lệ của nội dung Markdown trước khi lưu.',
    inputSchema: {
      type: 'object',
      properties: { markdown: { type: 'string', description: 'Nội dung file Markdown' } },
      required: ['markdown']
    }
  },
  {
    name: 'create_pack',
    description: 'Tạo pack mới từ nội dung Markdown.',
    inputSchema: {
      type: 'object',
      properties: { markdown: { type: 'string', description: 'Nội dung file Markdown' } },
      required: ['markdown']
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
  switch (name) {
    case 'get_format_spec':
      return { data: { format: FORMAT_SPEC } };
    case 'list_topics': {
      const topics = await listTopics();
      return { data: { topics } };
    }
    case 'validate_content': {
      const markdown = args.markdown || '';
      const existingHashes = await getAllExistingCardHashes();
      const res = validateCards(markdown, existingHashes);
      return { data: res };
    }
    case 'create_pack': {
      const markdown = args.markdown || '';
      const result = await createPackFromMarkdown(markdown);
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
        serverInfo: { name: 'bityping-mcp-stdio', version: '1.0.0' }
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
