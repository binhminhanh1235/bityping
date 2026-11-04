import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  idbSavePack,
  idbGetPack,
  idbGetAllPacks,
  idbDeletePack,
  idbClear
} from '../src/lib/storage/idb.js';
import {
  gistVerifyToken,
  gistFindOrCreate,
  gistGetPacks,
  gistSavePacks
} from '../src/lib/storage/gist.js';
import {
  getStorageConfig,
  saveStorageConfig,
  getAggregatedPacks,
  savePackMarkdown,
  deletePack,
  syncAllStorages
} from '../src/lib/storage/manager.js';

describe('Multi-Storage System Unit Tests', () => {
  beforeEach(async () => {
    await idbClear();
    // Reset config
    saveStorageConfig({
      local: { enabled: true },
      gist: { enabled: false, token: '', gistId: '', lastSync: null },
      edgeone: { enabled: false, lastSync: null }
    });
  });

  describe('IndexedDB Adapter (with fallback)', () => {
    it('saves, reads, and deletes a pack in local storage', async () => {
      const mockPack = {
        id: 'pack_test_1',
        topic: 'Test Topic',
        cards: [{ id: 'c_1', en: 'Hello', vi: 'Xin chào' }],
        createdAt: '2026-11-04T12:00:00Z',
        updatedAt: '2026-11-04T12:00:00Z'
      };

      const saved = await idbSavePack(mockPack);
      expect(saved).toBe(true);

      const retrieved = await idbGetPack('pack_test_1');
      expect(retrieved).not.toBeNull();
      expect(retrieved.id).toBe('pack_test_1');
      expect(retrieved.topic).toBe('Test Topic');

      const all = await idbGetAllPacks();
      expect(all.some((p) => p.id === 'pack_test_1')).toBe(true);

      const deleted = await idbDeletePack('pack_test_1');
      expect(deleted).toBe(true);

      const afterDelete = await idbGetPack('pack_test_1');
      expect(afterDelete).toBeNull();
    });
  });

  describe('GitHub Gist Adapter', () => {
    it('verifies GitHub token correctly with fetch mock', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ login: 'octocat' })
      });

      const res = await gistVerifyToken('ghp_mock_token');
      expect(res.ok).toBe(true);
      expect(res.user).toBe('octocat');

      globalThis.fetch = originalFetch;
    });

    it('returns error when token is invalid or missing', async () => {
      const res = await gistVerifyToken('');
      expect(res.ok).toBe(false);
      expect(res.error).toContain('Chưa nhập GitHub Token');
    });

    it('finds existing Gist or creates new one with correct payload', async () => {
      const originalFetch = globalThis.fetch;
      // 1. User check ok, 2. Gist list empty, 3. Create Gist returns id
      globalThis.fetch = vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ login: 'octocat' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'new_gist_id_123' }) });

      const res = await gistFindOrCreate('ghp_mock_token');
      expect(res.ok).toBe(true);
      expect(res.gistId).toBe('new_gist_id_123');
      expect(res.isNew).toBe(true);

      globalThis.fetch = originalFetch;
    });
  });

  describe('MultiStorageManager (Aggregated View & Write-Through)', () => {
    it('creates a pack via markdown and saves to local storage', async () => {
      const sampleMd = `---
topic: Cloud Architecture
tags: [cloud, aws]
level: B2
---
en: An [Amazon S3 bucket]{1} stores objects in the cloud.
vi: Một [thùng chứa Amazon S3]{1} lưu trữ các đối tượng trên đám mây.
`;

      const result = await savePackMarkdown(sampleMd);
      expect(result.success).toBe(true);
      expect(result.savedCount).toBe(1);
      expect(result.topic).toBe('Cloud Architecture');

      const { packs } = await getAggregatedPacks({ all: true });
      const found = packs.find((p) => p.topic === 'Cloud Architecture');
      expect(found).toBeDefined();
      expect(found.sources).toContain('local');
    });

    it('syncs across storages using bi-directional latest-timestamp-wins logic', async () => {
      // Seed a local pack
      await idbSavePack({
        id: 'pack_local_newer',
        topic: 'Local Topic',
        cards: [{ id: 'c_loc', en: 'Local', vi: 'Cục bộ' }],
        updatedAt: '2026-11-04T19:00:00Z'
      });

      // Mock Gist having an additional pack
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockImplementation((url, opts) => {
        if (url.includes('api.github.com/gists/mock_gist_id')) {
          if (opts?.method === 'PATCH') {
            return Promise.resolve({ ok: true, json: async () => ({}) });
          }
          return Promise.resolve({
            ok: true,
            json: async () => ({
              files: {
                'typelearn-data.json': {
                  content: JSON.stringify({
                    version: 1,
                    packs: [
                      {
                        id: 'pack_gist_remote',
                        topic: 'Remote Gist Topic',
                        cards: [{ id: 'c_rem', en: 'Remote', vi: 'Từ xa' }],
                        updatedAt: '2026-11-04T18:00:00Z'
                      }
                    ]
                  })
                }
              }
            })
          });
        }
        return Promise.resolve({ ok: false, status: 404 });
      });

      saveStorageConfig({
        local: { enabled: true },
        gist: { enabled: true, token: 'ghp_fake', gistId: 'mock_gist_id' },
        edgeone: { enabled: false }
      });

      const syncResult = await syncAllStorages();
      expect(syncResult.success).toBe(true);
      expect(syncResult.syncedCount).toBe(2);

      // Verify both packs are now in local storage
      const allLocal = await idbGetAllPacks();
      expect(allLocal.some((p) => p.id === 'pack_local_newer')).toBe(true);
      expect(allLocal.some((p) => p.id === 'pack_gist_remote')).toBe(true);

      globalThis.fetch = originalFetch;
    });
  });
});
