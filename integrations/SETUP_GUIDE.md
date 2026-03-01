# Guía de Configuración - Email Intelligence Agent

## Resumen del Sistema

Este sistema captura automáticamente emails de `suppliers@interasia.com.co` y `proyectos@interasia.com.co`, los analiza con AI y guarda información estructurada en Supabase.

---

## Paso 1: Configurar Gmail Forward

### 1.1 Crear cuenta Gmail
- Email: `asistenteinterasia@gmail.com` ✅ (ya creada)
- Contraseña segura guardada en gestor de contraseñas

### 1.2 Configurar forwards en el hosting

En tu panel de hosting (cPanel, Plesk, etc.) donde está `interasia.com.co`:

**Crear forwards:**
```
suppliers@interasia.com.co   → asistenteinterasia@gmail.com
proyectos@interasia.com.co   → asistenteinterasia@gmail.com
```

### 1.3 Configurar "Enviar como" en Gmail

1. Entra a Gmail → Configuración ⚙️ → "Cuentas e importación"
2. En "Enviar correo como" → "Añadir otra dirección de correo"
3. Agregar:
   - `suppliers@interasia.com.co`
   - `proyectos@interasia.com.co`
4. Verificar con código que llega al hosting

**Resultado:** Puedes responder emails "desde" los correos corporativos

### 1.4 Crear filtros en Gmail (opcional pero recomendado)

**Filtro 1 - Suppliers:**
```
Para: suppliers@interasia.com.co
→ Aplicar etiqueta: "INTERASIA/Suppliers"
→ Omitir Bandeja de entrada (opcional)
```

**Filtro 2 - Proyectos:**
```
Para: proyectos@interasia.com.co
→ Aplicar etiqueta: "INTERASIA/Proyectos"
→ Omitir Bandeja de entrada (opcional)
```

---

## Paso 2: Configurar Gmail API

### 2.1 Crear proyecto en Google Cloud Console

1. Ir a: https://console.cloud.google.com/
2. Crear nuevo proyecto: "INTERASIA Email Agent"
3. Habilitar Gmail API:
   - Buscar "Gmail API"
   - Click "Enable"

### 2.2 Crear credenciales OAuth 2.0

1. APIs & Services → Credentials
2. "Create Credentials" → "OAuth client ID"
3. Application type: **Web application**
4. Name: "N8N Gmail Integration"
5. Authorized redirect URIs:
   ```
   https://tu-n8n-instance.com/rest/oauth2-credential/callback
   ```
   (Depende de dónde tengas N8N instalado)

6. Guardar:
   - **Client ID**
   - **Client Secret**

### 2.3 Configurar OAuth Consent Screen

1. OAuth consent screen → External
2. App name: "INTERASIA Email Agent"
3. User support email: tu email
4. Scopes: Agregar Gmail read/modify scopes
5. Test users: Agregar `asistenteinterasia@gmail.com`

---

## Paso 3: Configurar Supabase

### 3.1 Ejecutar migración SQL

1. Ir a Supabase Dashboard → SQL Editor
2. Copiar contenido de `supabase-migration-email-threads.sql`
3. Ejecutar
4. Verificar tablas creadas:
   - `email_threads`
   - `email_messages`

### 3.2 Obtener credenciales de conexión

En Supabase Dashboard → Project Settings → Database:

```
Host: db.xxxxxxxxxxxxx.supabase.co
Port: 5432
Database: postgres
User: postgres
Password: [tu password]
```

**Connection String:**
```
postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres
```

---

## Paso 4: Configurar N8N

### 4.1 Importar workflow

1. Abrir N8N
2. Click "+" → "Import from File"
3. Seleccionar: `integrations/n8n/email-intelligence-workflow.json`

### 4.2 Configurar credenciales

**Gmail OAuth2:**
1. Click en nodo "Gmail - Read New Emails"
2. Credentials → Create New
3. Tipo: OAuth2
4. Pegar Client ID y Client Secret
5. Authorize → Login con `asistenteinterasia@gmail.com`

**Supabase PostgreSQL:**
1. Click en nodo "Supabase - Save Supplier Thread"
2. Credentials → Create New
3. Tipo: Postgres
4. Pegar connection string de Supabase

**OpenAI API:**
1. Click en nodo "AI Analyze - Supplier Email"
2. Credentials → Create New
3. API Key: Tu OpenAI API key
4. Repetir para "AI Analyze - Client Email"

### 4.3 Ajustar configuración (opcional)

**Frecuencia de lectura:**
- Default: cada 15 minutos
- Cambiar en nodo "Every 15 minutes"

**Notificaciones:**
- Nodo "Send Notification" está configurado para Telegram
- Puedes cambiar a Slack, Discord, Email, etc.

### 4.4 Activar workflow

1. Click en el switch "Active" arriba a la derecha
2. Verificar que no hay errores
3. El workflow empezará a correr automáticamente

---

## Paso 5: Verificar funcionamiento

### Test del sistema:

1. **Enviar email de prueba:**
   ```
   Para: suppliers@interasia.com.co
   Asunto: Test - Cotización Proveedor ABC
   Cuerpo: Necesito 1000 unidades del producto XYZ a $2.50 USD
   ```

2. **Esperar 15 minutos** (o ejecutar manualmente el workflow)

3. **Verificar en Supabase:**
   ```sql
   SELECT * FROM email_threads ORDER BY created_at DESC LIMIT 1;
   ```

4. **Verificar que AI extrajo:**
   - Summary
   - Sentiment
   - Extracted data (precio, producto, cantidad)

### Troubleshooting:

**Si no funciona:**
1. Revisar ejecución en N8N → Executions
2. Ver errores en cada nodo
3. Verificar OAuth tokens no expiraron
4. Revisar logs de Supabase

---

## Paso 6: Integración con Ygri Frontend

### 6.1 Configurar Supabase Client

Verificar que `src/supabaseClient.js` tiene las credenciales correctas.

### 6.2 Crear servicio de emails

Ver archivo: `src/services/emailService.js` (siguiente paso)

### 6.3 Agregar tab en SuppliersPage

Ver componente: `src/components/EmailHistoryTab.jsx` (siguiente paso)

---

## Costos Estimados

- Gmail: **Gratis** (cuota API generosa)
- Google Cloud: **Gratis** (dentro de límites)
- OpenAI API: **~$20-30/mes** (depende de volumen de emails)
  - GPT-4o-mini: ~$0.15 per 1M input tokens
  - ~100-200 emails/día = ~$0.50-1/día
- Supabase: **Gratis** (plan free suficiente para empezar)
- N8N: Depende de dónde lo tengas (self-hosted gratis, cloud $20/mes)

**Total estimado:** $20-50/mes

---

## Mantenimiento

### Monitoreo semanal:
- [ ] Verificar que workflow sigue activo
- [ ] Revisar emails que no matchearon cliente/proveedor
- [ ] Ajustar prompts de AI si es necesario

### Mejoras futuras:
- [ ] Auto-crear tareas desde action items
- [ ] Integrar con WhatsApp
- [ ] Dashboard de métricas de comunicación
- [ ] Reportes automáticos de threads pendientes

---

## Soporte

Si tienes problemas:
1. Revisar logs de N8N
2. Verificar credenciales
3. Consultar documentación de N8N: https://docs.n8n.io
4. Gmail API docs: https://developers.google.com/gmail/api

---

## Checklist de Setup Completo

- [ ] Gmail `asistenteinterasia@gmail.com` creada
- [ ] Forwards configurados en hosting
- [ ] "Enviar como" configurado en Gmail
- [ ] Filtros de Gmail creados
- [ ] Proyecto Google Cloud creado
- [ ] Gmail API habilitada
- [ ] OAuth credentials creadas
- [ ] Migración SQL ejecutada en Supabase
- [ ] Workflow importado en N8N
- [ ] Credenciales configuradas en N8N
- [ ] Workflow activado
- [ ] Test enviado y procesado correctamente
- [ ] Tab de Email History en Ygri funcionando

---

**Última actualización:** 2026-02-28
