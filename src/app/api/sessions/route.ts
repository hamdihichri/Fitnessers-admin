export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
    const sb = createAdminClient()
    const debug = req.nextUrl.searchParams.get('debug') === '1'

    // Use local time so session times match DB
    const TZ = 'Africa/Tunis'
    const nowDate = new Date()
    const today = nowDate.toLocaleDateString('en-CA', { timeZone: TZ })  // "YYYY-MM-DD"
    const nowTime = nowDate.toLocaleTimeString('en-GB', { hour12: false, timeZone: TZ }) // "HH:mm:ss"

    // DB uses 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun
    // JS getDay() returns 0=Sun, 1=Mon … 6=Sat — remap Sunday from 0 to 7
    const jsDow = new Date(nowDate.toLocaleString('en-US', { timeZone: TZ })).getDay()
    const dayOfWeek = jsDow === 0 ? 7 : jsDow

    try {
        // 1. Fetch all gyms (no deleted_at filter — sessions reference gym IDs that may be "deleted")
        const { data: gyms, error: gErr } = await sb
            .from('gyms')
            .select('gym_id, name, city, default_token_price')

        if (gErr) throw gErr

        // 2. Fetch open sessions for today's day_of_week
        // NOTE: table has start_time + duration_minutes, no end_time column
        // Filter is_open = true to only get currently open sessions
        const { data: allSessions, error: sErr } = await sb
            .from('gym_weekly_sessions')
            .select('*')
            .eq('day_of_week', dayOfWeek)
            .eq('is_open', true)

        if (sErr) throw sErr

        // DEBUG: return raw data so we can inspect real column names + values
        if (debug) {
            return NextResponse.json({
                computed: { today, dayOfWeek, jsDow, nowTime, tz: TZ },
                sessions_count: (allSessions ?? []).length,
                sessions_sample: (allSessions ?? []).slice(0, 5),
                gyms_count: (gyms ?? []).length,
                gyms_sample: (gyms ?? []).slice(0, 3),
            })
        }

        // 3. Fetch today's bookings and check-ins per gym
        const [bookingsRes, checkinsRes] = await Promise.all([
            sb.from('gym_session_bookings').select('gym_id').eq('session_date', today),
            sb.from('gym_checkins').select('gym_id').gte('checked_in_at', today + 'T00:00:00')
        ])

        const bookingMap: Record<string, number> = {}
        bookingsRes.data?.forEach(b => { bookingMap[b.gym_id] = (bookingMap[b.gym_id] || 0) + 1 })

        const checkinMap: Record<string, number> = {}
        checkinsRes.data?.forEach(c => { checkinMap[c.gym_id] = (checkinMap[c.gym_id] || 0) + 1 })

        // Build a gym lookup map
        const gymMap: Record<number, any> = {}
            ; (gyms ?? []).forEach(g => { gymMap[g.gym_id] = g })

        // 4. For each open session, attach gym info + counts
        const results = (allSessions ?? [])
            .map(s => {
                const gym = gymMap[s.gym_id]
                if (!gym) return null

                // Compute end time from start_time + duration_minutes
                const [h, m] = (s.start_time as string).split(':').map(Number)
                const startMinutes = h * 60 + m
                const endMinutes = startMinutes + (s.duration_minutes ?? 120)
                const endH = String(Math.floor(endMinutes / 60) % 24).padStart(2, '0')
                const endM = String(endMinutes % 60).padStart(2, '0')
                const end_time = `${endH}:${endM}:00`

                const is_current = s.start_time <= nowTime && end_time >= nowTime

                return {
                    gym_id: gym.gym_id,
                    gym_name: gym.name,
                    city: gym.city,
                    default_token_price: gym.default_token_price ?? null,
                    is_current,
                    active_session: {
                        weekly_session_id: s.weekly_session_id,
                        start_time: s.start_time,
                        end_time,
                        duration_minutes: s.duration_minutes,
                        discounted_token_price: s.discounted_token_price ?? null,
                        slots: s.slots ?? null,
                        women_only: s.women_only ?? false,
                    },
                    bookings_count: bookingMap[s.gym_id] || 0,
                    checkins_count: checkinMap[s.gym_id] || 0,
                }
            })
            .filter(Boolean)

        results.sort((a: any, b: any) => a.gym_name.localeCompare(b.gym_name))

        return NextResponse.json(results)
    } catch (error: any) {
        console.error('Sessions API Error:', error)
        return NextResponse.json({ error: error.message }, { status: 400 })
    }
}

export async function PATCH(req: NextRequest) {
    const sb = createAdminClient()
    const { weekly_session_id, ...updates } = await req.json()
    if (!weekly_session_id) return NextResponse.json({ error: 'weekly_session_id required' }, { status: 400 })
    const { error } = await sb.from('gym_weekly_sessions').update(updates).eq('weekly_session_id', weekly_session_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
}
