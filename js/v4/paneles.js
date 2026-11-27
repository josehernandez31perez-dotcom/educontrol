/* js/v4/paneles.js - Paneles por rol de la interfaz v4. NO PROBADO en navegador.
   El SERVIDOR es la autoridad de los resultados (R-17). En la vista del profesor y del alumno,
   EC.academico recalcula los resultados en el cliente y se CONCILIA con los del servidor: si no coinciden,
   la pantalla lo marca. Ningún panel muestra rankings al ALUMNO. */
(function (global) {
    'use strict';
    var EC = global.EC = global.EC || {};
    var v4 = function () { return EC.v4; };
    var vistas = function () { return EC.vistas; };

    // ---------- Conciliación (función pura, probada en tests) ----------
    // filasEval: salida de prof.calificaciones_seccion ; filasFinales: salida de prof.notas_finales
    function conciliarNotasFinales(filasEval, filasFinales) {
        var porAlumno = {};
        (filasEval || []).forEach(function (f) {
            var a = porAlumno[f.estudiante_id] = porAlumno[f.estudiante_id] || { evaluaciones: {}, notas: {}, noAplica: [] };
            a.evaluaciones[f.evaluacion_id] = Number(f.peso);
            if (f.nota !== null && f.nota !== undefined) { a.notas[f.evaluacion_id] = Number(f.nota); }
            if (Number(f.no_aplica) === 1) { a.noAplica.push(f.evaluacion_id); }
        });
        var finales = {};
        (filasFinales || []).forEach(function (f) { finales[f.estudiante_id] = String(Number(f.nota).toFixed(1)); });
        return Object.keys(porAlumno).map(function (id) {
            var a = porAlumno[id];
            var evs = Object.keys(a.evaluaciones).map(function (k) { return { id: k, peso: a.evaluaciones[k] }; });
            var cliente;
            try {
                var r = EC.academico.calcularNotaFinal(evs, a.notas, a.noAplica);
                cliente = r.estado === EC.academico.ESTADO.CALCULADA ? r.nota : r.estado;
            } catch (e) { cliente = 'ERROR'; }
            var servidor = finales[id] === undefined ? 'SIN_FINAL' : finales[id];
            return { estudiante_id: Number(id), cliente: cliente, servidor: servidor,
                coincide: cliente === servidor || (cliente !== 'ERROR' && cliente.indexOf('PENDIENTE') === 0 && servidor === 'SIN_FINAL') };
        });
    }

    // Promedios del alumno: el servidor da el promedio por período; el cliente lo recalcula a partir de sus notas finales.
    function conciliarPromedios(filasFinales, filasPromedios) {
        var porPeriodo = {};
        (filasFinales || []).forEach(function (f) {
            if (f.origen !== 'ACTUAL') { return; }
            (porPeriodo[f.periodo_id] = porPeriodo[f.periodo_id] || []).push(Math.round(Number(f.nota) * 10));
        });
        return (filasPromedios || []).filter(function (p) { return p.ambito === 'PERIODO'; }).map(function (p) {
            var cliente = EC.academico.promedio(porPeriodo[p.periodo_id] || []);
            return { periodo_id: p.periodo_id, cliente: cliente, servidor: Number(p.promedio).toFixed(2),
                coincide: cliente === Number(p.promedio).toFixed(2) };
        });
    }

    // ---------- Definiciones de formularios por acción (la validación real está en el servidor) ----------
    var FORMULARIOS = {
        admin: [
            { titulo: 'Cuentas', acciones: [
                { accion: 'admin.crear_cuenta_profesor', etiqueta: 'Crear cuenta de profesor', campos: [
                    { nombre: 'motivo', etiqueta: 'Motivo' }, { nombre: 'nombre_usuario', etiqueta: 'Usuario' },
                    { nombre: 'password', etiqueta: 'Contraseña', tipo: 'password' }, { nombre: 'cedula', etiqueta: 'Cédula' },
                    { nombre: 'nombre', etiqueta: 'Nombre' }, { nombre: 'apellido', etiqueta: 'Apellido' },
                    { nombre: 'correo', etiqueta: 'Correo', tipo: 'email' }]},
                { accion: 'admin.crear_cuenta_alumno', etiqueta: 'Crear cuenta de alumno', campos: [
                    { nombre: 'motivo', etiqueta: 'Motivo' }, { nombre: 'estudiante_id', etiqueta: 'Id de alumno', tipo: 'number' },
                    { nombre: 'nombre_usuario', etiqueta: 'Usuario' }, { nombre: 'password', etiqueta: 'Contraseña', tipo: 'password' }]},
                { accion: 'admin.cambiar_estado_cuenta', etiqueta: 'Activar o desactivar cuenta', campos: [
                    { nombre: 'motivo', etiqueta: 'Motivo' }, { nombre: 'usuario_id', etiqueta: 'Id de cuenta', tipo: 'number' },
                    { nombre: 'estado', etiqueta: 'Estado', tipo: 'select', opciones: ['ACTIVO', 'INACTIVO'] }]}]},
            { titulo: 'Períodos', acciones: [
                { accion: 'admin.crear_periodo', etiqueta: 'Crear período', campos: [
                    { nombre: 'motivo', etiqueta: 'Motivo' }, { nombre: 'anio', etiqueta: 'Año', tipo: 'number' },
                    { nombre: 'nombre', etiqueta: 'Nombre' }, { nombre: 'inicio', etiqueta: 'Inicio', tipo: 'date' },
                    { nombre: 'fin', etiqueta: 'Fin', tipo: 'date' }]},
                { accion: 'admin.cerrar_periodo', etiqueta: 'Cerrar período', campos: [
                    { nombre: 'motivo', etiqueta: 'Motivo' }, { nombre: 'periodo_id', etiqueta: 'Id de período', tipo: 'number' }]},
                { accion: 'admin.reabrir_periodo', etiqueta: 'Reabrir período', campos: [
                    { nombre: 'motivo', etiqueta: 'Motivo' }, { nombre: 'periodo_id', etiqueta: 'Id de período', tipo: 'number' }]}]},
            { titulo: 'Secciones e inscripciones', acciones: [
                { accion: 'admin.crear_seccion', etiqueta: 'Crear sección', campos: [
                    { nombre: 'motivo', etiqueta: 'Motivo' }, { nombre: 'materia_id', etiqueta: 'Id de materia', tipo: 'number' },
                    { nombre: 'periodo_id', etiqueta: 'Id de período', tipo: 'number' }, { nombre: 'codigo', etiqueta: 'Código' }]},
                { accion: 'admin.asignar_profesor', etiqueta: 'Asignar profesor', campos: [
                    { nombre: 'motivo', etiqueta: 'Motivo' }, { nombre: 'profesor_id', etiqueta: 'Id de profesor', tipo: 'number' },
                    { nombre: 'seccion_id', etiqueta: 'Id de sección', tipo: 'number' }]},
                { accion: 'admin.inscribir_estudiante', etiqueta: 'Inscribir alumno', campos: [
                    { nombre: 'motivo', etiqueta: 'Motivo' }, { nombre: 'estudiante_id', etiqueta: 'Id de alumno', tipo: 'number' },
                    { nombre: 'seccion_id', etiqueta: 'Id de sección', tipo: 'number' }]}]},
            { titulo: 'Evaluaciones y calificaciones', acciones: [
                { accion: 'admin.crear_evaluacion', etiqueta: 'Crear evaluación', campos: [
                    { nombre: 'motivo', etiqueta: 'Motivo' }, { nombre: 'seccion_id', etiqueta: 'Id de sección', tipo: 'number' },
                    { nombre: 'nombre', etiqueta: 'Nombre' }, { nombre: 'peso', etiqueta: 'Peso %', tipo: 'number', step: '0.01' }]},
                { accion: 'admin.corregir_nota', etiqueta: 'Corregir nota (después del cierre)', campos: [
                    { nombre: 'motivo', etiqueta: 'Motivo' }, { nombre: 'evaluacion_id', etiqueta: 'Id de evaluación', tipo: 'number' },
                    { nombre: 'estudiante_id', etiqueta: 'Id de alumno', tipo: 'number' }, { nombre: 'nueva', etiqueta: 'Nueva nota', tipo: 'number', step: '0.1' }]},
                { accion: 'admin.clasificar_heredada', etiqueta: 'Clasificar nota histórica', campos: [
                    { nombre: 'motivo', etiqueta: 'Motivo' }, { nombre: 'calificacion_id', etiqueta: 'Id de calificación', tipo: 'number' },
                    { nombre: 'seccion_id', etiqueta: 'Id de sección', tipo: 'number' }, { nombre: 'periodo_id', etiqueta: 'Id de período', tipo: 'number' }]},
                { accion: 'admin.detectar_pendientes', etiqueta: 'Detectar pendientes de un período', campos: [
                    { nombre: 'periodo_id', etiqueta: 'Id de período', tipo: 'number' }]}]}
        ],
        profesor: [
            { titulo: 'Evaluaciones y notas', acciones: [
                { accion: 'prof.crear_evaluacion', etiqueta: 'Crear evaluación', campos: [
                    { nombre: 'seccion_id', etiqueta: 'Id de sección', tipo: 'number' }, { nombre: 'nombre', etiqueta: 'Nombre' },
                    { nombre: 'peso', etiqueta: 'Peso %', tipo: 'number', step: '0.01' }]},
                { accion: 'prof.registrar_nota', etiqueta: 'Registrar nota', campos: [
                    { nombre: 'evaluacion_id', etiqueta: 'Id de evaluación', tipo: 'number' }, { nombre: 'estudiante_id', etiqueta: 'Id de alumno', tipo: 'number' },
                    { nombre: 'nota', etiqueta: 'Nota', tipo: 'number', step: '0.1' }]},
                { accion: 'prof.marcar_no_aplica', etiqueta: 'Marcar NO APLICA (motivo obligatorio)', campos: [
                    { nombre: 'evaluacion_id', etiqueta: 'Id de evaluación', tipo: 'number' }, { nombre: 'estudiante_id', etiqueta: 'Id de alumno', tipo: 'number' },
                    { nombre: 'motivo', etiqueta: 'Motivo' }]}]},
            { titulo: 'Observaciones', acciones: [
                { accion: 'prof.registrar_observacion', etiqueta: 'Registrar observación', campos: [
                    { nombre: 'estudiante_id', etiqueta: 'Id de alumno', tipo: 'number' }, { nombre: 'seccion_id', etiqueta: 'Id de sección', tipo: 'number' },
                    { nombre: 'texto', etiqueta: 'Observación', tipo: 'textarea' }]}]}
        ]
    };

    // Lecturas por rol: accion, parámetros fijos, columnas para la tabla y nombre para exportar.
    var LECTURAS = {
        admin: [
            { accion: 'admin.usuarios', titulo: 'Cuentas', columnas: [['id', 'Id'], ['nombre_usuario', 'Usuario'], ['rol', 'Rol'], ['estado', 'Estado']] },
            { accion: 'admin.estudiantes', titulo: 'Alumnos', columnas: [['id', 'Id'], ['cedula', 'Cédula'], ['apellido', 'Apellido'], ['nombre', 'Nombre'], ['estado', 'Estado']] },
            { accion: 'admin.periodos', titulo: 'Períodos', columnas: [['id', 'Id'], ['anio_escolar', 'Año'], ['nombre', 'Nombre'], ['estado', 'Estado']] },
            { accion: 'admin.secciones', titulo: 'Secciones', columnas: [['id', 'Id'], ['materia', 'Materia'], ['periodo', 'Período'], ['codigo', 'Código'], ['estado', 'Estado']] },
            { accion: 'admin.calificaciones', titulo: 'Calificaciones', columnas: [['id', 'Id'], ['origen', 'Origen'], ['apellido', 'Apellido'], ['materia', 'Materia'], ['periodo', 'Período'], ['nota', 'Nota']] },
            { accion: 'admin.pendientes', titulo: 'Pendientes', columnas: [['id', 'Id'], ['tipo', 'Tipo'], ['estado', 'Estado'], ['resolucion', 'Resolución']] },
            { accion: 'admin.auditoria', titulo: 'Auditoría', columnas: [['fecha', 'Fecha'], ['nombre_usuario', 'Usuario'], ['accion', 'Acción'], ['entidad', 'Entidad'], ['motivo', 'Motivo']] }
        ],
        profesor: [
            { accion: 'prof.mis_secciones', titulo: 'Mis secciones', columnas: [['seccion_id', 'Sección'], ['materia', 'Materia'], ['codigo', 'Código'], ['periodo', 'Período'], ['periodo_estado', 'Estado período']] }
        ],
        alumno: [
            { accion: 'alum.mis_inscripciones', titulo: 'Mis inscripciones', columnas: [['inscripcion_id', 'Id'], ['materia', 'Materia'], ['codigo', 'Sección'], ['periodo', 'Período'], ['estado', 'Estado']] },
            { accion: 'alum.mis_resultados', titulo: 'Mis evaluaciones', columnas: [['materia', 'Materia'], ['evaluacion', 'Evaluación'], ['peso', 'Peso %'], ['nota', 'Nota'], ['no_aplica', 'NO APLICA']] },
            { accion: 'alum.mis_finales', titulo: 'Mis notas finales', columnas: [['origen', 'Origen'], ['periodo', 'Período'], ['materia', 'Materia'], ['nota', 'Nota']] },
            { accion: 'alum.promedios', titulo: 'Mis promedios', columnas: [['ambito', 'Ámbito'], ['periodo', 'Período'], ['materias', 'Materias'], ['promedio', 'Promedio']] }
        ]
    };

    function montarFormularios(raiz, lista, csrf) {
        lista.forEach(function (bloque) {
            var seccion = document.createElement('section');
            seccion.className = 'panel';
            seccion.innerHTML = '<h2>' + v4().escapar(bloque.titulo) + '</h2>' + bloque.acciones.map(function (a) {
                return '<h3>' + v4().escapar(a.etiqueta) + '</h3>' + vistas().formulario(a.accion.replace(/\./g, '-'), a.campos, a.etiqueta);
            }).join('');
            raiz.appendChild(seccion);
            bloque.acciones.forEach(function (a) {
                var form = seccion.querySelector('#' + a.accion.replace(/\./g, '-'));
                form.addEventListener('submit', function (ev) {
                    ev.preventDefault();
                    var salida = form.parentNode.querySelector('.resultado');
                    var datos = vistas().leerFormulario(form);
                    v4().llamar(a.accion, 'POST', datos, csrf()).then(function () {
                        salida.textContent = 'Operación realizada.';
                        form.reset();
                    }).catch(function (e) { salida.textContent = e.message; });
                });
            });
        });
    }

    function montarLecturas(raiz, lista, parametros) {
        lista.forEach(function (l) {
            var seccion = document.createElement('section');
            seccion.className = 'panel';
            seccion.innerHTML = '<h2>' + v4().escapar(l.titulo) + '</h2><div class="contenido">Cargando…</div><div class="exportar"></div>';
            raiz.appendChild(seccion);
            var columnas = l.columnas.map(function (c) { return { clave: c[0], titulo: c[1] }; });
            v4().llamar(l.accion, 'GET', parametros ? parametros(l) : {}, '').then(function (filas) {
                seccion.querySelector('.contenido').innerHTML = vistas().tabla(filas, columnas);
                seccion.querySelector('.exportar').innerHTML = vistas().botonesExportar(l.titulo, filas, columnas);
                seccion.querySelectorAll('[data-exportar]').forEach(function (b) {
                    b.addEventListener('click', function () {
                        var r = vistas().exportarTabla(b.getAttribute('data-exportar'), l.titulo, filas, columnas);
                        descargar(r);
                    });
                });
            }).catch(function (e) {
                seccion.querySelector('.contenido').innerHTML = '<div class="alerta alerta-error">' + v4().escapar(e.message) + '</div>';
            });
        });
    }

    function descargar(r) {
        var blob = new Blob([r.datos], { type: r.tipo });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = r.nombre;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    }

    // Panel del profesor: notas por evaluación con conciliación cliente/servidor, y notas finales.
    function panelProfesorSeccion(raiz, seccionId, csrf) {
        var bloque = document.createElement('section');
        bloque.className = 'panel';
        bloque.innerHTML = '<h2>Sección ' + v4().escapar(seccionId) + '</h2><div class="contenido">Cargando…</div>';
        raiz.appendChild(bloque);
        Promise.all([
            v4().llamar('prof.calificaciones_seccion', 'GET', { seccion_id: seccionId }, ''),
            v4().llamar('prof.notas_finales', 'GET', { seccion_id: seccionId }, '')
        ]).then(function (res) {
            var conciliacion = conciliarNotasFinales(res[0], res[1]);
            var filas = conciliacion.map(function (c) {
                return { alumno: c.estudiante_id, cliente: c.cliente, servidor: c.servidor, verificacion: c.coincide ? 'coincide' : 'DIFERENCIA' };
            });
            var columnas = [{ clave: 'alumno', titulo: 'Alumno' }, { clave: 'cliente', titulo: 'Recalculada (cliente)' },
                { clave: 'servidor', titulo: 'Servidor' }, { clave: 'verificacion', titulo: 'Verificación' }];
            bloque.querySelector('.contenido').innerHTML = vistas().tabla(filas, columnas) + vistas().botonesExportar('Notas finales ' + seccionId, filas, columnas);
            bloque.querySelectorAll('[data-exportar]').forEach(function (b) {
                b.addEventListener('click', function () { descargar(vistas().exportarTabla(b.getAttribute('data-exportar'), 'Notas finales ' + seccionId, filas, columnas)); });
            });
        }).catch(function (e) {
            bloque.querySelector('.contenido').innerHTML = '<div class="alerta alerta-error">' + v4().escapar(e.message) + '</div>';
        });
    }

    EC.v4Paneles = {
        conciliarNotasFinales: conciliarNotasFinales,
        conciliarPromedios: conciliarPromedios,
        FORMULARIOS: FORMULARIOS,
        LECTURAS: LECTURAS,
        montarFormularios: montarFormularios,
        montarLecturas: montarLecturas,
        panelProfesorSeccion: panelProfesorSeccion,
        descargar: descargar
    };
})(window);
