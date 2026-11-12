# Mimosa

Puzzle de ordenar colores para iPhone: 100 niveles, de muy fácil a difícil. Es una PWA estática, sin dependencias y sin paso de compilación.

Tocas una botella y luego otra para verter. El nivel termina cuando cada color está en su botella.

- **Niveles normales:** de 2 a 12 colores, con dos botellas libres.
- **Misterio:** solo se ve el color de arriba; el resto se descubre al quedar a la vista.
- **Reto (cada 10 niveles):** una sola botella libre.
- **Ayudas:** deshacer, reiniciar, pista y una botella extra por nivel.
- **Mi carta:** cada 5 niveles superados se consigue una bebida nueva (20 en total).

El progreso se guarda en el propio dispositivo.

## Probar en local

```bash
npm start
```

Abre `http://localhost:8080`.

## Publicar e instalar en el iPhone

1. En GitHub: **Settings → Pages → Source: Deploy from a branch → `main` / `(root)`**.
2. Abre la URL de Pages en **Safari** del iPhone.
3. **Compartir → Añadir a pantalla de inicio**.

Una PWA necesita HTTPS; GitHub Pages lo da. Una vez instalada funciona sin conexión.

Al publicar cambios, sube `VERSION` en `sw.js` para que los iPhone renueven la caché.

## Estructura

- `js/engine.js`: reglas del juego y solucionador. Sin DOM.
- `js/game.js`: pantallas, dibujo en canvas, animación de vertido, sonido y guardado.
- `js/levels.js`: los 100 niveles. Generado, no se edita a mano.
- `js/drinks.js`: las bebidas de la carta y su dibujo.
- `tools/gen-levels.mjs`: genera los niveles y comprueba que tienen solución (`npm run levels`).
- `tools/make-icons.cjs`: genera los iconos (necesita Playwright).
- `sw.js`, `manifest.webmanifest`: parte PWA.
