import { listPacks, getAllPacks, createPackFromMarkdown } from '../../_lib/store.js';
import { exportPacksToMarkdown } from '../../../shared/exportMarkdown.js';
import { json, corsPreflight, errorResponse } from '../../_lib/response.js';

export async function onRequestGet(context = {}) {
  const url = new URL(context.request?.url || 'http://localhost/api/packs');
  const topic = url.searchParams.get('topic') || '';
  const isAll = url.searchParams.get('all') === '1' || url.searchParams.get('all') === 'true';
  const isExport = url.searchParams.get('export') === '1' || url.searchParams.get('export') === 'true';

  if (isExport) {
    const packs = await getAllPacks(context);
    const markdown = exportPacksToMarkdown(packs);
    return json({ markdown, packs });
  }

  if (isAll) {
    const packs = await getAllPacks(context);
    return json({ packs });
  }

  const packs = await listPacks(topic, context);
  return json({ packs });
}

export async function onRequestPost(context = {}) {
  let markdown = '';
  try {
    const contentType = context.request?.headers?.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await context.request.json();
      markdown = body.markdown || '';
    } else {
      markdown = await context.request.text();
    }
  } catch (err) {
    return errorResponse('Không thể đọc dữ liệu gửi lên: ' + err.message, 400);
  }

  if (!markdown || !markdown.trim()) {
    return errorResponse('Nội dung markdown không được để trống', 400);
  }

  const result = await createPackFromMarkdown(markdown, context);

  if (!result.success) {
    return json(result, 422);
  }

  return json(result, 201);
}

export async function onRequestOptions() {
  return corsPreflight();
}
