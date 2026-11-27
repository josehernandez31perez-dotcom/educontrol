/* js/calculos.js - Cálculos académicos puros (sin localStorage, sin fetch, sin DOM).
   Reciben arrays de datos y devuelven resultados. Los usan storage.js (datos locales)
   y, en fases posteriores, las pantallas con datos de MySQL.
   Reglas: promedio = media de notas redondeada a 2 decimales; APROBADO si el promedio
   cumple la nota de aprobación; SIN NOTAS si no hay notas; los sin notas no cuentan
   para mejor/menor promedio. */
(function (global) {
    'use strict';

    var EC = global.EC = global.EC || {};

    function redondear(valor) {
        return Math.round(valor * 100) / 100;
    }

    // Quita tildes y pasa a minúsculas para comparar textos
    function normalizarTexto(texto) {
        return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    }

    function compararNombre(a, b) {
        return (a.apellido + ' ' + a.nombre).localeCompare(b.apellido + ' ' + b.nombre, 'es');
    }

    // Orden del ranking: mayor promedio primero; sin notas al final
    function ordenarRanking(a, b) {
        if (a.promedio === null && b.promedio === null) { return compararNombre(a, b); }
        if (a.promedio === null) { return 1; }
        if (b.promedio === null) { return -1; }
        if (b.promedio !== a.promedio) { return b.promedio - a.promedio; }
        return compararNombre(a, b);
    }

    // Promedio de una lista de calificaciones de un estudiante (null si no tiene)
    function promedioDeEstudiante(calificaciones, estudianteId) {
        var notas = calificaciones
            .filter(function (c) { return c.estudiante_id === Number(estudianteId); })
            .map(function (c) { return Number(c.nota); });
        if (!notas.length) { return null; }
        var suma = notas.reduce(function (a, b) { return a + b; }, 0);
        return redondear(suma / notas.length);
    }

    // aprueba(valor) debe devolver true si el valor cumple la nota de aprobación
    function estadoAcademico(promedio, aprueba) {
        if (promedio === null || promedio === undefined) { return 'SIN NOTAS'; }
        return aprueba(promedio) ? 'APROBADO' : 'REPROBADO';
    }

    // Una fila por estudiante, ordenada como el ranking
    function resumen(estudiantes, calificaciones, aprueba) {
        return estudiantes.map(function (e) {
            var cantidad = calificaciones.filter(function (c) { return c.estudiante_id === e.id; }).length;
            var promedio = promedioDeEstudiante(calificaciones, e.id);
            return {
                id: e.id,
                cedula: e.cedula,
                nombre: e.nombre,
                apellido: e.apellido,
                estado: e.estado,
                cantidad: cantidad,
                promedio: promedio,
                estado_academico: estadoAcademico(promedio, aprueba)
            };
        }).sort(ordenarRanking);
    }

    function resumenDeEstudiante(resumenLista, id) {
        return resumenLista.filter(function (r) { return r.id === Number(id); })[0] || null;
    }

    // detalle: lista de calificaciones con materia (forma de listarDetalle)
    function notasDeEstudiante(detalle, estudianteId) {
        return detalle.filter(function (c) { return c.estudiante_id === Number(estudianteId); });
    }

    // Búsqueda por cédula, nombre o apellido, sin distinguir mayúsculas ni tildes
    function buscar(resumenLista, termino) {
        var t = normalizarTexto(termino).trim();
        if (!t) { return resumenLista.slice(); }
        return resumenLista.filter(function (r) {
            return normalizarTexto(r.cedula).indexOf(t) !== -1 ||
                   normalizarTexto(r.nombre).indexOf(t) !== -1 ||
                   normalizarTexto(r.apellido).indexOf(t) !== -1;
        });
    }

    // Totales, mejor/menor promedio y ranking a partir de un resumen
    function estadisticas(resumenLista, totalMaterias) {
        var conNotas = resumenLista.filter(function (r) { return r.promedio !== null; });
        var suma = conNotas.reduce(function (a, r) { return a + r.promedio; }, 0);
        var menor = conNotas.slice().sort(function (a, b) {
            return (a.promedio - b.promedio) || compararNombre(a, b);
        })[0] || null;

        return {
            totalEstudiantes: resumenLista.length,
            totalMaterias: totalMaterias,
            aprobados: resumenLista.filter(function (r) { return r.estado_academico === 'APROBADO'; }).length,
            reprobados: resumenLista.filter(function (r) { return r.estado_academico === 'REPROBADO'; }).length,
            sinNotas: resumenLista.length - conNotas.length,
            promedioGeneral: conNotas.length ? redondear(suma / conNotas.length) : null,
            mejor: conNotas[0] || null,
            menor: menor,
            ranking: conNotas,
            sinNotasLista: resumenLista.filter(function (r) { return r.promedio === null; })
        };
    }

    EC.calculosAcademicos = {
        redondear: redondear,
        normalizarTexto: normalizarTexto,
        compararNombre: compararNombre,
        ordenarRanking: ordenarRanking,
        promedioDeEstudiante: promedioDeEstudiante,
        estadoAcademico: estadoAcademico,
        resumen: resumen,
        resumenDeEstudiante: resumenDeEstudiante,
        notasDeEstudiante: notasDeEstudiante,
        buscar: buscar,
        estadisticas: estadisticas
    };
})(window);
