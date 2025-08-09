"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Users, Plus, Search, Calendar, Edit, Archive, ArchiveRestore, Eye, EyeOff, Clock, MapPin, Phone, MoreVertical } from 'lucide-react'
import AddStaffModal from "./add-staff-modal" // Changed from "@/components/add-staff-modal"
import toast, { Toaster } from "react-hot-toast"

// Define the base URL for your PHP API
// IMPORTANT: Replace with the actual URL where your staff.php is hosted
const API_BASE_URL = "https://www.mahabehavioralhealth.com/staff.php" // Example: "http://yourdomain.com/api/staff.php" or "/api/staff.php" if served from public/api

export default function StaffView() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [showArchived, setShowArchived] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState(null)
  const [staff, setStaff] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedStaff, setExpandedStaff] = useState(new Set())

  const activeStaffCount = staff.filter((member) => !member.archived).length
  const archivedStaffCount = staff.filter((member) => member.archived).length

  const fetchStaff = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}?showArchived=${showArchived}`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const result = await response.json()
      if (result.success) {
        setStaff(result.data)
      } else {
        toast.error(`Failed to fetch staff: ${result.message}`)
      }
    } catch (error) {
      console.error("Error fetching staff:", error)
      toast.error("Failed to load staff data.")
    } finally {
      setIsLoading(false)
    }
  }, [showArchived])

  useEffect(() => {
    fetchStaff()
  }, [fetchStaff])

  const filteredStaff = staff.filter((member) => {
    const matchesSearch =
      member.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.certificationNumber.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || member.status === statusFilter
    const matchesType = typeFilter === "all" || member.staffType === typeFilter
    return matchesSearch && matchesStatus && matchesType
  })

  const handleAddStaff = async (staffData) => {
    try {
      const response = await fetch(API_BASE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(staffData),
      })
      const result = await response.json()
      if (result.success) {
        toast.success("Staff added successfully!")
        fetchStaff() // Refresh the list
        setIsAddModalOpen(false) // Close modal after adding
      } else {
        toast.error(`Failed to add staff: ${result.message}`)
      }
    } catch (error) {
      console.error("Error adding staff:", error)
      toast.error("Failed to add staff member.")
    }
  }

  const handleEditStaff = async (staffData) => {
    try {
      const response = await fetch(API_BASE_URL, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(staffData),
      })
      const result = await response.json()
      if (result.success) {
        toast.success("Staff updated successfully!")
        fetchStaff() // Refresh the list
      } else {
        toast.error(`Failed to update staff: ${result.message}`)
      }
    } catch (error) {
      console.error("Error updating staff:", error)
      toast.error("Failed to update staff member.")
    } finally {
      setEditingStaff(null)
    }
  }

  const handleOpenEditModal = (member) => {
    // Ensure all nested objects are present to avoid errors in the form
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
      dateOfJoining: member.dateOfJoining?.slice(0, 10) || "", // Format date for input type="date"
      dateOfLeaving: member.dateOfLeaving?.slice(0, 10) || "", // Format date for input type="date"
      status: member.status || "Active",
      availability: member.availability || {},
      locationPreferences: member.locationPreferences || {},
    }
    setEditingStaff(staffCopy)
    setIsAddModalOpen(true)
  }

  const handleArchiveStaff = async (staffId) => {
    const member = staff.find((s) => s.id === staffId)
    if (!member) {
      toast.error("Staff member not found")
      return
    }

    const newArchivedStatus = !member.archived
    const action = newArchivedStatus ? "archived" : "restored"

    try {
      const response = await fetch(API_BASE_URL, {
        method: "DELETE", // Using DELETE method for this operation
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: staffId, archived: newArchivedStatus }),
      })
      const result = await response.json()
      if (result.success) {
        toast.success(`Staff member ${member.fullName} ${action} successfully!`)
        fetchStaff() // Refresh the list
      } else {
        toast.error(`Failed to ${action} staff: ${result.message}`)
      }
    } catch (error) {
      console.error(`Error ${action} staff:`, error)
      toast.error(`Failed to ${action} staff member.`)
    }
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

  const formatTimeForDisplay = (time24hr) => {
    if (!time24hr) return "N/A"
    const [hours, minutes] = time24hr.split(':').map(Number)
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const formattedHours = hours % 12 === 0 ? 12 : hours % 12
    return `${formattedHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${ampm}`
  }

  const getAvailableDays = (availability) => {
    if (!availability) return "N/A"
    const days = []
    Object.entries(availability).forEach(([day, schedule]) => {
      if (schedule.available) {
        days.push(day.charAt(0).toUpperCase() + day.slice(1, 3))
      }
    })
    return days.join(", ") || "None"
  }

  const getLocationPreferences = (preferences) => {
    if (!preferences) return "N/A"
    const locations = []
    Object.entries(preferences).forEach(([location, available]) => {
      if (available) {
        locations.push(location.charAt(0).toUpperCase() + location.slice(1))
      }
    })
    return locations.join(", ") || "None"
  }

  const toggleExpanded = (staffId) => {
    setExpandedStaff((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(staffId)) {
        newSet.delete(staffId)
      } else {
        newSet.add(staffId)
      }
      return newSet
    })
  }

  return (
    <div className="space-y-8 px-2 sm:px-0 md:px-6">
      <Toaster />
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row lg:justify-between sm:justify-center sm:items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Staff Management</h2>
          <p className="text-slate-600 mt-1">Manage staff profiles and information</p>
        </div>
        <div className="flex flex-row flex-wrap gap-2 sm:items-center sm:space-x-3 sm:justify-end">
          <Button variant="outline" size="sm" onClick={() => setShowArchived(!showArchived)} className="border-slate-300">
            {showArchived ? (
              <>
                <ArchiveRestore className="h-4 w-4 mr-2" /> Show Active ({activeStaffCount})
              </>
            ) : (
              <>
                <Archive className="h-4 w-4 mr-2" /> Show Archived ({archivedStaffCount})
              </>
            )}
          </Button>
          <Button onClick={() => setIsAddModalOpen(true)} size="sm" className="bg-teal-600 hover:bg-teal-700 shadow-lg">
            <Plus className="h-4 w-4 mr-2" /> Add Staff
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="shadow-lg border-0">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:space-x-4">
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
              <SelectTrigger className="w-full sm:w-48 border-slate-200">
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
              <SelectTrigger className="w-full sm:w-48 border-slate-200">
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
          </div>
        </CardContent>
      </Card>

      {/* Staff Table */}
      {isLoading ? (
        <div className="h-64 w-64 mx-auto">
          <p className="text-center animate-pulse text-gray-500">Fetching staff</p>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
            <radialGradient id="a8" cx=".66" fx=".66" cy=".3125" fy=".3125" gradientTransform="scale(1.5)">
              <stop offset="0" stopColor="#0C30FF" />
              <stop offset=".3" stopColor="#0C30FF" stopOpacity=".9" />
              <stop offset=".6" stopColor="#0C30FF" stopOpacity=".6" />
              <stop offset=".8" stopColor="#0C30FF" stopOpacity=".3" />
              <stop offset="1" stopColor="#0C30FF" stopOpacity="0" />
            </radialGradient>
            <circle
              transformOrigin="center"
              fill="none"
              stroke="url(#a8)"
              strokeWidth={15}
              strokeLinecap="round"
              strokeDasharray="200 1000"
              strokeDashoffset="0"
              cx={100}
              cy={100}
              r={70}
            >
              <animateTransform
                attributeName="transform"
                type="rotate"
                dur="2s"
                values="360;0"
                keyTimes="0;1"
                keySplines="0 0 1 1"
                calcMode="spline"
                repeatCount="indefinite"
              />
            </circle>
            <circle
              transformOrigin="center"
              fill="none"
              opacity={0.2}
              stroke="#0C30FF"
              strokeWidth={15}
              strokeLinecap="round"
              cx={100}
              cy={100}
              r={70}
            />
          </svg>
        </div>
      ) : (
        <Card className="shadow-lg border-0">
          <CardHeader className="pb-4">
            <CardTitle className="text-slate-800 flex items-center">
              <Users className="h-5 w-5 mr-2 text-teal-600" />
              {showArchived ? "Archived" : "Active"} Staff ({filteredStaff.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 border-b">
                    <TableHead className="font-semibold text-slate-700">Staff</TableHead>
                    <TableHead className="hidden sm:table-cell font-semibold text-slate-700">Staff ID</TableHead>
                    <TableHead className="hidden sm:table-cell font-semibold text-slate-700">Certification #</TableHead>
                    <TableHead className="hidden sm:table-cell font-semibold text-slate-700">NPI Number</TableHead>
                    <TableHead className="hidden sm:table-cell font-semibold text-slate-700">Contact</TableHead>
                    <TableHead className="hidden sm:table-cell font-semibold text-slate-700">Date Joined</TableHead>
                    <TableHead className="font-semibold text-slate-700 lg:text-center text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStaff.map((member) => {
                    const isExpanded = expandedStaff.has(member.id || "")
                    return (
                      <>
                        {/* Main Row */}
                        <TableRow key={member.id} className="hover:bg-slate-50 transition-colors border-b">
                          <TableCell className="lg:px-4 sm:px-2 py-4">
                            <div className="flex items-center space-x-3">
                              <span className="hidden sm:inline-block">
                                <div className="bg-teal-100 p-2 rounded-lg flex-shrink-0">
                                  <Users className="h-4 w-4 text-teal-600" />
                                </div>
                              </span>
                              <div>
                                <div className="font-semibold text-slate-800">{member.fullName}</div>
                                <div className="lg:visible sm:hidden flex flex-wrap gap-1 mt-1">
                                  <Badge className={getTypeColor(member.staffType)}>{member.staffType}</Badge>
                                  <Badge className={getStatusColor(member.status)}>{member.status}</Badge>
                                  {member.archived && (
                                    <Badge variant="outline" className="border-amber-300 text-amber-700 text-xs">
                                      Archived
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-4 hidden sm:table-cell">
                            <span className="font-mono text-sm">{member.id}</span>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell py-4">
                            <span className="font-mono text-sm">{member.certificationNumber}</span>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell py-4">
                            <span className="font-mono text-sm">{member.npiNumber || "N/A"}</span>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell py-4">
                            <div className="text-sm">
                              {member.phone && (
                                <div className="flex items-center gap-1">
                                  <Phone className="h-3 w-3 text-slate-400" />
                                  {member.phone}
                                </div>
                              )}
                              {member.email && <div className="text-slate-600 mt-1">{member.email}</div>}
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell py-4">
                            <div className="text-sm">
                              {new Date(member.dateOfJoining).toLocaleDateString()}
                            </div>
                          </TableCell>
                          <TableCell className="py-4">
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => toggleExpanded(member.id || "")}
                                className="border-slate-300"
                              >
                                {isExpanded ? (
                                  <span title="Hide">
                                    <EyeOff className="h-3 w-3 mr-1" />
                                  </span>
                                ) : (
                                  <span title="View">
                                    <Eye className="h-3 w-3 mr-1" />
                                  </span>
                                )}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenEditModal(member)}
                                className="border-slate-300"
                              >
                                <span title="Edit">
                                  <Edit className="h-4 w-4 mr-2" />
                                </span>
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    title="Options"
                                    variant="outline"
                                    size="sm"
                                    className="border-slate-300 bg-transparent"
                                  >
                                    <MoreVertical className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuItem>
                                    <Calendar className="h-4 w-4 mr-2" /> Schedule
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleArchiveStaff(member.id || "")}
                                    className={member.archived ? "text-green-600" : "text-amber-600"}
                                  >
                                    {member.archived ? (
                                      <>
                                        <ArchiveRestore className="h-4 w-4 mr-2" /> Restore Staff
                                      </>
                                    ) : (
                                      <>
                                        <Archive className="h-4 w-4 mr-2" /> Archive Staff
                                      </>
                                    )}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Expanded Details Row */}
                        {isExpanded && (
                          <TableRow className="bg-slate-50">
                            <TableCell colSpan={7} className="px-6 py-6">
                              <div className="space-y-6">
                                {/* Personal Information Section */}
                                <Card className="border-slate-200">
                                  <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-base">
                                      <Users className="h-4 w-4 text-teal-600" /> Personal Information
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent className="space-y-3 text-sm">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                      <div>
                                        <p className="text-slate-500 mb-1">First Name</p>
                                        <p className="font-medium">{member.firstName || "N/A"}</p>
                                      </div>
                                      <div>
                                        <p className="text-slate-500 mb-1">Last Name</p>
                                        <p className="font-medium">{member.lastName || "N/A"}</p>
                                      </div>
                                      <div>
                                        <p className="text-slate-500 mb-1">Email</p>
                                        <p className="font-medium">{member.email || "N/A"}</p>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                      <div>
                                        <p className="text-slate-500 mb-1">Phone</p>
                                        <p className="font-medium">{member.phone || "N/A"}</p>
                                      </div>
                                      <div>
                                        <p className="text-slate-500 mb-1">Date of Joining</p>
                                        <p className="font-medium">
                                          {member.dateOfJoining ? new Date(member.dateOfJoining).toLocaleDateString() : "N/A"}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-slate-500 mb-1">Date of Leaving</p>
                                        <p className="font-medium">
                                          {member.dateOfLeaving ? new Date(member.dateOfLeaving).toLocaleDateString() : "N/A"}
                                        </p>
                                      </div>
                                    </div>
                                    <div>
                                      <p className="text-slate-500 mb-1">Address</p>
                                      <p className="font-medium">{member.address || "N/A"}</p>
                                    </div>
                                  </CardContent>
                                </Card>

                                {/* Professional Information Section */}
                                <Card className="border-slate-200">
                                  <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-base">
                                      <Users className="h-4 w-4 text-teal-600" /> Professional Information
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent className="space-y-3 text-sm">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                      <div>
                                        <p className="text-slate-500 mb-1">Staff Type</p>
                                        <p className="font-medium">{member.staffType || "N/A"}</p>
                                      </div>
                                      <div>
                                        <p className="text-slate-500 mb-1">Certification #</p>
                                        <p className="font-medium">{member.certificationNumber || "N/A"}</p>
                                      </div>
                                      <div>
                                        <p className="text-slate-500 mb-1">NPI Number</p>
                                        <p className="font-medium">{member.npiNumber || "N/A"}</p>
                                      </div>
                                    </div>
                                    <div>
                                      <p className="text-slate-500 mb-1">Status</p>
                                      <p className="font-medium">{member.status || "N/A"}</p>
                                    </div>
                                  </CardContent>
                                </Card>

                                {/* Timing Availability */}
                                <Card className="border-slate-200">
                                  <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-base">
                                      <Clock className="h-4 w-4 mr-1" /> Timing Availability
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent className="space-y-3 text-sm">
                                    {Object.entries(member.availability || {}).map(([day, schedule]) => (
                                      <div key={day} className="flex justify-between items-center">
                                        <p className="text-slate-500 font-medium capitalize">{day}</p>
                                        <p className="font-medium">
                                          {schedule.available
                                            ? `${formatTimeForDisplay(schedule.start)} - ${formatTimeForDisplay(schedule.end)}`
                                            : "Not Available"}
                                        </p>
                                      </div>
                                    ))}
                                    {Object.keys(member.availability || {}).length === 0 && (
                                      <p className="text-slate-500 italic">No availability information.</p>
                                    )}
                                  </CardContent>
                                </Card>

                                {/* Location Preferences */}
                                <Card className="border-slate-200">
                                  <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-base">
                                      <MapPin className="h-4 w-4 mr-1" /> Location Preferences
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent className="space-y-3 text-sm">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      {Object.entries(member.locationPreferences || {}).map(([location, available]) => (
                                        <div key={location} className="flex items-center gap-2">
                                          <span className="text-slate-500 capitalize">{location}:</span>
                                          <Badge variant="outline" className={available ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                                            {available ? "Preferred" : "Not Preferred"}
                                          </Badge>
                                        </div>
                                      ))}
                                      {Object.keys(member.locationPreferences || {}).length === 0 && (
                                        <p className="text-slate-500 italic">No location preferences.</p>
                                      )}
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    )
                  })}
                </TableBody>
              </Table>
              {filteredStaff.length === 0 && !isLoading && (
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
      )}

      {/* Add/Edit Staff Modal */}
      <AddStaffModal
        isOpen={isAddModalOpen}
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
