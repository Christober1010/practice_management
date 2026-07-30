"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Multi-select filter (clients, staff, service codes, …) — Session Import style. */
export default function ReportFilterMultiSelect({
  options,
  selected,
  onChange,
  placeholder,
  disabled,
  searchPlaceholder = "Search…",
  emptySearchMessage = "No matches",
  className,
  triggerClassName,
  searchInputClassName,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef(null);

  const filteredOptions = useMemo(
    () => options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase())),
    [options, search]
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggle = (value) => {
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const summary =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label ?? "1 selected"
        : `${selected.length} selected`;

  return (
    <div ref={dropdownRef} className={cn("relative w-full min-w-[12rem]", className)}>
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        disabled={disabled}
        className={cn(
          "w-full justify-between font-normal border-slate-200 bg-transparent",
          !selected.length && "text-muted-foreground",
          triggerClassName
        )}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(!open);
          if (open) setSearch("");
        }}
      >
        <span className="truncate text-left">{summary}</span>
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      {open && (
        <div className="absolute z-50 w-full mt-2 border border-slate-200 rounded-lg shadow-lg bg-white">
          <div className="p-2 border-b border-slate-100">
            <Input
              placeholder={searchPlaceholder}
              value={search}
              className={cn(
                "border-slate-200 focus:border-teal-500 focus:ring-teal-500",
                searchInputClassName
              )}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => {
                e.stopPropagation();
              }}
            />
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-slate-500">{emptySearchMessage}</div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className="w-full px-3 py-2 flex items-center gap-2 text-sm text-left hover:bg-slate-100"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggle(option.value);
                  }}
                >
                  <Check
                    className={cn(
                      "h-4 w-4 shrink-0",
                      selected.includes(option.value) ? "opacity-100 text-teal-600" : "opacity-0"
                    )}
                  />
                  <span className="truncate" title={option.label}>
                    {option.label}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
