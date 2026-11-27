/* js/datos-mysql.js - Adaptador de SOLO LECTURA para la fuente MySQL (Etapa D).
   Lee los endpoints existentes (listar_estudiantes, listar_materias, listar_calificaciones),
   convierte los tipos (MySQL devuelve números y fechas como texto) y calcula con
   EC.calculosAcademicos, igual que la versión local. Solo hace peticiones GET y no escribe datos.
   Solo se usa cuando EC.fuente es 'mysql'. La configuración sigue siendo local (EC.configuracion). */
(function (global) {
    'use strict';

    var EC = global.EC = global.EC || {};

    var MENSAJE_CONEXION = 'No se pudo conectar con la base de datos. Verifica que Apache y MySQL estén iniciados en XAMPP.';

    function errorConexion() {
        var error = new Error(MENSAJE_CONEXION);
        error.mensajeUsuario = MENSAJE_CONEXION;
        return error;
    }

    function errorSesion() {
        var error = new Error('La sesión ha caducado.');
        error.sesionCaducada = true;
        return error;
    }

    // MySQL devuelve "2026-10-01 09:00:00"; JavaScript necesita "2026-10-01T09:00:00"
    function fechaIso(valor) {
        return valor ? String(valor).replace(' ', 'T') : '';
    }

    // Misma regla de aprobación que la versión local
    function aprobar(valor) {
        return EC.configuracion.aprueba(valor);
    }

    // Convierte las filas de la API a la misma forma que usa la versión local y las ordena igual
    function normalizarEstudiantes(filas) {
        return filas.map(function (r) {
            return {
                id: Number(r.id),
                cedula: String(r.cedula),
                nombre: String(r.nombre),
                apellido: String(r.apellido),
                estado: String(r.estado),
                fecha_registro: fechaIso(r.fecha_registro)
            };
        }).sort(EC.calculosAcademicos.compararNombre);
    }

    function construir(filasEstudiantes, filasMaterias, filasCalificaciones) {
        var estudiantes = normalizarEstudiantes(filasEstudiantes);

        var materias = filasMaterias.map(function (r) {
            return { id: Number(r.id), nombre: String(r.nombre), estado: String(r.estado) };
        }).sort(function (a, b) {
            return a.nombre.localeCompare(b.nombre, 'es');
        });

        var calificaciones = filasCalificaciones.map(function (r) {
            return {
                id: Number(r.id),
                estudiante_id: Number(r.estudiante_id),
                cedula: String(r.cedula),
                nombre: String(r.nombre),
                apellido: String(r.apellido),
                materia_id: Number(r.materia_id),
                materia: String(r.materia),
                nota: Number(r.nota),
                fecha_registro: fechaIso(r.fecha_registro)
            };
        }).sort(function (a, b) {
            return (a.apellido + ' ' + a.nombre).localeCompare(b.apellido + ' ' + b.nombre, 'es') ||
                   a.materia.localeCompare(b.materia, 'es');
        });

        return { estudiantes: estudiantes, materias: materias, calificaciones: calificaciones };
    }

    // Crea el adaptador. Las opciones son para pruebas (fetch, base, alCaducarSesion).
    function crearAdaptadorMysql(opciones) {
        var o = opciones || {};
        var pedir = o.fetch || function (url, init) { return global.fetch(url, init); };
        var base = o.base !== undefined ? o.base : (global.EC_BASE || '');
        var alCaducar = o.alCaducarSesion || function () {
            global.location.href = base + 'login.html?expirada=1';
        };
        var cache = null;
        var cacheEstudiantes = null;

        // Solo peticiones GET a los listados existentes
        function pedirListado(nombre) {
            return pedir(base + 'api/' + nombre, {
                method: 'GET',
                cache: 'no-store',
                credentials: 'same-origin',
                headers: { 'Accept': 'application/json' }
            }).then(function (respuesta) {
                if (respuesta.status === 401) {
                    alCaducar();
                    throw errorSesion();
                }
                if (!respuesta.ok) { throw errorConexion(); }
                return respuesta.json();
            }).then(function (datos) {
                if (!Array.isArray(datos)) { throw errorConexion(); }
                return datos;
            }, function (error) {
                if (error && error.sesionCaducada) { throw error; }
                throw errorConexion();
            });
        }

        // Una sola lectura de los tres listados por instancia; si falla, la siguiente operación vuelve a intentarlo
        function cargar() {
            if (!cache) {
                cache = Promise.all([
                    pedirListado('listar_estudiantes.php'),
                    pedirListado('listar_materias.php'),
                    pedirListado('listar_calificaciones.php')
                ]).then(function (r) {
                    return construir(r[0], r[1], r[2]);
                }, function (error) {
                    cache = null;
                    throw error;
                });
            }
            return cache;
        }

        // Listado de estudiantes: una sola petición (la pantalla de estudiantes no necesita materias ni calificaciones)
        function cargarEstudiantes() {
            if (!cacheEstudiantes) {
                cacheEstudiantes = pedirListado('listar_estudiantes.php').then(normalizarEstudiantes, function (error) {
                    cacheEstudiantes = null;
                    throw error;
                });
            }
            return cacheEstudiantes;
        }

        function operacion(calcular) {
            return function () {
                var args = Array.prototype.slice.call(arguments);
                return cargar().then(function (datos) {
                    return calcular.apply(null, [datos].concat(args));
                });
            };
        }

        function resumen(datos) {
            return EC.calculosAcademicos.resumen(datos.estudiantes, datos.calificaciones, aprobar);
        }

        return {
            estudiantes: function () {
                return cargarEstudiantes().then(function (lista) { return lista.slice(); });
            },
            estudiantePorId: operacion(function (d, id) {
                return d.estudiantes.filter(function (e) { return e.id === Number(id); })[0] || null;
            }),
            materias: operacion(function (d) { return d.materias.slice(); }),
            calificacionesDetalle: operacion(function (d) { return d.calificaciones.slice(); }),
            resumen: operacion(function (d) { return resumen(d); }),
            estadisticas: operacion(function (d) {
                return EC.calculosAcademicos.estadisticas(resumen(d), d.materias.length);
            }),
            buscar: operacion(function (d, termino) {
                return EC.calculosAcademicos.buscar(resumen(d), termino);
            }),
            resumenDeEstudiante: operacion(function (d, id) {
                return EC.calculosAcademicos.resumenDeEstudiante(resumen(d), id);
            }),
            notasDeEstudiante: operacion(function (d, id) {
                return EC.calculosAcademicos.notasDeEstudiante(d.calificaciones, id);
            }),
            promedioDeEstudiante: operacion(function (d, id) {
                return EC.calculosAcademicos.promedioDeEstudiante(d.calificaciones, id);
            }),
            // La configuración sigue siendo local en esta etapa
            configuracion: function () {
                return Promise.resolve().then(function () { return EC.configuracion.obtener(); });
            }
        };
    }

    EC.crearAdaptadorMysql = crearAdaptadorMysql;
})(window);
