"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { FileText, Plus, Save, Send } from "lucide-react"

export default function SessionsView() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Session Notes</h2>
          <p className="text-slate-600 mt-1">Document and track therapy sessions</p>
        </div>
        <Button className="bg-teal-600 hover:bg-teal-700 shadow-lg">
          <Plus className="h-4 w-4 mr-2" />
          New Session Note
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* SOAP Note Form */}
        <Card className="lg:col-span-2 shadow-lg border-0">
          <CardHeader className="pb-4">
            <CardTitle className="text-slate-800 flex items-center">
              <FileText className="h-5 w-5 mr-2 text-teal-600" />
              SOAP Note Template
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="subjective" className="text-slate-700 font-medium">
                Subjective
              </Label>
              <Textarea
                id="subjective"
                className="mt-2 min-h-[100px] border-slate-200 focus:border-teal-500 focus:ring-teal-500"
                placeholder="Client's behavior, mood, and any relevant observations from today's session..."
              />
            </div>

            <div>
              <Label htmlFor="objective" className="text-slate-700 font-medium">
                Objective
              </Label>
              <Textarea
                id="objective"
                className="mt-2 min-h-[100px] border-slate-200 focus:border-teal-500 focus:ring-teal-500"
                placeholder="Measurable data, trial counts, percentages, and concrete observations..."
              />
            </div>

            <div>
              <Label htmlFor="assessment" className="text-slate-700 font-medium">
                Assessment
              </Label>
              <Textarea
                id="assessment"
                className="mt-2 min-h-[100px] border-slate-200 focus:border-teal-500 focus:ring-teal-500"
                placeholder="Analysis of progress toward goals and clinical interpretation..."
              />
            </div>

            <div>
              <Label htmlFor="plan" className="text-slate-700 font-medium">
                Plan
              </Label>
              <Textarea
                id="plan"
                className="mt-2 min-h-[100px] border-slate-200 focus:border-teal-500 focus:ring-teal-500"
                placeholder="Next steps, recommendations, and future session planning..."
              />
            </div>

            <div className="flex space-x-4 pt-4">
              <Button variant="outline" className="border-slate-300 bg-transparent">
                <Save className="h-4 w-4 mr-2" />
                Save Draft
              </Button>
              <Button className="bg-teal-600 hover:bg-teal-700">
                <Send className="h-4 w-4 mr-2" />
                Submit for Approval
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Session Details Sidebar */}
        <Card className="shadow-lg border-0">
          <CardHeader className="pb-4">
            <CardTitle className="text-slate-800">Session Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-slate-700 font-medium">Client</Label>
              <Select>
                <SelectTrigger className="mt-1 border-slate-200 focus:border-teal-500 focus:ring-teal-500">
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alex">Alex Rodriguez</SelectItem>
                  <SelectItem value="emma">Emma Wilson</SelectItem>
                  <SelectItem value="michael">Michael Chen</SelectItem>
                  <SelectItem value="sophia">Sophia Kim</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-slate-700 font-medium">Date & Time</Label>
              <Input
                type="datetime-local"
                className="mt-1 border-slate-200 focus:border-teal-500 focus:ring-teal-500"
              />
            </div>

            <div>
              <Label className="text-slate-700 font-medium">Duration (minutes)</Label>
              <Input
                type="number"
                placeholder="90"
                className="mt-1 border-slate-200 focus:border-teal-500 focus:ring-teal-500"
              />
            </div>

            <div>
              <Label className="text-slate-700 font-medium">Location</Label>
              <Select>
                <SelectTrigger className="mt-1 border-slate-200 focus:border-teal-500 focus:ring-teal-500">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="home">Home Visit</SelectItem>
                  <SelectItem value="clinic">Clinic</SelectItem>
                  <SelectItem value="school">School</SelectItem>
                  <SelectItem value="community">Community</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="border-t border-slate-200 pt-4">
              <h4 className="font-medium text-slate-800 mb-3">Digital Signature</h4>
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-teal-400 transition-colors cursor-pointer">
                <FileText className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Click to add signature</p>
              </div>
            </div>

            <div className="bg-teal-50 rounded-xl p-4">
              <h4 className="font-medium text-teal-800 mb-2">Session Goals</h4>
              <ul className="text-sm text-teal-700 space-y-1">
                <li>• Increase verbal requests by 20%</li>
                <li>• Practice social greetings</li>
                <li>• Work on daily living skills</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
