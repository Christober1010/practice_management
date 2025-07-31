"use client"
import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Users,
  Plus,
  Search,
  Calendar,
  Edit,
  Archive,
  ArchiveRestore,
  Eye,
  EyeOff,
  FileText,
  Shield,
  Phone,
  MapPin,
  Heart,
  User,
  MoreVertical,
  File,
} from "lucide-react"
import AddClientModal from "./add-client-modal"
import toast, { Toaster } from "react-hot-toast"

function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0,
      v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function generateClientUUID() {
  return Math.floor(Math.random() * 9999999999999999)
    .toString()
    .padStart(16, "0")
}

export default function ClientsView() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [showArchived, setShowArchived] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingClient, setEditingClient] = useState(null)
  const [clients, setClients] = useState([])
  const [expandedClients, setExpandedClients] = useState(new Set())

  const activeClientCount = clients.filter((client) => !client.archived).length
  const archivedClientCount = clients.filter((client) => client.archived).length

  const filteredClients = clients.filter((client) => {
    const matchesSearch = Object.values(client).some((value) =>
      typeof value === "string"
        ? value.toLowerCase().includes(searchTerm.toLowerCase())
        : typeof value === "number"
          ? String(value).includes(searchTerm)
          : false,
    )
    const matchesStatus = statusFilter === "all" || client.client_status === statusFilter
    const matchesArchived = client.archived === showArchived
    return matchesSearch && matchesStatus && matchesArchived
  })

  const handleAddClient = async (clientData) => {
    const newClient = {
      ...clientData,
      id: generateUUID(), // This will be mapped to client_id in PHP
      client_id: "", // Will be set to 'id' value before sending
      client_uuid: generateClientUUID(),
      archived: false,
    }
    // Set client_id equal to id for backend consistency
    newClient.client_id = newClient.id

    try {
      const res = await fetch("https://www.mahabehavioralhealth.com/update-clients.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newClient,
          archived: 0, // Ensure archived is sent as 0 for new clients
        }),
      })
      const result = await res.json()
      if (result.success) {
        setClients((prev) => [...prev, newClient])
        setIsAddModalOpen(false)
        fetchClients() // Re-fetch to get fresh data including new IDs
        toast.success("Client added successfully!")
      } else {
        toast.error(`Failed to add client: ${result.message || "Unknown error"}`)
      }
    } catch (err) {
      console.error("Error adding client:", err)
      toast.error("An error occurred while adding the client.")
    }
  }

  const handleEditClient = async (clientData) => {
    try {
      const res = await fetch("https://www.mahabehavioralhealth.com/update-clients.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...clientData,
          archived: clientData.archived ? 1 : 0,
        }),
      })
      const result = await res.json()
      if (result.success) {
        setClients((prev) => prev.map((client) => (client.id === clientData.id ? clientData : client)))
        setEditingClient(null)
        setIsAddModalOpen(false)
        fetchClients() // Re-fetch to get fresh data
        toast.success("Client updated successfully!")
      } else {
        toast.error(`Failed to update client: ${result.message || "Unknown error"}`)
      }
    } catch (err) {
      console.error("Error updating client:", err)
      toast.error("An error occurred while updating the client.")
    }
  }

  const handleOpenEditModal = (client) => {
    setEditingClient(client)
    setIsAddModalOpen(true)
  }

  const handleArchiveClient = async (clientId) => {
    const clientToUpdate = clients.find((c) => c.id === clientId)
    if (!clientToUpdate) return

    const updatedClient = {
      ...clientToUpdate,
      archived: !clientToUpdate.archived,
    }

    try {
      const res = await fetch("https://www.mahabehavioralhealth.com/update-clients.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...updatedClient,
          archived: updatedClient.archived ? 1 : 0,
        }),
      })
      const result = await res.json()
      if (res.ok && result.success) {
        setClients((prev) => prev.map((c) => (c.id === clientId ? updatedClient : c)))
        toast.success(updatedClient.archived ? "Client archived!" : "Client restored!")
      } else {
        toast.error(`Failed to update client: ${result.message || "Unknown error"}`)
      }
    } catch (err) {
      console.error("Error archiving/restoring client:", err)
      toast.error("An error occurred while updating client status.")
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case "Active":
        return "bg-green-100 text-green-800"
      case "Inactive":
        return "bg-gray-100 text-gray-800"
      case "Benefits Verification":
        return "bg-blue-100 text-blue-800"
      case "Prior Authorization":
        return "bg-yellow-100 text-yellow-800"
      case "Client Assessment":
        return "bg-purple-100 text-purple-800"
      case "Pending Authorization":
        return "bg-orange-100 text-orange-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const calculateAge = (dob) => {
    if (!dob) return "N/A"
    const today = new Date()
    const birthDate = new Date(dob)
    let age = today.getFullYear() - birthDate.getFullYear()
    const m = today.getMonth() - birthDate.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }
    return age
  }

  const fetchClients = async () => {
    try {
      const res = await fetch("https://www.mahabehavioralhealth.com/get-clients.php")
      const json = await res.json()

      if (json.success && Array.isArray(json.clients)) {
        const formattedClients = json.clients.map((client) => {
          // Ensure insurances is always an array
          const insurances = Array.isArray(client.insurances) ? client.insurances : []

          // Map authorizations: convert DB insurance_id to insurances[] index for UI <Select>
          const authorizations = Array.isArray(client.authorizations)
            ? client.authorizations.map((auth) => {
                let index = ""
                if (insurances.length && auth.insurance_id) {
                  index = insurances.findIndex((ins) => String(ins.insurance_id) === String(auth.insurance_id))
                  // If not found, fallback to "", else string index
                  index = index === -1 ? "" : String(index)
                }
                return {
                  ...auth,
                  insurance_id: index, // UI expects String index
                }
              })
            : []

          // Ensure documents is always an array
          const documents = Array.isArray(client.documents) ? client.documents : []

          return {
            ...client,
            id: client.client_id || client.id, // Use client_id as the primary ID for frontend
            client_id: client.client_id || client.id, // Ensure client_id is present
            first_name: client.first_name || client.firstName || "",
            last_name: client.last_name || client.lastName || "",
            date_of_birth: client.date_of_birth?.slice(0, 10) || "",
            client_status: client.client_status || client.STATUS || "Active",
            archived: client.archived == 1,
            insurances,
            authorizations,
            documents, // Add documents to the client object
          }
        })
        setClients(formattedClients)
      } else {
        toast.error(`Failed to fetch: ${json.message || "Unknown error"}`)
      }
    } catch (err) {
      console.error("Error fetching clients:", err)
      toast.error("An error occurred while fetching clients.")
    }
  }

  useEffect(() => {
    fetchClients()
  }, [])

  const toggleExpanded = (clientId) => {
    setExpandedClients((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(clientId)) {
        newSet.delete(clientId)
      } else {
        newSet.add(clientId)
      }
      return newSet
    })
  }

  return (
    <div className="space-y-8 px-2 sm:px-0 md:px-6">
      <Toaster />
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row lg:justify-between sm:justify-center sm:items-center ">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Client Management</h2>
          <p className="text-slate-600 mt-1">Manage client profiles and information</p>
        </div>
        <div className="flex flex-row flex-wrap gap-2 sm:items-center sm:space-x-3 sm:justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowArchived(!showArchived)}
            className="border-slate-300"
          >
            {showArchived ? (
              <>
                <ArchiveRestore className="h-4 w-4 mr-2" />
                Show Active ({activeClientCount})
              </>
            ) : (
              <>
                <Archive className="h-4 w-4 mr-2" />
                Show Archived ({archivedClientCount})
              </>
            )}
          </Button>
          <Button onClick={() => setIsAddModalOpen(true)} size="sm" className="bg-teal-600 hover:bg-teal-700 shadow-lg">
            <Plus className="h-4 w-4 mr-2" />
            Add Client
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
                placeholder="Search all client fields..."
                className="pl-10 border-slate-200 focus:border-teal-500 focus:ring-teal-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48 border-slate-200">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="New">New</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
                <SelectItem value="Benefits Verification">Benefits Verification</SelectItem>
                <SelectItem value="Prior Authorization">Prior Authorization</SelectItem>
                <SelectItem value="Client Assessment">Client Assessment</SelectItem>
                <SelectItem value="Pending Authorization">Pending Authorization</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Client Table */}
      <Card className="shadow-lg border-0">
        <CardHeader className="pb-4">
          <CardTitle className="text-slate-800 flex items-center">
            <Users className="h-5 w-5 mr-2 text-teal-600" />
            {showArchived ? "Archived" : "Active"} Clients ({filteredClients.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 border-b">
                  <TableHead className="font-semibold text-slate-700">Client</TableHead>
                  {/* HIDE all these columns in mobile: */}
                  <TableHead className="hidden sm:table-cell font-semibold text-slate-700">Client ID</TableHead>
                  <TableHead className="hidden sm:table-cell font-semibold text-slate-700">Age</TableHead>
                  <TableHead className="hidden sm:table-cell font-semibold text-slate-700">Gender</TableHead>
                  <TableHead className="hidden sm:table-cell font-semibold text-slate-700">Language</TableHead>
                  <TableHead className="hidden sm:table-cell font-semibold text-slate-700">Status</TableHead>
                  <TableHead className="hidden sm:table-cell font-semibold text-slate-700">Contact</TableHead>
                  <TableHead className="font-semibold text-slate-700 lg:text-center text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((client) => {
                  const isExpanded = expandedClients.has(client.id || "")
                  return (
                    <>
                      {/* Main Row */}
                      <TableRow key={client.id} className="hover:bg-slate-50 transition-colors border-b">
                        <TableCell className="lg:px-4 sm:px-2 py-4">
                          <div className="flex items-center space-x-3">
                            {/* User icon visible only on >=sm screens  */}
                            <span className="hidden sm:inline-block">
                              <div className="bg-teal-100 p-2 rounded-lg flex-shrink-0">
                                <Users className="h-4 w-4 text-teal-600" />
                              </div>
                            </span>
                            <div>
                              <div className="font-semibold text-slate-800">
                                {client.first_name} {client.middle_name} {client.last_name}
                              </div>
                              <div className="lg:visible sm:hidden flex flex-wrap gap-1 mt-1">
                                {client.wait_list_status === "Yes" && (
                                  <Badge variant="outline" className=" border-yellow-300 text-yellow-700 text-xs">
                                    Wait List
                                  </Badge>
                                )}
                                {client.archived && (
                                  <Badge variant="outline" className="border-amber-300 text-amber-700 text-xs">
                                    Archived
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-4 hidden sm:table-cell">
                          <span className="font-mono text-sm">{client.client_uuid}</span>
                        </TableCell>
                        {/* Hide these columns on mobile */}
                        <TableCell className="hidden sm:table-cell py-4">
                          {calculateAge(client.date_of_birth)} years
                        </TableCell>
                        <TableCell className="hidden sm:table-cell py-4">{client.gender || "N/A"}</TableCell>
                        <TableCell className="hidden sm:table-cell py-4">
                          {client.preferred_language || "N/A"}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell py-4">
                          <Badge className={getStatusColor(client.client_status)}>{client.client_status}</Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell py-4">
                          <div className="text-sm">
                            {client.phone && (
                              <div className="flex items-center gap-1">
                                <Phone className="h-3 w-3 text-slate-400" />
                                {client.phone}
                              </div>
                            )}
                            {client.email && <div className="text-slate-600 mt-1">{client.email}</div>}
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleExpanded(client.id || "")}
                              className="border-slate-300"
                            >
                              {isExpanded ? (
                                <>
                                  <EyeOff className="h-3 w-3 mr-1" />
                                  Hide
                                </>
                              ) : (
                                <>
                                  <Eye className="h-3 w-3 mr-1" />
                                  View more
                                </>
                              )}
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="border-slate-300 bg-transparent">
                                  <MoreVertical className="h-3 w-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => handleOpenEditModal(client)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit Client
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Calendar className="h-4 w-4 mr-2" />
                                  Schedule Appointment
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleArchiveClient(client.id || "")}
                                  className={client.archived ? "text-green-600" : "text-amber-600"}
                                >
                                  {client.archived ? (
                                    <>
                                      <ArchiveRestore className="h-4 w-4 mr-2" />
                                      Restore Client
                                    </>
                                  ) : (
                                    <>
                                      <Archive className="h-4 w-4 mr-2" />
                                      Archive Client
                                    </>
                                  )}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Expanded Details Row - always full width, always visible */}
                      {isExpanded && (
                        <TableRow className="bg-slate-50">
                          <TableCell colSpan={8} className="px-6 py-6">
                            <div className="space-y-6">
                              {/* Contact Information */}
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <Card className="border-slate-200">
                                  <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-base">
                                      <MapPin className="h-4 w-4 text-teal-600" />
                                      Address Information
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent className="space-y-3 text-sm">
                                    <div>
                                      <p className="text-slate-500 mb-1">Street Address</p>
                                      <p className="font-medium">
                                        {client.address_line_1 || "Not specified"}
                                        {client.address_line_2 && (
                                          <>
                                            <br />
                                            {client.address_line_2}
                                          </>
                                        )}
                                      </p>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                      <div>
                                        <p className="text-slate-500 mb-1">City</p>
                                        <p className="font-medium">{client.city || "Not specified"}</p>
                                      </div>
                                      <div>
                                        <p className="text-slate-500 mb-1">State</p>
                                        <p className="font-medium">{client.state || "Not specified"}</p>
                                      </div>
                                      <div>
                                        <p className="text-slate-500 mb-1">Country</p>
                                        <p className="font-medium">{client.country || "Not specified"}</p>
                                      </div>
                                      <div>
                                        <p className="text-slate-500 mb-1">ZIP</p>
                                        <p className="font-medium">{client.zipcode || "Not specified"}</p>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                                <Card className="border-slate-200">
                                  <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-base">
                                      <Phone className="h-4 w-4 text-teal-600" />
                                      Contact Information
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent className="space-y-3 text-sm">
                                    <div>
                                      <p className="text-slate-500 mb-1">Phone</p>
                                      <p className="font-medium">{client.phone || "Not specified"}</p>
                                    </div>
                                    <div>
                                      <p className="text-slate-500 mb-1">Email</p>
                                      <p className="font-medium">{client.email || "Not specified"}</p>
                                    </div>
                                    <div>
                                      <p className="text-slate-500 mb-1">Appointment Reminder</p>
                                      <p className="font-medium capitalize">
                                        {client.appointment_reminder || "Not specified"}
                                      </p>
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>

                              {/* Parent/Guardian and Emergency Contact */}
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <Card className="border-slate-200">
                                  <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-base">
                                      <User className="h-4 w-4 text-teal-600" />
                                      Parent/Guardian Information
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent className="space-y-3 text-sm">
                                    <div>
                                      <p className="text-slate-500 mb-1">Name</p>
                                      <p className="font-medium">
                                        {client.parent_first_name} {client.parent_last_name || "Not specified"}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-slate-500 mb-1">Relationship</p>
                                      <p className="font-medium">
                                        {client.relationship_to_insured === "Other"
                                          ? client.relation_other
                                          : client.relationship_to_insured || "Not specified"}
                                      </p>
                                    </div>
                                  </CardContent>
                                </Card>
                                <Card className="border-slate-200">
                                  <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-base">
                                      <Heart className="h-4 w-4 text-teal-600" />
                                      Emergency Contact
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent className="space-y-3 text-sm">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      <div>
                                        <p className="text-slate-500 mb-1">Name</p>
                                        <p className="font-medium">
                                          {client.emergency_contact_name || "Not specified"}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-slate-500 mb-1">Relationship</p>
                                        <p className="font-medium">{client.emg_relationship || "Not specified"}</p>
                                      </div>
                                      <div>
                                        <p className="text-slate-500 mb-1">Phone</p>
                                        <p className="font-medium">{client.emg_phone || "Not specified"}</p>
                                      </div>
                                      <div>
                                        <p className="text-slate-500 mb-1">Email</p>
                                        <p className="font-medium">{client.emg_email || "Not specified"}</p>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>

                              {/* Insurance Information */}
                              {client.insurances &&
                                Array.isArray(client.insurances) &&
                                client.insurances.length > 0 && (
                                  <Card className="border-slate-200">
                                    <CardHeader className="pb-3">
                                      <CardTitle className="flex items-center gap-2 text-base">
                                        <Shield className="h-4 w-4 text-teal-600" />
                                        Insurance Information
                                      </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                      <div className="space-y-4">
                                        {client.insurances.map((insurance, index) => (
                                          <div key={index} className="border rounded-lg p-4 bg-slate-50">
                                            <div className="flex items-center justify-between mb-3">
                                              <h4 className="font-semibold">Insurance #{index + 1}</h4>
                                              <Badge
                                                variant="outline"
                                                className={
                                                  insurance.insurance_type === "Primary"
                                                    ? "border-blue-300 text-blue-700"
                                                    : "border-green-300 text-green-700"
                                                }
                                              >
                                                {insurance.insurance_type}
                                              </Badge>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                                              <div>
                                                <p className="text-slate-500 mb-1">Provider</p>
                                                <p className="font-medium">
                                                  {insurance.insurance_provider || "Not specified"}
                                                </p>
                                              </div>
                                              <div>
                                                <p className="text-slate-500 mb-1">Treatment Type</p>
                                                <p className="font-medium">
                                                  {insurance.treatment_type || "Not specified"}
                                                </p>
                                              </div>
                                              <div>
                                                <p className="text-slate-500 mb-1">Insurance ID</p>
                                                <p className="font-medium">
                                                  {insurance.insurance_id_number || "Not specified"}
                                                </p>
                                              </div>
                                              <div>
                                                <p className="text-slate-500 mb-1">Group Number</p>
                                                <p className="font-medium">
                                                  {insurance.group_number || "Not specified"}
                                                </p>
                                              </div>
                                              <div>
                                                <p className="text-slate-500 mb-1">Coinsurance</p>
                                                <p className="font-medium">
                                                  {insurance.coinsurance || "Not specified"}
                                                </p>
                                              </div>
                                              <div>
                                                <p className="text-slate-500 mb-1">Deductible</p>
                                                <p className="font-medium">{insurance.deductible || "Not specified"}</p>
                                              </div>
                                            </div>
                                            {insurance.start_date && (
                                              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                                <div>
                                                  <p className="text-slate-500 mb-1">Start Date</p>
                                                  <p className="font-medium">{insurance.start_date}</p>
                                                </div>
                                                <div>
                                                  <p className="text-slate-500 mb-1">End Date</p>
                                                  <p className="font-medium">{insurance.end_date || "Ongoing"}</p>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </CardContent>
                                  </Card>
                                )}

                              {/* Authorization Information */}
                              {client.authorizations && client.authorizations.length > 0 ? (
                                <Card className="border-slate-200">
                                  <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-base">
                                      <FileText className="h-4 w-4 text-teal-600" />
                                      Authorization Information
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="space-y-4">
                                      {client.authorizations.map((auth, index) => {
                                        const linkedInsurance =
                                          client.insurances && client.insurances[Number.parseInt(auth.insurance_id, 10)]
                                            ? client.insurances[Number.parseInt(auth.insurance_id, 10)]
                                            : null
                                        return (
                                          <div key={index} className="border rounded-lg p-4 bg-slate-50">
                                            <h4 className="font-semibold mb-3">Authorization #{index + 1}</h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                                              <div>
                                                <p className="text-slate-500 mb-1">Authorization Number</p>
                                                <p className="font-medium">
                                                  {auth.authorization_number || "Not specified"}
                                                </p>
                                              </div>
                                              <div>
                                                <p className="text-slate-500 mb-1">Billing Codes</p>
                                                <p className="font-medium">{auth.billing_codes || "Not specified"}</p>
                                              </div>
                                              <div>
                                                <p className="text-slate-500 mb-1">Units Approved (per 15 min)</p>
                                                <p className="font-medium">
                                                  {auth.units_approved_per_15_min || "Not specified"}
                                                </p>
                                              </div>
                                              <div>
                                                <p className="text-slate-500 mb-1">Status</p>
                                                <p className="font-medium">{auth.status || "Not specified"}</p>
                                              </div>
                                              <div>
                                                <p className="text-slate-500 mb-1">Linked Insurance</p>
                                                <p className="font-medium">
                                                  {linkedInsurance
                                                    ? linkedInsurance.insurance_provider ||
                                                      `Insurance #${
                                                        auth.insurance_id
                                                          ? Number.parseInt(auth.insurance_id, 10) + 1
                                                          : "-"
                                                      }`
                                                    : "Not specified"}
                                                </p>
                                              </div>
                                              <div>
                                                <p className="text-slate-500 mb-1">Period</p>
                                                <p className="font-medium">
                                                  {auth.start_date && auth.end_date
                                                    ? `${auth.start_date} to ${auth.end_date}`
                                                    : "Not specified"}
                                                </p>
                                              </div>
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </CardContent>
                                </Card>
                              ) : (
                                <Card className="border-slate-200">
                                  <CardHeader className="pb-3">
                                    <CardTitle className="text-slate-600 text-base text-center italic">
                                      No authorizations found.
                                    </CardTitle>
                                  </CardHeader>
                                </Card>
                              )}

                              {/* Notes */}
                              {(client.client_notes || client.other_information) && (
                                <Card className="border-slate-200">
                                  <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-base">
                                      <FileText className="h-4 w-4 text-teal-600" />
                                      Notes & Information
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent className="space-y-4 text-sm">
                                    {client.client_notes && (
                                      <div>
                                        <p className="text-slate-500 mb-2 font-medium">Client Notes</p>
                                        <p className="bg-slate-50 p-3 rounded-lg">{client.client_notes}</p>
                                      </div>
                                    )}
                                    {client.other_information && (
                                      <div>
                                        <p className="text-slate-500 mb-2 font-medium">Other Information</p>
                                        <p className="bg-slate-50 p-3 rounded-lg">{client.other_information}</p>
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>
                              )}

                              {/* Documents Display */}
                              {client.documents && client.documents.length > 0 && (
                                <Card className="border-slate-200">
                                  <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-base">
                                      <File className="h-4 w-4 text-teal-600" />
                                      Client Documents
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="space-y-4">
                                      {client.documents.map((doc, index) => (
                                        <div key={index} className="border rounded-lg p-4 bg-slate-50">
                                          <div className="flex items-center justify-between mb-3">
                                            <h4 className="font-semibold">Document #{index + 1}</h4>
                                            <Badge variant="outline" className="border-gray-300 text-gray-700">
                                              {doc.document_type || "N/A"}
                                            </Badge>
                                          </div>
                                          <div className="text-sm">
                                            <p className="text-slate-500 mb-1">File URL</p>
                                            {doc.file_url ? (
                                              <a
                                                href={doc.file_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="font-medium text-blue-600 hover:underline break-all"
                                              >
                                                {doc.file_url}
                                              </a>
                                            ) : (
                                              <p className="font-medium">Not provided</p>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </CardContent>
                                </Card>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  )
                })}
              </TableBody>
            </Table>
            {filteredClients.length === 0 && (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-500">
                  {showArchived ? "No archived clients found." : "No clients match your search."}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      <AddClientModal
        isOpen={isAddModalOpen}
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
