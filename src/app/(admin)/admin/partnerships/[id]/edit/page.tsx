import { notFound } from 'next/navigation'
import { requireAdmin, supabaseAdmin } from '@/lib/supabase-admin'
import { VenueForm } from '../../VenueForm'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditVenuePage({ params }: Props) {
  await requireAdmin()
  const { id } = await params

  const { data: venue, error: venueErr } = await supabaseAdmin
    .from('venues')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (venueErr || !venue) {
    notFound()
  }

  const { data: cities, error: citiesErr } = await supabaseAdmin
    .from('cities')
    .select('slug, name_en, name_fr, name_ar')
    .eq('is_active', true)
    .order('name_en', { ascending: true })

  if (citiesErr) {
    throw new Error(`Failed to fetch active cities: ${citiesErr.message}`)
  }

  return <VenueForm cities={cities || []} initialData={venue} />
}
