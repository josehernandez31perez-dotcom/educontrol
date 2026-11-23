/* js/respaldo.js - Respaldo y recuperación de datos (exportar e importar JSON).
   Formatos:
     - Versión 1: incluye estudiantes, materias, calificaciones y usuarios (con hashes). Sigue siendo importable.
     - Versión 2: exporta estudiantes, materias y calificaciones. NO incluye usuarios ni hashes de contraseñas.
                  Si el archivo no trae usuarios, se conservan los usuarios existentes.
   Solo el rol ADMIN puede exportar o importar.
   Usa las mismas claves de localStorage que storage.js (EC.claves). */
(function (global) {
    'use strict';

    var EC = global.EC = global.EC || {};

    var FORMATO = 'educontrol-respaldo';
    var VERSION_FORMATO = 2;                 // formato que se exporta
    var VERSIONES_ADMITIDAS = [1, 2];        // formatos que se pueden importar
    var TAMANO_MAXIMO = 5 * 1024 * 1024;     // 5 MB
    var COLECCIONES_BASE = ['estudiantes', 'materias', 'calificaciones'];
    var COLECCION_USUARIOS = 'usuarios';
    var COLECCIONES = COLECCIONES_BASE.concat([COLECCION_USUARIOS]);

    // ---------- Utilidades ----------
    function leerColeccion(clave) {
        try {
            var valor = JSON.parse(global.localStorage.getItem(clave));
            return Array.isArray(valor) ? valor : [];
        } catch (error) {
            return [];
        }
    }

    function esObjeto(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
    function esTexto(v) { return typeof v === 'string' && v.trim() !== ''; }
    function esEntero(v) { return Number.isInteger(v) && v > 0; }
    function esFecha(v) { return typeof v === 'string' && !isNaN(Date.parse(v)); }
    function esNota(v) {
        // Número entre 1.0 y 5.0 con a lo sumo un decimal
        return typeof v === 'number' && EC.configuracion.notaEnRango(v) && Math.abs(v * 10 - Math.round(v * 10)) < 1e-9;
    }

    // Solo ADMIN puede exportar o importar respaldos
    function esAdministrador() {
        var sesion = EC.auth && EC.auth.sesion();
        return !!sesion && sesion.rol === 'ADMIN';
    }

    var MENSAJE_NO_AUTORIZADO = 'Acceso no autorizado: solo el administrador puede exportar o importar respaldos.';

    // ---------- Validación de usuarios (solo cuando el archivo los incluye) ----------
    function validarUsuarios(lista, errores) {
        var idsUsuarios = {};
        var nombresUsuario = {};
        var hayAdmin = false;

        lista.forEach(function (u, i) {
            var n = 'Usuarios (registro ' + (i + 1) + ')';
            if (!esObjeto(u)) { errores.push(n + ': no es un objeto válido.'); return; }
            if (!esEntero(u.id)) { errores.push(n + ': "id" debe ser un entero positivo.'); }
            else if (idsUsuarios[u.id]) { errores.push(n + ': el id ' + u.id + ' está repetido.'); }
            else { idsUsuarios[u.id] = true; }
            if (!esTexto(u.nombre_usuario)) { errores.push(n + ': el nombre de usuario es obligatorio.'); }
            else if (nombresUsuario[u.nombre_usuario.trim()]) { errores.push(n + ': el usuario "' + u.nombre_usuario + '" está repetido.'); }
            else { nombresUsuario[u.nombre_usuario.trim()] = true; }
            if (typeof u.password_hash !== 'string' || !/^[0-9a-f]{64}$/.test(u.password_hash)) {
                errores.push(n + ': "password_hash" no tiene el formato esperado (SHA-256 en hexadecimal).');
            }
            if (['ADMIN', 'CONSULTA'].indexOf(u.rol) === -1) { errores.push(n + ': el rol debe ser ADMIN o CONSULTA.'); }
            if (u.rol === 'ADMIN') { hayAdmin = true; }
        });

        if (!lista.length) {
            errores.push('Usuarios: el respaldo debe incluir al menos un usuario.');
        } else if (!hayAdmin) {
            errores.push('Usuarios: debe existir al menos un usuario con rol ADMIN para poder entrar al sistema.');
        }
    }

    // ---------- API del respaldo ----------
    EC.respaldo = {
        // Construye el archivo de respaldo (versión 2: sin usuarios ni hashes)
        crearArchivo: function () {
            if (!esAdministrador()) { throw new Error(MENSAJE_NO_AUTORIZADO); }
            var claves = EC.claves;
            return {
                formato: FORMATO,
                version_formato: VERSION_FORMATO,
                fecha_exportacion: new Date().toISOString(),
                incluye_usuarios: false,
                datos: {
                    estudiantes: leerColeccion(claves.estudiantes),
                    materias: leerColeccion(claves.materias),
                    calificaciones: leerColeccion(claves.calificaciones)
                }
            };
        },

        // Cantidades de registros. usuarios es null si el conjunto no incluye usuarios.
        resumen: function (datos) {
            return {
                estudiantes: datos.estudiantes.length,
                materias: datos.materias.length,
                calificaciones: datos.calificaciones.length,
                usuarios: Array.isArray(datos.usuarios) ? datos.usuarios.length : null
            };
        },

        // Cantidades de los datos actuales en localStorage
        resumenActual: function () {
            var claves = EC.claves;
            return {
                estudiantes: leerColeccion(claves.estudiantes).length,
                materias: leerColeccion(claves.materias).length,
                calificaciones: leerColeccion(claves.calificaciones).length,
                usuarios: leerColeccion(claves.usuarios).length
            };
        },

        // ---------- Lectura del archivo ----------
        leerArchivo: function (archivo) {
            return new Promise(function (resolve, reject) {
                if (!archivo) {
                    reject(new Error('Selecciona un archivo de respaldo (.json).'));
                    return;
                }
                if (archivo.size > TAMANO_MAXIMO) {
                    reject(new Error('El archivo es demasiado grande (máximo 5 MB).'));
                    return;
                }
                var lector = new FileReader();
                lector.onload = function () {
                    try {
                        resolve(JSON.parse(lector.result));
                    } catch (error) {
                        reject(new Error('El archivo no es un JSON válido.'));
                    }
                };
                lector.onerror = function () {
                    reject(new Error('No se pudo leer el archivo.'));
                };
                lector.readAsText(archivo, 'UTF-8');
            });
        },

        // ---------- Validación (no modifica nada) ----------
        // Devuelve una lista de problemas. Lista vacía = el archivo es válido.
        validar: function (obj) {
            var errores = [];

            if (!esObjeto(obj)) {
                return ['El archivo no contiene un respaldo válido de EduControl.'];
            }
            if (obj.formato !== FORMATO) {
                errores.push('El archivo no es un respaldo de EduControl (campo "formato").');
            }
            if (VERSIONES_ADMITIDAS.indexOf(obj.version_formato) === -1) {
                errores.push('La versión del respaldo no es compatible (versiones admitidas: 1 y 2).');
            }
            if (!esObjeto(obj.datos)) {
                errores.push('Falta la sección "datos".');
                return errores;
            }

            // Versión 1 exige usuarios; versión 2 los admite pero no los exige
            var obligatorias = obj.version_formato === 1 ? COLECCIONES : COLECCIONES_BASE;
            obligatorias.forEach(function (c) {
                if (!Array.isArray(obj.datos[c])) {
                    errores.push('Falta la lista "' + c + '" o no es una lista.');
                }
            });
            if (obj.datos[COLECCION_USUARIOS] !== undefined && !Array.isArray(obj.datos[COLECCION_USUARIOS])) {
                errores.push('La lista "usuarios" no es una lista.');
            }
            if (errores.length) { return errores; }

            var d = obj.datos;

            // Estudiantes
            var idsEstudiantes = {};
            var cedulas = {};
            d.estudiantes.forEach(function (e, i) {
                var n = 'Estudiantes (registro ' + (i + 1) + ')';
                if (!esObjeto(e)) { errores.push(n + ': no es un objeto válido.'); return; }
                if (!esEntero(e.id)) { errores.push(n + ': "id" debe ser un entero positivo.'); }
                else if (idsEstudiantes[e.id]) { errores.push(n + ': el id ' + e.id + ' está repetido.'); }
                else { idsEstudiantes[e.id] = true; }
                if (!esTexto(e.cedula) || e.cedula.length > 20) {
                    errores.push(n + ': la cédula es obligatoria y no puede tener más de 20 caracteres.');
                } else if (cedulas[e.cedula.trim().toLowerCase()]) {
                    errores.push(n + ': la cédula ' + e.cedula + ' está repetida.');
                } else {
                    cedulas[e.cedula.trim().toLowerCase()] = true;
                }
                if (!esTexto(e.nombre) || e.nombre.length > 60) { errores.push(n + ': el nombre es obligatorio (máximo 60 caracteres).'); }
                if (!esTexto(e.apellido) || e.apellido.length > 60) { errores.push(n + ': el apellido es obligatorio (máximo 60 caracteres).'); }
                if (EC.estudiantes.ESTADOS.indexOf(e.estado) === -1) { errores.push(n + ': el estado debe ser ' + EC.estudiantes.ESTADOS.join(', ') + '.'); }
                if (!esFecha(e.fecha_registro)) { errores.push(n + ': "fecha_registro" no es una fecha válida.'); }
            });

            // Materias
            var idsMaterias = {};
            var nombresMaterias = {};
            d.materias.forEach(function (m, i) {
                var n = 'Materias (registro ' + (i + 1) + ')';
                if (!esObjeto(m)) { errores.push(n + ': no es un objeto válido.'); return; }
                if (!esEntero(m.id)) { errores.push(n + ': "id" debe ser un entero positivo.'); }
                else if (idsMaterias[m.id]) { errores.push(n + ': el id ' + m.id + ' está repetido.'); }
                else { idsMaterias[m.id] = true; }
                if (!esTexto(m.nombre)) { errores.push(n + ': el nombre es obligatorio.'); }
                else if (nombresMaterias[m.nombre.trim().toLowerCase()]) { errores.push(n + ': la materia "' + m.nombre + '" está repetida.'); }
                else { nombresMaterias[m.nombre.trim().toLowerCase()] = true; }
                if (['ACTIVA', 'INACTIVA'].indexOf(m.estado) === -1) { errores.push(n + ': el estado debe ser ACTIVA o INACTIVA.'); }
            });

            // Calificaciones (deben apuntar a estudiantes y materias existentes)
            var paresCalificaciones = {};
            var idsCalificaciones = {};
            d.calificaciones.forEach(function (c, i) {
                var n = 'Calificaciones (registro ' + (i + 1) + ')';
                if (!esObjeto(c)) { errores.push(n + ': no es un objeto válido.'); return; }
                if (!esEntero(c.id)) { errores.push(n + ': "id" debe ser un entero positivo.'); }
                else if (idsCalificaciones[c.id]) { errores.push(n + ': el id ' + c.id + ' está repetido.'); }
                else { idsCalificaciones[c.id] = true; }
                if (!idsEstudiantes[c.estudiante_id]) { errores.push(n + ': el estudiante_id ' + c.estudiante_id + ' no existe en Estudiantes.'); }
                if (!idsMaterias[c.materia_id]) { errores.push(n + ': el materia_id ' + c.materia_id + ' no existe en Materias.'); }
                var clavePar = c.estudiante_id + '-' + c.materia_id;
                if (paresCalificaciones[clavePar]) { errores.push(n + ': ya existe una calificación de ese estudiante en esa materia.'); }
                paresCalificaciones[clavePar] = true;
                if (!esNota(c.nota)) {
                    var rango = EC.configuracion.obtener();
                    errores.push(n + ': la nota debe estar entre ' + rango.notaMinima.toFixed(1) + ' y ' + rango.notaMaxima.toFixed(1) + ' con un solo decimal.');
                }
                if (!esFecha(c.fecha_registro)) { errores.push(n + ': "fecha_registro" no es una fecha válida.'); }
            });

            // Usuarios: solo si el archivo los trae
            if (Array.isArray(d[COLECCION_USUARIOS])) {
                validarUsuarios(d[COLECCION_USUARIOS], errores);
            }

            return errores;
        },

        // ---------- Importación (solo si la validación pasa) ----------
        importar: function (obj) {
            if (!esAdministrador()) {
                return { ok: false, errores: [MENSAJE_NO_AUTORIZADO] };
            }

            var errores = EC.respaldo.validar(obj);
            if (errores.length) { return { ok: false, errores: errores }; }

            var claves = EC.claves;
            var d = obj.datos;
            var incluyeUsuarios = Array.isArray(d[COLECCION_USUARIOS]);

            // Solo se copian los campos conocidos; así no entran propiedades extra
            var limpio = {
                estudiantes: d.estudiantes.map(function (e) {
                    return { id: e.id, cedula: e.cedula.trim(), nombre: e.nombre.trim(), apellido: e.apellido.trim(),
                             estado: e.estado, fecha_registro: e.fecha_registro };
                }),
                materias: d.materias.map(function (m) {
                    return { id: m.id, nombre: m.nombre.trim(), estado: m.estado };
                }),
                calificaciones: d.calificaciones.map(function (c) {
                    return { id: c.id, estudiante_id: c.estudiante_id, materia_id: c.materia_id,
                             nota: c.nota, fecha_registro: c.fecha_registro };
                })
            };
            if (incluyeUsuarios) {
                limpio.usuarios = d.usuarios.map(function (u) {
                    return { id: u.id, nombre_usuario: u.nombre_usuario.trim(), password_hash: u.password_hash, rol: u.rol };
                });
            }

            // Colecciones que se van a reemplazar. Sin usuarios en el archivo, se conservan los actuales.
            var aEscribir = incluyeUsuarios ? COLECCIONES : COLECCIONES_BASE;

            // Copia del estado anterior para poder deshacer si algo falla al escribir
            var anterior = {};
            aEscribir.forEach(function (c) {
                anterior[claves[c]] = global.localStorage.getItem(claves[c]);
            });

            var escritas = [];
            try {
                aEscribir.forEach(function (c) {
                    global.localStorage.setItem(claves[c], JSON.stringify(limpio[c]));
                    escritas.push(claves[c]);
                });
                return {
                    ok: true,
                    errores: [],
                    usuariosConservados: !incluyeUsuarios,
                    resumen: EC.respaldo.resumen(limpio)
                };
            } catch (error) {
                // Deshacer: solo se restauran las claves que sí se llegaron a escribir
                escritas.forEach(function (clave) {
                    try {
                        if (anterior[clave] === null) {
                            global.localStorage.removeItem(clave);
                        } else {
                            global.localStorage.setItem(clave, anterior[clave]);
                        }
                    } catch (errorRestauracion) {
                        /* si tampoco se puede restaurar, no hay más que hacer aquí */
                    }
                });
                return {
                    ok: false,
                    errores: ['No se pudo guardar el respaldo en este navegador. Los datos anteriores se conservaron.']
                };
            }
        }
    };

    // ---------- Página «Respaldo de datos» ----------
    function nombreArchivo() {
        var f = new Date();
        var p = function (n) { return String(n).padStart(2, '0'); };
        return 'educontrol-respaldo-' + f.getFullYear() + '-' + p(f.getMonth() + 1) + '-' + p(f.getDate()) +
               '-' + p(f.getHours()) + p(f.getMinutes()) + '.json';
    }

    EC.alCargar(function () {
        var btnExportar = document.getElementById('btn-exportar');
        var inputArchivo = document.getElementById('input-respaldo');
        var btnImportar = document.getElementById('btn-importar');
        var infoArchivo = document.getElementById('info-archivo');
        var listaErrores = document.getElementById('lista-errores');
        var archivoSeleccionado = null;

        function mostrarDetalle(errores) {
            if (!listaErrores) { return; }
            var visibles = errores.slice(0, 10).map(function (e) { return '<li>' + EC.esc(e) + '</li>'; }).join('');
            if (errores.length > 10) {
                visibles += '<li>… y ' + (errores.length - 10) + ' problemas más.</li>';
            }
            listaErrores.innerHTML = visibles;
            listaErrores.hidden = false;
        }

        function ocultarDetalle() {
            if (!listaErrores) { return; }
            listaErrores.innerHTML = '';
            listaErrores.hidden = true;
        }

        function comprobarSesion() {
            var sesion = EC.auth.sesion();
            var usuario = sesion ? EC.usuarios.buscarPorNombre(sesion.usuario) : null;
            if (!usuario || usuario.rol !== sesion.rol) {
                // El respaldo cambió los usuarios: la sesión actual ya no es válida
                EC.auth.cerrarSesion();
                global.location.href = (global.EC_BASE || '') + 'login.html?salio=1';
            }
        }

        function textoUsuarios(cantidad) {
            return cantidad === null ? 'usuarios sin cambios' : cantidad + ' usuarios';
        }

        // Exportar (solo ADMIN)
        if (btnExportar) {
            btnExportar.addEventListener('click', function () {
                try {
                    var nombre = nombreArchivo();
                    var contenido = JSON.stringify(EC.respaldo.crearArchivo(), null, 2);
                    var blob = new Blob([contenido], { type: 'application/json' });
                    var url = URL.createObjectURL(blob);
                    var enlace = document.createElement('a');
                    enlace.href = url;
                    enlace.download = nombre;
                    document.body.appendChild(enlace);
                    enlace.click();
                    enlace.remove();
                    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);

                    var r = EC.respaldo.resumenActual();
                    EC.mostrarMensaje('ok', 'Respaldo exportado correctamente (' + nombre + '): ' +
                        r.estudiantes + ' estudiantes, ' + r.materias + ' materias y ' +
                        r.calificaciones + ' calificaciones. Las contraseñas no se incluyen.');
                } catch (error) {
                    EC.mostrarMensaje('error', error.message || 'No se pudo exportar el respaldo. Inténtalo de nuevo.');
                }
            });
        }

        // Seleccionar archivo para importar
        if (inputArchivo) {
            inputArchivo.addEventListener('change', function () {
                archivoSeleccionado = inputArchivo.files[0] || null;
                ocultarDetalle();
                if (btnImportar) { btnImportar.disabled = !archivoSeleccionado; }
                if (infoArchivo) {
                    infoArchivo.textContent = archivoSeleccionado
                        ? 'Archivo seleccionado: ' + archivoSeleccionado.name + ' (' + Math.max(1, Math.round(archivoSeleccionado.size / 1024)) + ' KB)'
                        : 'Ningún archivo seleccionado.';
                }
            });
        }

        // Importar (solo ADMIN)
        if (btnImportar) {
            btnImportar.addEventListener('click', function () {
                if (!archivoSeleccionado) { return; }
                ocultarDetalle();

                if (!esAdministrador()) {
                    EC.mostrarMensaje('error', MENSAJE_NO_AUTORIZADO);
                    return;
                }

                EC.respaldo.leerArchivo(archivoSeleccionado).then(function (obj) {
                    var errores = EC.respaldo.validar(obj);
                    if (errores.length) {
                        EC.mostrarMensaje('error', 'El archivo no es un respaldo válido. No se modificó ningún dato.');
                        mostrarDetalle(errores);
                        return;
                    }

                    var actual = EC.respaldo.resumenActual();
                    var nuevo = EC.respaldo.resumen(obj.datos);
                    var confirmacion =
                        'Esta acción REEMPLAZARÁ los datos actuales de EduControl.\n\n' +
                        'Datos actuales: ' + actual.estudiantes + ' estudiantes, ' + actual.materias + ' materias, ' +
                        actual.calificaciones + ' calificaciones y ' + actual.usuarios + ' usuarios.\n' +
                        'Datos del archivo: ' + nuevo.estudiantes + ' estudiantes, ' + nuevo.materias + ' materias, ' +
                        nuevo.calificaciones + ' calificaciones y ' + textoUsuarios(nuevo.usuarios) + '.\n\n' +
                        '¿Deseas continuar?';

                    if (!global.confirm(confirmacion)) {
                        EC.mostrarMensaje('info', 'Importación cancelada. No se modificó ningún dato.');
                        return;
                    }

                    var resultado = EC.respaldo.importar(obj);
                    if (!resultado.ok) {
                        EC.mostrarMensaje('error', resultado.errores[0]);
                        return;
                    }

                    var mensajeUsuarios = resultado.usuariosConservados
                        ? ' Los usuarios actuales se conservaron.'
                        : '';
                    EC.mostrarMensaje('ok', 'Respaldo importado correctamente: ' + resultado.resumen.estudiantes +
                        ' estudiantes, ' + resultado.resumen.materias + ' materias y ' +
                        resultado.resumen.calificaciones + ' calificaciones.' + mensajeUsuarios);

                    if (inputArchivo) { inputArchivo.value = ''; }
                    archivoSeleccionado = null;
                    btnImportar.disabled = true;
                    if (infoArchivo) { infoArchivo.textContent = 'Ningún archivo seleccionado.'; }

                    comprobarSesion();
                }).catch(function (error) {
                    EC.mostrarMensaje('error', error.message || 'No se pudo importar el archivo.');
                });
            });
        }
    });
})(window);
