import { validateCards } from '../../shared/validate.js';
import { getAllExistingCardHashes } from '../_lib/store.js';
import { json, corsPreflight, errorResponse } from '../_lib/response.js';

export async function onRequestPost(context) {
  let markdown = '';
  try {
    const contentType = context.request.headers.get('content-type') || '';
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

  const existingHashes = await getAllExistingCardHashes();
  const result = validateCards(markdown, existingHashes);

  return json({
    valid: result.valid,
    meta: result.meta,
    errors: result.errors,
    cards: result.cards,
    duplicateCount: result.duplicateCount,
    duplicates: result.duplicates,
    savedCount: result.savedCount
  });
}

export async function onRequestOptions() {
  return corsPreflight();
}
