#!/usr/bin/env node
/**
 * TTLock account discovery — one-off script.
 *
 * Authenticates to TTLock using password-grant OAuth, then dumps:
 *   1. Gateways on the account (answers: is there a WiFi gateway at KEF?)
 *   2. Locks on the account (confirms IDs match Airtable)
 *   3. Battery % for each lock
 *   4. Existing keyboard passcodes on each lock
 *
 * Run from project root:
 *   node --env-file=.env.local scripts/ttlock-discover.mjs
 *
 * Required env vars in .env.local:
 *   TTLOCK_CLIENT_ID
 *   TTLOCK_CLIENT_SECRET
 *   TTLOCK_USERNAME      (TTLock account email — runar@bagbee.is)
 *   TTLOCK_PASSWORD      (plain password — we MD5 it before sending)
 *   TTLOCK_API_BASE      (defaults to https://euapi.ttlock.com)
 */
import crypto from 'node:crypto'

const API_BASE = process.env.TTLOCK_API_BASE || 'https://euapi.ttlock.com'
const CLIENT_ID = process.env.TTLOCK_CLIENT_ID
const CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET
const USERNAME = process.env.TTLOCK_USERNAME
const PASSWORD = process.env.TTLOCK_PASSWORD

function die(msg) {
  console.error(`✗ ${msg}`)
  process.exit(1)
}

if (!CLIENT_ID) die('TTLOCK_CLIENT_ID missing in .env.local')
if (!CLIENT_SECRET) die('TTLOCK_CLIENT_SECRET missing in .env.local')
if (!USERNAME) die('TTLOCK_USERNAME missing in .env.local')
if (!PASSWORD) die('TTLOCK_PASSWORD missing in .env.local')

const md5 = (s) => crypto.createHash('md5').update(s).digest('hex')
const now = () => Date.now()

// --- Auth: password grant ----------------------------------------------------

async function authenticate() {
  const url = `${API_BASE}/oauth2/token`
  const body = new URLSearchParams({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    username: USERNAME,
    password: md5(PASSWORD), // TTLock requires MD5
  })
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const json = await res.json()
  if (json.errcode !== undefined && json.errcode !== 0) {
    die(`Auth failed: errcode=${json.errcode} ${json.errmsg || ''}`)
  }
  if (!json.access_token) {
    die(`Auth failed: no access_token. Response: ${JSON.stringify(json)}`)
  }
  return json
}

// --- Signed GET helper -------------------------------------------------------

async function get(path, accessToken, extraParams = {}) {
  const params = new URLSearchParams({
    clientId: CLIENT_ID,
    accessToken,
    date: String(now()),
    ...Object.fromEntries(
      Object.entries(extraParams).map(([k, v]) => [k, String(v)])
    ),
  })
  const url = `${API_BASE}${path}?${params}`
  const res = await fetch(url)
  const json = await res.json()
  return json
}

// --- Pretty print helpers ----------------------------------------------------

const hr = (label) =>
  console.log(`\n\x1b[1;36m━━━ ${label} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m`)

// --- Main --------------------------------------------------------------------

;(async () => {
  hr('1. Authenticating')
  const auth = await authenticate()
  console.log(`  ✓ uid=${auth.uid} openid=${auth.openid}`)
  console.log(`  ✓ scope=${auth.scope}`)
  console.log(`  ✓ expires_in=${auth.expires_in}s (~${Math.round(auth.expires_in / 86400)}d)`)
  const token = auth.access_token

  hr('2. Gateways on this account')
  const gateways = await get('/v3/gateway/list', token, { pageNo: 1, pageSize: 20 })
  if (gateways.list && gateways.list.length) {
    for (const g of gateways.list) {
      console.log(`  • gatewayId=${g.gatewayId}`)
      console.log(`      name:        ${g.gatewayName}`)
      console.log(`      mac:         ${g.gatewayMac}`)
      console.log(`      version:     ${g.gatewayVersion}`)
      console.log(`      networkName: ${g.networkName}`)
      console.log(`      isOnline:    ${g.isOnline === 1 ? '✓ ONLINE' : '✗ OFFLINE'}`)
      console.log(`      lockNum:     ${g.lockNum} locks paired`)
    }
  } else {
    console.log('  (none) — no gateway registered. Project requires one for unlock events.')
    console.log('  Raw response:', JSON.stringify(gateways, null, 2))
  }

  hr('3. Locks on this account')
  const locks = await get('/v3/lock/list', token, { pageNo: 1, pageSize: 20 })
  if (!locks.list || !locks.list.length) {
    console.log('  (none)')
    console.log('  Raw response:', JSON.stringify(locks, null, 2))
    process.exit(0)
  }
  for (const l of locks.list) {
    console.log(`  • lockId=${l.lockId}`)
    console.log(`      alias:       ${l.lockAlias}`)
    console.log(`      mac:         ${l.lockMac}`)
    console.log(`      version:     ${l.lockVersion?.protocolType}/${l.lockVersion?.protocolVersion}`)
    console.log(`      hasGateway:  ${l.hasGateway === 1 ? '✓ yes' : '✗ no (Bluetooth-only)'}`)
    console.log(`      electricQty: ${l.electricQuantity}%`)
    console.log(`      passcodeFormat: ${l.passwordType}`)
  }

  hr('4. Existing passcodes per lock')
  for (const l of locks.list) {
    console.log(`\n  Lock: ${l.lockAlias} (lockId=${l.lockId})`)
    const codes = await get('/v3/lock/listKeyboardPwd', token, {
      lockId: l.lockId,
      pageNo: 1,
      pageSize: 100,
    })
    if (!codes.list || !codes.list.length) {
      console.log('    (no passcodes)')
      if (codes.errcode) console.log(`    errcode=${codes.errcode} ${codes.errmsg || ''}`)
      continue
    }
    for (const c of codes.list) {
      const start = c.startDate ? new Date(c.startDate).toISOString() : '-'
      const end = c.endDate ? new Date(c.endDate).toISOString() : '-'
      console.log(
        `    • [${c.keyboardPwdId}] code="${c.keyboardPwd}" name="${c.keyboardPwdName}" ` +
          `type=${c.keyboardPwdType} status=${c.status} ` +
          `${start} → ${end}`
      )
    }
  }

  hr('DONE — paste output back to assistant')
})().catch((err) => {
  console.error('✗ Unhandled error:', err)
  process.exit(1)
})
