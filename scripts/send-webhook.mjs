//order_U3LAxUQKnPR9NJ
import crypto from 'crypto'

const [orderId, paymentId, eventId = `evt_${crypto.randomUUID()}`, eventType = 'payment.captured'] =
  process.argv.slice(2)
if (!orderId || !paymentId) {
  console.error('usage: node --env-file=.env scripts/send-webhook.mjs <order_id> <payment_id> [event_id] [event_type]')
  process.exit(1)
}

const body = JSON.stringify({
  event: eventType,
  payload: {
    payment: {
      entity: {
        id: paymentId,
        order_id: orderId,
        status: eventType.replace('payment.', ''),
        error_description: eventType === 'payment.failed' ? 'Simulated bank decline' : undefined,
      },
    },
  },
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