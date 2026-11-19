/* js/estudiantes-form.js - Formularios de registrar y editar estudiante */
(function () {
    'use strict';
    var EC = window.EC;

    function leerFormulario(form) {
        return {
            cedula: form.elements.cedula.value,
            nombre: form.elements.nombre.value,
            apellido: form.elements.apellido.value,
            estado: form.elements.estado.value
        };
    }

    function mostrarErrores(form, errores) {
        form.querySelectorAll('[data-error]').forEach(function (span) {
            span.textContent = errores[span.dataset.error] || '';
        });
    }

    EC.alCargar(function () {
        var form = document.getElementById('form-estudiante');
        var modo = document.body.dataset.modo;
        var id = Number(new URLSearchParams(window.location.search).get('id')) || 0;

        if (modo === 'editar') {
            var actual = EC.estudiantes.obtener(id);
            if (!actual) {
                EC.mostrarMensaje('error', 'No se encontró el estudiante solicitado.');
                form.hidden = true;
                return;
            }
            form.elements.cedula.value = actual.cedula;
            form.elements.nombre.value = actual.nombre;
            form.elements.apellido.value = actual.apellido;
            form.elements.estado.value = actual.estado;
        }

        form.addEventListener('submit', function (evento) {
            evento.preventDefault();
            var valores = leerFormulario(form);
            var resultado = modo === 'editar' ? EC.estudiantes.actualizar(id, valores) : EC.estudiantes.crear(valores);

            if (!resultado.ok) {
                mostrarErrores(form, resultado.errores);
                EC.mostrarMensaje('error', 'Revisa los campos marcados en rojo.');
                return;
            }
            EC.guardarFlash('ok', modo === 'editar'
                ? 'Los datos del estudiante se guardaron correctamente.'
                : 'Estudiante registrado correctamente.');
            EC.irA('estudiantes/index.html');
        });
    });
})();
