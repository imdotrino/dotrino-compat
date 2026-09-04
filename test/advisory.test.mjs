/**
 * EL AVISO A LA RED. Lo que fija esta suite es que un aviso solo puede hacer lo que se
 * decidió que hiciera: sumar incompatibilidades, hacia adelante, y firmado por la llave
 * que trae la build.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { check, declare, BROKEN_PEER } from '../src/index.js'
import {
  signAdvisory, verifyAdvisory, adoptAdvisory, brokenNow, isAdvisory,
  advisorySummary, canonicalStringify
} from '../src/advisory.js'

const par = async () => {
  const k = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  return {
    pub: JSON.stringify(await crypto.subtle.exportKey('jwk', k.publicKey)),
    priv: await crypto.subtle.exportKey('jwk', k.privateKey)
  }
}

const ROTA = [{ product: 'vaultd', versions: ['0.99.0'], why: 'deja mudos a los servicios', fix: 'sube a 0.106.2' }]

/**
 * EL CANÓNICO ES UNA COPIA DEL DE `@dotrino/proxy-client`, a propósito: este paquete no
 * depende de nadie. Se ata a un valor FIJO —y no a un import del otro repo, que en CI no
 * existe— porque lo que hay que impedir es que se muevan por separado: si los bytes
 * cambian, las firmas dejan de casar entre piezas y volvemos al silencio.
 */
test('el canónico produce exactamente estos bytes', () => {
  const v = { b: 1, a: [3, { z: null, y: 'x' }], c: { n: 2, m: true } }
  assert.equal(canonicalStringify(v), '{"a":[3,{"y":"x","z":null}],"b":1,"c":{"m":true,"n":2}}')
})

/**
 * LA TRAMPA, y se deja escrita en vez de arreglada: una clave que vale `undefined` sale
 * como el texto `undefined`, que NO es JSON válido. Es el comportamiento del canónico de
 * `@dotrino/proxy-client` y aquí se copia tal cual **a propósito**: cambiarlo en un lado
 * rompería la firma con todo el que use el otro.
 *
 * Lo que importa para quien firma: si un lado pone la clave con `undefined` y el otro la
 * omite, los bytes son distintos y la firma no casa — otra incompatibilidad silenciosa, de
 * la familia que este paquete existe para matar. **No metas claves con `undefined` en lo
 * que firmes.**
 */
test('una clave undefined ensucia los bytes firmados (copiado del pilar, no arreglado aquí)', () => {
  assert.equal(canonicalStringify({ a: undefined, b: 1 }), '{"a":undefined,"b":1}')
  assert.notEqual(canonicalStringify({ a: undefined, b: 1 }), canonicalStringify({ b: 1 }))
})

test('un aviso firmado por la llave de release se verifica; otro no', async () => {
  const release = await par()
  const cualquiera = await par()
  const aviso = await signAdvisory({ seq: 1, broken: ROTA, privateJwk: release.priv })
  assert.ok(isAdvisory(aviso))
  assert.equal(await verifyAdvisory({ advisory: aviso, publickey: release.pub }), true)
  assert.equal(await verifyAdvisory({ advisory: aviso, publickey: cualquiera.pub }), false,
    'cualquiera no puede parar el software de nadie')
})

test('tocar el aviso lo invalida', async () => {
  const release = await par()
  const aviso = await signAdvisory({ seq: 1, broken: ROTA, privateJwk: release.priv })
  const tocado = { ...aviso, broken: [{ product: 'vaultd', versions: ['0.106.2'], why: 'mentira' }] }
  assert.equal(await verifyAdvisory({ advisory: tocado, publickey: release.pub }), false)
})

test('solo hacia adelante: un aviso viejo no deshace uno nuevo', async () => {
  const release = await par()
  const uno = await signAdvisory({ seq: 1, broken: ROTA, privateJwk: release.priv })
  const dos = await signAdvisory({ seq: 2, broken: [], privateJwk: release.priv })

  let est = (await adoptAdvisory({ current: null, incoming: uno, publickey: release.pub }))
  assert.equal(est.adopted, true)
  est = await adoptAdvisory({ current: est.advisory, incoming: dos, publickey: release.pub })
  assert.equal(est.adopted, true, 'un aviso nuevo reemplaza la lista: una equivocación se corrige')

  const replay = await adoptAdvisory({ current: est.advisory, incoming: uno, publickey: release.pub })
  assert.equal(replay.adopted, false)
  assert.equal(replay.reason, 'no-es-mas-nuevo')
  assert.equal(replay.advisory.seq, 2)
})

/**
 * LA MITAD QUE NO SE NEGOCIA: el aviso SUMA. Que la red pudiera desmarcar lo que el código
 * afirma sería el repliegue de manual — «si llega este mensaje, di que sí».
 */
test('un aviso NO puede desmarcar lo que la build ya da por roto', async () => {
  const release = await par()
  const baked = [{ product: 'remote-agent', versions: ['0.2.0'], why: 'no conoce el acta' }]
  const aviso = await signAdvisory({ seq: 9, broken: [], privateJwk: release.priv })

  const hoy = brokenNow({ baked, advisory: aviso })
  assert.equal(hoy.length, 1, 'lo que trae el código sigue roto aunque el aviso calle')
  assert.equal(hoy[0].product, 'remote-agent')
})

test('lo que suma el aviso frena de verdad', async () => {
  const release = await par()
  const mia = declare({ product: 'vaultd', version: '0.106.2', protocol: 3, speaks: [3] })
  const suya = declare({ product: 'content', version: '0.3.3', protocol: 3, speaks: [3] })

  assert.equal(check({ mine: mia, theirs: suya }).compatible, true, 'antes del aviso trabajan')

  const aviso = await signAdvisory({
    seq: 1, privateJwk: release.priv,
    broken: [{ product: 'content', versions: ['0.3.3'], why: 'no sella', fix: 'sube a 0.4.0' }]
  })
  const r = check({ mine: mia, theirs: suya, broken: brokenNow({ baked: [], advisory: aviso }) })
  assert.equal(r.compatible, false)
  assert.equal(r.code, BROKEN_PEER)
  assert.match(r.reason, /no sella/)
})

test('el administrador puede enseñar el aviso: qué, por qué y qué hacer', async () => {
  const release = await par()
  const aviso = await signAdvisory({ seq: 4, broken: ROTA, privateJwk: release.priv })
  const s = advisorySummary(aviso)
  assert.equal(s.seq, 4)
  assert.equal(s.components[0].product, 'vaultd')
  assert.equal(s.components[0].fix, 'sube a 0.106.2')
  assert.equal(advisorySummary(null), null)
})
