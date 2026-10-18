# Planilla de calificaciones

Userscript: [`seneca-grade-spreadsheet.user.js`](../seneca-grade-spreadsheet.user.js) — versión 1.3.0.

## Qué hace

Añade el botón **Planilla** a la ventana de calificación. La tabla muestra estudiantes en filas, criterios en columnas —identificados por el código breve del criterio— y una casilla de nota por cada combinación de estudiante y criterio.

## Uso

1. Abre en Séneca la ventana de calificación de la actividad.
2. Pulsa **Planilla**.
3. Antes de cargar, marca **Esta clase permite valores menores de 1** si corresponde a la clase. Sin marcar, se admiten notas de 1 a 10; marcada, de 0 a 10. Las casillas vacías se permiten. Se admite coma o punto decimal.
4. Pulsa **Cargar alumnado** y espera a que el script recorra la lista y cargue todas las notas. El progreso se muestra en la parte superior.
5. Edita las casillas necesarias. Al salir de una casilla, la planilla valida todas las notas de esa fila y autoguarda los cambios válidos del estudiante mediante Séneca. Los autoguardados se procesan de uno en uno. Si alguna nota de la fila no es válida, se marca y no se guarda la fila hasta corregirla.
6. Opcionalmente, pulsa **Copiar 1.ª nota al resto** para copiar, en cada fila, la nota no vacía de la primera columna a las demás columnas. Los valores copiados se validan y se autoguardan estudiante por estudiante.
7. **Guardar cambios** sigue disponible para guardar los cambios pendientes. Antes de guardarlos, la planilla valida todas las casillas y bloquea la operación si encuentra datos no válidos.

Los códigos de criterio muestran el nombre completo al pasar el puntero sobre el encabezado.

## Cómo guarda

La planilla no envía una petición masiva propia. Para cargar y guardar, llama a la navegación de Séneca y usa su flujo de guardado **estudiante por estudiante**. Al cargar la tabla, se vuelve a enviar la calificación actual de cada estudiante sin cambios. Los autoguardados se serializan para evitar solicitudes simultáneas; el botón manual utiliza el mismo flujo y espera a que termine cualquier autoguardado pendiente.

No cierres la ventana de calificación durante la carga o el guardado. Si se interrumpe una operación, lee el mensaje de estado y verifica en Séneca qué notas se guardaron antes de reintentarlo; no asumas que una operación interrumpida fue revertida. Las notas inferiores a 1 deben habilitarse con la casilla antes de cargar una clase que ya las contenga.

## Privacidad y compatibilidad

Los nombres, identificadores y notas se leen de la página actual y se mantienen en memoria mientras la planilla está abierta. El script depende de funciones y elementos internos de Séneca, por lo que un cambio del sitio puede interrumpir la carga o el guardado.
