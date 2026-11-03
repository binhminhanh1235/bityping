import { useState, useEffect } from 'preact/hooks';
import { getEnglishVoices } from '../lib/speech.js';
import { resetSessionStats } from '../lib/stats.js';

export function SettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onResetStats
}) {
  if (!isOpen) return null;

  const [voices, setVoices] = useState([]);

  useEffect(() => {
    getEnglishVoices().then(setVoices);
  }, []);

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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Cài Đặt Luyện Gõ</h3>
          <button className="icon-btn" onClick={onClose} title="Đóng (Esc)">
            ✕
          </button>
        </div>

        <div className="modal-body">
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
                <h4>Chế độ sửa lỗi</h4>
                <p>Cách ứng xử của con trỏ khi bạn gõ sai ký tự</p>
              </div>
              <select
                value={settings.errorMode || 'backspace'}
                onChange={(e) => handleChange('errorMode', e.target.value)}
                style={{
                  background: 'var(--bg-subtle)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  padding: '0.35rem 0.6rem',
                  fontSize: '0.8125rem'
                }}
              >
                <option value="backspace">Tự do Backspace (mặc định)</option>
                <option value="stop-on-error">Chặn khi gõ sai (Stop on error)</option>
                <option value="word-lock">Chốt từng từ bằng Space</option>
              </select>
            </div>
          </div>

          {/* Section: Luồng học */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ fontSize: '0.8125rem', textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 600, marginBottom: '0.75rem' }}>
              Luồng học & Phản xạ
            </h4>

            <div className="toggle-row">
              <div className="toggle-info">
                <h4>Tự chuyển thẻ sau khi xong</h4>
                <p>Tự động chuyển sang thẻ random tiếp theo sau 1.2 giây</p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.autoNext}
                  onChange={() => handleToggle('autoNext')}
                />
                <span className="slider"></span>
              </label>
            </div>

            <div className="toggle-row">
              <div className="toggle-info">
                <h4>Ưu tiên thẻ yếu</h4>
                <p>Ưu tiên các thẻ chưa gặp hoặc có độ chính xác thấp & nhiều lỗi</p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.prioritizeWeak}
                  onChange={() => handleToggle('prioritizeWeak')}
                />
                <span className="slider"></span>
              </label>
            </div>

            <div className="toggle-row">
              <div className="toggle-info">
                <h4>Chế độ nhớ (Memory Mode)</h4>
                <p>Ẩn chữ tiếng Anh gợi ý, chỉ nhìn tiếng Việt rồi chủ động gõ ra</p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.memoryMode}
                  onChange={() => handleToggle('memoryMode')}
                />
                <span className="slider"></span>
              </label>
            </div>
          </div>

          {/* Section: Âm thanh TTS */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ fontSize: '0.8125rem', textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 600, marginBottom: '0.75rem' }}>
              Phát âm thanh (TTS - Ctrl+P)
            </h4>

            <div className="toggle-row">
              <div className="toggle-info">
                <h4>Tự đọc khi bắt đầu thẻ mới</h4>
                <p>Phát âm câu tiếng Anh ngay khi thẻ vừa xuất hiện</p>
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
                <h4>Tự đọc khi gõ xong thẻ</h4>
                <p>Phát âm lại toàn câu để nghe ngữ điệu chuẩn sau khi gõ xong</p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.autoSpeakOnEnd}
                  onChange={() => handleToggle('autoSpeakOnEnd')}
                />
                <span className="slider"></span>
              </label>
            </div>

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
