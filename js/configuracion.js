/* js/configuracion.js - Configuración académica: escala de notas y nota mínima de aprobación.
   Valores iniciales: escala 1.0 a 5.0, aprobación desde 3.0.
   Se guardan en localStorage. Si el valor guardado no es válido, se usan los valores iniciales. */
(function (global) {
    'use strict';

    var EC = global.EC = global.EC || {};

    var CLAVE = 'educontrol_configuracion';
    var VALORES_INICIALES = { notaMinima: 1.0, notaMaxima: 5.0, notaAprobacion: 3.0 };

    function esUnDecimal(v) {
        return typeof v === 'number' && isFinite(v) && Math.abs(v * 10 - Math.round(v * 10)) < 1e-9;
    }

    function esAdministrador() {
        var sesion = EC.auth && EC.auth.sesion();
        return !!sesion && sesion.rol === 'ADMIN';
    }

    function validarValores(c) {
        var errores = [];
        if (!esUnDecimal(c.notaMinima) || !esUnDecimal(c.notaMaxima) || !esUnDecimal(c.notaAprobacion)) {
            errores.push('Escribe cada nota como número con un solo decimal, por ejemplo 3.0.');
            return errores;
        }
        if (c.notaMinima <= 0) { errores.push('La nota mínima de la escala debe ser mayor que 0.'); }
        if (c.notaMaxima > 10) { errores.push('La nota máxima de la escala no puede ser mayor que 10.'); }
        if (c.notaMinima >= c.notaMaxima) { errores.push('La nota mínima debe ser menor que la nota máxima.'); }
        if (c.notaAprobacion < c.notaMinima || c.notaAprobacion > c.notaMaxima) {
            errores.push('La nota de aprobación debe estar entre la nota mínima y la nota máxima.');
        }
        return errores;
    }

    function leerGuardada() {
        try {
            var valor = JSON.parse(global.localStorage.getItem(CLAVE));
            if (valor && validarValores(valor).length === 0) {
                return { notaMinima: valor.notaMinima, notaMaxima: valor.notaMaxima, notaAprobacion: valor.notaAprobacion };
            }
        } catch (error) { /* valor dañado: se usan los iniciales */ }
        return { notaMinima: VALORES_INICIALES.notaMinima, notaMaxima: VALORES_INICIALES.notaMaxima,
                 notaAprobacion: VALORES_INICIALES.notaAprobacion };
    }

    EC.configuracion = {
        valoresIniciales: function () {
            return { notaMinima: VALORES_INICIALES.notaMinima, notaMaxima: VALORES_INICIALES.notaMaxima,
                     notaAprobacion: VALORES_INICIALES.notaAprobacion };
        },

        // Valores vigentes (copia; modificarla no cambia la configuración)
        obtener: function () {
            return leerGuardada();
        },

        validar: function (c) {
            return validarValores(c);
        },

        // Solo ADMIN puede cambiar la configuración
        guardar: function (c) {
            if (!esAdministrador()) {
                return { ok: false, errores: ['Acceso no autorizado: solo el administrador puede cambiar la configuración.'] };
            }
            var valores = { notaMinima: Number(c.notaMinima), notaMaxima: Number(c.notaMaxima),
                            notaAprobacion: Number(c.notaAprobacion) };
            var errores = validarValores(valores);
            if (errores.length) { return { ok: false, errores: errores }; }
            global.localStorage.setItem(CLAVE, JSON.stringify(valores));
            return { ok: true, errores: [], valores: valores };
        },

        restablecer: function () {
            if (!esAdministrador()) {
                return { ok: false, errores: ['Acceso no autorizado: solo el administrador puede cambiar la configuración.'] };
            }
            global.localStorage.setItem(CLAVE, JSON.stringify(EC.configuracion.valoresIniciales()));
            return { ok: true, errores: [], valores: EC.configuracion.valoresIniciales() };
        },

        notaEnRango: function (nota) {
            var c = leerGuardada();
            return typeof nota === 'number' && nota >= c.notaMinima && nota <= c.notaMaxima;
        },

        // Una nota o promedio aprueba si es igual o superior a la nota de aprobación
        aprueba: function (valor) {
            return Number(valor) >= leerGuardada().notaAprobacion;
        }
    };
})(window);
