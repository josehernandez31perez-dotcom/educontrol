/* js/estadisticas.js - Panel de estadísticas, ranking y buscador */
(function () {
    'use strict';
    var EC = window.EC;

    EC.alCargar(function () {
        var contenedor = document.getElementById('contenido-pagina');
        var est = EC.calculos.estadisticas();
        var conNotas = est.aprobados + est.reprobados;
        var porcentaje = conNotas > 0 ? Math.round(est.aprobados * 1000 / conNotas) / 10 : null;

        var filasRanking = est.ranking.map(function (r, i) {
            return '<tr><td>' + (i + 1) + '</td><td>' + EC.esc(r.nombre + ' ' + r.apellido) + '</td><td>' +
                EC.formato.promedio(r.promedio) + '</td><td>' + EC.badge(r.estado_academico) + '</td></tr>';
        }).join('');

        contenedor.innerHTML =
            '<section class="tarjetas">' +
            '<article class="tarjeta-stat"><span class="stat-icono">👨‍🎓</span><span class="stat-etiqueta">Total de estudiantes</span><span class="stat-valor">' + est.totalEstudiantes + '</span></article>' +
            '<article class="tarjeta-stat"><span class="stat-icono">📚</span><span class="stat-etiqueta">Total de materias</span><span class="stat-valor">' + est.totalMaterias + '</span></article>' +
            '<article class="tarjeta-stat stat-verde"><span class="stat-icono">🟢</span><span class="stat-etiqueta">Aprobados</span><span class="stat-valor">' + est.aprobados + '</span></article>' +
            '<article class="tarjeta-stat stat-rojo"><span class="stat-icono">🔴</span><span class="stat-etiqueta">Reprobados</span><span class="stat-valor">' + est.reprobados + '</span></article>' +
            '<article class="tarjeta-stat stat-gris"><span class="stat-icono">⚪</span><span class="stat-etiqueta">Sin notas</span><span class="stat-valor">' + est.sinNotas + '</span></article>' +
            '<article class="tarjeta-stat stat-amarillo"><span class="stat-icono">📈</span><span class="stat-etiqueta">Promedio general</span><span class="stat-valor">' + EC.formato.promedio(est.promedioGeneral) + '</span></article>' +
            '</section>' +

            '<div class="dos-columnas">' +
            '<section class="panel"><h2>Mejor promedio</h2><div class="resumen-grid">' +
            '<div class="resumen-item"><span class="stat-etiqueta">Estudiante</span><strong>' + (est.mejor ? EC.esc(est.mejor.nombre + ' ' + est.mejor.apellido) : '—') + '</strong></div>' +
            '<div class="resumen-item"><span class="stat-etiqueta">Promedio</span><strong>' + EC.formato.promedio(est.mejor ? est.mejor.promedio : null) + '</strong></div>' +
            '</div></section>' +
            '<section class="panel"><h2>Menor promedio</h2><div class="resumen-grid">' +
            '<div class="resumen-item"><span class="stat-etiqueta">Estudiante</span><strong>' + (est.menor ? EC.esc(est.menor.nombre + ' ' + est.menor.apellido) : '—') + '</strong></div>' +
            '<div class="resumen-item"><span class="stat-etiqueta">Promedio</span><strong>' + EC.formato.promedio(est.menor ? est.menor.promedio : null) + '</strong></div>' +
            '</div></section>' +
            '</div>' +

            '<section class="panel"><h2>Resumen académico</h2><div class="resumen-grid">' +
            '<div class="resumen-item"><span class="stat-etiqueta">Aprobados</span><strong>' + est.aprobados + '</strong></div>' +
            '<div class="resumen-item"><span class="stat-etiqueta">Reprobados</span><strong>' + est.reprobados + '</strong></div>' +
            '<div class="resumen-item"><span class="stat-etiqueta">Sin notas</span><strong>' + est.sinNotas + '</strong></div>' +
            '<div class="resumen-item"><span class="stat-etiqueta">% aprobados (con notas)</span><strong>' + (porcentaje === null ? '—' : porcentaje + '%') + '</strong></div>' +
            '</div></section>' +

            '<section class="panel"><h2>Buscar estudiante</h2>' +
            '<div class="buscador"><input type="search" id="buscador-estadisticas" placeholder="Buscar por cédula, nombre o apellido"></div>' +
            '<div id="resultado-busqueda"></div></section>' +

            '<section class="panel"><h2>Ranking de estudiantes</h2>' +
            (est.ranking.length
                ? '<div class="tabla-contenedor"><table class="tabla"><thead><tr><th>Posición</th><th>Estudiante</th><th>Promedio</th><th>Estado</th></tr></thead><tbody>' + filasRanking + '</tbody></table></div>'
                : '<p class="vacio">Todavía no hay estudiantes con calificaciones.</p>') +
            (est.sinNotasLista.length
                ? '<h2 class="subseccion">Estudiantes sin notas</h2><ul class="lista-sencilla">' +
                  est.sinNotasLista.map(function (r) {
                      return '<li>' + EC.esc(r.nombre + ' ' + r.apellido) + ' · ' + EC.esc(r.cedula) + '</li>';
                  }).join('') + '</ul>'
                : '') +
            '</section>';

        var buscador = document.getElementById('buscador-estadisticas');
        var resultado = document.getElementById('resultado-busqueda');

        buscador.addEventListener('input', function () {
            var termino = buscador.value.trim();
            if (!termino) { resultado.innerHTML = ''; return; }

            var coincidencias = EC.calculos.resumen().filter(function (r) {
                var t = termino.toLowerCase();
                return r.cedula.toLowerCase().indexOf(t) !== -1 ||
                       r.nombre.toLowerCase().indexOf(t) !== -1 ||
                       r.apellido.toLowerCase().indexOf(t) !== -1;
            });

            if (!coincidencias.length) {
                resultado.innerHTML = '<p class="vacio">No se encontraron estudiantes para «' + EC.esc(termino) + '».</p>';
                return;
            }

            resultado.innerHTML = '<div class="tabla-contenedor"><table class="tabla"><thead><tr>' +
                '<th>Nombre completo</th><th>Cédula</th><th>Cantidad de materias</th><th>Promedio</th><th>Estado</th>' +
                '</tr></thead><tbody>' + coincidencias.map(function (r) {
                    return '<tr><td>' + EC.esc(r.nombre + ' ' + r.apellido) + '</td><td>' + EC.esc(r.cedula) + '</td><td>' +
                        r.cantidad + '</td><td>' + EC.formato.promedio(r.promedio) + '</td><td>' + EC.badge(r.estado_academico) +
                        '</td></tr>';
                }).join('') + '</tbody></table></div>';
        });
    });
})();
