# Done? — MVP v0.9

Aplicación web móvil para organizar tareas de universidad mediante un interpretador local que guarda automáticamente las tareas al enviar el mensaje.

## Cambios de v0.9

- Corrige el widget de recomendación de Inicio usando directamente los sprites originales y manteniendo texto dentro del recuadro.
- El horario semanal incluye las clases y actividades introducidas por el usuario, las entregas que vencen en el día y **bloques de estudio sugeridos** para tareas pendientes.
- Las clases son fijas; las sesiones sugeridas son propuestas recalculadas en espacios libres, no reservas ni eventos permanentes.
- Conserva el guardado automático de tareas enviadas desde el chat y la edición manual de tareas/clases.
- Comienza con clases y tareas vacías y guarda la información en localStorage de cada navegador.

## Publicación en GitHub Pages

Sube los archivos del ZIP a la raíz de un repositorio público (el archivo `index.html` debe estar en la raíz), luego habilita `Settings > Pages > Deploy from a branch > main > /(root)`.

## Uso

1. Escribe por el chat un mensaje como: `El viernes entrego Taller. Me faltan renders y lámina, necesito 8 horas.`
2. Se registrará automáticamente en Tareas.
3. En Horario, añade una clase o compromiso indicando día y franja horaria.
4. La agenda muestra esa clase y el estudio propuesto dentro de los bloques libres, junto con las fechas de entrega.

## Límites

Este MVP funciona sin cuentas ni base de datos externa. El interpretador es local y basado en reglas; para lenguaje ambiguo puede requerir corrección posterior. Los bloques de estudio son recomendaciones recalculadas y no quedan persistidos como citas.
