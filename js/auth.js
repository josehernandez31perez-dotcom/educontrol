/* js/auth.js - Sesión y autenticación mediante la API PHP.
   La sesión vive en el servidor (cookie HttpOnly). El navegador solo conserva en memoria
   el usuario, el rol y el token CSRF que devuelve el servidor. */
(function (global) {
    'use strict';

    var EC = global.EC = global.EC || {};

    var sesionActual = null;   // sesión verificada por el servidor en esta página
    var tokenCsrf = '';

    function urlApi(ruta) {
        return (global.EC_BASE || '') + 'api/' + ruta;
    }

    EC.auth = {
        // Síncrono: devuelve la sesión verificada al cargar la página, o null
        sesion: function () {
            return sesionActual;
        },

        // Uso interno de las pruebas automatizadas
        _fijarSesion: function (valor) {
            sesionActual = valor;
            tokenCsrf = valor ? 'token-de-prueba' : '';
        },

        // Pregunta al servidor si hay sesión. Devuelve el usuario o null.
        cargarSesion: function () {
            return fetch(urlApi('sesion.php'), { cache: 'no-store', headers: { 'Accept': 'application/json' } })
                .then(function (respuesta) {
                    if (respuesta.status === 401) {
                        sesionActual = null;
                        tokenCsrf = '';
                        return null;
                    }
                    if (!respuesta.ok) { throw new Error('HTTP ' + respuesta.status); }
                    return respuesta.json().then(function (datos) {
                        tokenCsrf = datos.csrf || '';
                        sesionActual = { usuario: datos.usuario, rol: datos.rol };
                        return sesionActual;
                    });
                });
        },

        // Obtiene el token CSRF necesario para iniciar sesión
        obtenerCsrf: function () {
            return fetch(urlApi('csrf.php'), { cache: 'no-store', headers: { 'Accept': 'application/json' } })
                .then(function (respuesta) {
                    if (!respuesta.ok) { throw new Error('HTTP ' + respuesta.status); }
                    return respuesta.json();
                })
                .then(function (datos) {
                    tokenCsrf = datos.csrf;
                    return datos.csrf;
                });
        },

        // Resuelve true si las credenciales son correctas, false si no lo son.
        // Lanza error si no se puede contactar con el servidor.
        iniciarSesion: function (usuario, clave) {
            return EC.auth.obtenerCsrf().then(function () {
                return fetch(urlApi('login.php'), {
                    method: 'POST',
                    cache: 'no-store',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'X-CSRF-Token': tokenCsrf
                    },
                    body: JSON.stringify({ usuario: String(usuario || ''), clave: String(clave || '') })
                });
            }).then(function (respuesta) {
                if (respuesta.status === 401) { return false; }
                if (!respuesta.ok) { throw new Error('HTTP ' + respuesta.status); }
                return respuesta.json().then(function (datos) {
                    tokenCsrf = datos.csrf || '';
                    sesionActual = { usuario: datos.usuario, rol: datos.rol };
                    return true;
                });
            });
        },

        // Cierra la sesión en el servidor. Resuelve true solo si el servidor confirma el cierre.
        // Si no lo confirma (red caída, error HTTP o respuesta no válida), rechaza la promesa
        // y conserva la sesión local para que el usuario pueda reintentarlo.
        cerrarSesion: function () {
            return fetch(urlApi('logout.php'), {
                method: 'POST',
                cache: 'no-store',
                headers: { 'Accept': 'application/json', 'X-CSRF-Token': tokenCsrf }
            }).then(function (respuesta) {
                if (!respuesta.ok) { throw new Error('HTTP ' + respuesta.status); }
                return respuesta.json();
            }).then(function (datos) {
                if (!datos || datos.ok !== true) { throw new Error('El servidor no confirmó el cierre de sesión.'); }
                sesionActual = null;
                tokenCsrf = '';
                return true;
            });
        }
    };
})(window);
