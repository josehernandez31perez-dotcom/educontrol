# EduControl

Sistema de gestión académica y calificaciones. Interfaz con HTML, CSS y JavaScript sin frameworks.
Los datos se guardan en el navegador con `localStorage`. Todavía no hay conexión a una base de datos externa.

## Cómo abrirlo

Usa un servidor local simple, por ejemplo la extensión **Live Server** de VS Code, o desde la carpeta del proyecto:

    python -m http.server 8000

Luego abre `http://localhost:8000/login.html`.

## Acceso

El sistema tiene dos roles:

- **ADMIN**: acceso completo, incluidos respaldos y configuración académica.
- **CONSULTA**: solo consulta y reportes. No puede modificar datos ni acceder a respaldos o configuración.

Las credenciales de prueba no se documentan en este archivo. Pide al responsable del proyecto los accesos de prueba.

## Estados de estudiante

| Estado | Significado | Aparece al registrar notas |
|---|---|---|
| ACTIVO | Estudiante vigente | Sí |
| INACTIVO | Suspendido o no vigente temporalmente | No |
| RETIRADO | Salió del centro | No |
| GRADUADO | Completó sus estudios | No |

Los estudiantes no se eliminan para dejar de usarlos: cambia su estado. (La eliminación actual todavía borra sus notas; ver "Pendientes".)

## Configuración académica

Menú **Configuración** (solo ADMIN). Permite cambiar:

- **Nota mínima de la escala** (inicial: 1.0).
- **Nota máxima de la escala** (inicial: 5.0).
- **Nota mínima para aprobar** (inicial: 3.0).

Reglas: cada valor tiene un solo decimal; la mínima debe ser menor que la máxima; la máxima no puede pasar de 10; la aprobación debe estar entre ambas.

Los cambios se aplican de inmediato a todas las notas y estados existentes, porque todavía no hay configuración por año escolar. Si el valor guardado está dañado, se usan los valores iniciales.

El botón **Restablecer valores iniciales** vuelve a 1.0 a 5.0 y aprobación desde 3.0.

## Respaldo de datos

Menú **Respaldo** (solo ADMIN).

### Exportar

Descarga un archivo JSON con estudiantes, materias y calificaciones. **No incluye usuarios ni contraseñas**.

### Formato versión 2 (formato actual)

    {
      "formato": "educontrol-respaldo",
      "version_formato": 2,
      "fecha_exportacion": "2026-11-22T10:00:00.000Z",
      "incluye_usuarios": false,
      "datos": {
        "estudiantes": [ ... ],
        "materias": [ ... ],
        "calificaciones": [ ... ]
      }
    }

Si el archivo incluye la lista `usuarios` (opcional en la versión 2), se valida y reemplaza a los usuarios actuales. Si no la incluye, **los usuarios actuales se conservan**.

### Formato versión 1 (compatibilidad)

Los respaldos de versión 1 siguen siendo importables. Incluyen `usuarios` con su hash SHA-256, y al importarlos reemplazan a los usuarios actuales. Un archivo de versión 1 sin `usuarios` se rechaza.

### Importar

1. Se valida el archivo completo. Si hay errores, se muestra la lista y no se modifica nada.
2. Se muestra una confirmación con las cantidades actuales y las del archivo.
3. Se escribe el respaldo. Si el navegador rechaza la escritura, se restauran los datos anteriores.

Las versiones distintas de 1 y 2 se rechazan.

## Estructura del proyecto

    index.html              Dashboard
    login.html              Inicio de sesión
    estudiantes/            Listado, registro, edición, detalle
    calificaciones/         Listado, registro, edición, rendimiento
    estadisticas/           Estadísticas y búsqueda
    reportes/               Informes individual y general
    respaldo/               Respaldo de datos (ADMIN)
    configuracion/          Configuración académica (ADMIN)
    css/                    Estilos
    js/                     Lógica (ver abajo)
    tests/                  Pruebas automatizadas

Módulos de `js/`:

- `storage.js`: datos, validaciones, cálculos y búsqueda.
- `configuracion.js`: escala de notas y nota mínima de aprobación.
- `auth.js`: inicio y cierre de sesión.
- `layout.js`: menú, permisos por rol, mensajes e impresión.
- `respaldo.js`: exportar, validar e importar respaldos.
- Un archivo por página para la lógica de cada pantalla.

## Pruebas automatizadas

Requiere Node.js (cualquier versión reciente). No necesita navegador ni instalar nada más.

    node tests/run.js

Cada archivo `tests/*.test.js` se ejecuta en un entorno aislado con un `localStorage` simulado. El resultado final indica si todas las pruebas pasaron.

Las pruebas cubren: acceso ADMIN y CONSULTA en respaldos, formato versión 2 sin usuarios ni hashes, compatibilidad con versión 1, reversión ante fallos, configuración de escala y aprobación, estados del estudiante y búsqueda sin tildes.

Las pruebas no reemplazan la revisión en el navegador. La interfaz se verifica manualmente.

## Limitaciones actuales

- Los datos viven en el navegador de cada equipo. Borrar el almacenamiento del sitio elimina los cambios.
- La seguridad por rol se aplica en la interfaz. Es una protección de demostración, no un control real de acceso.
- La configuración académica es única para todo el sistema. Todavía no existe configuración por año escolar.
- Los respaldos no incluyen la configuración académica.
- La contraseña de los usuarios de prueba se guarda como hash SHA-256 en `js/storage.js`.

## Pendientes

- Cambiar la eliminación de estudiantes por retiro o desactivación, para conservar sus notas.
- Ocultar del menú la opción Respaldo y Configuración para los usuarios que no son ADMIN.
- Configuración académica por año escolar.
- Migración a Supabase con roles reales, según el documento de diseño v3.
