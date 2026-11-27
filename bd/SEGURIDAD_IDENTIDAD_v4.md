> **CORRECCIÓN (v5):** el código de `fn_usuario_de_sesion` de este documento contenía `FOR UPDATE`. Se ha retirado:
> dentro de una función en autocommit no protege nada. La función solo lee; la protección frente a desactivaciones
> simultáneas la da el bloqueo de `usuarios` en el procedimiento que escribe. Ver `SEGURIDAD_v5_ANALISIS.md`.

# Seguridad de identidad · v4 (corrige el parámetro `p_actor` de la v3)

**Estado:** especificación. **No instalada ni ejecutada.** Requiere: tabla `sesiones_app`, cambios en `api/login.php`
y `api/auth.php` (autorizados con justificación documentada), y los procedimientos de `bd/` con la firma nueva.
Ninguna de estas piezas se ha probado contra MariaDB 10.4.32 ni PHP 8.2.12.

## 1. El problema de la v3

En la v3, cada procedimiento recibía `p_actor` (un `usuario_id`) y confiaba en que PHP lo rellenara con el de la sesión.
Eso significa que **la identidad viaja como dato que PHP puede elegir**. Un error en un endpoint, o un parámetro manipulado
que llegue hasta la llamada, permite actuar como otra persona. Comprobar después el rol de ese `p_actor` no resuelve el problema:
se comprueba el rol de la persona equivocada.

## 2. Corrección: la identidad se resuelve dentro de la base

Los procedimientos **no reciben ningún identificador de usuario**. Reciben el **token de sesión** (el valor aleatorio que
el navegador guarda en una cookie) y resuelven dentro de la base quién es esa sesión, si está vigente y si la cuenta está activa.

```
PHP: lee la cookie (token) ──► CALL sp_xxx(token, ...) ──► la base resuelve usuario, rol, estado, vigencia
```

PHP nunca conoce ni transmite el `usuario_id` de quien actúa. Así no hay parámetro que manipular.

### 2.1 Tabla de sesiones (propuesta, no creada)

```sql
CREATE TABLE sesiones_app (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  token_hash CHAR(64) NOT NULL,            -- SHA2(token, 256); el token en claro nunca se guarda
  usuario_id INT UNSIGNED NOT NULL,
  creada DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expira DATETIME NOT NULL,
  revocada TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sesiones_token (token_hash),
  KEY idx_sesiones_usuario (usuario_id),
  CONSTRAINT fk_sesiones_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 2.2 Resolución dentro del procedimiento (esqueleto, [SIN VERIFICAR])

```sql
-- Función interna: devuelve el usuario de un token vigente, o provoca error.
-- Se usa al inicio de CADA procedimiento. No hay parámetro de identidad.
DELIMITER $$
CREATE FUNCTION fn_usuario_de_sesion(p_token VARCHAR(128)) RETURNS INT UNSIGNED
READS SQL DATA SQL SECURITY DEFINER
BEGIN
  DECLARE v_uid INT UNSIGNED;
  SELECT s.usuario_id INTO v_uid
  FROM sesiones_app s JOIN usuarios u ON u.id = s.usuario_id
  WHERE s.token_hash = SHA2(p_token, 256)
    AND s.revocada = 0 AND s.expira > NOW()
    AND u.estado = 'ACTIVO'
  FOR UPDATE;
  IF v_uid IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Sesión no válida';
  END IF;
  RETURN v_uid;
END$$
DELIMITER ;
```

Una función con `SQL SECURITY DEFINER` no puede modificar datos, así que no es un punto de escritura.
Esto también cubre RV8: el rol y el estado se leen de `usuarios` **en cada llamada**, no de la sesión.

### 2.3 Procedimiento de ejemplo (la lectura de un alumno)

```sql
CREATE PROCEDURE sp_alum_mis_resultados(IN p_token VARCHAR(128))
SQL SECURITY DEFINER
BEGIN
  DECLARE v_uid INT UNSIGNED;
  DECLARE v_rol VARCHAR(20);
  SET v_uid = fn_usuario_de_sesion(p_token);
  SELECT rol INTO v_rol FROM usuarios WHERE id = v_uid;
  IF v_rol <> 'ALUMNO' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Operación no permitida';
  END IF;
  -- Solo las filas del alumno vinculado a ESTA cuenta. No hay ningún id de alumno como parámetro.
  SELECT c.id, c.materia_id, c.periodo_id, c.origen, c.nota
  FROM calificaciones c
  JOIN estudiantes e ON e.id = c.estudiante_id
  WHERE e.usuario_id = v_uid;
END
```

## 3. Matriz de ataques

| # | Ataque | Qué lo bloquea | Residual |
|---|---|---|---|
| A1 | Profesor A envía el id de profesor B en la petición | No existe ningún parámetro de identidad. El procedimiento resuelve A desde su token. | Ninguno por esta vía. |
| A2 | Profesor A pide las notas de una sección de B | Las lecturas filtran por `profesor_seccion` del profesor **resuelto** desde el token. Sin asignación, error genérico. | Ninguno si el token es de A. |
| A3 | Alumno A pide las notas del alumno B | `sp_alum_mis_resultados` filtra por `estudiantes.usuario_id = v_uid`. No recibe id de alumno. | Ninguno si el token es de A. |
| A4 | Alumno A cambia un identificador en la URL o en el cuerpo | El identificador no se usa para autorizar: los procedimientos de alumno no reciben ninguno. | Ninguno. |
| A5 | Cuenta desactivada conserva su sesión | `fn_usuario_de_sesion` exige `u.estado = 'ACTIVO'` en cada llamada. | Ventana de una petición. |
| A6 | Cambio de rol con sesión abierta | El rol se lee de `usuarios` en cada llamada (RV8). | Ninguno. |
| A7 | Reutilizar un token robado | Caduca (`expira`), se revoca al cerrar sesión, y se puede revocar desde ADMIN. | **Sí**: un token robado es válido hasta caducar. Mitigar con caducidad corta y cookie `HttpOnly` y `SameSite=Strict`. |
| A8 | Robo de la cookie por XSS | La cookie es `HttpOnly`, así que JavaScript no puede leerla. Se valida la salida en todas las pantallas. | **Sí** si hay un XSS en la aplicación: el atacante usa la sesión sin leer la cookie. Mitigar escapando todo el HTML generado (ya hecho en `EC.esc`) y revisando cada pantalla nueva. |
| A9 | Escritura desde un formulario ajeno (CSRF) | Token CSRF en cada escritura, además de la cookie `SameSite=Strict`. | Ninguno conocido. |
| A10 | El PHP comprometido lee tokens de otras peticiones | Cada petición solo tiene su propia cookie. Un PHP comprometido puede actuar **con la sesión de quien esté conectado en ese momento** durante el compromiso. | **Sí**: es el límite de cualquier arquitectura con PHP en medio. Mitigar con permisos mínimos de cuenta de conexión (ver `PROPUESTA_E1_v3`). |
| A11 | Lectura de `sesiones_app` por un atacante con acceso a la base | Solo guarda el hash SHA-256 del token. Con el hash no se puede iniciar sesión **si** el procedimiento espera el token en claro. | **Sí** si quien lee la base puede también llamar a los procedimientos con el hash: por eso la cuenta de conexión no tiene `SELECT` sobre `sesiones_app`. |
| A12 | Un ADMIN comprometido | Puede actuar como ADMIN. Es el poder de ese rol. Lo limitan la auditoría y las reglas de último ADMIN. | **Sí**. Ver auditoría y procedimientos. |

## 4. Cambios necesarios en PHP (no realizados)

- `api/login.php`: tras verificar la contraseña y comprobar `estado`, generar 32 bytes aleatorios con `random_bytes()`,
  guardar `SHA2(token)` en `sesiones_app` mediante un procedimiento, y enviar el token en una cookie
  `HttpOnly; SameSite=Strict; Secure` (cuando haya HTTPS).
- `api/auth.php`: `usuario_sesion()` ya no lee `$_SESSION['usuario_id']` como fuente de identidad. Pasa a ser un
  envoltorio que llama a los procedimientos con el token. La sesión de PHP solo guarda el token.
- Cierre de sesión: marca `revocada = 1` en la fila del token.
- **Sin compatibilidad hacia atrás:** las sesiones abiertas antes del cambio dejan de ser válidas. Es intencionado.

**Justificación de este cambio (requerida por tus instrucciones):** la identidad no puede depender de un dato que
PHP pueda elegir. Esto cambia `login.php` y `auth.php`, y la forma de las llamadas a la base. Está documentado aquí.

## 5. Lo que no se ha comprobado

- Que MariaDB 10.4.32 acepte `SIGNAL` en funciones, `FOR UPDATE` dentro de una función, y `SQL SECURITY DEFINER` en funciones.
- Que `SHA2(texto, 256)` devuelva el mismo valor que `hash('sha256', texto)` de PHP para el mismo token (hay que comprobarlo con una prueba real).
- Que `random_bytes()` esté disponible en la instalación de PHP 8.2.12 (es estándar desde PHP 7).
- El comportamiento de las cookies `SameSite` en el navegador usado.
