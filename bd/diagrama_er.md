# Diagrama entidad-relación · EduControl · Etapa E (Parte 1)

Tablas existentes (sin cambios de estructura, salvo lo indicado) y tablas nuevas.
Las cardinalidades siguen la notación de Mermaid: `||` uno, `o|` cero o uno, `o{` cero o muchos, `|{` uno o muchos.

```mermaid
erDiagram
    USUARIOS ||--|| PROFESORES : "una cuenta por profesor"
    USUARIOS |o--o| ESTUDIANTES : "vínculo opcional (rol ALUMNO)"
    ESTUDIANTES ||--o{ CALIFICACIONES : "tiene (CASCADE)"
    MATERIAS ||--o{ CALIFICACIONES : "tiene (RESTRICT)"
    MATERIAS ||--o{ SECCIONES : "se imparte en"
    PERIODOS_ACADEMICOS ||--o{ SECCIONES : "agrupa"
    PROFESORES ||--o{ PROFESOR_SECCION : "imparte"
    SECCIONES ||--o{ PROFESOR_SECCION : "tiene profesores"
    ESTUDIANTES ||--o{ ESTUDIANTE_SECCION : "cursa"
    SECCIONES ||--o{ ESTUDIANTE_SECCION : "tiene alumnos"

    USUARIOS {
        int id PK
        varchar nombre_usuario UK
        varchar password
        enum rol "ADMIN, PROFESOR, ALUMNO (v4; CONSULTA retirado)"
    }
    ESTUDIANTES {
        int id PK
        varchar cedula UK
        varchar nombre
        varchar apellido
        int usuario_id UK "NUEVA, nullable, FK usuarios"
        enum estado "ACTIVO, INACTIVO, RETIRADO, GRADUADO"
        datetime fecha_registro
    }
    MATERIAS {
        int id PK
        varchar nombre UK
        enum estado
    }
    CALIFICACIONES {
        int id PK
        int estudiante_id FK
        int materia_id FK
        decimal nota
        datetime fecha_registro
    }
    PERIODOS_ACADEMICOS {
        int id PK "NUEVA"
        smallint anio_escolar "UK con nombre"
        varchar nombre "UK con anio"
        date fecha_inicio
        date fecha_fin "fecha_fin >= fecha_inicio"
        enum estado "ABIERTO, CERRADO"
        datetime fecha_cierre "obligatoria si CERRADO"
    }
    PROFESORES {
        int id PK "NUEVA"
        int usuario_id UK "FK usuarios, obligatoria"
        varchar cedula UK
        varchar nombre
        varchar apellido
        varchar correo "opcional"
        enum estado "ACTIVO, INACTIVO"
    }
    SECCIONES {
        int id PK "NUEVA"
        int materia_id FK
        int periodo_id FK
        varchar codigo "UK con materia y periodo (sin distinguir mayúsculas)"
        enum estado "ACTIVA, INACTIVA"
    }
    PROFESOR_SECCION {
        int profesor_id PK_FK
        int seccion_id PK_FK
        datetime fecha_asignacion
    }
    ESTUDIANTE_SECCION {
        int id PK "NUEVA"
        int estudiante_id FK
        int seccion_id FK
        enum estado "ACTIVA, RETIRADA, FINALIZADA"
        datetime fecha_inscripcion
        datetime fecha_fin "obligatoria si no es ACTIVA"
        int inscripcion_activa_estudiante "VIRTUAL; UK con seccion_id"
    }
```

## Notas de lectura

- **Una cuenta por profesor.** `profesores.usuario_id` es único y obligatorio. Asignar un profesor a materias o secciones nunca crea una cuenta nueva: solo añade filas en `profesor_seccion`.
- **Alumnos = estudiantes con cuenta.** No existe una tabla `alumnos` separada: se evita duplicar datos. El vínculo `estudiantes.usuario_id` es opcional y único.
- **Sección compartida.** Dos profesores en la misma sección comparten la misma fila de `secciones` y los mismos alumnos en `estudiante_seccion`; no se duplican datos.
- **Historial de inscripciones.** Una alumno puede tener varias filas (RETIRADA, FINALIZADA) para la misma sección. Solo una puede estar ACTIVA a la vez, gracias al índice único sobre la columna virtual `inscripcion_activa_estudiante`.
- **Borrado.** Todas las relaciones académicas usan RESTRICT: no se puede borrar un profesor, una sección o un estudiante con inscripciones o asignaciones. La forma correcta es desactivar. Única excepción existente: `calificaciones` conserva CASCADE al borrar un estudiante (comportamiento actual).
