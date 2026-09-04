import test from 'node:test'
import assert from 'node:assert/strict'
import { parseVersion, compareVersions, satisfies } from '../src/ranges.js'

test('solo x.y.z: lo demás no tiene forma', () => {
  assert.deepEqual(parseVersion('0.106.2'), [0, 106, 2])
  for (const v of ['1.0.0-beta', 'v1.0.0', '1.0', '', null, '^1.0.0', '1.0.0+b']) {
    assert.equal(parseVersion(v), null, String(v) + ' no debería tener forma')
  }
})

test('compara por número, no por texto', () => {
  assert.equal(compareVersions('0.9.0', '0.10.0'), -1, '10 es mayor que 9, aunque "1" < "9"')
  assert.equal(compareVersions('0.106.2', '0.106.2'), 0)
  assert.equal(compareVersions('1.0.0', '0.999.999'), 1)
  assert.throws(() => compareVersions('1.0', '1.0.0'), /cannot compare/)
})

test('las cuatro formas admitidas', () => {
  assert.equal(satisfies('0.106.2', '0.106.2'), true)
  assert.equal(satisfies('0.106.3', '0.106.2'), false)
  assert.equal(satisfies('0.106.2', '>=0.106.0'), true)
  assert.equal(satisfies('0.105.9', '>=0.106.0'), false)
  assert.equal(satisfies('0.106.0', '>0.106.0'), false)
  assert.equal(satisfies('0.100.0', '0.100.0 - 0.106.2'), true, 'los extremos entran')
  assert.equal(satisfies('0.106.2', '0.100.0 - 0.106.2'), true)
  assert.equal(satisfies('0.106.3', '0.100.0 - 0.106.2'), false)
  assert.equal(satisfies('9.9.9', '*'), true)
})

test('rangos ABIERTOS: de esta version en adelante', () => {
  assert.equal(satisfies('0.106.2', '0.106.0+'), true)
  assert.equal(satisfies('0.106.0', '0.106.0+'), true, 'la propia entra')
  assert.equal(satisfies('0.105.9', '0.106.0+'), false)
  assert.equal(satisfies('9.9.9', '0.106.0+'), true)
  assert.equal(satisfies('0.106.2', '0.106.0+'), satisfies('0.106.2', '>=0.106.0'),
    'es el mismo rango dicho en el otro idioma')

  assert.equal(satisfies('9.9.9', '0.100.0 - *'), true, 'abierto por arriba')
  assert.equal(satisfies('0.99.0', '0.100.0 - *'), false)
})

test('una lista es un O', () => {
  assert.equal(satisfies('0.4.2', ['>=0.5.0', '0.4.2']), true)
  assert.equal(satisfies('0.4.1', ['>=0.5.0', '0.4.2']), false)
})

/**
 * LO QUE NO SE ENTIENDE NO PASA. Es la regla de siempre: si falta lo que hace falta para
 * decidir, se para. Un rango con `^` o con una versión rara no es «adelante».
 */
test('un rango que no se entiende es un NO, nunca un adelante', () => {
  for (const r of ['^0.106.0', '~0.106.0', '>=1.0', '>=abc', '', null, undefined, 42, {}]) {
    assert.equal(satisfies('0.106.2', r), false, JSON.stringify(r) + ' debería ser un no')
  }
  assert.equal(satisfies('no-es-version', '>=0.1.0'), false)
})
