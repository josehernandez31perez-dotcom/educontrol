
/* js/calificaciones-form.js - Registrar y editar calificaciones */
(function () {
    'use strict';

    var EC = window.EC;

    function mostrarErrores(form, errores) {
        form.querySelectorAll('[data-error]').forEach(function (span) {
            span.textContent = errores[span.dataset.error] || '';
        });
    }

    function cargarDesplegables(form) {
        return Promise.all([
            EC.datos.estudiantes(),
            EC.datos.materias()
        ]).then(function (resultados) {
            var estudiantes = resultados[0];
            var materias = resultados[1];

            form.elements.estudiante_id.innerHTML =
                '<option value="">— Selecciona un estudiante —</option>' +
                estudiantes.map(function (e) {
                    return '<option value="' + e.id + '">' +
                        EC.esc(e.apellido + ' ' + e.nombre + ' (' + e.cedula + ')') +
                        '</option>';
                }).join('');

            form.elements.materia_id.innerHTML =
                '<option value="">— Selecciona una materia —</option>' +
                materias.filter(function (m) {
                    return m.estado === 'ACTIVA';
                }).map(function (m) {
                    return '<option value="' + m.id + '">' +
                        EC.esc(m.nombre) +
                        '</option>';
                }).join('');
        });
    }

    function registrarMySQL(form, valores) {
        var boton = form.querySelector('button[type="submit"]');

        boton.disabled = true;
        mostrarErrores(form, {});

        EC.auth.obtenerCsrf()
            .then(function (token) {
                if (!token) {
                    throw new Error('No se pudo obtener el token de seguridad.');
                }

                return fetch((window.EC_BASE || '') + 'api/registrar_calificacion.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'X-CSRF-Token': token
                    },
                    body: JSON.stringify(valores)
                });
            })
            .then(function (respuesta) {
                return respuesta.json().then(function (datos) {
                    return { ok: respuesta.ok, datos: datos };
                });
            })
            .then(function (resultado) {
                var datos = resultado.datos;

                if (!resultado.ok || !datos.ok) {
                    mostrarErrores(form, datos.errores || {});
                    EC.mostrarMensaje(
                        'error',
                        datos.mensaje || 'No fue posible registrar la calificación.'
                    );
                    boton.disabled = false;
                    return;
                }

                EC.guardarFlash('ok', datos.mensaje);
                EC.irA('calificaciones/index.html');
            })
            .catch(function (error) {
                console.error('Error al registrar calificación:', error);

                EC.mostrarMensaje(
                    'error',
                    error.message || 'No se pudo comunicar con el servidor.'
                );

                boton.disabled = false;
            });
    }

    EC.alCargar(function () {
        var form = document.getElementById('form-calificacion');
        var modo = document.body.dataset.modo;

        if (!form) {
            return;
        }

        form.hidden = true;

        cargarDesplegables(form)
            .then(function () {
                var rango = EC.configuracion.obtener();

                form.elements.nota.min = rango.notaMinima;
                form.elements.nota.max = rango.notaMaxima;

                form.hidden = false;
            })
            .catch(function (error) {
                console.error('Error al cargar estudiantes y materias:', error);

                EC.mostrarMensaje(
                    'error',
                    'No se pudieron cargar los estudiantes y las materias desde MySQL.'
                );
            });

        form.addEventListener('submit', function (evento) {
            evento.preventDefault();

            var valores = {
                estudiante_id: form.elements.estudiante_id.value,
                materia_id: form.elements.materia_id.value,
                nota: form.elements.nota.value
            };

            if (modo === 'registrar') {
                registrarMySQL(form, valores);
                return;
            }

            EC.mostrarMensaje(
                'error',
                'La edición de calificaciones todavía no está conectada a MySQL.'
            );
        });
    });
})();
