import 'server-only'
import Razorpay from 'razorpay'

const keyId = process.env.RAZORPAY_KEY_ID!
const keySecret = process.env.RAZORPAY_KEY_SECRET!

if (!keyId?.startsWith('rzp_test_')) {
  throw new Error('RAZORPAY_KEY_ID must be a test-mode key (rzp_test_...)')
}

export const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret })