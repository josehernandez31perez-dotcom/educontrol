
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

    function enviarMySQL(form, valores, archivo, mensajeError) {
        var boton = form.querySelector('button[type="submit"]');

        boton.disabled = true;
        mostrarErrores(form, {});

        EC.auth.obtenerCsrf()
            .then(function (tokenCsrf) {
                if (!tokenCsrf) {
                    throw new Error('No se pudo obtener el token de seguridad.');
                }

                return fetch((window.EC_BASE || '') + 'api/' + archivo, {
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
                        datos.mensaje || mensajeError
                    );
                    boton.disabled = false;
                    return;
                }

                EC.guardarFlash('ok', datos.mensaje);
                EC.irA('estudiantes/index.html');
            })
            .catch(function (error) {
                console.error('Error al guardar estudiante:', error);

                EC.mostrarMensaje(
                    'error',
                    'No se pudo comunicar con el servidor. Comprueba tu conexión e inténtalo nuevamente.'
                );

                boton.disabled = false;
            });
    }

    function cargarEstudiante(form, id) {
        form.hidden = true;

        EC.datos.estudiantePorId(id)
            .then(function (actual) {
                if (!actual) {
                    throw new Error('No se encontró el estudiante solicitado.');
                }

                form.elements.cedula.value = actual.cedula;
                form.elements.nombre.value = actual.nombre;
                form.elements.apellido.value = actual.apellido;
                form.elements.estado.value = actual.estado;

                form.hidden = false;
            })
            .catch(function (error) {
                console.error('Error al cargar estudiante:', error);
                EC.mostrarMensaje(
                    'error',
                    'No se pudo cargar el estudiante desde MySQL.'
                );
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
            if (!id) {
                EC.mostrarMensaje('error', 'El identificador del estudiante no es válido.');
                form.hidden = true;
                return;
            }

            cargarEstudiante(form, id);
        }

        form.addEventListener('submit', function (evento) {
            evento.preventDefault();

            var valores = leerFormulario(form);

            if (modo === 'registrar') {
                enviarMySQL(
                    form,
                    valores,
                    'registrar_estudiante.php',
                    'No fue posible registrar el estudiante.'
                );
                return;
            }

            if (modo === 'editar') {
                valores.id = id;

                enviarMySQL(
                    form,
                    valores,
                    'actualizar_estudiante.php',
                    'No fue posible actualizar el estudiante.'
                );
            }
        });
    });
})();
