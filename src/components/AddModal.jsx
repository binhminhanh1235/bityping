import { useState, useEffect } from 'preact/hooks';
import { validateCards } from '../../shared/validate.js';
import { savePackMarkdown } from '../lib/api.js';

const SAMPLE_MD = `---
topic: Cloud Native
tags: [kubernetes, docker]
level: B2
---

en: Containers [isolate]{1} application workloads from [the host environment]{2}.
vi: Các vùng chứa [cô lập]{1} các khối lượng công việc ứng dụng khỏi [môi trường máy chủ]{2}.
note: Docker và containerd là hai container runtime phổ biến nhất hiện nay.

en: Kubernetes [orchestrates]{1} container deployment and [scaling]{2} across clusters.
vi: Kubernetes [điều phối]{1} việc triển khai vùng chứa và [mở rộng quy mô]{2} trên toàn cụm.
note: Tự động phục hồi pod bị lỗi và tự động cân bằng tải nội bộ.
`;

export function AddModal({ isOpen, onClose, onPackSaved }) {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState('editor'); // 'editor' | 'mcp'
  const [markdown, setMarkdown] = useState('');
  const [validationResult, setValidationResult] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  // Live validate khi markdown thay đổi
  useEffect(() => {
    if (!markdown.trim()) {
      setValidationResult(null);
      return;
    }
    const res = validateCards(markdown);
    setValidationResult(res);
  }, [markdown]);

  const handleInsertSample = () => {
    setMarkdown(SAMPLE_MD.trim());
    setSaveMessage(null);
  };

  const handleSave = async () => {
    if (!markdown.trim() || !validationResult?.valid) return;

    setIsSaving(true);
    setSaveMessage(null);

    const res = await savePackMarkdown(markdown);
    setIsSaving(false);

    if (res.success) {
      setSaveMessage({
        type: 'success',
        text: `Đã lưu thành công pack "${res.topic}" (${res.savedCount} thẻ mới${
          res.duplicateCount > 0 ? `, ${res.duplicateCount} thẻ trùng đã lọc` : ''
        })!`
      });
      if (onPackSaved) {
        onPackSaved();
      }
      setTimeout(() => {
        onClose();
        setSaveMessage(null);
        setMarkdown('');
      }, 1200);
    } else {
      setSaveMessage({
        type: 'error',
        text: res.errors?.[0]?.message || 'Lỗi khi lưu pack vào cơ sở dữ liệu'
      });
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content add-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header add-modal-header">
          <div className="add-header-titles">
            <h3 className="modal-title">Thêm Thẻ Bài Học</h3>
            <div className="add-header-tabs">
              <button
                className={`btn ${activeTab === 'editor' ? 'btn-primary' : 'btn-secondary'} add-tab-btn`}
                onClick={() => setActiveTab('editor')}
              >
                Dán Markdown
              </button>
              <button
                className={`btn ${activeTab === 'mcp' ? 'btn-primary' : 'btn-secondary'} add-tab-btn`}
                onClick={() => setActiveTab('mcp')}
              >
                Kết nối AI Agent (MCP)
              </button>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} title="Đóng (Esc)" aria-label="Đóng cửa sổ">
            ✕
          </button>
        </div>

        <div className="modal-body add-modal-body">
          {activeTab === 'editor' ? (
            <>
              <div className="add-editor-toolbar">
                <span className="form-label" style={{ marginBottom: 0 }}>
                  Nội dung Markdown Pack
                </span>
                <button
                  className="btn btn-secondary stage-action-btn"
                  style={{ fontSize: '0.75rem' }}
                  onClick={handleInsertSample}
                >
                  📝 Chèn mẫu thử
                </button>
              </div>

              <textarea
                className="form-textarea"
                placeholder="Dán nội dung pack Markdown vào đây (gồm front matter topic: ..., en: ..., vi: ...)"
                value={markdown}
                onInput={(e) => setMarkdown(e.target.value)}
              />

              {/* Thông báo lưu */}
              {saveMessage && (
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    marginTop: '0.75rem',
                    fontSize: '0.875rem',
                    backgroundColor: saveMessage.type === 'success' ? 'rgba(74, 222, 128, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: saveMessage.type === 'success' ? '#4ade80' : '#f87171'
                  }}
                >
                  {saveMessage.text}
                </div>
              )}

              {/* Kết quả Validate */}
              {validationResult && (
                <div style={{ marginTop: '1rem' }}>
                  {validationResult.valid ? (
                    <div
                      style={{
                        padding: '0.75rem 1rem',
                        borderRadius: '8px',
                        backgroundColor: 'var(--bg-subtle)',
                        borderLeft: '3px solid #4ade80',
                        fontSize: '0.8125rem'
                      }}
                    >
                      <div style={{ fontWeight: 600, color: '#4ade80', marginBottom: '0.25rem' }}>
                        ✓ Cú pháp hợp lệ! Chủ đề: {validationResult.meta.topic || 'General'}
                      </div>
                      <div style={{ color: 'var(--text-secondary)' }}>
                        Tìm thấy <strong>{validationResult.cards.length}</strong> thẻ.
                        {validationResult.duplicateCount > 0 && (
                          <span style={{ color: '#fbbf24', marginLeft: '0.5rem' }}>
                            (Có {validationResult.duplicateCount} thẻ trùng sẽ tự động lọc bỏ)
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: '0.75rem 1rem',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        borderLeft: '3px solid #f87171',
                        fontSize: '0.8125rem'
                      }}
                    >
                      <div style={{ fontWeight: 600, color: '#f87171', marginBottom: '0.5rem' }}>
                        Phát hiện {validationResult.errors.length} lỗi cần sửa:
                      </div>
                      <ul style={{ paddingLeft: '1.2rem', color: 'var(--text-secondary)' }}>
                        {validationResult.errors.map((err, i) => (
                          <li key={i} style={{ marginBottom: '0.25rem' }}>
                            {err.card ? <strong>[Thẻ #{err.card}] </strong> : ''}
                            {err.line ? `(Dòng ${err.line}) ` : ''}
                            {err.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: '0.875rem', lineHeight: '1.7', color: 'var(--text-secondary)' }}>
              <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                🤖 Giao thức Model Context Protocol (MCP)
              </h4>
              <p style={{ marginBottom: '0.75rem' }}>
                BiTyping tích hợp sẵn một **MCP Server** chuẩn, giúp các trợ lý AI (Claude Code, Cursor, Windsurf...)
                tự động tạo thẻ bài học song ngữ đúng format mà không cần thao tác dán tay.
              </p>

              <div style={{ background: 'var(--bg-subtle)', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 600 }}>
                  HTTP Streamable Endpoint
                </div>
                <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
                  POST {window?.location?.origin || ''}/mcp
                </code>
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <strong>Thêm vào Claude Code:</strong>
                <pre
                  style={{
                    background: 'var(--bg-subtle)',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    marginTop: '0.25rem',
                    overflowX: 'auto'
                  }}
                >
                  claude mcp add --transport http bityping {window?.location?.origin || 'http://localhost:5173'}/mcp
                </pre>
              </div>

              <div>
                <strong>Hoặc chạy qua stdio wrapper:</strong>
                <pre
                  style={{
                    background: 'var(--bg-subtle)',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    marginTop: '0.25rem',
                    overflowX: 'auto'
                  }}
                >
                  node scripts/mcp-stdio.mjs
                </pre>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer add-modal-footer">
          <button className="btn btn-secondary stage-action-btn" onClick={onClose}>
            Đóng
          </button>
          {activeTab === 'editor' && (
            <button
              className="btn btn-primary stage-action-btn"
              disabled={!validationResult?.valid || isSaving}
              onClick={handleSave}
            >
              {isSaving ? 'Đang lưu…' : 'Lưu vào kho bài học'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
