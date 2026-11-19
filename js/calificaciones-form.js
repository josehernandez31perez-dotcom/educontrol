/* js/calificaciones-form.js - Registrar y editar calificaciones */
(function () {
    'use strict';
    var EC = window.EC;

    function mostrarErrores(form, errores) {
        form.querySelectorAll('[data-error]').forEach(function (span) {
            span.textContent = errores[span.dataset.error] || '';
        });
    }

    EC.alCargar(function () {
        var form = document.getElementById('form-calificacion');
        var modo = document.body.dataset.modo;
        var id = Number(new URLSearchParams(window.location.search).get('id')) || 0;
        var actual = null;

        if (modo === 'editar') {
            actual = EC.calificaciones.obtener(id);
            if (!actual) {
                EC.mostrarMensaje('error', 'No se encontró la calificación solicitada.');
                form.hidden = true;
                return;
            }
        }

        var idEstudiante = actual ? actual.estudiante_id : 0;
        var idMateria = actual ? actual.materia_id : 0;

        form.elements.estudiante_id.innerHTML = '<option value="">— Selecciona un estudiante —</option>' +
            EC.estudiantes.paraSelect(idEstudiante).map(function (e) {
                return '<option value="' + e.id + '"' + (e.id === idEstudiante ? ' selected' : '') + '>' +
                    EC.esc(e.apellido + ' ' + e.nombre + ' (' + e.cedula + ')') + '</option>';
            }).join('');

        form.elements.materia_id.innerHTML = '<option value="">— Selecciona una materia —</option>' +
            EC.materias.paraSelect(idMateria).map(function (m) {
                return '<option value="' + m.id + '"' + (m.id === idMateria ? ' selected' : '') + '>' +
                    EC.esc(m.nombre) + '</option>';
            }).join('');

        if (actual) {
            form.elements.nota.value = EC.formato.nota(actual.nota);
        }

        form.addEventListener('submit', function (evento) {
            evento.preventDefault();
            var valores = {
                estudiante_id: form.elements.estudiante_id.value,
                materia_id: form.elements.materia_id.value,
                nota: form.elements.nota.value
            };
            var resultado = modo === 'editar' ? EC.calificaciones.actualizar(id, valores) : EC.calificaciones.crear(valores);

            if (!resultado.ok) {
                mostrarErrores(form, resultado.errores);
                EC.mostrarMensaje('error', 'Revisa los campos marcados en rojo.');
                return;
            }
            EC.guardarFlash('ok', modo === 'editar'
                ? 'Calificación actualizada correctamente.'
                : 'Calificación registrada correctamente.');
            EC.irA('calificaciones/index.html');
        });
    });
})();
