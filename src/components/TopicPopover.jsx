export function TopicPopover({
  isOpen,
  onClose,
  topics = [],
  selectedTopic = 'all',
  onSelectTopic
}) {
  if (!isOpen) return null;

  return (
    <>
      <div
        className="popover-backdrop"
        style={{ position: 'fixed', inset: 0, zIndex: 99, background: 'transparent' }}
        onClick={onClose}
      />
      <div className="popover-menu" style={{ zIndex: 100 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '0.25rem 0.5rem 0.5rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          CHỌN CHỦ ĐỀ
        </div>
        <div
          className={`popover-item ${selectedTopic === 'all' ? 'selected' : ''}`}
          onClick={() => {
            onSelectTopic('all');
            onClose();
          }}
        >
          <span>Tất cả chủ đề</span>
          {selectedTopic === 'all' && <span>✓</span>}
        </div>
        {topics.map((t) => {
          const isSel = selectedTopic.toLowerCase() === t.topic.toLowerCase();
          return (
            <div
              key={t.topic}
              className={`popover-item ${isSel ? 'selected' : ''}`}
              onClick={() => {
                onSelectTopic(t.topic);
                onClose();
              }}
            >
              <span>{t.topic}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {t.cardCount} thẻ {isSel ? '✓' : ''}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}
