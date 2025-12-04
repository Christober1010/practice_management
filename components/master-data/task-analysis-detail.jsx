"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { CheckCircle2, Plus, Trash2, Edit2 } from "lucide-react"
import { Toaster } from "react-hot-toast"
import toast from "react-hot-toast"
import { useAppDispatch, useAppSelector } from "@/app/store/hooks"
import { fetchPrograms } from "@/app/store/programSlice"

export default function TaskAnalysisDetail({ targetId, onBack }) {
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false)
  const [isAddPromptModalOpen, setIsAddPromptModalOpen] = useState(false)
  const [taskName, setTaskName] = useState("")
  const [promptText, setPromptText] = useState("")
  const [editingTaskId, setEditingTaskId] = useState(null)

  const dispatch = useAppDispatch()
  const programsData = useAppSelector((state) => state.programs.items)
  const loading = useAppSelector((state) => state.programs.loading)

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL

  // Get the specific target activity
  const currentTarget = useMemo(() => {
    if (!targetId || !programsData?.activities) return null
    return programsData.activities.find((a) => a.id === targetId)
  }, [targetId, programsData])

  const tasks = useMemo(() => {
    if (!currentTarget?.tasks) return []
    return currentTarget.tasks.sort((a, b) => (a.step_order || 0) - (b.step_order || 0))
  }, [currentTarget])

  const prompts = useMemo(() => {
    if (!currentTarget?.prompts) return []
    return currentTarget.prompts.sort((a, b) => (a.prompt_order || 0) - (b.prompt_order || 0))
  }, [currentTarget])

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => task.name?.toLowerCase().includes(searchTerm.toLowerCase()))
  }, [tasks, searchTerm])

  const getStatusColor = (status) => {
    switch (status) {
      case "Active":
        return "bg-green-100 text-green-800"
      case "Inactive":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const handleAddTask = async (e) => {
    e.preventDefault()
    if (!taskName.trim()) {
      toast.error("Task name is required")
      return
    }

    if (!currentTarget) return

    try {
      const newTask = {
        id: editingTaskId || `task_${Date.now()}`,
        name: taskName.trim(),
        status: "Active",
      }

      const updatedTasks = editingTaskId
        ? (currentTarget.tasks || []).map((t) => (t.id === editingTaskId ? newTask : t))
        : [...(currentTarget.tasks || []), newTask]

      const res = await fetch(`${baseUrl}/programs.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activities: [{ ...currentTarget, tasks: updatedTasks }],
        }),
      })
      const result = await res.json()
      if (result.success) {
        toast.success(editingTaskId ? "Task updated!" : "Task added!")
        setTaskName("")
        setEditingTaskId(null)
        setIsAddTaskModalOpen(false)
        dispatch(fetchPrograms())
      } else {
        toast.error(`Failed to save task: ${result.message || "Unknown error"}`)
      }
    } catch (err) {
      console.error("Error saving task:", err)
      toast.error("An error occurred while saving task.")
    }
  }

  const handleDeleteTask = async (taskId) => {
    if (!currentTarget) return

    try {
      const updatedTasks = currentTarget.tasks.filter((t) => t.id !== taskId)

      const res = await fetch(`${baseUrl}/programs.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activities: [{ ...currentTarget, tasks: updatedTasks }],
        }),
      })
      const result = await res.json()
      if (result.success) {
        toast.success("Task deleted!")
        dispatch(fetchPrograms())
      } else {
        toast.error(`Failed to delete task: ${result.message || "Unknown error"}`)
      }
    } catch (err) {
      console.error("Error deleting task:", err)
      toast.error("An error occurred while deleting task.")
    }
  }

  const handleAddPrompt = async (e) => {
    e.preventDefault()
    if (!promptText.trim()) {
      toast.error("Prompt text is required")
      return
    }

    if (!currentTarget) return

    try {
      const newPrompt = {
        id: `prompt_${Date.now()}`,
        prompt_text: promptText.trim(),
        status: "Active",
      }

      const updatedPrompts = [...(currentTarget.prompts || []), newPrompt]

      const res = await fetch(`${baseUrl}/programs.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activities: [{ ...currentTarget, prompts: updatedPrompts }],
        }),
      })
      const result = await res.json()
      if (result.success) {
        toast.success("Prompt added!")
        setPromptText("")
        setIsAddPromptModalOpen(false)
        dispatch(fetchPrograms())
      } else {
        toast.error(`Failed to add prompt: ${result.message || "Unknown error"}`)
      }
    } catch (err) {
      console.error("Error adding prompt:", err)
      toast.error("An error occurred while adding prompt.")
    }
  }

  useEffect(() => {
    dispatch(fetchPrograms())
  }, [dispatch])

  if (!currentTarget) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Target not found</p>
        {onBack && (
          <Button onClick={onBack} variant="outline" className="mt-4 bg-transparent">
            Go Back
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <Toaster />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">{currentTarget.name}</h2>
          <p className="text-slate-600 mt-1">Task Analysis Details</p>
          <div className="flex gap-2 mt-2">
            <Badge className={getStatusColor(currentTarget.status)}>{currentTarget.status}</Badge>
            <Badge variant="outline">Type: {currentTarget.activityType}</Badge>
          </div>
        </div>
        {onBack && (
          <Button onClick={onBack} variant="outline">
            Back
          </Button>
        )}
      </div>

      {/* Task Steps Section */}
      <Card className="shadow-lg border-0">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-slate-800 flex items-center">
              <CheckCircle2 className="h-5 w-5 mr-2 text-teal-600" />
              Task Steps ({filteredTasks.length})
            </CardTitle>
            <Button
              onClick={() => {
                setEditingTaskId(null)
                setTaskName("")
                setIsAddTaskModalOpen(true)
              }}
              size="sm"
              className="bg-teal-600 hover:bg-teal-700"
            >
              <Plus className="h-4 w-4 mr-2" /> Add Task Step
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredTasks.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No task steps added yet</p>
            ) : (
              filteredTasks.map((task, index) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-start gap-4 flex-1">
                    <div className="bg-teal-100 text-teal-700 rounded-full w-8 h-8 flex items-center justify-center font-semibold text-sm flex-shrink-0">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">{task.name}</p>
                      <p className="text-sm text-slate-600">Step Order: {task.step_order || index}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingTaskId(task.id)
                        setTaskName(task.name)
                        setIsAddTaskModalOpen(true)
                      }}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteTask(task.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Prompts Section */}
      <Card className="shadow-lg border-0">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-slate-800 flex items-center">
              <span className="h-5 w-5 mr-2 text-teal-600">💬</span>
              Prompts ({prompts.length})
            </CardTitle>
            <Button onClick={() => setIsAddPromptModalOpen(true)} size="sm" className="bg-teal-600 hover:bg-teal-700">
              <Plus className="h-4 w-4 mr-2" /> Add Prompt
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {prompts.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No prompts added yet</p>
          ) : (
            <div className="space-y-3">
              {prompts.map((prompt, index) => (
                <div key={prompt.id} className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-600">Prompt {index + 1}</p>
                      <p className="text-slate-800 mt-1">{prompt.prompt_text || prompt.text || prompt}</p>
                      <Badge className={getStatusColor(prompt.status)} variant="outline" >
                        {prompt.status || "Active"}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Task Modal */}
      <Dialog open={isAddTaskModalOpen} onOpenChange={setIsAddTaskModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTaskId ? "Edit Task Step" : "Add Task Step"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddTask} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task-name">Task Step Name</Label>
              <Textarea
                id="task-name"
                placeholder="Enter task step description"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                disabled={loading}
                rows={4}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAddTaskModalOpen(false)
                  setTaskName("")
                  setEditingTaskId(null)
                }}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : editingTaskId ? "Update Task" : "Add Task Step"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Prompt Modal */}
      <Dialog open={isAddPromptModalOpen} onOpenChange={setIsAddPromptModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Prompt</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddPrompt} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prompt-text">Prompt Text</Label>
              <Textarea
                id="prompt-text"
                placeholder="Enter prompt text"
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                disabled={loading}
                rows={4}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAddPromptModalOpen(false)
                  setPromptText("")
                }}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Adding..." : "Add Prompt"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}