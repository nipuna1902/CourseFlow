import crypto from 'crypto'
import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

const N = Number(process.env.N ?? 100)
const HOT_SAME = 20
const HOT_DISTINCT = 20
const URL_ = process.env.WEBHOOK_URL ?? 'http://localhost:3000/api/webhooks/razorpay'
const SECRET = process.env.RAZORPAY_WEBHOOK_SECRET

for (const k of ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'RAZORPAY_WEBHOOK_SECRET']) {
  if (!process.env[k]) {
    console.error(`Missing env var ${k}`)
    process.exit(1)
  }
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// ---------- remove everything this script created ----------
async function cleanup() {
  const ids = []
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    ids.push(...data.users.filter((u) => u.email?.startsWith('loadtest-')).map((u) => u.id))
    if (data.users.length < 200) break
  }
  console.log(`found ${ids.length} load-test users`)
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50)
    await db.from('enrollment_audit').delete().in('student_id', chunk)
    await db.from('enrollments').delete().in('user_id', chunk)
    await db.from('payments').delete().in('user_id', chunk)
    await db.from('profiles').delete().in('id', chunk)
  }
  await db.from('webhook_events').delete().like('razorpay_event_id', 'evt_load_%')
  for (const id of ids) await db.auth.admin.deleteUser(id)
  console.log('cleanup done')
}

// ---------- send one signed webhook, exactly like Razorpay would ----------
async function sendWebhook(t) {
  const body = JSON.stringify({
    event: 'payment.captured',
    payload: { payment: { entity: { id: t.paymentId, order_id: t.orderId, status: 'captured' } } },
  })
  const signature = crypto.createHmac('sha256', SECRET).update(body).digest('hex')
  const started = performance.now()
  try {
    const res = await fetch(URL_, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-razorpay-signature': signature,
        'x-razorpay-event-id': t.eventId,
      },
      body,
    })
    const text = await res.text()
    return { ...t, status: res.status, ms: performance.now() - started, duplicate: text.includes('"duplicate":true') }
  } catch (e) {
    return { ...t, status: 0, ms: performance.now() - started, error: String(e.cause ?? e) }
  }
}

const pct = (arr, p) =>
  arr.length ? [...arr].sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor((p / 100) * arr.length))] : 0

async function run() {
  const RUN = Date.now().toString(36) // tags this run so its data is easy to find

  // warm-up + sanity check: a bad signature must be rejected with 400
  try {
    const r = await fetch(URL_, {
      method: 'POST',
      headers: { 'x-razorpay-signature': 'bad', 'x-razorpay-event-id': 'warmup' },
      body: '{}',
    })
    if (r.status !== 400) throw new Error(`expected 400 from warm-up request, got ${r.status}`)
  } catch (e) {
    console.error('Server not reachable or misconfigured:', e.message)
    process.exit(1)
  }

  // ---------- setup: test students and unpaid payments ----------
  const { data: course, error: cErr } = await db
    .from('courses').select('id, title, price_paise, currency')
    .eq('is_published', true).order('created_at').limit(1).single()
  if (cErr) throw cErr
  console.log(`Course under test: ${course.title}`)

  const total = N + 2 // N students + 1 "hot" student + 1 "double purchase" student
  const users = []
  for (let i = 0; i < total; i += 10) {
    const batch = await Promise.all(
      Array.from({ length: Math.min(10, total - i) }, async (_, k) => {
        const n = i + k
        const { data, error } = await db.auth.admin.createUser({
          email: `loadtest-${RUN}-${n}@courseflow.test`,
          password: crypto.randomUUID(),
          email_confirm: true,
          user_metadata: { full_name: `Load Test ${n}` },
        })
        if (error) throw new Error(`createUser ${n}: ${error.message}`)
        return { n, id: data.user.id }
      })
    )
    users.push(...batch)
  }

  const mk = (u, tag) => ({
    id: crypto.randomUUID(),
    user_id: u.id,
    course_id: course.id,
    razorpay_order_id: `order_load_${RUN}_${tag}`,
    amount_paise: course.price_paise,
    currency: course.currency,
    status: 'created',
  })
  const pid = (p) => 'pay_' + p.razorpay_order_id.slice(6)

  const studentPays = users.slice(0, N).map((u, i) => mk(u, `s${i}`))
  const hotPay = mk(users[N], 'hot')
  const dblPays = [mk(users[N + 1], 'dblA'), mk(users[N + 1], 'dblB')]
  const { error: pErr } = await db.from('payments').insert([...studentPays, hotPay, ...dblPays])
  if (pErr) throw pErr

  // ---------- the burst ----------
  const tasks = []
  studentPays.forEach((p, i) =>
    tasks.push({ group: 'A-students', eventId: `evt_load_${RUN}_s${i}`, orderId: p.razorpay_order_id, paymentId: pid(p) }))
  for (let k = 0; k < HOT_SAME; k++)
    tasks.push({ group: 'B-hot-student', eventId: `evt_load_${RUN}_hot_same`, orderId: hotPay.razorpay_order_id, paymentId: pid(hotPay) })
  for (let k = 0; k < HOT_DISTINCT; k++)
    tasks.push({ group: 'B-hot-student', eventId: `evt_load_${RUN}_hot_d${k}`, orderId: hotPay.razorpay_order_id, paymentId: pid(hotPay) })
  dblPays.forEach((p, i) =>
    tasks.push({ group: 'C-double-purchase', eventId: `evt_load_${RUN}_dbl${i}`, orderId: p.razorpay_order_id, paymentId: pid(p) }))

  for (let i = tasks.length - 1; i > 0; i--) { // shuffle so the groups interleave
    const j = Math.floor(Math.random() * (i + 1))
      ;[tasks[i], tasks[j]] = [tasks[j], tasks[i]]
  }

  console.log(`Firing ${tasks.length} concurrent webhooks at ${URL_} ...`)
  const t0 = performance.now()
  const results = await Promise.all(tasks.map(sendWebhook))
  const burstMs = performance.now() - t0

  // like Razorpay, re-deliver anything that did not get a 200 (same event id)
  const failed = results.filter((r) => r.status !== 200)
  let redelivered = []
  if (failed.length) {
    await new Promise((r) => setTimeout(r, 1500))
    redelivered = await Promise.all(failed.map(sendWebhook))
  }

  // ---------- verify the database ----------
  const userIds = new Set(users.map((u) => u.id))
  const { data: pays } = await db.from('payments')
    .select('id, user_id, status, needs_review').like('razorpay_order_id', `order_load_${RUN}_%`)
  const { data: enr } = await db.from('enrollments')
    .select('id, user_id, payment_id, status').eq('course_id', course.id)
  const { data: aud } = await db.from('enrollment_audit')
    .select('student_id, action').eq('course_id', course.id).eq('action', 'granted')
  const { data: evs } = await db.from('webhook_events')
    .select('razorpay_event_id, status').like('razorpay_event_id', `evt_load_${RUN}_%`)

  const payById = new Map(pays.map((p) => [p.id, p]))
  const testEnr = enr.filter((e) => userIds.has(e.user_id))
  const testAud = aud.filter((a) => userIds.has(a.student_id))
  const activeCount = new Map()
  for (const e of testEnr.filter((e) => e.status === 'active'))
    activeCount.set(e.user_id, (activeCount.get(e.user_id) ?? 0) + 1)

  const paidA = studentPays.filter((p) => payById.get(p.id)?.status === 'paid').length
  const dblStates = dblPays.map((p) => payById.get(p.id))

  const checks = [
    ['A: all student payments marked paid', paidA === N, `${paidA}/${N}`],
    ['A: every student has exactly one active enrollment',
      users.slice(0, N).every((u) => activeCount.get(u.id) === 1),
      `${users.slice(0, N).filter((u) => activeCount.get(u.id) === 1).length}/${N}`],
    ['No enrollment points at another student\'s payment',
      testEnr.every((e) => payById.get(e.payment_id)?.user_id === e.user_id), `${testEnr.length} checked`],
    ['B: hot student has 1 paid payment and exactly 1 enrollment',
      payById.get(hotPay.id)?.status === 'paid' &&
      testEnr.filter((e) => e.user_id === users[N].id).length === 1,
      `${HOT_SAME + HOT_DISTINCT} deliveries`],
    ['C: double purchase: 2 paid, 1 active enrollment, 1 flagged needs_review',
      dblStates.every((p) => p?.status === 'paid') &&
      activeCount.get(users[N + 1].id) === 1 &&
      dblStates.filter((p) => p?.needs_review).length === 1, ''],
    ['One audit "granted" row per enrolled student',
      testAud.length === N + 2 && new Set(testAud.map((a) => a.student_id)).size === N + 2,
      `${testAud.length} rows`],
    ['webhook_events: exactly one row per distinct event id',
      evs.length === N + 1 + HOT_DISTINCT + 2, `${evs.length} rows (expected ${N + 1 + HOT_DISTINCT + 2})`],
    ['No event left in failed/received state', evs.every((e) => e.status === 'processed'),
      `${evs.filter((e) => e.status !== 'processed').length} not processed`],
  ]

  // ---------- report ----------
  const hist = {}
  for (const r of results) {
    hist[r.group] ??= {}
    hist[r.group][r.status] = (hist[r.group][r.status] ?? 0) + 1
  }
  const ms = results.map((r) => r.ms)
  const report = {
    run: RUN, url: URL_, course: course.title, requests: tasks.length,
    burstSeconds: +(burstMs / 1000).toFixed(2),
    latencyMs: { p50: Math.round(pct(ms, 50)), p95: Math.round(pct(ms, 95)), max: Math.round(Math.max(...ms)) },
    firstAttemptStatusByGroup: hist,
    duplicatesAcknowledgedWithoutReprocessing: results.filter((r) => r.duplicate).length,
    firstAttemptFailures: failed.map((r) => ({ group: r.group, eventId: r.eventId, status: r.status, error: r.error })),
    afterRedelivery: redelivered.map((r) => ({ eventId: r.eventId, status: r.status })),
    checks: checks.map(([name, pass, detail]) => ({ name, pass, detail })),
  }

  console.log(`\nBurst of ${tasks.length} requests took ${report.burstSeconds}s`)
  console.log('Latency (ms):', report.latencyMs)
  console.log('First-attempt HTTP status by group:')
  console.table(hist)
  console.log(`First-attempt failures: ${failed.length}`)
  if (redelivered.length) {
    console.log(`After one redelivery: ${redelivered.filter((r) => r.status === 200).length}/${redelivered.length} succeeded`)
  }
  console.log('\nDatabase checks:')
  for (const [name, pass, detail] of checks) console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}  ${detail}`)

  fs.mkdirSync('docs', { recursive: true })
  fs.writeFileSync('docs/load-test-results.json', JSON.stringify(report, null, 2))
  console.log('\nFull results saved to docs/load-test-results.json')
  if (checks.some(([, pass]) => !pass)) process.exit(2)
}

if (process.argv[2] === 'cleanup') await cleanup()
else await run()