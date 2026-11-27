# Guía rápida para modificar EduControl

| Si la profesora pide… | Archivo |
|---|---|
| Cambiar campos/tablas | `database/educontrol.sql` |
| Ajustar conexión MySQL | `api/conexion.php` |
| Revisar API y persistencia | `api/educontrol.php` |
| Cambiar validación o reglas de notas | `js/storage.js` |
| Cambiar acceso/roles | `js/auth.js` y `api/educontrol.php` |
| Cambiar escala de notas | `js/configuracion.js` + tabla `configuracion_academica` |
| Diseño/colores | `css/estilos.css`, `css/login.css` |
| Formulario de estudiantes | `estudiantes/registrar.html`, `estudiantes/editar.html`, `js/estudiantes-form.js` |
| Formulario de calificaciones | `calificaciones/registrar.html`, `calificaciones/editar.html`, `js/calificaciones-form.js` |
| Reportes | `js/reportes.js` y carpeta `reportes/` |
| Estadísticas | `js/estadisticas.js`, `estadisticas/index.html` |
| Copias de seguridad | `js/respaldo.js`, `respaldo/index.html` |

## Consejos
1. Haz una copia de seguridad antes de editar.
2. Modifica solo el archivo del módulo correspondiente.
3. Si cambias una tabla, ajusta el SQL y el endpoint PHP que la usa.
4. Reinicia/recarga la página y prueba el flujo.
5. Revisa `tests/` para ejecutar las pruebas disponibles.
