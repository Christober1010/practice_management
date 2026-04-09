"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { User, Calendar, FileText, DollarSign, Upload, X } from "lucide-react";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";

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
];

export default function AddReportModal({
  isOpen,
  onClose,
  onSave,
  editingReport,
}) {
  const [mode, setMode] = useState("manual"); // "manual" or "excel"
  const [excelRows, setExcelRows] = useState([]);
  const [editingRowIndex, setEditingRowIndex] = useState(null);
  const [existingReports, setExistingReports] = useState([]);
  const [duplicateIndices, setDuplicateIndices] = useState(new Set());
  const [formData, setFormData] = useState({
    // Client Information
    client_first_name: "",
    client_last_name: "",
    client_middle_name: "",
    // Staff Information
    staff_first_name: "",
    staff_last_name: "",
    staff_middle_name: "",
    name_of_rbt_supervised: "",
    // Service Details
    payer: "",
    activity_type: "",
    location_code: "",
    authorization_number: "",
    service_code_with_modifiers: "",
    dos: "",
    apt_start_time: "",
    apt_end_time: "",
    duration_schedule_in_min: "",
    duration_schedule_in_hrs: "",
    rendered_date: "",
    rendered_start_time: "",
    rendered_end_time: "",
    duration_render_in_min: "",
    duration_render_in_hrs: "",
    session_completion_latency_hrs: "",
    address: "",
    status: "Scheduled",
    non_billable_notes: "",
    billable: true,
    office: "",
    // Provider Information
    rendering_provider_first_name: "",
    rendering_provider_last_name: "",
    rendering_provider_middlename: "",
    created_by: "",
    created_date: "",
    notes: "",
    // Signatures
    staff_signature_on_file: false,
    staff_sign_date: "",
    approx_location_staff_sign: "",
    guardian_signature_on_file: false,
    guardian_sign_date: "",
    approx_location_guardian_sign: "",
    // Additional
    direct_or_indirect_service: "",
    make_up_session: false,
    make_up_session_hours: "",
    exclude_from_payroll: false,
    exclude_from_mileage: false,
  });

  useEffect(() => {
    if (editingReport) {
      setFormData({
        client_first_name: editingReport.client_first_name || "",
        client_last_name: editingReport.client_last_name || "",
        client_middle_name: editingReport.client_middle_name || "",
        staff_first_name: editingReport.staff_first_name || "",
        staff_last_name: editingReport.staff_last_name || "",
        staff_middle_name: editingReport.staff_middle_name || "",
        name_of_rbt_supervised: editingReport.name_of_rbt_supervised || "",
        payer: editingReport.payer || "",
        activity_type: editingReport.activity_type || "",
        location_code: editingReport.location_code || "",
        authorization_number: editingReport.authorization_number || "",
        service_code_with_modifiers:
          editingReport.service_code_with_modifiers || "",
        dos: editingReport.dos || "",
        apt_start_time: editingReport.apt_start_time || "",
        apt_end_time: editingReport.apt_end_time || "",
        duration_schedule_in_min: editingReport.duration_schedule_in_min || "",
        duration_schedule_in_hrs: editingReport.duration_schedule_in_hrs || "",
        rendered_date: editingReport.rendered_date || "",
        rendered_start_time: editingReport.rendered_start_time || "",
        rendered_end_time: editingReport.rendered_end_time || "",
        duration_render_in_min: editingReport.duration_render_in_min || "",
        duration_render_in_hrs: editingReport.duration_render_in_hrs || "",
        session_completion_latency_hrs:
          editingReport.session_completion_latency_hrs || "",
        address: editingReport.address || "",
        status: editingReport.status || "Scheduled",
        non_billable_notes: editingReport.non_billable_notes || "",
        billable: editingReport.billable !== undefined ? editingReport.billable : true,
        office: editingReport.office || "",
        rendering_provider_first_name:
          editingReport.rendering_provider_first_name || "",
        rendering_provider_last_name:
          editingReport.rendering_provider_last_name || "",
        rendering_provider_middlename:
          editingReport.rendering_provider_middlename || "",
        created_by: editingReport.created_by || "",
        created_date: editingReport.created_date || "",
        notes: editingReport.notes || "",
        staff_signature_on_file:
          editingReport.staff_signature_on_file || false,
        staff_sign_date: editingReport.staff_sign_date || "",
        approx_location_staff_sign:
          editingReport.approx_location_staff_sign || "",
        guardian_signature_on_file:
          editingReport.guardian_signature_on_file || false,
        guardian_sign_date: editingReport.guardian_sign_date || "",
        approx_location_guardian_sign:
          editingReport.approx_location_guardian_sign || "",
        direct_or_indirect_service:
          editingReport.direct_or_indirect_service || "",
        make_up_session: editingReport.make_up_session || false,
        make_up_session_hours: editingReport.make_up_session_hours || "",
        exclude_from_payroll: editingReport.exclude_from_payroll || false,
        exclude_from_mileage: editingReport.exclude_from_mileage || false,
      });
    } else {
      // Reset form for new report
      setFormData({
        client_first_name: "",
        client_last_name: "",
        client_middle_name: "",
        staff_first_name: "",
        staff_last_name: "",
        staff_middle_name: "",
        name_of_rbt_supervised: "",
        payer: "",
        activity_type: "",
        location_code: "",
        authorization_number: "",
        service_code_with_modifiers: "",
        dos: "",
        apt_start_time: "",
        apt_end_time: "",
        duration_schedule_in_min: "",
        duration_schedule_in_hrs: "",
        rendered_date: "",
        rendered_start_time: "",
        rendered_end_time: "",
        duration_render_in_min: "",
        duration_render_in_hrs: "",
        session_completion_latency_hrs: "",
        address: "",
        status: "Scheduled",
        non_billable_notes: "",
        billable: true,
        office: "",
        rendering_provider_first_name: "",
        rendering_provider_last_name: "",
        rendering_provider_middlename: "",
        created_by: "",
        created_date: "",
        notes: "",
        staff_signature_on_file: false,
        staff_sign_date: "",
        approx_location_staff_sign: "",
        guardian_signature_on_file: false,
        guardian_sign_date: "",
        approx_location_guardian_sign: "",
        direct_or_indirect_service: "",
        make_up_session: false,
        make_up_session_hours: "",
        exclude_from_payroll: false,
        exclude_from_mileage: false,
      });
    }
  }, [editingReport, isOpen]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleExcelFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, {
        type: "array",
        cellDates: true,
        cellText: false,
      });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json(sheet, {
        defval: "",
        raw: false,
        dateNF: "yyyy-mm-dd HH:MM:ss",
      });

      if (rawRows.length === 0) {
        toast.error("No data found in Excel file");
        return;
      }

      // Get all column names from Excel (with potential variations)
      const excelColumns = rawRows.length > 0 ? Object.keys(rawRows[0]) : [];
      console.log("Excel columns found:", excelColumns);

      // Map Excel columns to our format (handle trailing spaces and variations)
      const mappedRows = rawRows.map((row, rowIndex) => {
        const mapped = {};
        REQUIRED_COLUMNS.forEach((requiredCol) => {
          // Try exact match first
          if (row[requiredCol] !== undefined) {
            mapped[requiredCol] = row[requiredCol] ?? "";
          } else {
            // Try with trailing space
            const withSpace = requiredCol + " ";
            if (row[withSpace] !== undefined) {
              mapped[requiredCol] = row[withSpace] ?? "";
            } else {
              // Try case-insensitive match
              const foundCol = excelColumns.find(
                (excelCol) => excelCol.trim().toLowerCase() === requiredCol.toLowerCase()
              );
              if (foundCol) {
                mapped[requiredCol] = row[foundCol] ?? "";
              } else {
                // No match found, set empty
                mapped[requiredCol] = "";
              }
            }
          }
        });
        return mapped;
      });

      // Check for missing columns
      const missingColumns = REQUIRED_COLUMNS.filter((col) => {
        const found = excelColumns.some(
          (excelCol) =>
            excelCol.trim() === col.trim() ||
            excelCol.trim().toLowerCase() === col.trim().toLowerCase()
        );
        return !found;
      });

      if (missingColumns.length > 0) {
        console.warn("Missing columns in Excel:", missingColumns);
        toast.warning(
          `Some columns not found: ${missingColumns.slice(0, 3).join(", ")}${missingColumns.length > 3 ? "..." : ""}. They will be set to empty.`
        );
      }

      setExcelRows(mappedRows);
      toast.success(
        `Loaded ${mappedRows.length} rows from Excel with ${REQUIRED_COLUMNS.length} fields`
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to read Excel file. Please check the format.");
    }
  };

  const handleEditRow = (index) => {
    setEditingRowIndex(index);
  };

  const handleUpdateRow = (index, field, value) => {
    setExcelRows((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemoveRow = (index) => {
    setExcelRows((prev) => prev.filter((_, i) => i !== index));
    if (editingRowIndex === index) {
      setEditingRowIndex(null);
    } else if (editingRowIndex > index) {
      setEditingRowIndex(editingRowIndex - 1);
    }
  };

  const handleSaveExcelRows = () => {
    if (excelRows.length === 0) {
      toast.error("No rows to save");
      return;
    }

    // Filter out duplicates if user wants to proceed
    const rowsToSave = excelRows.filter((_, index) => !duplicateIndices.has(index));
    const duplicateCount = duplicateIndices.size;

    if (duplicateCount > 0) {
      const proceed = confirm(
        `Found ${duplicateCount} duplicate row(s). They will be skipped. Do you want to proceed with saving ${rowsToSave.length} non-duplicate row(s)?`
      );
      if (!proceed) {
        return;
      }
    }

    if (rowsToSave.length === 0) {
      toast.error("All rows are duplicates. No new reports to save.");
      return;
    }

    onSave(rowsToSave);
    setExcelRows([]);
    setMode("manual");
    if (duplicateCount > 0) {
      toast.success(
        `Saved ${rowsToSave.length} reports. ${duplicateCount} duplicate(s) were skipped.`
      );
    }
  };

  const checkDuplicateForManualEntry = async (reportData) => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";
      const res = await fetch(`${baseUrl}/reports.php?archived=0`);
      const result = await res.json();
      if (result.success) {
        const existing = result.data || [];
        const isDuplicate = existing.some((existingReport) => {
          const reportClientFirst = (reportData.client_first_name || "").trim().toLowerCase();
          const reportStaffFirst = (reportData.staff_first_name || "").trim().toLowerCase();
          const reportAuthNum = (reportData.authorization_number || "").trim().toLowerCase();
          const reportDOS = normalizeDate(reportData.dos || "");
          const reportAptStart = normalizeDateTime(reportData.apt_start_time || "");

          const existingClientFirst = (existingReport.client_first_name || "").trim().toLowerCase();
          const existingStaffFirst = (existingReport.staff_first_name || "").trim().toLowerCase();
          const existingAuthNum = (existingReport.authorization_number || "").trim().toLowerCase();
          const existingDOS = normalizeDate(existingReport.dos || "");
          const existingAptStart = normalizeDateTime(existingReport.apt_start_time || "");

          // Skip if editing the same report
          if (editingReport && existingReport.id === editingReport.id) {
            return false;
          }

          return (
            reportClientFirst === existingClientFirst &&
            reportStaffFirst === existingStaffFirst &&
            reportAuthNum === existingAuthNum &&
            reportDOS === existingDOS &&
            reportAptStart === existingAptStart
          );
        });

        if (isDuplicate) {
          const proceed = confirm(
            "A duplicate report already exists with the same:\n" +
            "- Client First Name\n" +
            "- Staff First Name\n" +
            "- Authorization Number\n" +
            "- DOS (Date of Service)\n" +
            "- Apt Start Time\n\n" +
            "Do you want to proceed anyway?"
          );
          return proceed;
        }
      }
      return true;
    } catch (err) {
      console.error("Error checking duplicate:", err);
      return true; // Allow save if check fails
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (mode === "excel" && excelRows.length > 0) {
      handleSaveExcelRows();
      return;
    }
    const dataToSave = {
      ...formData,
      id: editingReport?.id,
    };

    // Check for duplicates in manual entry mode
    const canProceed = await checkDuplicateForManualEntry(dataToSave);
    if (!canProceed) {
      return;
    }

    onSave(dataToSave);
  };

  // Fetch existing reports for duplicate checking
  useEffect(() => {
    if (isOpen && mode === "excel") {
      const fetchExistingReports = async () => {
        try {
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";
          const res = await fetch(`${baseUrl}/reports.php?archived=0`);
          const result = await res.json();
          if (result.success) {
            setExistingReports(result.data || []);
          }
        } catch (err) {
          console.error("Error fetching existing reports:", err);
        }
      };
      fetchExistingReports();
    }
  }, [isOpen, mode]);

  // Helper functions for date normalization
  const normalizeDate = (dateStr) => {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        // Invalid date, try to extract just the date part
        const dateOnly = String(dateStr).split("T")[0].split(" ")[0];
        return dateOnly || "";
      }
      return date.toISOString().split("T")[0];
    } catch {
      // If parsing fails, try to extract date part from string
      const dateOnly = String(dateStr).split("T")[0].split(" ")[0];
      return dateOnly || "";
    }
  };

  const normalizeDateTime = (dateTimeStr) => {
    if (!dateTimeStr) return "";
    try {
      const dt = new Date(dateTimeStr);
      if (isNaN(dt.getTime())) {
        // Invalid date, return original string normalized
        return String(dateTimeStr).trim();
      }
      return dt.toISOString();
    } catch {
      // If parsing fails, return normalized string
      return String(dateTimeStr).trim();
    }
  };

  // Check for duplicates when excelRows change
  useEffect(() => {
    if (excelRows.length > 0 && existingReports.length > 0) {
      const duplicates = new Set();
      excelRows.forEach((row, index) => {
        const isDuplicate = existingReports.some((existing) => {
          const rowClientFirst = (row["Client First Name"] || "").trim().toLowerCase();
          const rowStaffFirst = (row["Staff First Name"] || "").trim().toLowerCase();
          const rowAuthNum = (row["Authorization Number"] || "").trim().toLowerCase();
          const rowDOS = normalizeDate(row["DOS"] || "");
          const rowAptStart = normalizeDateTime(row["Apt Start Time"] || "");

          const existingClientFirst = (existing.client_first_name || "").trim().toLowerCase();
          const existingStaffFirst = (existing.staff_first_name || "").trim().toLowerCase();
          const existingAuthNum = (existing.authorization_number || "").trim().toLowerCase();
          const existingDOS = normalizeDate(existing.dos || "");
          const existingAptStart = normalizeDateTime(existing.apt_start_time || "");

          return (
            rowClientFirst === existingClientFirst &&
            rowStaffFirst === existingStaffFirst &&
            rowAuthNum === existingAuthNum &&
            rowDOS === existingDOS &&
            rowAptStart === existingAptStart
          );
        });

        if (isDuplicate) {
          duplicates.add(index);
        }
      });
      setDuplicateIndices(duplicates);
    } else {
      setDuplicateIndices(new Set());
    }
  }, [excelRows, existingReports]);

  // Reset mode when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setMode("manual");
      setExcelRows([]);
      setEditingRowIndex(null);
      setDuplicateIndices(new Set());
      setExistingReports([]);
    } else if (!editingReport) {
      // Only show mode selector for new reports
      setMode("manual");
    }
  }, [isOpen, editingReport]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingReport ? "Edit Report" : "Add New Report"}
          </DialogTitle>
        </DialogHeader>

        {!editingReport && (
          <div className="mb-4">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={mode === "manual" ? "default" : "outline"}
                onClick={() => setMode("manual")}
                className={mode === "manual" ? "bg-teal-600" : ""}
              >
                Manual Entry
              </Button>
              <Button
                type="button"
                variant={mode === "excel" ? "default" : "outline"}
                onClick={() => setMode("excel")}
                className={mode === "excel" ? "bg-teal-600" : ""}
              >
                <Upload className="h-4 w-4 mr-2" />
                Excel Import
              </Button>
            </div>
          </div>
        )}

        {mode === "excel" && !editingReport ? (
          <div className="space-y-4">
            {/* Excel Upload */}
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
              <Upload className="h-12 w-12 mx-auto text-slate-400 mb-4" />
              <Label htmlFor="excel-file" className="cursor-pointer">
                <Button variant="outline" asChild>
                  <span>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Excel File
                  </span>
                </Button>
              </Label>
              <Input
                id="excel-file"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleExcelFile}
                className="hidden"
              />
              <p className="text-sm text-slate-500 mt-2">
                Supported formats: .xlsx, .xls
              </p>
            </div>

            {/* Excel Preview Table */}
            {excelRows.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">
                      Preview ({excelRows.length} rows)
                    </h3>
                    {duplicateIndices.size > 0 && (
                      <p className="text-sm text-amber-600 mt-1">
                        ⚠️ {duplicateIndices.size} duplicate row(s) detected (highlighted in red)
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setExcelRows([]);
                      setEditingRowIndex(null);
                      setDuplicateIndices(new Set());
                    }}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Clear All
                  </Button>
                </div>
                <div className="border rounded-lg overflow-auto max-h-[500px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-slate-50 z-10">
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Client Name</TableHead>
                        <TableHead>Staff Name</TableHead>
                        <TableHead>DOS</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Payer</TableHead>
                        <TableHead>Service Code</TableHead>
                        <TableHead className="w-32">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {excelRows.map((row, index) => {
                        const isDuplicate = duplicateIndices.has(index);
                        return (
                          <TableRow
                            key={index}
                            className={
                              editingRowIndex === index
                                ? "bg-blue-50"
                                : isDuplicate
                                ? "bg-red-50 border-l-4 border-red-500"
                                : ""
                            }
                          >
                          <TableCell className="font-medium">
                            {index + 1}
                            {isDuplicate && (
                              <span className="ml-2 text-xs text-red-600 font-semibold">
                                (Duplicate)
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {editingRowIndex === index ? (
                              <div className="space-y-1">
                                <Input
                                  value={row["Client First Name"] || ""}
                                  onChange={(e) =>
                                    handleUpdateRow(
                                      index,
                                      "Client First Name",
                                      e.target.value
                                    )
                                  }
                                  placeholder="First Name"
                                  className="text-xs"
                                  size="sm"
                                />
                                <Input
                                  value={row["Client Last Name"] || ""}
                                  onChange={(e) =>
                                    handleUpdateRow(
                                      index,
                                      "Client Last Name",
                                      e.target.value
                                    )
                                  }
                                  placeholder="Last Name"
                                  className="text-xs"
                                  size="sm"
                                />
                              </div>
                            ) : (
                              <div className="text-sm">
                                {row["Client First Name"]} {row["Client Last Name"]}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {editingRowIndex === index ? (
                              <div className="space-y-1">
                                <Input
                                  value={row["Staff First Name"] || ""}
                                  onChange={(e) =>
                                    handleUpdateRow(
                                      index,
                                      "Staff First Name",
                                      e.target.value
                                    )
                                  }
                                  placeholder="Staff First"
                                  className="text-xs"
                                  size="sm"
                                />
                                <Input
                                  value={row["Staff Last Name"] || ""}
                                  onChange={(e) =>
                                    handleUpdateRow(
                                      index,
                                      "Staff Last Name",
                                      e.target.value
                                    )
                                  }
                                  placeholder="Staff Last"
                                  className="text-xs"
                                  size="sm"
                                />
                              </div>
                            ) : (
                              <div className="text-sm">
                                {row["Staff First Name"]} {row["Staff Last Name"]}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {editingRowIndex === index ? (
                              <Input
                                type="date"
                                value={row["DOS"] || ""}
                                onChange={(e) =>
                                  handleUpdateRow(index, "DOS", e.target.value)
                                }
                                className="text-xs"
                                size="sm"
                              />
                            ) : (
                              <div className="text-sm">{row["DOS"] || "N/A"}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            {editingRowIndex === index ? (
                              <Select
                                value={row["Status"] || "Scheduled"}
                                onValueChange={(value) =>
                                  handleUpdateRow(index, "Status", value)
                                }
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Scheduled">Scheduled</SelectItem>
                                  <SelectItem value="Rendered">Rendered</SelectItem>
                                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <div className="text-sm">{row["Status"] || "N/A"}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            {editingRowIndex === index ? (
                              <Input
                                value={row["Payer"] || ""}
                                onChange={(e) =>
                                  handleUpdateRow(index, "Payer", e.target.value)
                                }
                                className="text-xs"
                                size="sm"
                              />
                            ) : (
                              <div className="text-sm">{row["Payer"] || "N/A"}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            {editingRowIndex === index ? (
                              <Input
                                value={row["Service Code With Modifiers"] || ""}
                                onChange={(e) =>
                                  handleUpdateRow(
                                    index,
                                    "Service Code With Modifiers",
                                    e.target.value
                                  )
                                }
                                className="text-xs"
                                size="sm"
                              />
                            ) : (
                              <div className="text-sm font-mono text-xs">
                                {row["Service Code With Modifiers"] || "N/A"}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {editingRowIndex === index ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setEditingRowIndex(null)}
                                  className="text-xs"
                                >
                                  Done
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditRow(index)}
                                  className="text-xs"
                                >
                                  Edit
                                </Button>
                              )}
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveRow(index)}
                                className="text-xs"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Full Row Editor */}
                {editingRowIndex !== null && (
                  <Card className="mt-4">
                    <CardHeader>
                      <CardTitle className="text-lg">
                        Editing Row {editingRowIndex + 1} - All Fields
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="max-h-[500px] overflow-y-auto pr-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {REQUIRED_COLUMNS.map((col) => {
                            // Handle special field types
                            const isDateField = col.includes("Date") || col === "DOS";
                            const isTimeField = col.includes("Time");
                            const isBooleanField = [
                              "Billable",
                              "Staff Signature On File",
                              "Guardian Signature On File",
                              "Make-Up Session",
                              "Exclude From Payroll",
                              "Exclude From Mileage",
                            ].includes(col);
                            const isNumberField = col.includes("Min") || 
                                                  col.includes("Hrs") || 
                                                  col.includes("Hours");
                            const isTextAreaField = [
                              "Non-Billable Notes",
                              "Notes",
                              "Address",
                            ].includes(col);

                            return (
                              <div key={col} className={isTextAreaField ? "md:col-span-2 lg:col-span-3" : ""}>
                                <Label className="text-xs font-medium">{col}</Label>
                                {isTextAreaField ? (
                                  <Textarea
                                    value={excelRows[editingRowIndex]?.[col] || ""}
                                    onChange={(e) =>
                                      handleUpdateRow(
                                        editingRowIndex,
                                        col,
                                        e.target.value
                                      )
                                    }
                                    className="mt-1"
                                    rows={2}
                                  />
                                ) : isDateField ? (
                                  <Input
                                    type="date"
                                    value={excelRows[editingRowIndex]?.[col] || ""}
                                    onChange={(e) =>
                                      handleUpdateRow(
                                        editingRowIndex,
                                        col,
                                        e.target.value
                                      )
                                    }
                                    className="mt-1"
                                  />
                                ) : isTimeField ? (
                                  <Input
                                    type="datetime-local"
                                    value={excelRows[editingRowIndex]?.[col] || ""}
                                    onChange={(e) =>
                                      handleUpdateRow(
                                        editingRowIndex,
                                        col,
                                        e.target.value
                                      )
                                    }
                                    className="mt-1"
                                  />
                                ) : isBooleanField ? (
                                  <Select
                                    value={
                                      excelRows[editingRowIndex]?.[col] === "Yes" ||
                                      excelRows[editingRowIndex]?.[col] === true ||
                                      excelRows[editingRowIndex]?.[col] === "1"
                                        ? "Yes"
                                        : "No"
                                    }
                                    onValueChange={(value) =>
                                      handleUpdateRow(
                                        editingRowIndex,
                                        col,
                                        value
                                      )
                                    }
                                  >
                                    <SelectTrigger className="mt-1">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Yes">Yes</SelectItem>
                                      <SelectItem value="No">No</SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : isNumberField ? (
                                  <Input
                                    type="number"
                                    step={col.includes("Hrs") || col.includes("Hours") ? "0.01" : "1"}
                                    value={excelRows[editingRowIndex]?.[col] || ""}
                                    onChange={(e) =>
                                      handleUpdateRow(
                                        editingRowIndex,
                                        col,
                                        e.target.value
                                      )
                                    }
                                    className="mt-1"
                                  />
                                ) : col === "Status" ? (
                                  <Select
                                    value={excelRows[editingRowIndex]?.[col] || "Scheduled"}
                                    onValueChange={(value) =>
                                      handleUpdateRow(
                                        editingRowIndex,
                                        col,
                                        value
                                      )
                                    }
                                  >
                                    <SelectTrigger className="mt-1">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Scheduled">Scheduled</SelectItem>
                                      <SelectItem value="Rendered">Rendered</SelectItem>
                                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : col === "DIRECT or INDIRECT Service" ? (
                                  <Select
                                    value={excelRows[editingRowIndex]?.[col] || ""}
                                    onValueChange={(value) =>
                                      handleUpdateRow(
                                        editingRowIndex,
                                        col,
                                        value
                                      )
                                    }
                                  >
                                    <SelectTrigger className="mt-1">
                                      <SelectValue placeholder="Select" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="DIRECT">DIRECT</SelectItem>
                                      <SelectItem value="INDIRECT">INDIRECT</SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Input
                                    value={excelRows[editingRowIndex]?.[col] || ""}
                                    onChange={(e) =>
                                      handleUpdateRow(
                                        editingRowIndex,
                                        col,
                                        e.target.value
                                      )
                                    }
                                    className="mt-1"
                                    placeholder={col}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="mt-4 flex justify-end gap-2 border-t pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setEditingRowIndex(null)}
                        >
                          Done Editing
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSaveExcelRows}
                    className="bg-teal-600 hover:bg-teal-700"
                    disabled={excelRows.length === 0}
                  >
                    Save All {excelRows.length - duplicateIndices.size} Reports
                    {duplicateIndices.size > 0 && ` (${duplicateIndices.size} duplicates will be skipped)`}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="service">Service</TabsTrigger>
              <TabsTrigger value="billing">Billing</TabsTrigger>
              <TabsTrigger value="additional">Additional</TabsTrigger>
            </TabsList>

            {/* Basic Information Tab */}
            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Client First Name *</Label>
                  <Input
                    value={formData.client_first_name}
                    onChange={(e) =>
                      handleChange("client_first_name", e.target.value)
                    }
                    required
                  />
                </div>
                <div>
                  <Label>Client Last Name *</Label>
                  <Input
                    value={formData.client_last_name}
                    onChange={(e) =>
                      handleChange("client_last_name", e.target.value)
                    }
                    required
                  />
                </div>
                <div>
                  <Label>Client Middle Name</Label>
                  <Input
                    value={formData.client_middle_name}
                    onChange={(e) =>
                      handleChange("client_middle_name", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label>Staff First Name *</Label>
                  <Input
                    value={formData.staff_first_name}
                    onChange={(e) =>
                      handleChange("staff_first_name", e.target.value)
                    }
                    required
                  />
                </div>
                <div>
                  <Label>Staff Last Name *</Label>
                  <Input
                    value={formData.staff_last_name}
                    onChange={(e) =>
                      handleChange("staff_last_name", e.target.value)
                    }
                    required
                  />
                </div>
                <div>
                  <Label>Staff Middle Name</Label>
                  <Input
                    value={formData.staff_middle_name}
                    onChange={(e) =>
                      handleChange("staff_middle_name", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label>RBT Supervised</Label>
                  <Input
                    value={formData.name_of_rbt_supervised}
                    onChange={(e) =>
                      handleChange("name_of_rbt_supervised", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label>Status *</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => handleChange("status", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Scheduled">Scheduled</SelectItem>
                      <SelectItem value="Rendered">Rendered</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            {/* Service Details Tab */}
            <TabsContent value="service" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Date of Service (DOS) *</Label>
                  <Input
                    type="date"
                    value={formData.dos}
                    onChange={(e) => handleChange("dos", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label>Rendered Date</Label>
                  <Input
                    type="date"
                    value={formData.rendered_date}
                    onChange={(e) =>
                      handleChange("rendered_date", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label>Appointment Start Time</Label>
                  <Input
                    type="datetime-local"
                    value={formData.apt_start_time}
                    onChange={(e) =>
                      handleChange("apt_start_time", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label>Appointment End Time</Label>
                  <Input
                    type="datetime-local"
                    value={formData.apt_end_time}
                    onChange={(e) =>
                      handleChange("apt_end_time", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label>Rendered Start Time</Label>
                  <Input
                    type="datetime-local"
                    value={formData.rendered_start_time}
                    onChange={(e) =>
                      handleChange("rendered_start_time", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label>Rendered End Time</Label>
                  <Input
                    type="datetime-local"
                    value={formData.rendered_end_time}
                    onChange={(e) =>
                      handleChange("rendered_end_time", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label>Duration Scheduled (Minutes)</Label>
                  <Input
                    type="number"
                    value={formData.duration_schedule_in_min}
                    onChange={(e) =>
                      handleChange(
                        "duration_schedule_in_min",
                        e.target.value
                      )
                    }
                  />
                </div>
                <div>
                  <Label>Duration Scheduled (Hours)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.duration_schedule_in_hrs}
                    onChange={(e) =>
                      handleChange("duration_schedule_in_hrs", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label>Duration Rendered (Minutes)</Label>
                  <Input
                    type="number"
                    value={formData.duration_render_in_min}
                    onChange={(e) =>
                      handleChange("duration_render_in_min", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label>Duration Rendered (Hours)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.duration_render_in_hrs}
                    onChange={(e) =>
                      handleChange("duration_render_in_hrs", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label>Activity Type</Label>
                  <Input
                    value={formData.activity_type}
                    onChange={(e) =>
                      handleChange("activity_type", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label>Direct or Indirect Service</Label>
                  <Select
                    value={formData.direct_or_indirect_service}
                    onValueChange={(value) =>
                      handleChange("direct_or_indirect_service", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DIRECT">Direct</SelectItem>
                      <SelectItem value="INDIRECT">Indirect</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Address</Label>
                  <Textarea
                    value={formData.address}
                    onChange={(e) => handleChange("address", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Office</Label>
                  <Input
                    value={formData.office}
                    onChange={(e) => handleChange("office", e.target.value)}
                  />
                </div>
              </div>
            </TabsContent>

            {/* Billing Tab */}
            <TabsContent value="billing" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Payer</Label>
                  <Input
                    value={formData.payer}
                    onChange={(e) => handleChange("payer", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Authorization Number</Label>
                  <Input
                    value={formData.authorization_number}
                    onChange={(e) =>
                      handleChange("authorization_number", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label>Service Code with Modifiers</Label>
                  <Input
                    value={formData.service_code_with_modifiers}
                    onChange={(e) =>
                      handleChange(
                        "service_code_with_modifiers",
                        e.target.value
                      )
                    }
                  />
                </div>
                <div>
                  <Label>Location Code</Label>
                  <Input
                    value={formData.location_code}
                    onChange={(e) =>
                      handleChange("location_code", e.target.value)
                    }
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="billable"
                    checked={formData.billable}
                    onCheckedChange={(checked) =>
                      handleChange("billable", checked)
                    }
                  />
                  <Label htmlFor="billable" className="cursor-pointer">
                    Billable
                  </Label>
                </div>
                <div>
                  <Label>Non-Billable Notes</Label>
                  <Textarea
                    value={formData.non_billable_notes}
                    onChange={(e) =>
                      handleChange("non_billable_notes", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label>Rendering Provider First Name</Label>
                  <Input
                    value={formData.rendering_provider_first_name}
                    onChange={(e) =>
                      handleChange(
                        "rendering_provider_first_name",
                        e.target.value
                      )
                    }
                  />
                </div>
                <div>
                  <Label>Rendering Provider Last Name</Label>
                  <Input
                    value={formData.rendering_provider_last_name}
                    onChange={(e) =>
                      handleChange(
                        "rendering_provider_last_name",
                        e.target.value
                      )
                    }
                  />
                </div>
                <div>
                  <Label>Rendering Provider Middle Name</Label>
                  <Input
                    value={formData.rendering_provider_middlename}
                    onChange={(e) =>
                      handleChange(
                        "rendering_provider_middlename",
                        e.target.value
                      )
                    }
                  />
                </div>
              </div>
            </TabsContent>

            {/* Additional Information Tab */}
            <TabsContent value="additional" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Created By</Label>
                  <Input
                    value={formData.created_by}
                    onChange={(e) =>
                      handleChange("created_by", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label>Created Date</Label>
                  <Input
                    type="datetime-local"
                    value={formData.created_date}
                    onChange={(e) =>
                      handleChange("created_date", e.target.value)
                    }
                  />
                </div>
                <div className="col-span-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => handleChange("notes", e.target.value)}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="make_up_session"
                    checked={formData.make_up_session}
                    onCheckedChange={(checked) =>
                      handleChange("make_up_session", checked)
                    }
                  />
                  <Label htmlFor="make_up_session" className="cursor-pointer">
                    Make-Up Session
                  </Label>
                </div>
                {formData.make_up_session && (
                  <div>
                    <Label>Make-Up Session Hours</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.make_up_session_hours}
                      onChange={(e) =>
                        handleChange("make_up_session_hours", e.target.value)
                      }
                    />
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="staff_signature"
                    checked={formData.staff_signature_on_file}
                    onCheckedChange={(checked) =>
                      handleChange("staff_signature_on_file", checked)
                    }
                  />
                  <Label htmlFor="staff_signature" className="cursor-pointer">
                    Staff Signature On File
                  </Label>
                </div>
                {formData.staff_signature_on_file && (
                  <>
                    <div>
                      <Label>Staff Sign Date</Label>
                      <Input
                        type="datetime-local"
                        value={formData.staff_sign_date}
                        onChange={(e) =>
                          handleChange("staff_sign_date", e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <Label>Approx. Location of Staff Sign</Label>
                      <Input
                        value={formData.approx_location_staff_sign}
                        onChange={(e) =>
                          handleChange(
                            "approx_location_staff_sign",
                            e.target.value
                          )
                        }
                      />
                    </div>
                  </>
                )}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="guardian_signature"
                    checked={formData.guardian_signature_on_file}
                    onCheckedChange={(checked) =>
                      handleChange("guardian_signature_on_file", checked)
                    }
                  />
                  <Label htmlFor="guardian_signature" className="cursor-pointer">
                    Guardian Signature On File
                  </Label>
                </div>
                {formData.guardian_signature_on_file && (
                  <>
                    <div>
                      <Label>Guardian Sign Date</Label>
                      <Input
                        type="datetime-local"
                        value={formData.guardian_sign_date}
                        onChange={(e) =>
                          handleChange("guardian_sign_date", e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <Label>Approx. Location of Guardian Sign</Label>
                      <Input
                        value={formData.approx_location_guardian_sign}
                        onChange={(e) =>
                          handleChange(
                            "approx_location_guardian_sign",
                            e.target.value
                          )
                        }
                      />
                    </div>
                  </>
                )}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="exclude_payroll"
                    checked={formData.exclude_from_payroll}
                    onCheckedChange={(checked) =>
                      handleChange("exclude_from_payroll", checked)
                    }
                  />
                  <Label htmlFor="exclude_payroll" className="cursor-pointer">
                    Exclude From Payroll
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="exclude_mileage"
                    checked={formData.exclude_from_mileage}
                    onCheckedChange={(checked) =>
                      handleChange("exclude_from_mileage", checked)
                    }
                  />
                  <Label htmlFor="exclude_mileage" className="cursor-pointer">
                    Exclude From Mileage
                  </Label>
                </div>
              </div>
            </TabsContent>
          </Tabs>

            <div className="flex justify-end gap-2 mt-6">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" className="bg-teal-600 hover:bg-teal-700">
                {editingReport ? "Update Report" : "Add Report"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}



