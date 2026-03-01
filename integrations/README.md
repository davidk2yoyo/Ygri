# Integraciones INTERASIA

Este directorio contiene los archivos de configuración y workflows de las integraciones externas para el CRM Ygri.

## 🚀 Quick Start

Ver **[SETUP_GUIDE.md](SETUP_GUIDE.md)** para configuración completa paso a paso.

---

## Estructura

- **n8n/**: Workflows de automatización
  - `daily-report-workflow.json` - Reporte diario automático
  - `email-intelligence-workflow.json` - ⭐ Agente de análisis de emails
- **flowise/**: Chatflows y configuraciones de AI
  - `ygri-ai-chatbot.json` - Chatbot con 5 herramientas

---

## Integraciones Activas

### 1. Email Intelligence Agent 📧

**Propósito:** Captura y analiza automáticamente emails de clientes y proveedores usando AI.

**Cuentas monitoreadas:**
- `suppliers@interasia.com.co` → Comunicación con proveedores chinos
- `proyectos@interasia.com.co` → Comunicación con clientes

**Características:**
- ✅ Análisis automático con OpenAI GPT-4
- ✅ Extracción de datos (precios, productos, deadlines, etc.)
- ✅ Detección de sentimiento y urgencia
- ✅ Generación de action items
- ✅ Almacenamiento en Supabase
- ✅ Notificaciones de emails urgentes
- ✅ Integración con Ygri UI (tab "Email History")

**Ver:** [n8n/README.md](n8n/README.md)

### 2. Daily Report Flow 📊

**Propósito:** Genera reportes diarios con métricas del sistema.

**Ver:** [n8n/README.md](n8n/README.md)

### 3. Ygri AI Chatbot 🤖

**Propósito:** Asistente inteligente con acceso a base de datos en tiempo real.

**Herramientas:** 5 herramientas para lectura, búsqueda, análisis y reportes.

**Ver:** [flowise/README.md](flowise/README.md)

---

## Configuración

### Gmail Forward
```
asistenteinterasia@gmail.com
↑
suppliers@interasia.com.co
proyectos@interasia.com.co
```

### Base de Datos

**Nueva tabla:** `email_threads`
- Almacena conversaciones completas
- Análisis de AI
- Action items
- Relación con clients/suppliers

**Migración:** Ver `../supabase-migration-email-threads.sql`

### APIs Requeridas

- ✅ Gmail API (Google Cloud Console)
- ✅ OpenAI API (para análisis de emails)
- ✅ Supabase (PostgreSQL)
- ⚠️ N8N (self-hosted o cloud)

---

## Archivos Importantes

- **SETUP_GUIDE.md** - Guía completa de configuración paso a paso
- **supabase-migration-email-threads.sql** - Migración de base de datos
- **src/services/emailService.js** - Service para acceder a threads
- **src/components/EmailHistoryTab.jsx** - Componente UI para historial

---

## Uso

### N8N
Exporta tus workflows desde n8n en formato JSON y guárdalos en `n8n/`.
Nombra los archivos descriptivamente: `workflow-nombre-v1.json`

### Flowise
Exporta tus chatflows desde Flowise y guárdalos en `flowise/`.
Nombra los archivos: `chatflow-nombre-v1.json`

---

## Versionado

Al hacer cambios significativos, incrementa el número de versión en el nombre del archivo.

---

## Próximas Integraciones (Roadmap)

- [ ] WhatsApp Groups Agent - Resumen de conversaciones de grupos
- [ ] Auto-creación de Tareas desde emails
- [ ] Integration con WeChat (proveedores chinos)
- [ ] SMS notifications
- [ ] Slack/Discord notifications

---

**Última actualización:** 2026-02-28
