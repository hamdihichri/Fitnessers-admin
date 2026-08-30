import { requireAdmin, supabaseAdmin } from '@/lib/supabase-admin'
import { PartnershipListClient } from './PartnershipListClient'

export const dynamic = 'force-dynamic'

export default async function PartnershipsAdminPage() {
  await requireAdmin()

  const { data: venues, error } = await supabaseAdmin
    .from('venues')
    .select('id, city_slug, name, category, category_fr, location, is_verified, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch venues: ${error.message}`)
  }

  return <PartnershipListClient venues={venues || []} />
}
