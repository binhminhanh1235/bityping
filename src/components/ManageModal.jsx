import { useState, useEffect } from 'preact/hooks';
import { fetchPacks, fetchPackById, deletePack, deleteCard, exportAllMarkdown } from '../lib/api.js';

export function ManageModal({ isOpen, onClose, onPacksChanged }) {
  if (!isOpen) return null;

  const [packs, setPacks] = useState([]);
  const [selectedPackId, setSelectedPackId] = useState(null);
  const [selectedPackData, setSelectedPackData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmDeletePackId, setConfirmDeletePackId] = useState(null);

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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '820px', height: '80vh' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h3 className="modal-title">Quản Lý Gói Bài Học</h3>
            <button
              className="btn btn-secondary"
              style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
              onClick={handleExportAll}
              title="Tải về file Markdown sao lưu toàn bộ thẻ"
            >
              📥 Xuất tất cả (.md)
            </button>
          </div>
          <button className="icon-btn" onClick={onClose} title="Đóng (Esc)">
            ✕
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', gap: '1rem', padding: 0 }}>
          {/* Cột trái: Danh sách pack */}
          <div
            style={{
              width: '260px',
              borderRight: '1px solid var(--border-subtle)',
              overflowY: 'auto',
              padding: '0.75rem'
            }}
          >
            {isLoading ? (
              <div style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                Đang tải…
              </div>
            ) : packs.length === 0 ? (
              <div style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                Chưa có pack nào trên server (đang dùng Starter Pack mặc định).
              </div>
            ) : (
              packs.map((p) => {
                const isSel = p.id === selectedPackId;
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPackId(p.id)}
                    style={{
                      padding: '0.6rem 0.75rem',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      marginBottom: '0.4rem',
                      backgroundColor: isSel ? 'var(--accent-muted)' : 'transparent',
                      border: isSel ? '1px solid var(--accent)' : '1px solid transparent',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', color: isSel ? 'var(--accent)' : 'inherit' }}>
                      {p.topic}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                      <span>{p.cardCount} thẻ</span>
                      {p.level && <span>{p.level}</span>}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Cột phải: Chi tiết các thẻ trong pack */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
            {selectedPackData ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{selectedPackData.topic}</h4>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                      ID: {selectedPackData.id} • {selectedPackData.cards?.length || 0} thẻ
                      {selectedPackData.tags?.length > 0 && ` • [${selectedPackData.tags.join(', ')}]`}
                    </div>
                  </div>

                  <div>
                    {confirmDeletePackId === selectedPackData.id ? (
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          className="btn btn-danger"
                          style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                          onClick={() => handleDeletePack(selectedPackData.id)}
                        >
                          Xác nhận xoá
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                          onClick={() => setConfirmDeletePackId(null)}
                        >
                          Huỷ
                        </button>
                      </div>
                    ) : (
                      <button
                        className="btn btn-danger"
                        style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                        onClick={() => setConfirmDeletePackId(selectedPackData.id)}
                      >
                        🗑 Xoá cả pack
                      </button>
                    )}
                  </div>
                </div>

                {/* Danh sách thẻ */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {(selectedPackData.cards || []).map((c, idx) => (
                    <div
                      key={c.id || idx}
                      style={{
                        padding: '0.85rem 1rem',
                        borderRadius: '10px',
                        backgroundColor: 'var(--bg-subtle)',
                        border: '1px solid var(--border-subtle)',
                        position: 'relative'
                      }}
                    >
                      <button
                        style={{
                          position: 'absolute',
                          top: '0.6rem',
                          right: '0.6rem',
                          color: 'var(--text-secondary)',
                          fontSize: '0.8rem',
                          padding: '0.2rem 0.4rem'
                        }}
                        onClick={() => handleDeleteCard(c.id)}
                        title="Xoá thẻ này"
                      >
                        ✕
                      </button>

                      <div style={{ fontSize: '0.9375rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                        {c.vi}
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', color: 'var(--accent)', marginBottom: '0.35rem' }}>
                        {c.en}
                      </div>
                      {c.note && (
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                          💡 {c.note}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Chọn một pack ở danh sách bên trái để xem và quản lý các thẻ.
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
