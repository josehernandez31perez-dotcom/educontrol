# Actualización: fecha y año de ingreso — Fase 1

## Objetivo
Mostrar cuándo ingresó cada estudiante y el año calendario derivado de esa fecha, sin pedir un dato adicional al usuario.

## Cómo funciona
- La tabla `estudiantes` ya contiene `fecha_registro` con `DEFAULT CURRENT_TIMESTAMP`.
- Al registrar, MariaDB guarda esa fecha automáticamente.
- La interfaz presenta esa fecha como **Fecha de ingreso**.
- `EC.anioIngreso()` obtiene los primeros cuatro dígitos de la fecha y muestra el año correspondiente.
- No se agregó una columna ni se modificó el esquema SQL.

## Dónde se muestra en esta fase
- Listado general de estudiantes: fecha y año de ingreso.
- Ficha/detalle del estudiante: fecha y año de ingreso.
- Lista de calificaciones: año de ingreso del estudiante, además de la fecha propia de la nota.
- Detalle de una calificación: fecha y año de ingreso del estudiante.
- Panel de rendimiento en Calificaciones: año de ingreso.

## Distinción importante
`fecha_registro` de estudiantes es la fecha de ingreso. `fecha_registro` de calificaciones es la fecha en que se capturó una nota. No son el mismo dato. El esquema de esta versión no contiene un período/año académico asignado a cada nota; esa funcionalidad debe diseñarse en una fase posterior y no debe deducirse de la fecha de ingreso.

## Archivos modificados
- `js/layout.js`
- `js/estudiantes.js`
- `js/estudiantes-detalle.js`
- `js/estudiante-ver.js`
- `api/listar_calificaciones.php`
- `js/calificaciones.js`
- `estudiantes/registrar.html`
- `README.md`

## Instalación segura
1. Haz una copia de seguridad de la carpeta actual.
2. Extrae este ZIP en una carpeta de prueba independiente.
3. Compara y copia únicamente los archivos modificados, si deseas integrar esta fase en tu instalación.
4. No importes `database/educontrol.sql` ni ejecutes migraciones por esta actualización: no son necesarias.
5. Comprueba listado, ficha de estudiante y calificaciones con XAMPP.

## Verificaciones realizadas en el paquete
- Sintaxis JavaScript: `node --check` sobre todos los archivos JS, sin errores.
- Sintaxis PHP: `php -l` sobre los endpoints PHP, sin errores.
- Pruebas del proyecto: el ZIP original ya tenía 34 comprobaciones fallidas; esta copia también presenta 34. Por tanto, no se atribuyen esos fallos preexistentes a esta actualización. Revisar el resultado completo con `node tests/run.js`.
- No se ejecutó en un navegador ni contra la base MariaDB real.
