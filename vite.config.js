import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { onRequestGet as getTopics, onRequestOptions as optTopics } from './edge-functions/api/topics.js';
import { onRequestPost as validateApi, onRequestOptions as optValidate } from './edge-functions/api/validate.js';
import { onRequestGet as getPacks, onRequestPost as createPackApi, onRequestOptions as optPacks } from './edge-functions/api/packs/index.js';
import { onRequestGet as getPackById, onRequestDelete as deletePackApi, onRequestOptions as optPackById } from './edge-functions/api/packs/[id].js';
import { onRequestPost as rebuildIndexApi, onRequestOptions as optRebuild } from './edge-functions/api/rebuild-index.js';
import { onRequestGet as mcpGet, onRequestPost as mcpPost, onRequestOptions as optMcp } from './edge-functions/mcp/index.js';
import { getKv } from './edge-functions/_lib/store.js';
import { loadNodeStorageConfig, saveNodeStorageConfig, readLocalPacks } from './src/lib/storage/node-sync.js';

async function syncLocalPacksToMemoryKv() {
  try {
    const localPacks = readLocalPacks();
    if (!localPacks || localPacks.length === 0) return;
    const kv = getKv();
    const rawIndex = await kv.get('index', 'json');
    const index = Array.isArray(rawIndex) ? rawIndex : [];
    let updated = false;

    for (const p of localPacks) {
      if (!p || !p.id) continue;
      await kv.put(`pack:${p.id}`, JSON.stringify(p));
      const existIdx = index.findIndex((i) => i.id === p.id);
      const meta = {
        id: p.id,
        topic: p.topic,
        tags: p.tags,
        level: p.level,
        cardCount: (p.cards || []).length,
        cardHashes: (p.cards || []).map((c) => c.hash),
        createdAt: p.createdAt,
        updatedAt: p.updatedAt
      };
      if (existIdx >= 0) {
        index[existIdx] = meta;
      } else {
        index.push(meta);
      }
      updated = true;
    }
    if (updated) {
      await kv.put('index', JSON.stringify(index));
    }
  } catch (err) {
    console.warn('[Vite Dev] Lỗi đồng bộ local packs vào KV:', err.message);
  }
}

function edgeoneDevPlugin() {
  return {
    name: 'vite-plugin-edgeone-dev-server',
    configureServer(server) {
      // Đảm bảo KV in-memory đã sẵn sàng
      getKv();
      syncLocalPacksToMemoryKv();

      server.middlewares.use(async (req, res, next) => {
        const urlStr = req.url || '';
        if (!urlStr.startsWith('/api') && !urlStr.startsWith('/mcp')) {
          return next();
        }

        try {
          const parsedUrl = new URL(urlStr, 'http://localhost:5173');
          const pathname = parsedUrl.pathname;
          const method = req.method?.toUpperCase() || 'GET';

          // Xử lý riêng endpoint cấu hình lưu trữ Node/MCP (/api/storage-config)
          if (pathname === '/api/storage-config') {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

            if (method === 'OPTIONS') {
              res.statusCode = 204;
              return res.end();
            }

            if (method === 'GET') {
              const cfg = loadNodeStorageConfig();
              res.statusCode = 200;
              return res.end(JSON.stringify({ ok: true, config: cfg }));
            }

            if (method === 'POST') {
              const buffers = [];
              for await (const chunk of req) buffers.push(chunk);
              const bodyStr = Buffer.concat(buffers).toString('utf-8');
              const bodyJson = JSON.parse(bodyStr || '{}');
              const saved = saveNodeStorageConfig(bodyJson);
              res.statusCode = saved ? 200 : 500;
              return res.end(JSON.stringify({ ok: saved }));
            }
          }

          // Đồng bộ local packs trước khi đọc packs / topics
          if (pathname === '/api/packs' || pathname === '/api/topics') {
            await syncLocalPacksToMemoryKv();
          }

          // Đọc body nếu có
          const buffers = [];
          for await (const chunk of req) {
            buffers.push(chunk);
          }
          const rawBody = Buffer.concat(buffers).toString('utf-8');

          const webRequest = new Request(parsedUrl.href, {
            method,
            headers: req.headers,
            body: ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && rawBody.length > 0 ? rawBody : null
          });

          let handler = null;
          let params = {};

          if (pathname === '/api/topics') {
            handler = method === 'OPTIONS' ? optTopics : getTopics;
          } else if (pathname === '/api/validate') {
            handler = method === 'OPTIONS' ? optValidate : validateApi;
          } else if (pathname === '/api/rebuild-index') {
            handler = method === 'OPTIONS' ? optRebuild : rebuildIndexApi;
          } else if (pathname === '/api/packs' || pathname === '/api/packs/') {
            if (method === 'OPTIONS') handler = optPacks;
            else if (method === 'POST') handler = createPackApi;
            else handler = getPacks;
          } else if (pathname.startsWith('/api/packs/')) {
            const packId = pathname.slice('/api/packs/'.length);
            params = { id: packId };
            if (method === 'OPTIONS') handler = optPackById;
            else if (method === 'DELETE') handler = deletePackApi;
            else handler = getPackById;
          } else if (pathname === '/mcp' || pathname === '/mcp/') {
            if (method === 'OPTIONS') handler = optMcp;
            else if (method === 'POST') handler = mcpPost;
            else handler = mcpGet;
          }

          if (!handler) {
            return next();
          }

          const context = {
            request: webRequest,
            params,
            env: {}
          };

          const webResponse = await handler(context);

          res.statusCode = webResponse.status;
          webResponse.headers.forEach((val, key) => {
            res.setHeader(key, val);
          });

          const responseText = await webResponse.text();
          res.end(responseText);
        } catch (err) {
          console.error('[EdgeOne Dev Server Error]:', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [preact(), edgeoneDevPlugin()],
  server: {
    port: 5173,
    host: true
  }
});
