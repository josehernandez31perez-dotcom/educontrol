/* js/dashboard.js - Dashboard académico */
(function () {
    'use strict';
    var EC = window.EC;

    EC.alCargar(function () {
        var contenedor = document.getElementById('contenido-pagina');
        var est = EC.calculos.estadisticas();

        var filas = '';
        var posicion = 0;
        est.ranking.concat(est.sinNotasLista).forEach(function (fila) {
            var tieneNotas = fila.promedio !== null;
            var porcentaje = tieneNotas ? Math.min(100, Math.round(fila.promedio / 5 * 100)) : 0;
            if (tieneNotas) { posicion++; }
            filas += '<tr><td>' + (tieneNotas ? posicion : '—') + '</td>' +
                '<td>' + EC.esc(fila.nombre + ' ' + fila.apellido) + '</td>' +
                '<td>' + (tieneNotas
                    ? '<div class="barra"><div class="relleno" style="width: ' + porcentaje + '%"></div></div>'
                    : '<span class="vacio">Sin datos</span>') + '</td>' +
                '<td>' + EC.formato.promedio(fila.promedio) + '</td>' +
                '<td>' + EC.badge(fila.estado_academico) + '</td></tr>';
        });

        contenedor.innerHTML =
            '<p class="subtitulo-seccion">Bienvenido, <strong>' + EC.esc(EC.auth.sesion().usuario) +
            '</strong>. Este es el resumen general del sistema académico.</p>' +
            '<section class="tarjetas">' +
            '<article class="tarjeta-stat"><span class="stat-icono">👨‍🎓</span><span class="stat-etiqueta">Total de estudiantes</span><span class="stat-valor">' + est.totalEstudiantes + '</span></article>' +
            '<article class="tarjeta-stat"><span class="stat-icono">📚</span><span class="stat-etiqueta">Total de materias</span><span class="stat-valor">' + est.totalMaterias + '</span></article>' +
            '<article class="tarjeta-stat stat-verde"><span class="stat-icono">🟢</span><span class="stat-etiqueta">Aprobados</span><span class="stat-valor">' + est.aprobados + '</span></article>' +
            '<article class="tarjeta-stat stat-rojo"><span class="stat-icono">🔴</span><span class="stat-etiqueta">Reprobados</span><span class="stat-valor">' + est.reprobados + '</span></article>' +
            '<article class="tarjeta-stat stat-gris"><span class="stat-icono">⚪</span><span class="stat-etiqueta">Sin notas</span><span class="stat-valor">' + est.sinNotas + '</span></article>' +
            '<article class="tarjeta-stat stat-amarillo"><span class="stat-icono">📈</span><span class="stat-etiqueta">Promedio general</span><span class="stat-valor">' + EC.formato.promedio(est.promedioGeneral) + '</span></article>' +
            '</section>' +
            '<section class="panel"><h2>Rendimiento académico</h2><div class="resumen-grid">' +
            '<div class="resumen-item"><span class="stat-etiqueta">Mejor promedio</span><strong>' + EC.formato.promedio(est.mejor ? est.mejor.promedio : null) + '</strong></div>' +
            '<div class="resumen-item"><span class="stat-etiqueta">Menor promedio</span><strong>' + EC.formato.promedio(est.menor ? est.menor.promedio : null) + '</strong></div>' +
            '<div class="resumen-item"><span class="stat-etiqueta">Estudiante con mejor rendimiento</span><strong>' +
            (est.mejor ? EC.esc(est.mejor.nombre + ' ' + est.mejor.apellido) : '—') + '</strong></div>' +
            '</div></section>' +
            '<section class="panel"><h2>Ranking de estudiantes</h2>' +
            (filas
                ? '<div class="tabla-contenedor"><table class="tabla"><thead><tr><th>Posición</th><th>Nombre completo</th><th>Rendimiento</th><th>Promedio</th><th>Estado académico</th></tr></thead><tbody>' + filas + '</tbody></table></div>'
                : '<p class="vacio">Todavía no hay estudiantes registrados.</p>') +
            '</section>';
    });
})();
