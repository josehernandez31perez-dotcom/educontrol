/* js/login.js - Pantalla de acceso: envía las credenciales a la API PHP */
(function () {
    'use strict';
    var EC = window.EC;

    document.addEventListener('DOMContentLoaded', function () {
        var params = new URLSearchParams(window.location.search);
        var mensaje = document.getElementById('mensaje-login');
        var error = document.getElementById('error-login');
        var formulario = document.getElementById('form-login');
        var boton = formulario.querySelector('button[type="submit"]');

        function mostrarError(texto) {
            error.textContent = texto;
            error.hidden = false;
        }

        // Si ya hay sesión en el servidor, no se muestra el formulario
        EC.auth.cargarSesion().then(function (sesion) {
            if (sesion) {
                window.location.href = 'index.html';
                return;
            }

            if (params.get('salio') && mensaje) {
                mensaje.textContent = 'Sesión cerrada correctamente.';
                mensaje.hidden = false;
            }
            if (params.get('expirada')) {
                mostrarError('Tu sesión ha caducado. Vuelve a iniciar sesión.');
            }

            formulario.addEventListener('submit', function (evento) {
                evento.preventDefault();
                error.hidden = true;

                var usuario = document.getElementById('usuario').value;
                var clave = document.getElementById('clave').value;
                boton.disabled = true;

                EC.auth.iniciarSesion(usuario, clave).then(function (correcto) {
                    if (correcto) {
                        window.location.href = 'index.html';
                        return;
                    }
                    mostrarError('Usuario o contraseña incorrectos.');
                }).catch(function () {
                    mostrarError('No se pudo validar el acceso. Revisa que Apache y MySQL estén iniciados en XAMPP.');
                }).then(function () {
                    boton.disabled = false;
                });
            });
        }).catch(function () {
            mostrarError('No se pudo conectar con el servidor. Revisa que Apache y MySQL estén iniciados en XAMPP.');
        });
    });
})();
