/* js/datos.js - Capa de acceso a datos de EduControl.
   Todas las pantallas leen a través de EC.datos (funciones que devuelven promesas).
   La fuente 'local' envuelve las funciones actuales de storage.js y calculos.js.
   La fuente 'mysql' usa el adaptador de solo lectura de datos-mysql.js (Etapa D).
   Ninguna función de esta capa escribe datos. */
(function (global) {
    'use strict';

    var EC = global.EC = global.EC || {};

    var MENSAJE_NO_DISPONIBLE = 'La fuente MySQL todavía no está activada en esta versión.';

    // Operaciones que debe ofrecer cualquier fuente (local o remota)
    var OPERACIONES = [
        'estudiantes',
        'estudiantePorId',
        'materias',
        'calificacionesDetalle',
        'resumen',
        'estadisticas',
        'buscar',
        'resumenDeEstudiante',
        'notasDeEstudiante',
        'promedioDeEstudiante',
        'configuracion'
    ];

    // Envuelve una función síncrona en una promesa: los errores se convierten en rechazos
    function enPromesa(fn) {
        return function () {
            var args = arguments;
            return new Promise(function (resolver) {
                resolver(fn.apply(null, args));
            });
        };
    }

    // Adaptador de la fuente local (datos del navegador)
    function crearAdaptadorLocal() {
        return {
            estudiantes: enPromesa(function () { return EC.estudiantes.listar(); }),
            estudiantePorId: enPromesa(function (id) { return EC.estudiantes.obtener(id); }),
            materias: enPromesa(function () { return EC.materias.listar(); }),
            calificacionesDetalle: enPromesa(function () { return EC.calificaciones.listarDetalle(); }),
            resumen: enPromesa(function () { return EC.calculos.resumen(); }),
            estadisticas: enPromesa(function () { return EC.calculos.estadisticas(); }),
            buscar: enPromesa(function (termino) { return EC.calculos.buscar(termino); }),
            resumenDeEstudiante: enPromesa(function (id) { return EC.calculos.resumenDeEstudiante(id); }),
            notasDeEstudiante: enPromesa(function (id) { return EC.calculos.notasDeEstudiante(id); }),
            promedioDeEstudiante: enPromesa(function (id) { return EC.calculos.promedioDeEstudiante(id); }),
            configuracion: enPromesa(function () { return EC.configuracion.obtener(); })
        };
    }

    // Adaptador para una fuente que no está disponible: rechaza todas las operaciones
    function crearAdaptadorNoDisponible() {
        var adaptador = {};
        OPERACIONES.forEach(function (nombre) {
            adaptador[nombre] = function () {
                return Promise.reject(new Error(MENSAJE_NO_DISPONIBLE));
            };
        });
        return adaptador;
    }

    // Crea un acceso a datos para una fuente.
    // remoto: adaptador opcional para 'mysql' (por ejemplo, el de datos-mysql.js).
    function crearAccesoDatos(fuente, remoto) {
        if (EC.fuentesValidas.indexOf(fuente) === -1) {
            throw new Error('Fuente de datos no válida: ' + fuente);
        }

        var adaptador;
        if (fuente === 'local') {
            adaptador = crearAdaptadorLocal();
        } else if (remoto) {
            OPERACIONES.forEach(function (nombre) {
                if (typeof remoto[nombre] !== 'function') {
                    throw new Error('El adaptador remoto no implementa: ' + nombre);
                }
            });
            adaptador = remoto;
        } else {
            adaptador = crearAdaptadorNoDisponible();
        }

        var acceso = { fuente: fuente };
        OPERACIONES.forEach(function (nombre) {
            acceso[nombre] = adaptador[nombre];
        });
        return Object.freeze(acceso);
    }

    // Texto que se muestra cuando una lectura falla
    EC.mensajeDeError = function (error) {
        return (error && error.mensajeUsuario) || 'No se pudieron cargar los datos.';
    };

    // Muestra «Cargando…», después el resultado, o un error con botón «Reintentar».
    // obtener() devuelve una promesa; pintar(datos) dibuja el resultado.
    EC.cargarVista = function (contenedor, obtener, pintar) {
        function intentar() {
            contenedor.innerHTML = '<p class="vacio">Cargando datos…</p>';
            obtener().then(function (datos) {
                pintar(datos);
            }, function (error) {
                if (error && error.sesionCaducada) { return; }
                contenedor.innerHTML = '<div class="alerta alerta-error" role="alert">' + EC.esc(EC.mensajeDeError(error)) + '</div>' +
                    '<button type="button" class="btn btn-secundario" id="btn-reintentar">Reintentar</button>';
            });
        }

        // Un solo escuchador por contenedor, aunque la vista se vuelva a cargar
        contenedor._ecReintentar = intentar;
        if (!contenedor._ecEscuchando) {
            contenedor._ecEscuchando = true;
            contenedor.addEventListener('click', function (evento) {
                if (evento.target && evento.target.id === 'btn-reintentar' && contenedor._ecReintentar) {
                    contenedor._ecReintentar();
                }
            });
        }

        intentar();
    };

    EC.crearAccesoDatos = crearAccesoDatos;
    // Con fuente 'mysql' se usa el adaptador de solo lectura si datos-mysql.js está cargado
    EC.datos = crearAccesoDatos(EC.fuente, EC.crearAdaptadorMysql ? EC.crearAdaptadorMysql() : null);
})(window);
