# Pruebas de integración y validaciones

Casos de prueba de los dos flujos de mayor riesgo, según la guía del taller de la Semana 13:

- **Flujo A — solicitar una reserva** (HU14, HU13, HU17): SPA → nginx `/api` → FastAPI → PostgreSQL → Mailpit.
- **Flujo B — gestionar y pagar la reserva** (HU15, HU16, HU18): FastAPI → PostgreSQL; pasarela simulada → webhook → PostgreSQL → Mailpit.

El informe completo (versión, alcance, arquitectura, componentes, matriz de interfaces y de casos, incidencias, trazabilidad,
estrategia y conclusiones) está en [`Informe_Integracion_y_Pruebas.pdf`](Informe_Integracion_y_Pruebas.pdf).

## Ejecutar

Con la app levantada (`docker compose up -d --build`), desde la raíz del repositorio:

```bash
python pruebas/ejecutar_pruebas.py              # restablece los datos de prueba y ejecuta PI-01 a PI-15
python pruebas/ejecutar_pruebas.py --sin-reset  # sobre el estado actual
```

Antes de ejecutar, el script deja un estado inicial conocido: corre `scripts.datos_demo`, vacía Mailpit y borra las
cuentas `prueba.s13.*@example.com` que crea PI-14. Solo usa la biblioteca estándar de Python y `docker compose exec`;
lee `WEB_PORT` y `MAIL_UI_PORT` del `.env` (o las variables `WEB_URL` y `MAILPIT_URL`).

Un caso es **PASS** solo si la respuesta HTTP **y** el efecto en el componente conectado (fila en la base, cupos,
correo en Mailpit) son los esperados. La evidencia queda en `pruebas/resultados/<fecha-hora>/`:

| Archivo | Contenido |
| --- | --- |
| `bitacora.md` | Esperado, obtenido y estado de cada caso |
| `resumen.json` | Entorno (rama, commit, versiones, contenedores) y resultados |
| `PI-XX.json` | Peticiones y respuestas, consultas a la base y verificaciones del caso |

## Casos que no ejecuta el script

| Caso | Por qué | Cómo |
| --- | --- | --- |
| PI-16 (BUG-01) | Requiere cambiar `.env` y reiniciar el backend | `API_PORT=8100` y `BACKEND_URL=http://localhost:8100`, `docker compose up -d backend`, pagar una reserva confirmada con la pasarela simulada. Evidencia en `resultados/PI-16/` |
| PI-17, PI-18 | Prueban la interfaz: se ejecutan a mano en el navegador con capturas | Ver los casos representativos del informe |
