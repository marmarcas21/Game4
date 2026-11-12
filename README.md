# Brota

Puzzle de jardín para iPhone: 80 niveles, de muy fácil a difícil. Es una PWA estática, sin dependencias y sin paso de compilación.

Tienes un trozo de tierra y unas semillas. Cada flor crece a su manera, y hay que cubrir toda la tierra. El orden importa: lo que ya ha florecido corta el paso a lo siguiente.

| Flor | Cómo crece |
| --- | --- |
| Margarita | Su casilla y las cuatro de al lado |
| Tulipán | Hacia los lados, hasta chocar |
| Lavanda | Hacia arriba y abajo, hasta chocar |
| Trébol | Solo su casilla |
| Rosa | Todo su alrededor |
| Girasol | En diagonal, hasta chocar |
| Diente de león | Salta: dos casillas más allá, en cruz |

- **Plantar:** elige una semilla y toca la tierra. Si mantienes pulsado y arrastras, ves cómo crecería antes de soltar.
- **Ayudas:** deshacer, reiniciar y pista.
- **Mi jardín:** cada nivel superado planta una flor en un jardín propio.

El progreso se guarda en el propio dispositivo.

## Probar en local

```bash
npm start
```

Abre `http://localhost:8080`.

## Publicación

La web se sirve con GitHub Pages desde la rama `gh-pages`, en https://marmarcas21.github.io/Game4/. Para publicar un cambio hay que subirlo a `main` y a `gh-pages`, y subir `VERSION` en `sw.js` para que los iPhone renueven la caché.

Para instalarla: abrir la URL en Safari del iPhone y pulsar **Compartir → Añadir a pantalla de inicio**. Una vez instalada funciona sin conexión.

## Estructura

- `js/engine.js`: reglas de crecimiento y solucionador. Sin DOM.
- `js/game.js`: pantallas, dibujo en canvas, gestos, sonido y guardado.
- `js/flowers.js`: las especies y cómo se dibujan.
- `js/levels.js`: los 80 niveles, cada uno con una solución. Generado, no se edita a mano.
- `tools/gen-levels.mjs`: genera los niveles (`npm run levels`, tarda unos minutos).
- `tools/make-icons.cjs`: genera los iconos (necesita Playwright).
- `sw.js`, `manifest.webmanifest`: parte PWA.
