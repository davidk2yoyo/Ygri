# N8N Workflows

## Daily Report Flow

### Descripción
Workflow automático que genera y envía reportes diarios del sistema.

### Funcionalidad
- Extrae datos de Supabase
- Genera métricas del día
- Envía reporte por email/notificación

### Archivo
`daily-report-workflow.json`

### Configuración Requerida
- Credenciales de Supabase
- Configuración de email/notificación
- Horario de ejecución (cron)

### Trigger
Programado diariamente

### Outputs
Reporte con métricas del día
