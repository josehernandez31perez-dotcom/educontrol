/* js/reportes.js - Menú de reportes, reporte individual y reporte general (solo lectura) */
(function () {
    'use strict';
    var EC = window.EC;

    function cabeceraDocumento(titulo, fecha) {
        return '<header class="documento-cabecera"><p class="documento-marca">EDUCONTROL</p>' +
            '<h2 class="documento-titulo">' + titulo + '</h2>' +
            '<p class="documento-fecha">Fecha del reporte: ' + fecha + '</p></header>';
    }

    function barraImprimir() {
        return '<div class="barra-superior no-imprimir">' +
            '<a class="btn btn-secundario" href="' + (window.EC_BASE || '') + 'reportes/index.html">← Volver a Reportes</a>' +
            '<button type="button" class="btn btn-primario" data-imprimir>🖨️ Imprimir / Guardar como PDF</button></div>';
    }

    EC.alCargar(function () {
        var pagina = document.body.dataset.pagina;
        var contenedor = document.getElementById('contenido-pagina');
        var fechaHoy = EC.fecha(new Date().toISOString(), true);

        if (pagina === 'index') {
            var select = document.getElementById('select-estudiante');
            select.innerHTML = '<option value="">— Selecciona un estudiante —</option>' +
                EC.estudiantes.listar().map(function (e) {
                    return '<option value="' + e.id + '">' + EC.esc(e.apellido + ' ' + e.nombre + ' (' + e.cedula + ')') + '</option>';
                }).join('');
            return;
        }

        if (pagina === 'individual') {
            var id = Number(new URLSearchParams(window.location.search).get('id')) || 0;
            var est = EC.estudiantes.obtener(id);
            if (!est) {
                contenedor.innerHTML = barraImprimir() +
                    '<section class="panel"><p><strong>Estudiante no encontrado.</strong></p></section>';
                return;
            }

            var resumen = EC.calculos.resumenDeEstudiante(id);
            var notas = EC.calculos.notasDeEstudiante(id);
            var tabla = notas.length
                ? '<table class="tabla"><thead><tr><th>Materia</th><th class="derecha">Calificación</th></tr></thead><tbody>' +
                  notas.map(function (n) {
                      return '<tr><td>' + EC.esc(n.materia) + '</td><td class="derecha">' + EC.formato.nota(n.nota) + '</td></tr>';
                  }).join('') + '</tbody></table>'
                : '<p class="aviso-documento">Este estudiante no tiene calificaciones registradas.</p>';

            contenedor.innerHTML = barraImprimir() +
                '<article class="documento">' +
                cabeceraDocumento('REPORTE ACADÉMICO INDIVIDUAL', fechaHoy) +
                '<table class="tabla-datos">' +
                '<tr><th>Nombre</th><td>' + EC.esc(est.nombre) + '</td><th>Apellido</th><td>' + EC.esc(est.apellido) + '</td></tr>' +
                '<tr><th>Cédula</th><td>' + EC.esc(est.cedula) + '</td><th>Estado</th><td>' + EC.esc(est.estado) + '</td></tr>' +
                '<tr><th>Fecha del reporte</th><td colspan="3">' + fechaHoy + '</td></tr></table>' +
                tabla +
                '<div class="resumen-documento">' +
                '<div><span class="stat-etiqueta">Cantidad de materias calificadas</span><strong>' + notas.length + '</strong></div>' +
                '<div><span class="stat-etiqueta">Promedio general</span><strong>' + EC.formato.promedio(resumen ? resumen.promedio : null) + '</strong></div>' +
                '<div><span class="stat-etiqueta">Estado académico</span><strong>' + (resumen ? resumen.estado_academico : 'SIN NOTAS') + '</strong></div>' +
                '</div>' +
                '<footer class="pie-documento">EduControl · Sistema Web de Gestión Académica y Calificaciones · Generado el ' + fechaHoy + '</footer>' +
                '</article>';
            return;
        }

        if (pagina === 'general') {
            var lista = EC.calculos.resumen();
            var est2 = EC.calculos.estadisticas();
            var posicion = 0;
            var filas = lista.map(function (r) {
                var tieneNotas = r.promedio !== null;
                if (tieneNotas) { posicion++; }
                return '<tr><td>' + (tieneNotas ? posicion : '—') + '</td><td>' + EC.esc(r.cedula) + '</td><td>' +
                    EC.esc(r.nombre + ' ' + r.apellido) + '</td><td class="derecha">' + EC.formato.promedio(r.promedio) +
                    '</td><td>' + EC.badge(r.estado_academico) + '</td></tr>';
            }).join('');

            contenedor.innerHTML = barraImprimir() +
                '<article class="documento">' +
                cabeceraDocumento('REPORTE ACADÉMICO GENERAL', fechaHoy) +
                '<div class="resumen-documento">' +
                '<div><span class="stat-etiqueta">Total de estudiantes</span><strong>' + est2.totalEstudiantes + '</strong></div>' +
                '<div><span class="stat-etiqueta">Aprobados</span><strong>' + est2.aprobados + '</strong></div>' +
                '<div><span class="stat-etiqueta">Reprobados</span><strong>' + est2.reprobados + '</strong></div>' +
                '<div><span class="stat-etiqueta">Sin notas</span><strong>' + est2.sinNotas + '</strong></div>' +
                '<div><span class="stat-etiqueta">Promedio general</span><strong>' + EC.formato.promedio(est2.promedioGeneral) + '</strong></div>' +
                '<div><span class="stat-etiqueta">Mayor promedio</span><strong>' +
                (est2.mejor ? EC.esc(est2.mejor.nombre + ' ' + est2.mejor.apellido + ' (' + EC.formato.promedio(est2.mejor.promedio) + ')') : '—') + '</strong></div>' +
                '<div><span class="stat-etiqueta">Menor promedio</span><strong>' +
                (est2.menor ? EC.esc(est2.menor.nombre + ' ' + est2.menor.apellido + ' (' + EC.formato.promedio(est2.menor.promedio) + ')') : '—') + '</strong></div>' +
                '</div>' +
                (lista.length
                    ? '<table class="tabla"><thead><tr><th>#</th><th>Cédula</th><th>Estudiante</th><th class="derecha">Promedio</th><th>Estado</th></tr></thead><tbody>' + filas + '</tbody></table>'
                    : '<p class="aviso-documento">Todavía no hay estudiantes registrados.</p>') +
                '<footer class="pie-documento">EduControl · Sistema Web de Gestión Académica y Calificaciones · Generado el ' + fechaHoy + '</footer>' +
                '</article>';
        }
    });
})();
