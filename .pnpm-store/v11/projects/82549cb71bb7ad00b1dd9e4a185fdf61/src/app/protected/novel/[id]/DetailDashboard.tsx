'use client'

import { useState } from 'react'
import Link from 'next/link'
import { normalizeText } from '@/utils/text'
import styles from './reader.module.css'

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
  novel: { id: string; title: string; status: string; target_chapter_count: number; created_at: string }
  chapters: Chapter[]
  characters: Character[]
  worldRules: WorldRule[]
  userEmail: string
}

export default function DetailDashboard({ novel, chapters, characters, worldRules, userEmail }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'characters' | 'world' | 'pipeline'>('profile')

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <Link href="/protected" style={{ display: 'inline-block', marginBottom: '1rem', color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>
            ← Quay lại Thư Viện
          </Link>
          <h1 className={styles.headerTitle}>{normalizeText(novel.title)}</h1>
          <p className={styles.headerSubtitle}>
            {chapters.length} / {novel.target_chapter_count} Chương • Đang đăng nhập: {userEmail}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span className={styles.cardMeta} style={{ marginBottom: '1rem', display: 'inline-block' }}>{novel.status}</span>
          <br/>
          <Link href={`/protected/novel/${novel.id}/read`} className={styles.navButton} style={{ background: '#2563eb', color: 'white', borderColor: '#2563eb' }}>
            📖 Bắt Đầu Đọc Truyện
          </Link>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.contentArea} style={{ padding: '3rem 4rem' }}>
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === 'profile' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              📖 Hồ Sơ & Mạch Truyện
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'characters' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('characters')}
            >
              👥 Nhân Vật
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'world' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('world')}
            >
              🌍 Bối Cảnh Thế Giới
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'pipeline' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('pipeline')}
            >
              ⚙️ Luồng Tạo Truyện
            </button>
          </div>

          {activeTab === 'profile' && (
            <div className={styles.reader}>
              <h2 className={styles.readerTitle}>Danh Sách Chương</h2>
              <div style={{ marginTop: '2rem' }}>
                {chapters.length > 0 ? (
                  <ul className={styles.chapterList}>
                    {chapters.map((chapter) => (
                      <li key={chapter.chapter_number} className={styles.chapterItem} style={{ border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                        <span className={styles.chapterName}>Chương {chapter.chapter_number}: {normalizeText(chapter.title)}</span>
                        <span className={styles.chapterSummary}>{normalizeText(chapter.summary)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className={styles.emptyState}>
                    <p>Chưa có chương nào được tạo.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'characters' && (
            <div className={styles.grid}>
              {characters.length > 0 ? (
                characters.map((char, i) => (
                  <div key={i} className={styles.card}>
                    <span className={styles.cardMeta}>{normalizeText(char.role)}</span>
                    <h3 className={styles.cardTitle}>{normalizeText(char.name)}</h3>
                    <p className={styles.cardDesc}>{normalizeText(char.description)}</p>
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
                    <span className={styles.cardMeta}>{normalizeText(rule.category)}</span>
                    <h3 className={styles.worldTitle}>{normalizeText(rule.rule_name)}</h3>
                    <p className={styles.cardDesc}>{normalizeText(rule.description)}</p>
                  </div>
                ))
              ) : (
                <div className={styles.emptyState}>
                  <p>Chưa có dữ liệu bối cảnh.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'pipeline' && (
            <div className={styles.reader}>
              <h2 className={styles.readerTitle}>Tiến Trình Tạo Truyện</h2>
              <div style={{ marginTop: '2rem', padding: '2rem', background: '#f8fafc', borderRadius: '1rem', border: '1px solid #e2e8f0' }}>
                <p><strong>Ngày tạo:</strong> {new Date(novel.created_at).toLocaleString('vi-VN')}</p>
                <p><strong>Trạng thái:</strong> {novel.status}</p>
                <p><strong>Số chương mục tiêu:</strong> {novel.target_chapter_count}</p>
                <p><strong>Số chương đã sinh:</strong> {chapters.length}</p>
                
                <div style={{ marginTop: '2rem', width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{ 
                    width: `${Math.min(100, (chapters.length / novel.target_chapter_count) * 100)}%`, 
                    height: '100%', 
                    background: '#2563eb',
                    transition: 'width 0.5s ease'
                  }}></div>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
