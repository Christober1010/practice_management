"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Users, Plus, Search, Calendar, Edit, Archive, ArchiveRestore } from "lucide-react"
import AddClientModal from "./add-client-modal"
import toast from "react-hot-toast"
import { Toaster } from "react-hot-toast" // Import Toaster component

// Helper to generate a simple UUID (for client-side ID generation)
function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    var r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// Define the Client interface for conceptual clarity in .jsx
/**
 * @typedef {object} Client
 * @property {string} id
 * @property {string} firstName
 * @property {string} lastName
 * @property {string} fullName - Derived from firstName and lastName
 * @property {string} dob - YYYY-MM-DD format
 * @property {string} address
 * @property {string} parentGuardianName
 * @property {string} parentEmail
 * @property {string} parentPhone
 * @property {string} insuranceProvider
 * @property {string} insuranceId
 * @property {string} groupNumber
 * @property {"Active" | "Inactive" | "On Hold" | "Discharged"} status
 * @property {string} authorizationNumber
 * @property {string} billingCodes
 * @property {number} unitsApproved
 * @property {string} startDate - YYYY-MM-DD format
 * @property {string} endDate - YYYY-MM-DD format
 * @property {boolean} archived
 */

export default function ClientsView() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [showArchived, setShowArchived] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  /** @type {Client | null} */
  const [editingClient, setEditingClient] = useState(null)
  /** @type {Client[]} */
  const [clients, setClients] = useState([])

  const filteredClients = clients.filter((client) => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase()

    // Check if any string or number field in the client matches the search term
    const matchesSearch = Object.values(client).some((value) => {
      if (typeof value === "string") {
        return value.toLowerCase().includes(lowerCaseSearchTerm)
      }
      if (typeof value === "number") {
        return String(value).includes(lowerCaseSearchTerm)
      }
      // Ignore boolean or other types for general text search
      return false
    })

    const matchesStatus = statusFilter === "all" || client.status === statusFilter

    // Filter based on showArchived state
    const matchesArchived = client.archived === showArchived

    return matchesSearch && matchesStatus && matchesArchived
  })

  /**
   * @param {Omit<Client, "id" | "fullName" | "archived">} clientData
   */
  const handleAddClient = async (clientData) => {
    const newClientWithId = {
      ...clientData,
      id: generateUUID(), // Generate a unique ID for new client
      fullName: `${clientData.firstName} ${clientData.lastName}`,
      archived: false, // New clients are not archived by default
    }

    try {
      const res = await fetch("https://www.mahabehavioralhealth.com/update-clients.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newClientWithId, archived: 0 }), // Send archived as 0 for PHP
      })
      const result = await res.json()

      if (res.ok && result.success) {
        setClients((prev) => [...prev, newClientWithId])
        setIsAddModalOpen(false) // Close modal on success
        toast.success("Client added successfully!")
      } else {
        toast.error(`Failed to add client: ${result.message || "Unknown error"}`)
        console.error("Add client error:", result)
      }
    } catch (err) {
      console.error("Add client fetch error:", err)
      toast.error("An error occurred while adding the client.")
    }
  }

  /**
   * @param {Client} clientData
   */
  const handleEditClient = async (clientData) => {
    try {
      const res = await fetch("https://www.mahabehavioralhealth.com/update-clients.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...clientData, archived: clientData.archived ? 1 : 0 }), // Send archived as 0 or 1 for PHP
      })
      const result = await res.json()

      if (res.ok && result.success) {
        setClients((prev) =>
          prev.map((client) =>
            client.id === clientData.id
              ? { ...clientData, fullName: `${clientData.firstName} ${clientData.lastName}` } // Update fullName on edit
              : client,
          ),
        )
        setEditingClient(null) // Clear editing state
        setIsAddModalOpen(false) // Close modal on success
        toast.success("Client updated successfully!")
      } else {
        toast.error(`Failed to update client: ${result.message || "Unknown error"}`)
        console.error("Edit client error:", result)
      }
    } catch (err) {
      console.error("Edit client fetch error:", err)
      toast.error("An error occurred while updating the client.")
    }
  }

  /**
   * @param {Client} client
   */
  const handleOpenEditModal = (client) => {
    setEditingClient(client)
    setIsAddModalOpen(true) // Open the modal
  }

  /**
   * @param {string} clientId
   */
  const handleArchiveClient = async (clientId) => {
    const clientToUpdate = clients.find((c) => c.id === clientId)
    if (!clientToUpdate) return

    const updatedClient = { ...clientToUpdate, archived: !clientToUpdate.archived }

    try {
      const res = await fetch("https://www.mahabehavioralhealth.com/update-clients.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...updatedClient, archived: updatedClient.archived ? 1 : 0 }), // Send archived as 0 or 1 for PHP
      })
      const result = await res.json()

      if (res.ok && result.success) {
        setClients((prev) => prev.map((c) => (c.id === clientId ? updatedClient : c)))
        toast.success(updatedClient.archived ? "Client archived successfully!" : "Client restored successfully!")
      } else {
        toast.error(`Failed to update client status: ${result.message || "Unknown error"}`)
        console.error("Archive/Restore error:", result)
      }
    } catch (err) {
      console.error("Archive/Restore fetch error:", err)
      toast.error("An error occurred while updating client status.")
    }
  }

  /**
   * @param {Client["status"]} status
   */
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

  /**
   * @param {string} dob - YYYY-MM-DD format
   */
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

  const fetchClients = async () => {
    try {
      const res = await fetch("https://www.mahabehavioralhealth.com/get-clients.php")
      const json = await res.json()

      if (json.success && Array.isArray(json.clients)) {
        const formattedClients = json.clients.map((client) => ({
          ...client,
          fullName: `${client.firstName || ""} ${client.lastName || ""}`.trim(), // Ensure fullName is always present
          status: client.STATUS || "Active", // Map PHP's STATUS to client's status
          archived: client.archived == 1, // Cast 0/1 to boolean
          dob: client.dob ? client.dob.slice(0, 10) : "", // Slice date string to YYYY-MM-DD
          startDate: client.startDate ? client.startDate.slice(0, 10) : "", // Slice date string
          endDate: client.endDate ? client.endDate.slice(0, 10) : "", // Slice date string
          unitsApproved: Number(client.unitsApproved) || 0, // Ensure unitsApproved is a number
        }))
        setClients(formattedClients)
      } else {
        console.error("Failed to fetch clients:", json.message)
        toast.error(`Failed to fetch clients: ${json.message || "Unknown error"}`)
      }
    } catch (error) {
      console.error("Fetch error:", error)
      toast.error("An error occurred while fetching clients.")
    }
  }

  useEffect(() => {
    fetchClients()
  }, [])

  return (
    <div className="space-y-8">
      <Toaster /> {/* Toaster component for displaying toasts */}
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
                placeholder="Search all client fields..."
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
        isOpen={isAddModalOpen} // Only open if explicitly requested or editing
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
