/* Pruebas de los estados del estudiante (ACTIVO, INACTIVO, RETIRADO, GRADUADO) y de la búsqueda sin tildes. */
const { crearEntorno, copia, probador } = require('./helpers');
const t = probador();
const { EC, sesion } = crearEntorno();
sesion('admin', 'ADMIN');

console.log('== Estados ==');
t.afirmar('la lista de estados incluye RETIRADO y GRADUADO', ['ACTIVO', 'INACTIVO', 'RETIRADO', 'GRADUADO'].every(e => EC.estudiantes.ESTADOS.includes(e)));
const datosBase = { cedula: '8-500-500', nombre: 'Carla', apellido: 'Soto' };
t.afirmar('se puede registrar un estudiante RETIRADO', EC.estudiantes.crear({ ...datosBase, estado: 'RETIRADO' }).ok);
t.afirmar('se puede registrar un estudiante GRADUADO', EC.estudiantes.crear({ ...datosBase, cedula: '8-600-600', estado: 'GRADUADO' }).ok);
t.afirmar('un estado desconocido sigue rechazado', !EC.estudiantes.crear({ ...datosBase, cedula: '8-700-700', estado: 'DESCONOCIDO' }).ok);
const ana = EC.estudiantes.listar().find(e => e.nombre === 'Ana');
t.afirmar('actualizar a GRADUADO funciona', EC.estudiantes.actualizar(ana.id, { ...ana, estado: 'GRADUADO' }).ok);
t.afirmar('la insignia de RETIRADO usa su clase', EC.estudiantes.claseInsignia('RETIRADO') === 'badge-retirado');
t.afirmar('la insignia de GRADUADO usa su clase', EC.estudiantes.claseInsignia('GRADUADO') === 'badge-graduado');
t.afirmar('la insignia de ACTIVO sigue igual', EC.estudiantes.claseInsignia('ACTIVO') === 'badge-activo');

console.log('== Calificaciones para estudiantes no activos ==');
const retirada = EC.estudiantes.listar().find(e => e.nombre === 'Carla');
t.afirmar('un estudiante RETIRADO no aparece para registrar notas nuevas', !EC.estudiantes.paraSelect(0).some(e => e.id === retirada.id));

console.log('== Respaldo con nuevos estados ==');
const exportado = EC.respaldo.crearArchivo();
t.afirmar('el respaldo con RETIRADO y GRADUADO es válido', EC.respaldo.validar(copia(exportado)).length === 0, EC.respaldo.validar(exportado));
const malo = copia(exportado); malo.datos.estudiantes[0].estado = 'OTRO';
t.afirmar('el respaldo con un estado inválido es rechazado', EC.respaldo.validar(malo).some(e => e.includes('el estado debe ser')));

console.log('== Búsqueda sin tildes ==');
t.afirmar('normalizar quita tildes y mayúsculas', EC.normalizarTexto('Lucía PÉREZ') === 'lucia perez');
t.afirmar('buscar "lucia" encuentra a Lucía (estudiantes)', EC.estudiantes.buscar('lucia').some(e => e.nombre === 'Lucía'));
t.afirmar('buscar "perez" encuentra a Pérez (estudiantes)', EC.estudiantes.buscar('perez').some(e => e.apellido === 'Pérez'));
t.afirmar('buscar "LUCIA" encuentra a Lucía (estadísticas)', EC.calculos.buscar('LUCIA').some(r => r.nombre === 'Lucía'));
t.afirmar('buscar "pérez" encuentra a Pérez (estadísticas)', EC.calculos.buscar('pérez').some(r => r.apellido === 'Pérez'));
t.afirmar('buscar por cédula parcial funciona (estadísticas)', EC.calculos.buscar('300-300').some(r => r.nombre === 'Lucía'));
t.afirmar('buscar texto vacío devuelve todos', EC.calculos.buscar('').length === EC.calculos.resumen().length);
t.afirmar('buscar algo inexistente devuelve lista vacía', EC.calculos.buscar('zzzz').length === 0);

t.terminar();
