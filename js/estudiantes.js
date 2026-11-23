/* js/estudiantes.js - Listado de estudiantes desde MySQL (api/listar_estudiantes.php).
   La búsqueda se hace sobre los datos ya cargados. Los botones Ver, Editar y Eliminar
   conservan su diseño, pero todavía no ejecutan acciones sobre MySQL (ver mensajes). */
(function () {
    'use strict';
    var EC = window.EC;

    var URL_LISTADO = '../api/listar_estudiantes.php';
    var MENSAJE_ERROR_CONEXION = 'No se pudo conectar con la base de datos. Verifica que Apache y MySQL estén iniciados en XAMPP.';
    var MENSAJE_PENDIENTE = 'Esta acción todavía no está conectada a MySQL. No se modificó ningún dato.';

    EC.alCargar(function () {
        var esAdmin = EC.auth.sesion().rol === 'ADMIN';
        var buscador = document.getElementById('buscador');
        var contador = document.getElementById('contador');
        var zona = document.getElementById('tabla-estudiantes');

        var estudiantes = [];
        var cargando = true;
        var errorCarga = false;

        // MySQL devuelve "2026-10-01 09:00:00"; JavaScript necesita "2026-10-01T09:00:00"
        function normalizarRegistro(r) {
            return {
                id: Number(r.id),
                cedula: String(r.cedula),
                nombre: String(r.nombre),
                apellido: String(r.apellido),
                estado: String(r.estado),
                fecha_registro: typeof r.fecha_registro === 'string' ? r.fecha_registro.replace(' ', 'T') : ''
            };
        }

        function filtrar(termino) {
            var t = EC.normalizarTexto(termino).trim();
            if (!t) { return estudiantes; }
            return estudiantes.filter(function (e) {
                return EC.normalizarTexto(e.cedula).indexOf(t) !== -1 ||
                       EC.normalizarTexto(e.nombre).indexOf(t) !== -1 ||
                       EC.normalizarTexto(e.apellido).indexOf(t) !== -1;
            });
        }

        function pintar() {
            if (cargando) {
                contador.textContent = '';
                zona.innerHTML = '<p class="vacio">Cargando estudiantes…</p>';
                return;
            }

            if (errorCarga) {
                contador.textContent = 'Estudiantes registrados: no disponible';
                zona.innerHTML = '<div class="alerta alerta-error" role="alert">' + EC.esc(MENSAJE_ERROR_CONEXION) + '</div>' +
                    '<button type="button" class="btn btn-secundario" id="btn-reintentar">Reintentar</button>';
                return;
            }

            var termino = buscador.value.trim();
            var lista = filtrar(termino);
            contador.textContent = 'Estudiantes registrados: ' + lista.length + (termino ? ' (búsqueda)' : '');

            if (!lista.length) {
                zona.innerHTML = termino
                    ? '<p class="vacio">No se encontraron estudiantes para «' + EC.esc(termino) + '».</p>'
                    : '<p class="vacio">Todavía no hay estudiantes registrados.</p>';
                return;
            }

            var filas = lista.map(function (e) {
                var acciones = '<button type="button" class="btn btn-pequeno btn-secundario btn-ver" data-id="' + e.id + '">Ver</button>';
                if (esAdmin) {
                    acciones += ' <button type="button" class="btn btn-pequeno btn-secundario btn-editar" data-id="' + e.id + '">Editar</button>' +
                        ' <button type="button" class="btn btn-pequeno btn-peligro btn-eliminar" data-id="' + e.id + '">Eliminar</button>';
                }
                return '<tr><td>' + e.id + '</td><td>' + EC.esc(e.cedula) + '</td><td>' + EC.esc(e.nombre) +
                    '</td><td>' + EC.esc(e.apellido) + '</td><td>' + EC.fecha(e.fecha_registro) + '</td><td>' +
                    EC.badgeActivo(e.estado) + '</td><td class="acciones">' + acciones + '</td></tr>';
            }).join('');

            zona.innerHTML = '<div class="tabla-contenedor"><table class="tabla"><thead><tr>' +
                '<th>ID</th><th>Cédula</th><th>Nombre</th><th>Apellido</th><th>Fecha de registro</th><th>Estado</th><th>Acciones</th>' +
                '</tr></thead><tbody>' + filas + '</tbody></table></div>';
        }

        // Carga asíncrona desde MySQL
        function cargarEstudiantes() {
            cargando = true;
            errorCarga = false;
            pintar();

            return fetch(URL_LISTADO, { cache: 'no-store', headers: { 'Accept': 'application/json' } })
                .then(function (respuesta) {
                    if (!respuesta.ok) { throw new Error('HTTP ' + respuesta.status); }
                    return respuesta.json();
                })
                .then(function (datos) {
                    if (!Array.isArray(datos)) { throw new Error('Respuesta inesperada'); }
                    // Mismo orden que antes: apellido y nombre (la consulta de la API no ordena)
                    estudiantes = datos.map(normalizarRegistro).sort(function (a, b) {
                        return (a.apellido + ' ' + a.nombre).localeCompare(b.apellido + ' ' + b.nombre, 'es');
                    });
                    errorCarga = false;
                })
                .catch(function () {
                    estudiantes = [];
                    errorCarga = true;
                    EC.mostrarMensaje('error', MENSAJE_ERROR_CONEXION);
                })
                .then(function () {
                    cargando = false;
                    pintar();
                });
        }

        buscador.addEventListener('input', pintar);

        zona.addEventListener('click', function (evento) {
            if (evento.target.closest('#btn-reintentar')) {
                cargarEstudiantes();
                return;
            }
            if (evento.target.closest('.btn-ver') || evento.target.closest('.btn-editar') || evento.target.closest('.btn-eliminar')) {
                EC.mostrarMensaje('info', MENSAJE_PENDIENTE);
            }
        });

        cargarEstudiantes();
    });
})();
