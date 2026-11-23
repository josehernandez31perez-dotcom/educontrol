/* Pruebas de la configuración de escala y nota de aprobación. */
const { crearEntorno, probador } = require('./helpers');
const t = probador();
const { EC, almacen, sesion, sinSesion } = crearEntorno();

console.log('== Valores iniciales ==');
const inicial = EC.configuracion.obtener();
t.afirmar('escala inicial 1.0 a 5.0', inicial.notaMinima === 1.0 && inicial.notaMaxima === 5.0);
t.afirmar('aprobación inicial 3.0', inicial.notaAprobacion === 3.0);
t.afirmar('la nota 3.0 aprueba', EC.configuracion.aprueba(3.0));
t.afirmar('la nota 2.9 no aprueba', !EC.configuracion.aprueba(2.9));

console.log('== Validación de valores ==');
const invalida = c => EC.configuracion.validar(c).length > 0;
t.afirmar('mínimo mayor que máximo rechazado', invalida({ notaMinima: 5, notaMaxima: 1, notaAprobacion: 3 }));
t.afirmar('mínimo igual a máximo rechazado', invalida({ notaMinima: 3, notaMaxima: 3, notaAprobacion: 3 }));
t.afirmar('aprobación fuera de la escala rechazada', invalida({ notaMinima: 1, notaMaxima: 5, notaAprobacion: 5.5 }));
t.afirmar('dos decimales rechazados', invalida({ notaMinima: 1, notaMaxima: 5, notaAprobacion: 3.25 }));
t.afirmar('mínimo cero rechazado', invalida({ notaMinima: 0, notaMaxima: 5, notaAprobacion: 3 }));
t.afirmar('máximo mayor que 10 rechazado', invalida({ notaMinima: 1, notaMaxima: 11, notaAprobacion: 3 }));
t.afirmar('valores válidos aceptados', !invalida({ notaMinima: 0.5, notaMaxima: 10, notaAprobacion: 6 }));

console.log('== Permisos ==');
sesion('consulta', 'CONSULTA');
let r = EC.configuracion.guardar({ notaMinima: 1, notaMaxima: 5, notaAprobacion: 4 });
t.afirmar('CONSULTA no puede cambiar la configuración', !r.ok && /no autorizado/.test(r.errores[0]));
t.afirmar('la configuración no cambió tras el intento', EC.configuracion.obtener().notaAprobacion === 3.0);
sinSesion();
r = EC.configuracion.guardar({ notaMinima: 1, notaMaxima: 5, notaAprobacion: 4 });
t.afirmar('sin sesión no se puede cambiar', !r.ok);

console.log('== Cambio de configuración por ADMIN ==');
sesion('admin', 'ADMIN');
// Estudiante con promedio 3.5 y nota 3.5 antes del cambio
const idMax = EC.estudiantes.listar()[0].id;
t.afirmar('con aprobación 3.0 el promedio de Ana (4.22) es APROBADO', EC.calculos.estadoAcademico(4.22) === 'APROBADO');
r = EC.configuracion.guardar({ notaMinima: 1, notaMaxima: 5, notaAprobacion: 4.5 });
t.afirmar('ADMIN guarda la nueva configuración', r.ok);
t.afirmar('con aprobación 4.5 el promedio 4.22 pasa a REPROBADO', EC.calculos.estadoAcademico(4.22) === 'REPROBADO');
t.afirmar('la nota 4.6 aprueba con la nueva aprobación', EC.configuracion.aprueba(4.6));

console.log('== Escala de notas ==');
EC.configuracion.guardar({ notaMinima: 1, notaMaxima: 4, notaAprobacion: 3 });
const nota = EC.calificaciones.validar({ estudiante_id: idMax, materia_id: 1, nota: '4.5' }, 0);
t.afirmar('con escala máxima 4.0 la nota 4.5 es rechazada', !!nota.errores.nota && nota.errores.nota.includes('4.0'));
t.afirmar('con escala máxima 4.0 la nota 4.0 es aceptada', !EC.calificaciones.validar({ estudiante_id: idMax, materia_id: 1, nota: '4.0' }, 0).errores.nota);

console.log('== Restablecer y configuración dañada ==');
r = EC.configuracion.restablecer();
t.afirmar('restablecer vuelve a 1.0 a 5.0 y aprobación 3.0', r.ok && EC.configuracion.obtener().notaMaxima === 5.0 && EC.configuracion.obtener().notaAprobacion === 3.0);
almacen['educontrol_configuracion'] = '{"notaMinima": "uno"}';
t.afirmar('configuración guardada dañada usa valores iniciales', EC.configuracion.obtener().notaAprobacion === 3.0);
almacen['educontrol_configuracion'] = 'no es json';
t.afirmar('configuración con JSON inválido usa valores iniciales', EC.configuracion.obtener().notaMaxima === 5.0);

t.terminar();
