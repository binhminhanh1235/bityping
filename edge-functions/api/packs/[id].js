import { getPack, deletePack, deleteCardFromPack } from '../../_lib/store.js';
import { json, corsPreflight, errorResponse } from '../../_lib/response.js';

export async function onRequestGet(context = {}) {
  const id = context.params?.id;
  if (!id) {
    return errorResponse('Thiếu pack id', 400);
  }

  const pack = await getPack(id, context);
  if (!pack) {
    return errorResponse(`Không tìm thấy pack có id "${id}"`, 404);
  }

  return json({ pack });
}

export async function onRequestDelete(context = {}) {
  const id = context.params?.id;
  if (!id) {
    return errorResponse('Thiếu pack id', 400);
  }

  const url = new URL(context.request?.url || 'http://localhost/api/packs');
  const cardId = url.searchParams.get('cardId');

  if (cardId) {
    // Xoá 1 thẻ lẻ trong pack
    const result = await deleteCardFromPack(id, cardId, context);
    if (!result.success) {
      return errorResponse(result.message || 'Không thể xoá thẻ', 400);
    }
    return json(result);
  }

  // Xoá nguyên pack
  const result = await deletePack(id, context);
  return json(result);
}

export async function onRequestOptions() {
  return corsPreflight();
}
