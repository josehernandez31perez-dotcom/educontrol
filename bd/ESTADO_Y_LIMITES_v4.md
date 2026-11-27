# Estado de la Etapa E · copia acumulada v4

Este documento distingue **lo construido y probado**, **lo construido sin poder probarlo** y **lo que no se ha hecho**.
No se afirma nada que no esté en la primera columna.

| Pieza | Estado | Cómo se comprobó |
|---|---|---|
| Cálculo de nota final (aritmética entera, NO APLICA, pendientes) | Hecho y probado | `tests/academico.test.js` (28 comprobaciones) y mutaciones |
| Promedios y rankings por período, sin mezcla con histórico | Hecho y probado | `tests/academico.test.js` |
| Visibilidad por rol (ALUMNO sin rankings; PROFESOR por sección) | Hecho y probado, **solo en el cliente** | `tests/academico.test.js` |
| Exportación CSV | Hecho y probado | `tests/exportar.test.js` |
| Exportación XLSX (Office Open XML) | Hecho y probado, validado con `zipfile` y `minidom` de Python | `tests/exportar.test.js` + `tests/validacion_externa/validar_exportacion.py` |
| Exportación PDF (texto) | Hecho y probado: `xref` correcto, paginación | `tests/exportar.test.js`. No se ha abierto con un lector de PDF real. |
| Compatibilidad con etapas A–D | Verificada por la suite | 557 comprobaciones correctas, 0 fallidas |
| Modelo de identidad v4 | **Especificado**, no implementado | `bd/SEGURIDAD_IDENTIDAD_v4.md` |
| Procedimientos SQL de la v3 y de la v4 | **Especificados**, no creados | Sin MariaDB no se pueden probar |
| `sesiones_app`, `fn_usuario_de_sesion` | **Especificados** | Sin MariaDB |
| Endpoints PHP de cuentas, notas, cierre, reapertura | **No implementados** | Sin PHP no se pueden probar |
| `login.php` y `auth.php` con token | **No implementados** | Sin PHP |
| Paneles de ADMIN, PROFESOR y ALUMNO | **No implementados** | Requieren el backend |
| Reportes individual, por materia, grupo, período y general (UI) | **No implementados**. Los cálculos y la exportación existen. | Pendiente de integrar en las pantallas |
| Botones de exportar en pantallas | **No implementados** | Pendiente |
| Evaluaciones, notas por evaluación, observaciones | **No implementadas** (tablas especificadas en la v3) | Pendiente |
| Migración de la base real | **No ejecutada, no autorizada** | Ver plan de instalación |

## Por qué no se completa la Etapa E en esta ejecución

1. **No hay PHP ni MariaDB en el entorno.** Todo lo que toca un endpoint, un procedimiento o una tabla no puede probarse aquí.
   Escribirlo sin probarlo daría la falsa impresión de un sistema terminado. Por eso no se ha hecho.
2. **Instalar la base de datos y crear cuentas** requiere tu autorización expresa, y tus instrucciones lo prohíben.
3. **Cambiar `login.php` y `auth.php`** afecta a la seguridad de toda la aplicación. Se ha especificado, con justificación,
   pero no implementado sin poder probarlo.

## Qué falta para completar la Etapa E (en orden)

1. Un entorno con PHP 8.2.12 y MariaDB 10.4.32 (XAMPP de prueba, separado de la instalación real).
2. Crear las bases de prueba con datos sintéticos y ejecutar G1–G14, M0–M11, A-TX1–A-23, P1–P15 de `PROPUESTA_E1_v3`.
3. Implementar `sesiones_app` y los procedimientos con la firma de la v4, y probar A1–A12.
4. Implementar los endpoints PHP y probar cada caso de la matriz de la v3.
5. Implementar las pantallas por rol y su integración con `EC.academico` y `EC.exportar`.
6. Ejecutar la suite y las pruebas de integración en la copia de prueba.

## Archivos creados en esta ejecución (frente a la copia de partida)

- `js/academico.js`: cálculos académicos (nota final, NO APLICA, pendientes, promedios por ámbito, rankings, visibilidad).
- `js/exportar.js`: CSV, XLSX y PDF sin dependencias externas.
- `tests/academico.test.js` (28), `tests/exportar.test.js` (20).
- `tests/validacion_externa/validar_exportacion.py`: validación con Python, independiente del generador.
- `bd/SEGURIDAD_IDENTIDAD_v4.md`: corrección de identidad y matriz de ataques.
- `bd/ESTADO_Y_LIMITES_v4.md`: este documento.

**Archivos modificados: ninguno.** Verificado con `diff`: `api/`, todos los `js/` de etapas anteriores, todas las pruebas previas
y todas las páginas HTML son idénticos a la copia de partida.

## Resultados reales de las pruebas

- `node tests/run.js`: **557 comprobaciones correctas, 0 fallidas**, en 20 archivos.
- Mutaciones sobre `js/academico.js` (redondeo, rankings para alumnos, aislamiento): **las tres se detectan**; el archivo se restauró idéntico.
- `python3 tests/validacion_externa/validar_exportacion.py`: **OK** (XLSX con CRC y XML válidos; PDF con 3 páginas y `xref` correcto).

## Instrucciones para probar

```
cd educontrol_prueba_AB
node tests/run.js                              # suite completa (requiere Node 22 para node:sqlite)
python3 tests/validacion_externa/validar_exportacion.py   # validación de XLSX y PDF
```

Las pruebas de cálculos y exportación no necesitan PHP, MariaDB ni red. Las pruebas de SQL (`bd/`) siguen siendo
de modelo y estáticas: no sustituyen a la ejecución en MariaDB.

## Plan de instalación y migración (NO ejecutado; requiere autorización expresa)

**Prerrequisitos:** PHP 8.2.12 y MariaDB 10.4.32 en un entorno de **prueba** separado de la instalación real.

1. **Entorno de prueba.** Crear `educontrol_pruebas_compat` y `educontrol_pruebas` con datos sintéticos. Nunca `educontrol`.
2. **Compatibilidad.** Ejecutar G1–G14 de `PROPUESTA_E1_v3` y registrar la salida real.
3. **Migración en la copia de prueba.** M0–M11 de `PROPUESTA_E1_v3`, con el nombre del índice único devuelto por la consulta de solo lectura (no escrito a mano).
4. **Procedimientos y sesiones.** Crear `sesiones_app`, `fn_usuario_de_sesion` y los procedimientos con la firma de la v4. Probar A1–A12 y A-TX1–A-23.
5. **Permisos.** Crear las cuentas en la copia de prueba y ejecutar P1–P15.
6. **Backend PHP.** Implementar `login.php` y `auth.php` con token, y los endpoints. Probar cada fila de la matriz de §2.3 de `PROPUESTA_E1_v3`.
7. **Integración.** Pantallas por rol, reportes y botones de exportación. Probar con datos sintéticos.
8. **Instalación real.** Solo con tu autorización expresa, una copia de seguridad verificada, y en este orden: consulta de solo lectura del índice, migración, creación de cuentas, despliegue del código.
9. **Verificación posterior.** Repetir la suite y las consultas de control de §8.3 de `PROPUESTA_E1_v3` (cuentas sin perfil).

**Reversión:** `03b` y `03a` de `bd/`, solo sobre la copia de prueba. Sobre la base real, la vuelta atrás es la copia de seguridad.
