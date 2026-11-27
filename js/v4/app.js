/* js/v4/app.js - Arranque de la interfaz v4: identifica el rol con el SERVIDOR y monta el panel correspondiente.
   NO PROBADO en navegador. El rol de la pantalla es solo presentación: la autorización está en la base y en PHP. */
(function (global) {
    'use strict';
    var EC = global.EC;
    var csrfActual = '';
    function csrf() { return csrfActual; }

    function cabecera(ctx) {
        var h = document.getElementById('cabecera');
        h.innerHTML = '<span>' + EC.v4.escapar(ctx.usuario) + ' · ' + EC.v4.escapar(ctx.rol) + '</span> ' +
            '<button type="button" class="btn btn-secundario" id="btn-salir">Cerrar sesión</button>';
        document.getElementById('btn-salir').addEventListener('click', function () {
            EC.v4.llamar('logout', 'POST', {}, csrfActual).finally(function () { global.location.href = 'login.html'; });
        });
    }

    function panelAlumno(raiz) {
        EC.v4Paneles.montarLecturas(raiz, EC.v4Paneles.LECTURAS.alumno);
        // Conciliación de promedios: el servidor es la autoridad; el cliente recalcula desde las notas finales.
        var bloque = document.createElement('section');
        bloque.className = 'panel';
        bloque.innerHTML = '<h2>Verificación de promedios</h2><div class="contenido">Cargando…</div>';
        raiz.appendChild(bloque);
        Promise.all([EC.v4.llamar('alum.mis_finales', 'GET', {}, ''), EC.v4.llamar('alum.promedios', 'GET', {}, '')])
            .then(function (r) {
                var filas = EC.v4Paneles.conciliarPromedios(r[0], r[1]).map(function (c) {
                    return { periodo: c.periodo_id, cliente: c.cliente, servidor: c.servidor, verificacion: c.coincide ? 'coincide' : 'DIFERENCIA' };
                });
                bloque.querySelector('.contenido').innerHTML = EC.vistas.tabla(filas, [
                    { clave: 'periodo', titulo: 'Período' }, { clave: 'cliente', titulo: 'Recalculado' },
                    { clave: 'servidor', titulo: 'Servidor' }, { clave: 'verificacion', titulo: 'Verificación' }]);
            }).catch(function (e) {
                bloque.querySelector('.contenido').innerHTML = '<div class="alerta alerta-error">' + EC.v4.escapar(e.message) + '</div>';
            });
    }

    function panelProfesor(raiz) {
        EC.v4Paneles.montarLecturas(raiz, EC.v4Paneles.LECTURAS.profesor);
        EC.v4Paneles.montarFormularios(raiz, EC.v4Paneles.FORMULARIOS.profesor, csrf);
        EC.v4.llamar('prof.mis_secciones', 'GET', {}, '').then(function (secciones) {
            secciones.forEach(function (s) { EC.v4Paneles.panelProfesorSeccion(raiz, s.seccion_id, csrf); });
        }).catch(function () { /* el error ya se muestra en la lectura de secciones */ });
    }

    function panelAdmin(raiz) {
        EC.v4Paneles.montarFormularios(raiz, EC.v4Paneles.FORMULARIOS.admin, csrf);
        EC.v4Paneles.montarLecturas(raiz, EC.v4Paneles.LECTURAS.admin);
    }

    function arrancar() {
        EC.v4.llamar('contexto', 'GET', {}, '').then(function (ctx) {
            csrfActual = ctx.csrf;
            cabecera({ usuario: ctx.usuario, rol: ctx.rol });
            var raiz = document.getElementById('raiz');
            if (ctx.rol === 'ADMIN') { panelAdmin(raiz); }
            else if (ctx.rol === 'PROFESOR') { panelProfesor(raiz); }
            else if (ctx.rol === 'ALUMNO') { panelAlumno(raiz); }
            else { raiz.innerHTML = '<p>Su rol no tiene panel en esta versión.</p>'; }
        }).catch(function () { global.location.href = 'login.html?expirada=1'; });
    }

    document.addEventListener('DOMContentLoaded', arrancar);
})(window);
