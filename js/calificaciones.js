
/* js/calificaciones.js - Listado, rendimiento y gestión de calificaciones */
(function () {
    'use strict';

    var EC = window.EC;

    EC.alCargar(function () {
        var esAdmin = EC.auth.sesion().rol === 'ADMIN';
        var puedeEditar = esAdmin;
        var puedeEliminar = esAdmin;

        var params = new URLSearchParams(window.location.search);
        var seleccionado = Number(params.get('estudiante_id')) || 0;

        var selector = document.getElementById('select-rendimiento');
        var zonaRendimiento = document.getElementById('rendimiento');
        var zonaTabla = document.getElementById('tabla-calificaciones');
        var contador = document.getElementById('contador');

        var listaActual = [];

        function pintarSelector(estudiantes) {
            selector.innerHTML =
                '<option value="">— Selecciona un estudiante —</option>' +
                estudiantes.map(function (e) {
                    return '<option value="' + e.id + '"' +
                        (e.id === seleccionado ? ' selected' : '') + '>' +
                        EC.esc(e.apellido + ' ' + e.nombre + ' (' + e.cedula + ')') +
                        '</option>';
                }).join('');
        }

        function pintarRendimiento(r, estudiantes) {
            if (!seleccionado) {
                return;
            }

            var estudianteSeleccionado = (estudiantes || []).find(function (e) { return e.id === seleccionado; });
            zonaRendimiento.innerHTML = r
                ? '<div class="resumen-grid">' +
                    '<div class="resumen-item"><span class="stat-etiqueta">Año de ingreso</span><strong>' +
                    EC.anioIngreso(estudianteSeleccionado && estudianteSeleccionado.fecha_registro) + '</strong></div>' +
                    '<div class="resumen-item"><span class="stat-etiqueta">Nombre completo</span><strong>' +
                    EC.esc(r.nombre + ' ' + r.apellido) + '</strong></div>' +
                    '<div class="resumen-item"><span class="stat-etiqueta">Cantidad de materias</span><strong>' +
                    r.cantidad + '</strong></div>' +
                    '<div class="resumen-item"><span class="stat-etiqueta">Promedio</span><strong>' +
                    EC.formato.promedio(r.promedio) + '</strong></div>' +
                    '<div class="resumen-item"><span class="stat-etiqueta">Estado académico</span>' +
                    EC.badge(r.estado_academico) + '</div>' +
                    '</div>'
                : '<p class="vacio">No se encontró el estudiante seleccionado.</p>';
        }

        function eliminarMySQL(id, texto, boton) {
            if (!window.confirm('¿Estás seguro de eliminar la calificación de ' + texto + '?')) {
                return;
            }

            boton.disabled = true;

            EC.auth.obtenerCsrf()
                .then(function (token) {
                    if (!token) {
                        throw new Error('No se pudo obtener el token de seguridad.');
                    }

                    return fetch((window.EC_BASE || '') + 'api/eliminar_calificacion.php', {
                        method: 'POST',
                        cache: 'no-store',
                        credentials: 'same-origin',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                            'X-CSRF-Token': token
                        },
                        body: JSON.stringify({ id: id })
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
                    if (!resultado.ok || !resultado.datos.ok) {
                        throw new Error(
                            resultado.datos.mensaje ||
                            'No fue posible eliminar la calificación.'
                        );
                    }

                    EC.mostrarMensaje('ok', resultado.datos.mensaje);
                    cargar();
                })
                .catch(function (error) {
                    console.error('Error al eliminar calificación:', error);
                    EC.mostrarMensaje(
                        'error',
                        error.message || 'No se pudo comunicar con el servidor.'
                    );
                    boton.disabled = false;
                });
        }

        function pintarTabla(lista) {
            listaActual = lista;
            contador.textContent = 'Calificaciones registradas: ' + lista.length;

            if (!lista.length) {
                zonaTabla.innerHTML =
                    '<p class="vacio">Todavía no hay calificaciones registradas.</p>';
                return;
            }

            var filas = lista.map(function (c) {
                var acciones =
                    '<button type="button" class="btn btn-pequeno btn-secundario btn-ver" data-id="' +
                    c.id + '">Ver</button>';

                if (puedeEditar) {
                    acciones +=
                        ' <a class="btn btn-pequeno btn-secundario" href="editar.html?id=' +
                        encodeURIComponent(c.id) + '">Editar</a>';
                }

                if (puedeEliminar) {
                    acciones +=
                        ' <button type="button" class="btn btn-pequeno btn-peligro btn-eliminar" data-id="' +
                        c.id + '" data-texto="' +
                        EC.esc(c.materia + ' de ' + c.nombre + ' ' + c.apellido) +
                        '">Eliminar</button>';
                }

                return '<tr>' +
                    '<td>' + EC.esc(c.apellido + ' ' + c.nombre) + '</td>' +
                    '<td>' + EC.esc(c.cedula) + '</td>' +
                    '<td>' + EC.anioIngreso(c.fecha_ingreso) + '</td>' +
                    '<td>' + EC.esc(c.materia) + '</td>' +
                    '<td><span class="nota ' +
                    (EC.configuracion.aprueba(c.nota) ? 'nota-aprobada' : 'nota-reprobada') +
                    '">' + EC.formato.nota(c.nota) + '</span></td>' +
                    '<td>' + EC.fecha(c.fecha_registro) + '</td>' +
                    '<td class="acciones">' + acciones + '</td>' +
                    '</tr>';
            }).join('');

            zonaTabla.innerHTML =
                '<div class="tabla-contenedor">' +
                '<table class="tabla">' +
                '<thead><tr>' +
                '<th>Estudiante</th><th>Cédula</th><th>Año de ingreso</th><th>Materia</th>' +
                '<th>Nota</th><th>Fecha de la nota</th><th>Acciones</th>' +
                '</tr></thead>' +
                '<tbody>' + filas + '</tbody>' +
                '</table></div>';
        }

        function mostrarDetalle(id, boton) {
            var calificacion = listaActual.find(function (c) {
                return String(c.id) === String(id);
            });

            if (!calificacion) {
                EC.mostrarMensaje('error', 'No se encontró la calificación solicitada.');
                return;
            }

            var fila = boton.closest('tr');
            var filaDetalle = fila.nextElementSibling;

            if (filaDetalle && filaDetalle.classList.contains('fila-detalle')) {
                filaDetalle.remove();
                boton.textContent = 'Ver';
                return;
            }

            var nuevaFila = document.createElement('tr');
            nuevaFila.className = 'fila-detalle';

            var celda = document.createElement('td');
            celda.colSpan = 7;

            celda.innerHTML =
                '<strong>Detalles de la calificación</strong>' +
                '<p><strong>ID:</strong> ' + EC.esc(calificacion.id) + '</p>' +
                '<p><strong>Estudiante:</strong> ' +
                EC.esc(calificacion.nombre + ' ' + calificacion.apellido) + '</p>' +
                '<p><strong>Cédula:</strong> ' + EC.esc(calificacion.cedula) + '</p>' +
                '<p><strong>Fecha de ingreso:</strong> ' + EC.esc(EC.fecha(calificacion.fecha_ingreso)) + '</p>' +
                '<p><strong>Año de ingreso:</strong> ' + EC.esc(EC.anioIngreso(calificacion.fecha_ingreso)) + '</p>' +
                '<p><strong>Materia:</strong> ' + EC.esc(calificacion.materia) + '</p>' +
                '<p><strong>Nota:</strong> ' +
                EC.esc(EC.formato.nota(calificacion.nota)) + '</p>' +
                '<p><strong>Fecha de registro:</strong> ' +
                EC.esc(EC.fecha(calificacion.fecha_registro)) + '</p>';

            nuevaFila.appendChild(celda);
            fila.parentNode.insertBefore(nuevaFila, fila.nextSibling);
            boton.textContent = 'Ocultar';
        }

        function cargar() {
            EC.cargarVista(zonaTabla, function () {
                return Promise.all([
                    EC.datos.estudiantes(),
                    EC.datos.calificacionesDetalle(),
                    seleccionado
                        ? EC.datos.resumenDeEstudiante(seleccionado)
                        : Promise.resolve(null)
                ]);
            }, function (datos) {
                pintarSelector(datos[0]);
                pintarRendimiento(datos[2], datos[0]);
                pintarTabla(datos[1]);
            });
        }

        zonaTabla.addEventListener('click', function (evento) {
            var botonVer = evento.target.closest('.btn-ver');

            if (botonVer) {
                mostrarDetalle(botonVer.dataset.id, botonVer);
                return;
            }

            var botonEliminar = evento.target.closest('.btn-eliminar');

            if (!botonEliminar || !puedeEliminar) {
                return;
            }

            eliminarMySQL(
                botonEliminar.dataset.id,
                botonEliminar.dataset.texto,
                botonEliminar
            );
        });

        cargar();
    });
})();
