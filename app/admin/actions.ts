'use server'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { razorpay } from '@/lib/razorpay'

// only ever redirect back inside /admin (prevents open redirects)
function safeReturn(value: FormDataEntryValue | null) {
  const s = typeof value === 'string' ? value : '/admin'
  return s.startsWith('/admin') ? s : '/admin'
}

function back(returnTo: string, msg: string): never {
  const sep = returnTo.includes('?') ? '&' : '?'
  redirect(`${returnTo}${sep}msg=${encodeURIComponent(msg)}`)
}

export async function setEnrollmentStatus(formData: FormData) {
  const returnTo = safeReturn(formData.get('returnTo'))

  const admin = await requireAdmin() // checked again here: hiding a button is not security
  if (!admin) back(returnTo, 'Not allowed')

  const enrollmentId = formData.get('enrollmentId')
  const action = formData.get('action')
  const reason = formData.get('reason')
  if (typeof enrollmentId !== 'string' || (action !== 'revoked' && action !== 'restored')) {
    back(returnTo, 'Invalid request')
  }

  const { data, error } = await supabaseAdmin.rpc('admin_set_enrollment_status', {
    p_enrollment_id: enrollmentId,
    p_admin_id: admin.id,
    p_action: action,
    p_reason: typeof reason === 'string' ? reason.slice(0, 300) : null,
  })

  if (error) {
    console.error('admin_set_enrollment_status failed', error)
    back(
      returnTo,
      error.message.includes('already_has_active_enrollment')
        ? 'Cannot restore: the student already has another active enrollment for this course'
        : 'Could not update access'
    )
  }
  back(returnTo, data === action ? `Access ${action}` : `No change (${data})`)
}

// Recovery tool: ask Razorpay directly what happened to an order, and finish it if it was paid.
export async function recheckPayment(formData: FormData) {
  const returnTo = safeReturn(formData.get('returnTo'))

  const admin = await requireAdmin()
  if (!admin) back(returnTo, 'Not allowed')

  const orderId = formData.get('orderId')
  if (typeof orderId !== 'string') back(returnTo, 'Invalid request')

  let items: any[] = []
  try {
    const res: any = await razorpay.orders.fetchPayments(orderId)
    items = res?.items ?? []
  } catch (e) {
    console.error('razorpay fetchPayments failed', e)
    back(returnTo, 'Could not reach Razorpay')
  }

  const captured = items.find((p) => p.status === 'captured')
  if (!captured) {
    const seen = items.map((p) => p.status).join(', ') || 'no payments'
    back(returnTo, `Razorpay has no captured payment for this order (${seen})`)
  }

  // same idempotent function the verify route and the webhook use
  const { error } = await supabaseAdmin.rpc('fulfill_payment', {
    p_order_id: orderId,
    p_payment_id: captured.id,
  })
  if (error) {
    console.error('fulfill_payment failed during recheck', error)
    back(returnTo, 'Razorpay confirms payment, but finishing enrollment failed')
  }
  back(returnTo, 'Payment confirmed with Razorpay and enrollment completed')
}