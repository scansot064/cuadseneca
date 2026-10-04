# Cuaderno Séneca

Colección de userscripts de Tampermonkey para mejorar algunos flujos de trabajo de Séneca. Cada función se instala, activa y actualiza de forma independiente.

> Proyecto comunitario no oficial. No está afiliado ni respaldado por la Junta de Andalucía ni por Séneca. Úsalo bajo tu responsabilidad y comprueba siempre en Séneca que las calificaciones se han guardado correctamente.

## Scripts incluidos

| Script | Función |
| --- | --- |
| [Navegación mejorada del Cuaderno](seneca-cuaderno-navigation.user.js) | Añade pestañas para cambiar de grupo y recuerda la evaluación seleccionada. Consulta la [documentación](docs/navegacion-cuaderno.md). |
| [Planilla de calificaciones](seneca-grade-spreadsheet.user.js) | Presenta estudiantes en filas y criterios en columnas, permite editar notas y copiarlas desde el primer criterio; guarda mediante el flujo de Séneca estudiante por estudiante. Consulta la [documentación](docs/planilla-calificaciones.md). |
| [Escala de cuarto de punto](seneca-quarter-grade-scale.user.js) | Añade una escala interactiva de 1 a 10 en incrementos de 0,25; oculta visualmente las rúbricas y muestra sus descripciones en un cuadro emergente. Consulta la [documentación](docs/escala-cuarto-punto.md). |

## Instalación en Tampermonkey

1. Instala Tampermonkey en el navegador.
2. Abre el archivo `.user.js` de la función que quieras utilizar.
3. En Tampermonkey, crea un userscript nuevo y pega el contenido del archivo; guarda los cambios.
4. Recarga Séneca. Los scripts se ejecutan en `https://seneca.juntadeandalucia.es/`.
5. Mantén activados solo los scripts que quieras usar. La planilla y la escala de cuarto de punto son funciones independientes; la planilla no necesita la escala.

Para actualizar un userscript, reemplaza su contenido por la versión nueva y recarga la pestaña de Séneca. Una pestaña que ya estaba abierta puede seguir ejecutando la versión anterior.

## Consideraciones importantes

- Estos scripts modifican la interfaz de Séneca en el navegador. No sustituyen el proceso oficial de evaluación.
- La planilla carga y guarda las calificaciones a través del flujo existente de Séneca, una persona cada vez. Al recorrer estudiantes, vuelve a enviar las notas que ya estaban cargadas, incluso si no se editaron.
- Comprueba las notas en Séneca después de guardar. Si el proceso se interrumpe, revisa qué estudiante quedó abierto y qué cambios llegaron a guardarse antes de volver a intentarlo.
- La escala envía el valor elegido al campo numérico de la calificación y utiliza coma en los textos mostrados; valida en Séneca que la nota se haya guardado con el valor esperado.
- Los scripts requieren que Séneca conserve una estructura de página compatible. Cambios del sitio pueden requerir actualizar los selectores o el comportamiento.
- No compartas capturas, archivos ni registros de consola que contengan nombres, identificadores o calificaciones de estudiantes.

## Estructura

```text
cuadseneca/
├── docs/
│   ├── escala-cuarto-punto.md
│   ├── navegacion-cuaderno.md
│   └── planilla-calificaciones.md
├── seneca-cuaderno-navigation.user.js
├── seneca-grade-spreadsheet.user.js
└── seneca-quarter-grade-scale.user.js
```
