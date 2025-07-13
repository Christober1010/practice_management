"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function NewSessionFormModal({ isOpen, onClose, onSave }) {
  const [clientName, setClientName] = useState("")
  const [therapist, setTherapist] = useState("")
  const [sessionType, setSessionType] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [duration, setDuration] = useState("")
  const [location, setLocation] = useState("")

  const handleSubmit = () => {
    if (!clientName || !therapist || !sessionType || !date || !time || !duration || !location) {
      alert("Please fill in all fields.")
      return
    }

    const newSession = {
      client: clientName,
      therapist: therapist,
      type: sessionType,
      time: `${time} - ${Number.parseInt(time.split(":")[0]) + Math.floor(duration / 60)}:${String(duration % 60).padStart(2, "0")} ${Number.parseInt(time.split(":")[0]) >= 12 ? "PM" : "AM"}`, // Basic time calculation
      date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      duration: `${duration} minutes`,
      location: location,
      status: "upcoming", // Default status for new sessions
    }
    onSave(newSession)
    onClose()
    // Reset form fields
    setClientName("")
    setTherapist("")
    setSessionType("")
    setDate("")
    setTime("")
    setDuration("")
    setLocation("")
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Session</DialogTitle>
          <DialogDescription>Enter the details for the new therapy session.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="clientName" className="text-right">
              Client Name
            </Label>
            <Input
              id="clientName"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="therapist" className="text-right">
              Therapist
            </Label>
            <Input
              id="therapist"
              value={therapist}
              onChange={(e) => setTherapist(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="sessionType" className="text-right">
              Session Type
            </Label>
            <Select value={sessionType} onValueChange={setSessionType}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ABA Therapy">ABA Therapy</SelectItem>
                <SelectItem value="Social Skills">Social Skills</SelectItem>
                <SelectItem value="Communication">Communication</SelectItem>
                <SelectItem value="BCBA Supervision">BCBA Supervision</SelectItem>
                <SelectItem value="Parent Training">Parent Training</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="date" className="text-right">
              Date
            </Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="time" className="text-right">
              Time
            </Label>
            <Input
              id="time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="duration" className="text-right">
              Duration (min)
            </Label>
            <Input
              id="duration"
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="location" className="text-right">
              Location
            </Label>
            <Select value={location} onValueChange={setLocation}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Home Visit">Home Visit</SelectItem>
                <SelectItem value="Clinic">Clinic</SelectItem>
                <SelectItem value="School">School</SelectItem>
                <SelectItem value="Virtual">Virtual</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Save Session</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
