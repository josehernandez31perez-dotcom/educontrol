/* js/configuracion-form.js - Página de configuración académica (solo ADMIN) */
(function () {
    'use strict';
    var EC = window.EC;

    function mostrarErrores(form, errores) {
        form.querySelectorAll('[data-error]').forEach(function (span) {
            span.textContent = '';
        });
        if (errores.length) {
            form.querySelector('[data-error="general"]').textContent = errores[0];
        }
    }

    function rellenar(form, valores) {
        form.elements.notaMinima.value = valores.notaMinima.toFixed(1);
        form.elements.notaMaxima.value = valores.notaMaxima.toFixed(1);
        form.elements.notaAprobacion.value = valores.notaAprobacion.toFixed(1);
    }

    EC.alCargar(function () {
        var form = document.getElementById('form-configuracion');
        var btnRestablecer = document.getElementById('btn-restablecer');

        rellenar(form, EC.configuracion.obtener());

        form.addEventListener('submit', function (evento) {
            evento.preventDefault();
            var resultado = EC.configuracion.guardar({
                notaMinima: form.elements.notaMinima.value,
                notaMaxima: form.elements.notaMaxima.value,
                notaAprobacion: form.elements.notaAprobacion.value
            });
            mostrarErrores(form, resultado.errores);
            if (!resultado.ok) {
                EC.mostrarMensaje('error', resultado.errores[0]);
                return;
            }
            EC.mostrarMensaje('ok', 'Configuración guardada. Los estados y colores se actualizan con la nueva escala.');
        });

        btnRestablecer.addEventListener('click', function () {
            var resultado = EC.configuracion.restablecer();
            if (!resultado.ok) {
                EC.mostrarMensaje('error', resultado.errores[0]);
                return;
            }
            rellenar(form, resultado.valores);
            mostrarErrores(form, []);
            EC.mostrarMensaje('ok', 'Se restablecieron los valores iniciales: escala 1.0 a 5.0 y aprobación desde 3.0.');
        });
    });
})();
