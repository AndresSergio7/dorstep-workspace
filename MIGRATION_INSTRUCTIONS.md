# Instrucciones para aplicar las migraciones

## Cambios realizados

### 1. Campos de prioridad y fecha de entrega en pendientes
- Se agregó el campo `priority` (baja, media, alta) a la tabla `action_items`
- Se agregó el campo `due_date` (fecha de entrega) a la tabla `action_items`

### 2. Arreglo del campo attendees en meetings
- Se cambió el tipo de `attendees` de array a text para evitar el error "malformed array literal"
- Ahora se guarda como texto separado por comas

## Pasos para aplicar en Supabase

### Opción 1: Ejecutar SQL directamente en Supabase Dashboard

1. Ve a tu proyecto en Supabase Dashboard
2. Ve a la sección **SQL Editor**
3. Ejecuta el contenido de estos archivos en orden:

```sql
-- Archivo: supabase/migrations/20260407130000_action_items_priority_and_due_date.sql
-- Este SQL agrega los campos priority y due_date a action_items
```

```sql
-- Archivo: supabase/migrations/20260407130100_meetings_attendees_to_text.sql
-- Este SQL cambia attendees de array a text
```

### Opción 2: Usar Supabase CLI (si la tienes instalada)

```bash
# Desde la raíz del proyecto
supabase db push
```

## Verificación

Después de ejecutar las migraciones, verifica que:

1. La tabla `action_items` tenga las columnas:
   - `priority` (tipo: text, nullable, con check constraint)
   - `due_date` (tipo: date, nullable)

2. La tabla `meetings` tenga:
   - `attendees` (tipo: text, no array)

## Cambios en el código

Los siguientes archivos fueron modificados para soportar estos cambios:

- `src/app/meetings/new/page.tsx` - Formulario de crear reunión con campos de prioridad y fecha
- `src/app/meetings/[id]/page.tsx` - Vista de reunión con campos de prioridad y fecha
- `src/app/tasks/page.tsx` - Vista de tareas con prioridad y fecha de entrega
- `src/types/index.ts` - Tipos actualizados
- Migraciones SQL en `supabase/migrations/`
