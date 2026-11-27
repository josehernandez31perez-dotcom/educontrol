/* js/academico.js - Cálculos académicos de la Etapa E (funciones puras, sin acceso a datos).
   Aritmética entera: las notas se manejan en décimas (4.0 = 40) y los pesos en centésimas (30 % = 3000).
   Así el redondeo no depende de la coma flotante: 4.05 se redondea a 4.1 de forma exacta.
   Reglas: R-15 (NO APLICA con renormalización), R-16 (nota final solo por cierre), R-17 (cálculo fuera del
   navegador en modo MySQL; aquí queda la misma lógica para el modo local y para pruebas), ámbitos de período
   e histórico, y el alumno nunca ve rankings. La seguridad real está en PHP y en la base (ver SEGURIDAD). */
(function (global) {
    'use strict';

    var EC = global.EC = global.EC || {};

    var ESTADO = {
        CALCULADA: 'CALCULADA',
        PENDIENTE_SIN_NOTA: 'PENDIENTE_SIN_NOTA',
        PENDIENTE_TODAS_NO_APLICA: 'PENDIENTE_TODAS_NO_APLICA'
    };

    // "4.0" o 4 -> 40 (décimas). Solo se aceptan notas de 1.0 a 5.0 con una cifra decimal.
    function aDecimas(nota) {
        var n = Math.round(Number(nota) * 10);
        if (!isFinite(n) || n < 10 || n > 50 || Math.abs(Number(nota) * 10 - n) > 1e-9) {
            throw new Error('Nota no válida: ' + nota);
        }
        return n;
    }

    // 30 -> 3000 (centésimas de porcentaje). Un peso debe estar entre 0 y 100.
    function aCentesimas(peso) {
        var p = Math.round(Number(peso) * 100);
        if (!isFinite(p) || p <= 0 || p > 10000) {
            throw new Error('Peso no válido: ' + peso);
        }
        return p;
    }

    // Comprueba que las evaluaciones de una sección suman exactamente 100 % (condición para cerrar).
    function validarPesos(evaluaciones) {
        var total = 0;
        (evaluaciones || []).forEach(function (e) { total += aCentesimas(e.peso); });
        return { valido: total === 10000, total: total / 100 };
    }

    /* Nota final de un alumno en una sección.
       evaluaciones: [{id, peso}]
       notas:        { [evaluacionId]: nota }       (la nota registrada, si existe)
       noAplica:     [evaluacionId]                 (marcas VIGENTES de NO APLICA para este alumno)
       Devuelve { estado, nota (texto con una cifra), pendientes:[ids] }.
       - Una evaluación con nota Y con NO APLICA VIGENTE es un conflicto: se lanza error (no se decide en silencio).
       - Una evaluación sin nota y sin NO APLICA deja la nota PENDIENTE: nunca se convierte en NO APLICA ni en cero.
       - Si todas las evaluaciones son NO APLICA no hay nota: queda pendiente de resolución administrativa. */
    function calcularNotaFinal(evaluaciones, notas, noAplica) {
        var pesos = validarPesos(evaluaciones);
        if (!pesos.valido) {
            throw new Error('Los pesos de la sección suman ' + pesos.total + ' % y deben sumar 100 %');
        }
        var marcadas = {};
        (noAplica || []).forEach(function (id) { marcadas[String(id)] = true; });

        var num = 0, den = 0, sinNota = [];
        (evaluaciones || []).forEach(function (e) {
            var clave = String(e.id);
            var tieneNota = notas && notas[clave] !== undefined && notas[clave] !== null;
            if (marcadas[clave]) {
                if (tieneNota) {
                    throw new Error('Conflicto: la evaluación ' + clave + ' tiene nota y marca NO APLICA');
                }
                return; // excluida y renormalizada
            }
            if (!tieneNota) {
                sinNota.push(e.id);
                return;
            }
            num += aDecimas(notas[clave]) * aCentesimas(e.peso);
            den += aCentesimas(e.peso);
        });

        if (sinNota.length > 0) {
            return { estado: ESTADO.PENDIENTE_SIN_NOTA, nota: null, pendientes: sinNota };
        }
        if (den === 0) {
            return { estado: ESTADO.PENDIENTE_TODAS_NO_APLICA, nota: null, pendientes: [] };
        }
        // Redondeo a décimas, mitad hacia fuera de cero, en enteros: floor((2*num + den) / (2*den))
        var decimas = Math.floor((2 * num + den) / (2 * den));
        return { estado: ESTADO.CALCULADA, nota: (decimas / 10).toFixed(1), pendientes: [] };
    }

    // Promedio de notas en décimas, con dos cifras decimales y redondeo mitad hacia arriba (entero).
    function promedio(notasDecimas) {
        if (!notasDecimas || notasDecimas.length === 0) { return null; }
        var suma = 0;
        notasDecimas.forEach(function (n) { suma += n; });
        var n = notasDecimas.length;
        var centesimas = Math.floor((2 * suma * 10 + n) / (2 * n));
        return (centesimas / 100).toFixed(2);
    }

    // Filas con origen ACTUAL de un período concreto. Nunca mezcla períodos.
    function notasDelPeriodo(calificaciones, periodoId) {
        return (calificaciones || []).filter(function (c) {
            return c.origen === 'ACTUAL' && Number(c.periodo_id) === Number(periodoId);
        });
    }

    // Filas históricas (HEREDADA). Van separadas de cualquier período.
    function notasHistoricas(calificaciones) {
        return (calificaciones || []).filter(function (c) { return c.origen === 'HEREDADA'; });
    }

    // Promedio de un alumno dentro de UN período (o del histórico). Sin promedio general combinado.
    function promedioPeriodo(calificaciones, estudianteId, periodoId) {
        var filas = notasDelPeriodo(calificaciones, periodoId).filter(function (c) {
            return Number(c.estudiante_id) === Number(estudianteId);
        });
        return promedio(filas.map(function (c) { return aDecimas(c.nota); }));
    }

    // Ranking de un período: promedio descendente, desempate por apellido y nombre; posiciones correlativas.
    function ranking(filas) {
        var conNota = filas.filter(function (f) { return f.promedio !== null && f.promedio !== undefined; });
        conNota.sort(function (a, b) {
            var d = Number(b.promedio) - Number(a.promedio);
            if (d !== 0) { return d; }
            return (a.apellido + ' ' + a.nombre).localeCompare(b.apellido + ' ' + b.nombre, 'es');
        });
        conNota.forEach(function (f, i) { f.posicion = i + 1; });
        return conNota;
    }

    /* Visibilidad. La identidad llega del SERVIDOR (sesión), nunca de la interfaz.
       identidad: { rol, estudianteId?, profesorId?, seccionesIds? } */
    function puedeVerRanking(identidad, ambito) {
        if (!identidad) { return false; }
        if (identidad.rol === 'ADMIN') { return true; }
        if (identidad.rol === 'PROFESOR') { return ambito === 'seccion'; }
        return false; // ALUMNO: nunca rankings
    }

    function filtrarCalificaciones(identidad, calificaciones) {
        if (!identidad) { return []; }
        if (identidad.rol === 'ADMIN') { return (calificaciones || []).slice(); }
        if (identidad.rol === 'PROFESOR') {
            var secciones = identidad.seccionesIds || [];
            return (calificaciones || []).filter(function (c) {
                return secciones.indexOf(Number(c.seccion_id)) !== -1;
            });
        }
        if (identidad.rol === 'ALUMNO') {
            return (calificaciones || []).filter(function (c) {
                return Number(c.estudiante_id) === Number(identidad.estudianteId);
            });
        }
        return [];
    }

    EC.academico = {
        ESTADO: ESTADO,
        validarPesos: validarPesos,
        calcularNotaFinal: calcularNotaFinal,
        promedio: promedio,
        notasDelPeriodo: notasDelPeriodo,
        notasHistoricas: notasHistoricas,
        promedioPeriodo: promedioPeriodo,
        ranking: ranking,
        puedeVerRanking: puedeVerRanking,
        filtrarCalificaciones: filtrarCalificaciones
    };
})(window);
