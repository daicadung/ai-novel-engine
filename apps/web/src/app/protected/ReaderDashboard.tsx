'use client'

import { useState } from 'react'
import styles from './page.module.css'

interface Chapter {
  chapter_number: number
  title: string
  content: string
  summary: string
}

interface Character {
  name: string
  role: string
  description: string
}

interface WorldRule {
  category: string
  rule_name: string
  description: string
}

interface DashboardProps {
  novel: { title: string; status: string; target_chapter_count: number }
  chapters: Chapter[]
  characters: Character[]
  worldRules: WorldRule[]
  userEmail: string
}

export default function ReaderDashboard({ novel, chapters, characters, worldRules, userEmail }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<'reader' | 'characters' | 'world'>('reader')
  const [activeChapterIndex, setActiveChapterIndex] = useState(0)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const activeChapter = chapters[activeChapterIndex]

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.headerTitle}>{novel.title}</h1>
          <p className={styles.headerSubtitle}>
            {chapters.length} / {novel.target_chapter_count} Chương • Đang đăng nhập: {userEmail}
          </p>
        </div>
        <div>
          <button 
            className={styles.mobileMenuToggle}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? 'Đóng Menu' : '☰ Chọn Chương'}
          </button>
          <span className={styles.cardMeta} style={{ marginBottom: 0, display: 'inline-block', marginLeft: '1rem' }}>{novel.status}</span>
        </div>
      </header>

      <main className={styles.main}>
        {/* Sidebar */}
        <aside className={`${styles.sidebar} ${isMobileMenuOpen ? styles.mobileOpen : ''}`}>
          <div className={styles.sidebarSection}>
            <h2 className={styles.sidebarTitle}>Danh sách chương</h2>
            {chapters.length > 0 ? (
              <ul className={styles.chapterList}>
                {chapters.map((chapter, index) => (
                  <li
                    key={chapter.chapter_number}
                    className={`${styles.chapterItem} ${index === activeChapterIndex ? styles.chapterItemActive : ''}`}
                    onClick={() => {
                      setActiveTab('reader')
                      setActiveChapterIndex(index)
                    }}
                  >
                    <span className={styles.chapterName}>Chương {chapter.chapter_number}: {chapter.title}</span>
                    <span className={styles.chapterSummary}>{chapter.summary}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.cardDesc}>Chưa có chương nào được tạo.</p>
            )}
          </div>
        </aside>

        {/* Content Area */}
        <section className={styles.contentArea}>
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === 'reader' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('reader')}
            >
              📖 Đọc Truyện
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'characters' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('characters')}
            >
              👥 Hồ Sơ Nhân Vật
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'world' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('world')}
            >
              🌍 Bối Cảnh Thế Giới
            </button>
          </div>

          {activeTab === 'reader' && (
            <div className={styles.reader}>
              {activeChapter ? (
                <>
                  <h2 className={styles.readerTitle}>Chương {activeChapter.chapter_number}: {activeChapter.title}</h2>
                  <div className={styles.readerSummary}>
                    <strong>Tóm tắt AI:</strong> {activeChapter.summary}
                  </div>
                  <div className={styles.readerText}>
                    {activeChapter.content}
                  </div>
                  
                  <div className={styles.navControls}>
                    <button 
                      className={`${styles.navButton} ${activeChapterIndex === 0 ? styles.navButtonDisabled : ''}`}
                      onClick={() => setActiveChapterIndex(Math.max(0, activeChapterIndex - 1))}
                      disabled={activeChapterIndex === 0}
                    >
                      ← Chương Trước
                    </button>
                    <button 
                      className={`${styles.navButton} ${activeChapterIndex === chapters.length - 1 ? styles.navButtonDisabled : ''}`}
                      onClick={() => setActiveChapterIndex(Math.min(chapters.length - 1, activeChapterIndex + 1))}
                      disabled={activeChapterIndex === chapters.length - 1}
                    >
                      Chương Tiếp →
                    </button>
                  </div>
                </>
              ) : (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>📝</div>
                  <h2>Truyện đang được AI viết...</h2>
                  <p>Các chương sẽ xuất hiện ở đây sau khi AI hoàn thành.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'characters' && (
            <div className={styles.grid}>
              {characters.length > 0 ? (
                characters.map((char, i) => (
                  <div key={i} className={styles.card}>
                    <span className={styles.cardMeta}>{char.role}</span>
                    <h3 className={styles.cardTitle}>{char.name}</h3>
                    <p className={styles.cardDesc}>{char.description}</p>
                  </div>
                ))
              ) : (
                <div className={styles.emptyState} style={{ gridColumn: '1 / -1' }}>
                  <p>Chưa có dữ liệu nhân vật.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'world' && (
            <div className={styles.reader}>
              {worldRules.length > 0 ? (
                worldRules.map((rule, i) => (
                  <div key={i} className={styles.worldRule}>
                    <span className={styles.cardMeta}>{rule.category}</span>
                    <h3 className={styles.worldTitle}>{rule.rule_name}</h3>
                    <p className={styles.cardDesc}>{rule.description}</p>
                  </div>
                ))
              ) : (
                <div className={styles.emptyState}>
                  <p>Chưa có dữ liệu bối cảnh.</p>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
