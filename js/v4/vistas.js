/* js/v4/vistas.js - Render genérico de tablas, formularios y botones de exportación. NO PROBADO en navegador.
   Todo texto de datos pasa por escapar(): nada se inserta como HTML sin escapar. */
(function (global) {
    'use strict';
    var EC = global.EC = global.EC || {};
    var esc = function (t) { return EC.v4.escapar(t); };

    // columnas: [{clave, titulo}] ; filas: objetos
    function tabla(filas, columnas) {
        if (!filas || filas.length === 0) { return '<p class="vacio">Sin datos.</p>'; }
        var cab = columnas.map(function (c) { return '<th>' + esc(c.titulo) + '</th>'; }).join('');
        var cuerpo = filas.map(function (f) {
            return '<tr>' + columnas.map(function (c) { return '<td>' + esc(f[c.clave]) + '</td>'; }).join('') + '</tr>';
        }).join('');
        return '<div class="tabla-contenedor"><table class="tabla"><thead><tr>' + cab + '</tr></thead><tbody>' + cuerpo + '</tbody></table></div>';
    }

    // Botones CSV / XLSX / PDF para una tabla ya visible. Usa EC.exportar (sin dependencias externas).
    function botonesExportar(nombre, filas, columnas) {
        return '<div class="acciones-form">' +
            '<button type="button" class="btn btn-secundario" data-exportar="csv" data-nombre="' + esc(nombre) + '">CSV</button> ' +
            '<button type="button" class="btn btn-secundario" data-exportar="xlsx" data-nombre="' + esc(nombre) + '">Excel</button> ' +
            '<button type="button" class="btn btn-secundario" data-exportar="pdf" data-nombre="' + esc(nombre) + '">PDF</button>' +
            '</div>';
    }

    // Convierte una tabla (filas + columnas) en el formato de exportación. Función pura: se puede probar.
    function exportarTabla(formato, nombre, filas, columnas) {
        var encabezados = columnas.map(function (c) { return c.titulo; });
        var cuerpo = (filas || []).map(function (f) {
            return columnas.map(function (c) { return f[c.clave] === null || f[c.clave] === undefined ? '' : f[c.clave]; });
        });
        if (formato === 'csv') { return { tipo: 'text/csv', datos: EC.exportar.csv(encabezados, cuerpo), nombre: nombre + '.csv' }; }
        if (formato === 'xlsx') { return { tipo: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', datos: EC.exportar.xlsx([{ nombre: nombre, encabezados: encabezados, filas: cuerpo }]), nombre: nombre + '.xlsx' }; }
        if (formato === 'pdf') { return { tipo: 'application/pdf', datos: EC.exportar.pdf(nombre, encabezados, cuerpo), nombre: nombre + '.pdf' }; }
        throw new Error('Formato no soportado: ' + formato);
    }

    // Formulario a partir de una definición [{nombre, etiqueta, tipo}] ; tipo: text | number | date | password | select
    function formulario(id, campos, textoBoton) {
        var html = '<form id="' + esc(id) + '" class="formulario">';
        campos.forEach(function (c) {
            var atributos = ' name="' + esc(c.nombre) + '" id="' + esc(id + '-' + c.nombre) + '" required';
            var control;
            if (c.tipo === 'select') {
                control = '<select' + atributos + '>' + (c.opciones || []).map(function (o) {
                    return '<option value="' + esc(o) + '">' + esc(o) + '</option>';
                }).join('') + '</select>';
            } else if (c.tipo === 'textarea') {
                control = '<textarea' + atributos + ' maxlength="500"></textarea>';
            } else {
                control = '<input type="' + esc(c.tipo || 'text') + '"' + atributos + (c.step ? ' step="' + esc(c.step) + '"' : '') + '>';
            }
            html += '<label>' + esc(c.etiqueta) + control + '</label>';
        });
        html += '<button type="submit" class="btn btn-primario">' + esc(textoBoton || 'Guardar') + '</button>';
        return html + '</form><div class="resultado" role="status"></div>';
    }

    // Lee un formulario ya renderizado y devuelve un objeto con sus valores.
    function leerFormulario(form) {
        var datos = {};
        Array.prototype.forEach.call(form.elements, function (el) {
            if (el.name) { datos[el.name] = el.value; }
        });
        return datos;
    }

    EC.vistas = {
        tabla: tabla,
        botonesExportar: botonesExportar,
        exportarTabla: exportarTabla,
        formulario: formulario,
        leerFormulario: leerFormulario
    };
})(window);
