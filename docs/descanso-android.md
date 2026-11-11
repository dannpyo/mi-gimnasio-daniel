Cronómetro de descanso y superseries — revisión del 11 de noviembre de 2026.

La alarma funciona con un cronómetro iniciado manualmente. Al llegar a cero, consume la cuenta y emite una sola señal de finalización: dos tonos breves generados con Web Audio, un patrón de vibración si el dispositivo lo permite y, si el usuario las activó, una notificación del service worker. Completar una serie o una pareja nunca inicia el descanso.

El botón de sonido permite silenciar la alarma. «Probar sonido» reproduce una muestra por acción explícita, incluso estando silenciada, sin cambiar esa preferencia ni iniciar un descanso. Iniciar el reloj o activar/probar el sonido crea o reanuda el AudioContext desde una interacción. Si el navegador lo suspende después, se muestra el aviso visual y se invita a probar el sonido; no se reproduce un sonido diferido inesperado al desbloquear el audio.

Las notificaciones son optativas y están desactivadas inicialmente. El permiso sólo se solicita al tocar «Activar notificaciones» y sólo si su estado es `default`. Si fue denegado, se informa cómo revisarlo sin volver a solicitarlo automáticamente. Se usa `ServiceWorkerRegistration.showNotification`, adecuado para Android. Las notificaciones del sistema son silenciosas para no duplicar el sonido generado por la app ni contradecir el botón de silencio. Tocarlas enfoca o abre la PWA. No se envían datos de entrenamiento a ningún servicio externo.

La cuenta usa una fecha límite (`Date.now()`), por lo que, si la página sigue abierta y Android la reanuda, se actualiza el tiempo transcurrido. Pausar conserva los segundos restantes; reiniciar cancela la cuenta y los sonidos activos e invalida los avisos asíncronos pendientes. Volver a tocar Iniciar después de cero crea una cuenta nueva con la duración seleccionada. Las duraciones disponibles siguen siendo 60, 75, 90, 120 y 180 segundos.

En segundo plano o con pantalla bloqueada, Android puede retrasar, suspender o eliminar la página; también puede suspender el audio e impedir la vibración. Una notificación persistente no mantiene vivo el temporizador que debe dispararla. Esta implementación no agenda una alarma en el sistema operativo: intenta mostrar la notificación cuando el JavaScript detecta el vencimiento. Si la página está suspendida puede llegar tarde, al volver, o no llegar. Si la app se cierra o Android descarta su proceso, la cuenta en memoria se pierde. Las preferencias y los registros de ejercicios guardados sí se conservan en localStorage y JSON.

No se utilizan temporizadores de service worker para mantener una cuenta en segundo plano, ni la API experimental Notification Triggers, cuyo desarrollo terminó sin una solución fiable entre plataformas. No se promete puntualidad con pantalla bloqueada. Se requiere una comprobación física en Samsung/Chrome o Samsung Internet para evaluar el volumen, la vibración, los permisos y las restricciones de batería del dispositivo concreto.

Las parejas se forman únicamente si hay un A y un B inequívocos con el mismo número. Cada miembro mantiene su identidad, sus series, su selección y sus registros. El acordeón común agrupa sólo la presentación; no iguala las series ni aplica un bloqueo conjunto. Si se omite un miembro, el texto indica que el restante puede realizarse individualmente. Si un snapshot finalizado sólo contiene un miembro, aparece como tarjeta individual. Full Body y los ejercicios sin una pareja identificada mantienen sus tarjetas individuales.

Fuentes primarias consultadas:

- [Chrome: Page Lifecycle API](https://developer.chrome.com/docs/web-platform/page-lifecycle-api): suspensión y descarte de páginas, especialmente en móviles.
- [Samsung Internet: IntensiveWakeUpThrottlingEnabled](https://developer.samsung.com/browser/policy/intensive-wake-up-throttling-enabled.html): restricciones de temporizadores en segundo plano.
- [Chrome: Notification Triggers](https://developer.chrome.com/docs/web-platform/notification-triggers): finalización del desarrollo y límites de fiabilidad.
- [MDN: Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API): permiso por gesto del usuario y notificaciones persistentes en móviles.
- [MDN: showNotification](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification): notificaciones desde un service worker activo.
- [MDN: prácticas de Web Audio](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices): generación con osciladores y activación por interacción.
