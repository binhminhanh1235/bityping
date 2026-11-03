---
name: edgeone-pages-skills
description: >-
  Comprehensive guide and runbook for developing, configuring, and deploying full-stack
  applications on Tencent EdgeOne Pages (EdgeOne Makers). Covers V8 Edge Functions,
  KV key-value persistence, dynamic routing, local preview with edgeone CLI, and production deployment.
metadata:
  author: tencentedgeone
  version: "1.0.0"
---

# EdgeOne Pages Development & Deployment Guide

This skill provides step-by-step guidance, best practices, and runtime rules for building on **Tencent EdgeOne Pages** (EdgeOne Makers), focusing on **Edge Functions** (V8 runtime), **KV Storage**, and project deployment.

---

## 1. Architecture Overview

EdgeOne Pages supports static assets and serverless edge compute:
- **Static Frontend**: HTML/JS/CSS, Single Page Apps, client-side frameworks (Astro, Svelte, React, Vue, Vite, vanilla JS).
- **Edge Functions**: Lightweight V8 runtime running on globally distributed edge nodes for APIs, authentication, and fast data operations.
- **KV Storage**: Distributed eventual-consistency key-value store directly bound to Edge Functions as a global variable.

---

## 2. Critical Edge Function Rules (V8 Runtime)

Edge Functions run on a lightweight V8 engine (similar to Cloudflare Workers). It is **NOT Node.js**.

> ⚠️ **Key Constraints & Common Pitfalls**:
> 1. **No `Response.json()`**: `Response.json(...)` is **NOT available** in this V8 runtime. Always use:
>    ```javascript
>    new Response(JSON.stringify(data), {
>      headers: { 'Content-Type': 'application/json' },
>      status: 200,
>    });
>    ```
> 2. **Environment Variables**: Access via `context.env`, **never** `process.env`.
> 3. **KV is a Global Variable**: The bound namespace is a **global variable** (e.g., `my_kv` or `TYPELEARN_KV`), **NOT** on `context.env`. Calling `context.env.my_kv` will fail.
> 4. **No Filesystem Write**: `fs.writeFile` is not supported. All persistence goes to KV or external storage.
> 5. **No Node.js built-in modules**: No `node:fs`, `node:path`, `node:http`. Use standard Web APIs (`fetch`, `Request`, `Response`, `URL`, `crypto.subtle`, `TextEncoder`).

---

## 3. Directory Structure & Routing

Place Edge Functions in the `edge-functions/` or `functions/` directory:

```text
my-project/
├── index.html
├── dist/                  # Static build output (or root for vanilla)
└── edge-functions/
    └── api/
        ├── hello.js       # GET/POST /api/hello
        ├── items/
        │   └── [id].js    # GET/POST/DELETE /api/items/:id
        └── [[default]].js # Fallback catch-all route under /api/*
```

### Handler Patterns

```javascript
// edge-functions/api/notes/[id].js

// Handle GET request
export async function onRequestGet(context) {
  const { params, request, env } = context;
  const id = params.id;
  
  // KV is global:
  const data = await TYPELEARN_KV.get(`note:${id}`, 'json');
  if (!data) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// Handle POST request
export async function onRequestPost(context) {
  const body = await context.request.json();
  const id = context.params.id;

  await TYPELEARN_KV.put(`note:${id}`, JSON.stringify(body));

  return new Response(JSON.stringify({ success: true, id }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
}
```

---

## 4. KV Storage Quick Guide

KV is globally distributed, with eventual consistency across edge nodes within 60 seconds.

### Setup Checklist
1. Open [EdgeOne Makers Console](https://console.cloud.tencent.com/edgeone/pages) -> **KV Storage**.
2. Create a namespace (e.g. `typelearn-kv`).
3. Bind the namespace to your project with a variable identifier (e.g. `TYPELEARN_KV`).
4. In your Edge Function code, use `TYPELEARN_KV` directly.

### Core Operations
```javascript
// Write
await TYPELEARN_KV.put(key, valueStringOrBuffer);

// Read (type: 'text' | 'json' | 'arrayBuffer' | 'stream')
const text = await TYPELEARN_KV.get('key');
const obj  = await TYPELEARN_KV.get('key', 'json');

// Delete
await TYPELEARN_KV.delete('key');

// List keys with pagination
const res = await TYPELEARN_KV.list({ prefix: 'user:', limit: 100, cursor });
// res: { complete: boolean, cursor: string, keys: [{ name: string }] }
```

Detailed manual: [references/kv.md](./references/kv.md)  
Edge Functions manual: [references/edge-functions.md](./references/edge-functions.md)

---

## 5. Development & Deployment CLI

Install EdgeOne CLI:
```bash
npm install -g edgeone
# or use with npx
```

### Local Development
```bash
# Pure static preview (no login needed)
edgeone makers dev

# With KV linked to remote project
edgeone makers link
edgeone makers dev -n <project-name>
```

### Deploy to Production
```bash
# Interactive or CI deployment
edgeone makers deploy

# Deploy specific directory
edgeone makers deploy ./dist
```

Detailed CLI & deployment manual: [references/deploy.md](./references/deploy.md)
