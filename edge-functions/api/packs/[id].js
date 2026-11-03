import { getPack, deletePack, deleteCardFromPack } from '../../_lib/store.js';
import { json, corsPreflight, errorResponse } from '../../_lib/response.js';

export async function onRequestGet(context) {
  const id = context.params?.id;
  if (!id) {
    return errorResponse('Thiếu pack id', 400);
  }

  const pack = await getPack(id);
  if (!pack) {
    return errorResponse(`Không tìm thấy pack có id "${id}"`, 404);
  }

  return json({ pack });
}

export async function onRequestDelete(context) {
  const id = context.params?.id;
  if (!id) {
    return errorResponse('Thiếu pack id', 400);
  }

  const url = new URL(context.request.url);
  const cardId = url.searchParams.get('cardId');

  if (cardId) {
    // Xoá 1 thẻ lẻ trong pack
    const result = await deleteCardFromPack(id, cardId);
    if (!result.success) {
      return errorResponse(result.message || 'Không thể xoá thẻ', 400);
    }
    return json(result);
  }

  // Xoá nguyên pack
  const result = await deletePack(id);
  return json(result);
}

export async function onRequestOptions() {
  return corsPreflight();
}
