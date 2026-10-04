# Planilla de calificaciones

Userscript: [`seneca-grade-spreadsheet.user.js`](../seneca-grade-spreadsheet.user.js) — versión 1.2.0.

## Qué hace

Añade el botón **Planilla** a la ventana de calificación. La tabla muestra estudiantes en filas, criterios en columnas —identificados por el código breve del criterio— y una casilla de nota por cada combinación de estudiante y criterio.

## Uso

1. Abre en Séneca la ventana de calificación de la actividad.
2. Pulsa **Planilla** y después **Cargar alumnado**.
3. Espera a que el script recorra la lista y termine de cargar todas las notas. El progreso se muestra en la parte superior.
4. Edita las casillas necesarias. Se admite coma o punto decimal en la entrada; las notas deben estar entre 0 y 10.
5. Opcionalmente, pulsa **Copiar 1.ª nota al resto** para copiar, en cada fila, la nota no vacía de la primera columna a las demás columnas. Las casillas modificadas quedan pendientes.
6. Pulsa **Guardar cambios**. Revisa en Séneca que los resultados sean correctos.

Los códigos de criterio muestran el nombre completo al pasar el puntero sobre el encabezado.

## Cómo guarda

La planilla no envía una petición masiva propia. Para cargar y guardar, llama a la navegación de Séneca y usa su flujo de guardado **estudiante por estudiante**. Al cargar la tabla, se vuelve a enviar la calificación actual de cada estudiante sin cambios. Al guardar las ediciones, se guardan los estudiantes que tienen cambios y se informa del progreso.

No cierres la ventana de calificación durante la carga o el guardado. Si se interrumpe una operación, lee el mensaje de estado y verifica en Séneca qué notas se guardaron antes de reintentarlo; no asumas que una operación interrumpida fue revertida.

## Privacidad y compatibilidad

Los nombres, identificadores y notas se leen de la página actual y se mantienen en memoria mientras la planilla está abierta. El script depende de funciones y elementos internos de Séneca, por lo que un cambio del sitio puede interrumpir la carga o el guardado.
