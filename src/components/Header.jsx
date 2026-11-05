import { useState } from 'preact/hooks';

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
  onPlaySpeech,
  onSync,
  isSyncing = false,
  syncStatusMsg = ''
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <header className="app-header">
      <div className="header-left">
        <div className="brand">
          <span className="brand-dot"></span>
          <span className="brand-logo">BiTyping</span>
          <span className="brand-badge desktop-only">Song ngữ</span>
        </div>

        {/* Topic Chips (Desktop / Tablet) */}
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
          aria-label="Chọn chủ đề"
        >
          <span>Chủ đề</span>
          <kbd className="desktop-only">Esc</kbd>
          <span className="mobile-only" style={{ fontSize: '0.65rem' }}>▾</span>
        </button>
      </div>

      {/* Header Right - Desktop Actions */}
      <div className="header-right desktop-header-right">
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
          aria-label="Tự chuyển thẻ"
        >
          ⚡
        </button>

        <button
          className={`icon-btn ${prioritizeWeak ? 'active' : ''}`}
          onClick={onTogglePrioritizeWeak}
          title={prioritizeWeak ? 'Ưu tiên thẻ yếu: BẬT' : 'Ưu tiên thẻ yếu: TẮT'}
          aria-label="Ưu tiên thẻ yếu"
        >
          🎯
        </button>

        <button
          className="icon-btn"
          onClick={onPlaySpeech}
          title="Đọc phát âm tiếng Anh (Ctrl+P)"
          aria-label="Đọc phát âm tiếng Anh"
        >
          🔊
        </button>

        <button
          className="icon-btn"
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Chuyển sang chế độ Sáng' : 'Chuyển sang chế độ Tối'}
          aria-label="Đổi giao diện sáng/tối"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>

        {/* Modal Triggers */}
        <button
          className={`icon-btn ${isSyncing ? 'spinning' : ''}`}
          onClick={onSync}
          title={isSyncing ? 'Đang đồng bộ...' : (syncStatusMsg || 'Đồng bộ hai chiều các kho lưu trữ (Local / GitHub / EdgeOne)')}
          disabled={isSyncing}
          aria-label="Đồng bộ kho lưu trữ"
        >
          🔄
        </button>
        <button className="btn btn-primary" onClick={onOpenAddModal} style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem' }}>
          + Thêm thẻ
        </button>
        <button className="btn btn-secondary" onClick={onOpenManageModal} style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem' }}>
          Quản lý
        </button>
        <button className="icon-btn" onClick={onOpenSettingsModal} title="Cài đặt" aria-label="Cài đặt">
          ⚙️
        </button>
      </div>

      {/* Header Right - Mobile Header Bar */}
      <div className="header-right mobile-header-right">
        {/* Compact stats pill */}
        <div className="session-stats-compact" title={`Đã gõ ${sessionStats.cardsCompleted || 0} thẻ, Chuỗi: ${sessionStats.currentStreak || 0}, WPM: ${sessionStats.avgWpm || 0}, Acc: ${sessionStats.avgAccuracy ?? 100}%`}>
          {sessionStats.currentStreak > 0 && <span className="streak-badge">🔥{sessionStats.currentStreak}</span>}
          <span><strong>{sessionStats.avgWpm || 0}</strong> WPM</span>
          <span className="stat-acc-pill">{sessionStats.avgAccuracy ?? 100}%</span>
        </div>

        <button
          className="icon-btn mobile-theme-btn"
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Chế độ Sáng' : 'Chế độ Tối'}
          aria-label="Đổi giao diện sáng/tối"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>

        <button
          className={`icon-btn mobile-menu-toggle ${isMobileMenuOpen ? 'active' : ''}`}
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          title="Mở menu tuỳ chọn"
          aria-label="Menu tuỳ chọn"
          aria-expanded={isMobileMenuOpen}
        >
          {isMobileMenuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile Drawer / Dropdown Menu */}
      {isMobileMenuOpen && (
        <>
          <div className="mobile-menu-backdrop" onClick={closeMobileMenu} />
          <div className="mobile-menu-drawer">
            <div className="mobile-menu-section-title">CHỈ SỐ PHIÊN</div>
            <div className="mobile-stats-grid">
              <div className="mobile-stat-cell">
                <span className="stat-label">Thẻ hoàn thành</span>
                <span className="stat-value">{sessionStats.cardsCompleted || 0}</span>
              </div>
              <div className="mobile-stat-cell">
                <span className="stat-label">Chuỗi chuẩn xác</span>
                <span className="stat-value">🔥 {sessionStats.currentStreak || 0}</span>
              </div>
              <div className="mobile-stat-cell">
                <span className="stat-label">Tốc độ trung bình</span>
                <span className="stat-value">{sessionStats.avgWpm || 0} WPM</span>
              </div>
              <div className="mobile-stat-cell">
                <span className="stat-label">Độ chính xác</span>
                <span className="stat-value">{sessionStats.avgAccuracy ?? 100}%</span>
              </div>
            </div>

            <div className="mobile-menu-section-title">TUỲ CHỌN NHANH</div>
            <div className="mobile-toggles-list">
              <button
                className={`mobile-menu-item ${autoNext ? 'active-toggle' : ''}`}
                onClick={onToggleAutoNext}
              >
                <span>⚡ Tự chuyển thẻ (1.2s)</span>
                <span className="toggle-state-badge">{autoNext ? 'BẬT' : 'TẮT'}</span>
              </button>

              <button
                className={`mobile-menu-item ${prioritizeWeak ? 'active-toggle' : ''}`}
                onClick={onTogglePrioritizeWeak}
              >
                <span>🎯 Ưu tiên ôn thẻ yếu</span>
                <span className="toggle-state-badge">{prioritizeWeak ? 'BẬT' : 'TẮT'}</span>
              </button>

              <button
                className="mobile-menu-item"
                onClick={() => {
                  onPlaySpeech();
                  closeMobileMenu();
                }}
              >
                <span>🔊 Nghe phát âm câu này</span>
                <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>Ctrl+P</span>
              </button>

              <button
                className={`mobile-menu-item ${isSyncing ? 'spinning' : ''}`}
                onClick={async () => {
                  if (onSync) await onSync();
                }}
                disabled={isSyncing}
              >
                <span>🔄 Đồng bộ kho (Local / GH / EO)</span>
                <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                  {isSyncing ? 'Sync...' : (syncStatusMsg ? '✓' : 'Sync')}
                </span>
              </button>
            </div>

            <div className="mobile-menu-section-title">QUẢN LÝ BÀI HỌC</div>
            <div className="mobile-actions-list">
              <button
                className="btn btn-primary mobile-action-btn"
                onClick={() => {
                  closeMobileMenu();
                  onOpenAddModal();
                }}
              >
                ➕ Thêm thẻ bài học mới
              </button>
              <button
                className="btn btn-secondary mobile-action-btn"
                onClick={() => {
                  closeMobileMenu();
                  onOpenManageModal();
                }}
              >
                🗂️ Quản lý kho bài học
              </button>
              <button
                className="btn btn-secondary mobile-action-btn"
                onClick={() => {
                  closeMobileMenu();
                  onOpenSettingsModal();
                }}
              >
                ⚙️ Cài đặt hệ thống & Storage
              </button>
            </div>
          </div>
        </>
      )}
    </header>
  );
}
