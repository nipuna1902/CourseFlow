import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { getCurrentUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

function signatureMatches(expected: string, received: string) {
  const a = Buffer.from(expected, 'hex')
  const b = Buffer.from(received, 'hex')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

export async function POST(req: Request) {
  // 1. who is calling?
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Please sign in' }, { status: 401 })
  }

  // 2. read and check the body
  const body = await req.json().catch(() => null)
  const orderId = body?.razorpay_order_id
  const paymentId = body?.razorpay_payment_id
  const signature = body?.razorpay_signature

  if (
    typeof orderId !== 'string' ||
    typeof paymentId !== 'string' ||
    typeof signature !== 'string'
  ) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // 3. verify Razorpay's signature
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(`${orderId}|${paymentId}`)
    .digest('hex')

  if (!signatureMatches(expected, signature)) {
    return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 })
  }

  // 4. this order must belong to the logged-in student
  const { data: payment } = await supabaseAdmin
    .from('payments')
    .select('id')
    .eq('razorpay_order_id', orderId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!payment) {
    return NextResponse.json({ error: 'Payment record not found' }, { status: 404 })
  }

  // 5. mark paid + create enrollment in ONE transaction (safe to repeat)
  const { data: enrollmentId, error } = await supabaseAdmin.rpc('fulfill_payment', {
    p_order_id: orderId,
    p_payment_id: paymentId,
  })

  if (error) {
    console.error('fulfill_payment failed', error)
    return NextResponse.json(
      { error: 'Payment received, but we could not finish enrollment yet' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, enrollmentId })
}