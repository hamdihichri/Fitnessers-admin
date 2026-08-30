'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, FormGroup, PageHeader, toast } from '@/components/ui'
import { createBlogPost, updateBlogPost, BlogPostInput } from './actions'
import { slugify } from '@/lib/slug'
import { ArrowLeft, Save, Sparkles, Calendar, Globe, FileText, Image as ImageIcon } from 'lucide-react'

export interface BlogFormProps {
  initialData?: {
    id: string
    slug: string
    category: string | null
    category_en: string | null
    category_ar: string | null
    title_fr: string
    title_en: string
    title_ar: string
    excerpt_fr: string | null
    excerpt_en: string | null
    excerpt_ar: string | null
    content_markdown_fr: string | null
    content_markdown_en: string | null
    content_markdown_ar: string | null
    read_time: string | null
    date_fr: string | null
    date_en: string | null
    date_ar: string | null
    cover_image: string | null
    is_featured: boolean
    published_at: string | null
  }
}

export function BlogForm({ initialData }: BlogFormProps) {
  const router = useRouter()
  const isEdit = !!initialData?.id
  const [loading, setLoading] = useState(false)

  // Auto-slug tracking
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(isEdit)

  // Form State
  const [slug, setSlug] = useState(initialData?.slug || '')
  const [category, setCategory] = useState(initialData?.category || '')
  const [categoryEn, setCategoryEn] = useState(initialData?.category_en || '')
  const [categoryAr, setCategoryAr] = useState(initialData?.category_ar || '')

  const [titleFr, setTitleFr] = useState(initialData?.title_fr || '')
  const [titleEn, setTitleEn] = useState(initialData?.title_en || '')
  const [titleAr, setTitleAr] = useState(initialData?.title_ar || '')

  const [excerptFr, setExcerptFr] = useState(initialData?.excerpt_fr || '')
  const [excerptEn, setExcerptEn] = useState(initialData?.excerpt_en || '')
  const [excerptAr, setExcerptAr] = useState(initialData?.excerpt_ar || '')

  const [contentMarkdownFr, setContentMarkdownFr] = useState(initialData?.content_markdown_fr || '')
  const [contentMarkdownEn, setContentMarkdownEn] = useState(initialData?.content_markdown_en || '')
  const [contentMarkdownAr, setContentMarkdownAr] = useState(initialData?.content_markdown_ar || '')

  const [readTime, setReadTime] = useState(initialData?.read_time || '5 min')
  const [dateFr, setDateFr] = useState(initialData?.date_fr || '')
  const [dateEn, setDateEn] = useState(initialData?.date_en || '')
  const [dateAr, setDateAr] = useState(initialData?.date_ar || '')

  const [coverImage, setCoverImage] = useState(initialData?.cover_image || '')
  const [isFeatured, setIsFeatured] = useState(initialData?.is_featured || false)

  // Convert stored UTC string to datetime-local value (YYYY-MM-DDTHH:mm)
  const formatDatetimeLocal = (isoStr: string | null | undefined) => {
    if (!isoStr) return ''
    try {
      const d = new Date(isoStr)
      if (isNaN(d.getTime())) return ''
      // Local ISO string slice
      const pad = (n: number) => n.toString().padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    } catch {
      return ''
    }
  }

  const [publishedAt, setPublishedAt] = useState<string>(formatDatetimeLocal(initialData?.published_at))

  // Auto-generate slug from Title (EN) if not manually edited
  const handleTitleEnChange = (val: string) => {
    setTitleEn(val)
    if (!isSlugManuallyEdited) {
      setSlug(slugify(val))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!titleFr.trim() || !titleEn.trim() || !titleAr.trim()) {
      toast.error('Titles in FR, EN, and AR are required.')
      return
    }

    setLoading(true)

    const payload: BlogPostInput = {
      slug,
      category,
      category_en: categoryEn,
      category_ar: categoryAr,
      title_fr: titleFr,
      title_en: titleEn,
      title_ar: titleAr,
      excerpt_fr: excerptFr,
      excerpt_en: excerptEn,
      excerpt_ar: excerptAr,
      content_markdown_fr: contentMarkdownFr,
      content_markdown_en: contentMarkdownEn,
      content_markdown_ar: contentMarkdownAr,
      read_time: readTime,
      date_fr: dateFr,
      date_en: dateEn,
      date_ar: dateAr,
      cover_image: coverImage,
      is_featured: isFeatured,
      published_at: publishedAt ? publishedAt : null,
    }

    const res = isEdit
      ? await updateBlogPost(initialData.id, payload)
      : await createBlogPost(payload)

    setLoading(false)

    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success(isEdit ? 'Blog post updated successfully' : 'Blog post created successfully')
      router.push('/admin/blog')
      router.refresh()
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 1000, margin: '0 auto' }}>
      <PageHeader
        title={isEdit ? 'Edit Blog Post' : 'Create New Blog Post'}
        crumb="Blog / Editor"
        actions={
          <div style={{ display: 'flex', gap: 10 }}>
            <Link href="/admin/blog" style={{ textDecoration: 'none' }}>
              <button type="button" className="btn btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <ArrowLeft size={15} /> Cancel
              </button>
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-blue"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Save size={15} />
              {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Publish Post'}
            </button>
          </div>
        }
      />

      {/* Main Metadata Card */}
      <Card title="BASIC SETTINGS & SLUG">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <FormGroup label="URL SLUG (UNIQUE IDENTIFIER)">
              <input
                type="text"
                className="og-input"
                placeholder="e.g. gym-prices-tunisia-2026"
                value={slug}
                onChange={e => {
                  setSlug(e.target.value)
                  setIsSlugManuallyEdited(true)
                }}
              />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                Auto-generated from English title. Lowercase letters, numbers, and hyphens only.
              </span>
            </FormGroup>
          </div>
          <div>
            <FormGroup label="READ TIME">
              <input
                type="text"
                className="og-input"
                placeholder="e.g. 5 min"
                value={readTime}
                onChange={e => setReadTime(e.target.value)}
              />
            </FormGroup>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 }}>
          <div>
            <FormGroup label="COVER IMAGE URL">
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="url"
                  className="og-input"
                  placeholder="https://images.unsplash.com/..."
                  value={coverImage}
                  onChange={e => setCoverImage(e.target.value)}
                  style={{ flex: 1 }}
                />
              </div>
            </FormGroup>

            {coverImage && (
              <div style={{ marginTop: 8, height: 100, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', background: '#000' }}>
                <img src={coverImage} alt="Cover preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => {}} />
              </div>
            )}
          </div>

          <div>
            <FormGroup label="PUBLICATION DATE & STATUS">
              <input
                type="datetime-local"
                className="og-input"
                value={publishedAt}
                onChange={e => setPublishedAt(e.target.value)}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.4 }}>
                • <strong>Empty:</strong> Draft (never published)<br />
                • <strong>Future date:</strong> Scheduled<br />
                • <strong>Past/Now:</strong> Live Published
              </div>
            </FormGroup>

            <div style={{ marginTop: 16, background: 'var(--bg-input)', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={14} style={{ color: '#F59E0B' }} /> Featured Post
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  Only one post can be featured at a time. Toggling ON will unset all other featured posts.
                </div>
              </div>
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={e => setIsFeatured(e.target.checked)}
                style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--accent-blue)' }}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Multilingual Titles & Categories */}
      <Card title="TITLES & CATEGORIES (MULTILINGUAL)">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div>
            <FormGroup label="TITLE (FR) *">
              <input
                type="text"
                required
                className="og-input"
                placeholder="Titre en français..."
                value={titleFr}
                onChange={e => setTitleFr(e.target.value)}
              />
            </FormGroup>
            <FormGroup label="CATEGORY (FR)">
              <input
                type="text"
                className="og-input"
                placeholder="e.g. Guides Tarifs"
                value={category}
                onChange={e => setCategory(e.target.value)}
              />
            </FormGroup>
            <FormGroup label="DISPLAY DATE (FR)">
              <input
                type="text"
                className="og-input"
                placeholder="e.g. 28 Août 2026"
                value={dateFr}
                onChange={e => setDateFr(e.target.value)}
              />
            </FormGroup>
          </div>

          <div>
            <FormGroup label="TITLE (EN) *">
              <input
                type="text"
                required
                className="og-input"
                placeholder="Title in English..."
                value={titleEn}
                onChange={e => handleTitleEnChange(e.target.value)}
              />
            </FormGroup>
            <FormGroup label="CATEGORY (EN)">
              <input
                type="text"
                className="og-input"
                placeholder="e.g. Pricing Guide"
                value={categoryEn}
                onChange={e => setCategoryEn(e.target.value)}
              />
            </FormGroup>
            <FormGroup label="DISPLAY DATE (EN)">
              <input
                type="text"
                className="og-input"
                placeholder="e.g. Aug 28, 2026"
                value={dateEn}
                onChange={e => setDateEn(e.target.value)}
              />
            </FormGroup>
          </div>

          <div>
            <FormGroup label="TITLE (AR) *">
              <input
                type="text"
                required
                dir="rtl"
                className="og-input"
                placeholder="العنوان بالعربية..."
                value={titleAr}
                onChange={e => setTitleAr(e.target.value)}
              />
            </FormGroup>
            <FormGroup label="CATEGORY (AR)">
              <input
                type="text"
                dir="rtl"
                className="og-input"
                placeholder="مثال: دليل الأسعار"
                value={categoryAr}
                onChange={e => setCategoryAr(e.target.value)}
              />
            </FormGroup>
            <FormGroup label="DISPLAY DATE (AR)">
              <input
                type="text"
                dir="rtl"
                className="og-input"
                placeholder="مثال: 28 أوت 2026"
                value={dateAr}
                onChange={e => setDateAr(e.target.value)}
              />
            </FormGroup>
          </div>
        </div>
      </Card>

      {/* Multilingual Excerpts */}
      <Card title="EXCERPTS (~200 CHARACTERS)">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div>
            <FormGroup label="EXCERPT (FR)">
              <textarea
                className="og-input"
                rows={4}
                placeholder="Extrait en français..."
                value={excerptFr}
                onChange={e => setExcerptFr(e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </FormGroup>
          </div>
          <div>
            <FormGroup label="EXCERPT (EN)">
              <textarea
                className="og-input"
                rows={4}
                placeholder="Excerpt in English..."
                value={excerptEn}
                onChange={e => setExcerptEn(e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </FormGroup>
          </div>
          <div>
            <FormGroup label="EXCERPT (AR)">
              <textarea
                className="og-input"
                dir="rtl"
                rows={4}
                placeholder="المقتطف بالعربية..."
                value={excerptAr}
                onChange={e => setExcerptAr(e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </FormGroup>
          </div>
        </div>
      </Card>

      {/* Multilingual Markdown Content */}
      <Card title="MARKDOWN CONTENT">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
          <FormGroup label="CONTENT MARKDOWN (FR)">
            <textarea
              className="og-input"
              rows={10}
              placeholder="# Titre principal&#10;&#10;Contenu de l'article en Markdown..."
              value={contentMarkdownFr}
              onChange={e => setContentMarkdownFr(e.target.value)}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 13, resize: 'vertical' }}
            />
          </FormGroup>

          <FormGroup label="CONTENT MARKDOWN (EN)">
            <textarea
              className="og-input"
              rows={10}
              placeholder="# Main Heading&#10;&#10;Article body content in Markdown..."
              value={contentMarkdownEn}
              onChange={e => setContentMarkdownEn(e.target.value)}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 13, resize: 'vertical' }}
            />
          </FormGroup>

          <FormGroup label="CONTENT MARKDOWN (AR)">
            <textarea
              className="og-input"
              dir="rtl"
              rows={10}
              placeholder="# العنوان الرئيسي&#10;&#10;محتوى المقال بالماركداون..."
              value={contentMarkdownAr}
              onChange={e => setContentMarkdownAr(e.target.value)}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 13, resize: 'vertical' }}
            />
          </FormGroup>
        </div>
      </Card>

      {/* Form Action Footer */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginBottom: 40 }}>
        <Link href="/admin/blog" style={{ textDecoration: 'none' }}>
          <button type="button" className="btn btn-ghost">Cancel</button>
        </Link>
        <button
          type="submit"
          disabled={loading}
          className="btn btn-blue"
          style={{ minWidth: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <Save size={15} />
          {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Publish Post'}
        </button>
      </div>
    </form>
  )
}
