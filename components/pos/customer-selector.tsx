"use client"

import * as React from "react"
import { Check, ChevronsUpDown, User, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

  const handleSelectCustomer = (customer: Customer) => {
    onChange(customer)
    setOpen(false)
    setSearch("")
  }

  const handleClearCustomer = () => {
    onChange(null)
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
          {value ? (
            <X
              className="ml-2 h-4 w-4 shrink-0 opacity-50 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation()
                handleClearCustomer()
              }}
            />
          ) : (
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <div className="flex flex-col">
          {/* Search Input */}
          <div className="border-b p-3">
            <Input
              placeholder="Buscar por nombre, email, o documento..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9"
              autoFocus
            />
          </div>

          {/* Results List */}
          <div className="max-h-[300px] overflow-y-auto">
            {loading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Cargando clientes...
              </div>
            ) : customers.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {search ? "No se encontraron clientes." : "No hay clientes registrados."}
              </div>
            ) : (
              <div className="p-1">
                {customers.map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => handleSelectCustomer(customer)}
                    className={cn(
                      "w-full flex items-start gap-2 px-3 py-2 rounded-md hover:bg-accent cursor-pointer text-left transition-colors",
                      value?.id === customer.id && "bg-accent"
                    )}
                  >
                    <Check
                      className={cn(
                        "mt-1 h-4 w-4 shrink-0",
                        value?.id === customer.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="font-medium truncate">{customer.name}</div>
                      <div className="text-xs text-muted-foreground flex gap-2 flex-wrap">
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
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
