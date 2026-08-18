'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import styles from './dashboard.module.css'
import { normalizeText } from '@/utils/text'

interface Novel {
  id: string
  title: string
  status: string
  target_chapter_count: number
  created_at: string
  genre: string
}

export default function DashboardClient({ novels, userEmail }: { novels: Novel[], userEmail: string }) {
  const [selectedCategory, setSelectedCategory] = useState<string>('Tất cả')

  // Extract unique categories (genres)
  const categories = useMemo(() => {
    const cats = new Set<string>()
    novels.forEach(n => {
      if (n.genre) cats.add(normalizeText(n.genre))
    })
    return ['Tất cả', ...Array.from(cats)]
  }, [novels])

  // Filter novels based on selected category
  const filteredNovels = useMemo(() => {
    if (selectedCategory === 'Tất cả') return novels
    return novels.filter(n => normalizeText(n.genre) === selectedCategory)
  }, [novels, selectedCategory])

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.headerTitle}>Thư Viện Của Bạn</h1>
          <p className={styles.headerSubtitle}>
            Quản lý {novels.length} tác phẩm đã tạo bởi AI
          </p>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.userBadge}>
            <span className={styles.userAvatar}>{userEmail.charAt(0).toUpperCase()}</span>
            <span className={styles.userEmail}>{userEmail}</span>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        {/* Category Filter Tabs */}
        {novels.length > 0 && (
          <div className={styles.filterTabs}>
            {categories.map(cat => (
              <button 
                key={cat} 
                className={`${styles.filterTab} ${selectedCategory === cat ? styles.filterTabActive : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {filteredNovels.length > 0 ? (
          <div className={styles.grid}>
            {filteredNovels.map((novel) => {
              const date = new Date(novel.created_at).toLocaleDateString('vi-VN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })
              
              return (
                <div key={novel.id} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <span className={styles.genreBadge}>{normalizeText(novel.genre)}</span>
                    <span className={styles.statusBadge}>{novel.status === 'active' ? 'Đang viết' : novel.status}</span>
                  </div>
                  <h3 className={styles.novelTitle}>{normalizeText(novel.title)}</h3>
                  
                  <div className={styles.statsRow}>
                    <div className={styles.stat}>
                      <span className={styles.statLabel}>Số Chương</span>
                      <span className={styles.statValue}>{novel.target_chapter_count || '?'}</span>
                    </div>
                    <div className={styles.stat}>
                      <span className={styles.statLabel}>Ngày Tạo</span>
                      <span className={styles.statValue}>{date}</span>
                    </div>
                  </div>
                  
                  <div className={styles.cardFooter}>
                    <Link href={`/protected/novel/${novel.id}`} className={styles.readButton}>
                      📖 Xem Chi Tiết
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📚</div>
            <h2>Không có truyện nào</h2>
            <p>{selectedCategory === 'Tất cả' ? 'Bạn chưa tạo cuốn tiểu thuyết nào. Hãy sử dụng AI Novel CLI để bắt đầu sáng tác!' : 'Không có truyện nào thuộc thể loại này.'}</p>
          </div>
        )}
      </main>
    </div>
  )
}
