/**
 * Lo que fija esta suite es el comportamiento que el dueño pidió el 2026-09-04, y sobre
 * todo el tercer punto: **una incompatibilidad no puede ser un silencio**.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  declare, check, isBroken, incompatibleNotice, STRICT_BY_DEFAULT,
  OK, UNDECLARED, BROKEN_PEER, INCOMPATIBLE_PROTOCOL
} from '../src/index.js'

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

/**
 * DECIDE LA VERSIÓN QUE ENTRA (dueño, 2026-09-04): una build de hace tres meses no sabe
 * nada de lo que vino después, así que preguntarle su opinión es preguntarle a quien no
 * puede saber. Quien juzga es quien tiene la lista al día.
 */
test('decide el que entra: yo te juzgo con mi lista, no te pregunto', () => {
  const r = check({ mine: boveda, theirs: viejo })
  assert.equal(r.ok, false)
  assert.equal(r.code, INCOMPATIBLE_PROTOCOL)
  assert.match(r.reason, /update remote-agent/, 'el rechazo dice a quién hay que actualizar')
})

test('el viejo no tiene voto: si YO le entiendo, trabajamos', () => {
  const nuevo = declare({ product: 'vaultd', version: '0.107.0', protocol: 2, speaks: [1, 2] })
  const antiguo = declare({ product: 'remote-agent', version: '0.4.0', protocol: 1, speaks: [1] })
  assert.equal(check({ mine: nuevo, theirs: antiguo }).ok, true,
    'exigir acuerdo mutuo era pedirle su opinión a quien no puede tenerla')
})

test('una versión marcada rota se rechaza aunque el protocolo cuadre', () => {
  const rotas = [{ product: 'remote-agent', versions: ['0.5.3'], why: 'pierde el código del error al envolverlo', fix: 'sube a 0.5.4' }]
  const r = check({ mine: boveda, theirs: agente, broken: rotas })
  assert.equal(r.ok, false)
  assert.equal(r.code, BROKEN_PEER)
  assert.match(r.reason, /pierde el código del error/, 'el porqué viaja con el rechazo')
  assert.match(r.reason, /sube a 0\.5\.4/, 'y qué hacer')
})

test('la lista de rotas admite exactas, listas y rangos — el MISMO comparador', () => {
  const rotas = [{ product: 'vaultd', versions: ['0.99.0', '0.100.1'], why: 'x' }]
  assert.ok(isBroken(rotas, { product: 'vaultd', version: '0.99.0' }))
  assert.equal(isBroken(rotas, { product: 'vaultd', version: '0.100.0' }), null)
  assert.equal(isBroken(rotas, { product: 'otro', version: '0.99.0' }), null)

  const porRango = [{ product: 'content', versions: '<=0.3.3', why: 'no sella' }]
  assert.ok(isBroken(porRango, { product: 'content', version: '0.3.3' }))
  assert.equal(isBroken(porRango, { product: 'content', version: '0.4.0' }), null)

  const raro = [{ product: 'content', versions: '^0.3.0', why: 'x' }]
  assert.equal(isBroken(raro, { product: 'content', version: '0.3.3' }), null,
    'lo que no se entiende no marca roto, pero tampoco absuelve: no dice nada')
})

/**
 * ESTRICTO EN ESTA ETAPA (dueño, 2026-09-04). Quien no dice qué es, no trabaja. Nada de
 * ventana de gracia: la mitad del valor de esto es obligar a que todas las piezas
 * declaren, y una tolerancia consigue justo lo contrario — que nadie se entere de que le
 * falta declarar.
 */
test('quien no dice qué es, no trabaja', () => {
  const r = check({ mine: boveda, theirs: null })
  assert.equal(r.ok, false)
  assert.equal(r.code, UNDECLARED)
})

test('estricto es el DEFAULT, y aflojarlo es una decisión explícita', () => {
  assert.equal(STRICT_BY_DEFAULT, true, 'se relaja cuando el producto esté estable, no antes')
  const flojo = check({ mine: boveda, theirs: null, strict: false })
  assert.equal(flojo.ok, true)
  assert.equal(flojo.code, UNDECLARED, 'aunque pase, queda dicho que no declaró')
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
