/* js/auth.js - Inicio de sesión DEMOSTRATIVO con localStorage.
   No es un sistema seguro para producción: el código y los hashes son visibles en el navegador. */
(function (global) {
    'use strict';

    var EC = global.EC = global.EC || {};
    var CLAVE_SESION = 'educontrol_sesion';

    function aHex(buffer) {
        return Array.prototype.map.call(new Uint8Array(buffer), function (b) {
            return b.toString(16).padStart(2, '0');
        }).join('');
    }

    EC.auth = {
        // Hash SHA-256 de un texto (Web Crypto)
        hash: function (texto) {
            if (!global.crypto || !global.crypto.subtle) {
                return Promise.reject(new Error('Web Crypto no disponible'));
            }
            return global.crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto)).then(aHex);
        },

        // Devuelve true si el usuario y la contraseña coinciden con un usuario guardado
        iniciarSesion: function (usuario, clave) {
            var encontrado = EC.usuarios.buscarPorNombre(String(usuario || '').trim());
            if (!encontrado) { return Promise.resolve(false); }

            return EC.auth.hash(String(clave || '')).then(function (hash) {
                if (hash !== encontrado.password_hash) { return false; }
                global.localStorage.setItem(CLAVE_SESION, JSON.stringify({
                    usuario: encontrado.nombre_usuario,
                    rol: encontrado.rol
                }));
                return true;
            });
        },

        sesion: function () {
            try {
                return JSON.parse(global.localStorage.getItem(CLAVE_SESION));
            } catch (error) {
                return null;
            }
        },

        cerrarSesion: function () {
            global.localStorage.removeItem(CLAVE_SESION);
        }
    };
})(window);
