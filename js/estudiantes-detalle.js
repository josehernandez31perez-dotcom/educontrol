/* js/estudiantes-detalle.js - Ficha del estudiante con materias, notas, promedio y estado */
(function () {
    'use strict';
    var EC = window.EC;

    EC.alCargar(function () {
        var contenedor = document.getElementById('contenido-pagina');
        var esAdmin = EC.auth.sesion().rol === 'ADMIN';
        var id = Number(new URLSearchParams(window.location.search).get('id')) || 0;
        var est = EC.estudiantes.obtener(id);

        if (!est) {
            contenedor.innerHTML = '<section class="panel"><p><strong>Estudiante no encontrado.</strong></p>' +
                '<a class="btn btn-secundario" href="index.html">Volver al listado</a></section>';
            return;
        }

        var resumen = EC.calculos.resumenDeEstudiante(id);
        var notas = EC.calculos.notasDeEstudiante(id);

        var filasNotas = notas.length
            ? '<div class="tabla-contenedor"><table class="tabla"><thead><tr><th>Materia</th><th>Nota</th></tr></thead><tbody>' +
              notas.map(function (n) {
                  return '<tr><td>' + EC.esc(n.materia) + '</td><td><span class="nota ' +
                      (EC.configuracion.aprueba(n.nota) ? 'nota-aprobada' : 'nota-reprobada') + '">' + EC.formato.nota(n.nota) + '</span></td></tr>';
              }).join('') + '</tbody></table></div>'
            : '<p class="vacio">Sin calificaciones registradas</p>';

        contenedor.innerHTML =
            '<section class="panel"><h2>Datos personales</h2><div class="resumen-grid">' +
            '<div class="resumen-item"><span class="stat-etiqueta">Cédula</span><strong>' + EC.esc(est.cedula) + '</strong></div>' +
            '<div class="resumen-item"><span class="stat-etiqueta">Nombre completo</span><strong>' + EC.esc(est.nombre + ' ' + est.apellido) + '</strong></div>' +
            '<div class="resumen-item"><span class="stat-etiqueta">Estado</span>' + EC.badgeActivo(est.estado) + '</div>' +
            '<div class="resumen-item"><span class="stat-etiqueta">Fecha de registro</span><strong>' + EC.fecha(est.fecha_registro, true) + '</strong></div>' +
            '</div></section>' +
            '<section class="panel"><h2>Rendimiento académico</h2><div class="resumen-grid">' +
            '<div class="resumen-item"><span class="stat-etiqueta">Materias cursadas</span><strong>' + notas.length + '</strong></div>' +
            '<div class="resumen-item"><span class="stat-etiqueta">Promedio</span><strong>' + EC.formato.promedio(resumen ? resumen.promedio : null) + '</strong></div>' +
            '<div class="resumen-item"><span class="stat-etiqueta">Estado académico</span>' + EC.badge(resumen ? resumen.estado_academico : 'SIN NOTAS') + '</div>' +
            '</div></section>' +
            '<section class="panel"><h2>Calificaciones</h2>' + filasNotas + '</section>' +
            '<div class="acciones-form">' +
            (esAdmin ? '<a class="btn btn-primario" href="editar.html?id=' + est.id + '">Editar</a>' : '') +
            '<a class="btn btn-secundario" href="index.html">Volver al listado</a></div>';
    });
})();
