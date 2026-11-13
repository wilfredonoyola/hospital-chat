# Fase 6 — Despliegue en Azure (diseño)

Estado: **diseñado, no implementado**. El laboratorio se cierra como MVP; esto es lo que se construiría al llevarlo a producción. Issue: #7

## Arquitectura

```
                Usuarios (estaciones de enfermería, celulares)
                                  │ HTTPS
                     ┌────────────▼────────────┐
                     │ Azure Front Door + WAF  │  TLS, WAF, rate limit por IP, X-Request-Id
                     └──────┬───────────┬──────┘
          chat.hospital.com │           │ api.chat.hospital.com
              ┌─────────────▼──┐     ┌──▼──────────────────┐
              │ App Service    │     │ App Service (API)    │  WebSockets activado
              │ (web Next.js)  │     │ NestJS + Socket.IO   │  slots staging/production
              └────────────────┘     └──┬──────┬──────┬────┘
                                        │      │      │  identidad administrada (sin secretos en código)
                     ┌──────────────────▼┐  ┌──▼───┐  ┌▼──────────────────┐
                     │ PostgreSQL        │  │ Key  │  │ Blob Storage       │
                     │ Flexible Server   │  │ Vault│  │ (adjuntos, privado)│
                     └───────────────────┘  └──────┘  └────────────────────┘
                     Application Insights + Log Analytics (logs JSON de la fase 5, métricas, alertas)
```

## Decisiones

| Tema                      | Decisión                                                                                                 | Por qué / alternativa descartada                                                                                                                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cómputo                   | **App Service** (Linux) para API y web                                                                   | Menos operación que AKS; slots de despliegue y escalado incluidos. AKS se justifica con muchos servicios o necesidades de red avanzadas. Container Apps es una alternativa válida si se pasa a contenedores en la fase 8 |
| Base                      | **PostgreSQL Flexible Server**, `sslmode=require`, alta disponibilidad con zona redundante en producción | Postgres administrado con backups y PITR. Se activa `pg_stat_statements` para la guía de diagnóstico                                                                                                                     |
| Secretos                  | **Key Vault** referenciado desde App Settings (`@Microsoft.KeyVault(...)`) con identidad administrada    | Ningún secreto en el repo ni en el pipeline. `JWT_SECRET` y la contraseña de la base se rotan en Key Vault sin redesplegar código                                                                                        |
| Acceso a Blob y Key Vault | **Identidad administrada** de App Service                                                                | Sin claves de cuenta de almacenamiento en la configuración                                                                                                                                                               |
| Observabilidad            | Application Insights + Log Analytics                                                                     | Los logs JSON y el `X-Request-Id` de la fase 5 ya están listos para filtrarse; las consultas de `docs/operacion/diagnostico.md` son KQL                                                                                  |
| Borde                     | Front Door + WAF                                                                                         | TLS, WAF (OWASP) y rate limit por IP antes de la API; reenvía `X-Request-Id`. `TRUST_PROXY=1` en la API                                                                                                                  |

## Tiempo real con varias instancias

Socket.IO guarda las salas en la memoria de cada instancia: con dos instancias, un mensaje emitido en la A no llega a los sockets conectados a la B.

- **Opción elegida: Azure Web PubSub for Socket.IO.** Servicio administrado compatible con Socket.IO; la API deja de mantener las conexiones.
- Alternativa: adaptador de Redis (Azure Cache for Redis) en `CorsIoAdapter`. Más control, una pieza más que operar.
- El cliente usa solo `websocket` como transporte, así no hace falta afinidad de sesión (ARR affinity).

## Adjuntos con Blob Storage (SAS)

El archivo no pasa por la API.

1. La web pide `POST /departments/:id/attachments` con nombre, tipo y tamaño.
2. La API valida pertenencia al área, tipo permitido (imágenes, PDF) y tamaño máximo; crea el registro como `pending` y responde una **SAS de escritura** con vida de 5 minutos, para ese único blob, firmada con _user delegation key_ (identidad administrada, sin clave de cuenta).
3. El navegador sube directo al contenedor privado.
4. Un evento de Blob (Event Grid) o una confirmación del cliente marca el adjunto como subido; se verifica el tamaño real y el tipo por contenido (no por extensión) antes de mostrarlo.
5. Para descargar, la API valida pertenencia y responde una **SAS de lectura** de pocos minutos.

**Por qué no pasar el archivo por la API:** ocupa memoria y conexiones de la API mientras dura la subida, y escala peor. **Cómo validar tipo y tamaño si el cliente sube directo:** la SAS limita a un blob concreto y a un tiempo corto; el tamaño y el tipo se verifican después de subir, y un adjunto no verificado no se muestra. Un análisis antimalware (Defender for Storage) se activa en el contenedor.

## Cookie httpOnly y Next.js "de verdad"

Es el disparador del ADR 0006: con la API y la web bajo el mismo sitio (`chat.hospital.com` y `api.chat.hospital.com`), el token pasa a una cookie `httpOnly; Secure; SameSite=Lax`, `proxy.ts` protege las rutas en el servidor y se agrega una Content Security Policy con nonces (ADR 0005). Los 5 pasos están en el ADR 0006.

## Despliegue sin downtime y rollback

- **Slots**: se despliega a `staging`, se corre la prueba de humo contra `staging` y se hace **swap** a producción. El swap espera a que `/health` responda en las instancias nuevas.
- **Rollback**: swap de vuelta. Tarda segundos porque la versión anterior sigue caliente en el otro slot.
- **El límite del rollback es la base**: si la migración ya corrió, el código anterior tiene que funcionar con el esquema nuevo. Por eso las migraciones siguen **expand/contract**.

### Migraciones expand/contract (ejemplo con este proyecto)

Renombrar `users.full_name` a `display_name` sin downtime:

1. **Expand** (despliegue 1): agregar `display_name`; el código escribe en ambas y lee de `full_name`.
2. **Migrar datos**: copiar `full_name` → `display_name` en lotes pequeños (no un `UPDATE` de toda la tabla en una transacción).
3. **Cambiar lectura** (despliegue 2): el código lee de `display_name`.
4. **Contract** (despliegue 3, días después): dejar de escribir `full_name` y borrar la columna.

En cada paso, la versión anterior del código sigue funcionando: el rollback por swap es seguro. El índice de la fase 5 ya siguió esta idea (`CREATE INDEX CONCURRENTLY`, sin bloquear escrituras).

## Costo

No se fija un número sin la calculadora de precios de Azure y la región elegida. Lo que más pesa, en orden:

1. **PostgreSQL Flexible Server** con alta disponibilidad (duplica el cómputo de la base).
2. **App Service** en un plan que admita slots (Standard o superior), con al menos 2 instancias en producción.
3. **Front Door** con WAF.
4. **Web PubSub** según conexiones simultáneas.
5. Log Analytics según volumen de logs (controlado con `LOG_LEVEL` y retención).

**Para empezar barato:** un solo plan para web y API, base sin alta disponibilidad en staging, retención corta de logs. **Con 10 veces más usuarios** cambian sobre todo Web PubSub (conexiones), las instancias de App Service y el tamaño de la base; el índice de la fase 5 y la paginación por cursor evitan que la base crezca en la misma proporción.

## Fuera de alcance del MVP

Infraestructura como código (Bicep o Terraform) para todo lo anterior, la cuenta de Azure y el dominio.
