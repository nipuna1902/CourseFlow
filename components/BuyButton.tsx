'use client'
import Script from 'next/script'
import { useState } from 'react'

declare global {
  interface Window { Razorpay: any }
}

async function report(orderId: string, outcome: 'cancelled' | 'failed', reason?: string) {
  try {
    await fetch('/api/payments/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, outcome, reason }),
    })
  } catch {
    // best effort: the webhook is the authoritative source for failures
  }
}

export default function BuyButton({ courseId, title }: { courseId: string; title: string }) {
  const [loading, setLoading] = useState(false)

  async function buy() {
    setLoading(true)
    const res = await fetch('/api/payments/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId }),
    })
    const data = await res.json()
    if (!res.ok) {
      alert(data.error)
      setLoading(false)
      return
    }

    let finished = false // becomes true once checkout reports success

    const rzp = new window.Razorpay({
      key: data.keyId,
      order_id: data.orderId,
      amount: data.amount,
      currency: data.currency,
      name: 'CourseFlow',
      description: title,
      handler: async (response: any) => {
        finished = true
        try {
          const verifyRes = await fetch('/api/payments/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(response),
          })
          const result = await verifyRes.json()

          if (!verifyRes.ok) {
            alert(
              result.error ||
              'We could not confirm your payment yet. If money was deducted, your access will be added shortly.'
            )
            return
          }

          alert('Payment successful! You are now enrolled.')
          window.location.reload()
        } catch {
          alert('Something went wrong while verifying payment')
        } finally {
          setLoading(false)
        }
      },
      modal: {
        ondismiss: () => {
          if (!finished) report(data.orderId, 'cancelled')
          setLoading(false)
        },
      },
    })

    rzp.on('payment.failed', (r: any) => {
      report(data.orderId, 'failed', r?.error?.description)
    })
    rzp.open()
  }

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <button
        onClick={buy}
        disabled={loading}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {loading ? 'Please wait…' : 'Buy'}
      </button>
    </>
  )
}