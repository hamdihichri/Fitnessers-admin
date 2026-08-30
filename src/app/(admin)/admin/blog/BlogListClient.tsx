'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, PageHeader, Badge, ConfirmModal, toast, EmptyState } from '@/components/ui'
import { Plus, Edit, Trash2, Search, ExternalLink, Sparkles, Calendar, Tag } from 'lucide-react'
import { deleteBlogPost } from './actions'

export interface BlogPostItem {
  id: string
  slug: string
  title_en: string
  title_fr: string
  title_ar: string
  category: string | null
  category_en: string | null
  is_featured: boolean
  published_at: string | null
  created_at: string
}

export function BlogListClient({ posts }: { posts: BlogPostItem[] }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Filter posts
  const filteredPosts = posts.filter(p => {
    const q = search.toLowerCase()
    return (
      p.slug.toLowerCase().includes(q) ||
      p.title_en.toLowerCase().includes(q) ||
      (p.title_fr && p.title_fr.toLowerCase().includes(q)) ||
      (p.category_en && p.category_en.toLowerCase().includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q))
    )
  })

  const getStatusBadge = (publishedAt: string | null) => {
    if (!publishedAt) {
      return <Badge label="Draft" variant="grey" />
    }
    const pubDate = new Date(publishedAt)
    const now = new Date()
    if (pubDate > now) {
      return <Badge label="Scheduled" variant="amber" />
    }
    return <Badge label="Published" variant="green" />
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    const res = await deleteBlogPost(deleteId)
    setDeleting(false)
    setDeleteId(null)

    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success('Blog post deleted successfully')
      router.refresh()
    }
  }

  return (
    <div>
      <PageHeader
        title="Blog Posts Management"
        crumb="Blog / All Posts"
        actions={
          <Link href="/admin/blog/new" style={{ textDecoration: 'none' }}>
            <button className="btn btn-blue" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={16} /> Create New Post
            </button>
          </Link>
        }
      />

      <Card>
        {/* Search Bar */}
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="og-input"
              placeholder="Search by title, slug, or category..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 36 }}
            />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            Showing {filteredPosts.length} of {posts.length} posts
          </div>
        </div>

        {/* Table */}
        {filteredPosts.length === 0 ? (
          <EmptyState icon="📝" message={search ? "No posts match your search query" : "No blog posts found. Create your first post!"} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="og-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr>
                  <th style={{ padding: '12px 14px', fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Status</th>
                  <th style={{ padding: '12px 14px', fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Title & Slug</th>
                  <th style={{ padding: '12px 14px', fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Category</th>
                  <th style={{ padding: '12px 14px', fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Featured</th>
                  <th style={{ padding: '12px 14px', fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Publish Date</th>
                  <th style={{ padding: '12px 14px', fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-muted)', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPosts.map(post => (
                  <tr key={post.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '14px' }}>
                      {getStatusBadge(post.published_at)}
                    </td>
                    <td style={{ padding: '14px' }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 2 }}>
                        {post.title_en}
                      </div>
                      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                        /{post.slug}
                      </div>
                    </td>
                    <td style={{ padding: '14px', fontSize: 13, color: 'var(--text-secondary)' }}>
                      {post.category_en || post.category || '—'}
                    </td>
                    <td style={{ padding: '14px' }}>
                      {post.is_featured ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                          <Sparkles size={12} /> Featured
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '14px', fontSize: 12, color: 'var(--text-secondary)' }}>
                      {post.published_at ? new Date(post.published_at).toLocaleString() : 'Draft (Unpublished)'}
                    </td>
                    <td style={{ padding: '14px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <Link href={`/admin/blog/${post.id}/edit`} style={{ textDecoration: 'none' }}>
                          <button className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Edit size={14} /> Edit
                          </button>
                        </Link>
                        <button
                          className="btn btn-ghost"
                          onClick={() => setDeleteId(post.id)}
                          style={{ padding: '6px 10px', fontSize: 12, color: '#EF4444', display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Blog Post"
        message="Are you sure you want to delete this blog post? This action cannot be undone."
        confirmText={deleting ? 'Deleting...' : 'Delete Post'}
        variant="red"
      />
    </div>
  )
}
