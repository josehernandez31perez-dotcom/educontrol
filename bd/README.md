# Base de datos · EduControl · Etapa E (v4)

**Estado:** escrito. **NINGÚN script de esta carpeta se ha ejecutado en MariaDB 10.4.32.**
No ejecutar sobre la base real `educontrol` sin autorización expresa, copia de seguridad verificada y los resultados
de `00_verificacion_previa.sql`. Las pruebas se ejecutan SOLO sobre `educontrol_pruebas`.

## Orden de instalación (base de PRUEBA primero)

| Orden | Archivo | Qué hace | Toca datos |
|---|---|---|---|
| 0 | `00_verificacion_previa.sql` | **Solo lectura.** Confirma el esquema real, el nombre del índice único de calificaciones, y que no hay cuentas con el rol antiguo. | No |
| 1 | `pruebas/01_base_minima_prueba.sql` | Crea `educontrol_pruebas` con una réplica pre-migración. Falla si ya existe. | Solo base de prueba |
| 2 | `01_nueva_estructura.sql` | Crea las 11 tablas nuevas (períodos, profesores, secciones, asignaciones, inscripciones, evaluaciones, notas, NO APLICA, pendientes, observaciones, auditoría). | Crea tablas |
| 3 | `02_migracion.sql` | Modifica `usuarios`, `estudiantes` y `calificaciones`. **Requiere sustituir `<NOMBRE_INDICE_VERIFICADO>`** por el nombre obtenido en el paso 0. | Estructura; no modifica valores |
| 4 | `04_sesiones_v4.sql` | Tabla `sesiones_app`, función `fn_usuario_de_sesion` (sin FOR UPDATE), procedimientos de sesión. | Crea objetos |
| 5 | `05_procedimientos_v4.sql` | Procedimientos de negocio (47). Todos reciben el token; ninguno recibe identidad. | Crea objetos |
| 6 | `06_permisos_v4.sql` | Cuentas y privilegios. Lo ejecuta **root**, una vez, con contraseñas generadas fuera del proyecto. | Crea cuentas |
| — | `pruebas/03_pruebas_v4.sql` | Pruebas de la Etapa E con resultado esperado. **Anotar el resultado real.** | Solo base de prueba |

## Archivos de reversión

Ejecutar en este orden: **`03b_reversion_tablas_nuevas.sql`** (destruye las tablas nuevas) y después
**`03a_reversion_vinculos_y_roles.sql`** (deshace los cambios de `usuarios`, `estudiantes` y `calificaciones`).
Ambos son destructivos. Ver sus encabezados.

## Prerrequisito de la base de prueba: la cuenta de rol antiguo

La réplica `01_base_minima_prueba.sql` contiene una cuenta con el rol antiguo de solo consulta. La migración `02` **falla
mientras exista**, y eso es intencionado. En la base de PRUEBA, y solo ahí, eliminarla antes de `02`:
`DELETE FROM usuarios WHERE nombre_usuario = 'consulta';`. En la base real, cualquier cambio de cuentas exige decisión escrita.

## Excluido de la instalación

- `opcional/03_triggers_roles_BORRADOR.sql`: **triggers de coherencia de roles. Fuera de la instalación por decisión
  aprobada.** Se conserva como referencia y no debe ejecutarse. Su lógica sí está probada en el modelo SQLite.

## Documentación de seguridad y pruebas

- `SEGURIDAD_IDENTIDAD_v4.md`: modelo de identidad por token (con nota de corrección sobre FOR UPDATE).
- `SEGURIDAD_v5_ANALISIS.md`: análisis de `fn_usuario_de_sesion`, autocommit, transacciones, DEFINER. **Teórico, no comprobado.**
- `REGLAS_BACKEND.md`: reglas de validación del backend (versión v3, con la corrección del rol antiguo).

## Pruebas automatizadas que no necesitan MariaDB

- `node tests/bd-estructura.test.js`: revisión estática de los scripts (124 comprobaciones).
- `node tests/bd-modelo.test.js` y `node tests/bd-roles.test.js`: lógica en SQLite (no es MariaDB).
- `node tests/v4-estatico.test.js`: coherencia entre SQL, PHP y JavaScript (40 comprobaciones).
