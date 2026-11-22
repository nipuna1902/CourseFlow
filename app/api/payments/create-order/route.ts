import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getCurrentUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { razorpay } from '@/lib/razorpay'

export async function POST(req: Request) {
  // 1. Verify logged-in user
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json(
      { error: 'Please sign in' },
      { status: 401 }
    )
  }

  // 2. Get course ID from request
  const body = await req.json().catch(() => null)
  const courseId = body?.courseId

  if (typeof courseId !== 'string') {
    return NextResponse.json(
      { error: 'courseId required' },
      { status: 400 }
    )
  }

  // 3. Fetch course from database
  const { data: course, error: courseError } = await supabaseAdmin
    .from('courses')
    .select('id, title, price_paise, is_published')
    .eq('id', courseId)
    .single()

  if (courseError) {
    console.error('Course fetch error:', courseError)

    return NextResponse.json(
      { error: courseError.message },
      { status: 500 }
    )
  }

  if (!course || !course.is_published) {
    return NextResponse.json(
      { error: 'Course not found' },
      { status: 404 }
    )
  }

  // 4. Check if user already owns the course
  const { data: existing, error: enrollmentError } = await supabaseAdmin
    .from('enrollments')
    .select('id')
    .eq('user_id', user.id)
    .eq('course_id', course.id)
    .eq('status', 'active')
    .maybeSingle()

  if (enrollmentError) {
    console.error('Enrollment check error:', enrollmentError)

    return NextResponse.json(
      { error: 'Could not check enrollment' },
      { status: 500 }
    )
  }

  if (existing) {
    return NextResponse.json(
      { error: 'You already own this course' },
      { status: 409 }
    )
  }

  // 5. Create Razorpay order
  const paymentId = randomUUID()

  let order

  try {
    order = await razorpay.orders.create({
      amount: course.price_paise,
      currency: 'INR',
      receipt: paymentId,
      notes: {
        payment_id: paymentId,
        user_id: user.id,
        course_id: course.id,
      },
    })
  } catch (error) {
    console.error('Razorpay order creation failed:', error)

    return NextResponse.json(
      { error: 'Could not start payment' },
      { status: 502 }
    )
  }

  // 6. Record payment in database
  const { error: paymentError } = await supabaseAdmin
    .from('payments')
    .insert({
      id: paymentId,
      user_id: user.id,
      course_id: course.id,
      razorpay_order_id: order.id,
      amount_paise: course.price_paise,
      currency: 'INR',
      status: 'created',
    })

  if (paymentError) {
    console.error('Payment insert failed:', paymentError)

    return NextResponse.json(
      { error: 'Could not record payment' },
      { status: 500 }
    )
  }

  // 7. Return order details to frontend
  return NextResponse.json({
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId: process.env.RAZORPAY_KEY_ID,
  })
}