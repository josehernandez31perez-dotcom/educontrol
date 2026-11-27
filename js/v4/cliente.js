/* js/v4/cliente.js - Cliente HTTP de la interfaz v4. NO PROBADO en navegador.
   La identidad NUNCA se envía: va en la cookie HttpOnly. Solo el token CSRF viaja en cabecera. */
(function (global) {
    'use strict';
    var EC = global.EC = global.EC || {};
    var BASE = 'api/v4/index.php';

    function escapar(t) {
        return String(t === null || t === undefined ? '' : t)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // Llamada a una acción. metodo GET usa la URL; POST envía JSON y cabecera CSRF.
    function llamar(accion, metodo, datos, csrf) {
        var url = BASE + '?accion=' + encodeURIComponent(accion);
        var opciones = { method: metodo, credentials: 'same-origin', headers: { 'Accept': 'application/json' } };
        if (metodo === 'GET' && datos) {
            Object.keys(datos).forEach(function (k) {
                if (datos[k] !== undefined && datos[k] !== null && datos[k] !== '') {
                    url += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(datos[k]);
                }
            });
        }
        if (metodo === 'POST') {
            opciones.headers['Content-Type'] = 'application/json';
            opciones.headers['X-CSRF-Token'] = csrf || '';
            opciones.body = JSON.stringify(datos || {});
        }
        return fetch(url, opciones).then(function (r) {
            return r.json().catch(function () { return { ok: false, error: { codigo: 'RED', mensaje: 'Respuesta no válida' } }; })
                .then(function (cuerpo) { cuerpo.estado = r.status; return cuerpo; });
        }).then(function (cuerpo) {
            if (cuerpo.estado === 401 && accion !== 'login') {
                global.location.href = 'login.html?expirada=1';
                return Promise.reject(new Error('Sesión caducada'));
            }
            if (!cuerpo.ok) {
                var err = new Error((cuerpo.error && cuerpo.error.mensaje) || 'Error');
                err.codigo = cuerpo.error && cuerpo.error.codigo;
                throw err;
            }
            return cuerpo.datos;
        });
    }

    EC.v4 = { llamar: llamar, escapar: escapar };
})(window);
