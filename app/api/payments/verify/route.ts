import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { getCurrentUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

function signatureMatches(expected: string, received: string) {
  const a = Buffer.from(expected, 'hex')//converts hexadecimal strings into byte buffers
  const b = Buffer.from(received, 'hex')
  return a.length === b.length && crypto.timingSafeEqual(a, b)//compares them in a way designed to avoid timing-based information leaks
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

  // 3. verify Razorpay's signature, using sha256 hashing algo
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
    await supabaseAdmin
      .from('payments')
      .update({
        status: 'pending',
        failure_reason: 'verified, but enrollment processing failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment.id)
      .in('status', ['created', 'failed', 'cancelled'])

    return NextResponse.json(
      { error: 'Payment received, but we could not finish enrollment yet' },
      { status: 500 }
    )
  }
}