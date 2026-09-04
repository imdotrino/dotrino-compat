# @dotrino/compat

Qué versión eres, y si dos piezas del ecosistema pueden trabajar juntas.

## Por qué existe

Hoy una incompatibilidad de versiones se manifiesta como **silencio**. Los tres casos que
lo pagaron caro:

- **El apagón del 1-2 de septiembre de 2026.** Endurecer la bóveda dejó mudos a `content`,
  a los selladores y al bot social durante un día entero. Ningún fallo era un error: eran
  reintentos cada 60 segundos contra alguien que ya no les entendía.
- **`@dotrino/env` pedía `^0.33.2`** con la librería en 0.60. Enrolar contestaba
  `invalid cert: no-acta` — verdad, pero no la causa. La causa era la versión.
- **La bóveda muda tres días** porque su respuesta pasaba el tope del proxio: el socket
  moría con un 1009 y no lo decía nadie.

El que llama no sabe si el otro está apagado, ocupado o hablando otro idioma, así que
reintenta para siempre. El que atiende no sabe que le están hablando.

## La regla (dueño, 2026-09-04)

1. **El administrador muestra las versiones que se están corriendo.**
2. **Una versión nueva sale con su lista de compatibilidad.** Si se detecta un fallo en
   una versión, se marca incompatible.
3. **Las incompatibles se comunican, pero solo para avisar de la incompatibilidad**, y no
   trabajan hasta que se resuelva.

Aplica a **todos los productos** del ecosistema.

## Cómo se usa

```js
import { declare, check, incompatibleNotice } from '@dotrino/compat'

// Lo que soy. Va en el sobre de cada conexión.
const mine = declare({ product: 'vaultd', version: pkg.version, protocol: 3, speaks: [2, 3] })

// Lo que decido cuando llega alguien.
const v = check({ mine, theirs: p.v, broken: MIS_ROTAS })
if (!v.ok) {
  responder(incompatibleNotice({ mine, theirs: p.v, verdict: v }))   // se avisa…
  return                                                            // …y no se trabaja
}
```

### Es política del CÓDIGO, no de la cuenta

Decidido por el dueño el 2026-09-04: **la compatibilidad la deciden los que desarrollan.**
Por eso la lista vive en el código y viaja dentro de la versión; se cambia publicando una
versión nueva, y **nada en marcha puede cambiarla a distancia**.

No tiene que ver con el perfil ni con el acta. El acta dice quién puede qué en TU cuenta;
esto dice qué build entiende a qué build, y eso no es asunto del usuario.

Consecuencia buscada: **no existe ningún interruptor remoto**. Nadie —tampoco Dotrino—
puede dejar sin funcionar el software que alguien se instaló. El precio se dice: un fallo
detectado hoy solo frena a la versión mala allí donde alguien instale la que la rechaza.

### `protocol` y `version` son dos cosas distintas, y hacen falta las dos

- **`protocol`** (entero) sube **solo cuando cambia el cable**. Es lo que decide *si
  podemos hablar*. Comparar semver entre productos es combinatoria; comparar un entero no.
- **`version`** identifica la build. Es lo que decide *si esta build concreta está rota*.
  Una versión rota suele hablar el protocolo correcto — por eso el entero no basta.

### La comparación de protocolo es simétrica; la lista de rotas no

Los dos lados anuncian `protocol` y `speaks`, así que los dos llegan a la misma respuesta.
Eso importa: si uno trabaja y el otro rechaza, vuelve el estado a medias del que venimos.

La lista de rotas no puede ser simétrica: quien sabe que la 0.99.0 está rota es el nuevo; el
viejo no sabe nada de sí mismo. **Por eso el rechazo se dice** — el que rechaza es el único
que puede enterar al otro.

### La lista de rotas va por versión EXACTA

Nada de rangos. Un rango pide un comparador de semver, y uno mal escrito es peor que no
tenerlo: falla en silencio y del lado que no toca. Una build rota siempre es una versión
publicada concreta, así que se nombra.

```js
const MIS_ROTAS = [
  { product: 'remote-agent', versions: ['0.5.3'], why: 'pierde el código del error al envolverlo', since: '2026-09-04' }
]
```

### Quien no declara nada: repliegue de migración, con fecha

Hoy no lo anuncia nadie. Cortar a quien calla el día uno apaga el ecosistema entero para
arreglar que a veces se apaga solo. Así que hasta **2026-12-01** se le atiende y queda
dicho (`code: 'undeclared'`); a partir de ahí, callar es incompatible.

Es la única clase de repliegue permitida por `CLAUDE.md`: declarado, acotado y con fecha —
y con un test que la fija, para que no se mueva sola.

## Qué NO hace

No tiene red, ni disco, ni cripto: son funciones puras. Decidir es de aquí; anunciar y
avisar es de quien lo usa. Y **no tiene dependencias** a propósito: lo importan los ~30
PWA, los daemons y el proxio, y un pilar metido dentro de otro se cuela anidado a cada
consumidor (`PENDIENTES.md`, «pilar anidado»).

## Licencia

MIT.
