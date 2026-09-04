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
import { satisfies } from './ranges.js'

export const OK = 'ok'
export const INCOMPATIBLE_PROTOCOL = 'incompatible-protocol'
export const BROKEN_PEER = 'broken-peer'
export const UNDECLARED = 'undeclared'

/**
 * ESTRICTO MIENTRAS ESTO SE ESTÁ HACIENDO (dueño, 2026-09-04): *«la incompatibilidad debe
 * ser estricta en esta etapa de dev, y vamos a irla relajando mientras se estabilice el
 * producto»*.
 *
 * Estricto significa: **quien no dice qué es, no trabaja**. No hay ventana de gracia ni
 * fecha de caducidad — eso sería un repliegue, y además el que menos conviene ahora: la
 * mitad del valor de esto es obligar a que todas las piezas declaren, y una tolerancia
 * hace justo lo contrario, que nadie se entere de que le falta declarar.
 *
 * Se relaja con `strict: false`, y eso es una decisión de producto que se toma cuando esté
 * estable — no un default que se cuela.
 *
 * ⚠️ **Consecuencia operativa, que no es un detalle:** el día que una pieza empieza a
 * comprobar, deja de hablar con todo el que aún no anuncia. Así que el orden de
 * despliegue es **primero anunciar en todas partes, y encender la comprobación después**.
 */
export const STRICT_BY_DEFAULT = true

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
 * `versions` acepta lo mismo que un rango del manifiesto (`ranges.js`): una versión
 * exacta, un `>=`, un intervalo `a - b`, o una lista que es un O. El dueño pidió rangos
 * para los manifiestos (2026-09-04) y aquí se usa el MISMO comparador, no otro: dos formas
 * de decir «esta versión entra» acaban discrepando, y esa discrepancia no hace ruido.
 *
 * Lo que no se entiende no coincide — no marca roto y tampoco absuelve: solo no dice nada.
 */
export function isBroken (lista, { product, version }) {
  for (const b of lista || []) {
    if (b?.product !== product) continue
    if (satisfies(version, b.versions)) return b
  }
  return null
}

/**
 * ¿TE ACEPTO?
 *
 * **DECIDE LA VERSIÓN QUE ENTRA, no las dos** (dueño, 2026-09-04): *«el que define si es
 * compatible o no es la versión que entra, ya que la versión antigua de un producto no
 * tiene idea con qué es o no compatible»*. Y es exacto: una build de hace tres meses no
 * sabe nada de lo que vino después, así que preguntarle su opinión es preguntarle a quien
 * no puede saber. Quien juzga es quien tiene la lista al día — el que llega.
 *
 * Por eso esto NO es simétrico y no debe serlo: miro si YO te entiendo y si TÚ estás en mi
 * lista de rotas. Lo que tú creas de mí no entra en la cuenta.
 *
 * Y por eso el punto 3 del dueño es la otra mitad y no un adorno: si el viejo no puede
 * juzgar, tampoco puede enterarse solo. **El que rechaza es el único que puede decírselo**,
 * y por eso se avisa en vez de callar (`incompatibleNotice`).
 *
 * @param {object}  o.mine     mi declaración
 * @param {object}  o.theirs   la del otro (o null si no dijo nada)
 * @param {Array}   [o.broken] mi lista de versiones rotas (código + aviso de la red)
 * @param {boolean} [o.strict] `false` afloja lo de «quien no declara no trabaja»
 * @returns {{ok:boolean, code:string, reason:string, peer:object|null}}
 */
export function check ({ mine, theirs, broken = [], strict = STRICT_BY_DEFAULT } = {}) {
  if (!isDeclaration(mine)) throw new Error('compat: my own declaration is not valid')

  if (!isDeclaration(theirs)) {
    return {
      ok: !strict,
      code: UNDECLARED,
      peer: null,
      reason: 'the other side does not say what it is or which version it runs' +
        (strict ? '' : ' (tolerated: this side is not strict)')
    }
  }

  const roto = isBroken(broken, theirs)
  if (roto) {
    return {
      ok: false,
      code: BROKEN_PEER,
      peer: theirs,
      reason: `${theirs.product} ${theirs.version} is known to be broken: ${roto.why || 'no reason recorded'}` +
        (roto.fix ? ` — ${roto.fix}` : '')
    }
  }

  // SOLO MI LADO DECIDE: si entiendo su protocolo, trabajamos. Lo que él entienda del mío
  // no se pregunta — no puede saberlo si es más viejo que yo.
  if (!mine.speaks.includes(theirs.protocol)) {
    return {
      ok: false,
      code: INCOMPATIBLE_PROTOCOL,
      peer: theirs,
      reason: `${mine.product} ${mine.version} speaks protocol ${mine.speaks.join(', ')} and ` +
        `${theirs.product} ${theirs.version} speaks ${theirs.protocol}: update ${theirs.product}`
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

export default { declare, check, isBroken, isDeclaration, incompatibleNotice, OK, INCOMPATIBLE_PROTOCOL, BROKEN_PEER, UNDECLARED, STRICT_BY_DEFAULT }
