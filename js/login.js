/* js/login.js - Lógica de la pantalla de acceso (demostrativa) */
(function () {
    'use strict';
    var EC = window.EC;

    document.addEventListener('DOMContentLoaded', function () {
        if (EC.auth.sesion()) {
            window.location.href = 'index.html';
            return;
        }

        var params = new URLSearchParams(window.location.search);
        var mensaje = document.getElementById('mensaje-login');
        if (params.get('salio') && mensaje) {
            mensaje.textContent = 'Sesión cerrada correctamente.';
            mensaje.hidden = false;
        }

        var formulario = document.getElementById('form-login');
        var error = document.getElementById('error-login');

        formulario.addEventListener('submit', function (evento) {
            evento.preventDefault();
            error.hidden = true;

            var usuario = document.getElementById('usuario').value;
            var clave = document.getElementById('clave').value;
            var boton = formulario.querySelector('button[type="submit"]');
            boton.disabled = true;

            EC.auth.iniciarSesion(usuario, clave).then(function (correcto) {
                if (correcto) {
                    window.location.href = 'index.html';
                    return;
                }
                error.textContent = 'Usuario o contraseña incorrectos.';
                error.hidden = false;
            }).catch(function () {
                error.textContent = 'No se pudo validar el acceso en este navegador.';
                error.hidden = false;
            }).then(function () {
                boton.disabled = false;
            });
        });
    });
})();
