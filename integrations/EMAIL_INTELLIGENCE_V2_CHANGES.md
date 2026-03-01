# Email Intelligence v2 - Changelog

## 🎯 Cambios Principales

### **Nueva funcionalidad: Comunicación Bidireccional**

Ahora el sistema registra **TANTO** los emails que recibes **COMO** los que envías a clientes y proveedores.

---

## 📝 Archivos Actualizados

### 1. **supabase-rpc-match-email.sql** (NUEVO)

Función RPC para matching bidireccional de emails.

**Funcionalidades:**
- ✅ Analiza `From` y `To` para determinar quién es el externo (cliente/proveedor)
- ✅ Detecta automáticamente si el email es `incoming` (te escriben) o `outgoing` (tú escribes)
- ✅ Aplica reglas de matching:
  - **Dominios públicos** (gmail, hotmail, qq, etc.): Match EXACTO
  - **Dominios corporativos**: Match por DOMINIO
- ✅ Lista de emails de INTERASIA pre-configurada

**Ejecutar en Supabase:**
```bash
# Copiar contenido de supabase-rpc-match-email.sql
# Ejecutar en Supabase SQL Editor
```

**Test:**
```sql
SELECT * FROM test_rpc_match_email();
```

---

### 2. **email-intelligence-workflow-v2.json** (NUEVO)

N8N Workflow completamente rediseñado.

**Cambios clave:**

#### **Flujo anterior (v1):**
```
Gmail → ¿Es suppliers@ o proyectos@? → AI Analyze → Save
```
❌ Solo detectaba por destinatario
❌ No registraba emails salientes (outgoing)

#### **Flujo nuevo (v2):**
```
1. Gmail - Read New Emails
2. Extract Email Data (Code Node)
   → Extrae From, To, Subject, etc.
3. Match Email (HTTP Request a Supabase RPC)
   → Llama rpc_match_email_bidirectional(from, to)
   → Retorna: {found, type, entity_id, direction}
4. Merge Data (Code Node)
5. Email Matched? (IF Node)
   ├─ YES → AI Analyze Email
   │         → Prepare DB Insert
   │         → Save to Database
   │         → Is Urgent? → Send Notification
   └─ NO → Log Unmatched
```

**Ventajas:**
- ✅ Registra **incoming Y outgoing**
- ✅ Match preciso por email (no por nombre ambiguo)
- ✅ Un solo flujo AI (no duplicado para suppliers/clients)
- ✅ Mejor manejo de errores
- ✅ Logs de emails no procesados

---

### 3. **EmailHistoryTab.jsx** (ACTUALIZADO)

Componente UI ahora muestra dirección de emails.

**Cambios visuales:**

#### **Lista de threads:**
- 📥 Icono azul para emails **recibidos** (incoming)
- 📤 Icono verde para emails **enviados** (outgoing)
- Badge "📥 Recibido" / "📤 Enviado"

#### **Detalle del thread:**
- Muestra **De:** y **Para:** claramente
- Badge destacado de dirección
- Información completa del flujo del email

---

## 🗄️ Cambios en Base de Datos

### **Tabla `email_threads`** - Nuevo campo:

```sql
ALTER TABLE email_threads
ADD COLUMN direction text CHECK (direction IN ('incoming', 'outgoing'));
```

**Valores:**
- `'incoming'` → Cliente/Proveedor te escribió
- `'outgoing'` → Tú escribiste a Cliente/Proveedor

**Índice:**
```sql
CREATE INDEX idx_email_threads_direction ON email_threads(direction);
```

---

## 🔧 Configuración Requerida

### **1. Ejecutar SQL en Supabase:**

```sql
-- 1. Ejecutar migración de direction
ALTER TABLE email_threads
ADD COLUMN IF NOT EXISTS direction text
CHECK (direction IN ('incoming', 'outgoing'));

CREATE INDEX IF NOT EXISTS idx_email_threads_direction
ON email_threads(direction);

-- 2. Ejecutar función RPC
-- (Copiar todo el contenido de supabase-rpc-match-email.sql)
```

### **2. Actualizar N8N Workflow:**

1. Abrir N8N
2. Importar `email-intelligence-workflow-v2.json`
3. Configurar credenciales:
   - Gmail OAuth2
   - Supabase (ya configurado en el JSON)
   - OpenAI API
   - Telegram (opcional, para notificaciones)
4. Activar workflow
5. **Desactivar** workflow v1 (el anterior)

### **3. Actualizar Frontend (Ygri):**

El componente `EmailHistoryTab.jsx` ya está actualizado. Solo necesitas:

```bash
# Si usas el componente en SuppliersPage o ClientsPage
# Ya debería funcionar automáticamente
```

---

## 📊 Ejemplos de Uso

### **Caso 1: Proveedor te escribe**

```
Email recibido:
From: sales@chinasupplier.com
To: suppliers@interasia.com.co
Subject: New quotation ready

→ Sistema procesa:
{
  found: true,
  type: 'supplier',
  entity_id: '...',
  direction: 'incoming',
  external_email: 'sales@chinasupplier.com'
}

→ Guardar en DB:
  - supplier_id: matched
  - direction: 'incoming'
  - from_email: 'sales@chinasupplier.com'
  - to_email: 'suppliers@interasia.com.co'

→ UI muestra: 📥 Recibido de sales@chinasupplier.com
```

---

### **Caso 2: Tú escribes a cliente**

```
Email enviado:
From: gerencia@interasia.com.co
To: contact@clienteempresa.com
Subject: Proposal for Project ABC

→ Sistema procesa:
{
  found: true,
  type: 'client',
  entity_id: '...',
  direction: 'outgoing',
  external_email: 'contact@clienteempresa.com'
}

→ Guardar en DB:
  - client_id: matched
  - direction: 'outgoing'
  - from_email: 'gerencia@interasia.com.co'
  - to_email: 'contact@clienteempresa.com'

→ UI muestra: 📤 Enviado a contact@clienteempresa.com
```

---

### **Caso 3: Email no matchea (nuevo proveedor)**

```
Email recibido:
From: newprovider@unknown.com
To: suppliers@interasia.com.co

→ Sistema procesa:
{
  found: false,
  external_email: 'newprovider@unknown.com',
  direction: 'incoming'
}

→ NO se guarda en email_threads
→ Se registra en logs de N8N
→ (Futuro: guardar en tabla "pending_review")
```

---

## 🎨 Queries Útiles

### **Ver todos los emails entrantes:**
```sql
SELECT * FROM email_threads
WHERE direction = 'incoming'
ORDER BY last_received_at DESC;
```

### **Ver emails salientes de esta semana:**
```sql
SELECT * FROM email_threads
WHERE direction = 'outgoing'
AND last_received_at >= NOW() - INTERVAL '7 days'
ORDER BY last_received_at DESC;
```

### **Threads de un cliente (bidireccional):**
```sql
SELECT
  direction,
  subject,
  from_email,
  to_email,
  last_received_at
FROM email_threads
WHERE client_id = 'xxx-client-id'
ORDER BY last_received_at DESC;
```

### **Estadísticas por dirección:**
```sql
SELECT
  direction,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE needs_response = true) as pending
FROM email_threads
WHERE supplier_id = 'xxx'
GROUP BY direction;
```

---

## ✅ Checklist de Deployment

- [ ] Ejecutar `supabase-rpc-match-email.sql` en Supabase
- [ ] Verificar que función `rpc_match_email_bidirectional` existe
- [ ] Ejecutar test: `SELECT * FROM test_rpc_match_email();`
- [ ] Importar workflow v2 en N8N
- [ ] Configurar credenciales (Gmail, OpenAI, Telegram)
- [ ] Testear con email real:
  - [ ] Enviar email desde gerencia@ a un cliente conocido
  - [ ] Recibir email de proveedor conocido
  - [ ] Verificar que ambos se guardan correctamente
- [ ] Verificar UI en Ygri muestra badges de dirección
- [ ] Desactivar workflow v1
- [ ] Activar workflow v2
- [ ] Monitorear primeras 24 horas

---

## 🐛 Troubleshooting

### **Problema: Función RPC no existe**
```
Solution: Ejecutar supabase-rpc-match-email.sql completo
```

### **Problema: Emails de INTERASIA se están guardando**
```
Verificar lista de emails en la función RPC:
v_interasia_emails text[] := ARRAY[
  'interasiagerencia@gmail.com',
  'gerencia@interasia.com.co',
  ...
]

Agregar cualquier email que falte.
```

### **Problema: No matchea emails de proveedores con múltiples dominios**
```
Si proveedor tiene ventas@empresa.com y pedidos@empresa.com
→ Debería matchear por dominio corporativo
→ Verificar que email en DB tiene formato correcto
```

### **Problema: Gmail públicos no matchean**
```
Para Gmail: DEBE ser match exacto
Registrado: contacto@gmail.com
Recibido: contacto@gmail.com ✅
Recibido: ventas@gmail.com ❌
```

---

**Fecha:** 2026-02-28
**Versión:** 2.0
**Autor:** Claude + David
