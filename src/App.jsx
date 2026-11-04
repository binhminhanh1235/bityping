import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { Header } from './components/Header.jsx';
import { BilingualStage } from './components/BilingualStage.jsx';
import { TopicPopover } from './components/TopicPopover.jsx';
import { AddModal } from './components/AddModal.jsx';
import { ManageModal } from './components/ManageModal.jsx';
import { SettingsModal } from './components/SettingsModal.jsx';
import { getStarterPacks } from './data/starterPacks.js';
import { createTypingState } from './lib/typingEngine.js';
import { pickNextCard } from './lib/picker.js';
import { speakEnglish } from './lib/speech.js';
import { getSessionStats, getCardHistory, recordCardCompletion } from './lib/stats.js';
import { fetchPacks, syncStorages } from './lib/api.js';

const SETTINGS_KEY = 'bityping_settings';
const TOPIC_KEY = 'bityping_selected_topic';
const THEME_KEY = 'bityping_theme';

const DEFAULT_SETTINGS = {
  ignoreCase: true,
  ignorePunctuation: true,
  errorMode: 'backspace',
  autoNext: false,
  prioritizeWeak: false,
  memoryMode: false,
  autoSpeakOnStart: false,
  autoSpeakOnEnd: false,
  voiceURI: '',
  speechRate: 1.0
};

export function App() {
  // Theme Dark / Light
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem(THEME_KEY) || 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {}
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Cài đặt
  const [settings, setSettings] = useState(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {}
    return DEFAULT_SETTINGS;
  });

  const updateSettings = (newPartial) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newPartial };
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Thống kê
  const [sessionStats, setSessionStats] = useState(getSessionStats);
  const [cardHistory, setCardHistory] = useState(getCardHistory);

  // Danh sách Pack và Topic
  const [packs, setPacks] = useState(() => getStarterPacks());
  const [selectedTopic, setSelectedTopic] = useState(() => {
    try {
      return localStorage.getItem(TOPIC_KEY) || 'all';
    } catch {
      return 'all';
    }
  });

  // Modals & Popover
  const [activeModal, setActiveModal] = useState(null); // 'add' | 'manage' | 'settings' | null
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  // Thẻ hiện tại & Typing State
  const [recentCardIds, setRecentCardIds] = useState([]);
  const [currentCard, setCurrentCard] = useState(null);
  const [typingState, setTypingState] = useState(null);

  // Trạng thái đồng bộ lưu trữ
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState('');

  // Load packs từ server, kết hợp starter packs nếu server chưa có
  const loadPacks = useCallback(async () => {
    try {
      const res = await fetchPacks({ all: true });
      const serverPacks = res.packs || [];
      if (serverPacks.length > 0) {
        setPacks(serverPacks);
      } else {
        setPacks(getStarterPacks());
      }
    } catch {
      setPacks(getStarterPacks());
    }
  }, []);

  const handleSync = useCallback(async () => {
    setIsSyncing(true);
    setSyncStatusMsg('Đang đồng bộ...');
    try {
      const res = await syncStorages();
      if (res.success) {
        setSyncStatusMsg(`Đã đồng bộ ${res.syncedCount} bài học`);
        await loadPacks();
      } else {
        setSyncStatusMsg(`Lỗi đồng bộ: ${res.error || 'Thất bại'}`);
      }
    } catch (err) {
      setSyncStatusMsg(`Lỗi đồng bộ: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  }, [loadPacks]);

  useEffect(() => {
    loadPacks();
  }, [loadPacks]);

  // Tính danh sách topics
  const topics = (() => {
    const map = new Map();
    for (const p of packs) {
      const t = p.topic || 'General';
      const count = (p.cards || []).length;
      map.set(t, (map.get(t) || 0) + count);
    }
    const list = [];
    for (const [topic, cardCount] of map.entries()) {
      list.push({ topic, cardCount });
    }
    return list;
  })();

  // Hàm chuyển sang thẻ kế tiếp
  const nextCard = useCallback(() => {
    const { card, recentCardIds: newRecent } = pickNextCard({
      packs,
      selectedTopics: selectedTopic,
      recentCardIds,
      prioritizeWeak: settings.prioritizeWeak,
      cardHistory
    });

    if (!card) return;

    setCurrentCard(card);
    setRecentCardIds(newRecent);

    const newState = createTypingState(card.en, card.links, {
      ignoreCase: settings.ignoreCase,
      ignorePunctuation: settings.ignorePunctuation,
      errorMode: settings.errorMode
    });
    setTypingState(newState);

    if (settings.autoSpeakOnStart) {
      speakEnglish(card.en, {
        voiceURI: settings.voiceURI,
        rate: settings.speechRate
      });
    }
  }, [packs, selectedTopic, recentCardIds, settings, cardHistory]);

  // Khởi tạo thẻ đầu tiên khi packs hoặc topic thay đổi
  useEffect(() => {
    if (packs.length > 0 && !currentCard) {
      nextCard();
    }
  }, [packs, currentCard, nextCard]);

  // Khi chọn chủ đề mới
  const handleSelectTopic = (topic) => {
    setSelectedTopic(topic);
    try {
      localStorage.setItem(TOPIC_KEY, topic);
    } catch {}
    // Reset thẻ hiện tại để bốc thẻ mới trong chủ đề
    setCurrentCard(null);
    setRecentCardIds([]);
  };

  // Gõ lại thẻ hiện tại
  const restartCard = () => {
    if (!currentCard) return;
    const newState = createTypingState(currentCard.en, currentCard.links, {
      ignoreCase: settings.ignoreCase,
      ignorePunctuation: settings.ignorePunctuation,
      errorMode: settings.errorMode
    });
    setTypingState(newState);
  };

  // Phát âm thanh
  const playSpeech = () => {
    if (!currentCard) return;
    speakEnglish(currentCard.en, {
      voiceURI: settings.voiceURI,
      rate: settings.speechRate
    });
  };

  // Ghi nhận hoàn thành thẻ
  const handleRecordStats = (cardId, metrics) => {
    const updated = recordCardCompletion(cardId, metrics);
    setSessionStats(updated.session);
    setCardHistory(updated.cardHistory);

    if (settings.autoSpeakOnEnd && currentCard) {
      speakEnglish(currentCard.en, {
        voiceURI: settings.voiceURI,
        rate: settings.speechRate
      });
    }
  };

  // Lắng nghe phím tắt toàn cục
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Phím Esc
      if (e.key === 'Escape') {
        if (activeModal) {
          setActiveModal(null);
          return;
        }
        setIsPopoverOpen((prev) => !prev);
        return;
      }

      // Ctrl+P hoặc Cmd+J đọc âm thanh
      if ((e.ctrlKey && e.key.toLowerCase() === 'p') || (e.metaKey && e.key.toLowerCase() === 'j')) {
        e.preventDefault();
        playSpeech();
        return;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [activeModal, currentCard, settings]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      {/* Header mảnh */}
      <Header
        topics={topics}
        selectedTopic={selectedTopic}
        onSelectTopic={handleSelectTopic}
        sessionStats={sessionStats}
        theme={theme}
        onToggleTheme={toggleTheme}
        autoNext={settings.autoNext}
        onToggleAutoNext={() => updateSettings({ autoNext: !settings.autoNext })}
        prioritizeWeak={settings.prioritizeWeak}
        onTogglePrioritizeWeak={() => updateSettings({ prioritizeWeak: !settings.prioritizeWeak })}
        onOpenAddModal={() => setActiveModal('add')}
        onOpenManageModal={() => setActiveModal('manage')}
        onOpenSettingsModal={() => setActiveModal('settings')}
        onToggleTopicPopover={() => setIsPopoverOpen((prev) => !prev)}
        isPopoverOpen={isPopoverOpen}
        onPlaySpeech={playSpeech}
        onSync={handleSync}
        isSyncing={isSyncing}
        syncStatusMsg={syncStatusMsg}
      />

      {/* Popover Chủ đề */}
      <TopicPopover
        isOpen={isPopoverOpen}
        onClose={() => setIsPopoverOpen(false)}
        topics={topics}
        selectedTopic={selectedTopic}
        onSelectTopic={handleSelectTopic}
      />

      {/* Màn hình gõ chính */}
      {currentCard && typingState ? (
        <BilingualStage
          card={currentCard}
          typingState={typingState}
          setTypingState={setTypingState}
          onNextCard={nextCard}
          onSkipCard={nextCard}
          onRestartCard={restartCard}
          onPlaySpeech={playSpeech}
          autoNext={settings.autoNext}
          memoryMode={settings.memoryMode}
          onRecordStats={handleRecordStats}
        />
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
          Đang chuẩn bị thẻ bài học…
        </div>
      )}

      {/* Footer phím tắt */}
      <footer className="app-footer">
        <span>
          <kbd>Enter</kbd> Thẻ kế tiếp
        </span>
        <span>
          <kbd>Ctrl</kbd>+<kbd>Enter</kbd> Bỏ qua thẻ
        </span>
        <span>
          <kbd>Tab</kbd> / <kbd>Ctrl</kbd>+<kbd>⌫</kbd> Gõ lại từ đầu
        </span>
        <span>
          <kbd>Ctrl</kbd>+<kbd>P</kbd> Nghe phát âm
        </span>
        <span>
          <kbd>Esc</kbd> Chọn chủ đề
        </span>
      </footer>

      {/* Modals */}
      <AddModal
        isOpen={activeModal === 'add'}
        onClose={() => setActiveModal(null)}
        onPackSaved={() => {
          loadPacks();
        }}
      />

      <ManageModal
        isOpen={activeModal === 'manage'}
        onClose={() => setActiveModal(null)}
        onPacksChanged={() => {
          loadPacks();
        }}
        onSync={handleSync}
        isSyncing={isSyncing}
      />

      <SettingsModal
        isOpen={activeModal === 'settings'}
        onClose={() => setActiveModal(null)}
        settings={settings}
        onUpdateSettings={updateSettings}
        onResetStats={() => setSessionStats(getSessionStats())}
        onSync={handleSync}
        isSyncing={isSyncing}
      />
    </div>
  );
}
