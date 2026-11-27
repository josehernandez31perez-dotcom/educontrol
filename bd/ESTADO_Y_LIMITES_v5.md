# Estado de la Etapa E · v5 · Informe de implementación, pruebas y pendientes

Este documento distingue, para cada pieza: **IMPLEMENTADO** (código escrito), **PROBADO** (ejecutado y verificado aquí),
**NO PROBADO** (escrito pero no ejecutado: requiere XAMPP con PHP 8.2.12 y MariaDB 10.4.32) y **PENDIENTE** (no hecho).
No se presenta nada como seguro o terminado sin la prueba correspondiente.

## 1. Entorno en el que se ha trabajado

- Sin PHP. Sin MariaDB. Sin red. Con Node.js 22 y Python 3.
- Consecuencia: **ningún archivo PHP ni ningún procedimiento SQL se ha ejecutado.** Todo lo que toca PHP o SQL está
  en estado NO PROBADO, aunque las comprobaciones estáticas que cruzan capas pasan.

## 2. Archivos

### Nuevos
- `api/v4/index.php`, `api/v4/lib.php`, `api/v4/acciones.php`, `api/v4/config.example.php`, `api/v4/.htaccess`
- `bd/04_sesiones_v4.sql`, `bd/05_procedimientos_v4.sql`, `bd/06_permisos_v4.sql`, `bd/pruebas/03_pruebas_v4.sql`
- `bd/SEGURIDAD_v5_ANALISIS.md`, `bd/SEGURIDAD_IDENTIDAD_v4.md`, `bd/ESTADO_Y_LIMITES_v4.md`, `bd/ESTADO_Y_LIMITES_v5.md`
- `js/academico.js`, `js/exportar.js`, `js/v4/cliente.js`, `js/v4/vistas.js`, `js/v4/paneles.js`, `js/v4/app.js`
- `v4/login.html`, `v4/index.html`
- `tests/academico.test.js`, `tests/exportar.test.js`, `tests/v4-estatico.test.js`, `tests/v4-paneles.test.js`
- `tests/validacion_externa/validar_exportacion.py`

### Modificados (existían en la copia de partida)
- `README.md`: modelo v4, acceso por rol, estado de la Etapa E. Se conserva el texto del modo legado.
- `bd/01_nueva_estructura.sql`: reescrito con el esquema v4 completo (11 tablas). Era un borrador sin instalar.
- `bd/02_migracion.sql`: reescrito con usuarios (rol y estado), estudiantes (vínculo) y calificaciones (origen, período, clave de unicidad). Contiene el marcador `<NOMBRE_INDICE_VERIFICADO>`.
- `bd/00_verificacion_previa.sql`: lista de nombres de restricciones regenerada desde los scripts (55 nombres).
- `bd/03a_reversion_vinculos_y_roles.sql` y `bd/03b_reversion_tablas_nuevas.sql`: reescritos para deshacer lo que añaden 01, 02 y 04.
- `bd/REGLAS_BACKEND.md`, `bd/diagrama_er.md`, `bd/README.md`: referencias al rol antiguo retiradas; instrucciones de instalación.
- `bd/pruebas/02_pruebas_mariadb.sql`: 10 inserciones de inscripciones con materia y período (obligatorios desde v4).
- `tests/bd-estructura.test.js`: expectativas actualizadas a la estructura aprobada (ver §4).

### Sin cambios
- Todo el código legado (`api/` existente, `js/` existente, páginas de la raíz). Verificado con `cmp`.
- Las pruebas de etapas anteriores, salvo la de un rol de ejemplo en `tests/academico.test.js` que usaba el nombre antiguo.

## 3. Lo que queda en CONSULTA (rol antiguo) y por qué

El rol de solo consulta **sigue vivo en el código legado** (`api/login.php`, `js/storage.js`, `js/respaldo.js`) y en pruebas
de etapas A–D. Se mantiene porque: (a) quitarlo de `login.php` cambia el acceso de la instalación actual; (b) las pruebas
de A–D lo usan; (c) me pediste conservar A–D. **Pendiente:** retirarlo cuando el modo v4 sustituya al legado, con tu
autorización expresa. El modo v4 no lo admite en ningún punto.

## 4. Resultados de las pruebas (ejecutadas aquí)

| Suite | Comprobaciones | Resultado |
|---|---|---|
| Suite completa `node tests/run.js` | **635** en 22 archivos | **635 correctas, 0 fallidas** |
| `bd-estructura.test.js` (estática SQL) | 124 | 124 correctas |
| `bd-modelo.test.js` (SQLite, histórico v3) | 35 | 35 correctas |
| `bd-roles.test.js` (SQLite, triggers excluidos) | 14 | 14 correctas |
| `v4-estatico.test.js` (SQL ↔ PHP ↔ JS) | 40 | 40 correctas |
| `v4-paneles.test.js` (funciones puras de la interfaz) | 20 | 20 correctas |
| `academico.test.js` (cálculo de notas) | 28 | 28 correctas |
| `exportar.test.js` (CSV, XLSX, PDF) | 20 | 20 correctas |
| `validar_exportacion.py` (herramientas externas) | 3 | OK |

**Mutaciones que se han detectado** (una restricción quitada a propósito; el archivo se restauró idéntico):
- Cálculo con redondeo incorrecto, rankings visibles para alumnos, aislamiento de profesor roto: detectados.
- Conciliación de la interfaz que da siempre «coincide»: detectada por 2 pruebas.
- Parámetro `p_actor` añadido a un procedimiento: detectado por la comprobación de identidad.
- Restricción de cuenta obligatoria del profesor, cambio de rol, índice de inscripción activa, fechas de período:
  detectados (versión anterior, ver `bd-modelo`).

**Correcciones hechas durante la verificación (y el motivo):**
- Se corrigieron pruebas que no podían fallar (una terminaba en `|| true`; otra era un `true` escrito a mano).
- Se corrigió una prueba que cortaba mal el texto del bloque del alumno y encontraba falsos positivos.
- Se añadió el manejador `NOT FOUND` a la capa de sesiones: sin él, `fn_usuario_de_sesion` podía fallar en lugar de devolver NULL.
- Se corrigió la función de sesión: se retiró `FOR UPDATE` (ver `SEGURIDAD_v5_ANALISIS.md`).
- Se añadió `DEFINER` a todos los objetos; sin él, el objeto correría con los privilegios de root.

## 5. Funcionalidades: terminadas y pendientes

| Funcionalidad | Estado | Prueba |
|---|---|---|
| Roles ADMIN, PROFESOR, ALUMNO en el esquema | IMPLEMENTADO | NO PROBADO (SQL) |
| Perfiles y relaciones profesor, alumno, materia, sección | IMPLEMENTADO | NO PROBADO (SQL) |
| Períodos: crear, cerrar, reabrir (con registro) | IMPLEMENTADO | NO PROBADO (SQL); reglas en `05` |
| Evaluaciones y notas por alumno | IMPLEMENTADO | NO PROBADO |
| NO APLICA con motivo, renormalización, historial | IMPLEMENTADO | NO PROBADO; cálculo probado en `academico.test.js` |
| Pendientes de calificación y su resolución | IMPLEMENTADO | NO PROBADO |
| Observaciones (profesor) | IMPLEMENTADO | NO PROBADO |
| Notas finales por cierre; corrección posterior auditada | IMPLEMENTADO | NO PROBADO (la fórmula SQL debe coincidir con `academico.js`) |
| Clasificación de notas históricas (solo ADMIN) | IMPLEMENTADO | NO PROBADO |
| Auditoría (solo inserción) | IMPLEMENTADO | NO PROBADO |
| Sesiones por token, identidad resuelta en la base | IMPLEMENTADO | NO PROBADO |
| Autenticación (login, logout, contexto) | IMPLEMENTADO | NO PROBADO (PHP) |
| Autorización por rol y propiedad | IMPLEMENTADO en procedimientos y en PHP | NO PROBADO; coherencia estática probada |
| Panel de ADMIN (cuentas, períodos, secciones, calificaciones, auditoría, formularios) | IMPLEMENTADO | Funciones puras probadas; render NO PROBADO |
| Panel de PROFESOR (secciones, evaluaciones, notas, NO APLICA, observaciones) | IMPLEMENTADO | Conciliación probada; render NO PROBADO |
| Panel de ALUMNO (inscripciones, evaluaciones, finales, promedios) | IMPLEMENTADO | Visibilidad probada; render NO PROBADO |
| Cálculos académicos integrados en las pantallas | IMPLEMENTADO como **conciliación**: el servidor calcula; el cliente recalcula y marca diferencias | `v4-paneles.test.js` |
| Reporte individual del alumno | IMPLEMENTADO (listados propios) | NO PROBADO |
| Reporte por sección (notas finales y conciliación) | IMPLEMENTADO | NO PROBADO |
| Reporte por período (ranking) | **PARCIAL**: existe la consulta de administración (`admin.ranking_periodo`) pero **no está en la interfaz** | Pendiente |
| Reporte por materia | **PENDIENTE** | — |
| Reporte general | **PENDIENTE** | — |
| Exportación CSV, Excel y PDF desde las tablas | IMPLEMENTADO | Probado (`exportar.test.js`, herramientas externas) |
| Triggers de coherencia de roles | **EXCLUIDO** por decisión | Lógica probada en SQLite; no instalar |
| Retirada del rol antiguo en el legado | **PENDIENTE** (§3) | — |

## 6. Plan de pruebas en tu XAMPP (solo base de PRUEBA)

Requisitos: XAMPP con PHP 8.2.12 y MariaDB 10.4.32. Una copia de este proyecto en `htdocs`. **Nunca `educontrol`.**

1. **Base de prueba.** Ejecutar `bd/pruebas/01_base_minima_prueba.sql` en phpMyAdmin. Debe crear `educontrol_pruebas`.
2. **Prerrequisito.** En `educontrol_pruebas`: `DELETE FROM usuarios WHERE nombre_usuario = 'consulta';` (solo la base de prueba).
3. **Verificación de compatibilidad** (opcional, recomendado): ejecutar en una base vacía las sentencias de creación de tabla de `01` y de funciones de `04`. Anotar cualquier error de sintaxis.
4. **Estructura.** Ejecutar `01_nueva_estructura.sql`. Esperado: 11 tablas.
5. **Migración.** Ejecutar `00_verificacion_previa.sql` (solo lectura) en `educontrol_pruebas`. Anotar el nombre del índice de `calificaciones` con `(estudiante_id, materia_id)` único. Sustituir `<NOMBRE_INDICE_VERIFICADO>` en `02` y ejecutar. Esperado: 10 calificaciones, todas `HEREDADA`.
6. **Sesiones y procedimientos.** Ejecutar `04_sesiones_v4.sql` y `05_procedimientos_v4.sql`. Anotar cualquier error (es esperable que haya alguno: son NO PROBADOS).
7. **Pruebas de la Etapa E.** Ejecutar `pruebas/03_pruebas_v4.sql` paso a paso. Anotar la salida real de cada prueba.
8. **Permisos.** Revisar y ejecutar `06_permisos_v4.sql` como root, con contraseñas generadas por ti. Probar cada cuenta con `SHOW GRANTS`.
9. **Backend.** Crear `api/v4/config.php` a partir de `config.example.php` **en la copia de prueba** (no versionado). Probar:
   `POST api/v4/index.php?accion=login` con un usuario de prueba, luego `GET ...?accion=contexto`.
10. **Interfaz.** Abrir `http://localhost/<carpeta>/v4/login.html`. Entrar con un ADMIN, un PROFESOR y un ALUMNO de prueba.
11. **Registro.** Anotar, por cada paso, el resultado real. Cualquier discrepancia con lo esperado es un defecto a corregir.

## 7. Plan de instalación y migración en la base real (NO EJECUTADO; requiere tu autorización expresa)

1. Copia de seguridad completa de `educontrol` (phpMyAdmin → Exportar), verificada restaurando en otra base.
2. Ejecutar `00_verificacion_previa.sql`. Si hay cuentas con el rol antiguo, **parar** y decidir por escrito qué hacer con cada una.
3. Confirmar que los pasos 1 a 9 del plan de prueba (§6) han sido superados sin errores pendientes.
4. Ejecutar `01`, `02` (con el nombre del índice verificado), `04`, `05`. Cada uno con la base real seleccionada manualmente.
5. Crear las cuentas con `06` (root), con contraseñas nuevas, no reutilizadas de pruebas.
6. Crear `api/v4/config.php` en el servidor, con las credenciales reales, fuera del repositorio.
7. Crear el primer ADMIN con el procedimiento correspondiente y verificar el acceso.
8. Verificación final: `SHOW GRANTS`, consultas de control de huérfanos y de cuentas sin perfil (ver `PROPUESTA_E1_v3`).

**Reversión:** `03b` y después `03a`, sobre la base real solo con copia de seguridad verificada.

## 8. Lo que NO he podido hacer en este entorno (y por qué)

- Ejecutar PHP ni MariaDB: no están instalados ni hay red para instalarlos.
- Verificar la sintaxis SQL con un motor: no hay parser ni motor.
- Probar la interfaz en un navegador real: solo las funciones puras.
- Comprobar `ACCOUNT LOCK`, `DEFINER` distinto del creador, `ROW_NUMBER()` dentro de procedimientos, `ON DUPLICATE KEY UPDATE`
  con `VALUES()`, y el redondeo de `DECIMAL` en `FLOOR`: todos son NO PROBADOS en 10.4.32.
- Comprobar que la fórmula SQL de `calcular_final` coincide con `js/academico.js` en todos los casos: se debe verificar con
  los vectores del ejemplo (4.05 → 4.1; NO APLICA parcial → 4.3) en `pruebas/03`.
