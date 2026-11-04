import { useState, useEffect } from 'preact/hooks';
import { getEnglishVoices } from '../lib/speech.js';
import { resetSessionStats } from '../lib/stats.js';
import { getStorageConfig, saveStorageConfig } from '../lib/api.js';
import { gistFindOrCreate } from '../lib/storage/gist.js';
import { edgeoneCheckHealth } from '../lib/storage/edgeone.js';

export function SettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onResetStats,
  onSync,
  isSyncing = false
}) {
  if (!isOpen) return null;

  const [voices, setVoices] = useState([]);
  const [storageCfg, setStorageCfg] = useState(getStorageConfig);
  const [gistStatus, setGistStatus] = useState({ loading: false, msg: '', error: false });
  const [eoHealth, setEoHealth] = useState({ checking: false, connected: false, status: '' });

  useEffect(() => {
    getEnglishVoices().then(setVoices);
  }, []);

  // Kiểm tra EdgeOne API health khi mở modal
  useEffect(() => {
    if (storageCfg.edgeone?.enabled) {
      setEoHealth({ checking: true, connected: false, status: 'Đang kiểm tra...' });
      edgeoneCheckHealth().then((res) => {
        setEoHealth({
          checking: false,
          connected: res.ok,
          status: res.ok ? 'Đã kết nối' : 'Chưa có KV / Offline'
        });
      });
    }
  }, [storageCfg.edgeone?.enabled]);

  const handleToggle = (key) => {
    onUpdateSettings({ [key]: !settings[key] });
  };

  const handleChange = (key, value) => {
    onUpdateSettings({ [key]: value });
  };

  const handleResetSession = () => {
    if (window.confirm('Bạn có chắc muốn đặt lại chỉ số phiên làm việc về 0 không?')) {
      resetSessionStats();
      if (onResetStats) onResetStats();
    }
  };

  // Cập nhật cấu hình Storage
  const updateStorage = (partial) => {
    const updated = saveStorageConfig(partial);
    setStorageCfg(updated);
    // Tự động đồng bộ với backend dev server nếu có
    if (updated.gist) {
      try {
        fetch('/api/storage-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gist: updated.gist })
        }).catch(() => {});
      } catch {}
    }
  };

  // Thao tác kết nối / tự tạo Gist
  const handleConnectGist = async () => {
    if (!storageCfg.gist.token) {
      setGistStatus({ loading: false, msg: 'Vui lòng nhập GitHub Personal Access Token', error: true });
      return;
    }
    setGistStatus({ loading: true, msg: 'Đang kiểm tra và khởi tạo Gist...', error: false });
    const res = await gistFindOrCreate(storageCfg.gist.token, storageCfg.gist.gistId);
    if (res.ok) {
      const nextGist = {
        ...storageCfg.gist,
        enabled: true,
        gistId: res.gistId
      };
      updateStorage({ gist: nextGist });
      try {
        await fetch('/api/storage-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gist: nextGist })
        });
      } catch {}
      setGistStatus({
        loading: false,
        msg: res.isNew ? `Đã tạo Secret Gist mới: ${res.gistId}` : `Đã kết nối Gist: ${res.gistId}`,
        error: false
      });
    } else {
      setGistStatus({
        loading: false,
        msg: res.error || 'Lỗi kết nối GitHub',
        error: true
      });
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Cài Đặt Luyện Gõ & Lưu Trữ</h3>
          <button className="icon-btn" onClick={onClose} title="Đóng (Esc)">
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* Section: Kho lưu trữ đa nguồn (Multi-Storage) */}
          <div style={{ marginBottom: '1.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <h4 style={{ fontSize: '0.8125rem', textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 600, margin: 0 }}>
                Kho Lưu Trữ & Đồng Bộ (Multi-Storage)
              </h4>
              {onSync && (
                <button
                  className="btn btn-secondary"
                  onClick={onSync}
                  disabled={isSyncing}
                  style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <span className={isSyncing ? 'spinning' : ''}>🔄</span>
                  {isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ ngay'}
                </button>
              )}
            </div>

            {/* 1. Local IndexedDB */}
            <div className="storage-card">
              <div className="storage-card-header">
                <div className="storage-card-title">
                  <span>💾</span>
                  <span>Local IndexedDB (Trình duyệt)</span>
                  <span className="source-badge badge-local">Local</span>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={storageCfg.local?.enabled}
                    onChange={(e) => updateStorage({ local: { ...storageCfg.local, enabled: e.target.checked } })}
                  />
                  <span className="slider"></span>
                </label>
              </div>
              <p className="storage-card-desc">
                Lưu trữ trực tiếp và bền bỉ trong trình duyệt của bạn (&gt;50MB). Hoạt động tức thì 100% offline, không cần tài khoản hay server.
              </p>
            </div>

            {/* 2. GitHub Gist */}
            <div className="storage-card">
              <div className="storage-card-header">
                <div className="storage-card-title">
                  <span>🐙</span>
                  <span>GitHub Gist (Đám mây cá nhân)</span>
                  <span className="source-badge badge-gist">GitHub</span>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={storageCfg.gist?.enabled}
                    onChange={(e) => updateStorage({ gist: { ...storageCfg.gist, enabled: e.target.checked } })}
                  />
                  <span className="slider"></span>
                </label>
              </div>
              <p className="storage-card-desc">
                Miễn phí 100%, bảo mật vĩnh viễn trên GitHub của bạn. Đồng bộ bài học giữa nhiều máy tính bằng Personal Access Token (PAT).
              </p>

              <div className="storage-input-group">
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                    GitHub Personal Access Token (classic hoặc fine-grained với quyền 'gist'):
                  </label>
                  <input
                    type="password"
                    className="storage-input"
                    placeholder="ghp_xxxxxxxxxxxx hoặc github_pat_xxxx"
                    value={storageCfg.gist?.token || ''}
                    onInput={(e) => updateStorage({ gist: { ...storageCfg.gist, token: e.target.value } })}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                    Gist ID (Để trống nếu muốn hệ thống tự tạo Secret Gist mới):
                  </label>
                  <input
                    type="text"
                    className="storage-input"
                    placeholder="Ví dụ: 8a7b9c1d..."
                    value={storageCfg.gist?.gistId || ''}
                    onInput={(e) => updateStorage({ gist: { ...storageCfg.gist, gistId: e.target.value } })}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={handleConnectGist}
                    disabled={gistStatus.loading}
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem' }}
                  >
                    {gistStatus.loading ? 'Đang xử lý...' : 'Kiểm tra & Tự tạo Gist'}
                  </button>
                  {gistStatus.msg && (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: gistStatus.error ? 'var(--text-error, #ef4444)' : 'var(--text-correct-green, #10b981)'
                      }}
                    >
                      {gistStatus.msg}
                    </span>
                  )}
                </div>

                {storageCfg.gist?.enabled && storageCfg.gist?.token && storageCfg.gist?.gistId && (
                  <div
                    style={{
                      marginTop: '0.75rem',
                      padding: '0.65rem 0.85rem',
                      background: 'rgba(56, 189, 248, 0.08)',
                      border: '1px solid rgba(56, 189, 248, 0.25)',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>🤖 AI Agent &amp; MCP Server</span>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '0.15rem 0.5rem', fontSize: '0.7rem' }}
                        onClick={() => {
                          const envText = `GITHUB_TOKEN=${storageCfg.gist.token}\nGIST_ID=${storageCfg.gist.gistId}`;
                          if (navigator.clipboard) {
                            navigator.clipboard.writeText(envText);
                          }
                          alert('Đã sao chép cấu hình .env cho AI Agent:\n' + envText);
                        }}
                      >
                        📋 Copy .env cho MCP
                      </button>
                    </div>
                    <p style={{ margin: 0, lineHeight: 1.4 }}>
                      Cấu hình Gist tự động liên kết với MCP Server qua <code>.storage-config.json</code>. Khi bạn yêu cầu AI Agent nạp bài qua MCP, pack sẽ được tự động lưu thẳng lên Gist này và hiển thị ngay trên web!
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 3. Tencent EdgeOne KV */}
            <div className="storage-card">
              <div className="storage-card-header">
                <div className="storage-card-title">
                  <span>⚡</span>
                  <span>Tencent EdgeOne KV</span>
                  <span className="source-badge badge-edgeone">EdgeOne</span>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={storageCfg.edgeone?.enabled}
                    onChange={(e) => updateStorage({ edgeone: { ...storageCfg.edgeone, enabled: e.target.checked } })}
                  />
                  <span className="slider"></span>
                </label>
              </div>
              <p className="storage-card-desc">
                Lưu trữ tập trung qua V8 Edge Functions + KV. Tự động đồng bộ và hoạt động khi tài khoản của bạn được Tencent cấp duyệt KV binding.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className={`storage-status-pill ${eoHealth.connected ? 'connected' : 'waiting'}`}>
                  ● {eoHealth.status || 'Chưa kiểm tra'}
                </span>
              </div>
            </div>
          </div>

          {/* Section: Quy tắc gõ */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ fontSize: '0.8125rem', textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 600, marginBottom: '0.75rem' }}>
              Quy tắc gõ phím
            </h4>

            <div className="toggle-row">
              <div className="toggle-info">
                <h4>Bỏ phân biệt hoa / thường</h4>
                <p>Khớp ký tự hoa thường tự do (gõ "a" vẫn khớp "A")</p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.ignoreCase}
                  onChange={() => handleToggle('ignoreCase')}
                />
                <span className="slider"></span>
              </label>
            </div>

            <div className="toggle-row">
              <div className="toggle-info">
                <h4>Tự động nhảy qua dấu câu</h4>
                <p>Nhảy qua dấu chấm, phẩy, chấm than để chỉ cần gõ chữ và space</p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.ignorePunctuation}
                  onChange={() => handleToggle('ignorePunctuation')}
                />
                <span className="slider"></span>
              </label>
            </div>

            <div className="toggle-row">
              <div className="toggle-info">
                <h4>Tự động phát âm thanh khi sang thẻ mới</h4>
                <p>Đọc mẫu tiếng Anh ngay khi xuất hiện câu mới</p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.autoSpeakOnStart}
                  onChange={() => handleToggle('autoSpeakOnStart')}
                />
                <span className="slider"></span>
              </label>
            </div>

            <div className="toggle-row">
              <div className="toggle-info">
                <h4>Chế độ sửa lỗi gõ</h4>
                <p>Buộc gõ đúng trước khi đi tiếp (Force Correction)</p>
              </div>
              <select
                value={settings.errorMode || 'force_correct'}
                onChange={(e) => handleChange('errorMode', e.target.value)}
                style={{
                  background: 'var(--bg-subtle)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  padding: '0.35rem 0.5rem',
                  fontSize: '0.8125rem'
                }}
              >
                <option value="force_correct">Bắt buộc sửa đúng</option>
                <option value="allow_skip">Cho phép gõ tiếp</option>
              </select>
            </div>

            <div className="toggle-row">
              <div className="toggle-info">
                <h4>Thứ tự luyện thẻ</h4>
                <p>Ngẫu nhiên hoặc tuần tự theo danh sách</p>
              </div>
              <select
                value={settings.shuffleMode || 'random'}
                onChange={(e) => handleChange('shuffleMode', e.target.value)}
                style={{
                  background: 'var(--bg-subtle)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  padding: '0.35rem 0.5rem',
                  fontSize: '0.8125rem'
                }}
              >
                <option value="random">Ngẫu nhiên</option>
                <option value="sequential">Tuần tự</option>
              </select>
            </div>

            <div className="toggle-row">
              <div className="toggle-info">
                <h4>Hiển thị gợi ý phím tắt gõ tiếng Việt</h4>
                <p>Hiển thị chuỗi gõ Telex / VNI bên dưới từ đang gõ</p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.showImeHint !== false}
                  onChange={() => handleToggle('showImeHint')}
                />
                <span className="slider"></span>
              </label>
            </div>

            {settings.showImeHint !== false && (
              <div className="toggle-row">
                <div className="toggle-info">
                  <h4>Kiểu gõ tiếng Việt</h4>
                </div>
                <select
                  value={settings.imeMethod || 'telex'}
                  onChange={(e) => handleChange('imeMethod', e.target.value)}
                  style={{
                    background: 'var(--bg-subtle)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    padding: '0.35rem 0.5rem',
                    fontSize: '0.8125rem'
                  }}
                >
                  <option value="telex">Telex (s, f, r, x, j, w, aa, dd...)</option>
                  <option value="vni">VNI (1, 2, 3, 4, 5, 6, 7, 8, 9)</option>
                </select>
              </div>
            )}

            {voices.length > 0 && (
              <div className="toggle-row">
                <div className="toggle-info">
                  <h4>Giọng đọc tiếng Anh</h4>
                </div>
                <select
                  value={settings.voiceURI || ''}
                  onChange={(e) => handleChange('voiceURI', e.target.value)}
                  style={{
                    maxWidth: '180px',
                    background: 'var(--bg-subtle)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    padding: '0.35rem 0.5rem',
                    fontSize: '0.8125rem'
                  }}
                >
                  <option value="">Mặc định trình duyệt</option>
                  {voices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="toggle-row">
              <div className="toggle-info">
                <h4>Tốc độ đọc: {settings.speechRate || 1.0}x</h4>
              </div>
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.1"
                value={settings.speechRate || 1.0}
                onInput={(e) => handleChange('speechRate', parseFloat(e.target.value))}
                style={{ width: '130px', accentColor: 'var(--accent)' }}
              />
            </div>
          </div>

          {/* Section: Thống kê */}
          <div>
            <h4 style={{ fontSize: '0.8125rem', textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 600, marginBottom: '0.75rem' }}>
              Dữ liệu phiên
            </h4>
            <button className="btn btn-secondary" onClick={handleResetSession}>
              Đặt lại thống kê phiên về 0
            </button>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>
            Xong
          </button>
        </div>
      </div>
    </div>
  );
}
