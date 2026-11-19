# EduControl — versión HTML, CSS y JavaScript

Aplicación web de gestión académica sin PHP ni MySQL. Todos los datos se guardan
en el navegador con `localStorage`.

## Cómo abrirla
Se recomienda usar un servidor local simple, por ejemplo la extensión **Live Server** de VS Code,
o `python -m http.server` dentro de la carpeta `educontrol`, y luego abrir `http://localhost:8000/login.html`.

## Usuarios de demostración
| Usuario   | Contraseña     | Rol      |
|-----------|----------------|----------|
| admin     | admin123       | ADMIN    |
| consulta  | consulta123    | CONSULTA |

ADMIN puede registrar, editar y eliminar. CONSULTA solo puede consultar.

## Importante
- La autenticación es **demostrativa**. Las contraseñas se comparan con hashes SHA-256 en el navegador;
  el código es visible y no es seguro para producción.
- Los datos viven en el navegador de cada equipo. Borrar los datos del sitio los elimina.
- Para reiniciar los datos de prueba, borra el almacenamiento local o sube `VERSION_DATOS` en `js/storage.js`.

## Estructura
- `js/storage.js`: datos, validaciones y cálculos (reemplaza SQL y PHP).
- `js/auth.js`: inicio y cierre de sesión.
- `js/layout.js`: menú, permisos por rol, mensajes e impresión.
- Un archivo JS por página para la lógica de cada módulo.
