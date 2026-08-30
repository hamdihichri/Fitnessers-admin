'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, PageHeader, Badge, ConfirmModal, toast, EmptyState } from '@/components/ui'
import { Plus, Edit, Trash2, Search, Building2, ShieldCheck, MapPin } from 'lucide-react'
import { deleteVenue, toggleVenueVerified } from './actions'

export interface VenueItem {
  id: string
  city_slug: string
  name: string
  category: string | null
  category_fr: string | null
  location: string | null
  is_verified: boolean
  created_at: string
}

export function PartnershipListClient({ venues }: { venues: VenueItem[] }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [selectedCity, setSelectedCity] = useState('all')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // Extract unique cities for filter dropdown
  const cities = Array.from(new Set(venues.map(v => v.city_slug))).sort()

  const filteredVenues = venues.filter(v => {
    const q = search.toLowerCase()
    const matchesSearch = (
      v.name.toLowerCase().includes(q) ||
      v.city_slug.toLowerCase().includes(q) ||
      (v.category && v.category.toLowerCase().includes(q)) ||
      (v.location && v.location.toLowerCase().includes(q))
    )
    const matchesCity = selectedCity === 'all' || v.city_slug === selectedCity
    return matchesSearch && matchesCity
  })

  const handleToggleVerified = async (id: string, currentVerified: boolean) => {
    setTogglingId(id)
    const nextState = !currentVerified
    const res = await toggleVenueVerified(id, nextState)
    setTogglingId(null)

    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success(`Venue ${nextState ? 'verified (published live)' : 'unverified (hidden)'}`)
      router.refresh()
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    const res = await deleteVenue(deleteId)
    setDeleting(false)
    setDeleteId(null)

    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success('Partner venue deleted successfully')
      router.refresh()
    }
  }

  return (
    <div>
      <PageHeader
        title="Partner Venues Management"
        crumb="Partnerships / Venues"
        actions={
          <Link href="/admin/partnerships/new" style={{ textDecoration: 'none' }}>
            <button className="btn btn-blue" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={16} /> Add New Partner Venue
            </button>
          </Link>
        }
      />

      <Card>
        {/* Search & Filter Bar */}
        <div style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 260, maxWidth: 400 }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="og-input"
              placeholder="Search by name, city, location, category..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 36 }}
            />
          </div>

          <select
            className="og-input"
            value={selectedCity}
            onChange={e => setSelectedCity(e.target.value)}
            style={{ width: 160 }}
          >
            <option value="all">All Cities</option>
            {cities.map(c => (
              <option key={c} value={c}>{c.toUpperCase()}</option>
            ))}
          </select>

          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>
            Showing {filteredVenues.length} of {venues.length} venues
          </div>
        </div>

        {/* Table */}
        {filteredVenues.length === 0 ? (
          <EmptyState icon="🏋️" message={search || selectedCity !== 'all' ? "No venues match your search criteria" : "No partner venues found. Add your first venue!"} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="og-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr>
                  <th style={{ padding: '12px 14px', fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Verified</th>
                  <th style={{ padding: '12px 14px', fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Venue Name</th>
                  <th style={{ padding: '12px 14px', fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>City</th>
                  <th style={{ padding: '12px 14px', fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Category</th>
                  <th style={{ padding: '12px 14px', fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Created At</th>
                  <th style={{ padding: '12px 14px', fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-muted)', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVenues.map(venue => (
                  <tr key={venue.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '14px' }}>
                      <button
                        type="button"
                        disabled={togglingId === venue.id}
                        onClick={() => handleToggleVerified(venue.id, venue.is_verified)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '4px 10px',
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          border: 'none',
                          background: venue.is_verified ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-input)',
                          color: venue.is_verified ? '#10B981' : 'var(--text-muted)',
                          transition: 'all 0.2s ease',
                        }}
                        title="Click to toggle public verification status"
                      >
                        <ShieldCheck size={13} />
                        {venue.is_verified ? 'Verified' : 'Unverified'}
                      </button>
                    </td>

                    <td style={{ padding: '14px' }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 2 }}>
                        {venue.name}
                      </div>
                      {venue.location && (
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                          <MapPin size={11} /> {venue.location}
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '14px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', fontFamily: 'var(--font-mono)', background: 'var(--bg-input)', padding: '2px 8px', borderRadius: 4, color: 'var(--accent-blue)' }}>
                        {venue.city_slug}
                      </span>
                    </td>

                    <td style={{ padding: '14px', fontSize: 13, color: 'var(--text-secondary)' }}>
                      {venue.category || venue.category_fr || '—'}
                    </td>

                    <td style={{ padding: '14px', fontSize: 12, color: 'var(--text-secondary)' }}>
                      {new Date(venue.created_at).toLocaleDateString()}
                    </td>

                    <td style={{ padding: '14px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <Link href={`/admin/partnerships/${venue.id}/edit`} style={{ textDecoration: 'none' }}>
                          <button className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Edit size={14} /> Edit
                          </button>
                        </Link>
                        <button
                          className="btn btn-ghost"
                          onClick={() => setDeleteId(venue.id)}
                          style={{ padding: '6px 10px', fontSize: 12, color: '#EF4444', display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Partner Venue"
        message="Are you sure you want to delete this partner venue? It will no longer be visible anywhere."
        confirmText={deleting ? 'Deleting...' : 'Delete Venue'}
        variant="red"
      />
    </div>
  )
}
