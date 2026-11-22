import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getCurrentUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { razorpay } from '@/lib/razorpay'

export async function POST(req: Request) {
  // 1. who is this?
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Please sign in' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const courseId = body?.courseId
  if (typeof courseId !== 'string') {
    return NextResponse.json({ error: 'courseId required' }, { status: 400 })
  }

  // 2. price comes from OUR database
  const { data: course } = await supabaseAdmin
    .from('courses')
    .select('id, title, price_paise, currency, is_published')
    .eq('id', courseId)
    .single()
  if (!course || !course.is_published) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  }

  // 3. already enrolled? don't take money twice
  const { data: existing } = await supabaseAdmin
    .from('enrollments')
    .select('id')
    .eq('user_id', user.id)
    .eq('course_id', course.id)
    .eq('status', 'active')
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ error: 'You already own this course' }, { status: 409 })
  }

  // 4. create the order at Razorpay, then record it
  const paymentId = randomUUID() // doubles as our row id AND the receipt
  let order
  try {
    order = await razorpay.orders.create({
      amount: course.price_paise,
      currency: course.currency,
      receipt: paymentId,
      notes: { payment_id: paymentId, user_id: user.id, course_id: course.id },
    })
  } catch (e) {
    console.error('razorpay order create failed', e)
    return NextResponse.json({ error: 'Could not start payment' }, { status: 502 })
  }

  const { error } = await supabaseAdmin.from('payments').insert({
    id: paymentId,
    user_id: user.id,
    course_id: course.id,
    razorpay_order_id: order.id,
    amount_paise: course.price_paise,
    currency: course.currency,
    status: 'created',
  })
  if (error) {
    console.error('payment insert failed', error)
    return NextResponse.json({ error: 'Could not record payment' }, { status: 500 })
  }

  return NextResponse.json({
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId: process.env.RAZORPAY_KEY_ID,
  })
}