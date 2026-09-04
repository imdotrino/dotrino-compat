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

### La lista de rotas va por versión EXACTA

Nada de rangos. Un rango pide un comparador de semver, y uno mal escrito es peor que no
tenerlo: falla en silencio y del lado que no toca. Una build rota siempre es una versión
publicada concreta, así que se nombra.

```js
const MIS_ROTAS = [
  { product: 'remote-agent', versions: ['0.5.3'], why: 'pierde el código del error al envolverlo', since: '2026-09-04' }
]
```

### Estricto ahora, y se relaja cuando el producto esté estable

Decidido por el dueño el 2026-09-04: *«la incompatibilidad debe ser estricta en esta etapa
de dev, y vamos a irla relajando mientras se estabilice el producto»*.

Estricto significa **quien no dice qué es, no trabaja**. Sin ventana de gracia: la mitad
del valor de esto es obligar a que todas las piezas declaren, y una tolerancia consigue
justo lo contrario — que nadie se entere de que le falta declarar. Se afloja con
`strict: false`, que es una decisión de producto, no un default que se cuela.

⚠️ **El orden de despliegue no es un detalle.** El día que una pieza empieza a comprobar,
deja de hablar con todo el que aún no anuncia. Así que: **primero anunciar en todas partes,
encender la comprobación después.**

### Decide la versión que ENTRA

*«El que define si es compatible o no es la versión que entra, ya que la versión antigua de
un producto no tiene idea con qué es o no compatible»* (dueño, 2026-09-04).

Es exacto: una build de hace tres meses no sabe nada de lo que vino después. Así que la
comprobación **no es simétrica y no debe serlo** — miro si YO te entiendo y si TÚ estás en
mi lista de rotas; lo que tú creas de mí no entra en la cuenta.

Y de ahí sale por qué el punto 3 es la otra mitad y no un adorno: si el viejo no puede
juzgar, tampoco puede enterarse solo. **El que rechaza es el único que puede decírselo.**

## Qué NO hace

No tiene red, ni disco, ni cripto: son funciones puras. Decidir es de aquí; anunciar y
avisar es de quien lo usa. Y **no tiene dependencias** a propósito: lo importan los ~30
PWA, los daemons y el proxio, y un pilar metido dentro de otro se cuela anidado a cada
consumidor (`PENDIENTES.md`, «pilar anidado»).

## Licencia

MIT.
