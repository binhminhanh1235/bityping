export function Header({
  topics = [],
  selectedTopic = 'all',
  onSelectTopic,
  sessionStats = {},
  theme = 'dark',
  onToggleTheme,
  autoNext = false,
  onToggleAutoNext,
  prioritizeWeak = false,
  onTogglePrioritizeWeak,
  onOpenAddModal,
  onOpenManageModal,
  onOpenSettingsModal,
  onToggleTopicPopover,
  isPopoverOpen = false,
  onPlaySpeech
}) {
  return (
    <header className="app-header">
      <div className="header-left">
        <div className="brand">
          <span className="brand-dot"></span>
          <span className="brand-logo">BiTyping</span>
          <span className="brand-badge">Song ngữ</span>
        </div>

        {/* Topic Chips */}
        <div className="topic-chips-wrapper">
          <button
            className={`topic-chip ${selectedTopic === 'all' ? 'active' : ''}`}
            onClick={() => onSelectTopic('all')}
          >
            Tất cả
          </button>
          {topics.map((t) => (
            <button
              key={t.topic}
              className={`topic-chip ${selectedTopic.toLowerCase() === t.topic.toLowerCase() ? 'active' : ''}`}
              onClick={() => onSelectTopic(t.topic)}
              title={`${t.cardCount} thẻ`}
            >
              {t.topic} ({t.cardCount})
            </button>
          ))}
        </div>

        <button
          className={`topic-picker-btn ${isPopoverOpen ? 'active' : ''}`}
          onClick={onToggleTopicPopover}
          title="Chọn chủ đề (Esc)"
        >
          <span>Chủ đề</span>
          <kbd>Esc</kbd>
        </button>
      </div>

      <div className="header-right">
        {/* Session Stats */}
        <div className="session-stats">
          <span>
            Thẻ: <strong>{sessionStats.cardsCompleted || 0}</strong>
          </span>
          {sessionStats.currentStreak > 0 && (
            <span className="streak-badge" title="Chuỗi thẻ đạt độ chính xác ≥ 90%">
              🔥 {sessionStats.currentStreak}
            </span>
          )}
          <span>
            WPM: <strong>{sessionStats.avgWpm || 0}</strong>
          </span>
          <span>
            Acc: <strong>{sessionStats.avgAccuracy ?? 100}%</strong>
          </span>
        </div>

        {/* Quick Toggles */}
        <button
          className={`icon-btn ${autoNext ? 'active' : ''}`}
          onClick={onToggleAutoNext}
          title={autoNext ? 'Tự chuyển thẻ (1.2s): BẬT' : 'Tự chuyển thẻ (1.2s): TẮT'}
        >
          ⚡
        </button>

        <button
          className={`icon-btn ${prioritizeWeak ? 'active' : ''}`}
          onClick={onTogglePrioritizeWeak}
          title={prioritizeWeak ? 'Ưu tiên thẻ yếu: BẬT' : 'Ưu tiên thẻ yếu: TẮT'}
        >
          🎯
        </button>

        <button
          className="icon-btn"
          onClick={onPlaySpeech}
          title="Đọc phát âm tiếng Anh (Ctrl+P)"
        >
          🔊
        </button>

        <button
          className="icon-btn"
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Chuyển sang chế độ Sáng' : 'Chuyển sang chế độ Tối'}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>

        {/* Modal Triggers */}
        <button className="btn btn-primary" onClick={onOpenAddModal} style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem' }}>
          + Thêm thẻ
        </button>
        <button className="btn btn-secondary" onClick={onOpenManageModal} style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem' }}>
          Quản lý
        </button>
        <button className="icon-btn" onClick={onOpenSettingsModal} title="Cài đặt">
          ⚙️
        </button>
      </div>
    </header>
  );
}
