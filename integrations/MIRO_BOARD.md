# Miro Board - YGRI Architecture & Integrations

**Board URL:** https://miro.com/app/board/uXjVGeTCXKY=/

---

## 📋 Propósito del Board

Este board de Miro documenta visualmente la arquitectura completa del sistema YGRI, incluyendo integraciones, flujos de datos y agentes de automatización.

---

## 🗂️ Estructura del Board

### 1. **Arquitectura General del Sistema**
- Diagrama de componentes principales
- Frontend (React + Vite)
- Backend (Supabase)
- Integraciones externas

### 2. **Email Intelligence Agent**
- Flujo de datos desde Gmail
- Procesamiento con N8N + OpenAI
- Almacenamiento en `email_threads`
- Visualización en UI

### 3. **Flujos de Integración**
- Gmail API → N8N → AI Analysis → Supabase
- Webhooks y triggers
- Transformaciones de datos

### 4. **Database Schema**
- Tablas principales:
  - `clients`
  - `suppliers`
  - `email_threads`
  - `email_messages`
  - `projects`
  - `tasks`
  - `quotations`
  - `invoices`

### 5. **Agentes Planeados (Roadmap)**
- ✅ Email Intelligence Agent (implementado)
- 🔜 Telegram Agent
- 🔜 WhatsApp Agent
- 🔜 WeChat Agent

---

## 🎨 Diagramas Incluidos

### Diagram 1: Email Intelligence Flow
```
Gmail (suppliers@/proyectos@)
    ↓
Gmail API
    ↓
N8N Workflow (every 15 min)
    ↓
OpenAI GPT-4 Analysis
    ↓
Supabase (email_threads)
    ↓
Ygri UI (Email History Tab)
```

### Diagram 2: System Architecture
```
[Frontend - React]
    ↓
[Supabase Client]
    ↓
[Supabase Backend]
    ├─→ PostgreSQL Database
    ├─→ Auth
    ├─→ Storage
    └─→ Realtime

[External Integrations]
    ├─→ N8N (Automation)
    ├─→ Flowise (AI Chatbot)
    ├─→ OpenAI API
    └─→ Gmail API
```

### Diagram 3: Data Flow - Email Thread Creation
```
1. New email arrives → Gmail
2. N8N polls Gmail API
3. Extract email metadata
4. AI analyzes content:
   - Summary
   - Sentiment
   - Extracted data (prices, products, deadlines)
   - Action items
5. Match sender to client/supplier
6. Create/update email_thread
7. UI displays in timeline
```

---

## 🔧 Componentes Técnicos Documentados

### N8N Workflows
1. **email-intelligence-workflow.json**
   - Trigger: Every 15 minutes
   - Nodes: Gmail → Filter → AI Analysis → Supabase Insert

2. **daily-report-workflow.json**
   - Trigger: Daily at 8 AM
   - Nodes: Supabase Query → Generate Report → Send Notification

### Flowise Chatflows
1. **ygri-ai-chatbot.json**
   - 5 herramientas de base de datos
   - Memoria de conversación
   - Acceso a Supabase

---

## 📊 Métricas y KPIs Visualizados

- Emails procesados por día
- Threads activos por cliente/proveedor
- Urgencia promedio de emails
- Action items pendientes
- Tiempo de respuesta promedio

---

## 🚀 Próximas Expansiones del Board

### Telegram Agent (Planeado)
- Telegram Bot API integration
- Group message analysis
- Table: `telegram_threads`

### WhatsApp Agent (Planeado)
- WhatsApp Business API
- Conversation summarization
- Table: `whatsapp_threads`

### Unified Communications Timeline
- Vista consolidada de:
  - Emails
  - Telegram messages
  - WhatsApp messages
  - Llamadas (futuro)

---

## 📝 Notas de Uso

- **Actualización:** Mantener sincronizado con cambios en código
- **Versionado:** Crear frames separados para versiones mayores
- **Colaboración:** Usar comentarios para feedback
- **Export:** Guardar snapshots en `integrations/miro-exports/`

---

## 🔗 Enlaces Relacionados

- [README.md](./README.md) - Documentación general de integraciones
- [SETUP_GUIDE.md](./SETUP_GUIDE.md) - Guía de configuración paso a paso
- [n8n/README.md](./n8n/README.md) - Workflows de N8N
- [flowise/README.md](./flowise/README.md) - Configuración de chatbot

---

**Última actualización:** 2026-03-03
**Mantenido por:** Equipo de desarrollo Ygri
