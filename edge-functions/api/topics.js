import { listTopics } from '../_lib/store.js';
import { json, corsPreflight } from '../_lib/response.js';

export async function onRequestGet() {
  const topics = await listTopics();
  return json({ topics });
}

export async function onRequestOptions() {
  return corsPreflight();
}
