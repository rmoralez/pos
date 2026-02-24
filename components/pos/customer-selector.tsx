"use client"

import * as React from "react"
import { Check, ChevronsUpDown, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface Customer {
  id: string
  name: string
  email: string | null
  phone: string | null
  documentType: string | null
  documentNumber: string | null
  account?: {
    id: string
    balance: string
    creditLimit: string
    isActive: boolean
  } | null
}

interface CustomerSelectorProps {
  value: Customer | null
  onChange: (customer: Customer | null) => void
  disabled?: boolean
}

export function CustomerSelector({ value, onChange, disabled }: CustomerSelectorProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [customers, setCustomers] = React.useState<Customer[]>([])
  const [loading, setLoading] = React.useState(false)

  // Debounced search
  React.useEffect(() => {
    if (!open) return

    const fetchCustomers = async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/customers?search=${encodeURIComponent(search)}`)
        if (response.ok) {
          const data = await response.json()
          setCustomers(data.slice(0, 20)) // Limit to 20 results
        }
      } catch (error) {
        console.error("Error fetching customers:", error)
      } finally {
        setLoading(false)
      }
    }

    const timeoutId = setTimeout(fetchCustomers, 300)
    return () => clearTimeout(timeoutId)
  }, [search, open])

  // Load initial customers when opening
  React.useEffect(() => {
    if (open && customers.length === 0 && !search) {
      const fetchInitialCustomers = async () => {
        setLoading(true)
        try {
          const response = await fetch("/api/customers?search=")
          if (response.ok) {
            const data = await response.json()
            setCustomers(data.slice(0, 20))
          }
        } catch (error) {
          console.error("Error fetching customers:", error)
        } finally {
          setLoading(false)
        }
      }
      fetchInitialCustomers()
    }
  }, [open, customers.length, search])

  const getCustomerDisplay = (customer: Customer) => {
    const parts = [customer.name]
    if (customer.documentNumber) {
      parts.push(customer.documentNumber)
    }
    if (customer.email) {
      parts.push(customer.email)
    }
    return parts.join(" - ")
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          <div className="flex items-center gap-2 truncate">
            <User className="h-4 w-4 shrink-0 opacity-50" />
            {value ? (
              <span className="truncate">{getCustomerDisplay(value)}</span>
            ) : (
              <span className="text-muted-foreground">Seleccionar cliente...</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar por nombre, email, o documento..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {loading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Cargando clientes...
              </div>
            ) : (
              <>
                <CommandEmpty>
                  {search ? "No se encontraron clientes." : "No hay clientes registrados."}
                </CommandEmpty>
                <CommandGroup>
                  {customers.map((customer) => (
                    <CommandItem
                      key={customer.id}
                      value={customer.id}
                      onSelect={() => {
                        onChange(customer.id === value?.id ? null : customer)
                        setOpen(false)
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value?.id === customer.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col flex-1 min-w-0">
                        <div className="font-medium truncate">{customer.name}</div>
                        <div className="text-xs text-muted-foreground flex gap-2">
                          {customer.documentNumber && (
                            <span>{customer.documentNumber}</span>
                          )}
                          {customer.email && (
                            <span className="truncate">{customer.email}</span>
                          )}
                          {customer.phone && (
                            <span>{customer.phone}</span>
                          )}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
