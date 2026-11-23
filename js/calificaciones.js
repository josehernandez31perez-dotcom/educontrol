/* js/calificaciones.js - Listado de calificaciones, eliminación y rendimiento por estudiante */
(function () {
    'use strict';
    var EC = window.EC;

    EC.alCargar(function () {
        var esAdmin = EC.auth.sesion().rol === 'ADMIN';
        var params = new URLSearchParams(window.location.search);
        var seleccionado = Number(params.get('estudiante_id')) || 0;

        var selector = document.getElementById('select-rendimiento');
        var zonaRendimiento = document.getElementById('rendimiento');
        var zonaTabla = document.getElementById('tabla-calificaciones');
        var contador = document.getElementById('contador');

        selector.innerHTML = '<option value="">— Selecciona un estudiante —</option>' +
            EC.estudiantes.listar().map(function (e) {
                return '<option value="' + e.id + '"' + (e.id === seleccionado ? ' selected' : '') + '>' +
                    EC.esc(e.apellido + ' ' + e.nombre + ' (' + e.cedula + ')') + '</option>';
            }).join('');

        if (seleccionado) {
            var r = EC.calculos.resumenDeEstudiante(seleccionado);
            zonaRendimiento.innerHTML = r
                ? '<div class="resumen-grid">' +
                  '<div class="resumen-item"><span class="stat-etiqueta">Nombre completo</span><strong>' + EC.esc(r.nombre + ' ' + r.apellido) + '</strong></div>' +
                  '<div class="resumen-item"><span class="stat-etiqueta">Cantidad de materias</span><strong>' + r.cantidad + '</strong></div>' +
                  '<div class="resumen-item"><span class="stat-etiqueta">Promedio</span><strong>' + EC.formato.promedio(r.promedio) + '</strong></div>' +
                  '<div class="resumen-item"><span class="stat-etiqueta">Estado académico</span>' + EC.badge(r.estado_academico) + '</div>' +
                  '</div>'
                : '<p class="vacio">No se encontró el estudiante seleccionado.</p>';
        }

        function pintarTabla() {
            var lista = EC.calificaciones.listarDetalle();
            contador.textContent = 'Calificaciones registradas: ' + lista.length;

            if (!lista.length) {
                zonaTabla.innerHTML = '<p class="vacio">Todavía no hay calificaciones registradas.</p>';
                return;
            }

            var filas = lista.map(function (c) {
                var acciones = '';
                if (esAdmin) {
                    acciones = '<a class="btn btn-pequeno btn-secundario" href="editar.html?id=' + c.id + '">Editar</a> ' +
                        '<button type="button" class="btn btn-pequeno btn-peligro btn-eliminar" data-id="' + c.id +
                        '" data-texto="' + EC.esc(c.materia + ' de ' + c.nombre + ' ' + c.apellido) + '">Eliminar</button>';
                }
                return '<tr><td>' + EC.esc(c.apellido + ' ' + c.nombre) + '</td><td>' + EC.esc(c.cedula) + '</td><td>' +
                    EC.esc(c.materia) + '</td><td><span class="nota ' + (EC.configuracion.aprueba(c.nota) ? 'nota-aprobada' : 'nota-reprobada') + '">' +
                    EC.formato.nota(c.nota) + '</span></td><td>' + EC.fecha(c.fecha_registro) + '</td><td class="acciones">' +
                    acciones + '</td></tr>';
            }).join('');

            zonaTabla.innerHTML = '<div class="tabla-contenedor"><table class="tabla"><thead><tr>' +
                '<th>Estudiante</th><th>Cédula</th><th>Materia</th><th>Nota</th><th>Fecha</th><th>Acciones</th>' +
                '</tr></thead><tbody>' + filas + '</tbody></table></div>';
        }

        zonaTabla.addEventListener('click', function (evento) {
            var boton = evento.target.closest('.btn-eliminar');
            if (!boton) { return; }
            if (!window.confirm('¿Eliminar la calificación de ' + boton.dataset.texto + '?')) { return; }
            if (EC.calificaciones.eliminar(boton.dataset.id)) {
                EC.mostrarMensaje('ok', 'Calificación eliminada correctamente.');
            } else {
                EC.mostrarMensaje('error', 'No se encontró la calificación solicitada.');
            }
            pintarTabla();
        });

        pintarTabla();
    });
})();
