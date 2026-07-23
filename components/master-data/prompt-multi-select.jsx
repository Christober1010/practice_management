"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckIcon, ChevronDown, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Multi-select for master prompts (Configure Data / Targets).
 * Kept outside parent forms so open/search state is not reset on each parent render.
 */
export default function PromptMultiSelect({
  allPrompts = [],
  selectedIds = [],
  onChange,
  disabled = false,
  placeholder = "Select Prompts...",
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef(null);

  const selected = (selectedIds || []).map(String);

  const filteredOptions = Array.isArray(allPrompts)
    ? allPrompts.filter((option) =>
        String(option?.prompt_name || "")
          .toLowerCase()
          .includes(search.toLowerCase())
      )
    : [];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggle = (promptId) => {
    const id = String(promptId);
    if (selected.includes(id)) {
      onChange(selected.filter((item) => item !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  const remove = (promptId) => {
    const id = String(promptId);
    onChange(selected.filter((item) => item !== id));
  };

  const getPromptName = (promptId) => {
    const prompt = Array.isArray(allPrompts)
      ? allPrompts.find((p) => String(p.id) === String(promptId))
      : null;
    return prompt?.prompt_name || String(promptId);
  };

  return (
    <div ref={dropdownRef} className="relative">
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        className="w-full justify-between bg-transparent"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (disabled) return;
          setOpen((v) => !v);
          setSearch("");
        }}
      >
        {selected.length > 0
          ? `${selected.length} selected`
          : placeholder}
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      {open && !disabled && (
        <div className="absolute z-20 w-full p-0 mt-2 border border-slate-200 bg-white rounded-lg shadow-lg">
          <div className="p-2">
            <Input
              placeholder="Search prompts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="p-2 text-sm text-gray-500">
                {allPrompts?.length === 0
                  ? "No prompts available"
                  : "No results found"}
              </div>
            ) : (
              filteredOptions.map((option) => {
                const id = String(option.id);
                const isOn = selected.includes(id);
                return (
                  <div
                    key={id}
                    className="p-2 flex items-center space-x-2 cursor-pointer hover:bg-slate-100 text-sm"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggle(id);
                    }}
                  >
                    <CheckIcon
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        isOn ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {option.prompt_name}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {selected.map((promptId) => (
          <Badge
            key={promptId}
            variant="outline"
            className="flex items-center space-x-1 pr-1"
          >
            <span>{getPromptName(promptId)}</span>
            {!disabled && (
              <button
                type="button"
                onClick={() => remove(promptId)}
                className="p-0.5 rounded-full hover:bg-red-200 hover:text-red-800 transition-colors"
                aria-label={`Remove ${getPromptName(promptId)}`}
              >
                <XIcon className="h-3 w-3" />
              </button>
            )}
          </Badge>
        ))}
      </div>
    </div>
  );
}
