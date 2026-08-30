import { requireAdmin, supabaseAdmin } from '@/lib/supabase-admin'
import { VenueForm } from '../VenueForm'

export const dynamic = 'force-dynamic'

export default async function NewVenuePage() {
  await requireAdmin()

  const { data: cities, error } = await supabaseAdmin
    .from('cities')
    .select('slug, name_en, name_fr, name_ar')
    .eq('is_active', true)
    .order('name_en', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch active cities: ${error.message}`)
  }

  return <VenueForm cities={cities || []} />
}
