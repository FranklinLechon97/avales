# Sistema de Asignación de Avales de Crédito

CRUD completo con login por perfiles, sobre PostgreSQL. Construido a partir de la
estructura del archivo `TIEMPO_ATENCIÓN_AL_CLIENTE.xlsx`.

## Perfiles

**Administrador**
- Registra avales y los asigna (o reasigna) a un asesor.
- Ve todos los avales, con filtros por asesor, estado, cumplimiento y rango de fechas.
- Edita y elimina cualquier aval.
- Panel de reportes: estadísticas globales, listado de atención por asesor y
  distribución por estado de negociación.
- Crea usuarios, cambia perfiles y activa/desactiva cuentas.

**Asesor**
- Ve únicamente los avales que le fueron asignados.
- Registra la hora de primer contacto, el estado de la negociación, producto,
  monto, cierre y si la atención fue exitosa.
- Ve sus propias estadísticas (asignados, sin contactar, cumplimiento, exitosos).
- No puede crear, eliminar ni reasignar avales, ni ver los de otros asesores.

## Cumplimiento de atención (SLA)

El campo `CUMPLIMIENTO DE ATENCIÓN` del Excel original (CORRECTO / FUERA DE TIEMPO)
se calcula **automáticamente**: al guardar la hora de primer contacto, el sistema
compara la diferencia contra la hora de asignación.

- Diferencia menor o igual a `SLA_MINUTOS` → `correcto`
- Diferencia mayor → `fuera_de_tiempo`

El valor por defecto es **30 minutos** y se cambia en el archivo `.env`
(variable `SLA_MINUTOS`), sin tocar el código.

> Supuesto documentado: el Excel no especificaba el umbral de tiempo, así que se
> tomó 30 minutos como valor inicial configurable. En la fila 1 del archivo original
> (14:14 → 14:35, 21 min) el resultado es CORRECTO y en la fila 2 (10:05 → 12:35,
> 150 min) es FUERA DE TIEMPO, coincidiendo con los datos de origen.

## Novedades: exportar a Excel y adjuntos por aval

**Exportar a Excel (solo administrador)**
En la pestaña "Avales" hay un botón **"⬇ Descargar Excel"**. Descarga exactamente
el listado que está filtrado en pantalla (mismo asesor, estado, cumplimiento y
rango de fechas), con las 20 columnas del formato original del Excel de origen.

**Adjuntos (imagen, PDF o Word)**
Tanto en la tabla del administrador como en la del asesor hay una columna
**"Adjunto"**. El asesor puede subir o reemplazar el archivo de soporte de cada
aval (botón "Subir" / "Cambiar"); el administrador puede verlo ("Ver") pero no
subirlo. Límite: 10 MB por archivo, tipos permitidos: JPG, PNG, WEBP, GIF, PDF,
DOC, DOCX. Los archivos se guardan en `uploads/avales/` (fuera de `public/`, así
que nadie puede descargarlos sin haber iniciado sesión) y nunca se suben a Git.

### Si ya tenías el proyecto instalado antes de esta actualización

1. Reemplaza los archivos del proyecto por los de este paquete.
2. Instala las dependencias nuevas:
   ```bash
   npm install
   ```
3. Ejecuta la migración de la base de datos **una sola vez**, en pgAdmin
   (Query Tool, sobre tu base `sistema_avales`), pegando el contenido de
   `db/migracion_adjuntos.sql`. Es segura de volver a ejecutar si dudas.
4. Reinicia el servidor: `npm start`.

Si es una instalación nueva, no hace falta nada especial: `npm run init-db`
ya crea la tabla con las columnas de adjunto incluidas.

## Requisitos

- Node.js 18 o superior
- PostgreSQL 13 o superior

## Instalación

```bash
cd sistema-avales
npm install
```

### Configurar la base de datos

1. Crea la base de datos:
   ```bash
   createdb sistema_avales
   ```
   (o créala desde pgAdmin con el nombre `sistema_avales`)

2. Copia la plantilla de variables de entorno y complétala:
   ```bash
   copy .env.example .env      # Windows
   cp .env.example .env        # Linux / Mac
   ```
   Edita `.env` con tu host, puerto, usuario, contraseña y nombre de base de datos.
   Genera además una clave aleatoria para `SESSION_SECRET`:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

3. Crea las tablas y los usuarios de prueba:
   ```bash
   npm run init-db
   ```

### Levantar el servidor

```bash
npm start
```

Abre `http://localhost:3000`. Cada usuario es redirigido a su panel según el perfil.

**Cuentas de prueba creadas por `init-db`:**

| Perfil        | Email                 | Contraseña  |
|---------------|-----------------------|-------------|
| Administrador | admin@avales.local    | admin1234   |
| Asesor        | asesor@avales.local   | asesor1234  |

Cámbialas apenas puedas ingresar.

## Estructura

```
sistema-avales/
├── db/
│   ├── schema.sql        -- tablas: usuarios, avales, session
│   ├── pool.js           -- conexión a PostgreSQL
│   └── init.js           -- crea tablas + usuarios de prueba
├── middleware/
│   └── auth.js           -- requireAuth y requireRole
├── routes/
│   ├── auth.js           -- login, registro, logout, sesión
│   ├── usuarios.js       -- gestión de usuarios (solo admin)
│   ├── avales.js         -- CRUD de avales + asignación
│   └── reportes.js       -- estadísticas (solo admin)
├── public/
│   ├── login.html
│   ├── admin.html        -- panel de administrador
│   ├── asesor.html       -- panel de asesor
│   ├── css/style.css
│   └── js/{login,admin,asesor}.js
├── server.js
├── package.json
└── .env.example
```

## Endpoints

### Autenticación
| Método | Ruta                  | Acceso    |
|--------|-----------------------|-----------|
| POST   | /api/auth/registro    | público (crea perfil asesor) |
| POST   | /api/auth/login       | público   |
| POST   | /api/auth/logout      | sesión    |
| GET    | /api/auth/sesion      | sesión    |

### Avales
| Método | Ruta                          | Acceso |
|--------|-------------------------------|--------|
| GET    | /api/avales                   | admin (todos) · asesor (solo los suyos) |
| GET    | /api/avales/:id               | admin · asesor propietario |
| POST   | /api/avales                   | admin |
| PATCH  | /api/avales/:id/asignar       | admin |
| PUT    | /api/avales/:id               | admin (todo) · asesor (solo seguimiento) |
| DELETE | /api/avales/:id               | admin |

Filtros de `GET /api/avales`: `asesor_id`, `estado`, `cumplimiento`,
`fecha_desde`, `fecha_hasta`.

### Reportes (solo administrador)
| Método | Ruta                       | Devuelve |
|--------|----------------------------|----------|
| GET    | /api/reportes/resumen      | totales, tasa de éxito, cumplimiento, sin asignar, pendientes |
| GET    | /api/reportes/por-asesor   | listado de atención por asesor con sus métricas |
| GET    | /api/reportes/por-estado   | distribución por estado de negociación |

### Usuarios (solo administrador)
| Método | Ruta                        |
|--------|-----------------------------|
| GET    | /api/usuarios               |
| POST   | /api/usuarios               |
| PATCH  | /api/usuarios/:id/rol       |
| PATCH  | /api/usuarios/:id/activo    |

## Seguridad aplicada

- Contraseñas cifradas con bcrypt (nunca en texto plano).
- Sesiones persistidas en PostgreSQL, cookie `httpOnly`.
- Control de acceso en el **servidor**, no solo en la interfaz: un asesor que
  llame directamente a la API solo obtiene sus propios avales.
- Consultas parametrizadas en todas las rutas (protección contra inyección SQL).

### Antes de producción

- Cambia `SESSION_SECRET` por un valor aleatorio propio.
- Sirve detrás de HTTPS y activa `cookie.secure = true` en `server.js`.
- Elimina o cambia las contraseñas de las cuentas de prueba.
- Agrega `.env` a `.gitignore` si vas a subir el proyecto a un repositorio.
