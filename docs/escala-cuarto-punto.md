# Escala de cuarto de punto

Userscript: [`seneca-quarter-grade-scale.user.js`](../seneca-quarter-grade-scale.user.js) — versión 1.2.1.

## Qué hace

- Añade a cada rúbrica una escala interactiva desde 1 hasta 10, con una marca cada 0,25 puntos.
- Al hacer clic o arrastrar sobre la línea, escribe la nota exacta en el campo numérico correspondiente. Las flechas izquierda/derecha y arriba/abajo mueven la selección en incrementos de 0,25; **Inicio** y **Fin** seleccionan los extremos.
- Oculta visualmente las filas de opciones originales y sus descripciones para ahorrar espacio, manteniéndolas en el DOM para no interferir con el comportamiento interno de Séneca.
- Al situar el puntero sobre la escala, muestra un cuadro compacto con el rango y la justificación de la rúbrica correspondiente.

## Uso

1. Abre la ventana de calificación de una actividad que muestre rúbricas.
2. Usa la escala debajo del encabezado **Nota exacta** para seleccionar la calificación.
3. Guarda la calificación con el flujo habitual de Séneca y verifica que se haya guardado correctamente.

La nota se asigna al campo de entrada de Séneca. La escala no guarda por sí sola ni reemplaza el proceso de guardado.

## Compatibilidad con la planilla

La escala y la planilla son userscripts independientes. La planilla utiliza su propia tabla y el flujo de guardado existente; no necesita la escala. Se pueden activar ambas, pero para editar una tanda de calificaciones en la planilla es recomendable usar las casillas de la tabla y guardar desde **Guardar cambios**.

## Privacidad y compatibilidad

El script no solicita permisos especiales ni implementa una petición de red propia. Depende de la estructura HTML de las rúbricas de Séneca; si el sitio cambia, pueden dejar de mostrarse la escala o los cuadros de justificación.
