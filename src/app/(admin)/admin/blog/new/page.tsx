import { requireAdmin } from '@/lib/supabase-admin'
import { BlogForm } from '../BlogForm'

export const dynamic = 'force-dynamic'

export default async function NewBlogPostPage() {
  await requireAdmin()

  return <BlogForm />
}
