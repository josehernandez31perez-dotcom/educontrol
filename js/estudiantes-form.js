
/* js/estudiantes-form.js - Formularios de registrar y editar estudiante */
(function () {
    'use strict';

    var EC = window.EC;

    function leerFormulario(form) {
        return {
            cedula: form.elements.cedula.value.trim(),
            nombre: form.elements.nombre.value.trim(),
            apellido: form.elements.apellido.value.trim(),
            estado: form.elements.estado.value
        };
    }

    function mostrarErrores(form, errores) {
        form.querySelectorAll('[data-error]').forEach(function (span) {
            span.textContent = errores[span.dataset.error] || '';
        });
    }

    function registrarEnMySQL(form, valores) {
        var boton = form.querySelector('button[type="submit"]');

        boton.disabled = true;
        mostrarErrores(form, {});

        EC.auth.obtenerCsrf()
            .then(function (tokenCsrf) {
                if (!tokenCsrf) {
                    throw new Error('No se pudo obtener el token de seguridad.');
                }

                return fetch((window.EC_BASE || '') + 'api/registrar_estudiante.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'X-CSRF-Token': tokenCsrf
                    },
                    body: JSON.stringify(valores)
                });
            })
            .then(function (respuesta) {
                return respuesta.json().then(function (datos) {
                    return {
                        ok: respuesta.ok,
                        datos: datos
                    };
                });
            })
            .then(function (resultado) {
                var datos = resultado.datos;

                if (!resultado.ok || !datos.ok) {
                    mostrarErrores(form, datos.errores || {});
                    EC.mostrarMensaje(
                        'error',
                        datos.mensaje || 'No fue posible registrar el estudiante.'
                    );
                    boton.disabled = false;
                    return;
                }

                EC.guardarFlash('ok', datos.mensaje);
                EC.irA('estudiantes/index.html');
            })
            .catch(function (error) {
                console.error('Error al registrar estudiante:', error);

                EC.mostrarMensaje(
                    'error',
                    'No se pudo comunicar con el servidor. Comprueba tu conexión e inténtalo nuevamente.'
                );

                boton.disabled = false;
            });
    }

    EC.alCargar(function () {
        var form = document.getElementById('form-estudiante');
        var modo = document.body.dataset.modo;
        var id = Number(new URLSearchParams(window.location.search).get('id')) || 0;

        if (!form) {
            return;
        }

        if (modo === 'editar') {
            var actual = EC.estudiantes.obtener(id);

            if (!actual) {
                EC.mostrarMensaje('error', 'No se encontró el estudiante solicitado.');
                form.hidden = true;
                return;
            }

            form.elements.cedula.value = actual.cedula;
            form.elements.nombre.value = actual.nombre;
            form.elements.apellido.value = actual.apellido;
            form.elements.estado.value = actual.estado;
        }

        form.addEventListener('submit', function (evento) {
            evento.preventDefault();

            var valores = leerFormulario(form);

            // El registro nuevo se guarda directamente en MySQL.
            if (modo === 'registrar') {
                registrarEnMySQL(form, valores);
                return;
            }

            // La edición conserva por ahora su funcionamiento anterior.
            var resultado = EC.estudiantes.actualizar(id, valores);

            if (!resultado.ok) {
                mostrarErrores(form, resultado.errores);
                EC.mostrarMensaje('error', 'Revisa los campos marcados en rojo.');
                return;
            }

            EC.guardarFlash('ok', 'Los datos del estudiante se guardaron correctamente.');
            EC.irA('estudiantes/index.html');
        });
    });
})();
