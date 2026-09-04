/**
 * @dotrino/compat — QUÉ VERSIÓN ERES, Y SI PODEMOS TRABAJAR.
 *
 * EL PROBLEMA QUE VIENE A RESOLVER, dicho con los tres casos que costaron días:
 *
 *   · El apagón del 1-2 de septiembre: endurecer la bóveda dejó mudos a `content`, a los
 *     selladores y al bot social durante un día entero. Ningún fallo era un error: eran
 *     reintentos cada 60 segundos contra alguien que ya no les entendía.
 *   · `@dotrino/env` pedía `^0.33.2` con la librería en 0.60: enrolar contestaba
 *     `invalid cert: no-acta`, que es verdad y no es la causa. La causa era la versión.
 *   · La bóveda se quedó MUDA tres días porque su respuesta pasaba el tope del proxio: el
 *     socket moría con un 1009 y no lo decía nadie.
 *
 * Los tres son el mismo fallo: **una incompatibilidad se manifiesta como SILENCIO**. El
 * que llama no sabe si el otro está apagado, ocupado o hablando otro idioma, así que
 * reintenta para siempre — y el que atiende no sabe que le están hablando.
 *
 * Aquí no hay red, ni disco, ni cripto: son funciones puras. Decidir es de este módulo;
 * anunciar y refunfuñar es de quien lo usa. Y por eso no tiene dependencias — lo importan
 * los ~30 PWA, los daemons y el proxio, y un pilar dentro de otro se cuela anidado a cada
 * consumidor (ver `PENDIENTES.md`, «pilar anidado»).
 */

/** Lo que responde `check`. El `code` es lo que se compara; el texto puede cambiar. */
export const OK = 'ok'
export const INCOMPATIBLE_PROTOCOL = 'incompatible-protocol'
export const BROKEN_PEER = 'broken-peer'
export const UNDECLARED = 'undeclared'

/**
 * HASTA CUÁNDO SE ATIENDE A QUIEN NO DICE QUÉ ES.
 *
 * Es un REPLIEGUE DE MIGRACIÓN, declarado y con fecha, que es la única clase permitida
 * (`CLAUDE.md`, «nada de repliegues»). Hoy no lo anuncia nadie: si el día uno se corta a
 * quien calla, se apaga el ecosistema entero para arreglar que a veces se apaga solo.
 *
 * A partir de esta fecha, callar es incompatible. No se mueve «porque falta gente»: si
 * falta gente, es que la migración no se hizo, y para eso está el índice.
 */
export const UNDECLARED_UNTIL = Date.UTC(2026, 11, 1)   // 2026-12-01

/** ¿Tiene forma de anuncio? No dice si es compatible, solo si se puede juzgar. */
export function isDeclaration (d) {
  return !!d && typeof d.product === 'string' && d.product.length > 0 &&
    typeof d.version === 'string' && d.version.length > 0 &&
    Number.isInteger(d.protocol) &&
    Array.isArray(d.speaks) && d.speaks.length > 0 && d.speaks.every(Number.isInteger)
}

/** Lo que se pone en el sobre firmado de `identify`. Corto, porque viaja en cada conexión. */
export function declare ({ product, version, protocol, speaks }) {
  if (!Number.isInteger(protocol)) throw new Error('compat: protocol must be an integer')
  const habla = speaks && speaks.length ? [...new Set(speaks)].sort((a, b) => a - b) : [protocol]
  if (!habla.includes(protocol)) throw new Error('compat: speaks must include protocol')
  const d = { product: String(product), version: String(version), protocol, speaks: habla }
  if (!isDeclaration(d)) throw new Error('compat: incomplete declaration')
  return d
}

/**
 * ¿ESTE PAR ESTÁ EN LA LISTA DE ROTAS?
 *
 * Por VERSIÓN EXACTA y no por rango, a propósito. Un rango pide un comparador de semver, y
 * un comparador de semver mal escrito es peor que no tenerlo: falla en silencio y del lado
 * que no toca. Una build rota siempre es una versión publicada concreta, así que se nombra.
 */
export function isBroken (lista, { product, version }) {
  for (const b of lista || []) {
    if (b?.product !== product) continue
    if ((b.versions || []).includes(version)) return b
  }
  return null
}

/**
 * ¿PODEMOS TRABAJAR?
 *
 * La comparación de protocolo es SIMÉTRICA —cada uno mira si el otro habla lo suyo Y si él
 * habla lo del otro— para que los dos lados lleguen a la misma respuesta. Si no, se llega a
 * lo peor de todo: uno trabaja y el otro rechaza, que es el estado a medias del que venimos.
 *
 * La lista de rotas NO es simétrica, y no puede serlo: el que sabe que la 0.99.0 está rota
 * es el nuevo; el viejo no sabe nada de sí mismo. Por eso el rechazo se DICE (punto 3 del
 * dueño): el que rechaza es el único que puede enterar al otro.
 *
 * @param {object} o.mine    mi declaración
 * @param {object} o.theirs  la del otro (o null/undefined si no dijo nada)
 * @param {Array}  [o.broken] mi lista de versiones rotas
 * @param {number} [o.now]
 * @returns {{ok:boolean, code:string, reason:string, peer:object|null}}
 */
export function check ({ mine, theirs, broken = [], now = Date.now() } = {}) {
  if (!isDeclaration(mine)) throw new Error('compat: my own declaration is not valid')

  if (!isDeclaration(theirs)) {
    const vencido = now >= UNDECLARED_UNTIL
    return {
      ok: !vencido,
      code: UNDECLARED,
      peer: null,
      reason: vencido
        ? 'the other side does not say what it is or which version it runs, and the migration window is over'
        : 'the other side does not say what it is or which version it runs (tolerated until the migration window closes)'
    }
  }

  const roto = isBroken(broken, theirs)
  if (roto) {
    return {
      ok: false,
      code: BROKEN_PEER,
      peer: theirs,
      reason: `${theirs.product} ${theirs.version} is known to be broken: ${roto.why || 'no reason recorded'}`
    }
  }

  const leEntiendo = mine.speaks.includes(theirs.protocol)
  const meEntiende = theirs.speaks.includes(mine.protocol)
  if (!leEntiendo || !meEntiende) {
    return {
      ok: false,
      code: INCOMPATIBLE_PROTOCOL,
      peer: theirs,
      reason: `${mine.product} ${mine.version} speaks protocol ${mine.speaks.join(', ')} and ` +
        `${theirs.product} ${theirs.version} speaks ${theirs.speaks.join(', ')}: no version in common`
    }
  }

  return { ok: true, code: OK, peer: theirs, reason: '' }
}

/**
 * EL AVISO QUE SE MANDA CUANDO NO SE PUEDE TRABAJAR (punto 3 del dueño: «se comunican,
 * pero solo para alertar la incompatibilidad»).
 *
 * Lleva las dos declaraciones porque el que lo recibe suele ser el que NO sabe que está
 * roto —es el viejo—, así que hay que decirle qué es él, qué somos nosotros y qué hacer.
 * Sin esto el rechazo sería otro silencio, que es de lo que venimos huyendo.
 */
export function incompatibleNotice ({ mine, theirs, verdict }) {
  return {
    op: 'incompatible',
    code: verdict.code,
    reason: verdict.reason,
    mine: { product: mine.product, version: mine.version, protocol: mine.protocol, speaks: mine.speaks },
    yours: theirs && isDeclaration(theirs)
      ? { product: theirs.product, version: theirs.version, protocol: theirs.protocol }
      : null,
    fix: 'update the older side; nothing here will work until the two versions match'
  }
}

export default { declare, check, isBroken, isDeclaration, incompatibleNotice, OK, INCOMPATIBLE_PROTOCOL, BROKEN_PEER, UNDECLARED, UNDECLARED_UNTIL }
