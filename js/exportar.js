/* js/exportar.js - Exportación sin dependencias externas: CSV, XLSX (Office Open XML) y PDF (texto).
   No usa CDN: se puede probar sin red. Los bytes se generan con caracteres de 0 a 255.
   CSV: separador ";" y BOM UTF-8 para que Excel en español lo abra bien.
   XLSX: paquete ZIP sin compresión (método STORE) con las partes mínimas de un libro. */
(function (global) {
    'use strict';

    var EC = global.EC = global.EC || {};

    // Cadena UTF-8 como cadena de bytes (cada carácter 0-255)
    function aBytes(texto) {
        return unescape(encodeURIComponent(String(texto)));
    }

    function escaparXml(v) {
        return String(v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
            .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
    }

    // ---------- CSV ----------
    function csv(encabezados, filas) {
        function celda(v) {
            var s = v === null || v === undefined ? '' : String(v);
            return /[";\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
        }
        var lineas = [encabezados].concat(filas).map(function (f) {
            return f.map(celda).join(';');
        });
        return '\uFEFF' + lineas.join('\r\n') + '\r\n';
    }

    // ---------- CRC-32 y ZIP (STORE) ----------
    var TABLA_CRC = (function () {
        var t = [];
        for (var n = 0; n < 256; n++) {
            var c = n;
            for (var k = 0; k < 8; k++) { c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); }
            t[n] = c >>> 0;
        }
        return t;
    })();

    function crc32(bytes) {
        var c = 0xFFFFFFFF;
        for (var i = 0; i < bytes.length; i++) {
            c = TABLA_CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
        }
        return (c ^ 0xFFFFFFFF) >>> 0;
    }

    function cadenaABytes(s) {
        var out = new Uint8Array(s.length);
        for (var i = 0; i < s.length; i++) { out[i] = s.charCodeAt(i) & 0xFF; }
        return out;
    }

    function u16(n) { return [n & 0xFF, (n >>> 8) & 0xFF]; }
    function u32(n) { return [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF]; }

    // archivos: [{ nombre, contenido (cadena de bytes) }]  ->  Uint8Array de un ZIP válido
    function zip(archivos) {
        var partes = [], central = [], offset = 0;
        archivos.forEach(function (a) {
            var nombre = aBytes(a.nombre);
            var datos = cadenaABytes(a.contenido);
            var crc = crc32(datos);
            var cab = [].concat([0x50, 0x4b, 0x03, 0x04], u16(20), u16(0x0800), u16(0), u16(0), u16(0x21),
                u32(crc), u32(datos.length), u32(datos.length), u16(nombre.length), u16(0));
            var cabBytes = cadenaABytes(String.fromCharCode.apply(null, cab) + nombre);
            partes.push(cabBytes, datos);
            var cen = [].concat([0x50, 0x4b, 0x01, 0x02], u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21),
                u32(crc), u32(datos.length), u32(datos.length), u16(nombre.length), u16(0), u16(0),
                u16(0), u16(0), u32(0), u32(offset));
            central.push(cadenaABytes(String.fromCharCode.apply(null, cen)), nombre);
            offset += cabBytes.length + datos.length;
        });
        var cdInicio = offset, cdTam = 0;
        central.forEach(function (c) { cdTam += c.length; });
        var fin = cadenaABytes(String.fromCharCode.apply(null, [].concat([0x50, 0x4b, 0x05, 0x06],
            u16(0), u16(0), u16(archivos.length), u16(archivos.length), u32(cdTam), u32(cdInicio), u16(0))));

        var total = offset + cdTam + fin.length, salida = new Uint8Array(total), pos = 0;
        function volcar(b) { salida.set(b, pos); pos += b.length; }
        partes.forEach(volcar);
        central.forEach(function (c) { volcar(c instanceof Uint8Array ? c : cadenaABytes(c)); });
        volcar(fin);
        return salida;
    }

    // ---------- XLSX ----------
    function nombreHoja(n, usados) {
        var base = String(n).replace(/[\[\]:*?\/\\]/g, ' ').slice(0, 31) || 'Hoja';
        var nombre = base, k = 2;
        while (usados.indexOf(nombre) !== -1) { nombre = base.slice(0, 28) + ' ' + k++; }
        usados.push(nombre);
        return nombre;
    }

    function columna(i) {
        var s = '';
        i = i + 1;
        while (i > 0) { var r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); }
        return s;
    }

    function hojaXml(encabezados, filas) {
        var todas = [encabezados].concat(filas);
        var xml = '';
        todas.forEach(function (fila, r) {
            xml += '<row r="' + (r + 1) + '">';
            fila.forEach(function (v, c) {
                var ref = columna(c) + (r + 1);
                if (typeof v === 'number' && isFinite(v)) {
                    xml += '<c r="' + ref + '"><v>' + v + '</v></c>';
                } else {
                    xml += '<c r="' + ref + '" t="inlineStr"><is><t xml:space="preserve">' +
                        escaparXml(v === null || v === undefined ? '' : v) + '</t></is></c>';
                }
            });
            xml += '</row>';
        });
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
            '<sheetData>' + xml + '</sheetData></worksheet>';
    }

    // hojas: [{ nombre, encabezados, filas }]  ->  Uint8Array de un .xlsx
    function xlsx(hojas) {
        if (!hojas || hojas.length === 0) { throw new Error('El libro necesita al menos una hoja'); }
        var usados = [], nombres = hojas.map(function (h) { return nombreHoja(h.nombre, usados); });

        var contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
            '<Default Extension="xml" ContentType="application/xml"/>' +
            '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
            hojas.map(function (h, i) {
                return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
            }).join('') +
            '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
            '</Types>';

        var rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
            '</Relationships>';

        var libro = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
            '<sheets>' + nombres.map(function (n, i) {
                return '<sheet name="' + escaparXml(n) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>';
            }).join('') + '</sheets></workbook>';

        var libroRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
            hojas.map(function (h, i) {
                return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>';
            }).join('') +
            '<Relationship Id="rId' + (hojas.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
            '</Relationships>';

        var estilos = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
            '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>' +
            '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
            '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
            '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
            '<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>' +
            '</styleSheet>';

        var archivos = [{ nombre: '[Content_Types].xml', contenido: aBytes(contentTypes) },
            { nombre: '_rels/.rels', contenido: aBytes(rels) },
            { nombre: 'xl/workbook.xml', contenido: aBytes(libro) },
            { nombre: 'xl/_rels/workbook.xml.rels', contenido: aBytes(libroRels) },
            { nombre: 'xl/styles.xml', contenido: aBytes(estilos) }];
        hojas.forEach(function (h, i) {
            archivos.push({ nombre: 'xl/worksheets/sheet' + (i + 1) + '.xml',
                contenido: aBytes(hojaXml(h.encabezados, h.filas)) });
        });
        return zip(archivos);
    }

    // ---------- PDF (texto, Helvetica, A4 vertical) ----------
    // Cada carácter se escribe como su código de un byte (WinAnsi para acentos latinos).
    function escaparPdf(texto) {
        var s = '';
        String(texto).split('').forEach(function (ch) {
            var c = ch.charCodeAt(0);
            if (c > 255) { s += '?'; }
            else if (ch === '(' || ch === ')' || ch === '\\') { s += '\\' + ch; }
            else { s += ch; }
        });
        return s;
    }

    function pdf(titulo, encabezados, filas) {
        var ANCHO = 595, ALTO = 842, MARGEN = 40, LINEA = 13, FILAS_POR_PAGINA = 52;
        var columnasN = encabezados.length;
        var anchoCol = (ANCHO - 2 * MARGEN) / Math.max(1, columnasN);
        var paginas = [];
        var todas = filas.slice();
        var numPag = Math.max(1, Math.ceil(todas.length / FILAS_POR_PAGINA));

        for (var p = 0; p < numPag; p++) {
            var y = ALTO - MARGEN;
            var c = '';
            c += 'BT /F1 13 Tf ' + MARGEN + ' ' + y + ' Td (' + escaparPdf(titulo) + ') Tj ET\n';
            y -= LINEA * 2;
            c += 'BT /F1 8 Tf ' + MARGEN + ' ' + y + ' Td (Pagina ' + (p + 1) + ' de ' + numPag + ') Tj ET\n';
            y -= LINEA * 1.5;
            var todasLasFilas = [encabezados].concat(todas.slice(p * FILAS_POR_PAGINA, (p + 1) * FILAS_POR_PAGINA));
            todasLasFilas.forEach(function (fila, idx) {
                var negrita = idx === 0 ? '/F2' : '/F1';
                fila.forEach(function (v, col) {
                    var txt = String(v === null || v === undefined ? '' : v);
                    if (txt.length > Math.floor(anchoCol / 4.8)) { txt = txt.slice(0, Math.floor(anchoCol / 4.8) - 1) + '.'; }
                    c += 'BT ' + negrita + ' 8 Tf ' + (MARGEN + col * anchoCol) + ' ' + y + ' Td (' + escaparPdf(txt) + ') Tj ET\n';
                });
                y -= LINEA;
            });
            paginas.push(c);
        }

        // Objetos: 1 catálogo, 2 páginas, 3 fuente normal, 4 fuente negrita; por página: página y contenido
        var objs = [];
        objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
        var kids = [];
        for (var i = 0; i < paginas.length; i++) { kids.push((5 + 2 * i) + ' 0 R'); }
        objs[2] = '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + paginas.length + ' >>';
        objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
        objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
        paginas.forEach(function (contenido, i) {
            var idPag = 5 + 2 * i, idCont = 6 + 2 * i;
            objs[idPag] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + ANCHO + ' ' + ALTO + '] ' +
                '/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' + idCont + ' 0 R >>';
            objs[idCont] = '<< /Length ' + contenido.length + ' >>\nstream\n' + contenido + 'endstream';
        });

        var cuerpo = '%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n';
        var posiciones = [];
        for (var n = 1; n < objs.length; n++) {
            posiciones[n] = cuerpo.length;
            cuerpo += n + ' 0 obj\n' + objs[n] + '\nendobj\n';
        }
        var xrefPos = cuerpo.length;
        var xref = 'xref\n0 ' + objs.length + '\n0000000000 65535 f \n';
        for (var m = 1; m < objs.length; m++) {
            xref += String(posiciones[m]).padStart(10, '0') + ' 00000 n \n';
        }
        cuerpo += xref;
        cuerpo += 'trailer\n<< /Size ' + objs.length + ' /Root 1 0 R >>\nstartxref\n' + xrefPos + '\n%%EOF\n';
        return cadenaABytes(cuerpo);
    }

    EC.exportar = {
        csv: csv,
        xlsx: xlsx,
        pdf: pdf,
        // Solo para pruebas: permite revisar la estructura del ZIP sin depender del sistema
        _zip: zip,
        _crc32: crc32
    };
})(window);
