"use client"

import type React from "react"

import { ChevronRight } from "lucide-react"

interface BreadcrumbItem {
  label: string
  icon?: React.ReactNode
}

interface BreadcrumbDisplayProps {
  items: BreadcrumbItem[]
  className?: string
}

export function BreadcrumbDisplay({ items, className = "" }: BreadcrumbDisplayProps) {
  return (
    <div className={`flex items-center gap-2 text-sm text-slate-600 ${className}`}>
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          {item.icon && <span className="text-teal-600">{item.icon}</span>}
          <span className="font-medium text-slate-700">{item.label}</span>
          {index < items.length - 1 && <ChevronRight className="h-4 w-4 text-slate-400" />}
        </div>
      ))}
    </div>
  )
}
