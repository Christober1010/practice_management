"use client"

import type React from "react"
import { useEffect, useState, useCallback } from "react"
import * as XLSX from "xlsx"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Upload, RefreshCw, FileSpreadsheet, Search } from "lucide-react"
import { Toaster, toast } from "react-hot-toast"

type Row = { [key: string]: any }

const REQUIRED_COLUMNS = [
  "Client First Name",
  "Client Last Name",
  "Client Middle Name",
  "Staff First Name",
  "Staff Last Name",
  "Staff Middle Name",
  "Name of RBT Supervised",
  "Payer",
  "Activity Type",
  "Location Code",
  "Authorization Number",
  "Service Code With Modifiers",
  "DOS",
  "Apt Start Time",
  "Apt End Time",
  "Duration Schedule In Min",
  "Duration Schedule In Hrs",
  "Rendered Date",
  "Rendered Start Time",
  "Rendered End Time",
  "Duration Render in Min",
  "Duration Render in Hrs",
  "Session Completion Latency in Hrs",
  "Address",
  "Status",
  "Non-Billable Notes",
  "Billable",
  "Office",
  "Rendering Provider First Name",
  "Rendering Provider Last Name",
  "Rendering Provider MiddleName",
  "Created By",
  "Created Date",
  "Notes",
  "Staff Signature On File",
  "Staff Sign Date",
  "Approx. location of Staff Sign",
  "Guardian Signature On File",
  "Guardian Sign Date",
  "Approx. location of Guardian Sign",
  "DIRECT or INDIRECT Service",
  "Make-Up Session",
  "Make-Up Session Hours",
  "Exclude From Payroll",
  "Exclude From Mileage",
] as const

const API_URL = `${process.env.NEXT_PUBLIC_BASE_URL}/reports.php`

export default function ReportsView() {
  const [existingRows, setExistingRows] = useState<Row[]>([])
  const [uploadedRows, setUploadedRows] = useState<Row[]>([])
  const [headers, setHeaders] = useState<string[]>([...REQUIRED_COLUMNS])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  const mapDbRowToDisplayRow = (r: any): Row => ({
    "Client First Name": r.client_first_name ?? "",
    "Client Last Name": r.client_last_name ?? "",
    "Client Middle Name": r.client_middle_name ?? "",
    "Staff First Name": r.staff_first_name ?? "",
    "Staff Last Name": r.staff_last_name ?? "",
    "Staff Middle Name": r.staff_middle_name ?? "",
    "Name of RBT Supervised": r.name_of_rbt_supervised ?? "",
    Payer: r.payer ?? "",
    "Activity Type": r.activity_type ?? "",
    "Location Code": r.location_code ?? "",
    "Authorization Number": r.authorization_number ?? "",
    "Service Code With Modifiers": r.service_code_with_modifiers ?? "",
    DOS: r.dos ?? "",
    "Apt Start Time": r.apt_start_time ?? "",
    "Apt End Time": r.apt_end_time ?? "",
    "Duration Schedule In Min": r.duration_schedule_in_min ?? "",
    "Duration Schedule In Hrs": r.duration_schedule_in_hrs ?? "",
    "Rendered Date": r.rendered_date ?? "",
    "Rendered Start Time": r.rendered_start_time ?? "",
    "Rendered End Time": r.rendered_end_time ?? "",
    "Duration Render in Min": r.duration_render_in_min ?? "",
    "Duration Render in Hrs": r.duration_render_in_hrs ?? "",
    "Session Completion Latency in Hrs": r.session_completion_latency_hrs ?? "",
    Address: r.address ?? "",
    Status: r.status ?? r.STATUS ?? "",
    "Non-Billable Notes": r.non_billable_notes ?? "",
    Billable: r.billable ? "Yes" : "No",
    Office: r.office ?? "",
    "Rendering Provider First Name": r.rendering_provider_first_name ?? "",
    "Rendering Provider Last Name": r.rendering_provider_last_name ?? "",
    "Rendering Provider MiddleName": r.rendering_provider_middlename ?? "",
    "Created By": r.created_by ?? "",
    "Created Date": r.created_date ?? "",
    Notes: r.notes ?? "",
    "Staff Signature On File": r.staff_signature_on_file ? "Yes" : "No",
    "Staff Sign Date": r.staff_sign_date ?? "",
    "Approx. location of Staff Sign": r.approx_location_staff_sign ?? "",
    "Guardian Signature On File": r.guardian_signature_on_file ? "Yes" : "No",
    "Guardian Sign Date": r.guardian_sign_date ?? "",
    "Approx. location of Guardian Sign": r.approx_location_guardian_sign ?? "",
    "DIRECT or INDIRECT Service": r.direct_or_indirect_service ?? "",
    "Make-Up Session": r.make_up_session ? "Yes" : "No",
    "Make-Up Session Hours": r.make_up_session_hours ?? "",
    "Exclude From Payroll": r.exclude_from_payroll ? "Yes" : "No",
    "Exclude From Mileage": r.exclude_from_mileage ? "Yes" : "No",
  })

  const fetchExisting = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(API_URL)
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to fetch reports")
      }
      const apiRows: any[] = data.data || []
      const mapped = apiRows.map(mapDbRowToDisplayRow)
      setExistingRows(mapped)
    } catch (e: any) {
      console.error(e)
      setError(e.message || "Failed to fetch reports")
      toast.error("Failed to load reports")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchExisting()
  }, [fetchExisting])

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setError(null)
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, {
        type: "array",
        cellDates: true,
        cellText: false,
      })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const rawRows: Row[] = XLSX.utils.sheet_to_json(sheet, {
        defval: "",
        raw: false,
        dateNF: "yyyy-mm-dd HH:MM:ss",
      }) as Row[]

      const filteredRows = rawRows.map((row) => {
        const shaped: Row = {}
        REQUIRED_COLUMNS.forEach((col) => {
          shaped[col] = row[col] ?? ""
        })
        return shaped
      })

      setUploadedRows(filteredRows)
      setHeaders([...REQUIRED_COLUMNS])
      toast.success(`Loaded ${filteredRows.length} rows from Excel`)
    } catch (err: any) {
      console.error(err)
      setError("Failed to read Excel file. Please check the format.")
      toast.error("Failed to read Excel file")
    }
  }

  const handleSave = async () => {
    if (!uploadedRows.length) return
    try {
      setSaving(true)
      setError(null)
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(uploadedRows),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to save reports")
      }
      toast.success("Reports saved successfully")
      setUploadedRows([])
      await fetchExisting()
    } catch (e: any) {
      console.error(e)
      setError(e.message || "Failed to save reports")
      toast.error("Failed to save reports")
    } finally {
      setSaving(false)
    }
  }

  const tableRows = uploadedRows.length ? uploadedRows : existingRows
  const isShowingUploaded = uploadedRows.length > 0

  const filteredRows = tableRows.filter((row) => {
    if (!searchTerm.trim()) return true
    const term = searchTerm.toLowerCase()
    const fieldsToCheck = [
      "Client First Name",
      "Client Last Name",
      "Staff First Name",
      "Staff Last Name",
      "Payer",
      "Activity Type",
      "Authorization Number",
      "Service Code With Modifiers",
      "Status",
    ]
    return fieldsToCheck.some((key) =>
      String(row[key] ?? "")
        .toLowerCase()
        .includes(term),
    )
  })

  return (
    <div className="space-y-8 px-2 sm:px-0 md:px-6">
      <Toaster />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row lg:justify-between sm:justify-center sm:items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Reports</h2>
          <p className="text-slate-600 mt-1">Import session reports from Excel and manage existing records.</p>
        </div>
        <div className="flex flex-row flex-wrap gap-2 sm:items-center sm:space-x-3 sm:justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchExisting}
            className="border-slate-300 bg-transparent"
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!uploadedRows.length || saving}
            className="bg-teal-600 hover:bg-teal-700 shadow-lg"
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save uploaded rows"}
          </Button>
        </div>
      </div>

      {/* Upload and Search Card */}
      <Card className="shadow-lg border-0">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:space-x-4">
            <div className="flex items-center gap-3">
              <label className="block text-sm font-medium text-slate-700 whitespace-nowrap">Upload Excel</label>
              <div className="relative flex-1">
                <Input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFile}
                  className="pr-10 cursor-pointer border-slate-200"
                />
                <Upload className="h-4 w-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search reports..."
                className="pl-9 border-slate-200 focus:border-teal-500 focus:ring-teal-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {isShowingUploaded && (
            <div className="mt-4">
              <Badge variant="outline" className="text-xs border-amber-300 text-amber-700">
                Previewing uploaded Excel data (not saved yet)
              </Badge>
            </div>
          )}

          {error && <p className="text-sm text-red-600 mt-4">{error}</p>}
        </CardContent>
      </Card>

      {/* Table Card - Moved table to proper card structure with p-0 for no padding */}
      {loading && !tableRows.length ? (
        <Card className="shadow-lg border-0">
          <CardContent className="p-0">
            <div className="h-64 flex items-center justify-center">
              <p className="text-center animate-pulse text-gray-500">Fetching reports...</p>
            </div>
          </CardContent>
        </Card>
      ) : filteredRows.length > 0 ? (
        <Card className="shadow-lg border-0">
          <CardHeader className="pb-4">
            <CardTitle className="text-slate-800 flex items-center">
              <FileSpreadsheet className="h-5 w-5 mr-2 text-teal-600" />
              {isShowingUploaded ? "Uploaded Preview" : "Existing Reports"}
              <span className="ml-2 text-sm font-normal text-slate-500">
                ({filteredRows.length} row{filteredRows.length === 1 ? "" : "s"})
              </span>
            </CardTitle>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 border-b">
                    {headers.map((h) => (
                      <TableHead key={h} className="font-semibold text-slate-700 whitespace-nowrap px-4 py-3 border-x">
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((row, i) => (
                    <TableRow key={i} className="border-b hover:bg-slate-50 transition-colors">
                      {headers.map((h) => (
                        <TableCell key={h} className="px-4 py-3 align-center whitespace-nowrap text-sm border-x">
                          {String(row[h] ?? "")}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-lg border-0">
          <CardContent className="p-0">
            <div className="text-center py-12">
              <FileSpreadsheet className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-500">
                {isShowingUploaded
                  ? "No rows found in the uploaded file."
                  : "No reports found. Upload an Excel file to add new records."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
