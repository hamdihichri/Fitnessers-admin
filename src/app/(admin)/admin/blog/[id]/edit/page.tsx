import { notFound } from 'next/navigation'
import { requireAdmin, supabaseAdmin } from '@/lib/supabase-admin'
import { BlogForm } from '../../BlogForm'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditBlogPostPage({ params }: Props) {
  await requireAdmin()
  const { id } = await params

  const { data: post, error } = await supabaseAdmin
    .from('blog_posts')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error || !post) {
    notFound()
  }

  return <BlogForm initialData={post} />
}
