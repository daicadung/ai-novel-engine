import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import styles from './dashboard.module.css'
import { normalizeText } from '@/utils/text'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return redirect('/login')
  }

  const { data: novels } = await supabase
    .from('novels')
    .select('id, title, status, target_chapter_count, created_at')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.headerTitle}>Thư Viện Của Bạn</h1>
          <p className={styles.headerSubtitle}>
            Quản lý {novels?.length || 0} tác phẩm đã tạo bởi AI
          </p>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.userBadge}>
            <span className={styles.userAvatar}>{user.email?.charAt(0).toUpperCase()}</span>
            <span className={styles.userEmail}>{user.email}</span>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        {novels && novels.length > 0 ? (
          <div className={styles.grid}>
            {novels.map((novel) => {
              const date = new Date(novel.created_at).toLocaleDateString('vi-VN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })
              
              return (
                <div key={novel.id} className={styles.card}>
                  <div className={styles.cardHeader}>
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
                      📖 Vào Đọc Ngay
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📚</div>
            <h2>Thư viện trống</h2>
            <p>Bạn chưa tạo cuốn tiểu thuyết nào. Hãy sử dụng AI Novel CLI để bắt đầu sáng tác!</p>
          </div>
        )}
      </main>
    </div>
  )
}
