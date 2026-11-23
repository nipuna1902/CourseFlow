import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'

// errors where retrying can never help (Razorpay should stop sending)
class NoRetryError extends Error { }

function signatureMatches(rawBody: string, received: string) {
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest('hex')
  const a = Buffer.from(expected, 'hex')
  const b = Buffer.from(received, 'hex')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

async function handleEvent(type: string, event: any) {
  const payment = event?.payload?.payment?.entity

  // success events: finish the purchase (same function the verify route uses)
  if (type === 'payment.captured' || type === 'order.paid') {
    const orderId = payment?.order_id
    const paymentId = payment?.id
    if (!orderId || !paymentId) throw new NoRetryError('missing order or payment id')

    const { error } = await supabaseAdmin.rpc('fulfill_payment', {
      p_order_id: orderId,
      p_payment_id: paymentId,
    })
    if (error) {
      if (error.message?.includes('payment_not_found')) throw new NoRetryError(error.message)
      throw new Error(error.message) // temporary problem: let Razorpay retry
    }
    return
  }

  // NEW: bank authorized the payment but it isn't captured yet: waiting, not failed
  if (type === 'payment.authorized') {
    const orderId = payment?.order_id
    if (!orderId) throw new NoRetryError('missing order id')

    const { error } = await supabaseAdmin
      .from('payments')
      .update({ status: 'pending', updated_at: new Date().toISOString() })
      .eq('razorpay_order_id', orderId)
      .in('status', ['created', 'failed', 'cancelled'])
    if (error) throw new Error(error.message)
    return
  }

  // failure event: record it, but never overwrite a payment that is already paid
  if (type === 'payment.failed') {
    const orderId = payment?.order_id
    if (!orderId) throw new NoRetryError('missing order id')

    const { error } = await supabaseAdmin
      .from('payments')
      .update({
        status: 'failed',
        failure_reason: payment?.error_description ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('razorpay_order_id', orderId)
      .neq('status', 'paid')
    if (error) throw new Error(error.message)
    return
  }

  // any other event type is stored for the audit trail, nothing else to do
}

export async function POST(req: Request) {
  // 1. raw body, exactly as Razorpay sent it (needed for the signature)
  const rawBody = await req.text()
  const signature = req.headers.get('x-razorpay-signature')
  const eventId = req.headers.get('x-razorpay-event-id')

  // 2. authenticity
  if (!signature || !signatureMatches(rawBody, signature)) {
    return new NextResponse('invalid signature', { status: 400 })
  }
  if (!eventId) return new NextResponse('missing event id', { status: 400 })

  let event: any
  try {
    event = JSON.parse(rawBody)
  } catch {
    return new NextResponse('invalid json', { status: 400 })
  }
  const eventType = String(event?.event ?? 'unknown')

  // 3. durable receipt + duplicate detection, enforced by the database's unique index
  const { error: insertError } = await supabaseAdmin.from('webhook_events').insert({
    razorpay_event_id: eventId,
    event_type: eventType,
    payload: event,
    status: 'received',
  })

  if (insertError) {
    if (insertError.code !== '23505') {
      console.error('webhook_events insert failed', insertError)
      return new NextResponse('could not record event', { status: 500 })
    }
    // we have seen this event id before
    const { data: existing } = await supabaseAdmin
      .from('webhook_events')
      .select('status, attempts')
      .eq('razorpay_event_id', eventId)
      .single()

    if (existing?.status === 'processed') {
      return NextResponse.json({ ok: true, duplicate: true }) // already done, acknowledge
    }
    // earlier attempt failed or crashed midway: process it again
    await supabaseAdmin
      .from('webhook_events')
      .update({ attempts: (existing?.attempts ?? 1) + 1 })
      .eq('razorpay_event_id', eventId)
  }

  // 4. do the business work, then mark the event
  try {
    await handleEvent(eventType, event)
    await supabaseAdmin
      .from('webhook_events')
      .update({ status: 'processed', processed_at: new Date().toISOString(), error: null })
      .eq('razorpay_event_id', eventId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('webhook processing failed', eventId, message)
    await supabaseAdmin
      .from('webhook_events')
      .update({ status: 'failed', error: message })
      .eq('razorpay_event_id', eventId)

    // retryable problem -> 500 so Razorpay delivers again; unrecoverable -> 200 so it stops
    return NextResponse.json({ ok: false }, { status: e instanceof NoRetryError ? 200 : 500 })
  }
}