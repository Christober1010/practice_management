"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"

export interface SelectProps {
  value?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
}

const SelectContext = React.createContext<{
  value?: string
  onValueChange?: (value: string) => void
  isOpen?: boolean
  setIsOpen?: (open: boolean) => void
}>({})

const Select = ({ value, onValueChange, children }: SelectProps) => {
  const [isOpen, setIsOpen] = React.useState(false)
  const wrapperRef = React.useRef<HTMLDivElement>(null)
  
  return (
    <SelectContext.Provider value={{ value, onValueChange, isOpen, setIsOpen }}>
      <div ref={wrapperRef} className="relative">{children}</div>
    </SelectContext.Provider>
  )
}

const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }
>(({ className = "", children, ...props }, ref) => {
  const { value, isOpen, setIsOpen } = React.useContext(SelectContext)
  
  return (
    <button
      type="button"
      ref={ref}
      className={`flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 ${className}`}
      onClick={() => setIsOpen?.(!isOpen)}
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 opacity-50" />
    </button>
  )
})
SelectTrigger.displayName = "SelectTrigger"

const SelectValue = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement> & { placeholder?: string }
>(({ className = "", placeholder, ...props }, ref) => {
  const { value } = React.useContext(SelectContext)
  
  return (
    <span ref={ref} className={`block truncate ${className}`} {...props}>
      {value || <span className="text-slate-500">{placeholder || "Select..."}</span>}
    </span>
  )
})
SelectValue.displayName = "SelectValue"

const SelectContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }
>(({ className = "", children, ...props }, ref) => {
  const { isOpen, setIsOpen } = React.useContext(SelectContext)
  const contentRef = React.useRef<HTMLDivElement | null>(null)
  
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contentRef.current && !contentRef.current.contains(e.target as Node)) {
        setIsOpen?.(false)
      }
    }
    
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen, setIsOpen])
  
  const setRefs = React.useCallback((node: HTMLDivElement | null) => {
    contentRef.current = node
    if (typeof ref === 'function') {
      ref(node)
    } else if (ref) {
      (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
    }
  }, [ref])
  
  if (!isOpen) return null
  
  return (
    <div
      ref={setRefs}
      className={`absolute z-50 left-0 right-0 w-full overflow-hidden rounded-md border border-slate-200 bg-white text-slate-950 shadow-md mt-1 max-h-[300px] overflow-y-auto ${className}`}
      {...props}
    >
      {children}
    </div>
  )
})
SelectContent.displayName = "SelectContent"

const SelectItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value: string; children: React.ReactNode }
>(({ className = "", value, children, ...props }, ref) => {
  const { value: selectedValue, onValueChange, setIsOpen } = React.useContext(SelectContext)
  const isSelected = selectedValue === value
  
  return (
    <div
      ref={ref}
      className={`relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none hover:bg-teal-50 hover:text-teal-700 focus:bg-teal-50 focus:text-teal-700 ${
        isSelected ? 'bg-teal-50 text-teal-700 font-medium' : ''
      } data-[disabled]:pointer-events-none data-[disabled]:opacity-50 ${className}`}
      onClick={() => {
        onValueChange?.(value)
        setIsOpen?.(false)
      }}
      {...props}
    >
      {children}
    </div>
  )
})
SelectItem.displayName = "SelectItem"

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem }

