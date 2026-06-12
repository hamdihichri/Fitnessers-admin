'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabaseBrowser'
import { 
  Card, Badge, Spinner, EmptyState, Modal, FormGroup, 
  ModalActions, ConfirmModal, toast, UserCell 
} from '@/components/ui'
import { 
  Plus, Send, Undo2, Pencil, Trash2, Smartphone, 
  MessageCircle, Type, AlignLeft, Palette, Image as ImageIcon,
  CheckCircle2, Sparkles
} from 'lucide-react'
import { CommentPanel } from './CommentPanel'

const BRAND_COLORS = [
  { name: 'Mint', value: '#D7F2F4' },
  { name: 'Energy', value: '#F59E0B' },
  { name: 'Success', value: '#10B981' },
  { name: 'Royal', value: '#8B5CF6' },
  { name: 'Classic', value: '#0F172A' },
]

type BroadcastStatus = 'draft' | 'published' | 'retracted'

interface Broadcast {
  broadcast_id: string
  created_by: string
  title: string
  body: string
  accent_color: string
  image_url: string | null
  status: BroadcastStatus
  target_mode: 'all' | 'specific'
  published_at: string | null
  created_at: string
  admin_broadcast_deliveries?: {
    event_id: string
    activity_events: {
      like_count: number
      comment_count: number
    } | null
  } | null
}

export function BroadcastsTab() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmRetract, setConfirmRetract] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    title: '',
    body: '',
    accent_color: '#7F77DD',
    image_url: '',
  })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [activeComments, setActiveComments] = useState<{ bId: string, eId: string } | null>(null)

  const supabase = createBrowserClient()

  async function fetchBroadcasts() {
    setLoading(true)
    const { data, error } = await supabase
      .schema('future')
      .from('admin_broadcasts')
      .select(`
        *,
        admin_broadcast_deliveries (
          event_id,
          activity_events ( like_count, comment_count )
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      toast.error(error.message)
    } else {
      setBroadcasts(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchBroadcasts()
  }, [])

  async function handleSave() {
    if (!formData.title || !formData.body) {
      toast.error('Title and body are required')
      return
    }

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    
    const payload = {
      ...formData,
      created_by: user?.id,
      status: 'draft',
      target_mode: 'all',
    }

    let error
    if (editingId) {
      const { error: err } = await supabase
        .schema('future')
        .from('admin_broadcasts')
        .update(payload)
        .eq('broadcast_id', editingId)
      error = err
    } else {
      const { error: err } = await supabase
        .schema('future')
        .from('admin_broadcasts')
        .insert([payload])
      error = err
    }

    if (error) {
      toast.error(error.message)
    } else {
      toast.success(editingId ? 'Broadcast updated' : 'Broadcast created as draft')
      setModalOpen(false)
      fetchBroadcasts()
      resetForm()
    }
    setSaving(false)
  }

  async function publishBroadcast(id: string) {
    const { data, error } = await supabase.rpc('publish_admin_broadcast', { broadcast_id: id })
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Broadcast published to all users')
      fetchBroadcasts()
    }
  }

  async function retractBroadcast(id: string) {
    const { error } = await supabase.rpc('retract_admin_broadcast', { broadcast_id: id })
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Broadcast retracted')
      fetchBroadcasts()
    }
  }

  async function deleteBroadcast(id: string) {
    const { error } = await supabase
      .schema('future')
      .from('admin_broadcasts')
      .delete()
      .eq('broadcast_id', id)
    
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Broadcast deleted')
      fetchBroadcasts()
    }
  }

  function resetForm() {
    setFormData({
      title: '',
      body: '',
      accent_color: '#7F77DD',
      image_url: '',
    })
    setEditingId(null)
  }

  function openEdit(b: Broadcast) {
    setFormData({
      title: b.title,
      body: b.body,
      accent_color: b.accent_color,
      image_url: b.image_url || '',
    })
    setEditingId(b.broadcast_id)
    setModalOpen(true)
  }

  if (loading) return <Spinner />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <button className="btn btn-blue" onClick={() => { resetForm(); setModalOpen(true); }}>
          <Plus size={16} /> Create Broadcast
        </button>
      </div>

      <Card>
        {broadcasts.length === 0 ? (
          <EmptyState message="No broadcasts found" />
        ) : (
          <table className="og-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Stats</th>
                <th>Target</th>
                <th>Created</th>
                <th>Published At</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {broadcasts.map(b => (
                <tr key={b.broadcast_id}>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{b.title}</td>
                  <td>
                    <Badge 
                      label={b.status} 
                      variant={b.status === 'published' ? 'green' : b.status === 'draft' ? 'grey' : 'red'} 
                    />
                  </td>
                  <td>
                    {b.admin_broadcast_deliveries?.activity_events ? (
                      <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                        <span title="Likes">❤️ {b.admin_broadcast_deliveries.activity_events.like_count}</span>
                        <span title="Comments">💬 {b.admin_broadcast_deliveries.activity_events.comment_count}</span>
                      </div>
                    ) : '—'}
                  </td>
                  <td>{b.target_mode === 'all' ? 'All Users' : 'Specific Clans'}</td>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {new Date(b.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {b.published_at ? new Date(b.published_at).toLocaleDateString() : '—'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      {b.status === 'draft' && (
                        <>
                          <button className="btn-icon" title="Publish" onClick={() => publishBroadcast(b.broadcast_id)}>
                            <Send size={14} />
                          </button>
                          <button className="btn-icon" title="Edit" onClick={() => openEdit(b)}>
                            <Pencil size={14} />
                          </button>
                          <button className="btn-icon" style={{ color: '#EF4444' }} title="Delete" onClick={() => setConfirmDelete(b.broadcast_id)}>
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                      {b.status === 'published' && (
                        <>
                          <button 
                            className="btn-icon" 
                            title="View comments"
                            onClick={() => {
                              const eId = b.admin_broadcast_deliveries?.event_id
                              if (eId) setActiveComments({ bId: b.broadcast_id, eId })
                            }}
                          >
                            <MessageCircle size={14} />
                          </button>
                          <button className="btn-icon" title="Retract" onClick={() => setConfirmRetract(b.broadcast_id)}>
                            <Undo2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Create/Edit Modal */}
      <Modal 
        open={modalOpen} 
        onClose={() => setModalOpen(false)} 
        title={editingId ? "Edit Broadcast" : "New Broadcast"}
        subtitle="Craft a high-impact message for the community"
      >
        <div style={{ display: 'flex', gap: 32, marginTop: 16 }}>
          {/* Editor Side */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Content Section */}
            <div style={{ background: 'var(--bg-base)', padding: 20, borderRadius: 20, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
                <Type size={16} className="text-secondary" />
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Post Content</span>
              </div>
              
              <FormGroup label="Title">
                <div style={{ position: 'relative' }}>
                  <input 
                    type="text" 
                    className="og-input" 
                    maxLength={120}
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    placeholder="E.g. Weekend Warriors Challenge ⚡️"
                    style={{ fontSize: 14, padding: '12px 16px' }}
                  />
                  <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--text-muted)' }}>
                    {formData.title.length}/120
                  </div>
                </div>
              </FormGroup>

              <FormGroup label="Announcement Body">
                <div style={{ position: 'relative' }}>
                  <textarea 
                    className="og-input" 
                    style={{ minHeight: 140, resize: 'none', fontSize: 14, paddingTop: 12 }}
                    maxLength={2000}
                    value={formData.body}
                    onChange={e => setFormData({ ...formData, body: e.target.value })}
                    placeholder="Share the details..."
                  />
                  <div style={{ position: 'absolute', right: 12, bottom: 12, fontSize: 10, color: 'var(--text-muted)' }}>
                    {formData.body.length}/2000
                  </div>
                </div>
              </FormGroup>
            </div>

            {/* Aesthetics Section */}
            <div style={{ background: 'var(--bg-base)', padding: 20, borderRadius: 20, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
                <Palette size={16} className="text-secondary" />
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Visual Style</span>
              </div>

              <div style={{ display: 'flex', gap: 20 }}>
                <div style={{ flex: 1 }}>
                  <FormGroup label="Accent Theme">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {BRAND_COLORS.map(c => (
                          <button
                            key={c.value}
                            onClick={() => setFormData({ ...formData, accent_color: c.value })}
                            style={{
                              width: 32, height: 32, borderRadius: 8, background: c.value,
                              border: formData.accent_color === c.value ? '2px solid var(--text-primary)' : '2px solid transparent',
                              cursor: 'pointer', transition: 'all 0.2s',
                              display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                            title={c.name}
                          >
                            {formData.accent_color === c.value && <CheckCircle2 size={14} color={c.value === '#D7F2F4' ? '#000' : '#fff'} />}
                          </button>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <div style={{ 
                          width: 34, height: 34, borderRadius: 8, background: formData.accent_color, 
                          border: '1px solid var(--border)', flexShrink: 0 
                        }} />
                        <input 
                          type="text" 
                          className="og-input" 
                          style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 12, height: 34 }}
                          value={formData.accent_color}
                          onChange={e => setFormData({ ...formData, accent_color: e.target.value })}
                        />
                      </div>
                    </div>
                  </FormGroup>
                </div>
                <div style={{ flex: 1 }}>
                  <FormGroup label="Cover URL (Optional)">
                    <div style={{ position: 'relative' }}>
                      <ImageIcon size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input 
                        type="text" 
                        className="og-input" 
                        style={{ paddingLeft: 34 }}
                        value={formData.image_url || ''}
                        onChange={e => setFormData({ ...formData, image_url: e.target.value })}
                        placeholder="https://..."
                      />
                    </div>
                  </FormGroup>
                </div>
              </div>
            </div>

            <ModalActions>
              <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Discard</button>
              <button className="btn btn-blue" style={{ paddingInline: 32 }} onClick={handleSave} disabled={saving}>
                {saving ? 'Processing...' : editingId ? (
                  <><Sparkles size={16} /> Update Broadcast</>
                ) : (
                  <><Send size={16} /> Create Broadcast</>
                )}
              </button>
            </ModalActions>
          </div>

          {/* Premium Preview Side */}
          <div style={{ width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ 
              fontSize: 10, fontWeight: 700, textTransform: 'uppercase', 
              color: 'var(--text-muted)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 
            }}>
              <Smartphone size={14} className="live-dot" /> High-Fideli Preview
            </div>
            
            {/* Phone Mockup */}
            <div style={{ 
              width: '100%', aspectRatio: '9/18.5', background: '#000', borderRadius: 48, padding: 12,
              border: '12px solid #1A1B1E', boxShadow: '0 40px 100px -20px rgba(0,0,0,0.6)', 
              position: 'relative', overflow: 'hidden'
            }}>
              {/* Screen Content */}
              <div style={{ 
                background: '#F9FAFB', width: '100%', height: '100%', borderRadius: 36, 
                overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative'
              }}>
                {/* Device Island */}
                <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 80, height: 24, background: '#1A1B1E', borderBottomLeftRadius: 12, borderBottomRightRadius: 12, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#2B2C30' }} />
                </div>

                {/* Status Bar */}
                <div style={{ height: 44, display: 'flex', justifyContent: 'space-between', padding: '16px 20px 0', alignItems: 'center', fontSize: 10, fontWeight: 700, color: '#000' }}>
                  <span>9:41</span>
                  <div style={{ display: 'flex', gap: 6 }}>📶 🔋</div>
                </div>

                {/* App Content Area */}
                <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Mock Navbar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--sa-grad)' }} />
                    <div style={{ height: 12, width: 80, background: '#E5E7EB', borderRadius: 6 }} />
                  </div>

                  {/* Broadcast Card Preview */}
                  <div style={{ 
                    borderRadius: 20, 
                    border: `1px solid ${formData.accent_color}40`,
                    background: '#fff',
                    boxShadow: '0 8px 24px -6px rgba(0,0,0,0.1)',
                    overflow: 'hidden',
                    transform: 'translateY(0)',
                    transition: 'all 0.3s ease'
                  }}>
                    {/* Header */}
                    <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: `1px solid ${formData.accent_color}1a` }}>
                      <div style={{ 
                        width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #18191E, #D7F2F4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#fff', fontWeight: 800
                      }}>FT</div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#111827' }}>Fitnessers</div>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Now • Announcement</div>
                      </div>
                    </div>

                    {/* Image */}
                    {formData.image_url ? (
                      <div style={{ width: '100%', aspectRatio: '16/9', background: '#F3F4F6' }}>
                        <img 
                          src={formData.image_url} 
                          alt="preview" 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                      </div>
                    ) : (
                      <div style={{ height: 4, background: formData.accent_color }} />
                    )}

                    {/* Body */}
                    <div style={{ padding: '14px 14px 12px' }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#111827', marginBottom: 6, lineHeight: 1.3 }}>
                        {formData.title || 'Broadcast Title'}
                      </div>
                      <div style={{ fontSize: 11.5, color: '#4B5563', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {formData.body || "Click the editor to start writing your message..."}
                      </div>
                    </div>

                    {/* Actions Mock */}
                    <div style={{ padding: '10px 14px', borderTop: '1px solid #F3F4F6', display: 'flex', gap: 16 }}>
                      <div style={{ fontSize: 10, color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 4 }}>❤️ 24</div>
                      <div style={{ fontSize: 10, color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 4 }}>💬 12</div>
                    </div>
                  </div>

                  {/* Mock Background Skeletons */}
                  <div style={{ height: 100, width: '100%', background: '#F3F4F6', borderRadius: 20, opacity: 0.5 }} />
                </div>
              </div>
              
              {/* Screen Reflection */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(130deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 40%, rgba(255,255,255,0) 60%, rgba(255,255,255,0.02) 100%)', pointerEvents: 'none', borderRadius: 36, zIndex: 20 }} />
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmModal 
        open={confirmRetract !== null}
        onClose={() => setConfirmRetract(null)}
        onConfirm={() => confirmRetract && retractBroadcast(confirmRetract)}
        title="Retract Broadcast"
        message="This will remove the post from all users' feeds. Are you sure you want to continue?"
        confirmText="Retract"
        variant="red"
      />

      <ConfirmModal 
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && deleteBroadcast(confirmDelete)}
        title="Delete Draft"
        message="Are you sure you want to delete this draft broadcast? This action cannot be undone."
        confirmText="Delete"
        variant="red"
      />

      {activeComments && (
        <CommentPanel 
          broadcastId={activeComments.bId}
          eventId={activeComments.eId}
          onClose={() => setActiveComments(null)}
        />
      )}
    </div>
  )
}
