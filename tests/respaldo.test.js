/* Pruebas del respaldo: acceso solo ADMIN, formato 2 sin hashes, compatibilidad con versión 1 y reversión. */
const { crearEntorno, copia, probador } = require('./helpers');
const t = probador();

const { EC, almacen, fallarEn, sesion, sinSesion } = crearEntorno();
const estadoBase = () => [EC.claves.estudiantes, EC.claves.materias, EC.claves.calificaciones].map(k => almacen[k]).join('|');
const usuariosActuales = () => almacen[EC.claves.usuarios];

console.log('== Exportación ==');
sesion('admin', 'ADMIN');
const exportado = EC.respaldo.crearArchivo();
const texto = JSON.stringify(exportado);
t.afirmar('ADMIN puede exportar', exportado.datos.estudiantes.length === 3);
t.afirmar('formato exportado es versión 2', exportado.version_formato === 2);
t.afirmar('el archivo no contiene usuarios', !('usuarios' in exportado.datos));
t.afirmar('el archivo no contiene hashes', !/password_hash|[0-9a-f]{64}/.test(texto));
t.afirmar('el archivo exportado es válido', EC.respaldo.validar(copia(exportado)).length === 0);

sesion('consulta', 'CONSULTA');
let bloqueado = false;
try { EC.respaldo.crearArchivo(); } catch (e) { bloqueado = /no autorizado/.test(e.message); }
t.afirmar('CONSULTA no puede exportar', bloqueado);

sinSesion();
bloqueado = false;
try { EC.respaldo.crearArchivo(); } catch (e) { bloqueado = true; }
t.afirmar('sin sesión no se puede exportar', bloqueado);

console.log('== Importación v2 sin usuarios ==');
sesion('admin', 'ADMIN');
const usuariosAntes = usuariosActuales();
const v2 = copia(exportado);
v2.datos.estudiantes.push({ id: 9, cedula: '8-900-900', nombre: 'Nuevo', apellido: 'Alumno', estado: 'ACTIVO', fecha_registro: '2026-10-02T08:00:00' });
let r = EC.respaldo.importar(v2);
t.afirmar('importación v2 sin usuarios se realiza', r.ok && EC.estudiantes.listar().length === 4);
t.afirmar('usuarios existentes se conservan', usuariosActuales() === usuariosAntes);
t.afirmar('la respuesta indica usuarios conservados', r.usuariosConservados === true);

console.log('== Permisos en importación ==');
sesion('consulta', 'CONSULTA');
const antesCons = estadoBase();
r = EC.respaldo.importar(copia(v2));
t.afirmar('CONSULTA no puede importar', !r.ok && /no autorizado/.test(r.errores[0]));
t.afirmar('CONSULTA no cambia datos', estadoBase() === antesCons);

console.log('== Compatibilidad con versión 1 ==');
sesion('admin', 'ADMIN');
const v1 = {
    formato: 'educontrol-respaldo', version_formato: 1, fecha_exportacion: '2026-10-01T10:00:00Z',
    datos: {
        estudiantes: [{ id: 1, cedula: '8-100-100', nombre: 'Ana', apellido: 'Pérez', estado: 'ACTIVO', fecha_registro: '2026-10-01T09:00:00' }],
        materias: [{ id: 1, nombre: 'Matemáticas', estado: 'ACTIVA' }],
        calificaciones: [{ id: 1, estudiante_id: 1, materia_id: 1, nota: 4.5, fecha_registro: '2026-10-01T10:00:00' }],
        usuarios: [
            { id: 1, nombre_usuario: 'admin', password_hash: 'a'.repeat(64), rol: 'ADMIN' },
            { id: 2, nombre_usuario: 'profe', password_hash: 'b'.repeat(64), rol: 'CONSULTA' }
        ]
    }
};
r = EC.respaldo.importar(copia(v1));
t.afirmar('archivo v1 con usuarios se importa', r.ok);
t.afirmar('v1 reemplaza usuarios', EC.usuarios.buscarPorNombre('profe') !== null);
const v1SinUsuarios = copia(v1); delete v1SinUsuarios.datos.usuarios;
t.afirmar('v1 sin usuarios sigue rechazado', EC.respaldo.validar(v1SinUsuarios).some(e => e.includes('usuarios')));

console.log('== Validación ==');
const v3 = copia(exportado); v3.version_formato = 3;
t.afirmar('versión 3 rechazada', EC.respaldo.validar(v3).some(e => e.includes('no es compatible')));
const hashMalo = copia(v1); hashMalo.datos.usuarios[0].password_hash = 'texto-plano';
t.afirmar('hash mal formado rechazado', EC.respaldo.validar(hashMalo).some(e => e.includes('password_hash')));

console.log('== Reversión ==');
sesion('admin', 'ADMIN');
const antesFallo = estadoBase();
fallarEn(EC.claves.calificaciones);
r = EC.respaldo.importar(copia(v2));
fallarEn(null);
t.afirmar('fallo de escritura devuelve error claro', !r.ok && r.errores[0].includes('Los datos anteriores se conservaron'));
t.afirmar('fallo de escritura restaura datos', estadoBase() === antesFallo);

t.terminar();
