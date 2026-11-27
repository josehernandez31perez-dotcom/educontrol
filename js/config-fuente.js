/* js/config-fuente.js - Fuente de datos de EduControl.
   La fuente se define en el código, no en localStorage ni en una preferencia del navegador.
   Valor actual: 'local' (datos del navegador, comportamiento anterior).
   Para activar MySQL en una etapa posterior, se cambiará aquí y se revisará con pruebas.
   EC.fuente es de solo lectura: no puede cambiarse desde la consola ni desde otros scripts. */
(function (global) {
    'use strict';

    var EC = global.EC = global.EC || {};

    var FUENTE_ACTUAL = 'local';
    var FUENTES_VALIDAS = ['local', 'mysql'];

    Object.defineProperty(EC, 'fuente', {
        value: FUENTE_ACTUAL,
        writable: false,
        enumerable: true,
        configurable: false
    });

    EC.fuentesValidas = FUENTES_VALIDAS.slice();
})(window);
