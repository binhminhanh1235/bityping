import { describe, it, expect, beforeEach } from 'vitest';
import { onRequestGet as getTopics } from '../edge-functions/api/topics.js';
import { onRequestPost as validateApi } from '../edge-functions/api/validate.js';
import { onRequestGet as getPacks, onRequestPost as createPackApi } from '../edge-functions/api/packs/index.js';
import { onRequestGet as getPackById, onRequestDelete as deletePackApi } from '../edge-functions/api/packs/[id].js';
import { onRequestPost as rebuildIndexApi } from '../edge-functions/api/rebuild-index.js';
import { onRequestPost as mcpPost, onRequestGet as mcpGet } from '../edge-functions/mcp/index.js';
import { getKv } from '../edge-functions/_lib/store.js';

describe('Edge Functions REST API & MCP', () => {
  beforeEach(async () => {
    // Reset memory KV trước mỗi test
    const kv = getKv();
    await kv.delete('index');
    const listRes = await kv.list({ prefix: 'pack:' });
    for (const k of listRes.keys || []) {
      await kv.delete(k.name);
    }
  });

  function createMockContext({ method = 'GET', url = 'http://localhost/api', body = null, params = {} } = {}) {
    return {
      request: new Request(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : null
      }),
      params,
      env: {}
    };
  }

  it('GET /api/topics returns empty array initially', async () => {
    const res = await getTopics();
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/json');
    const data = await res.json();
    expect(data.topics).toEqual([]);
  });

  it('POST /api/validate validates markdown without saving', async () => {
    const validMd = `---
topic: Microservices
---
en: A [service]{1} communicates via network.
vi: Một [dịch vụ]{1} giao tiếp qua mạng.
`;
    const ctx = createMockContext({
      method: 'POST',
      url: 'http://localhost/api/validate',
      body: { markdown: validMd }
    });
    const res = await validateApi(ctx);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.valid).toBe(true);
    expect(data.savedCount).toBe(1);

    // Đảm bảo không lưu vào KV
    const topicsRes = await getTopics();
    const topicsData = await topicsRes.json();
    expect(topicsData.topics).toHaveLength(0);
  });

  it('POST /api/packs creates a new pack and updates topics index', async () => {
    const validMd = `---
topic: System Design
tags: [cache]
level: B2
---
en: Caching [reduces]{1} database [load]{2}.
vi: Bộ nhớ đệm [giảm bớt]{1} [tải]{2} cho cơ sở dữ liệu.
note: Sử dụng Redis hoặc Memcached.
`;
    const ctx = createMockContext({
      method: 'POST',
      url: 'http://localhost/api/packs',
      body: { markdown: validMd }
    });
    const res = await createPackApi(ctx);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.savedCount).toBe(1);
    const packId = data.packId;

    // Kiểm tra GET /api/topics
    const topicsRes = await getTopics();
    const topicsData = await topicsRes.json();
    expect(topicsData.topics).toHaveLength(1);
    expect(topicsData.topics[0].topic).toBe('System Design');
    expect(topicsData.topics[0].cardCount).toBe(1);

    // Kiểm tra GET /api/packs/:id
    const packCtx = createMockContext({
      params: { id: packId }
    });
    const getRes = await getPackById(packCtx);
    expect(getRes.status).toBe(200);
    const packData = await getRes.json();
    expect(packData.pack.topic).toBe('System Design');
    expect(packData.pack.cards[0].note).toBe('Sử dụng Redis hoặc Memcached.');

    // Kiểm tra GET /api/packs?export=1
    const exportCtx = createMockContext({
      url: 'http://localhost/api/packs?export=1'
    });
    const exportRes = await getPacks(exportCtx);
    const exportData = await exportRes.json();
    expect(exportData.markdown).toContain('topic: System Design');
    expect(exportData.markdown).toContain('[reduces]{1}');

    // Kiểm tra DELETE /api/packs/:id
    const delCtx = createMockContext({
      method: 'DELETE',
      params: { id: packId }
    });
    const delRes = await deletePackApi(delCtx);
    expect(delRes.status).toBe(200);

    const getRes2 = await getPackById(packCtx);
    expect(getRes2.status).toBe(404);
  });

  it('MCP POST /mcp handles tools/list and tools/call', async () => {
    // 1. tools/list
    const listCtx = createMockContext({
      method: 'POST',
      url: 'http://localhost/mcp',
      body: {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
      }
    });
    const listRes = await mcpPost(listCtx);
    const listData = await listRes.json();
    expect(listData.result.tools).toHaveLength(4);
    const toolNames = listData.result.tools.map((t) => t.name);
    expect(toolNames).toContain('get_format_spec');
    expect(toolNames).toContain('create_pack');

    // 2. tools/call get_format_spec
    const callCtx = createMockContext({
      method: 'POST',
      url: 'http://localhost/mcp',
      body: {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'get_format_spec',
          arguments: {}
        }
      }
    });
    const callRes = await mcpPost(callCtx);
    const callData = await callRes.json();
    expect(callData.result.isError).toBe(false);
    expect(callData.result.content[0].text).toContain('BiTyping Markdown Format Specification');

    // 3. tools/call create_pack
    const createCtx = createMockContext({
      method: 'POST',
      url: 'http://localhost/mcp',
      body: {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'create_pack',
          arguments: {
            markdown: `---
topic: Cloud
level: A2
---
en: Serverless [scales]{1} automatically.
vi: Không máy chủ [tự động co giãn]{1}.
`
          }
        }
      }
    });
    const createRes = await mcpPost(createCtx);
    const createData = await createRes.json();
    expect(createData.result.isError).toBe(false);
    const resultObj = JSON.parse(createData.result.content[0].text);
    expect(resultObj.saved).toBe(true);
    expect(resultObj.topic).toBe('Cloud');
    expect(resultObj.savedCount).toBe(1);
  });
});
