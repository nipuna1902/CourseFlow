import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

type Outcome = 'cancelled' | 'failed'

// which existing states a browser report may replace.
// 'pending' and 'paid' are never touched: money may have moved.
const ALLOWED_FROM: Record<Outcome, string[]> = {
  cancelled: ['created'],
  failed: ['created', 'cancelled'],
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Please sign in' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const orderId = body?.orderId
  const rawOutcome = body?.outcome

  if (typeof orderId !== 'string' || (rawOutcome !== 'cancelled' && rawOutcome !== 'failed')) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const outcome: Outcome = rawOutcome

  const update: Record<string, unknown> = {
    status: outcome,
    updated_at: new Date().toISOString(),
  }
  if (outcome === 'failed') {
    // the text comes from the browser, so keep it short and treat it as untrusted
    update.failure_reason =
      typeof body?.reason === 'string' ? body.reason.slice(0, 200) : 'payment failed'
  }

  const { error } = await supabaseAdmin
    .from('payments')
    .update(update)
    .eq('razorpay_order_id', orderId)
    .eq('user_id', user.id)                 // only your own order
    .in('status', ALLOWED_FROM[outcome])    // only if still unpaid

  if (error) {
    console.error('report failed', error)
    return NextResponse.json({ error: 'Could not record outcome' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}