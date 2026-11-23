/* js/storage.js - Datos de EduControl guardados en localStorage.
   Reemplaza las consultas SQL y las validaciones que antes estaban en PHP. */
(function (global) {
    'use strict';

    var EC = global.EC = global.EC || {};

    var CLAVES = {
        estudiantes: 'educontrol_estudiantes',
        materias: 'educontrol_materias',
        calificaciones: 'educontrol_calificaciones',
        usuarios: 'educontrol_usuarios',
        version: 'educontrol_version_datos'
    };

    // Si cambias los datos iniciales, sube este número para volver a cargarlos.
    var VERSION_DATOS = '1';

    // Nombres de las claves de localStorage (los usa el módulo de respaldo)
    EC.claves = CLAVES;

    function leer(clave) {
        try {
            var valor = JSON.parse(global.localStorage.getItem(clave));
            return Array.isArray(valor) ? valor : [];
        } catch (error) {
            return [];
        }
    }

    function guardar(clave, lista) {
        global.localStorage.setItem(clave, JSON.stringify(lista));
    }

    function siguienteId(lista) {
        var mayor = 0;
        lista.forEach(function (item) {
            if (item.id > mayor) { mayor = item.id; }
        });
        return mayor + 1;
    }

    function normalizar(texto) {
        return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    }

    function redondear(valor) {
        return Math.round(valor * 100) / 100;
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

    // Escapa texto antes de insertarlo en HTML
    EC.esc = function (valor) {
        return String(valor === null || valor === undefined ? '' : valor)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };

    // Búsqueda sin tildes ni mayúsculas (la usan estudiantes y estadísticas)
    EC.normalizarTexto = normalizar;

    // Carga los datos de prueba del proyecto (Carlos Gómez NO se incluye)
    EC.inicializarDatos = function () {
        if (global.localStorage.getItem(CLAVES.version) === VERSION_DATOS) { return; }

        guardar(CLAVES.estudiantes, [
            { id: 1, cedula: '8-100-100', nombre: 'Ana', apellido: 'Pérez', estado: 'ACTIVO', fecha_registro: '2026-10-01T09:00:00' },
            { id: 3, cedula: '8-300-300', nombre: 'Lucía', apellido: 'Martínez', estado: 'ACTIVO', fecha_registro: '2026-10-01T09:05:00' },
            { id: 4, cedula: '8-400-400', nombre: 'Miguel', apellido: 'Rojas', estado: 'ACTIVO', fecha_registro: '2026-10-01T09:10:00' }
        ]);

        guardar(CLAVES.materias, [
            { id: 1, nombre: 'Matemáticas', estado: 'ACTIVA' },
            { id: 2, nombre: 'Español', estado: 'ACTIVA' },
            { id: 3, nombre: 'Ciencias Naturales', estado: 'ACTIVA' },
            { id: 4, nombre: 'Ciencias Sociales', estado: 'ACTIVA' },
            { id: 5, nombre: 'Inglés', estado: 'ACTIVA' }
        ]);

        guardar(CLAVES.calificaciones, [
            { id: 1, estudiante_id: 1, materia_id: 1, nota: 4.5, fecha_registro: '2026-10-01T10:00:00' },
            { id: 2, estudiante_id: 1, materia_id: 2, nota: 4.0, fecha_registro: '2026-10-01T10:00:00' },
            { id: 3, estudiante_id: 1, materia_id: 3, nota: 3.8, fecha_registro: '2026-10-01T10:00:00' },
            { id: 4, estudiante_id: 1, materia_id: 4, nota: 4.2, fecha_registro: '2026-10-01T10:00:00' },
            { id: 5, estudiante_id: 1, materia_id: 5, nota: 4.6, fecha_registro: '2026-10-01T10:00:00' },
            { id: 6, estudiante_id: 3, materia_id: 1, nota: 3.0, fecha_registro: '2026-10-01T10:05:00' },
            { id: 7, estudiante_id: 3, materia_id: 2, nota: 3.0, fecha_registro: '2026-10-01T10:05:00' },
            { id: 8, estudiante_id: 3, materia_id: 3, nota: 3.0, fecha_registro: '2026-10-01T10:05:00' },
            { id: 9, estudiante_id: 3, materia_id: 4, nota: 3.0, fecha_registro: '2026-10-01T10:05:00' },
            { id: 10, estudiante_id: 3, materia_id: 5, nota: 3.0, fecha_registro: '2026-10-01T10:05:00' }
        ]);

        // Usuarios de demostración. Solo se guarda el hash SHA-256 de cada contraseña.
        guardar(CLAVES.usuarios, [
            { id: 1, nombre_usuario: 'admin', password_hash: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', rol: 'ADMIN' },
            { id: 2, nombre_usuario: 'consulta', password_hash: '7fa95c704c2defa7b1295d28bcddfd752bf9b594db18886dd64721183cfc47a5', rol: 'CONSULTA' }
        ]);

        global.localStorage.setItem(CLAVES.version, VERSION_DATOS);
    };

    // ---------- Usuarios ----------
    EC.usuarios = {
        buscarPorNombre: function (nombre) {
            return leer(CLAVES.usuarios).filter(function (u) { return u.nombre_usuario === nombre; })[0] || null;
        }
    };

    // ---------- Estudiantes ----------
    EC.estudiantes = {
        ESTADOS: ['ACTIVO', 'INACTIVO', 'RETIRADO', 'GRADUADO'],

        // Clase CSS de la insignia de cada estado
        claseInsignia: function (estado) {
            var clases = { ACTIVO: 'badge-activo', INACTIVO: 'badge-inactivo', RETIRADO: 'badge-retirado', GRADUADO: 'badge-graduado' };
            return clases[estado] || 'badge-inactivo';
        },

        listar: function () {
            return leer(CLAVES.estudiantes).slice().sort(compararNombre);
        },

        obtener: function (id) {
            return leer(CLAVES.estudiantes).filter(function (e) { return e.id === Number(id); })[0] || null;
        },

        // Estudiantes ACTIVOS, más el que ya esté seleccionado (aunque esté inactivo)
        paraSelect: function (idActual) {
            return EC.estudiantes.listar().filter(function (e) {
                return e.estado === 'ACTIVO' || e.id === Number(idActual);
            });
        },

        // Búsqueda parcial por cédula, nombre o apellido, sin distinguir mayúsculas ni tildes
        buscar: function (termino) {
            var texto = normalizar(termino).trim();
            if (!texto) { return EC.estudiantes.listar(); }
            return EC.estudiantes.listar().filter(function (e) {
                return normalizar(e.cedula).indexOf(texto) !== -1 ||
                       normalizar(e.nombre).indexOf(texto) !== -1 ||
                       normalizar(e.apellido).indexOf(texto) !== -1;
            });
        },

        validar: function (datos, idExcluir) {
            var limpio = {
                cedula: String(datos.cedula || '').trim(),
                nombre: String(datos.nombre || '').trim(),
                apellido: String(datos.apellido || '').trim(),
                estado: String(datos.estado || 'ACTIVO')
            };
            var errores = {};

            if (limpio.cedula === '') {
                errores.cedula = 'La cédula es obligatoria.';
            } else if (limpio.cedula.length > 20) {
                errores.cedula = 'La cédula no puede tener más de 20 caracteres.';
            } else {
                var duplicada = leer(CLAVES.estudiantes).some(function (e) {
                    return e.id !== idExcluir && e.cedula.toLowerCase() === limpio.cedula.toLowerCase();
                });
                if (duplicada) { errores.cedula = 'Ya existe un estudiante con esa cédula.'; }
            }

            if (limpio.nombre === '') {
                errores.nombre = 'El nombre es obligatorio.';
            } else if (limpio.nombre.length > 60) {
                errores.nombre = 'El nombre no puede tener más de 60 caracteres.';
            }

            if (limpio.apellido === '') {
                errores.apellido = 'El apellido es obligatorio.';
            } else if (limpio.apellido.length > 60) {
                errores.apellido = 'El apellido no puede tener más de 60 caracteres.';
            }

            if (EC.estudiantes.ESTADOS.indexOf(limpio.estado) === -1) {
                errores.estado = 'El estado seleccionado no es válido.';
            }

            return { datos: limpio, errores: errores };
        },

        crear: function (datos) {
            var resultado = EC.estudiantes.validar(datos, 0);
            if (Object.keys(resultado.errores).length) { return { ok: false, errores: resultado.errores }; }

            var lista = leer(CLAVES.estudiantes);
            lista.push(Object.assign({ id: siguienteId(lista), fecha_registro: new Date().toISOString() }, resultado.datos));
            guardar(CLAVES.estudiantes, lista);
            return { ok: true, errores: {} };
        },

        actualizar: function (id, datos) {
            id = Number(id);
            var resultado = EC.estudiantes.validar(datos, id);
            if (Object.keys(resultado.errores).length) { return { ok: false, errores: resultado.errores }; }

            var lista = leer(CLAVES.estudiantes).map(function (e) {
                return e.id === id ? Object.assign({}, e, resultado.datos) : e;
            });
            guardar(CLAVES.estudiantes, lista);
            return { ok: true, errores: {} };
        },

        // Elimina también sus calificaciones (equivale a ON DELETE CASCADE)
        eliminar: function (id) {
            id = Number(id);
            var lista = leer(CLAVES.estudiantes);
            var nueva = lista.filter(function (e) { return e.id !== id; });
            if (nueva.length === lista.length) { return false; }

            guardar(CLAVES.estudiantes, nueva);
            guardar(CLAVES.calificaciones, leer(CLAVES.calificaciones).filter(function (c) {
                return c.estudiante_id !== id;
            }));
            return true;
        }
    };

    // ---------- Materias ----------
    EC.materias = {
        listar: function () {
            return leer(CLAVES.materias).slice().sort(function (a, b) {
                return a.nombre.localeCompare(b.nombre, 'es');
            });
        },
        obtener: function (id) {
            return leer(CLAVES.materias).filter(function (m) { return m.id === Number(id); })[0] || null;
        },
        paraSelect: function (idActual) {
            return EC.materias.listar().filter(function (m) {
                return m.estado === 'ACTIVA' || m.id === Number(idActual);
            });
        }
    };

    // ---------- Calificaciones ----------
    EC.calificaciones = {
        obtener: function (id) {
            return leer(CLAVES.calificaciones).filter(function (c) { return c.id === Number(id); })[0] || null;
        },

        // Equivale a la vista v_calificaciones_detalle
        listarDetalle: function () {
            var estudiantes = leer(CLAVES.estudiantes);
            var materias = leer(CLAVES.materias);
            return leer(CLAVES.calificaciones).map(function (c) {
                var est = estudiantes.filter(function (e) { return e.id === c.estudiante_id; })[0] || {};
                var mat = materias.filter(function (m) { return m.id === c.materia_id; })[0] || {};
                return {
                    id: c.id,
                    estudiante_id: c.estudiante_id,
                    cedula: est.cedula || '',
                    nombre: est.nombre || '',
                    apellido: est.apellido || '',
                    materia_id: c.materia_id,
                    materia: mat.nombre || '',
                    nota: Number(c.nota),
                    fecha_registro: c.fecha_registro
                };
            }).sort(function (a, b) {
                return (a.apellido + ' ' + a.nombre).localeCompare(b.apellido + ' ' + b.nombre, 'es') ||
                       a.materia.localeCompare(b.materia, 'es');
            });
        },

        validar: function (datos, idExcluir) {
            var limpio = {
                estudiante_id: Number(datos.estudiante_id) || 0,
                materia_id: Number(datos.materia_id) || 0,
                nota: String(datos.nota === null || datos.nota === undefined ? '' : datos.nota).replace(',', '.').trim()
            };
            var errores = {};

            if (limpio.estudiante_id <= 0) {
                errores.estudiante_id = 'Selecciona un estudiante.';
            } else if (!EC.estudiantes.obtener(limpio.estudiante_id)) {
                errores.estudiante_id = 'El estudiante seleccionado no existe.';
            }

            if (limpio.materia_id <= 0) {
                errores.materia_id = 'Selecciona una materia.';
            } else if (!EC.materias.obtener(limpio.materia_id)) {
                errores.materia_id = 'La materia seleccionada no existe.';
            }

            // Nota: un solo decimal y entre 1.0 y 5.0 (igual que DECIMAL(2,1) y el CHECK de MySQL)
            if (limpio.nota === '') {
                errores.nota = 'La nota es obligatoria.';
            } else if (!/^\d(\.\d)?$/.test(limpio.nota)) {
                errores.nota = 'Escribe la nota con un solo decimal, por ejemplo 3.5.';
            } else if (!EC.configuracion.notaEnRango(Number(limpio.nota))) {
                var rango = EC.configuracion.obtener();
                errores.nota = 'La nota debe estar entre ' + rango.notaMinima.toFixed(1) + ' y ' + rango.notaMaxima.toFixed(1) + '.';
            }

            if (!errores.estudiante_id && !errores.materia_id) {
                var duplicada = leer(CLAVES.calificaciones).some(function (c) {
                    return c.id !== idExcluir && c.estudiante_id === limpio.estudiante_id && c.materia_id === limpio.materia_id;
                });
                if (duplicada) {
                    errores.materia_id = 'Este estudiante ya tiene una calificación registrada para esta materia.';
                }
            }

            limpio.nota = errores.nota ? limpio.nota : Number(limpio.nota);
            return { datos: limpio, errores: errores };
        },

        crear: function (datos) {
            var resultado = EC.calificaciones.validar(datos, 0);
            if (Object.keys(resultado.errores).length) { return { ok: false, errores: resultado.errores }; }

            var lista = leer(CLAVES.calificaciones);
            lista.push({
                id: siguienteId(lista),
                estudiante_id: resultado.datos.estudiante_id,
                materia_id: resultado.datos.materia_id,
                nota: resultado.datos.nota,
                fecha_registro: new Date().toISOString()
            });
            guardar(CLAVES.calificaciones, lista);
            return { ok: true, errores: {} };
        },

        actualizar: function (id, datos) {
            id = Number(id);
            var resultado = EC.calificaciones.validar(datos, id);
            if (Object.keys(resultado.errores).length) { return { ok: false, errores: resultado.errores }; }

            var lista = leer(CLAVES.calificaciones).map(function (c) {
                return c.id === id ? Object.assign({}, c, resultado.datos) : c;
            });
            guardar(CLAVES.calificaciones, lista);
            return { ok: true, errores: {} };
        },

        eliminar: function (id) {
            id = Number(id);
            var lista = leer(CLAVES.calificaciones);
            var nueva = lista.filter(function (c) { return c.id !== id; });
            if (nueva.length === lista.length) { return false; }
            guardar(CLAVES.calificaciones, nueva);
            return true;
        }
    };

    // ---------- Cálculos académicos ----------
    EC.calculos = {
        // Promedio de un estudiante a partir de sus notas (null si no tiene notas)
        promedioDeEstudiante: function (id) {
            var notas = leer(CLAVES.calificaciones)
                .filter(function (c) { return c.estudiante_id === Number(id); })
                .map(function (c) { return Number(c.nota); });
            if (!notas.length) { return null; }
            var suma = notas.reduce(function (a, b) { return a + b; }, 0);
            return redondear(suma / notas.length);
        },

        // Regla: promedio >= nota de aprobación APROBADO; si no, REPROBADO; sin notas SIN NOTAS
        estadoAcademico: function (promedio) {
            if (promedio === null || promedio === undefined) { return 'SIN NOTAS'; }
            return EC.configuracion.aprueba(promedio) ? 'APROBADO' : 'REPROBADO';
        },

        // Equivale a la vista v_resumen_estudiantes (incluye a todos los estudiantes)
        resumen: function () {
            return leer(CLAVES.estudiantes).map(function (e) {
                var notas = leer(CLAVES.calificaciones).filter(function (c) { return c.estudiante_id === e.id; });
                var promedio = EC.calculos.promedioDeEstudiante(e.id);
                return {
                    id: e.id,
                    cedula: e.cedula,
                    nombre: e.nombre,
                    apellido: e.apellido,
                    estado: e.estado,
                    cantidad: notas.length,
                    promedio: promedio,
                    estado_academico: EC.calculos.estadoAcademico(promedio)
                };
            }).sort(ordenarRanking);
        },

        resumenDeEstudiante: function (id) {
            return EC.calculos.resumen().filter(function (r) { return r.id === Number(id); })[0] || null;
        },

        notasDeEstudiante: function (id) {
            return EC.calificaciones.listarDetalle().filter(function (c) {
                return c.estudiante_id === Number(id);
            });
        },

        // Búsqueda por cédula, nombre o apellido, sin distinguir mayúsculas ni tildes
        buscar: function (termino) {
            var t = normalizar(termino).trim();
            if (!t) { return EC.calculos.resumen(); }
            return EC.calculos.resumen().filter(function (r) {
                return normalizar(r.cedula).indexOf(t) !== -1 ||
                       normalizar(r.nombre).indexOf(t) !== -1 ||
                       normalizar(r.apellido).indexOf(t) !== -1;
            });
        },

        // Totales, mejor/menor promedio y ranking (los sin notas no cuentan para mejor/menor)
        estadisticas: function () {
            var resumen = EC.calculos.resumen();
            var conNotas = resumen.filter(function (r) { return r.promedio !== null; });
            var suma = conNotas.reduce(function (a, r) { return a + r.promedio; }, 0);
            var menor = conNotas.slice().sort(function (a, b) {
                return (a.promedio - b.promedio) || compararNombre(a, b);
            })[0] || null;

            return {
                totalEstudiantes: resumen.length,
                totalMaterias: leer(CLAVES.materias).length,
                aprobados: resumen.filter(function (r) { return r.estado_academico === 'APROBADO'; }).length,
                reprobados: resumen.filter(function (r) { return r.estado_academico === 'REPROBADO'; }).length,
                sinNotas: resumen.length - conNotas.length,
                promedioGeneral: conNotas.length ? redondear(suma / conNotas.length) : null,
                mejor: conNotas[0] || null,
                menor: menor,
                ranking: conNotas,
                sinNotasLista: resumen.filter(function (r) { return r.promedio === null; })
            };
        }
    };

    EC.inicializarDatos();
})(window);
