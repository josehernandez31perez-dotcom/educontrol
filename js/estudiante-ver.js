
/* js/estudiante-ver.js - Consulta individual de estudiantes */
(function () {
    'use strict';

    var EC = window.EC;

    EC.alCargar(function () {
        var contenedor = document.getElementById('detalle-estudiante');
        var parametros = new URLSearchParams(window.location.search);
        var id = Number(parametros.get('id'));

        if (!Number.isInteger(id) || id < 1) {
            contenedor.innerHTML =
                '<div class="alerta alerta-error">El identificador del estudiante no es válido.</div>';
            return;
        }

        function escapar(valor) {
            return EC.esc(valor === null || valor === undefined ? '' : String(valor));
        }

        function mostrar(estudiante, resumen, notas) {
            if (!estudiante) {
                contenedor.innerHTML =
                    '<div class="alerta alerta-error">No se encontró el estudiante solicitado.</div>';
                return;
            }

            var promedio = resumen ? resumen.promedio : null;
            var estadoAcademico = resumen ? resumen.estado_academico : 'SIN NOTAS';
            var cantidad = resumen ? resumen.cantidad : notas.length;

            var filas = notas.length
                ? notas.map(function (nota) {
                    return '<tr>' +
                        '<td>' + escapar(nota.materia) + '</td>' +
                        '<td>' + escapar(nota.nota) + '</td>' +
                        '<td>' + escapar(EC.fecha(nota.fecha_registro)) + '</td>' +
                        '</tr>';
                }).join('')
                : '<tr><td colspan="3">Este estudiante todavía no tiene calificaciones.</td></tr>';

            contenedor.innerHTML =
                '<h2>Información personal</h2>' +
                '<div class="tabla-contenedor"><table class="tabla"><tbody>' +
                '<tr><th>ID</th><td>' + escapar(estudiante.id) + '</td></tr>' +
                '<tr><th>Cédula</th><td>' + escapar(estudiante.cedula) + '</td></tr>' +
                '<tr><th>Nombre</th><td>' + escapar(estudiante.nombre) + '</td></tr>' +
                '<tr><th>Apellido</th><td>' + escapar(estudiante.apellido) + '</td></tr>' +
                '<tr><th>Fecha de ingreso</th><td>' + escapar(EC.fecha(estudiante.fecha_registro)) + '</td></tr>' +
                '<tr><th>Año de ingreso</th><td>' + escapar(EC.anioIngreso(estudiante.fecha_registro)) + '</td></tr>' +
                '<tr><th>Estado</th><td>' + escapar(estudiante.estado) + '</td></tr>' +
                '</tbody></table></div>' +

                '<h2>Rendimiento académico</h2>' +
                '<div class="tabla-contenedor"><table class="tabla"><tbody>' +
                '<tr><th>Cantidad de calificaciones</th><td>' + escapar(cantidad) + '</td></tr>' +
                '<tr><th>Promedio</th><td>' + (promedio === null ? 'Sin notas' : escapar(Number(promedio).toFixed(2))) + '</td></tr>' +
                '<tr><th>Estado académico</th><td>' + escapar(estadoAcademico) + '</td></tr>' +
                '</tbody></table></div>' +

                '<h2>Historial de calificaciones</h2>' +
                '<div class="tabla-contenedor"><table class="tabla">' +
                '<thead><tr><th>Materia</th><th>Nota</th><th>Fecha de registro</th></tr></thead>' +
                '<tbody>' + filas + '</tbody></table></div>';
        }

        Promise.all([
            EC.datos.estudiantePorId(id),
            EC.datos.resumenDeEstudiante(id),
            EC.datos.notasDeEstudiante(id)
        ]).then(function (resultados) {
            mostrar(resultados[0], resultados[1], resultados[2]);
        }).catch(function (error) {
            if (error && error.sesionCaducada) {
                return;
            }

            contenedor.innerHTML =
                '<div class="alerta alerta-error" role="alert">' +
                escapar(EC.mensajeDeError(error)) +
                '</div>' +
                '<button type="button" class="btn btn-secundario" id="btn-reintentar">Reintentar</button>';
        });

        contenedor.addEventListener('click', function (evento) {
            if (evento.target && evento.target.id === 'btn-reintentar') {
                window.location.reload();
            }
        });
    });
})();
