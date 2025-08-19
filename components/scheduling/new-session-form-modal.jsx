"use client"

import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import toast from "react-hot-toast"
import { Users, Clock, FileText } from "lucide-react"

const TIME_ZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Australia/Sydney",
]

const initialForm = {
  clientId: "",
  provider: "",
  supervisingProvider: "",
  recurring: "No",
  placeOfService: "Clinic",
  locationAddress: "",
  quickNote: "",
  startDateTime: "",
  startTZ: "",
  endDateTime: "",
  endTZ: "",
  authCode: "",
}

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL

export default function NewSessionFormModal({
  isOpen,
  onClose,
  onSave,
  editingSession = null,
  selectedDate = null,
  clients = [], // Added clients prop
}) {
  const [form, setForm] = useState(initialForm)
  const [errors, setErrors] = useState({})
  const [activeTab, setActiveTab] = useState("scheduling")
  const [staff, setStaff] = useState([])
  const [loadingStaff, setLoadingStaff] = useState(false)

  const tabOrder = ["scheduling", "notes"]

  // ✅ Fetch staff
  useEffect(() => {
    if (!isOpen || staff.length > 0) return

    const fetchStaff = async () => {
      setLoadingStaff(true)
      try {
        const res = await fetch(`${baseUrl}/staff.php`)
        const data = await res.json()
        if (data.staff_records && Array.isArray(data.staff_records)) {
          const activeStaff = data.staff_records.filter((s) => s.status === "Active" && s.archived !== "1")
          setStaff(activeStaff)
        } else {
          setStaff([])
        }
      } catch (err) {
        console.error("Error fetching staff:", err)
        toast.error("Failed to load providers")
        setStaff([])
      } finally {
        setLoadingStaff(false)
      }
    }
    fetchStaff()
  }, [isOpen, baseUrl])

  // ✅ Set default time zones
  useEffect(() => {
    if (!isOpen) return
    const localTZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
    setForm((prev) => ({
      ...prev,
      startTZ: prev.startTZ || localTZ,
      endTZ: prev.endTZ || localTZ,
    }))
  }, [isOpen])

  // ✅ Prefill edit/new session
  useEffect(() => {
    if (!isOpen) return

    if (editingSession) {
      console.log("[v0] Editing session data:", editingSession) // Debug log

      setForm({
        clientId: editingSession.clientId || "",
        provider: editingSession.providerId || "", // Fixed: use providerId instead of provider
        supervisingProvider: editingSession.supervisingProviderId || "", // Fixed: use supervisingProviderId
        recurring: editingSession.recurring || "No",
        placeOfService: editingSession.placeOfService || "Clinic",
        locationAddress: editingSession.locationAddress || "",
        quickNote: editingSession.quickNote || "",
        startDateTime: editingSession.startDateTime
          ? new Date(editingSession.startDateTime).toISOString().slice(0, 16)
          : "",
        startTZ: editingSession.startTZ || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        endDateTime: editingSession.endDateTime ? new Date(editingSession.endDateTime).toISOString().slice(0, 16) : "",
        endTZ: editingSession.endTZ || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        authCode: editingSession.authCode || "",
      })
      setActiveTab("scheduling")
      return
    }

    if (selectedDate) {
      const y = selectedDate.getFullYear()
      const m = String(selectedDate.getMonth() + 1).padStart(2, "0")
      const d = String(selectedDate.getDate()).padStart(2, "0")
      const defaultStart = `${y}-${m}-${d}T09:00`
      const defaultEnd = `${y}-${m}-${d}T10:00`
      setForm((prev) => ({
        ...initialForm,
        startDateTime: defaultStart,
        endDateTime: defaultEnd,
        startTZ: prev.startTZ || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        endTZ: prev.endTZ || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      }))
    }
    setActiveTab("scheduling")
  }, [isOpen, editingSession, selectedDate])

  const clientOptions = useMemo(() => {
    return clients.map((c) => ({
      id: c.client_id, // Use client_id from API response
      name: [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(" "),
      authorizations: Array.isArray(c.authorizations) ? c.authorizations : [],
    }))
  }, [clients])

  const selectedClient = useMemo(
    () => clientOptions.find((c) => c.id === form.clientId) || null,
    [clientOptions, form.clientId],
  )

  useEffect(() => {
    // Only reset auth code when changing client in new session mode, not when editing
    if (!editingSession) {
      setForm((prev) => ({ ...prev, authCode: "" }))
    }
  }, [form.clientId, editingSession])

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: null }))
  }

  // ✅ Validations
  const validateSchedulingTab = () => {
    const e = {}
    if (!form.clientId) e.clientId = "Required"
    if (!form.provider) e.provider = "Required"
    if (!form.placeOfService) e.placeOfService = "Required"
    if (!form.locationAddress.trim()) e.locationAddress = "Required"

    if (!form.startDateTime) e.startDateTime = "Required"
    if (!form.endDateTime) e.endDateTime = "Required"
    if (form.startDateTime && form.endDateTime && new Date(form.endDateTime) <= new Date(form.startDateTime)) {
      e.endDateTime = "End must be after Start"
    }

    if (!form.authCode) e.authCode = "Required"
    if (!form.startTZ) e.startTZ = "Required"
    if (!form.endTZ) e.endTZ = "Required"

    setErrors(e)
    return Object.keys(e).length > 0
  }

  const validateNotesTab = () => false

  const validators = {
    scheduling: validateSchedulingTab,
    notes: validateNotesTab,
  }

  const handleNextClick = (e) => {
    e.preventDefault() // Prevent form submission
    e.stopPropagation() // Stop event bubbling

    if (!validateSchedulingTab()) {
      setActiveTab("notes")
    }
  }

  const handleSubmit = async (e) => {
    e?.preventDefault()

    for (const tab of tabOrder) {
      const hasErrors = validators[tab]?.()
      if (hasErrors) {
        setActiveTab(tab)
        toast.error("Please fix errors before submitting.")
        return
      }
    }

    const clientName = selectedClient?.name || "Unknown"

    const payload = {
      clientId: form.clientId,
      clientName,
      ...(editingSession?.sessionId ? { therapist: form.provider } : { provider: form.provider }),
      supervisingProvider: form.supervisingProvider,
      startDateTime: form.startDateTime,
      endDateTime: form.endDateTime,
      startTZ: form.startTZ,
      endTZ: form.endTZ,
      authCode: form.authCode,
      recurring: form.recurring,
      placeOfService: form.placeOfService,
      locationAddress: form.locationAddress,
      quickNote: form.quickNote,
      status: "upcoming",
    }

    if (editingSession?.sessionId) {
      payload.session_id = editingSession.sessionId
    }

    console.log("[v0] Submitting payload:", payload) // Debug log

    try {
      const method = editingSession?.sessionId ? "PUT" : "POST"
      const res = await fetch(`${baseUrl}/add-session.php`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      console.log("[v0] API Response:", data) // Debug log

      if (res.ok && data.success) {
        toast.success(editingSession ? "Session updated!" : "Session scheduled!")
        onSave?.({ ...payload, sessionId: data.session_id || editingSession?.sessionId })
        onClose?.()
        setForm(initialForm)
        setErrors({})
      } else {
        console.error("[v0] API Error:", data) // Debug log
        toast.error(data.error || `Failed to ${editingSession ? "update" : "save"} session`)
      }
    } catch (err) {
      console.error("Submit error:", err)
      toast.error("Server error")
    }
  }

  // ⬇️ Helpers for inputs
  const renderInputWithError = (id, label, value, onChange, props = {}) => (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={onChange} className={errors[id] ? "border-red-500" : ""} {...props} />
      {errors[id] && <p className="text-red-500 text-sm">{errors[id]}</p>}
    </div>
  )

  const renderSelectWithError = (id, label, value, onValueChange, items, placeholder = "Select...") => (
    <div>
      <Label>{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className={errors[id] ? "border-red-500" : ""}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>{items}</SelectContent>
      </Select>
      {errors[id] && <p className="text-red-500 text-sm">{errors[id]}</p>}
    </div>
  )

  const handleClose = () => {
    setForm(initialForm)
    setErrors({}) // Clear errors on close
    onClose?.()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{editingSession ? "Edit Session" : "Add New Session"}</DialogTitle>
          <DialogDescription>Fill in details to schedule therapy session.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="scheduling" className="flex gap-2">
                <Users className="h-4 w-4" /> Scheduling
              </TabsTrigger>
              <TabsTrigger value="notes" className="flex gap-2">
                <FileText className="h-4 w-4" /> Notes
              </TabsTrigger>
            </TabsList>

            {/* ✅ Scheduling Tab */}
            <TabsContent value="scheduling">
              <Card>
                <CardHeader>
                  <CardTitle className="flex gap-2">
                    <Clock className="h-5 w-5 text-teal-600" /> Scheduling
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderSelectWithError(
                      "clientId",
                      "Client *",
                      form.clientId,
                      (v) => setField("clientId", v),
                      clients.map((c) => (
                        <SelectItem key={c.client_id} value={c.client_id}>
                          {[c.first_name, c.middle_name, c.last_name].filter(Boolean).join(" ")}
                        </SelectItem>
                      )),
                      "Select client",
                    )}

                    {renderSelectWithError(
                      "provider",
                      "Provider *",
                      form.provider,
                      (v) => setField("provider", v),
                      staff.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.fullName} ({s.staffType})
                        </SelectItem>
                      )),
                      "Select provider",
                    )}
                  </div>

                  {/* Supervising Provider */}
                  {renderSelectWithError(
                    "supervisingProvider",
                    "Supervising Provider",
                    form.supervisingProvider,
                    (v) => setField("supervisingProvider", v),
                    staff.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.fullName} ({s.staffType})
                      </SelectItem>
                    )),
                    "Select supervising provider",
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderInputWithError(
                      "startDateTime",
                      "Start Date & Time *",
                      form.startDateTime,
                      (e) => setField("startDateTime", e.target.value),
                      { type: "datetime-local" }, // ✅ allows past dates now
                    )}
                    {renderSelectWithError(
                      "startTZ",
                      "Start Time Zone *",
                      form.startTZ,
                      (v) => setField("startTZ", v),
                      TIME_ZONES.map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz}
                        </SelectItem>
                      )),
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderInputWithError(
                      "endDateTime",
                      "End Date & Time *",
                      form.endDateTime,
                      (e) => setField("endDateTime", e.target.value),
                      { type: "datetime-local" },
                    )}
                    {renderSelectWithError(
                      "endTZ",
                      "End Time Zone *",
                      form.endTZ,
                      (v) => setField("endTZ", v),
                      TIME_ZONES.map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz}
                        </SelectItem>
                      )),
                    )}
                  </div>

                  {renderSelectWithError(
                    "authCode",
                    "Authorization Code *",
                    form.authCode,
                    (v) => setField("authCode", v),
                    selectedClient?.authorizations?.map((a, i) => {
                      const code = a.billing_codes?.trim() || a.authorization_number?.trim()
                      return (
                        <SelectItem key={`${code}-${i}`} value={code}>
                          {code}
                        </SelectItem>
                      )
                    }) || [],
                    selectedClient ? "Select auth code" : "Select client first",
                  )}

                  {renderInputWithError(
                    "locationAddress",
                    "Location Address *",
                    form.locationAddress,
                    (e) => setField("locationAddress", e.target.value),
                    { placeholder: "Enter address" },
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ✅ Notes Tab */}
            <TabsContent value="notes">
              <Card>
                <CardHeader>
                  <CardTitle className="flex gap-2"> 
                    <FileText className="h-5 w-5 text-teal-600" /> Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Label>Quick Note</Label>
                  <Textarea rows={3} value={form.quickNote} onChange={(e) => setField("quickNote", e.target.value)} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Footer Buttons */}
          <div className="flex justify-between pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            {activeTab === "notes" ? (
              <Button type="submit" className="bg-teal-600 hover:bg-teal-700">
                {editingSession ? "Update Session" : "Add Session"}
              </Button>
            ) : (
              <Button type="button" className="bg-teal-600 hover:bg-teal-700" onClick={handleNextClick}>
                Next
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
