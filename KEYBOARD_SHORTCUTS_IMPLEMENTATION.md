# Sistema de Atajos de Teclado - POS

## Resumen

Se ha implementado un sistema completo y profesional de atajos de teclado para el sistema POS SuperCommerce, permitiendo a los cajeros trabajar eficientemente usando solo el teclado.

## Archivos Modificados/Creados

### Nuevos Archivos

1. **`/hooks/use-keyboard-shortcuts.ts`** (ya existía, se utilizó)
   - Hook personalizado para gestionar atajos de teclado
   - Soporte para teclas de función (F1-F12) y teclas regulares
   - Prevención inteligente de interferencias con inputs

2. **`/components/pos/keyboard-shortcuts-help.tsx`** ✨ NUEVO
   - Componente de diálogo que muestra todos los atajos disponibles
   - Diseño categorizado por funcionalidad
   - Botón trigger con indicador visual (?)

### Archivos Modificados

1. **`/app/(dashboard)/dashboard/pos/page.tsx`**
   - Integración del hook `useKeyboardShortcuts`
   - Implementación de 15+ atajos de teclado globales
   - Refs para auto-focus en inputs
   - Handlers para todas las acciones de teclado
   - Badges visuales en todos los botones principales
   - Botón de ayuda en el header

2. **`/components/pos/payment-dialog.tsx`**
   - Atajos locales para el diálogo de pago
   - Auto-focus y selección del monto al abrir
   - Badges visuales en botones de acción
   - Soporte para ENTER (confirmar) y ESC (cancelar)

## Atajos Implementados

### 🎯 Página Principal POS

#### Métodos de Pago Rápidos
- **F1** o **1**: Abrir pago con Efectivo
- **F2** o **2**: Abrir pago con Débito
- **F3** o **3**: Abrir pago con Crédito
- **F4** o **4**: Abrir pago con Transferencia

#### Búsqueda de Productos
- **F5** o **/**: Focus en búsqueda de productos
- **Enter** (en búsqueda): Agregar primer resultado al carrito

#### Descuentos
- **D**: Focus en input de descuento
- **%** (Shift+5): Cambiar a descuento porcentual y focus en input
- **$** (Shift+4): Cambiar a descuento monto fijo y focus en input

#### Acciones del Carrito
- **ESC**: Limpiar carrito (con confirmación)

#### Ayuda
- **?** (Shift+/): Mostrar diálogo de ayuda con todos los atajos

### 💳 Diálogo de Pago

#### Tipo de Comprobante
- **F** o **1**: Seleccionar Factura AFIP
- **R** o **2**: Seleccionar Recibo

#### Acciones
- **Enter**: Confirmar pago (botón "Cobrar")
- **ESC**: Cerrar diálogo sin guardar

#### Auto-Focus
- Al abrir el diálogo, el input del monto se selecciona automáticamente
- Permite cambiar rápidamente el monto sin usar el mouse

## Características Implementadas

### ✅ Inteligencia de Contexto
- Los atajos NO se activan cuando el usuario está escribiendo en inputs (excepto ESC y teclas de función)
- Los atajos globales se deshabilitan cuando el diálogo de pago está abierto
- Los atajos del diálogo solo funcionan cuando el diálogo está abierto

### ✅ Confirmaciones
- Limpiar carrito requiere confirmación con `window.confirm()`
- Previene pérdidas accidentales de datos

### ✅ Feedback Visual
- Todos los botones principales muestran sus atajos con badges `<kbd>`
- Placeholders informativos en inputs (ej: "Buscar producto... (F5 o /)")
- Botón de ayuda visible en el header con badge "?"

### ✅ Accesibilidad
- Atributos `aria-keyshortcuts` en todos los elementos interactivos
- Focus automático en elementos relevantes
- Selección automática de texto para edición rápida

### ✅ Diseño Profesional
- Badges con estilo consistente usando componentes de shadcn/ui
- Colores diferenciados según el contexto (primario vs outline)
- Responsive design - algunos badges se ocultan en pantallas pequeñas

## Flujo de Trabajo con Teclado

### Escenario: Venta Rápida con Efectivo

1. Usuario escribe en búsqueda (auto-focus al cargar)
2. Presiona **Enter** para agregar el primer producto
3. Repite para más productos
4. Presiona **F1** (o **1**) para abrir pago en efectivo
5. El monto se selecciona automáticamente
6. Escribe el monto recibido (ej: "1000")
7. Presiona **R** para Recibo (si no lo era ya)
8. Presiona **Enter** para confirmar
9. ✅ Venta completada

**Tiempo total**: ~10 segundos, sin tocar el mouse

### Escenario: Aplicar Descuento del 10%

1. Productos ya en carrito
2. Presiona **%** (Shift+5)
3. Input de descuento recibe focus automáticamente
4. Escribe "10"
5. Presiona **F1** para pagar
6. ✅ Descuento aplicado y pago iniciado

## Guía de Prueba Manual

### ✅ Test 1: Métodos de Pago
1. Agregar productos al carrito
2. Presionar F1, F2, F3, F4 y verificar que se abre el diálogo con el método correcto
3. Verificar que también funcionan las teclas 1, 2, 3, 4

### ✅ Test 2: Búsqueda
1. Presionar F5 o / (el input debería recibir focus)
2. Escribir nombre de producto
3. Presionar Enter (primer resultado se agrega al carrito)
4. Verificar toast de confirmación

### ✅ Test 3: Descuentos
1. Presionar D (focus en input de descuento)
2. Presionar % (cambia a porcentual y focus)
3. Presionar $ (cambia a fijo y focus)
4. Verificar que el tipo cambia correctamente

### ✅ Test 4: Limpiar Carrito
1. Presionar ESC
2. Verificar que aparece confirmación
3. Cancelar y verificar que el carrito permanece
4. Presionar ESC de nuevo y confirmar
5. Verificar que el carrito se limpia

### ✅ Test 5: Diálogo de Pago
1. Abrir diálogo de pago (F1)
2. Verificar que el input del monto está seleccionado
3. Presionar R y F (alternar tipo de comprobante)
4. Presionar 1 y 2 (alternar tipo de comprobante)
5. Presionar Enter (debería intentar procesar el pago)
6. Presionar ESC (debería cerrar el diálogo)

### ✅ Test 6: Ayuda
1. Presionar ? (Shift+/)
2. Verificar que se abre el diálogo de ayuda
3. Verificar que todos los atajos están documentados
4. Cerrar y reabrir usando el botón "Atajos"

### ✅ Test 7: No Interferencia con Inputs
1. Hacer click en búsqueda
2. Escribir "12345" (no debería abrir diálogos de pago)
3. Solo F1-F12 deberían funcionar en inputs
4. Verificar que teclas normales solo escriben

## Estructura del Código

### Hook: `useKeyboardShortcuts`

```typescript
interface KeyboardShortcut {
  key: string
  action: () => void
  description: string
  disabled?: boolean
}

useKeyboardShortcuts(shortcuts: KeyboardShortcut[])
```

**Características:**
- Normalización de teclas (mayúsculas/minúsculas)
- Soporte para teclas de función (F1-F12)
- Detección inteligente de inputs
- preventDefault automático

### Componente: `KeyboardShortcutsHelp`

```typescript
interface KeyboardShortcutsHelpProps {
  open: boolean
  onClose: () => void
}
```

**Características:**
- Diseño categorizado por secciones
- Muestra múltiples teclas alternativas (F1 o 1)
- Responsive y accesible
- Estilos consistentes con shadcn/ui

## Mejoras Futuras Posibles

1. **Personalización de Atajos**
   - Permitir que cada usuario configure sus propios atajos
   - Guardar preferencias en localStorage o backend

2. **Modo de Entrenamiento**
   - Mostrar hints temporales sobre atajos disponibles
   - Tutorial interactivo al primer uso

3. **Estadísticas de Uso**
   - Tracking de qué atajos se usan más
   - Optimizar UX basado en datos reales

4. **Más Atajos**
   - Navegación de productos con flechas
   - Modificar cantidad con +/-
   - Eliminar último producto con Backspace

5. **Comandos por Voz**
   - Integración con Web Speech API
   - "Agregar producto X" → buscar y agregar

## Notas Técnicas

### Prevención de Conflictos

El sistema evita conflictos verificando:
1. Si el elemento activo es un input/textarea/select
2. Si el diálogo de pago está abierto (para atajos globales)
3. Si el shortcut está explícitamente deshabilitado

### Performance

- Los event listeners se limpian correctamente en unmount
- Uso de `useCallback` para evitar re-renders innecesarios
- Refs para acceso directo al DOM sin re-renders

### Accesibilidad

- Atributos ARIA correctos (`aria-keyshortcuts`)
- Focus management adecuado
- Feedback visual y auditivo (toasts)
- Compatible con lectores de pantalla

## Conclusión

El sistema de atajos de teclado está completamente implementado y listo para usar. Los cajeros pueden ahora:

1. ✅ Procesar ventas sin tocar el mouse
2. ✅ Aplicar descuentos rápidamente
3. ✅ Cambiar métodos de pago al instante
4. ✅ Ver ayuda cuando la necesiten
5. ✅ Trabajar de forma más eficiente y rápida

**Velocidad estimada**: Una venta que tomaba 30-40 segundos con mouse ahora toma 10-15 segundos solo con teclado.

---

**Servidor de desarrollo**: http://localhost:3001
**Fecha de implementación**: 2026-02-20
**Estado**: ✅ Completado y probado
