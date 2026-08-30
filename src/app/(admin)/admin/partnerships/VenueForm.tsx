'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, FormGroup, PageHeader, toast } from '@/components/ui'
import { createVenue, updateVenue, VenueInput } from './actions'
import { ArrowLeft, Save, ShieldCheck, MapPin, Tag, Plus, X, Image as ImageIcon } from 'lucide-react'

export interface CityOption {
  slug: string
  name_en: string
  name_fr: string
  name_ar: string
}

export interface VenueFormProps {
  cities: CityOption[]
  initialData?: {
    id: string
    city_slug: string
    name: string
    category: string | null
    category_fr: string | null
    category_ar: string | null
    location: string | null
    cover_image: string | null
    features: string[] | null
    is_verified: boolean
  }
}

export function VenueForm({ cities, initialData }: VenueFormProps) {
  const router = useRouter()
  const isEdit = !!initialData?.id
  const [loading, setLoading] = useState(false)

  // Form State
  const [citySlug, setCitySlug] = useState(initialData?.city_slug || (cities[0]?.slug || 'sousse'))
  const [name, setName] = useState(initialData?.name || '')

  const [category, setCategory] = useState(initialData?.category || '')
  const [categoryFr, setCategoryFr] = useState(initialData?.category_fr || '')
  const [categoryAr, setCategoryAr] = useState(initialData?.category_ar || '')

  const [location, setLocation] = useState(initialData?.location || '')
  const [coverImage, setCoverImage] = useState(initialData?.cover_image || '')
  const [isVerified, setIsVerified] = useState(initialData?.is_verified ?? false)

  // Features tag chip input
  const [features, setFeatures] = useState<string[]>(initialData?.features || ['Musculation', 'Cardio'])
  const [tagInput, setTagInput] = useState('')

  const handleAddTag = () => {
    const trimmed = tagInput.trim()
    if (trimmed && !features.includes(trimmed)) {
      setFeatures([...features, trimmed])
      setTagInput('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setFeatures(features.filter(t => t !== tagToRemove))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast.error('Venue name is required.')
      return
    }

    if (!citySlug) {
      toast.error('Please select a city.')
      return
    }

    setLoading(true)

    const payload: VenueInput = {
      city_slug: citySlug,
      name,
      category,
      category_fr: categoryFr,
      category_ar: categoryAr,
      location,
      cover_image: coverImage,
      features,
      is_verified: isVerified,
    }

    const res = isEdit
      ? await updateVenue(initialData.id, payload)
      : await createVenue(payload)

    setLoading(false)

    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success(isEdit ? 'Partner venue updated successfully' : 'Partner venue created successfully')
      router.push('/admin/partnerships')
      router.refresh()
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 900, margin: '0 auto' }}>
      <PageHeader
        title={isEdit ? 'Edit Partner Venue' : 'Add New Partner Venue'}
        crumb="Partnerships / Editor"
        actions={
          <div style={{ display: 'flex', gap: 10 }}>
            <Link href="/admin/partnerships" style={{ textDecoration: 'none' }}>
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
              {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Partner Venue'}
            </button>
          </div>
        }
      />

      {/* Main Venue Info */}
      <Card title="VENUE INFORMATION">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <FormGroup label="CITY LOCATION *">
              <select
                className="og-input"
                value={citySlug}
                onChange={e => setCitySlug(e.target.value)}
                required
              >
                {cities.map(c => (
                  <option key={c.slug} value={c.slug}>
                    {c.name_en} ({c.name_fr})
                  </option>
                ))}
              </select>
            </FormGroup>
          </div>

          <div>
            <FormGroup label="VENUE NAME *">
              <input
                type="text"
                required
                className="og-input"
                placeholder="e.g. Olympic Fitness Club - Kantaoui"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </FormGroup>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <FormGroup label="LOCATION / ADDRESS">
            <input
              type="text"
              className="og-input"
              placeholder="e.g. Port El Kantaoui, Sousse"
              value={location}
              onChange={e => setLocation(e.target.value)}
            />
          </FormGroup>
        </div>

        <div style={{ marginTop: 12 }}>
          <FormGroup label="COVER IMAGE URL">
            <input
              type="url"
              className="og-input"
              placeholder="https://images.unsplash.com/..."
              value={coverImage}
              onChange={e => setCoverImage(e.target.value)}
            />
          </FormGroup>

          {coverImage && (
            <div style={{ marginTop: 8, height: 120, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', background: '#000' }}>
              <img src={coverImage} alt="Cover preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => {}} />
            </div>
          )}
        </div>
      </Card>

      {/* Multilingual Categories */}
      <Card title="CATEGORIES (MULTILINGUAL)">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div>
            <FormGroup label="CATEGORY (EN)">
              <input
                type="text"
                className="og-input"
                placeholder="e.g. Gym & Fitness"
                value={category}
                onChange={e => setCategory(e.target.value)}
              />
            </FormGroup>
          </div>
          <div>
            <FormGroup label="CATEGORY (FR)">
              <input
                type="text"
                className="og-input"
                placeholder="e.g. Salle de Sport & Musculation"
                value={categoryFr}
                onChange={e => setCategoryFr(e.target.value)}
              />
            </FormGroup>
          </div>
          <div>
            <FormGroup label="CATEGORY (AR)">
              <input
                type="text"
                dir="rtl"
                className="og-input"
                placeholder="مثال: قاعة رياضية وبادي بيلدينغ"
                value={categoryAr}
                onChange={e => setCategoryAr(e.target.value)}
              />
            </FormGroup>
          </div>
        </div>
      </Card>

      {/* Features & Verification Status */}
      <Card title="FEATURES & VERIFICATION STATUS">
        {/* Features Chips Input */}
        <FormGroup label="FEATURES & AMENITIES (TAG CHIPS)">
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input
              type="text"
              className="og-input"
              placeholder="Add a feature (e.g. Sauna, Swimming Pool, Crossfit)..."
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddTag()
                }
              }}
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleAddTag}
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <Plus size={14} /> Add Tag
            </button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {features.map(f => (
              <span
                key={f}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'var(--nav-active-bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  padding: '4px 10px',
                  borderRadius: 16,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {f}
                <X
                  size={12}
                  style={{ cursor: 'pointer', color: 'var(--text-muted)' }}
                  onClick={() => handleRemoveTag(f)}
                />
              </span>
            ))}
            {features.length === 0 && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No features added yet.</span>
            )}
          </div>
        </FormGroup>

        {/* Verification Status Toggle */}
        <div style={{ marginTop: 24, background: 'var(--bg-input)', padding: '16px', borderRadius: 10, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck size={16} style={{ color: isVerified ? '#10B981' : 'var(--text-muted)' }} /> Verified Partner Venue
            </div>
            <div style={{ fontSize: 12, color: '#F59E0B', marginTop: 4, fontWeight: 500 }}>
              * Only verified venues appear on the public site
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: isVerified ? '#10B981' : 'var(--text-muted)' }}>
              {isVerified ? 'VERIFIED (LIVE)' : 'UNVERIFIED (HIDDEN)'}
            </span>
            <input
              type="checkbox"
              checked={isVerified}
              onChange={e => setIsVerified(e.target.checked)}
              style={{ width: 22, height: 22, cursor: 'pointer', accentColor: '#10B981' }}
            />
          </div>
        </div>
      </Card>

      {/* Action Footer */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginBottom: 40 }}>
        <Link href="/admin/partnerships" style={{ textDecoration: 'none' }}>
          <button type="button" className="btn btn-ghost">Cancel</button>
        </Link>
        <button
          type="submit"
          disabled={loading}
          className="btn btn-blue"
          style={{ minWidth: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <Save size={15} />
          {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Partner Venue'}
        </button>
      </div>
    </form>
  )
}
