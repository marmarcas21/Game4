# Desliza

Puzzle de deslizar para iPhone: 70 niveles repartidos en 7 días, de fácil a difícil. Es una PWA estática, sin dependencias y sin paso de compilación.

Deslizas el dedo y el personaje se mueve hasta chocar. Hay que llegar a la salida en los menos movimientos posibles. Cada día añade una mecánica:

| Día | Mecánica | Movimientos mínimos |
| --- | --- | --- |
| 1 | Primeros pasos | 2–7 |
| 2 | Gemas (abren la salida) | 4–10 |
| 3 | Pinchos | 6–10 |
| 4 | Portales | 5–10 |
| 5 | Bloques frágiles | 7–12 |
| 6 | Flechas | 6–13 |
| 7 | Todo junto | 9–16 |

## Probar en local

```bash
npm start
```

Abre `http://localhost:8080`. En escritorio se juega con las flechas del teclado (`z` deshace, `r` reinicia).

## Publicar e instalar en el iPhone

1. En GitHub: **Settings → Pages → Source: Deploy from a branch → `main` / `(root)`**.
2. Abre la URL de Pages en **Safari** del iPhone.
3. **Compartir → Añadir a pantalla de inicio**.

Una PWA necesita HTTPS; GitHub Pages lo da. Una vez instalada funciona sin conexión.

Al publicar cambios, sube `VERSION` en `sw.js` para que los iPhone renueven la caché.

## Estructura

- `js/engine.js`: reglas del juego y solucionador (BFS). Sin DOM.
- `js/game.js`: pantallas, dibujo en canvas, gestos, sonido y guardado.
- `js/levels.js`: los 70 niveles. Generado, no se edita a mano.
- `tools/gen-levels.mjs`: genera los niveles y comprueba que tienen solución (`npm run levels`).
- `tools/make-icons.cjs`: genera los iconos (necesita Playwright).
- `sw.js`, `manifest.webmanifest`: parte PWA.
