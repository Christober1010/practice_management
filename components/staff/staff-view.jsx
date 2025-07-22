"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Users, Plus, Search, Calendar, Edit, Archive, ArchiveRestore, Eye, Clock, MapPin } from "lucide-react"
import AddStaffModal from "./add-staff-modal"
import toast from "react-hot-toast"

export default function StaffView() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [showArchived, setShowArchived] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState(null)

  const [staff, setStaff] = useState([
    {
      id: "ST001",
      firstName: "Sarah",
      lastName: "Johnson",
      fullName: "Sarah Johnson",
      staffType: "RBT",
      certificationNumber: "RBT-2024-001",
      npiNumber: "1234567890",
      address: "123 Main Street, Springfield, IL 62701",
      email: "sarah.johnson@abacenter.com",
      phone: "(555) 123-4567",
      dateOfJoining: "2024-01-15",
      dateOfLeaving: "",
      status: "Active",
      availability: {
        monday: { available: true, start: "09:00", end: "17:00" },
        tuesday: { available: true, start: "09:00", end: "17:00" },
        wednesday: { available: true, start: "09:00", end: "17:00" },
        thursday: { available: true, start: "09:00", end: "17:00" },
        friday: { available: true, start: "09:00", end: "15:00" },
        saturday: { available: false, start: "", end: "" },
        sunday: { available: false, start: "", end: "" },
      },
      locationPreferences: {
        homeVisits: true,
        clinic: true,
        school: false,
        community: true,
      },
      archived: false,
    },
    {
      id: "ST002",
      firstName: "Dr. Emily",
      lastName: "Chen",
      fullName: "Dr. Emily Chen",
      staffType: "BCBA",
      certificationNumber: "BCBA-2024-002",
      npiNumber: "0987654321",
      address: "456 Oak Avenue, Springfield, IL 62702",
      email: "emily.chen@abacenter.com",
      phone: "(555) 234-5678",
      dateOfJoining: "2023-08-01",
      dateOfLeaving: "",
      status: "Active",
      availability: {
        monday: { available: true, start: "08:00", end: "16:00" },
        tuesday: { available: true, start: "08:00", end: "16:00" },
        wednesday: { available: true, start: "08:00", end: "16:00" },
        thursday: { available: true, start: "08:00", end: "16:00" },
        friday: { available: true, start: "08:00", end: "14:00" },
        saturday: { available: true, start: "10:00", end: "14:00" },
        sunday: { available: false, start: "", end: "" },
      },
      locationPreferences: {
        homeVisits: true,
        clinic: true,
        school: true,
        community: false,
      },
      archived: false,
    },
    {
      id: "ST003",
      firstName: "Jessica",
      lastName: "Martinez",
      fullName: "Jessica Martinez",
      staffType: "RBT",
      certificationNumber: "RBT-2024-003",
      npiNumber: "1122334455",
      address: "789 Pine Street, Springfield, IL 62703",
      email: "jessica.martinez@abacenter.com",
      phone: "(555) 345-6789",
      dateOfJoining: "2024-02-01",
      dateOfLeaving: "",
      status: "Active",
      availability: {
        monday: { available: true, start: "10:00", end: "18:00" },
        tuesday: { available: true, start: "10:00", end: "18:00" },
        wednesday: { available: false, start: "", end: "" },
        thursday: { available: true, start: "10:00", end: "18:00" },
        friday: { available: true, start: "10:00", end: "18:00" },
        saturday: { available: true, start: "09:00", end: "13:00" },
        sunday: { available: false, start: "", end: "" },
      },
      locationPreferences: {
        homeVisits: true,
        clinic: false,
        school: true,
        community: true,
      },
      archived: false,
    },
  ])

  const filteredStaff = staff.filter((member) => {
    const matchesSearch =
      member.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.certificationNumber.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || member.status === statusFilter
    const matchesType = typeFilter === "all" || member.staffType === typeFilter
    const matchesArchived = member.archived === showArchived

    return matchesSearch && matchesStatus && matchesType && matchesArchived
  })

  const handleAddStaff = (staffData) => {
    setStaff((prev) => [...prev, { ...staffData, archived: false }])
  }

  const handleEditStaff = (staffData) => {
    setStaff((prev) =>
      prev.map((member) => (member.id === staffData.id ? { ...staffData, archived: member.archived } : member)),
    )
    setEditingStaff(null)
  }

  const handleOpenEditModal = (member) => {
    const staffCopy = {
      ...member,
      firstName: member.firstName || "",
      lastName: member.lastName || "",
      staffType: member.staffType || "RBT",
      certificationNumber: member.certificationNumber || "",
      npiNumber: member.npiNumber || "",
      address: member.address || "",
      email: member.email || "",
      phone: member.phone || "",
      dateOfJoining: member.dateOfJoining || "",
      dateOfLeaving: member.dateOfLeaving || "",
      status: member.status || "Active",
      availability: member.availability || {},
      locationPreferences: member.locationPreferences || {},
    }
    setEditingStaff(staffCopy)
  }

  const handleArchiveStaff = (staffId) => {
    const member = staff.find((s) => s.id === staffId)
    if (!member) {
      toast.error("Staff member not found")
      return
    }

    const action = member.archived ? "restored" : "archived"
    setStaff((prev) =>
      prev.map((member) => (member.id === staffId ? { ...member, archived: !member.archived } : member)),
    )
    console.log(`Staff member ${member.fullName} ${action} successfully`)
  }

  const getStatusColor = (status) => {
    switch (status) {
      case "Active":
        return "bg-green-100 text-green-800"
      case "Inactive":
        return "bg-gray-100 text-gray-800"
      case "On Leave":
        return "bg-yellow-100 text-yellow-800"
      case "Terminated":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getTypeColor = (type) => {
    switch (type) {
      case "BCBA":
        return "bg-blue-100 text-blue-800"
      case "BCaBA":
        return "bg-purple-100 text-purple-800"
      case "RBT":
        return "bg-teal-100 text-teal-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getAvailableDays = (availability) => {
    const days = []
    Object.entries(availability).forEach(([day, schedule]) => {
      if (schedule.available) {
        days.push(day.charAt(0).toUpperCase() + day.slice(1, 3))
      }
    })
    return days.join(", ")
  }

  const getLocationPreferences = (preferences) => {
    const locations = []
    Object.entries(preferences).forEach(([location, available]) => {
      if (available) {
        locations.push(location.charAt(0).toUpperCase() + location.slice(1))
      }
    })
    return locations.join(", ")
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Staff Management</h2>
          <p className="text-slate-600 mt-1">Manage staff profiles and training records</p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" onClick={() => setShowArchived(!showArchived)} className="border-slate-300">
            {showArchived ? (
              <>
                <ArchiveRestore className="h-4 w-4 mr-2" />
                Show Active
              </>
            ) : (
              <>
                <Archive className="h-4 w-4 mr-2" />
                Show Archived
              </>
            )}
          </Button>
          <Button onClick={() => setIsAddModalOpen(true)} className="bg-teal-600 hover:bg-teal-700 shadow-lg">
            <Plus className="h-4 w-4 mr-2" />
            Add Staff
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="shadow-lg border-0">
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by name, staff ID, or certification number..."
                className="pl-10 border-slate-200 focus:border-teal-500 focus:ring-teal-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-48 border-slate-200">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="BCBA">BCBA</SelectItem>
                <SelectItem value="BCaBA">BCaBA</SelectItem>
                <SelectItem value="RBT">RBT</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48 border-slate-200">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
                <SelectItem value="On Leave">On Leave</SelectItem>
                <SelectItem value="Terminated">Terminated</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="border-slate-300 bg-transparent">
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Staff List */}
      <Card className="shadow-lg border-0">
        <CardHeader className="pb-4">
          <CardTitle className="text-slate-800 flex items-center">
            <Users className="h-5 w-5 mr-2 text-teal-600" />
            {showArchived ? "Archived" : "Active"} Staff ({filteredStaff.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredStaff.map((member) => (
              <div
                key={member.id}
                className="border border-slate-200 rounded-xl p-6 hover:shadow-md transition-shadow bg-white"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    <div className="bg-teal-100 p-4 rounded-xl">
                      <Users className="h-6 w-6 text-teal-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-slate-800">{member.fullName}</h3>
                        <Badge className={getTypeColor(member.staffType)}>{member.staffType}</Badge>
                        <Badge className={getStatusColor(member.status)}>{member.status}</Badge>
                        {member.archived && (
                          <Badge variant="outline" className="border-amber-300 text-amber-700">
                            Archived
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-slate-500">Staff ID:</p>
                          <p className="font-medium text-slate-800">{member.id}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Certification #:</p>
                          <p className="font-medium text-slate-800">{member.certificationNumber}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">NPI Number:</p>
                          <p className="font-medium text-slate-800">{member.npiNumber || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Email:</p>
                          <p className="font-medium text-slate-800">{member.email}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Date Joined:</p>
                          <p className="font-medium text-slate-800">
                            {new Date(member.dateOfJoining).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500">Phone:</p>
                          <p className="font-medium text-slate-800">{member.phone}</p>
                        </div>
                        <div className="col-span-full">
                          <p className="text-slate-500 flex items-center">
                            <Clock className="h-4 w-4 mr-1" />
                            Available Days:
                          </p>
                          <p className="font-medium text-slate-800">{getAvailableDays(member.availability)}</p>
                        </div>
                        <div className="col-span-full">
                          <p className="text-slate-500 flex items-center">
                            <MapPin className="h-4 w-4 mr-1" />
                            Location Preferences:
                          </p>
                          <p className="font-medium text-slate-800">
                            {getLocationPreferences(member.locationPreferences)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" className="border-slate-300 bg-transparent">
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEditModal(member)}
                      className="border-slate-300"
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleArchiveStaff(member.id)}
                      className="border-slate-300"
                    >
                      {member.archived ? (
                        <>
                          <ArchiveRestore className="h-4 w-4 mr-1" />
                          Restore
                        </>
                      ) : (
                        <>
                          <Archive className="h-4 w-4 mr-1" />
                          Archive
                        </>
                      )}
                    </Button>
                    <Button variant="outline" size="sm" className="border-slate-300 bg-transparent">
                      <Calendar className="h-4 w-4 mr-1" />
                      Schedule
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            {filteredStaff.length === 0 && (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-500">
                  {showArchived ? "No archived staff found." : "No staff found matching your criteria."}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Staff Modal */}
      <AddStaffModal
        isOpen={isAddModalOpen || editingStaff !== null}
        onClose={() => {
          setIsAddModalOpen(false)
          setEditingStaff(null)
        }}
        onSave={editingStaff ? handleEditStaff : handleAddStaff}
        editingStaff={editingStaff}
      />
    </div>
  )
}
