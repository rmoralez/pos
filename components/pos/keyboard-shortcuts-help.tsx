"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Keyboard } from "lucide-react"

interface ShortcutGroup {
  title: string
  shortcuts: Array<{
    keys: string[]
    description: string
  }>
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "Métodos de Pago",
    shortcuts: [
      { keys: ["F1", "1"], description: "Abrir pago con Efectivo" },
      { keys: ["F2", "2"], description: "Abrir pago con Débito" },
      { keys: ["F3", "3"], description: "Abrir pago con Crédito" },
      { keys: ["F4", "4"], description: "Abrir pago con Transferencia" },
    ],
  },
  {
    title: "Búsqueda de Productos",
    shortcuts: [
      { keys: ["F5", "/"], description: "Focus en búsqueda de productos" },
      { keys: ["Enter"], description: "Agregar primer resultado al carrito (desde búsqueda)" },
    ],
  },
  {
    title: "Descuentos",
    shortcuts: [
      { keys: ["D"], description: "Focus en input de descuento" },
      { keys: ["%"], description: "Cambiar a descuento porcentual" },
      { keys: ["$"], description: "Cambiar a descuento monto fijo" },
    ],
  },
  {
    title: "Carrito",
    shortcuts: [
      { keys: ["ESC"], description: "Limpiar carrito (con confirmación)" },
    ],
  },
  {
    title: "En el Dialog de Pago",
    shortcuts: [
      { keys: ["F", "1"], description: "Seleccionar Factura AFIP" },
      { keys: ["R", "2"], description: "Seleccionar Recibo" },
      { keys: ["Enter"], description: "Confirmar pago (Cobrar)" },
      { keys: ["ESC"], description: "Cerrar sin guardar" },
    ],
  },
]

interface KeyboardShortcutsHelpProps {
  open: boolean
  onClose: () => void
}

export function KeyboardShortcutsHelp({ open, onClose }: KeyboardShortcutsHelpProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Atajos de Teclado
          </DialogTitle>
          <DialogDescription>
            Usa estos atajos para trabajar más rápido en el POS
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title} className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {group.title}
              </h3>
              <div className="space-y-2">
                {group.shortcuts.map((shortcut, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIdx) => (
                        <span key={keyIdx} className="flex items-center gap-1">
                          {keyIdx > 0 && (
                            <span className="text-xs text-muted-foreground">o</span>
                          )}
                          <kbd className="px-2 py-1 text-xs font-semibold text-foreground bg-muted border border-border rounded">
                            {key}
                          </kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={onClose}>Cerrar</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface KeyboardShortcutsTriggerProps {
  onClick: () => void
}

export function KeyboardShortcutsTrigger({ onClick }: KeyboardShortcutsTriggerProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className="gap-2"
      title="Ver atajos de teclado (?))"
    >
      <Keyboard className="h-4 w-4" />
      Atajos
      <kbd className="ml-1 px-1.5 py-0.5 text-xs font-mono bg-muted border border-border rounded">
        ?
      </kbd>
    </Button>
  )
}
