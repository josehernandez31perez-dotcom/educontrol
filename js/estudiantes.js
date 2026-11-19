/* js/estudiantes.js - Listado, búsqueda y eliminación de estudiantes */
(function () {
    'use strict';
    var EC = window.EC;

    EC.alCargar(function () {
        var esAdmin = EC.auth.sesion().rol === 'ADMIN';
        var buscador = document.getElementById('buscador');
        var contador = document.getElementById('contador');
        var zona = document.getElementById('tabla-estudiantes');
        var base = window.EC_BASE || '';

        function pintar() {
            var termino = buscador.value.trim();
            var lista = EC.estudiantes.buscar(termino);
            contador.textContent = 'Estudiantes registrados: ' + lista.length + (termino ? ' (búsqueda)' : '');

            if (!lista.length) {
                zona.innerHTML = termino
                    ? '<p class="vacio">No se encontraron estudiantes para «' + EC.esc(termino) + '».</p>'
                    : '<p class="vacio">Todavía no hay estudiantes registrados.</p>';
                return;
            }

            var filas = lista.map(function (e) {
                var acciones = '<a class="btn btn-pequeno btn-secundario" href="detalle.html?id=' + e.id + '">Ver</a>';
                if (esAdmin) {
                    acciones += ' <a class="btn btn-pequeno btn-secundario" href="editar.html?id=' + e.id + '">Editar</a>' +
                        ' <button type="button" class="btn btn-pequeno btn-peligro btn-eliminar" data-id="' + e.id +
                        '" data-nombre="' + EC.esc(e.nombre + ' ' + e.apellido) + '">Eliminar</button>';
                }
                return '<tr><td>' + e.id + '</td><td>' + EC.esc(e.cedula) + '</td><td>' + EC.esc(e.nombre) +
                    '</td><td>' + EC.esc(e.apellido) + '</td><td>' + EC.fecha(e.fecha_registro) + '</td><td>' +
                    EC.badgeActivo(e.estado) + '</td><td class="acciones">' + acciones + '</td></tr>';
            }).join('');

            zona.innerHTML = '<div class="tabla-contenedor"><table class="tabla"><thead><tr>' +
                '<th>ID</th><th>Cédula</th><th>Nombre</th><th>Apellido</th><th>Fecha de registro</th><th>Estado</th><th>Acciones</th>' +
                '</tr></thead><tbody>' + filas + '</tbody></table></div>';
        }

        buscador.addEventListener('input', pintar);

        zona.addEventListener('click', function (evento) {
            var boton = evento.target.closest('.btn-eliminar');
            if (!boton) { return; }
            var mensaje = '¿Seguro que deseas eliminar a ' + boton.dataset.nombre +
                '? Sus calificaciones también se eliminarán.';
            if (!window.confirm(mensaje)) { return; }
            if (EC.estudiantes.eliminar(boton.dataset.id)) {
                EC.mostrarMensaje('ok', 'Estudiante eliminado correctamente.');
            } else {
                EC.mostrarMensaje('error', 'No se encontró el estudiante solicitado.');
            }
            pintar();
        });

        pintar();
    });
})();
