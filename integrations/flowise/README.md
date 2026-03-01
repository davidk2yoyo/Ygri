# Flowise Chatflows

## Ygri AI Assistant Chatbot

### Descripción
Chatbot inteligente con acceso a 5 herramientas especializadas para consultar información del sistema.

### Herramientas Integradas

1. **Read Tool** - Lectura de documentos y datos
2. **Search Tool** - Búsqueda en la base de datos
3. **Analysis Tool** - Análisis de información
4. **Query Tool** - Consultas específicas
5. **Report Tool** - Generación de reportes

### Funcionalidad
- Responde preguntas sobre clientes, proveedores, tareas
- Consulta base de datos en tiempo real
- Genera análisis y reportes
- Acceso contextual a documentos

### Archivo
`ygri-ai-chatbot.json`

### Configuración Requerida
- API Keys de OpenAI/Anthropic
- Credenciales de Supabase
- Vector Store configurado
- Embeddings model

### Integración
Se conecta con la aplicación a través de la API de Flowise.
Endpoint configurado en `src/services/ai.js`
