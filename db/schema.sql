-- Esquema de base de datos para el Sistema de Avales de Crédito

CREATE TABLE IF NOT EXISTS usuarios (
    id            SERIAL PRIMARY KEY,
    nombre        VARCHAR(150) NOT NULL,
    email         VARCHAR(150) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    rol           VARCHAR(20) NOT NULL DEFAULT 'asesor'
                    CHECK (rol IN ('administrador', 'asesor')),
    activo        BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS avales (
    id                      SERIAL PRIMARY KEY,
    numero                  VARCHAR(20) NOT NULL UNIQUE,

    -- Asignación
    fecha                   DATE NOT NULL DEFAULT CURRENT_DATE,
    hora_asignacion         TIME NOT NULL,
    asesor_id               INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    asignado_por            INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,

    -- Contacto
    hora_primer_contacto    TIME,
    cumplimiento_atencion   VARCHAR(20)
                              CHECK (cumplimiento_atencion IN ('correcto', 'fuera_de_tiempo')),

    -- Datos del cliente / aval
    cedula                  VARCHAR(20) NOT NULL,
    calificacion_aval       INTEGER,
    cliente                 VARCHAR(200) NOT NULL,
    telefono                VARCHAR(20),
    gestor_contact_center   VARCHAR(150),
    ciudad                  VARCHAR(100),
    actividad_economica     VARCHAR(50)
                              CHECK (actividad_economica IN ('DEPENDIENTE', 'INDEPENDIENTE') OR actividad_economica IS NULL),
    observaciones           TEXT,
    monto                   NUMERIC(12,2),

    -- Resultado / cierre
    estado_negociacion      VARCHAR(60) NOT NULL DEFAULT 'PENDIENTE',
    producto                VARCHAR(60),
    fecha_cierre            DATE,
    hora_cierre             TIME,
    atencion_exitosa        VARCHAR(2)
                              CHECK (atencion_exitosa IN ('SI', 'NO') OR atencion_exitosa IS NULL),

    -- Adjunto (imagen, PDF o documento de soporte)
    adjunto_nombre_original VARCHAR(255),
    adjunto_nombre_archivo  VARCHAR(255),
    adjunto_mime            VARCHAR(100),
    adjunto_subido_en       TIMESTAMPTZ,

    creado_en               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla de sesiones para connect-pg-simple
CREATE TABLE IF NOT EXISTS "session" (
    "sid"    VARCHAR NOT NULL COLLATE "default",
    "sess"   JSON NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL
)
WITH (OIDS=FALSE);

ALTER TABLE "session" DROP CONSTRAINT IF EXISTS "session_pkey";
ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

-- Índices para acelerar reportes y filtros frecuentes
CREATE INDEX IF NOT EXISTS idx_avales_asesor ON avales(asesor_id);
CREATE INDEX IF NOT EXISTS idx_avales_estado ON avales(estado_negociacion);
CREATE INDEX IF NOT EXISTS idx_avales_fecha ON avales(fecha);
CREATE INDEX IF NOT EXISTS idx_avales_cumplimiento ON avales(cumplimiento_atencion);
