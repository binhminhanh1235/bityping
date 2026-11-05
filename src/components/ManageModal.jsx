import { useState, useEffect } from 'preact/hooks';
import { fetchPacks, fetchPackById, deletePack, deleteCard, exportAllMarkdown } from '../lib/api.js';

export function ManageModal({ isOpen, onClose, onPacksChanged, onSync, isSyncing = false }) {
  if (!isOpen) return null;

  const [packs, setPacks] = useState([]);
  const [selectedPackId, setSelectedPackId] = useState(null);
  const [selectedPackData, setSelectedPackData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmDeletePackId, setConfirmDeletePackId] = useState(null);
  const [mobileTab, setMobileTab] = useState('packs'); // 'packs' | 'cards'

  // Load danh sách pack
  const loadPacks = async () => {
    setIsLoading(true);
    const res = await fetchPacks();
    const list = res.packs || [];
    setPacks(list);
    if (list.length > 0 && !selectedPackId) {
      setSelectedPackId(list[0].id);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadPacks();
  }, []);

  // Load chi tiết pack đang chọn
  useEffect(() => {
    if (!selectedPackId) {
      setSelectedPackData(null);
      return;
    }
    let isCurrent = true;
    fetchPackById(selectedPackId).then((pack) => {
      if (isCurrent) {
        setSelectedPackData(pack);
      }
    });
    return () => {
      isCurrent = false;
    };
  }, [selectedPackId]);

  // Xoá 1 thẻ lẻ
  const handleDeleteCard = async (cardId) => {
    if (!window.confirm('Bạn có chắc muốn xoá thẻ này không?')) return;

    const res = await deleteCard(selectedPackId, cardId);
    if (res.success) {
      if (res.packDeleted) {
        // Nếu pack đã bị xoá luôn do hết thẻ
        setSelectedPackId(null);
        setSelectedPackData(null);
        setMobileTab('packs');
      } else {
        // Cập nhật lại pack data
        setSelectedPackData((prev) => ({
          ...prev,
          cards: (prev.cards || []).filter((c) => c.id !== cardId)
        }));
      }
      loadPacks();
      if (onPacksChanged) onPacksChanged();
    }
  };

  // Xoá nguyên pack
  const handleDeletePack = async (packId) => {
    const res = await deletePack(packId);
    if (res.success) {
      setConfirmDeletePackId(null);
      setSelectedPackId(null);
      setSelectedPackData(null);
      setMobileTab('packs');
      await loadPacks();
      if (onPacksChanged) onPacksChanged();
    }
  };

  // Xuất file Markdown
  const handleExportAll = async () => {
    const md = await exportAllMarkdown();
    if (!md) {
      alert('Không có nội dung để xuất hoặc lỗi kết nối');
      return;
    }
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bityping-export-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSelectPack = (packId) => {
    setSelectedPackId(packId);
    setMobileTab('cards');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content manage-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header manage-modal-header">
          <div className="manage-header-titles">
            <h3 className="modal-title">Quản Lý Gói Bài Học</h3>
            <div className="manage-header-actions">
              {onSync && (
                <button
                  className="btn btn-secondary manage-sync-btn"
                  onClick={async () => {
                    await onSync();
                    await loadPacks();
                  }}
                  disabled={isSyncing}
                  title="Đồng bộ hai chiều giữa Local, GitHub Gist và EdgeOne"
                  aria-label="Đồng bộ kho lưu trữ"
                >
                  <span className={isSyncing ? 'spinning' : ''}>🔄</span>
                  <span className="desktop-btn-label">{isSyncing ? 'Đang sync...' : 'Đồng bộ'}</span>
                </button>
              )}
              <button
                className="btn btn-secondary manage-export-btn"
                onClick={handleExportAll}
                title="Tải về file Markdown sao lưu toàn bộ thẻ"
                aria-label="Xuất file Markdown"
              >
                <span>📥</span>
                <span className="desktop-btn-label">Xuất (.md)</span>
              </button>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} title="Đóng (Esc)" aria-label="Đóng cửa sổ">
            ✕
          </button>
        </div>

        {/* Mobile Tab Switcher */}
        <div className="manage-mobile-tabs">
          <button
            className={`manage-tab-btn ${mobileTab === 'packs' ? 'active' : ''}`}
            onClick={() => setMobileTab('packs')}
          >
            📂 Danh sách gói ({packs.length})
          </button>
          <button
            className={`manage-tab-btn ${mobileTab === 'cards' ? 'active' : ''}`}
            onClick={() => setMobileTab('cards')}
            disabled={!selectedPackData}
          >
            📋 Chi tiết thẻ ({selectedPackData?.cards?.length || 0})
          </button>
        </div>

        <div className="modal-body manage-modal-body">
          {/* Cột trái: Danh sách pack */}
          <div className={`manage-sidebar ${mobileTab === 'cards' ? 'mobile-hidden' : ''}`}>
            {isLoading ? (
              <div className="manage-loading-state">Đang tải…</div>
            ) : packs.length === 0 ? (
              <div className="manage-empty-state">
                Chưa có pack nào trên server (đang dùng Starter Pack mặc định).
              </div>
            ) : (
              packs.map((p) => {
                const isSel = p.id === selectedPackId;
                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelectPack(p.id)}
                    className={`manage-pack-item ${isSel ? 'selected' : ''}`}
                  >
                    <div className="manage-pack-title">{p.topic}</div>
                    <div className="manage-pack-meta">
                      <span>{p.cardCount || (p.cards || []).length} thẻ</span>
                      <div className="manage-pack-badges">
                        {p.sources && p.sources.map((src) => (
                          <span key={src} className={`source-badge badge-${src}`}>
                            {src === 'local' ? 'Local' : src === 'gist' ? 'GH' : 'EO'}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Cột phải: Chi tiết các thẻ trong pack */}
          <div className={`manage-main ${mobileTab === 'packs' ? 'mobile-hidden' : ''}`}>
            {/* Mobile back button to packs */}
            <div className="manage-mobile-back">
              <button
                className="btn btn-secondary"
                onClick={() => setMobileTab('packs')}
                style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', minHeight: '38px' }}
              >
                ← Chọn gói khác
              </button>
            </div>

            {selectedPackData ? (
              <div>
                <div className="manage-pack-header">
                  <div className="manage-pack-header-info">
                    <div className="manage-pack-header-title-row">
                      <h4 className="manage-pack-header-title">{selectedPackData.topic}</h4>
                      {selectedPackData.sources && selectedPackData.sources.map((src) => (
                        <span key={src} className={`source-badge badge-${src}`}>
                          {src === 'local' ? 'Local' : src === 'gist' ? 'GitHub' : 'EdgeOne'}
                        </span>
                      ))}
                    </div>
                    <div className="manage-pack-header-sub">
                      ID: {selectedPackData.id} • {selectedPackData.cards?.length || 0} thẻ
                      {selectedPackData.tags?.length > 0 && ` • [${selectedPackData.tags.join(', ')}]`}
                    </div>
                  </div>

                  <div className="manage-pack-header-actions">
                    {confirmDeletePackId === selectedPackData.id ? (
                      <div className="manage-confirm-row">
                        <button
                          className="btn btn-danger stage-action-btn"
                          onClick={() => handleDeletePack(selectedPackData.id)}
                        >
                          Xác nhận xoá
                        </button>
                        <button
                          className="btn btn-secondary stage-action-btn"
                          onClick={() => setConfirmDeletePackId(null)}
                        >
                          Huỷ
                        </button>
                      </div>
                    ) : (
                      <button
                        className="btn btn-danger stage-action-btn"
                        onClick={() => setConfirmDeletePackId(selectedPackData.id)}
                        title="Xoá gói này khỏi kho"
                      >
                        🗑 Xoá cả pack
                      </button>
                    )}
                  </div>
                </div>

                {/* Danh sách thẻ */}
                <div className="manage-cards-list">
                  {(selectedPackData.cards || []).map((c, idx) => (
                    <div key={c.id || idx} className="manage-card-box">
                      <button
                        className="manage-delete-card-btn"
                        onClick={() => handleDeleteCard(c.id)}
                        title="Xoá thẻ này"
                        aria-label="Xoá thẻ"
                      >
                        ✕
                      </button>

                      <div className="manage-card-vi">{c.vi}</div>
                      <div className="manage-card-en">{c.en}</div>
                      {c.note && <div className="manage-card-note">💡 {c.note}</div>}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="manage-select-prompt">
                Chọn một pack ở danh sách bên trái để xem và quản lý các thẻ.
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary stage-action-btn" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
