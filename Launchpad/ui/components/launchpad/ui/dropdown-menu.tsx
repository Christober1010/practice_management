"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { ChevronDown } from "lucide-react"

interface DropdownMenuContextValue {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  triggerRef: React.MutableRefObject<HTMLElement | null>
}

const DropdownMenuContext = React.createContext<DropdownMenuContextValue | undefined>(undefined)

export interface DropdownMenuProps {
  children: React.ReactNode
}

const DropdownMenu = ({ children }: DropdownMenuProps) => {
  const [isOpen, setIsOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLElement | null>(null)

  return (
    <DropdownMenuContext.Provider value={{ isOpen, setIsOpen, triggerRef }}>
      <div className="relative">{children}</div>
    </DropdownMenuContext.Provider>
  )
}

const DropdownMenuTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    asChild?: boolean
    children: React.ReactNode
  }
>(({ className = "", asChild, children, ...props }, ref) => {
  const context = React.useContext(DropdownMenuContext)
  if (!context) throw new Error("DropdownMenuTrigger must be used within DropdownMenu")

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      ...props,
      onClick: () => context.setIsOpen(!context.isOpen),
      ref: (node: HTMLElement | null) => {
        context.triggerRef.current = node
        if (typeof ref === "function") {
          ref(node as any)
        } else if (ref) {
          ;(ref as React.MutableRefObject<HTMLElement | null>).current = node
        }
      },
    } as any)
  }

  return (
    <button
      ref={ref}
      type="button"
      className={className}
      onClick={() => context.setIsOpen(!context.isOpen)}
      onMouseDown={(e) => {
        context.triggerRef.current = e.currentTarget
      }}
      {...props}
    >
      {children}
    </button>
  )
})
DropdownMenuTrigger.displayName = "DropdownMenuTrigger"

const DropdownMenuContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    children: React.ReactNode
  }
>(({ className = "", children, ...props }, ref) => {
  const context = React.useContext(DropdownMenuContext)
  if (!context) throw new Error("DropdownMenuContent must be used within DropdownMenu")
  const contentRef = React.useRef<HTMLDivElement | null>(null)
  const [position, setPosition] = React.useState<{
    top: number
    left: number
    minWidth: number
  } | null>(null)

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contentRef.current && !contentRef.current.contains(e.target as Node)) {
        context.setIsOpen(false)
      }
    }

    if (context.isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [context.isOpen, context])

  React.useLayoutEffect(() => {
    if (!context.isOpen) {
      setPosition(null)
      return
    }
    const trigger = context.triggerRef.current
    const content = contentRef.current
    if (!trigger || !content) return
    const triggerRect = trigger.getBoundingClientRect()
    const contentRect = content.getBoundingClientRect()
    const padding = 8
    let left = triggerRect.right - contentRect.width
    if (left < padding) left = padding
    if (left + contentRect.width > window.innerWidth - padding) {
      left = Math.max(padding, window.innerWidth - contentRect.width - padding)
    }
    const top = triggerRect.bottom + 6
    setPosition({
      top,
      left,
      minWidth: Math.max(160, Math.ceil(triggerRect.width)),
    })
  }, [context.isOpen, children, context.triggerRef])

  const setRefs = React.useCallback((node: HTMLDivElement | null) => {
    contentRef.current = node
    if (typeof ref === 'function') {
      ref(node)
    } else if (ref) {
      (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
    }
  }, [ref])

  if (!context.isOpen) return null

  const contentNode = (
    <div
      ref={setRefs}
      className={`fixed z-50 min-w-[8rem] overflow-hidden rounded-md border border-slate-200 bg-white text-slate-950 shadow-md ${className}`}
      style={
        position
          ? { top: position.top, left: position.left, minWidth: position.minWidth }
          : { top: 0, left: 0, visibility: "hidden" }
      }
      {...props}
    >
      {children}
    </div>
  )

  if (typeof document === "undefined") {
    return contentNode
  }

  return createPortal(contentNode, document.body)
})
DropdownMenuContent.displayName = "DropdownMenuContent"

const DropdownMenuItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    children: React.ReactNode
  }
>(({ className = "", children, onClick, ...props }, ref) => {
  const context = React.useContext(DropdownMenuContext)
  if (!context) throw new Error("DropdownMenuItem must be used within DropdownMenu")

  return (
    <div
      ref={ref}
      className={`relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-slate-100 focus:bg-slate-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 ${className}`}
      onClick={(e) => {
        onClick?.(e)
        context.setIsOpen(false)
      }}
      {...props}
    >
      {children}
    </div>
  )
})
DropdownMenuItem.displayName = "DropdownMenuItem"

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem }

