# Ygri Copilot v1 — Reporte de implementación

Primer vertical slice del copiloto de IA — construido y pusheado. Commit `48cf1c8`.

---

## 1. Arquitectura construida

El invariante central del spec, forzado en código y no solo en el prompt: una llamada a un tool de ESCRITURA nunca llega a su `execute()` hasta que un request HTTP separado — disparado solo cuando el usuario hace click en Confirmar — recarga el plan desde la base de datos y lo revalida.

```
Browser — YgriCopilot.jsx (widget flotante, consciente de la página)
        │  POST /api/ai-orchestrator { message, pageContext, history }
        ▼
authenticateRequest()  — verifica el JWT, arma un cliente de Supabase con la sesión del usuario
        ▼
runOrchestratorTurn()  — prompt + skills + contexto, loop de tools de lectura (máx 5)
        ▼
¿Se pidió un tool de escritura? → PARA. buildActionPlan(), persiste, retorna — nunca ejecuta
        │  el usuario revisa las Action Cards, hace click en Confirmar
        ▼
POST /api/ai-action-execute { plan_id, selected_action_ids }
        ▼
executeActionPlan()  — recarga el plan canónico · ownership · TTL · revalida · ejecuta · registra
        ▼
RPC add_stage_todo / insert en project_messages — la misma operación que ya usa la UI manual
```

Cada llamada a la base de datos en todo este camino — lectura o escritura — corre con el JWT propio del usuario que llama (`api/_lib/ai/supabaseServer.js`). `service_role` no se usa en ningún lado del código nuevo.

---

## 2. Archivos creados

| Ruta | Propósito |
|---|---|
| `supabase-ai-copilot.sql` | 5 tablas nuevas, RLS, grants, seed de prompt/skills/tools |
| `api/ai-orchestrator.js` | Ruta: un turno de chat del Copilot |
| `api/ai-action-execute.js` | Ruta: confirmar/ejecutar un plan |
| `api/_lib/ai/supabaseServer.js` | Verificación de auth + cliente de Supabase con sesión del usuario |
| `api/_lib/ai/openai.js` | Config de modelo centralizada + wrapper de fetch |
| `api/_lib/ai/prompts.js` / `skills.js` | Cargadores de prompt activo / skills relevantes, con fallback |
| `api/_lib/ai/context/projectStatusEngine.js` | Cálculos deterministas puros, con tests unitarios |
| `api/_lib/ai/context/projectContext.js` | ProjectContext — orquestación de queries + ensamblado |
| `api/_lib/ai/context/clientContext.js` / `supplierContext.js` / `emailContext.js` | Los otros 3 providers de contexto de v1 |
| `api/_lib/ai/tools/readTools.js` | 16 tools de lectura |
| `api/_lib/ai/tools/writeTools.js` | 2 tools de escritura — `create_task`, `add_project_message` |
| `api/_lib/ai/actionPlan.js` | Construye + persiste el Action Plan canónico |
| `api/_lib/ai/executor.js` | Recarga, revalida, ejecuta, registra |
| `api/_lib/ai/orchestrate.js` | El loop de tools de lectura + la intercepción de escritura |
| `api/_lib/ai/projectActivityServer.js` | Gemelo server-side de `src/lib/projectActivity.js` |
| `src/contexts/CopilotPageContext.jsx` | Contexto de React para la página actual |
| `src/lib/ai/copilotClient.js` | Wrapper de fetch del navegador, adjunta el JWT del usuario |
| `src/components/ai/YgriCopilot.jsx` | El widget flotante |
| `src/components/ai/ActionPlanPanel.jsx` / `ActionCard.jsx` | UI de Action Cards + selección/confirmación |
| `src/pages/AiManagementPage.jsx` | Overview/Prompts/Skills/Tools/Executions/Settings |
| `scripts/test-ai-core.mjs` | Tests sin framework para la lógica determinista |
| `docs/ai-copilot.md` | Guía de desarrollo — cómo agregar un tool de lectura/escritura, por qué existe la frontera |

---

## 3. Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/Layout.jsx` | Envuelve la app autenticada en `CopilotPageProvider`; renderiza `<YgriCopilot/>` junto a (no en reemplazo de) el widget de Flowise existente; nuevo ítem de nav "AI Management" |
| `src/pages/ProjectsPage.jsx` | Un nuevo effect que publica `{page, track_id, stage_id, projectName, clientName}` cada vez que cambia el proyecto abierto |
| `src/main.jsx` | Nueva ruta: `/ai-management` |
| `src/components/conversation/MessageItem.jsx` | Nuevo caso de system-event `ai_task_created`, para que una tarea creada por IA deje un rastro legible en la conversación del proyecto |
| `package.json` | Script `test:ai` — sin dependencias nuevas |
| `integrations/n8n/ygridailyreport.json` | Se reemplazó el JWT `service_role` commiteado por `{{ $env.SUPABASE_SERVICE_ROLE_KEY }}` |
| `integrations/n8n/email-intelligence-workflow-v2.json` | Mismo reemplazo, 2 ocurrencias |

---

## 4. Cambios en la base de datos

Una sola migración, completamente aditiva — `supabase-ai-copilot.sql`. No se tocó nada existente.

| Tabla | RLS |
|---|---|
| `ai_prompts` | Lectura/escritura autenticada (config global) — una sola versión activa por key, forzado por un índice único parcial |
| `ai_skills` | Mismo patrón |
| `ai_tools` | Mismo patrón — solo metadata, nunca autoritativo sobre el tipo READ/WRITE |
| `ai_action_plans` | **Chequeo real de `auth.uid()`** — el primer RLS de ownership genuino en este codebase. SELECT: propio o cualquier staff no-inspector. INSERT/UPDATE: estrictamente propio |
| `ai_executions` | Mismo patrón de ownership que los action plans |

Las 5 tablas tienen `GRANT` explícito junto a su RLS — evitando proactivamente el bug recurrente de este proyecto de RLS sin GRANT.

---

## 5. Context Engine

`buildProjectContext()` es el contexto "core" automático que se carga en cada turno. **No** depende de las RPCs opacas heredadas — cada query es nueva, contra el schema que diste.

- Identidad del proyecto — nombre, status, cliente, owner
- Pipeline — etapa actual/siguiente, días en la etapa, estado de SLA, lista completa de etapas
- Tareas — conteos abiertas/completadas/vencidas, títulos de las vencidas
- Hitos — próximo, conteo de posposiciones, el más pospuesto
- Cotización — resumen de la última, conteo, pagos, saldo
- Conteo de órdenes de compra
- Estado de inspección — **solo** desde `inspection_reports`, nunca inferido de la etapa
- Estado de envío
- Timestamp de última actividad, flag de email pendiente de respuesta
- Resumen del request original del cliente
- Últimos 8 mensajes de la conversación
- Resúmenes estructurados de hilos de email (acotados al proyecto, con fallback al cliente)

El detalle más profundo (historial completo, ítems de cotización, cuerpos de email crudos) **no** es una profundidad de contexto separada — son las mismas funciones de query reusadas directamente por los tools de lectura (`get_project_activity`, `get_quotation`, `get_email_threads`). Una sola implementación, dos puntos de llamada.

---

## 6. Project Status Engine

Funciones puras en `projectStatusEngine.js`, con tests unitarios. Cada hecho lleva una etiqueta `reliability` — nada se presenta como seguro cuando no lo es.

| Hecho | Confiabilidad | Por qué |
|---|---|---|
| current_stage / next_stage | Alta | Join directo, sin interpretación |
| days_in_stage / sla_status | Media | Depende de que la RPC opaca de transición setee `started_at` de forma confiable |
| conteos de tareas | Alta | Exacto — misma forma que ya calcula Layout.jsx |
| conteo de posposiciones de hito | Alta | `count()` exacto desde `milestone_date_history` — tu ejemplo de "pospuesto 3 veces", literal |
| hechos de cotización/pagos | Alta | Sumas directas sobre filas reales |
| inspection_status | Alta | Solo desde `inspection_reports.status` — la regla obligatoria está forzada en código, testeada explícitamente |
| shipment_status / conteo de PO | Media | Las columnas `status` son texto libre, no enums restringidos; `purchase_orders.track_id` no tiene FK en tu schema |
| email_needs_response | Media | `email_threads.project_id` no está confiablemente rellenado en hilos viejos — se usa fallback por client_id |

---

## 7. Tools

**Lectura (16)** — se ejecutan automáticamente:
`search_clients, get_client, search_projects, get_project, get_project_status, get_project_activity, search_suppliers, get_supplier, get_tasks, get_overdue_tasks, get_quotation, get_pipeline, get_current_stage, get_email_threads, get_shipments, get_inspection_reports`

**Escritura (2)** — siempre una propuesta:
`create_task` → llama la misma RPC `add_stage_todo` que ya usan StageDrawer.jsx y TasksPage.jsx. `add_project_message` → inserta en `project_messages` igual que el composer de ConversationTab.jsx, atribuido al usuario que aprueba.

Excluidos a propósito según el alcance aprobado: `create_project` (necesita extraer `create_track_rpc` primero), `advance_stage` (necesita unificar los dos caminos de transición de pipeline primero — se mantiene deshabilitado/no documentado como tool activo, tal como se pidió).

---

## 8. Ciclo de vida del Action Plan

1. El modelo pide un tool de escritura → el orquestador intercepta, nunca ejecuta
2. `buildActionPlan()` llama al `validate()` de ese tool contra datos en vivo, calcula `current_state`/`proposed_state`/warnings/errors él mismo
3. El plan se persiste en `ai_action_plans` (TTL de 15 minutos), se manda al navegador una versión reducida
4. El usuario selecciona/deselecciona Action Cards, hace click en Confirmar
5. El navegador manda solo `{plan_id, selected_action_ids}` — nunca tool/argumentos/target
6. `executeActionPlan()` recarga la fila canónica, chequea ownership por `user_id` (403 si no coincide), chequea el TTL (vencido → no ejecuta)
7. Cada acción seleccionada se **revalida** contra datos actuales antes de ejecutar — una etapa/cotización que cambió se marca `stale`, nunca se adapta en silencio
8. Las acciones ya `completed` se saltan al reconfirmar (idempotente — seguro contra doble click/reintento)
9. La ejecución actualiza la fila del plan + la fila vinculada de `ai_executions`; `create_task` también publica un `system_event` en la conversación del proyecto

---

## 9. Seguridad

- **Auth** — ambos endpoints rechazan cualquier request sin un JWT válido de Supabase (verificado en vivo contra tu endpoint real de Supabase Auth durante las pruebas)
- **Identidad** — cada llamada a la DB, lectura o escritura, corre con el JWT propio del que llama vía `supabaseServer.js`; `service_role` no aparece en ningún lado del código nuevo
- **Ownership** — forzado dos veces: explícitamente en `executor.js` (403 si `plan.user_id !== quien llama`), e independientemente a nivel de base de datos vía RLS real en `ai_action_plans`/`ai_executions` — la primera policy `auth.uid()` genuina en este codebase
- **Acceso a AI Management** — restringido a roles no-inspector a nivel de página, más de lo que hoy hace la página de Settings existente
- **Key de OpenAI** — solo en el servidor, confirmado ausente del bundle del navegador construido (grep)

---

## 10. AI Management

Vivo en `/ai-management`. Seis pestañas: **Overview** (conteos del día — requests, tool calls, propuestas de escritura, costo), **Prompts** y **Skills** (versionado inmutable — editar crea una nueva versión activa, las viejas quedan intactas para las ejecuciones que las referencian), **Tools** (activar/desactivar; el tipo READ/WRITE se muestra de solo lectura, no se puede bajar de nivel desde la UI), **Executions** (log expandible de cada turno — modelo, skills usados, tools llamados, tokens, latencia, estado del plan vinculado), **Settings** (modelo/proveedor actual, explicado como centralizado en código en vez de una tabla por ahora).

---

## 11. Tests

No existía framework de tests en este repo — no se introdujo ninguno. `scripts/test-ai-core.mjs` es Node plano + `assert`, se corre con `npm run test:ai`.

- ✅ 8/8 aserciones pasando — resolución de etapa/siguiente-etapa, límites de SLA at-risk/overdue, etiquetado de confiabilidad en datos faltantes, filtrado de tareas vencidas, conteos exactos de posposición de hitos, y la regla obligatoria de "el estado de inspección nunca se infiere de la etapa"
- ✅ `npx vite build` — limpio
- ✅ Ambos endpoints nuevos de `/api` importan sin error (verificado con `import()` directo de Node, no solo `vite build`, ya que las funciones de Vercel no son parte del bundle de Vite)
- ✅ Ambos endpoints devuelven correctamente 401 sin header de Authorization, y — verificado en vivo contra tu Supabase Auth de producción — 401 con un token inválido
- ✅ Confirmado que ningún secreto de servidor (`OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) aparece en ningún lado del bundle del navegador construido

**No probado — honestamente no puedo desde aquí:** una corrida real end-to-end (abrir un proyecto, preguntar algo, recibir una respuesta con datos reales, proponer una escritura, confirmarla, verla reflejada en la UI) necesita tu sesión de navegador real y una llamada en vivo a OpenAI. No tengo una sesión logueada en este entorno, y no voy a inventar que la corrí. Los escenarios de aceptación de tu spec (§81–§92) son el guión correcto para correr una vez aplicada la migración.

---

## 12. Acciones manuales necesarias

**🔴 1 — Correr la migración.** `supabase-ai-copilot.sql` en el editor SQL de Supabase. Nada funciona hasta que esto corra — las tablas todavía no existen.

**⏸️ 2 — Rotar la key service_role: decidido, en pausa por decisión tuya.** No se va a rotar por ahora — quieres probar primero qué funciona antes de arriesgar romper la automatización de n8n que ya está corriendo. Nota importante: el cambio que hice en los dos archivos JSON de workflow (reemplazar la key literal por `{{ $env.SUPABASE_SERVICE_ROLE_KEY }}`) **solo tocó los archivos en el repo de git** — son exports/backups, no están conectados en vivo a tu instancia real de n8n. Tu automatización sigue corriendo exactamente igual, sin cambios. Si en algún momento decides rotar, ese es el único paso pendiente (Supabase → Settings → API) más setear la variable de entorno nueva en n8n.

**✅ Nada más.** Sin variables de entorno nuevas en Vercel — el orquestador reusa `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, y `OPENAI_API_KEY`, ya configuradas (esa última ya carga con el uso de `api/ai-scan.js` — vale la pena vigilar el consumo ahora que una segunda feature la comparte).

---

## 13. Diferido a propósito

Según tu condición de stop explícita (§97) — nada de esto se empezó, todo necesita tu revisión primero:

`create_client, update_client, create_supplier, update_supplier, create_project, update_project, advance_stage, create_quote_draft, update_quote, create_shipment` · Morning Briefing / alertas de proyectos estancados / escaneo de inconsistencias cross-módulo · cualquier cosa de envío por Telegram/WhatsApp/email · orquestación multi-agente, MCP, búsqueda vectorial, o cualquier proceso autónomo en background.

---

## 14. Problemas encontrados durante la implementación

- **El acceso directo a Postgres no estuvo disponible desde este entorno** — la connection string del pooler de una sesión anterior devolvió "tenant/user not found", y el hostname de conexión directa solo resuelve a IPv6, que este sandbox no puede alcanzar. Nunca llegué a sacar el cuerpo de las 2 RPCs opacas (`create_track_rpc`, `complete_stage_and_advance`) que bloquean `create_project`/`advance_stage` — ese trabajo sigue pendiente para cuando se construyan esos tools.
- **`activity_log` sigue sin verificar.** Todavía no sé si las RPCs opacas existentes ya escriben ahí — esto determina si el diseño del audit-log de la §K del Blueprint necesita ajuste. Vale la pena esa query cuando tengas acceso a la DB a mano.
- **`purchase_orders.track_id` no tiene constraint de FK** en el schema que diste — el hecho de conteo de órdenes de compra está etiquetado con confiabilidad `media` por eso, no es un bug de este código.
- **La zona horaria está hardcodeada** a `America/Bogota` para resolver fechas relativas ("mañana") — un default razonable dado el contexto de Interasia/Colombia en todo este codebase, pero no hay un setting de zona horaria a nivel de organización para leer en su lugar. Marcado con un comentario en el código; valdría la pena un setting real si esto alguna vez importa para un equipo fuera de esa zona horaria.

---

## 15. Fase siguiente recomendada

*No se implementa nada de esto — solo recomendación, según tu instrucción.*

**Primero:** correr los escenarios de aceptación (§81–§92) — es la prueba real de si la frontera aguanta bajo uso real; todo lo demás debería esperar a esto.

**Después:** escrituras simples con schema completamente conocido — `create_client`/`update_client`, `create_supplier`/`update_supplier` — misma complejidad baja que los dos tools ya entregados.

**En paralelo:** cuando el acceso a la DB esté resuelto — extraer `create_track_rpc` y `complete_stage_and_advance`, unificar los dos caminos de avance de pipeline — desbloquea `create_project` y `advance_stage` sin más trabajo de diseño.

**Más adelante:** inteligencia de cotizaciones, después la capa proactiva — `create_quote_draft` cuando haya una razón real para redactar desde el chat, no solo ver · Morning Briefing / detección de estancamiento, para lo cual el Project Status Engine ya tiene los hechos crudos.

---

*Ygri Copilot v1 · primer vertical slice · commit 48cf1c8, pusheado a main*
