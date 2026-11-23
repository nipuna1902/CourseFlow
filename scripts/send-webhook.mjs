//order_U3LAxUQKnPR9NJ
import crypto from 'crypto'

const [orderId, paymentId, eventId = `evt_${crypto.randomUUID()}`] = process.argv.slice(2)
if (!orderId || !paymentId) {
  console.error('usage: node --env-file=.env.local scripts/send-webhook.mjs <order_id> <payment_id> [event_id]')
  process.exit(1)
}

const body = JSON.stringify({
  event: 'payment.captured',
  payload: { payment: { entity: { id: paymentId, order_id: orderId, status: 'captured' } } },
})
const signature = crypto
  .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
  .update(body)
  .digest('hex')

const res = await fetch(process.env.WEBHOOK_URL ?? 'http://localhost:3000/api/webhooks/razorpay', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-razorpay-signature': signature,
    'x-razorpay-event-id': eventId,
  },
  body,
})
console.log(res.status, await res.text())