"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import toast from "react-hot-toast"

interface Module {
  id: string
  name: string
  description: string
  status: string
  archived: boolean
}

interface AddModuleModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (module: any) => Promise<void>
  onEdit?: (module: any) => Promise<void>
  loading: boolean
  editingModule?: Module | null
}

export default function AddModuleModal({
  isOpen,
  onClose,
  onAdd,
  onEdit,
  loading,
  editingModule,
}: AddModuleModalProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")

  useEffect(() => {
    if (editingModule) {
      setName(editingModule.name)
      setDescription(editingModule.description)
    } else {
      setName("")
      setDescription("")
    }
  }, [editingModule, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error("Module name is required")
      return
    }

    try {
      if (editingModule) {
        const updatedModule = {
          id: editingModule.id,
          name: name.trim(),
          description: description.trim(),
          status: editingModule.status,
          archived: editingModule.archived,
        }
        await onEdit?.(updatedModule)
      } else {
        const newModule = {
          id: `module_${Date.now()}`,
          name: name.trim(),
          description: description.trim(),
          status: "Active",
          archived: 0,
        }
        await onAdd(newModule)
      }
      setName("")
      setDescription("")
      onClose()
    } catch (error) {
      console.error("Error saving module:", error)
      toast.error("Failed to save module")
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editingModule ? "Edit Module" : "Add New Module"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="module-name">Module Name</Label>
            <Input
              id="module-name"
              placeholder="Enter module name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="module-description">Description (optional)</Label>
            <Textarea
              id="module-description"
              placeholder="Enter module description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : editingModule ? "Update Module" : "Add Module"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
