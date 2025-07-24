"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Users, Plus, Search, Calendar, Edit, Archive, ArchiveRestore, ChevronDown, ChevronUp } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import AddClientModal from "./add-client-modal"
import toast, { Toaster } from "react-hot-toast"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0,
      v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export default function ClientsView() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [showArchived, setShowArchived] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingClient, setEditingClient] = useState(null)
  const [clients, setClients] = useState([])
  const [expandedClients, setExpandedClients] = useState(new Set()) // Track expanded client IDs

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
    const matchesStatus = statusFilter === "all" || client.status === statusFilter
    const matchesArchived = client.archived === showArchived
    return matchesSearch && matchesStatus && matchesArchived
  })

  const handleAddClient = async (clientData) => {
    const newClient = {
      ...clientData,
      id: generateUUID(),
      archived: false,
    }
    try {
      const res = await fetch("https://www.mahabehavioralhealth.com/update-clients.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newClient, archived: 0 }), // Ensure archived is sent as 0 for new clients
      })
      const result = await res.json()
      if (res.ok && result.success) {
        setClients((prev) => [...prev, newClient])
        setIsAddModalOpen(false)
        fetchClients() // Re-fetch to ensure data consistency
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
      if (res.ok && result.success) {
        setClients((prev) =>
          prev.map((client) =>
            client.id === clientData.id
              ? {
                  ...clientData,
                }
              : client,
          ),
        )
        setEditingClient(null)
        setIsAddModalOpen(false)
        fetchClients() // Re-fetch to ensure data consistency
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

    const updatedClient = { ...clientToUpdate, archived: !clientToUpdate.archived }
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
      case "On Hold":
        return "bg-yellow-100 text-yellow-800"
      case "Discharged":
        return "bg-red-100 text-red-800"
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
        const formattedClients = json.clients.map((client) => ({
          ...client,
          // Ensure all fields are present, even if empty strings
          firstName: client.firstName || "",
          lastName: client.lastName || "",
          dob: client.dob?.slice(0, 10) || "",
          address: client.address || "",
          parentGuardianName: client.parentGuardianName || "",
          parentEmail: client.parentEmail || "",
          parentPhone: client.parentPhone || "",
          insuranceProvider: client.insuranceProvider || "",
          subscriberId: client.subscriberId || "", // Renamed
          groupNumber: client.groupNumber || "", // Renamed
          status: client.STATUS || "Active",
          // Robustly parse authorizations: if it's a string, parse it; otherwise, use as is or default to empty array
          authorizations: client.authorizations
            ? typeof client.authorizations === "string"
              ? JSON.parse(client.authorizations)
              : client.authorizations
            : [],
          archived: client.archived == 1,
        }))
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

  // Toggle the expanded view for a client (open/close)
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

  const handleExportPDF = () => {
    try {
      // Create new PDF document
      const doc = new jsPDF()

      // Add title
      doc.setFontSize(20)
      doc.setTextColor(40, 40, 40)
      doc.text("Client Management Report", 20, 20)

      // Add subtitle with current date and filter info
      doc.setFontSize(12)
      doc.setTextColor(100, 100, 100)
      const currentDate = new Date().toLocaleDateString()
      const filterText = showArchived ? "Archived Clients" : "Active Clients"
      const statusText = statusFilter === "all" ? "All Statuses" : `Status: ${statusFilter}`
      doc.text(`Generated on: ${currentDate} | ${filterText} | ${statusText}`, 20, 30)

      // Prepare table data
      const tableData = filteredClients.map((client) => {
        // Format authorizations for display
        const authInfo =
          Array.isArray(client.authorizations) && client.authorizations.length > 0
            ? client.authorizations
                .map(
                  (auth) => `Auth: ${auth.authNumber || "N/A"} (${auth.startDate || "N/A"} - ${auth.endDate || "N/A"})`,
                )
                .join("\n")
            : "No authorizations"

        return [
          `${client.firstName} ${client.lastName}`,
          calculateAge(client.dob).toString(),
          client.status,
          client.address || "N/A",
          client.parentGuardianName || "N/A",
          client.parentEmail || "N/A",
          client.parentPhone || "N/A",
          client.insuranceProvider || "N/A",
          client.subscriberId || "N/A",
          client.groupNumber || "N/A",
          authInfo,
        ]
      })

      // Define table columns
      const columns = [
        "Client Name",
        "Age",
        "Status",
        "Address",
        "Parent/Guardian",
        "Parent Email",
        "Parent Phone",
        "Insurance Provider",
        "Subscriber ID",
        "Group Number",
        "Authorizations",
      ]

      // Add table to PDF
      autoTable(doc, {
        head: [columns],
        body: tableData,
        startY: 40,
        styles: {
          fontSize: 8,
          cellPadding: 3,
          overflow: "linebreak",
          halign: "left",
        },
        headStyles: {
          fillColor: [20, 184, 166], // Teal color
          textColor: 255,
          fontStyle: "bold",
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252], // Light gray
        },
        columnStyles: {
          0: { cellWidth: 25 }, // Client Name
          1: { cellWidth: 12 }, // Age
          2: { cellWidth: 15 }, // Status
          3: { cellWidth: 30 }, // Address
          4: { cellWidth: 25 }, // Parent/Guardian
          5: { cellWidth: 30 }, // Parent Email
          6: { cellWidth: 20 }, // Parent Phone
          7: { cellWidth: 25 }, // Insurance Provider
          8: { cellWidth: 20 }, // Subscriber ID
          9: { cellWidth: 20 }, // Group Number
          10: { cellWidth: 40 }, // Authorizations
        },
        margin: { top: 40, right: 10, bottom: 20, left: 10 },
        pageBreak: "auto",
        showHead: "everyPage",
      })

      // Add footer with total count
      const finalY = doc.lastAutoTable.finalY || 40
      doc.setFontSize(10)
      doc.setTextColor(100, 100, 100)
      doc.text(`Total ${filterText}: ${filteredClients.length}`, 20, finalY + 15)

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-")
      const filename = `clients-report-${showArchived ? "archived" : "active"}-${timestamp}.pdf`

      // Save the PDF
      doc.save(filename)

      toast.success(`PDF exported successfully! (${filteredClients.length} clients)`)
    } catch (error) {
      console.error("Error exporting PDF:", error)
      toast.error("Failed to export PDF. Please try again.")
    }
  }

  return (
    <div className="space-y-8 px-2 sm:px-4 md:px-6">
      <Toaster />
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
          <Button onClick={() => setIsAddModalOpen(true)} className="bg-teal-600 hover:bg-teal-700 shadow-lg">
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
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
                <SelectItem value="On Hold">On Hold</SelectItem>
                <SelectItem value="Discharged">Discharged</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto border-slate-300 bg-transparent"
              onClick={handleExportPDF}
            >
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
            {filteredClients.map((client) => {
              const isExpanded = expandedClients.has(client.id || "")
              return (
                <div
                  key={client.id}
                  className="border border-slate-200 rounded-xl p-6 hover:shadow-md transition-shadow bg-white"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    {/* Left section with icon and client basic info */}
                    <div className="flex items-start space-x-4 flex-1">
                      <div className="bg-teal-100 p-4 rounded-xl flex-shrink-0">
                        <Users className="h-6 w-6 text-teal-600" />
                      </div>
                      <div className="flex-1 flex flex-col min-w-0">
                        <div className="flex items-center flex-wrap gap-2 mb-2">
                          <h3 className="text-lg font-semibold text-slate-800">
                            {client.firstName} {client.lastName}
                          </h3>
                          <Badge className={getStatusColor(client.status)}>{client.status}</Badge>
                          {client.archived && (
                            <Badge variant="outline" className="border-amber-300 text-amber-700">
                              Archived
                            </Badge>
                          )}
                        </div>
                        {/* Minimal info always visible (esp. on mobile) */}
                        <div className="text-sm space-y-2">
                          <p>
                            <span className="font-medium text-slate-800">Client ID:</span> {client.id}
                          </p>
                          <p>
                            <span className="font-medium text-slate-800">Age:</span> {calculateAge(client.dob)} years
                            old
                          </p>
                          {/* Mobile-only action buttons */}
                          <div className="mt-4 flex flex-row flex-wrap gap-2 sm:hidden justify-start">
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
                              onClick={() => handleArchiveClient(client.id || "")}
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
                    </div>

                    {/* Desktop-only action buttons */}
                    <div className="hidden sm:flex flex-row flex-wrap gap-2 sm:items-center sm:justify-end flex-shrink-0">
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
                        onClick={() => handleArchiveClient(client.id || "")}
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

                  {/* Mobile-only collapsible details section and View More/Less button */}
                  <div className="sm:hidden mt-4">
                    <div className="flex justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleExpanded(client.id || "")}
                        className="text-teal-600 border-teal-200 w-full max-w-xs font-semibold"
                      >
                        {isExpanded ? (
                          <>
                            View Less <ChevronUp className="ml-1 h-4 w-4" />
                          </>
                        ) : (
                          <>
                            View More <ChevronDown className="ml-1 h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </div>
                    {isExpanded && (
                      <div className="bg-slate-50 rounded-lg p-4 mt-4 shadow-inner overflow-x-auto">
                        {/* Client details like Address, Parent/Guardian, Insurance etc. */}
                        <div className="space-y-1 grid grid-cols-1 gap-2">
                          <div>
                            <span className="block text-slate-500 text-xs">Address:</span>
                            <span className="font-medium text-slate-800 break-words">{client.address || "N/A"}</span>
                          </div>
                          <div>
                            <span className="block text-slate-500 text-xs">Parent/Guardian Name:</span>
                            <span className="font-medium text-slate-800 break-words">
                              {client.parentGuardianName || "N/A"}
                            </span>
                          </div>
                          <div>
                            <span className="block text-slate-500 text-xs">Parent Email:</span>
                            <span className="font-medium text-slate-800 break-words">
                              {client.parentEmail || "N/A"}
                            </span>
                          </div>
                          <div>
                            <span className="block text-slate-500 text-xs">Parent Phone:</span>
                            <span className="font-medium text-slate-800 break-words">
                              {client.parentPhone || "N/A"}
                            </span>
                          </div>
                          <div>
                            <span className="block text-slate-500 text-xs">Insurance Provider:</span>
                            <span className="font-medium text-slate-800 break-words">
                              {client.insuranceProvider || "N/A"}
                            </span>
                          </div>
                          <div>
                            <span className="block text-slate-500 text-xs">Subscriber Id:</span>
                            <span className="font-medium text-slate-800 break-words">
                              {client.subscriberId || "N/A"}
                            </span>
                          </div>
                          <div>
                            <span className="block text-slate-500 text-xs">Group Number:</span>
                            <span className="font-medium text-slate-800 break-words">
                              {client.groupNumber || "N/A"}
                            </span>
                          </div>
                          <div>
                            <span className="block text-slate-500 text-xs">Date of Birth:</span>
                            <span className="font-medium text-slate-800 break-words">{client.dob || "N/A"}</span>
                          </div>
                        </div>
                        {/* Authorization Information List (Accordion) */}
                        <div className="mt-4">
                          <h4 className="text-md font-semibold text-slate-800 mb-2">Authorization Information</h4>
                          {Array.isArray(client.authorizations) && client.authorizations.length > 0 ? (
                            <div className="grid grid-cols-1 gap-2">
                              {client.authorizations.map((auth, index) => (
                                <Accordion key={index} type="single" collapsible className="w-full">
                                  <AccordionItem value={`item-${index}`}>
                                    <AccordionTrigger className="text-sm font-medium text-slate-700 hover:no-underline">
                                      <div className="flex flex-col items-start">
                                        <span>Authorization Number: {auth.authNumber || "N/A"}</span>
                                        <span className="text-xs text-slate-500">
                                          Start Date: {auth.startDate || "N/A"}
                                        </span>
                                      </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="text-sm space-y-1 p-2 bg-teal-50/60 rounded-b-md border border-teal-200">
                                      <p>
                                        <span className="font-medium text-slate-700">Billing Codes:</span>{" "}
                                        {auth.billingCodes || "N/A"}
                                      </p>
                                      <p>
                                        <span className="font-medium text-slate-700">Units Approved:</span>{" "}
                                        {auth.unitsApproved || 0} per 15 min
                                      </p>
                                      <p>
                                        <span className="font-medium text-slate-700">End Date:</span>{" "}
                                        {auth.endDate || "N/A"}
                                      </p>
                                    </AccordionContent>
                                  </AccordionItem>
                                </Accordion>
                              ))}
                            </div>
                          ) : (
                            <p className="text-slate-500">No authorization information available.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Desktop-only details section */}
                  <div className="hidden sm:block text-sm max-h-screen opacity-100 mt-4">
                    {/* Client details like Address, Parent/Guardian, Insurance etc. */}
                    <div className="space-y-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <p className="text-slate-500">Address:</p>
                        <p className="font-medium text-slate-800">{client.address || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Parent/Guardian Name:</p>
                        <p className="font-medium text-slate-800">{client.parentGuardianName || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Parent Email:</p>
                        <p className="font-medium text-slate-800">{client.parentEmail || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Parent Phone:</p>
                        <p className="font-medium text-slate-800">{client.parentPhone || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Insurance Provider:</p>
                        <p className="font-medium text-slate-800">{client.insuranceProvider || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Subscriber Id:</p>
                        <p className="font-medium text-slate-800">{client.subscriberId || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Group Number:</p>
                        <p className="font-medium text-slate-800">{client.groupNumber || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Date of Birth:</p>
                        <p className="font-medium text-slate-800">{client.dob || "N/A"}</p>
                      </div>
                    </div>
                    {/* Authorization Information List (Accordion) */}
                    <div className="mt-6">
                      <h4 className="text-md font-semibold text-slate-800 mb-2">Authorization Information</h4>
                      {Array.isArray(client.authorizations) && client.authorizations.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {client.authorizations.map((auth, index) => (
                            <Accordion key={index} type="single" collapsible className="w-full">
                              <AccordionItem value={`item-${index}`}>
                                <AccordionTrigger className="text-sm font-medium text-slate-700 hover:no-underline">
                                  <div className="flex flex-col items-start">
                                    <span>Authorization Number: {auth.authNumber || "N/A"}</span>
                                    <span className="text-xs text-slate-500">
                                      Start Date: {auth.startDate || "N/A"}
                                    </span>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent className="text-sm space-y-1 p-2 bg-slate-50 rounded-b-md">
                                  <p>
                                    <span className="font-medium text-slate-700">Billing Codes:</span>{" "}
                                    {auth.billingCodes || "N/A"}
                                  </p>
                                  <p>
                                    <span className="font-medium text-slate-700">Units Approved:</span>{" "}
                                    {auth.unitsApproved || 0} per 15 min
                                  </p>
                                  <p>
                                    <span className="font-medium text-slate-700">End Date:</span>{" "}
                                    {auth.endDate || "N/A"}
                                  </p>
                                </AccordionContent>
                              </AccordionItem>
                            </Accordion>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-500">No authorization information available.</p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
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
