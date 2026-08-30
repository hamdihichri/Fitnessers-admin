'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin, supabaseAdmin } from '@/lib/supabase-admin'

export interface VenueInput {
  city_slug: string
  name: string
  category?: string
  category_fr?: string
  category_ar?: string
  location?: string
  cover_image?: string
  features?: string[]
  is_verified?: boolean
}

export async function createVenue(input: VenueInput) {
  try {
    await requireAdmin()

    if (!input.name?.trim()) {
      return { error: 'Venue name is required.' }
    }

    if (!input.city_slug?.trim()) {
      return { error: 'City is required.' }
    }

    const citySlug = input.city_slug.trim()
    const name = input.name.trim()

    const venueData = {
      city_slug: citySlug,
      name,
      category: input.category?.trim() || null,
      category_fr: input.category_fr?.trim() || null,
      category_ar: input.category_ar?.trim() || null,
      location: input.location?.trim() || null,
      cover_image: input.cover_image?.trim() || null,
      features: Array.isArray(input.features) ? input.features : [],
      is_verified: !!input.is_verified,
    }

    const { data, error } = await supabaseAdmin
      .from('venues')
      .insert([venueData])
      .select()
      .single()

    if (error) {
      return { error: error.message }
    }

    revalidatePath('/admin/partnerships')
    revalidatePath('/sousse')
    revalidatePath(`/${citySlug}`)

    return { success: true, data }
  } catch (err: any) {
    return { error: err.message || 'Failed to create venue.' }
  }
}

export async function updateVenue(id: string, input: VenueInput) {
  try {
    await requireAdmin()

    if (!id) {
      return { error: 'Venue ID is required.' }
    }

    if (!input.name?.trim()) {
      return { error: 'Venue name is required.' }
    }

    if (!input.city_slug?.trim()) {
      return { error: 'City is required.' }
    }

    const citySlug = input.city_slug.trim()
    const name = input.name.trim()

    const venueData = {
      city_slug: citySlug,
      name,
      category: input.category?.trim() || null,
      category_fr: input.category_fr?.trim() || null,
      category_ar: input.category_ar?.trim() || null,
      location: input.location?.trim() || null,
      cover_image: input.cover_image?.trim() || null,
      features: Array.isArray(input.features) ? input.features : [],
      is_verified: !!input.is_verified,
    }

    const { data, error } = await supabaseAdmin
      .from('venues')
      .update(venueData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return { error: error.message }
    }

    revalidatePath('/admin/partnerships')
    revalidatePath('/sousse')
    revalidatePath(`/${citySlug}`)

    return { success: true, data }
  } catch (err: any) {
    return { error: err.message || 'Failed to update venue.' }
  }
}

export async function deleteVenue(id: string) {
  try {
    await requireAdmin()

    if (!id) {
      return { error: 'Venue ID is required.' }
    }

    const { error } = await supabaseAdmin
      .from('venues')
      .delete()
      .eq('id', id)

    if (error) {
      return { error: error.message }
    }

    revalidatePath('/admin/partnerships')
    revalidatePath('/sousse')

    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Failed to delete venue.' }
  }
}

export async function toggleVenueVerified(id: string, is_verified: boolean) {
  try {
    await requireAdmin()

    if (!id) {
      return { error: 'Venue ID is required.' }
    }

    const { data, error } = await supabaseAdmin
      .from('venues')
      .update({ is_verified })
      .eq('id', id)
      .select('id, city_slug, is_verified')
      .single()

    if (error) {
      return { error: error.message }
    }

    revalidatePath('/admin/partnerships')
    revalidatePath('/sousse')
    if (data?.city_slug) {
      revalidatePath(`/${data.city_slug}`)
    }

    return { success: true, data }
  } catch (err: any) {
    return { error: err.message || 'Failed to toggle venue verification.' }
  }
}
