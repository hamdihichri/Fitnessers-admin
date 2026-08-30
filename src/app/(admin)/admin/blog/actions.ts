'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin, supabaseAdmin } from '@/lib/supabase-admin'
import { slugify, validateSlug } from '@/lib/slug'

export interface BlogPostInput {
  slug?: string
  category?: string
  category_en?: string
  category_ar?: string
  title_fr: string
  title_en: string
  title_ar: string
  excerpt_fr?: string
  excerpt_en?: string
  excerpt_ar?: string
  content_markdown_fr?: string
  content_markdown_en?: string
  content_markdown_ar?: string
  read_time?: string
  date_fr?: string
  date_en?: string
  date_ar?: string
  cover_image?: string
  is_featured?: boolean
  published_at?: string | null
}

export async function createBlogPost(input: BlogPostInput) {
  try {
    await requireAdmin()

    // Required fields validation
    if (!input.title_fr?.trim() || !input.title_en?.trim() || !input.title_ar?.trim()) {
      return { error: 'Titles in FR, EN, and AR are required.' }
    }

    let slug = input.slug?.trim() ? slugify(input.slug) : slugify(input.title_en)
    if (!slug) {
      return { error: 'A valid slug is required.' }
    }

    if (!validateSlug(slug)) {
      return { error: 'Slug must contain only lowercase letters, numbers, and single hyphens.' }
    }

    // Check slug uniqueness
    const { data: existing } = await supabaseAdmin
      .from('blog_posts')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (existing) {
      return { error: `Slug "${slug}" is already taken.` }
    }

    const isFeatured = !!input.is_featured

    // If setting as featured, unset featured on all other posts first
    if (isFeatured) {
      const { error: unsetErr } = await supabaseAdmin
        .from('blog_posts')
        .update({ is_featured: false })
        .neq('id', '00000000-0000-0000-0000-000000000000')

      if (unsetErr) {
        return { error: `Failed to update featured posts: ${unsetErr.message}` }
      }
    }

    const postData = {
      slug,
      category: input.category?.trim() || null,
      category_en: input.category_en?.trim() || null,
      category_ar: input.category_ar?.trim() || null,
      title_fr: input.title_fr.trim(),
      title_en: input.title_en.trim(),
      title_ar: input.title_ar.trim(),
      excerpt_fr: input.excerpt_fr?.trim() || null,
      excerpt_en: input.excerpt_en?.trim() || null,
      excerpt_ar: input.excerpt_ar?.trim() || null,
      content_markdown_fr: input.content_markdown_fr || null,
      content_markdown_en: input.content_markdown_en || null,
      content_markdown_ar: input.content_markdown_ar || null,
      read_time: input.read_time?.trim() || '5 min',
      date_fr: input.date_fr?.trim() || null,
      date_en: input.date_en?.trim() || null,
      date_ar: input.date_ar?.trim() || null,
      cover_image: input.cover_image?.trim() || null,
      is_featured: isFeatured,
      published_at: input.published_at ? new Date(input.published_at).toISOString() : null,
    }

    const { data, error } = await supabaseAdmin
      .from('blog_posts')
      .insert([postData])
      .select()
      .single()

    if (error) {
      return { error: error.message }
    }

    revalidatePath('/admin/blog')
    revalidatePath('/blog')

    return { success: true, data }
  } catch (err: any) {
    return { error: err.message || 'Failed to create blog post.' }
  }
}

export async function updateBlogPost(id: string, input: BlogPostInput) {
  try {
    await requireAdmin()

    if (!id) {
      return { error: 'Blog post ID is required.' }
    }

    if (!input.title_fr?.trim() || !input.title_en?.trim() || !input.title_ar?.trim()) {
      return { error: 'Titles in FR, EN, and AR are required.' }
    }

    let slug = input.slug?.trim() ? slugify(input.slug) : slugify(input.title_en)
    if (!slug) {
      return { error: 'A valid slug is required.' }
    }

    if (!validateSlug(slug)) {
      return { error: 'Slug must contain only lowercase letters, numbers, and single hyphens.' }
    }

    // Check slug uniqueness excluding current post
    const { data: existing } = await supabaseAdmin
      .from('blog_posts')
      .select('id')
      .eq('slug', slug)
      .neq('id', id)
      .maybeSingle()

    if (existing) {
      return { error: `Slug "${slug}" is already taken by another post.` }
    }

    const isFeatured = !!input.is_featured

    // If setting as featured, unset featured on all other posts first
    if (isFeatured) {
      const { error: unsetErr } = await supabaseAdmin
        .from('blog_posts')
        .update({ is_featured: false })
        .neq('id', id)

      if (unsetErr) {
        return { error: `Failed to update featured posts: ${unsetErr.message}` }
      }
    }

    const postData = {
      slug,
      category: input.category?.trim() || null,
      category_en: input.category_en?.trim() || null,
      category_ar: input.category_ar?.trim() || null,
      title_fr: input.title_fr.trim(),
      title_en: input.title_en.trim(),
      title_ar: input.title_ar.trim(),
      excerpt_fr: input.excerpt_fr?.trim() || null,
      excerpt_en: input.excerpt_en?.trim() || null,
      excerpt_ar: input.excerpt_ar?.trim() || null,
      content_markdown_fr: input.content_markdown_fr || null,
      content_markdown_en: input.content_markdown_en || null,
      content_markdown_ar: input.content_markdown_ar || null,
      read_time: input.read_time?.trim() || '5 min',
      date_fr: input.date_fr?.trim() || null,
      date_en: input.date_en?.trim() || null,
      date_ar: input.date_ar?.trim() || null,
      cover_image: input.cover_image?.trim() || null,
      is_featured: isFeatured,
      published_at: input.published_at ? new Date(input.published_at).toISOString() : null,
    }

    const { data, error } = await supabaseAdmin
      .from('blog_posts')
      .update(postData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return { error: error.message }
    }

    revalidatePath('/admin/blog')
    revalidatePath('/blog')

    return { success: true, data }
  } catch (err: any) {
    return { error: err.message || 'Failed to update blog post.' }
  }
}

export async function deleteBlogPost(id: string) {
  try {
    await requireAdmin()

    if (!id) {
      return { error: 'Blog post ID is required.' }
    }

    const { error } = await supabaseAdmin
      .from('blog_posts')
      .delete()
      .eq('id', id)

    if (error) {
      return { error: error.message }
    }

    revalidatePath('/admin/blog')
    revalidatePath('/blog')

    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Failed to delete blog post.' }
  }
}
