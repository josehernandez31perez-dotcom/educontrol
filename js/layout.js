/* js/layout.js - Menú, sesión, permisos por rol, mensajes e impresión comunes a todas las páginas */
(function (global) {
    'use strict';

    var EC = global.EC = global.EC || {};
    var CLAVE_FLASH = 'educontrol_flash';
    var pendientes = [];
    var listo = false;
    var permitido = false;

    var MENU = [
        { texto: 'Dashboard', icono: '🏠', ruta: 'index.html', seccion: 'dashboard' },
        { texto: 'Estudiantes', icono: '👨‍🎓', ruta: 'estudiantes/index.html', seccion: 'estudiantes' },
        { texto: 'Calificaciones', icono: '📚', ruta: 'calificaciones/index.html', seccion: 'calificaciones' },
        { texto: 'Estadísticas', icono: '📊', ruta: 'estadisticas/index.html', seccion: 'estadisticas' },
        { texto: 'Reportes', icono: '📄', ruta: 'reportes/index.html', seccion: 'reportes' }
    ];

    // Las páginas ejecutan su código solo cuando la sesión y el rol son válidos
    EC.alCargar = function (fn) {
        if (listo) {
            if (permitido) { fn(); }
        } else {
            pendientes.push(fn);
        }
    };

    // Navega a una ruta relativa a la raíz del proyecto (ej. 'estudiantes/index.html')
    EC.irA = function (ruta) {
        global.location.href = (global.EC_BASE || '') + ruta;
    };

    // Guarda un mensaje para mostrarlo en la página siguiente (equivale al antiguo patrón redirect + ?ok=)
    EC.guardarFlash = function (tipo, texto) {
        global.sessionStorage.setItem(CLAVE_FLASH, JSON.stringify({ tipo: tipo, texto: texto }));
    };

    EC.mostrarMensaje = function (tipo, texto) {
        var zona = document.getElementById('mensajes');
        if (!zona) { return; }
        var clase = tipo === 'ok' ? 'alerta-ok' : (tipo === 'info' ? 'alerta-info' : 'alerta-error');
        zona.innerHTML = '<div class="alerta ' + clase + '" role="' + (tipo === 'error' ? 'alert' : 'status') + '"></div>';
        zona.firstChild.textContent = texto;
    };

    EC.formato = {
        promedio: function (valor) {
            return valor === null || valor === undefined ? '—' : Number(valor).toFixed(2);
        },
        nota: function (valor) {
            return Number(valor).toFixed(1);
        }
    };

    EC.fecha = function (iso, conHora) {
        var fecha = new Date(iso);
        if (isNaN(fecha.getTime())) { return '—'; }
        var p = function (n) { return String(n).padStart(2, '0'); };
        var texto = p(fecha.getDate()) + '/' + p(fecha.getMonth() + 1) + '/' + fecha.getFullYear();
        return conHora ? texto + ' ' + p(fecha.getHours()) + ':' + p(fecha.getMinutes()) : texto;
    };

    EC.badge = function (estado) {
        var clase = estado === 'APROBADO' ? 'badge-aprobado' : (estado === 'REPROBADO' ? 'badge-reprobado' : 'badge-sin-notas');
        return '<span class="badge ' + clase + '">' + EC.esc(estado) + '</span>';
    };

    EC.badgeActivo = function (estado) {
        return '<span class="badge ' + (estado === 'ACTIVO' ? 'badge-activo' : 'badge-inactivo') + '">' + EC.esc(estado) + '</span>';
    };

    function renderizarMenu(sesion) {
        var aside = document.getElementById('sidebar');
        if (!aside) { return; }
        var base = global.EC_BASE || '';
        var seccion = document.body.dataset.seccion || '';

        var enlaces = MENU.map(function (item) {
            return '<a class="menu-link' + (item.seccion === seccion ? ' activo' : '') + '" href="' + base + item.ruta + '">' +
                   '<span class="menu-icono" aria-hidden="true">' + item.icono + '</span><span>' + EC.esc(item.texto) + '</span></a>';
        }).join('');

        aside.innerHTML =
            '<div class="marca"><span class="logo" aria-hidden="true">🎓</span><div><strong>EduControl</strong>' +
            '<small>Sistema Web de Gestión Académica y Calificaciones</small></div></div>' +
            '<nav class="menu">' + enlaces +
            '<button type="button" class="menu-link menu-salir" id="btn-cerrar-sesion">' +
            '<span class="menu-icono" aria-hidden="true">🚪</span><span>Cerrar sesión</span></button></nav>' +
            '<div class="usuario-box"><span>Usuario conectado</span><strong>' + EC.esc(sesion.usuario) +
            '</strong><small>Rol: ' + EC.esc(sesion.rol) + '</small></div>';

        document.getElementById('btn-cerrar-sesion').addEventListener('click', function () {
            EC.auth.cerrarSesion();
            global.location.href = base + 'login.html?salio=1';
        });
    }

    function mostrarFlash() {
        var texto = global.sessionStorage.getItem(CLAVE_FLASH);
        if (!texto) { return; }
        global.sessionStorage.removeItem(CLAVE_FLASH);
        try {
            var mensaje = JSON.parse(texto);
            EC.mostrarMensaje(mensaje.tipo, mensaje.texto);
        } catch (error) {
            /* mensaje dañado: se ignora */
        }
    }

    function iniciar() {
        var body = document.body;
        var base = global.EC_BASE || '';
        var sesion = EC.auth.sesion();

        listo = true;

        if (!sesion || !sesion.usuario) {
            global.location.href = base + 'login.html';
            return;
        }

        renderizarMenu(sesion);

        // Página que requiere un rol concreto (por ejemplo ADMIN)
        var rolRequerido = body.dataset.rol;
        if (rolRequerido && rolRequerido !== sesion.rol) {
            var contenido = document.getElementById('contenido-pagina');
            if (contenido) {
                contenido.innerHTML =
                    '<section class="panel"><div class="alerta alerta-error" role="alert">' +
                    'No tienes permiso para realizar esta acción. Tu rol permite únicamente consultar la información.' +
                    '</div><a class="btn btn-secundario" href="' + base + 'index.html">Volver al Dashboard</a></section>';
            }
            permitido = false;
            return;
        }

        // Ocultar acciones de modificación a quien no es ADMIN (la página también las valida)
        if (sesion.rol !== 'ADMIN') {
            document.querySelectorAll('[data-solo-admin]').forEach(function (el) {
                el.parentNode.removeChild(el);
            });
        }

        mostrarFlash();
        permitido = true;
        pendientes.forEach(function (fn) { fn(); });
    }

    // Botón de impresión: usa la función del navegador (Guardar como PDF)
    document.addEventListener('click', function (evento) {
        if (evento.target.closest && evento.target.closest('[data-imprimir]')) {
            global.print();
        }
    });

    document.addEventListener('DOMContentLoaded', iniciar);
})(window);
