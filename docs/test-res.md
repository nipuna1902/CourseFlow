# Test results

## Test 3: same webhook delivered more than once
Method: signed `payment.captured` events sent with `scripts/send-webhook.mjs`
(simulated payment id `pay_test_0001`; not a real Razorpay payment).

First delivery:
```
200 {"ok":true}
```
Same event id delivered again:
```
200 {"ok":true,"duplicate":true}
```
Result: one row in `webhook_events`, one row in `enrollments` for that student and course.