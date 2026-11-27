# Análisis de seguridad v5 · fn_usuario_de_sesion, transacciones y autocommit en MariaDB 10.4.32

**Estado: ANÁLISIS TEÓRICO. NINGUNO de los comportamientos descritos ha sido comprobado en MariaDB 10.4.32.**
Cada punto dice qué se ha decidido, por qué, y qué prueba lo demostraría. No se presenta el diseño como seguro
hasta que las pruebas de §6 se ejecuten en la base de pruebas con resultados registrados.

## 1. Qué protege la función

`fn_usuario_de_sesion(token)` devuelve el usuario de un token vigente, no revocado, no caducado, de una cuenta
ACTIVA. Todo el modelo de identidad depende de que solo devuelva ese usuario y que NUNCA devuelva otro.

## 2. FOR UPDATE dentro de la función: retirado

| Cuestión | Conclusión | Estado |
|---|---|---|
| ¿Un `SELECT ... FOR UPDATE` en una función en `autocommit = 1` retiene el bloqueo? | No. En autocommit cada sentencia es su propia transacción; el bloqueo se libera al terminar la sentencia. No protege nada entre la lectura de la función y la escritura posterior. | **NO COMPROBADO** |
| ¿Una función declarada `READS SQL DATA` admite lecturas con bloqueo? | Incierto. Podría rechazarse o comportarse de forma distinta. | **NO COMPROBADO** |
| ¿Qué protege la desactivación simultánea? | El procedimiento que escribe: `sp_interno_contexto_bloqueado` vuelve a leer `rol` y `estado` con `SELECT ... FOR UPDATE` dentro de su `START TRANSACTION`. | Diseño; **NO COMPROBADO** |

**Decisión:** la función NO bloquea. Solo lee. La protección frente a carreras la da el bloqueo de la fila de `usuarios`
en el procedimiento que escribe. Esto corrige lo que proponía `SEGURIDAD_IDENTIDAD_v4.md` (ver nota en ese archivo).

**Prueba que lo demostraría:** `pruebas/03_pruebas_v4.sql`, bloque T-SES-03 (dos sesiones: una desactiva la cuenta mientras
otra ejecuta un procedimiento de escritura; la segunda debe fallar con AUTH o PERM, nunca escribir).

## 3. Autocommit y transacciones

- PDO usa `autocommit = 1` por defecto. Las llamadas `CALL` de lectura no abren transacción.
- Los procedimientos de escritura abren `START TRANSACTION` explícitamente. El `COMMIT` final confirma; el manejador
  `EXIT HANDLER FOR SQLEXCEPTION` hace `ROLLBACK` y relanza el error con `RESIGNAL`.
- **Riesgo conocido:** una sentencia DDL dentro de un procedimiento provoca un COMMIT implícito. Por eso no hay DDL en
  ningún procedimiento. Verificado por comprobación estática (`tests/v4-estatico.test.js`), no por ejecución.
- **Riesgo:** `SELECT ... INTO` sin filas dispara la condición NOT FOUND. Todos los procedimientos y la función declaran
  un manejador `CONTINUE HANDLER FOR NOT FOUND`, de modo que la variable queda NULL y las comprobaciones posteriores
  actúan. **NO COMPROBADO** que MariaDB 10.4.32 se comporte exactamente así.

## 4. Orden de bloqueo (para evitar interbloqueos)

Orden fijo en todos los procedimientos: `usuarios` → `periodos_academicos` → `secciones` → filas hijas
(`estudiante_seccion`, `profesor_seccion`, `calificaciones`, `pendientes_calificacion`).
**Riesgo:** un procedimiento que bloquee en orden distinto puede provocar interbloqueos (error 1213). El código actual
sigue este orden en lo revisado, pero no está verificado con carga concurrente.

## 5. DEFINER y privilegios

- Todos los objetos se crean con `DEFINER = 'educontrol_definer'@'localhost'`, cuenta bloqueada.
- Con `SQL SECURITY DEFINER`, el objeto corre con los privilegios del definidor, no del que lo llama.
- Si se omitiera el DEFINER, el definidor sería quien crea el objeto (root en XAMPP), y el procedimiento correría con
  todos los privilegios. Por eso la comprobación estática exige el DEFINER en todos los objetos.
- **NO COMPROBADO:** que `ACCOUNT LOCK` esté soportado en 10.4.32 (`06_permisos_v4.sql`).

## 6. Pruebas que deben ejecutarse para cerrar este análisis

| ID | Qué demuestra | Resultado esperado |
|---|---|---|
| T-SES-01 | fn devuelve NULL para token inexistente | NULL, sin error |
| T-SES-02 | fn devuelve NULL para token revocado | NULL |
| T-SES-03 | Carrera: desactivar cuenta mientras otra sesión escribe | La escritura falla; nunca se escribe con una cuenta inactiva |
| T-SES-04 | fn devuelve NULL para token caducado | NULL |
| T-SES-05 | `SELECT ... FOR UPDATE` en función (solo para documentar) | Anotar el resultado real: error o no |
| T-SES-06 | Sesión de cuenta ALUMNO llama a un procedimiento ADMIN | PERM (403) |
| T-SES-07 | Dos sesiones de distintos usuarios; cada una ve solo sus datos | Sin cruce |
| T-TX-01 | Error a mitad de un procedimiento de alta | Ninguna fila escrita (ROLLBACK) |
| T-DEF-01 | Llamada con la cuenta de aplicación a un `sp_admin_*` | Error de permiso (1370 esperado; anotar el real) |
| T-DEF-02 | Acceso directo a la cuenta definidora | Error (cuenta bloqueada) |

## 7. Lo que NO cubre este análisis

- Robo de cookie por XSS: mitigado con `HttpOnly`, `SameSite=Strict` y escape, pero no eliminado.
- Un PHP comprometido puede usar cualquier sesión que atienda en ese momento.
- Carga concurrente real: solo pruebas con dos sesiones a mano.
