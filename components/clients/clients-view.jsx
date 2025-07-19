"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Users, Plus, Search, Calendar, Edit, Archive, ArchiveRestore } from "lucide-react"
import AddClientModal from "./add-client-modal"

export default function ClientsView() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [showArchived, setShowArchived] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingClient, setEditingClient] = useState(null)

  const [clients, setClients] = useState([
    {
      id: "CL001",
      firstName: "Alex",
      lastName: "Rodriguez",
      fullName: "Alex Rodriguez",
      dob: "2017-03-15",
      address: "123 Oak Street, Springfield, IL 62701",
      parentGuardianName: "Maria Rodriguez",
      parentEmail: "maria.rodriguez@email.com",
      parentPhone: "(555) 123-4567",
      insuranceProvider: "Blue Cross Blue Shield",
      insuranceId: "BC123456789",
      groupNumber: "GRP001",
      status: "Active",
      authorizationNumber: "AUTH2024001",
      billingCodes: "97153, 97155",
      unitsApproved: "40",
      startDate: "2024-01-15",
      endDate: "2024-07-15",
      archived: false,
    },
    {
      id: "CL002",
      firstName: "Emma",
      lastName: "Wilson",
      fullName: "Emma Wilson",
      dob: "2019-08-22",
      address: "456 Pine Avenue, Springfield, IL 62702",
      parentGuardianName: "Jennifer Wilson",
      parentEmail: "jennifer.wilson@email.com",
      parentPhone: "(555) 234-5678",
      insuranceProvider: "Aetna",
      insuranceId: "AET987654321",
      groupNumber: "GRP002",
      status: "Active",
      authorizationNumber: "AUTH2024002",
      billingCodes: "97153, 97157",
      unitsApproved: "32",
      startDate: "2024-02-01",
      endDate: "2024-08-01",
      archived: false,
    },
    {
      id: "CL003",
      firstName: "Michael",
      lastName: "Chen",
      fullName: "Michael Chen",
      dob: "2015-11-10",
      address: "789 Maple Drive, Springfield, IL 62703",
      parentGuardianName: "David Chen",
      parentEmail: "david.chen@email.com",
      parentPhone: "(555) 345-6789",
      insuranceProvider: "United Healthcare",
      insuranceId: "UHC456789123",
      groupNumber: "GRP003",
      status: "On Hold",
      authorizationNumber: "AUTH2024003",
      billingCodes: "97153, 97155, 97157",
      unitsApproved: "48",
      startDate: "2023-12-01",
      endDate: "2024-06-01",
      archived: false,
    },
  ])

  const filteredClients = clients.filter((client) => {
    const matchesSearch =
      client.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.parentGuardianName.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || client.status === statusFilter
    const matchesArchived = client.archived === showArchived

    return matchesSearch && matchesStatus && matchesArchived
  })

  const handleAddClient = (clientData) => {
    setClients((prev) => [...prev, { ...clientData, archived: false }])
  }

  const handleEditClient = (clientData) => {
    setClients((prev) =>
      prev.map((client) => (client.id === clientData.id ? { ...clientData, archived: client.archived } : client)),
    )
    setEditingClient(null)
  }

  // Fixed: Create a proper function to handle opening edit modal
  const handleOpenEditModal = (client) => {
    // Create a deep copy of the client object to avoid reference issues
    const clientCopy = {
      ...client,
      // Ensure all fields are properly copied
      firstName: client.firstName || "",
      lastName: client.lastName || "",
      dob: client.dob || "",
      address: client.address || "",
      parentGuardianName: client.parentGuardianName || "",
      parentEmail: client.parentEmail || "",
      parentPhone: client.parentPhone || "",
      insuranceProvider: client.insuranceProvider || "",
      insuranceId: client.insuranceId || "",
      groupNumber: client.groupNumber || "",
      status: client.status || "Active",
      authorizationNumber: client.authorizationNumber || "",
      billingCodes: client.billingCodes || "",
      unitsApproved: client.unitsApproved || "",
      startDate: client.startDate || "",
      endDate: client.endDate || "",
    }
    setEditingClient(clientCopy)
  }

  const handleArchiveClient = (clientId) => {
    setClients((prev) =>
      prev.map((client) => (client.id === clientId ? { ...client, archived: !client.archived } : client)),
    )
  }

  const getStatusColor = (status) => {
    switch (status) {
      case "Active":
        return "bg-green-100 text-green-800"
      case "Inactive":
        return "bg-gray-100 text-gray-800"
      case "On Hold":
        return "bg-yellow-100 text-yellow-800"
      case "Discharged":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const calculateAge = (dob) => {
    const today = new Date()
    const birthDate = new Date(dob)
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }

    return age
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Client Management</h2>
          <p className="text-slate-600 mt-1">Manage client profiles and information</p>
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
            Add Client
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
                placeholder="Search by name, client ID, or parent name..."
                className="pl-10 border-slate-200 focus:border-teal-500 focus:ring-teal-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48 border-slate-200">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
                <SelectItem value="On Hold">On Hold</SelectItem>
                <SelectItem value="Discharged">Discharged</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="border-slate-300 bg-transparent">
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Client List */}
      <Card className="shadow-lg border-0">
        <CardHeader className="pb-4">
          <CardTitle className="text-slate-800 flex items-center">
            <Users className="h-5 w-5 mr-2 text-teal-600" />
            {showArchived ? "Archived" : "Active"} Clients ({filteredClients.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredClients.map((client) => (
              <div
                key={client.id}
                className="border border-slate-200 rounded-xl p-6 hover:shadow-md transition-shadow bg-white"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    <div className="bg-teal-100 p-4 rounded-xl">
                      <Users className="h-6 w-6 text-teal-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-slate-800">{client.fullName}</h3>
                        <Badge className={getStatusColor(client.status)}>{client.status}</Badge>
                        {client.archived && (
                          <Badge variant="outline" className="border-amber-300 text-amber-700">
                            Archived
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-slate-500">Client ID:</p>
                          <p className="font-medium text-slate-800">{client.id}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Age:</p>
                          <p className="font-medium text-slate-800">{calculateAge(client.dob)} years old</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Parent/Guardian:</p>
                          <p className="font-medium text-slate-800">{client.parentGuardianName}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Insurance:</p>
                          <p className="font-medium text-slate-800">{client.insuranceProvider}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Authorization:</p>
                          <p className="font-medium text-slate-800">{client.authorizationNumber}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Units Approved:</p>
                          <p className="font-medium text-slate-800">{client.unitsApproved} per 15 min</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEditModal(client)}
                      className="border-slate-300"
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleArchiveClient(client.id)}
                      className="border-slate-300"
                    >
                      {client.archived ? (
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

            {filteredClients.length === 0 && (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-500">
                  {showArchived ? "No archived clients found." : "No clients found matching your criteria."}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Client Modal */}
      <AddClientModal
        isOpen={isAddModalOpen || editingClient !== null}
        onClose={() => {
          setIsAddModalOpen(false)
          setEditingClient(null)
        }}
        onSave={editingClient ? handleEditClient : handleAddClient}
        editingClient={editingClient}
      />
    </div>
  )
}
