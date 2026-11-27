
/* js/estudiantes.js - Listado y acciones de estudiantes */
(function () {
    'use strict';

    var EC = window.EC;

    function mensajePendiente() {
        return EC.fuente === 'mysql'
            ? 'Esta acción todavía no está conectada a MySQL. No se modificó ningún dato.'
            : 'Esta acción todavía no está disponible en el listado. No se modificó ningún dato.';
    }

    EC.alCargar(function () {
        var esAdmin = EC.auth.sesion().rol === 'ADMIN';
        var buscador = document.getElementById('buscador');
        var contador = document.getElementById('contador');
        var zona = document.getElementById('tabla-estudiantes');

        var estudiantes = [];
        var cargando = true;
        var errorCarga = false;
        var textoError = '';
        var eliminando = false;

        function filtrar(termino) {
            var t = EC.normalizarTexto(termino).trim();

            if (!t) {
                return estudiantes;
            }

            return estudiantes.filter(function (e) {
                return EC.normalizarTexto(e.cedula).indexOf(t) !== -1 ||
                    EC.normalizarTexto(e.nombre).indexOf(t) !== -1 ||
                    EC.normalizarTexto(e.apellido).indexOf(t) !== -1;
            });
        }

        function pintar() {
            if (cargando) {
                contador.textContent = '';
                zona.innerHTML = '<p class="vacio">Cargando estudiantes…</p>';
                return;
            }

            if (errorCarga) {
                contador.textContent = 'Estudiantes registrados: no disponible';
                zona.innerHTML =
                    '<div class="alerta alerta-error" role="alert">' +
                    EC.esc(textoError) +
                    '</div>' +
                    '<button type="button" class="btn btn-secundario" id="btn-reintentar">Reintentar</button>';
                return;
            }

            var termino = buscador.value.trim();
            var lista = filtrar(termino);

            contador.textContent = 'Estudiantes registrados: ' +
                lista.length + (termino ? ' (búsqueda)' : '');

            if (!lista.length) {
                zona.innerHTML = termino
                    ? '<p class="vacio">No se encontraron estudiantes para «' +
                        EC.esc(termino) + '».</p>'
                    : '<p class="vacio">Todavía no hay estudiantes registrados.</p>';
                return;
            }

            var filas = lista.map(function (e) {
                var acciones =
                    '<button type="button" class="btn btn-pequeno btn-secundario btn-ver" data-id="' +
                    e.id + '">Ver</button>';

                if (esAdmin) {
                    acciones +=
                        ' <button type="button" class="btn btn-pequeno btn-secundario btn-editar" data-id="' +
                        e.id + '">Editar</button>' +
                        ' <button type="button" class="btn btn-pequeno btn-peligro btn-eliminar" data-id="' +
                        e.id + '"' + (eliminando ? ' disabled' : '') + '>Eliminar</button>';
                }

                return '<tr>' +
                    '<td>' + e.id + '</td>' +
                    '<td>' + EC.esc(e.cedula) + '</td>' +
                    '<td>' + EC.esc(e.nombre) + '</td>' +
                    '<td>' + EC.esc(e.apellido) + '</td>' +
                    '<td>' + EC.fecha(e.fecha_registro) + '</td>' +
                    '<td>' + EC.anioIngreso(e.fecha_registro) + '</td>' +
                    '<td>' + EC.badgeActivo(e.estado) + '</td>' +
                    '<td class="acciones">' + acciones + '</td>' +
                    '</tr>';
            }).join('');

            zona.innerHTML =
                '<div class="tabla-contenedor">' +
                '<table class="tabla">' +
                '<thead><tr>' +
                '<th>ID</th>' +
                '<th>Cédula</th>' +
                '<th>Nombre</th>' +
                '<th>Apellido</th>' +
                '<th>Fecha de ingreso</th>' +
                '<th>Año de ingreso</th>' +
                '<th>Estado</th>' +
                '<th>Acciones</th>' +
                '</tr></thead>' +
                '<tbody>' + filas + '</tbody>' +
                '</table></div>';
        }

        function cargarEstudiantes() {
            cargando = true;
            errorCarga = false;
            pintar();

            return EC.datos.estudiantes().then(function (lista) {
                estudiantes = lista;
                errorCarga = false;
            }, function (error) {
                if (error && error.sesionCaducada) {
                    return;
                }

                estudiantes = [];
                errorCarga = true;
                textoError = EC.mensajeDeError(error);
                EC.mostrarMensaje('error', textoError);
            }).then(function () {
                cargando = false;
                pintar();
            });
        }

        function eliminarEstudiante(id) {
            if (eliminando) {
                return;
            }

            var estudiante = estudiantes.find(function (e) {
                return e.id === id;
            });

            if (!estudiante) {
                EC.mostrarMensaje('error', 'No se encontró el estudiante seleccionado.');
                return;
            }

            var nombreCompleto = estudiante.nombre + ' ' + estudiante.apellido;

            var confirmar = window.confirm(
                '¿Estás seguro de que deseas eliminar a ' +
                nombreCompleto + ' (cédula: ' + estudiante.cedula + ')?\n\n' +
                'Si tiene calificaciones registradas, el sistema impedirá la eliminación.'
            );

            if (!confirmar) {
                return;
            }

            eliminando = true;
            pintar();

            EC.auth.obtenerCsrf()
                .then(function (token) {
                    return fetch(
                        (window.EC_BASE || '') + 'api/eliminar_estudiante.php',
                        {
                            method: 'POST',
                            cache: 'no-store',
                            credentials: 'same-origin',
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json',
                                'X-CSRF-Token': token
                            },
                            body: JSON.stringify({ id: id })
                        }
                    );
                })
                .then(function (respuesta) {
                    return respuesta.json().then(function (datos) {
                        if (!respuesta.ok || !datos.ok) {
                            throw new Error(
                                datos.mensaje || 'No fue posible eliminar el estudiante.'
                            );
                        }

                        return datos;
                    });
                })
                .then(function (datos) {
                    EC.mostrarMensaje('exito', datos.mensaje);
                    return cargarEstudiantes();
                })
                .catch(function (error) {
                    EC.mostrarMensaje(
                        'error',
                        error.message || 'Ocurrió un error al eliminar el estudiante.'
                    );
                })
                .then(function () {
                    eliminando = false;
                    pintar();
                });
        }

        buscador.addEventListener('input', pintar);

        zona.addEventListener('click', function (evento) {
            if (evento.target.closest('#btn-reintentar')) {
                cargarEstudiantes();
                return;
            }

            var botonVer = evento.target.closest('.btn-ver');

            if (botonVer) {
                var idVer = Number(botonVer.dataset.id);

                if (idVer > 0) {
                    EC.irA('estudiantes/ver.html?id=' + idVer);
                }
                return;
            }

            var botonEditar = evento.target.closest('.btn-editar');

            if (botonEditar) {
                var idEditar = Number(botonEditar.dataset.id);

                if (idEditar > 0) {
                    EC.irA('estudiantes/editar.html?id=' + idEditar);
                }
                return;
            }

            var botonEliminar = evento.target.closest('.btn-eliminar');

            if (botonEliminar) {
                var idEliminar = Number(botonEliminar.dataset.id);

                if (idEliminar > 0) {
                    eliminarEstudiante(idEliminar);
                }
            }
        });

        cargarEstudiantes();
    });
})();
