'use client'
import { useState, useEffect, useRef } from 'react'
import { createBrowserClient } from '@/lib/supabaseBrowser'
import { Spinner, EmptyState, Badge, toast } from '@/components/ui'
import { X, MessageSquare, Send, Reply } from 'lucide-react'
import { timeAgo, initials } from '@/lib/utils'

interface Profile {
  username: string | null
  photo_path: string | null
  avatar_url: string | null
}

interface Comment {
  comment_id: string
  event_id: string
  user_id: string
  body: string
  parent_comment_id: string | null
  created_at: string
  reply_count: number
  profile: Profile | null
}

interface CommentPanelProps {
  broadcastId: string
  eventId: string
  onClose: () => void
}

export function CommentPanel({ broadcastId, eventId, onClose }: CommentPanelProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null)
  const [replyBody, setReplyBody] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const supabase = createBrowserClient()

  async function fetchComments() {
    setLoading(true)
    // Step 1: fetch comments
    const { data: commentsData, error: commentsError } = await supabase
      .schema('future')
      .from('post_comments')
      .select('comment_id, event_id, user_id, body, parent_comment_id, reply_count, created_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true })

    if (commentsError) {
      toast.error(commentsError.message)
      setLoading(false)
      return
    }

    if (!commentsData || commentsData.length === 0) {
      setComments([])
      setLoading(false)
      return
    }

    // Step 2: get unique user_ids
    const userIds = [...new Set(commentsData.map(c => c.user_id))]

    // Step 3: fetch profiles
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, username, photo_path, avatar_url')
      .in('user_id', userIds)

    if (profilesError) {
      toast.error(profilesError.message)
      // We can still show comments without profiles
      setComments(commentsData.map(c => ({ ...c, profile: null })) as any)
    } else {
      // Step 4: merge
      const profileMap = Object.fromEntries(profilesData.map(p => [p.user_id, p]))
      const enriched = commentsData.map(c => ({
        ...c,
        profile: profileMap[c.user_id] ?? null
      }))
      setComments(enriched as any)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchComments()
  }, [eventId])

  async function handleSendReply() {
    if (!replyBody.trim()) return

    setSending(true)
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      toast.error('You must be logged in to reply')
      setSending(false)
      return
    }

    const { error } = await supabase
      .schema('future')
      .from('post_comments')
      .insert([{
        event_id: eventId,
        user_id: user.id,
        body: replyBody,
        parent_comment_id: replyingTo ? replyingTo.comment_id : null
      }])

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Reply sent')
      setReplyBody('')
      setReplyingTo(null)
      fetchComments()
    }
    setSending(false)
  }

  // Organize comments into thread
  const topLevelComments = comments.filter(c => !c.parent_comment_id)
  const replies = comments.filter(c => c.parent_comment_id)

  function getReplies(parentId: string) {
    return replies.filter(r => r.parent_comment_id === parentId)
  }

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, width: 450, height: '100vh',
      background: 'var(--bg-topbar)', borderLeft: '1px solid var(--border)',
      boxShadow: '-10px 0 30px rgba(0,0,0,0.1)', zIndex: 100,
      display: 'flex', flexDirection: 'column', animation: 'slideInRight 0.3s ease-out'
    }}>
      {/* Header */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <MessageSquare size={18} /> Discussion
          </h2>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Event ID: {eventId.substring(0, 8)}...</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
          <X size={20} />
        </button>
      </div>

      {/* Content */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {loading ? <Spinner /> : topLevelComments.length === 0 ? <EmptyState message="No comments yet" /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {topLevelComments.map(c => (
              <div key={c.comment_id}>
                {/* Main Comment */}
                <CommentItem 
                  comment={c} 
                  onReply={() => setReplyingTo(c)} 
                />
                
                {/* Replies */}
                {getReplies(c.comment_id).length > 0 && (
                  <div style={{ marginLeft: 40, marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16, borderLeft: '2px solid var(--border)', paddingLeft: 16 }}>
                    {getReplies(c.comment_id).map(r => (
                      <CommentItem key={r.comment_id} comment={r} isReply />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Composer */}
      <div style={{ padding: 20, borderTop: '1px solid var(--border)', background: 'var(--bg-base)' }}>
        {replyingTo && (
          <div style={{ 
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
            background: 'var(--bg-topbar)', padding: '6px 12px', borderRadius: 8, marginBottom: 12,
            fontSize: 12, border: '1px solid var(--border)'
          }}>
            <span style={{ color: 'var(--text-secondary)' }}>
              Replying to <strong>@{replyingTo.profile?.username || 'User'}</strong>
            </span>
            <button 
              onClick={() => setReplyingTo(null)}
              style={{ background: 'none', border: 'none', fontSize: 10, cursor: 'pointer', color: '#EF4444', fontWeight: 600 }}
            >
              Cancel
            </button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <textarea 
            className="og-input"
            rows={2}
            placeholder={replyingTo ? "Write a reply..." : "Write a comment as Fitnessers Team..."}
            value={replyBody}
            onChange={e => setReplyBody(e.target.value)}
            style={{ resize: 'none', fontSize: 13 }}
          />
          <button 
            className="btn btn-blue" 
            style={{ padding: '10px 16px', borderRadius: 10 }}
            onClick={handleSendReply}
            disabled={sending || !replyBody.trim()}
          >
            {sending ? '...' : <Send size={16} />}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}

function CommentItem({ comment, onReply, isReply = false }: { comment: Comment, onReply?: () => void, isReply?: boolean }) {
  const photo = comment.profile?.photo_path || comment.profile?.avatar_url
  
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <div style={{ 
        width: isReply ? 28 : 34, 
        height: isReply ? 28 : 34, 
        borderRadius: '50%', 
        overflow: 'hidden', 
        background: 'var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0
      }}>
        {photo ? (
          <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontSize: isReply ? 10 : 12, fontWeight: 700, color: 'var(--text-muted)' }}>
            {initials(comment.profile?.username || 'User')}
          </span>
        )}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontWeight: 700, fontSize: 13 }}>@{comment.profile?.username || 'User'}</span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{timeAgo(comment.created_at)}</span>
          {comment.reply_count > 0 && !isReply && (
            <Badge label={`${comment.reply_count} replies`} variant="grey" />
          )}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5, marginBottom: 8 }}>
          {comment.body}
        </div>
        {onReply && (
          <button 
            onClick={onReply}
            style={{ 
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--blue-500)', 
              fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, padding: 0 
            }}
          >
            <Reply size={12} /> Reply
          </button>
        )}
      </div>
    </div>
  )
}
