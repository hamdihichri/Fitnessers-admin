'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabaseBrowser'
import { 
  Card, Spinner, EmptyState, Badge, UserCell, toast 
} from '@/components/ui'
import { Search, ChevronRight, Users, Trophy, Calendar } from 'lucide-react'

interface Clan {
  clan_id: string
  root_user_id: string
  name: string
  tag: string
  total_score: number
  member_count: number
  logo_url: string | null
  created_at: string
}

interface ClanMember {
  user_id: string
  joined_at: string
  profile: {
    username: string | null
    full_name: string | null
    avatar_url: string | null
  } | null
}

export function ClansTab() {
  const [clans, setClans] = useState<Clan[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedClan, setSelectedClan] = useState<Clan | null>(null)
  const [members, setMembers] = useState<ClanMember[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)

  const supabase = createBrowserClient()

  async function fetchClans() {
    setLoading(true)
    const { data, error } = await supabase
      .schema('future')
      .from('clans')
      .select('*')
      .order('total_score', { ascending: false })

    if (!error) setClans(data || [])
    setLoading(false)
  }

  async function fetchMembers(clanId: string) {
    setLoadingMembers(true)
    // Step 1: fetch clan members
    const { data: membersData, error: membersError } = await supabase
      .schema('future')
      .from('clan_members')
      .select('user_id, joined_at')
      .eq('clan_id', clanId)
      .eq('is_active', true)
      .order('joined_at', { ascending: true })

    if (membersError) {
      toast.error(membersError.message)
      setLoadingMembers(false)
      return
    }

    if (!membersData || membersData.length === 0) {
      setMembers([])
      setLoadingMembers(false)
      return
    }

    // Step 2: get unique user_ids
    const userIds = [...new Set(membersData.map(m => m.user_id))]

    // Step 3: fetch profiles
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, username, full_name, avatar_url')
      .in('user_id', userIds)

    if (profilesError) {
      toast.error(profilesError.message)
      setMembers(membersData.map(m => ({ ...m, profile: null })) as any)
    } else {
      // Step 4: merge
      const profileMap = Object.fromEntries(profilesData.map(p => [p.user_id, p]))
      const enriched = membersData.map(m => ({
        ...m,
        profile: profileMap[m.user_id] ?? null
      }))
      setMembers(enriched as any)
    }
    setLoadingMembers(false)
  }

  useEffect(() => {
    fetchClans()
  }, [])

  useEffect(() => {
    if (selectedClan) fetchMembers(selectedClan.clan_id)
  }, [selectedClan])

  const filteredClans = clans.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.tag.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ display: 'flex', gap: 24, height: 'calc(100vh - 200px)' }}>
      {/* Left side: List */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              className="og-input" 
              placeholder="Search clans by name or tag..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 36 }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? <Spinner /> : filteredClans.length === 0 ? <EmptyState message="No clans found" /> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {filteredClans.map(clan => (
                <div 
                  key={clan.clan_id}
                  className={`og-card clan-card${selectedClan?.clan_id === clan.clan_id ? ' selected' : ''}`}
                  onClick={() => setSelectedClan(clan)}
                  style={{ cursor: 'pointer', padding: 16, border: selectedClan?.clan_id === clan.clan_id ? '2px solid var(--blue-500)' : '1px solid var(--border)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{ 
                      width: 48, height: 48, borderRadius: 12, background: 'var(--bg-base)', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800,
                      border: '1px solid var(--border)', overflow: 'hidden'
                    }}>
                      {clan.logo_url ? <img src={clan.logo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : clan.name[0]}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{clan.name}</div>
                      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>#{clan.tag}</div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Users size={12} /> {clan.member_count}
                    </div>
                    <div style={{ fontSize: 11, color: '#F59E0B', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                      <Trophy size={12} /> {clan.total_score.toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right side: Detail Panel */}
      <div style={{ 
        width: 380, background: 'var(--bg-topbar)', borderLeft: '1px solid var(--border)', 
        padding: 24, display: 'flex', flexDirection: 'column', overflow: 'hidden' 
      }}>
        {selectedClan ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ 
                width: 80, height: 80, borderRadius: 20, background: 'var(--bg-base)', 
                margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                fontSize: 32, fontWeight: 800, border: '1px solid var(--border)', overflow: 'hidden'
              }}>
                {selectedClan.logo_url ? <img src={selectedClan.logo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : selectedClan.name[0]}
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{selectedClan.name}</h2>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>#{selectedClan.tag}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 32 }}>
              <div style={{ background: 'var(--bg-base)', padding: 12, borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>Score</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#F59E0B' }}>{selectedClan.total_score.toLocaleString()}</div>
              </div>
              <div style={{ background: 'var(--bg-base)', padding: 12, borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>Members</div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{selectedClan.member_count}</div>
              </div>
            </div>

            <div style={{ marginBottom: 12, fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calendar size={12} /> Established {new Date(selectedClan.created_at).toLocaleDateString()}
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                Members <Badge label={members.length.toString()} variant="grey" />
              </h3>
              
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {loadingMembers ? <Spinner /> : members.map(m => (
                  <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <UserCell 
                      name={m.profile?.full_name || m.profile?.username} 
                      email={m.profile?.username ? `@${m.profile.username}` : null} 
                    />
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      Joined {new Date(m.joined_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
            Select a clan to view details and members
          </div>
        )}
      </div>
    </div>
  )
}
