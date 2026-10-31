# Arquitectura GameHive — base y evolución

Requisitos vinculantes: GAMEHIVE_MASTER_SPEC.md y AGENTS.md. ADR-001/002 contienen decisiones G0. Los módulos avanzan según BACKLOG, con evidencia; este documento no acredita su implementación.

Cliente React/Router → interfaces de servicio → Supabase Auth/PostgREST bajo RLS o Edge Functions para operaciones sensibles. Catálogo RAWG mediante adaptador servidor; catálogo curado explícito mientras falta integración.

G1: perfiles públicos separados de preferencias privadas y authz privado. Rol inicial impuesto por servidor. La autorización consulta estado/rol vigentes, no user_metadata. G3: constraints únicas para reseña y voto, votos sin update/delete, guardas de edad en servidor. G4: biblioteca privada por defecto, sin bypass de terceros. G5: acciones transaccionales con auditoría y permisos distintos para moderador/admin. G6: flujos reales, accesibilidad, hosting autorizado.

Las validaciones de cliente ayudan al usuario; los invariantes se repiten en DB. La integración externa solo se considera terminada tras SQL/Data API y E2E con cuentas reales.
