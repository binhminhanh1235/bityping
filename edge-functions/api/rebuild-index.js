import { rebuildIndex } from '../_lib/store.js';
import { json, corsPreflight } from '../_lib/response.js';

export async function onRequestPost() {
  const result = await rebuildIndex();
  return json(result);
}

export async function onRequestOptions() {
  return corsPreflight();
}
