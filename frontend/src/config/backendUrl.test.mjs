import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeBackendUrl } from './backendUrl.mjs'

test('replaces the stale Railway hostname with the active backend URL', () => {
  assert.equal(
    normalizeBackendUrl('https://whatapp-automation-production.up.railway.app'),
    'https://sk-agent-backend-production.up.railway.app'
  )
})

test('keeps local development defaults intact', () => {
  assert.equal(normalizeBackendUrl(''), 'http://localhost:3001')
  assert.equal(normalizeBackendUrl('http://localhost:3001'), 'http://localhost:3001')
})
