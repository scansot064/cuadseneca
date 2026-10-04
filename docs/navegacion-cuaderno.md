# Navegación mejorada del Cuaderno de clase

Userscript: [`seneca-cuaderno-navigation.user.js`](../seneca-cuaderno-navigation.user.js) — versión 0.2.

## Qué hace

- Convierte el selector de grupos del Cuaderno en una fila de pestañas para cambiar de grupo con un clic.
- Recuerda el texto de la evaluación elegida en `localStorage` del navegador.
- Después de cambiar de grupo, espera a que Séneca termine de actualizar el contenido, intenta volver a seleccionar la evaluación recordada y pulsa **Refrescar**.
- Observa cambios dinámicos de la página para volver a enlazar los controles cuando Séneca los reemplaza.

## Uso

1. Abre el Cuaderno de clase en Séneca.
2. Elige una evaluación como de costumbre; su nombre se guardará en el almacenamiento local del navegador.
3. Cambia de grupo usando las pestañas. Si esa evaluación está disponible para el nuevo grupo, el script la seleccionará y actualizará el Cuaderno.

La evaluación se recuerda por navegador y perfil, no se sincroniza con Séneca ni con otros dispositivos. Si el nombre guardado no está disponible para un grupo, el script lo registra en la consola y no puede restaurarlo.

## Privacidad y compatibilidad

El script almacena localmente el nombre visible de la evaluación. No contiene una solicitud de red propia ni necesita permisos especiales de Tampermonkey. Depende de los nombres de controles y elementos actuales de Séneca; una actualización del sitio puede afectar su funcionamiento.
