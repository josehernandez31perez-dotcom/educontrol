
/* js/calificaciones.js - Listado de calificaciones y rendimiento */
(function () {
    'use strict';

    var EC = window.EC;

    EC.alCargar(function () {
        var esAdmin = EC.auth.sesion().rol === 'ADMIN';
        var puedeModificar = esAdmin && EC.fuente !== 'mysql';

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

        function pintarRendimiento(r) {
            if (!seleccionado) {
                return;
            }

            zonaRendimiento.innerHTML = r
                ? '<div class="resumen-grid">' +
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

                if (puedeModificar) {
                    acciones +=
                        ' <a class="btn btn-pequeno btn-secundario" href="editar.html?id=' +
                        c.id + '">Editar</a>' +
                        ' <button type="button" class="btn btn-pequeno btn-peligro btn-eliminar" data-id="' +
                        c.id + '" data-texto="' +
                        EC.esc(c.materia + ' de ' + c.nombre + ' ' + c.apellido) +
                        '">Eliminar</button>';
                }

                return '<tr>' +
                    '<td>' + EC.esc(c.apellido + ' ' + c.nombre) + '</td>' +
                    '<td>' + EC.esc(c.cedula) + '</td>' +
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
                '<th>Estudiante</th><th>Cédula</th><th>Materia</th>' +
                '<th>Nota</th><th>Fecha</th><th>Acciones</th>' +
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
            celda.colSpan = 6;

            celda.innerHTML =
                '<strong>Detalles de la calificación</strong>' +
                '<p><strong>ID:</strong> ' + EC.esc(calificacion.id) + '</p>' +
                '<p><strong>Estudiante:</strong> ' +
                EC.esc(calificacion.nombre + ' ' + calificacion.apellido) + '</p>' +
                '<p><strong>Cédula:</strong> ' + EC.esc(calificacion.cedula) + '</p>' +
                '<p><strong>Materia:</strong> ' + EC.esc(calificacion.materia) + '</p>' +
                '<p><strong>Nota:</strong> ' + EC.esc(EC.formato.nota(calificacion.nota)) + '</p>' +
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
                pintarRendimiento(datos[2]);
                pintarTabla(datos[1]);
            });
        }

        zonaTabla.addEventListener('click', function (evento) {
            var botonVer = evento.target.closest('.btn-ver');

            if (botonVer) {
                mostrarDetalle(botonVer.dataset.id, botonVer);
                return;
            }

            var boton = evento.target.closest('.btn-eliminar');

            if (!boton || !puedeModificar) {
                return;
            }

            if (!window.confirm(
                '¿Eliminar la calificación de ' + boton.dataset.texto + '?'
            )) {
                return;
            }

            if (EC.calificaciones.eliminar(boton.dataset.id)) {
                EC.mostrarMensaje('ok', 'Calificación eliminada correctamente.');
            } else {
                EC.mostrarMensaje('error', 'No se encontró la calificación solicitada.');
            }

            cargar();
        });

        cargar();
    });
})();
