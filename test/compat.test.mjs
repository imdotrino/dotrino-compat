/**
 * Lo que fija esta suite es el comportamiento que el dueño pidió el 2026-09-04, y sobre
 * todo el tercer punto: **una incompatibilidad no puede ser un silencio**.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { declare, check, isBroken, incompatibleNotice, UNDECLARED_UNTIL, OK, UNDECLARED, BROKEN_PEER, INCOMPATIBLE_PROTOCOL } from '../src/index.js'

const boveda = declare({ product: 'vaultd', version: '0.106.2', protocol: 3, speaks: [2, 3] })
const agente = declare({ product: 'remote-agent', version: '0.5.3', protocol: 3, speaks: [3] })
const viejo = declare({ product: 'remote-agent', version: '0.2.0', protocol: 1, speaks: [1] })

test('una declaración tiene que incluirse a sí misma en lo que habla', () => {
  assert.throws(() => declare({ product: 'x', version: '1.0.0', protocol: 4, speaks: [1, 2] }), /speaks must include protocol/)
  assert.throws(() => declare({ product: 'x', version: '1.0.0', protocol: 1.5, speaks: [1] }), /integer/)
})

test('dos que hablan lo mismo trabajan', () => {
  const r = check({ mine: boveda, theirs: agente })
  assert.equal(r.ok, true)
  assert.equal(r.code, OK)
})

test('sin protocolo en común NO se trabaja, y los DOS lados dicen lo mismo', () => {
  const a = check({ mine: boveda, theirs: viejo })
  const b = check({ mine: viejo, theirs: boveda })
  assert.equal(a.ok, false)
  assert.equal(b.ok, false, 'si uno rechaza y el otro no, vuelve el estado a medias')
  assert.equal(a.code, INCOMPATIBLE_PROTOCOL)
  assert.equal(b.code, INCOMPATIBLE_PROTOCOL)
})

test('una versión marcada rota se rechaza aunque el protocolo cuadre', () => {
  const rotas = [{ product: 'remote-agent', versions: ['0.5.3'], why: 'pierde el código del error al envolverlo', since: '2026-09-04' }]
  const r = check({ mine: boveda, theirs: agente, broken: rotas })
  assert.equal(r.ok, false)
  assert.equal(r.code, BROKEN_PEER)
  assert.match(r.reason, /pierde el código del error/, 'el porqué viaja con el rechazo')
})

test('la lista de rotas va por versión EXACTA: no adivina rangos', () => {
  const rotas = [{ product: 'vaultd', versions: ['0.99.0', '0.100.1'], why: 'x' }]
  assert.ok(isBroken(rotas, { product: 'vaultd', version: '0.99.0' }))
  assert.equal(isBroken(rotas, { product: 'vaultd', version: '0.100.0' }), null)
  assert.equal(isBroken(rotas, { product: 'otro', version: '0.99.0' }), null)
})

/**
 * EL REPLIEGUE DE MIGRACIÓN, que es el único permitido: declarado, acotado y con fecha.
 * Hoy no lo anuncia nadie; cortar a quien calla el día uno apaga el ecosistema entero para
 * arreglar que a veces se apaga solo.
 */
test('a quien no dice qué es se le atiende, pero solo hasta la fecha', () => {
  const antes = check({ mine: boveda, theirs: null, now: UNDECLARED_UNTIL - 1 })
  assert.equal(antes.ok, true)
  assert.equal(antes.code, UNDECLARED, 'se atiende, pero queda dicho que no declaró')

  const despues = check({ mine: boveda, theirs: null, now: UNDECLARED_UNTIL })
  assert.equal(despues.ok, false, 'pasada la fecha, callar es incompatible')
  assert.equal(despues.code, UNDECLARED)
})

test('la ventana de migración tiene fecha escrita, y no se mueve sola', () => {
  assert.equal(new Date(UNDECLARED_UNTIL).toISOString().slice(0, 10), '2026-12-01')
})

test('el aviso dice qué eres tú, qué soy yo y qué hacer', () => {
  const v = check({ mine: boveda, theirs: viejo })
  const aviso = incompatibleNotice({ mine: boveda, theirs: viejo, verdict: v })
  assert.equal(aviso.op, 'incompatible')
  assert.equal(aviso.yours.version, '0.2.0')
  assert.equal(aviso.mine.version, '0.106.2')
  assert.match(aviso.fix, /update the older side/)
})

test('mi propia declaración rota es un error mío, no un «no»', () => {
  assert.throws(() => check({ mine: { product: 'x' }, theirs: agente }), /my own declaration/)
})
