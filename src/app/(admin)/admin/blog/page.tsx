import { requireAdmin, supabaseAdmin } from '@/lib/supabase-admin'
import { BlogListClient } from './BlogListClient'

export const dynamic = 'force-dynamic'

export default async function BlogAdminPage() {
  await requireAdmin()

  const { data: posts, error } = await supabaseAdmin
    .from('blog_posts')
    .select('id, slug, title_en, title_fr, title_ar, category, category_en, is_featured, published_at, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch blog posts: ${error.message}`)
  }

  return <BlogListClient posts={posts || []} />
}
