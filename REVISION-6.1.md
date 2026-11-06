Revisión de Mi Gimnasio Daniel Fernández 6.1 — 6 de noviembre de 2026.

Base revisada: `4b31acc102234fd3b1747cf02de4db1bef8e0316` de `main`. Las correcciones se preparan en `fix/pwa-6.1-review` para revisión previa a su incorporación. Esta revisión no publica la aplicación.

El [último despliegue de Pages](https://github.com/dannpyo/mi-gimnasio-daniel/actions/runs/42243023253) terminó con `success` en compilación y publicación. La URL publicada respondió HTTP 200 y cargó ocho tarjetas del día inicial, siete esquemas y el service worker en Chromium sin errores de JavaScript. Las ejecuciones inmediatamente anteriores figuran canceladas durante una secuencia de cargas y eliminaciones de archivos. El usuario confirmó que el error inicial ya está resuelto. No se pudo determinar retrospectivamente la causa exacta de ese error.

`manifest.webmanifest` ya usa rutas relativas válidas para `/mi-gimnasio-daniel/`, con `id`, `start_url` y `scope` en `./`. Los tres PNG se decodifican correctamente: 192×192, 512×512 y apple-touch-icon de 180×180. No requirieron cambios.

Se corrigieron estos comportamientos reproducibles:

| Caso | Antes | Después |
| --- | --- | --- |
| Series retiradas con el contador | El resumen mostraba 200 kg·rep, pero el gráfico sumaba 1000 y el informe mostraba 80 kg como carga máxima en el caso de prueba | Gráficos, informes y referencias previas respetan las series incluidas en la sesión: 200 kg·rep y 20 kg en ese caso |
| Sesión finalizada importada con snapshot de una serie | Podía mostrar cuatro filas del plan original | Muestra el número de series guardado en el snapshot |
| Registro sin el campo opcional `counts` | Ajustar series lanzaba `TypeError` | Inicializa el contador al utilizarlo |
| Isometrías con series adicionales | Las filas que excedían las originales podían sumar segundos como repeticiones al volumen de fuerza | Conserva la unidad de la última serie programada y excluye isometrías del gráfico y del informe de cargas |
| Importación con almacenamiento lleno o bloqueado | Reemplazaba el estado en memoria y anunciaba éxito aunque no pudiera persistirlo | Conserva el estado y el contexto previos y mantiene el aviso de fallo de guardado |
| Navegación con HTTP 503 y pantalla previamente cacheada | Mostraba el error HTTP pese a disponer de la aplicación offline | Recupera la pantalla del caché de esta versión |

El service worker tiene una versión nueva de caché, precarga los archivos sin reutilizar respuestas antiguas del caché HTTP y limita las escrituras a los recursos de la aplicación dentro de su alcance. Las lecturas offline usan su propio caché. Al activarse elimina los cachés anteriores de esta aplicación y conserva los ajenos. El registro usa `updateViaCache: 'none'`. Este tratamiento de errores HTTP es una mejora comprobada con un servidor de prueba; no demuestra que el incidente inicial tuviera esa causa.

Se conserva la clave `mi_gimnasio_daniel_v4`, las claves de sesiones `v4-…` y `v6-…`, la versión de respaldo 61 y la migración de `daniel_gym_pwa_v3` y `daniel_gym_pwa_v1`. Las series excluidas permanecen guardadas y exportables; no se borran para corregir los cálculos. La huella SHA-256 de todos los planes y esquemas coincide con el commit original: incluye ejercicios, orden, series, cargas, repeticiones, alternativas, parejas y notas.

La validación final pasó: comprobaciones estáticas y **11 pruebas de navegador**, sin errores de JavaScript. Incluye siete esquemas y sus 28 días, 12 semanas, Full Body A/B, entrada y bloqueo de series reales, selección, finalización, historial, recarga, gráficos de peso máximo y volumen, mediciones corporales, compresión y guardado de una imagen InBody de prueba, visor, contenido de informes Markdown y HTML, descarga y reimportación de JSON, cuotas de almacenamiento simuladas, manifiesto, iconos, limpieza de cachés antiguos, arranque offline y HTTP 503. Se verificaron respaldos sintéticos v1, v2, v3, v4, v5, v6 y v61 y sesiones existentes en localStorage v4, v5, v6 y v61.

Para repetir las pruebas con Node.js 20 o posterior:

```sh
npm ci
npx playwright install chromium
npm test
```

Si Chromium ya está instalado, puede seleccionarse con `CHROMIUM_PATH=/ruta/a/chromium npm test`. En esta revisión se utilizó Node.js 24, Playwright 1.62.1 y Chromium 156, con una ventana de 390×844 y la aplicación servida bajo la subruta de Pages.

Las pruebas utilizan datos e imágenes sintéticos, sin acceder a los registros del celular. La instalación y actualización reales en Samsung/Android, la impresión física y la legibilidad de fotografías InBody reales quedan pendientes de una comprobación en el dispositivo. El HTML imprimible y su contenido se verificaron por código; no se generó un PDF con datos reales. La primera apertura sin conexión sigue requiriendo una visita online previa que instale el service worker.
