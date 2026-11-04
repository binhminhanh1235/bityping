import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  loadNodeStorageConfig,
  saveNodeStorageConfig,
  readLocalPacks,
  writeLocalPacks,
  syncPackToStorages,
  collectAllCardHashes,
  collectAllTopics
} from '../src/lib/storage/node-sync.js';

describe('MCP Storage & Gist Sync Integration', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bityping-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
    vi.restoreAllMocks();
  });

  it('loads and saves .storage-config.json correctly in custom rootDir', () => {
    const initialConfig = loadNodeStorageConfig(tmpDir);
    expect(initialConfig.gist.enabled).toBe(false);
    expect(initialConfig.gist.token).toBe('');

    const saved = saveNodeStorageConfig(
      {
        gist: {
          token: 'ghp_test_token_123',
          gistId: 'test_gist_id_456'
        }
      },
      tmpDir
    );
    expect(saved).toBe(true);

    const loaded = loadNodeStorageConfig(tmpDir);
    expect(loaded.gist.enabled).toBe(true);
    expect(loaded.gist.token).toBe('ghp_test_token_123');
    expect(loaded.gist.gistId).toBe('test_gist_id_456');
  });

  it('reads and writes local-packs.json', () => {
    const initialPacks = readLocalPacks(tmpDir);
    expect(initialPacks).toEqual([]);

    const samplePacks = [
      {
        id: 'pack_test_1',
        topic: 'Golang Basics',
        cards: [{ en: 'Go is fast', vi: 'Go rất nhanh', hash: 'hash1' }]
      }
    ];

    const wrote = writeLocalPacks(samplePacks, tmpDir);
    expect(wrote).toBe(true);

    const read = readLocalPacks(tmpDir);
    expect(read).toHaveLength(1);
    expect(read[0].topic).toBe('Golang Basics');
  });

  it('syncPackToStorages saves pack to local file and warns when Gist is unconfigured', async () => {
    const md = `---
topic: Rust Concurrency
tags: [threads, rust]
level: B2
---
en: Channels [send]{1} messages between [threads]{2}.
vi: Kênh [gửi]{1} tin nhắn giữa các [luồng]{2}.
`;

    const res = await syncPackToStorages({
      markdown: md,
      rootDir: tmpDir
    });

    expect(res.success).toBe(true);
    expect(res.savedCount).toBe(1);
    expect(res.targets).toContain('local_file');
    expect(res.targets).not.toContain('gist');

    const localPacks = readLocalPacks(tmpDir);
    expect(localPacks).toHaveLength(1);
    expect(localPacks[0].topic).toBe('Rust Concurrency');
  });

  it('syncPackToStorages syncs to both local file and GitHub Gist when Gist is configured', async () => {
    // Mock global fetch for GitHub Gist
    const mockGistPacks = [
      {
        id: 'existing_pack',
        topic: 'Existing Topic',
        cards: []
      }
    ];

    let savedGistPayload = null;
    vi.stubGlobal('fetch', vi.fn(async (url, opts = {}) => {
      const urlStr = String(url);
      if (urlStr.includes('api.github.com/gists/test_gist_id')) {
        if (opts.method === 'PATCH') {
          savedGistPayload = JSON.parse(opts.body);
          return {
            ok: true,
            json: async () => ({ id: 'test_gist_id' })
          };
        }
        return {
          ok: true,
          json: async () => ({
            id: 'test_gist_id',
            files: {
              'typelearn-data.json': {
                content: JSON.stringify({ packs: mockGistPacks })
              }
            }
          })
        };
      }
      return { ok: false, status: 404 };
    }));

    const config = {
      gist: {
        enabled: true,
        token: 'ghp_mock_token',
        gistId: 'test_gist_id'
      },
      localFile: { enabled: true, path: 'data/local-packs.json' }
    };

    const md = `---
topic: Docker Containers
tags: [devops]
level: B1
---
en: A container [packages]{1} an application and its [dependencies]{2}.
vi: Một container [đóng gói]{1} ứng dụng cùng [các phụ thuộc]{2} của nó.
`;

    const res = await syncPackToStorages({
      markdown: md,
      config,
      rootDir: tmpDir
    });

    expect(res.success).toBe(true);
    expect(res.targets).toContain('local_file');
    expect(res.targets).toContain('gist');
    expect(savedGistPayload).not.toBeNull();

    const fileContent = JSON.parse(savedGistPayload.files['typelearn-data.json'].content);
    expect(fileContent.packs).toHaveLength(2);
    expect(fileContent.packs.some((p) => p.topic === 'Docker Containers')).toBe(true);
  });

  it('collectAllCardHashes and collectAllTopics aggregate across local and Gist', async () => {
    // Populate local packs
    writeLocalPacks(
      [
        {
          id: 'pack_local',
          topic: 'Local Topic',
          cards: [{ hash: 'hash_local_1' }]
        }
      ],
      tmpDir
    );

    // Mock Gist fetch
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url).includes('api.github.com/gists/test_gist_id')) {
        return {
          ok: true,
          json: async () => ({
            id: 'test_gist_id',
            files: {
              'typelearn-data.json': {
                content: JSON.stringify({
                  packs: [
                    {
                      id: 'pack_gist',
                      topic: 'Gist Topic',
                      cards: [{ hash: 'hash_gist_1' }]
                    }
                  ]
                })
              }
            }
          })
        };
      }
      return { ok: false, status: 404 };
    }));

    const config = {
      gist: { enabled: true, token: 'ghp_mock', gistId: 'test_gist_id' },
      localFile: { enabled: true, path: 'data/local-packs.json' }
    };

    const hashes = await collectAllCardHashes({ rootDir: tmpDir, config });
    expect(hashes.has('hash_local_1')).toBe(true);
    expect(hashes.has('hash_gist_1')).toBe(true);

    const topics = await collectAllTopics({ rootDir: tmpDir, config });
    expect(topics.some((t) => t.topic === 'Local Topic')).toBe(true);
    expect(topics.some((t) => t.topic === 'Gist Topic')).toBe(true);
  });
});
