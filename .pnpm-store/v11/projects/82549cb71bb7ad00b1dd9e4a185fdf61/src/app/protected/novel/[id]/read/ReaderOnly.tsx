'use client'

import { useState } from 'react'
import Link from 'next/link'
import { normalizeText } from '@/utils/text'
import styles from '../reader.module.css'

interface Chapter {
  chapter_number: number
  title: string
  content: string
  summary: string
}

interface ReaderProps {
  novelId: string
  novelTitle: string
  chapters: Chapter[]
}

export default function ReaderOnly({ novelId, novelTitle, chapters }: ReaderProps) {
  const [activeChapterIndex, setActiveChapterIndex] = useState(0)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const activeChapter = chapters[activeChapterIndex]

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <Link href={`/protected/novel/${novelId}`} style={{ display: 'inline-block', marginBottom: '1rem', color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>
            ← Về Trang Chi Tiết
          </Link>
          <h1 className={styles.headerTitle}>{normalizeText(novelTitle)}</h1>
          <p className={styles.headerSubtitle}>
            {chapters.length} Chương
          </p>
        </div>
        <div>
          <button 
            className={styles.mobileMenuToggle}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? 'Đóng Menu' : '☰ Chọn Chương'}
          </button>
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
                      setActiveChapterIndex(index)
                      setIsMobileMenuOpen(false)
                    }}
                  >
                    <span className={styles.chapterName}>Chương {chapter.chapter_number}: {normalizeText(chapter.title)}</span>
                    <span className={styles.chapterSummary}>{normalizeText(chapter.summary)}</span>
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
          <div className={styles.reader}>
            {activeChapter ? (
              <>
                <h2 className={styles.readerTitle}>Chương {activeChapter.chapter_number}: {normalizeText(activeChapter.title)}</h2>
                <div className={styles.readerSummary}>
                  <strong>Tóm tắt AI:</strong> {normalizeText(activeChapter.summary)}
                </div>
                <div className={styles.readerText}>
                  {normalizeText(activeChapter.content)}
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
        </section>
      </main>
    </div>
  )
}
