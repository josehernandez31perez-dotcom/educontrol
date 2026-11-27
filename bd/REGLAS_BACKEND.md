# Reglas de validación del backend · Etapa E (Parte 1)

**Estado:** especificación para la Parte 2. **No implementada.** Ningún endpoint PHP se ha modificado.
**Principio:** estas reglas se aplican en el backend (PHP), dentro de la misma transacción que la escritura.
La interfaz puede ocultar botones, pero no es una protección: cualquier petición HTTP puede
llegar al endpoint directamente.

Cada regla indica: **qué comprueba**, **dónde** (endpoint o función), **cómo** (SQL de referencia),
**respuesta** si falla, y **prueba** que la Parte 2 debe implementar.

---

## 1. Qué garantiza hoy la base de datos (y qué no)

| Garantía | ¿La da la base? | Cómo |
|---|---|---|
| Un profesor tiene una sola cuenta | Sí | `profesores.usuario_id` UNIQUE + NOT NULL |
| Un alumno tiene como mucho una cuenta | Sí | `estudiantes.usuario_id` UNIQUE |
| La cuenta de un profesor tiene rol PROFESOR | **No** | Un CHECK no puede consultar otra tabla en MariaDB |
| La cuenta de un alumno tiene rol ALUMNO | **No** | Igual |
| No se cambia el rol de una cuenta vinculada | **No** | Igual |
| Sin alumno inscrito dos veces activo en la misma sección | Sí | Columna VIRTUAL + UNIQUE (ver informe, verificación pendiente) |
| Sin asignación profesor-sección duplicada | Sí | PRIMARY KEY compuesta |
| Sin huérfanos | Sí | FOREIGN KEY RESTRICT |
| Sección inactiva no acepta asignaciones | **No** | Estado de otra tabla |
| Estudiante inactivo no se inscribe | **No** | Estado de otra tabla |
| Período cerrado no acepta cambios | **No** | Estado de otra tabla |

**Conclusión:** las reglas que cruzan tablas (roles, estados, períodos) **solo puede garantizarlas el backend**,
o un trigger como segunda barrera (ver `bd/opcional/03_triggers_roles_BORRADOR.sql`, sin verificar).

---

## 2. Roles y vínculos

### RV1 · Crear o vincular un profesor
- **Comprueba:** el usuario existe y `rol = 'PROFESOR'`; no tiene ya un profesor vinculado; la cédula no existe.
- **SQL de referencia:**
  ```sql
  SELECT rol FROM usuarios WHERE id = ? FOR UPDATE;   -- rol debe ser 'PROFESOR'
  ```
- **Si falla:** rol distinto → **422** ("el usuario debe tener rol PROFESOR"). Ya vinculado (1062) → **409**. Cédula duplicada (1062) → **409**.

### RV2 · Vincular un alumno a una cuenta
- **Comprueba:** `rol = 'ALUMNO'`; el alumno no tiene ya otra cuenta; la cuenta no está vinculada a otro alumno.
- **Si falla:** **422** (rol) o **409** (duplicado).

### RV3 · Cambiar el rol de un usuario
- **Comprueba:** si la cuenta está vinculada a un profesor (rol PROFESOR) o a un alumno (rol ALUMNO), **no** se permite cambiar el rol.
- **Dónde:** cualquier endpoint futuro de gestión de usuarios. Hoy no existe.
- **Si falla:** **409** ("usuario vinculado a un profesor/alumno").

### RV4 · Eliminar un usuario
- Para un profesor: `profesores.usuario_id` tiene RESTRICT → la base impide borrar (1451 → **409**).
- Para un alumno: `estudiantes.usuario_id` tiene **SET NULL**: borrar la cuenta desvincula al alumno **sin aviso**.
  **Regla propuesta:** el backend impide borrar cuentas vinculadas a alumnos (**409**), en lugar de permitir el SET NULL silencioso.

### RV5 · Autorización de un profesor (lectura y escritura sobre secciones)
- **Comprueba:** para cada petición con rol PROFESOR, la sección pedida debe tener una fila en `profesor_seccion`
  cuyo profesor tenga `profesores.usuario_id = $_SESSION['usuario_id']`.
- **SQL de referencia:**
  ```sql
  SELECT 1 FROM profesor_seccion ps
  JOIN profesores p ON p.id = ps.profesor_id
  WHERE p.usuario_id = ? AND ps.seccion_id = ?;
  ```
- **Si falla:** **404** (la misma respuesta que si la sección no existiera). No devolver 403 distinto: revelaría que la sección existe.

### RV6 · Autorización de un alumno
- **Comprueba:** el alumno solo consulta filas donde `estudiantes.usuario_id = $_SESSION['usuario_id']`.
- **Si falla:** **404** (uniforme, ver RV5).

### RV7 · Roles en los endpoints de lectura (condición previa)
- Hoy `listar_estudiantes`, `listar_materias` y `listar_calificaciones` exigen sesión **pero no comprueban rol**.
  Con cuentas PROFESOR o ALUMNO, cualquiera con sesión leería todas las calificaciones.
- **Regla:** cada endpoint declara los roles permitidos. Propuesta:
  - ADMIN: lectura completa (rol CONSULTA retirado en v4).
  - PROFESOR: solo sus secciones (RV5).
  - ALUMNO: solo sus datos (RV6).
- **Esta regla es condición previa para crear cuentas PROFESOR o ALUMNO en la base real.**

### RV8 · Sesiones con rol desactualizado
- `usuario_sesion()` toma `rol` de la sesión, que se fijó en el login (`api/login.php`).
  Si el rol cambia en la base, la sesión activa conserva el antiguo hasta cerrarla.
- **Regla:** en endpoints que dependen del rol de un profesor o alumno, releer `usuarios.rol` desde la base
  en cada petición, o invalidar las sesiones de un usuario cuyo rol cambie.

---

## 3. Estados

### ES1 · Profesor inactivo
- **Comprueba:** para asignar a una sección, `profesores.estado = 'ACTIVO'`.
- **Pendiente de decisión:** qué ocurre si un profesor pasa a INACTIVO con asignaciones vigentes:
  (a) bloquear el cambio hasta retirar sus asignaciones (**409**), o (b) desasignarlas. Recomendación: (a).

### ES2 · Estudiante inactivo
- **Comprueba:** para inscribir, `estudiantes.estado = 'ACTIVO'`.
- **Pendiente de decisión:** si un alumno pasa a INACTIVO, RETIRADO o GRADUADO con inscripciones ACTIVAS:
  bloquear (**409**) hasta cerrarlas, o cerrarlas automáticamente con `fecha_fin`. Recomendación: bloquear.

### ES3 · Sección inactiva
- **Comprueba:** para nuevas asignaciones e inscripciones, `secciones.estado = 'ACTIVA'`.
- Las asignaciones e inscripciones existentes se conservan (solo lectura).
- **Si falla:** **409** ("la sección está inactiva").

### ES4 · Cuenta de usuario deshabilitada (**hueco del modelo**)
- `usuarios` no tiene columna de estado: no hay forma de desactivar una cuenta sin borrarla.
- Sin esto, un profesor o alumno inactivo podría seguir iniciando sesión.
- **Propuesta para la Parte 2:** añadir `usuarios.activo` (o equivalente), con comprobación en `login.php` y en `requerir_sesion()`. **Requiere autorización:** toca autenticación.

---

## 4. Períodos

### PE1 · Período cerrado
- **Comprueba:** para crear secciones, asignaciones o inscripciones, y para cambiar su estado, el período de la
  sección debe tener `estado = 'ABIERTO'`.
- **SQL de referencia (en la misma transacción):**
  ```sql
  SELECT p.estado FROM secciones s
  JOIN periodos_academicos p ON p.id = s.periodo_id
  WHERE s.id = ? FOR UPDATE;
  ```
- **Si falla:** **409** ("el período está cerrado").

### PE2 · Cierre manual
- Solo ADMIN, con CSRF (`requerir_csrf()`), en una transacción, que fija `estado='CERRADO'` y `fecha_cierre=NOW()`.
- La base exige `fecha_cierre` al cerrar (CHECK), así que no puede quedar CERRADO sin fecha.
- La llegada de `fecha_fin` **no** cierra nada.

### PE3 · Reapertura
- La estructura permite reabrir (`CERRADO → ABIERTO` con `fecha_cierre = NULL`).
- **Pendiente de decisión:** si se permite. Recomendación: solo ADMIN, con motivo registrado, y sin cambiar el historial.

### PE4 · Fechas
- `fecha_fin >= fecha_inicio` lo impone la base (CHECK). El backend debe devolver **422** antes de llegar a la base, con un mensaje claro.

---

## 5. Transacciones y concurrencia

### TX1 · Operaciones multi-fila en una transacción
- Asignar varias secciones a un profesor, o inscribir a un alumno en varias secciones, es **todo o nada**.

### TX2 · Bloqueo de las filas que se validan
- Las comprobaciones de estado (RV, ES, PE) deben hacerse con `SELECT ... FOR UPDATE` **dentro de la misma transacción**
  que la escritura. Sin esto, dos peticiones simultáneas pueden pasar ambas la validación (por ejemplo, un cierre de
  período y una inscripción a la vez).
- **Inscripción, referencia completa:**
  ```sql
  START TRANSACTION;
  SELECT estado FROM estudiantes WHERE id = ? FOR UPDATE;      -- ESTUDIANTE ACTIVO
  SELECT s.estado, p.estado FROM secciones s
    JOIN periodos_academicos p ON p.id = s.periodo_id
    WHERE s.id = ? FOR UPDATE;                                  -- SECCIÓN ACTIVA, PERÍODO ABIERTO
  INSERT INTO estudiante_seccion (estudiante_id, seccion_id) VALUES (?, ?);
  COMMIT;
  ```
  Si una comprobación falla: `ROLLBACK` y responder según la tabla de errores (sección 7).

### TX3 · Las restricciones de la base son la última barrera
- Aunque el backend valide, UNIQUE, CHECK y FOREIGN KEY deben seguir activos. El backend traduce sus errores (sección 7).

---

## 6. Seguridad general (para todos los endpoints nuevos)

- Consultas con **sentencias preparadas** (PDO). Nunca concatenar datos del usuario.
- Escrituras con `requerir_rol('ADMIN')` (o la regla de rol que corresponda) y `requerir_csrf()`.
- Respuestas de error sin detalles de SQL (`PDOException` nunca al cliente).
- No registrar contraseñas ni hashes en logs.

---

## 7. Traducción de errores de la base

| Código MariaDB | Significado | Respuesta HTTP | Mensaje (ejemplo) |
|---|---|---|---|
| 1062 | Duplicado (UNIQUE / PRIMARY KEY) | 409 | "Ya existe un registro con esos datos" |
| 1451 | No se puede borrar: tiene dependencias (RESTRICT) | 409 | "No se puede eliminar: tiene asignaciones o inscripciones" |
| 1452 | Referencia inexistente (FOREIGN KEY) | 422 | "La sección o el alumno indicado no existe" |
| 1048 | Campo obligatorio vacío | 422 | "Falta un dato obligatorio" |
| 1265 | Valor no admitido (ENUM) | 422 | "Valor no válido" |
| 4025 | Restricción CHECK incumplida | 422 | Mensaje específico según la regla (fechas, cierre, fin de inscripción) |
| 45000 | Trigger de roles (solo si se activa el borrador) | 422 | Texto del SIGNAL |

Los mensajes se generan en el backend; no se reenvía el texto del motor.

---

## 8. Pruebas que deben implementarse en la Parte 2

| ID | Caso | Esperado |
|---|---|---|
| T-RV1 | Vincular profesor a una cuenta sin rol PROFESOR | 422 |
| T-RV1b | Vincular profesor a cuenta PROFESOR ya vinculada | 409 |
| T-RV2 | Vincular alumno a cuenta PROFESOR | 422 |
| T-RV3 | Cambiar rol de cuenta vinculada a profesor | 409 |
| T-RV4 | Borrar cuenta vinculada a alumno | 409 |
| T-RV5 | Profesor pide sección ajena | 404 (igual que si no existiera) |
| T-RV5b | Profesor pide sección propia | 200 |
| T-RV6 | Alumno pide calificaciones de otro alumno | 404 |
| T-RV7 | Cuenta PROFESOR llama a `listar_calificaciones` completo | Solo sus secciones (o 403 si no está permitido) |
| T-RV8 | Cambiar rol en base con sesión activa | La siguiente petición usa el rol nuevo |
| T-ES1 | Asignar profesor INACTIVO | 409 |
| T-ES2 | Inscribir alumno INACTIVO | 409 |
| T-ES3 | Asignar a sección INACTIVA | 409 |
| T-PE1 | Inscribir en sección de período CERRADO | 409 |
| T-PE2 | Cierre manual sin CSRF | 403 |
| T-PE3 | Cierre manual por un PROFESOR | 403 |
| T-PE4 | Período con fecha_fin < fecha_inicio | 422 |
| T-TX1 | Asignación múltiple con un fallo a mitad | Ninguna fila escrita |
| T-TX2 | Cierre de período y alumno inscribiéndose a la vez | Una de las dos falla; nunca ambas tienen éxito |
| T-TX3 | Inscripción duplicada activa | 409, sin efecto parcial |

Estas pruebas son **de backend (PHP)**. No pueden ejecutarse hasta implementar los endpoints.
