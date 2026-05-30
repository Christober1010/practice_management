"use client";

import { mahaverseFetch } from "@/lib/mahaverse-api";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Clock,
  FileText,
  ChevronDown,
  CheckCircle,
  CheckIcon,
  Trash2,
  Plus,
  File,
  Upload,
  Eye,
  Download,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSelector } from "react-redux";
import DocumentViewerModal from "@/components/clients/DocumentViewerModal";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";

const formatUSPhone = (value) => {
  const digits = (value || "").replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)})-${digits.slice(3)}`;
  return `(${digits.slice(0, 3)})-${digits.slice(3, 6)}-${digits.slice(6)}`;
};
const stripPhoneFormatting = (value) => (value || "").replace(/\D/g, "").slice(0, 10);
const formatSSN = (value) => {
  const digits = (value || "").replace(/\D/g, "").slice(0, 9);
  if (digits.length <= 3) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
};
const stripSSNFormatting = (value) => (value || "").replace(/\D/g, "").slice(0, 9);

const popularCountries = ["USA", "Canada", "United Kingdom", "Australia", "Germany", "France", "Italy", "Spain", "Netherlands", "Other"];

const mapCountryFromShort = (countryShort, countryLong) => {
  if (!countryShort && !countryLong) return "USA";
  const map = {
    us: "USA",
    ca: "Canada",
    gb: "United Kingdom",
    au: "Australia",
    de: "Germany",
    fr: "France",
    it: "Italy",
    es: "Spain",
    nl: "Netherlands",
  };
  return map[(countryShort || "").toLowerCase()] || countryLong || "USA";
};

/** Coerce API null/undefined for controlled inputs */
const str = (v) => (v == null || v === false ? "" : String(v));

/**
 * Prefer structured address columns; if all empty, parse legacy `address`
 * (e.g. "123 St, Chicago, IL 60601") so city/state/zip show in the edit form.
 */
function structuredAddressFromStaffRecord(staff) {
  const line1 = str(staff.address_line_1);
  const line2 = str(staff.address_line_2);
  let city = str(staff.city);
  let state = str(staff.state);
  let zip = str(staff.zipcode);
  if (line1 || line2 || city || state || zip) {
    return {
      address_line_1: line1,
      address_line_2: line2,
      city,
      state,
      zipcode: zip,
    };
  }
  const full = str(staff.address).trim();
  if (!full) {
    return {
      address_line_1: "",
      address_line_2: "",
      city: "",
      state: "",
      zipcode: "",
    };
  }
  const parts = full.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 1) {
    return {
      address_line_1: parts[0],
      address_line_2: "",
      city: "",
      state: "",
      zipcode: "",
    };
  }
  if (parts.length === 2) {
    return {
      address_line_1: parts[0],
      address_line_2: "",
      city: parts[1],
      state: "",
      zipcode: "",
    };
  }
  const a1 = parts[0];
  const c = parts[1];
  const tail = parts.slice(2).join(", ");
  const m = tail.match(/^([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)\s*$/);
  if (m) {
    return {
      address_line_1: a1,
      address_line_2: "",
      city: c,
      state: m[1].toUpperCase(),
      zipcode: m[2],
    };
  }
  return {
    address_line_1: a1,
    address_line_2: "",
    city: c,
    state: "",
    zipcode: tail,
  };
}

const initialStaffState = {
  // Personal Information
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  address: "",
  address_line_1: "",
  address_line_2: "",
  city: "",
  state: "",
  zipcode: "",
  country: "USA",
  jobTitle: "",
  ssn: "",
  emergencyContactName: "",
  emergencyRelationship: "",
  emergencyPhone: "",
  emergencyEmail: "",
  highestDegree: "",
  yearAwarded: "",
  major: "",
  location: "",
  // Professional Information
  staffType: "",
  npiNumber: "",
  dateOfJoining: "",
  dateOfLeaving: "",
  status: "",
  dob: "",
  assignedStaff: [],
  assignedClients: [],

  // Certifications
  certifications: [], // Changed from having a default RBT certification
  // Timing Availability (flattened for form)
  mondayAvailable: false,
  mondayStart: "",
  mondayEnd: "",
  tuesdayAvailable: false,
  tuesdayStart: "",
  tuesdayEnd: "",
  wednesdayAvailable: false,
  wednesdayStart: "",
  wednesdayEnd: "",
  thursdayAvailable: false,
  thursdayStart: "",
  thursdayEnd: "",
  fridayAvailable: false,
  fridayStart: "",
  fridayEnd: "",
  saturdayAvailable: false,
  saturdayStart: "",
  saturdayEnd: "",
  sundayAvailable: false,
  sundayStart: "",
  sundayEnd: "",
  // Location preferences (flattened for form)
  homeVisits: false,
  clinic: false,
  school: false,
  community: false,
  // Documents (Driver License, Background Check, etc.)
  documents: [],
};

// Helper to generate time options for dropdown (e.g., "00:00", "00:15", ..., "23:45") - full 24h to match client
const generateTimeOptions = () => {
  const times = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const hour = h.toString().padStart(2, "0");
      const minute = m.toString().padStart(2, "0");
      times.push(`${hour}:${minute}`);
    }
  }
  return times;
};

const timeOptions = generateTimeOptions();

// Helper to format 24hr time to 12hr AM/PM for display in dropdown
const formatTimeForDropdown = (time24hr) => {
  if (!time24hr) return "";
  const [hours, minutes] = time24hr.split(":").map(Number);
  const ampm = hours >= 12 ? "PM" : "AM";
  const formattedHours = hours % 12 === 0 ? 12 : hours % 12;
  return `${formattedHours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")} ${ampm}`;
};

// Custom MultiSelect component - FIXED

export const MultiSelect = ({ options, selected, onChange, placeholder }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef(null); // Ref to track the dropdown element

  // Filter options based on search input
  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(search.toLowerCase())
  );

  // Handle clicks outside the dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
        setSearch(""); // Reset search when closing
      }
    };

    // Add event listener for clicks
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      // Cleanup event listener on component unmount
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSelect = (value) => {
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div ref={dropdownRef}>
      {" "}
      {/* Attach ref to the root div */}
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className="w-full justify-between bg-transparent"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(!open);
          setSearch(""); // Reset search when opening/closing
        }}
      >
        {selected.length > 0 ? `${selected.length} selected` : placeholder}
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      {open && (
        <div className="w-full p-0 mt-2 border border-slate-200 rounded-lg shadow-lg">
          <div className="p-2">
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="p-2 text-sm text-gray-500">No results found</div>
            ) : (
              filteredOptions.map((option) => (
                <div
                  key={option.value}
                  className="p-2 flex items-center space-x-2 cursor-pointer hover:bg-slate-100 text-sm"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSelect(option.value);
                  }}
                >
                  <CheckIcon
                    className={cn(
                      "mr-2 h-4 w-4",
                      selected.includes(option.value)
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />
                  {option.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default function AddStaffModal({
  isOpen,
  onClose,
  onSave,
  editingStaff = null,
  existingStaffs = [],
}) {
  const [formData, setFormData] = useState(initialStaffState);
  const [errors, setErrors] = useState({});
  const [activeTab, setActiveTab] = useState("personal");
  const [saving, setSaving] = useState(false);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [viewingDocument, setViewingDocument] = useState(null);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";
  const tabOrder = [
    "personal",
    "professional",
    "certification",
    "availability",
    "documents",
  ];

  const clients = useSelector((state) => state.clients.items);

  const isClientActive = (client) => {
    if (!client) return false;
    const active =
      client.is_active !== false &&
      client.is_active !== 0 &&
      client.is_active !== "0";
    const archived =
      client.archived === true ||
      client.archived === 1 ||
      client.archived === "1";
    return active && !archived;
  };

  useEffect(() => {
    if (baseUrl) {
      mahaverseFetch('/document-types.php')
        .then((r) => r.json())
        .then((json) => {
          if (json.success && json.data) setDocumentTypes(json.data.filter((d) => d.archived !== 1));
        })
        .catch(() => {});
    }
  }, [baseUrl]);

  useEffect(() => {
    if (editingStaff) {
      const mapCertifications = (certs) => {
        return certs.map((cert) => ({
          certificationType:
            cert.certification_type || cert.certificationType || "RBT",
          certificationNumber:
            cert.certification_number || cert.certificationNumber || "",
          npiNumber: cert.npi_number || cert.npiNumber || "",
          issueDate: cert.issue_date || cert.issueDate || "",
          expiryDate: cert.expiry_date || cert.expiryDate || "",
          status: cert.status || "Active",
        }));
      };

      const addr = structuredAddressFromStaffRecord(editingStaff);

      setFormData({
        ...initialStaffState,
        ...editingStaff,
        ...addr,
        country: str(editingStaff.country) || "USA",
        location: str(editingStaff.location),
        dob: editingStaff.dob ? String(editingStaff.dob).slice(0, 10) : "",
        jobTitle: editingStaff.job_title ?? editingStaff.jobTitle ?? "",
        ssn: editingStaff.ssn_encrypted ?? editingStaff.ssn ?? "",
        emergencyContactName: editingStaff.emergency_contact_name ?? editingStaff.emergencyContactName ?? "",
        emergencyRelationship: editingStaff.emergency_relationship ?? editingStaff.emergencyRelationship ?? "",
        emergencyPhone: editingStaff.emergency_phone ?? editingStaff.emergencyPhone ?? "",
        emergencyEmail: editingStaff.emergency_email ?? editingStaff.emergencyEmail ?? "",
        highestDegree: editingStaff.highest_degree ?? editingStaff.highestDegree ?? "",
        yearAwarded: editingStaff.year_awarded ?? editingStaff.yearAwarded ?? "",
        major: editingStaff.major ?? "",
        certifications: editingStaff.certifications
          ? mapCertifications(editingStaff.certifications)
          : initialStaffState.certifications,

        // Flatten availability for form fields (copy times to empty days when editing)
        ...(function fillAvailabilityFromEditing() {
          const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
          const norm = (t) => (t && String(t).slice(0, 5)) || "";
          const isEmpty = (s, e) => {
            const a = norm(s);
            const b = norm(e);
            return !a || !b || a === "00:00" || b === "00:00";
          };
          const raw = {};
          for (const d of days) {
            const av = editingStaff.availability?.[d];
            raw[`${d}Available`] = !!av?.available;
            raw[`${d}Start`] = norm(av?.start) || "";
            raw[`${d}End`] = norm(av?.end) || "";
          }
          let ref = null;
          for (const d of days) {
            if (raw[`${d}Available`] && !isEmpty(raw[`${d}Start`], raw[`${d}End`])) {
              ref = { start: raw[`${d}Start`], end: raw[`${d}End`] };
              break;
            }
          }
          if (ref) {
            for (const d of days) {
              if (raw[`${d}Available`] && isEmpty(raw[`${d}Start`], raw[`${d}End`])) {
                raw[`${d}Start`] = ref.start;
                raw[`${d}End`] = ref.end;
              }
            }
          }
          return raw;
        })(),
        // Flatten location preferences for form fields
        homeVisits: editingStaff.locationPreferences?.homeVisits || false,
        clinic: editingStaff.locationPreferences?.clinic || false,
        school: editingStaff.locationPreferences?.school || false,
        community: editingStaff.locationPreferences?.community || false,
        // Ensure arrays for assigned fields
        assignedStaff: editingStaff.assignedStaff || [],
        assignedClients: editingStaff.assignedClients || [],
        documents: (editingStaff.documents || []).map((d) => ({
          doc_uuid: d.doc_uuid || `doc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          document_type: d.document_type || "",
          document_path: d.document_path || "",
          document_filename: d.document_filename || "",
          document_original_filename: d.document_original_filename || "",
          document_file: null,
        })),
      });
    } else {
      setFormData(initialStaffState);
    }
    setErrors({});
    setActiveTab("personal");
  }, [editingStaff, isOpen]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const prepareDataForSave = () => {
    // Reconstruct nested objects from flattened form data
    const availability = {
      monday: {
        available: formData.mondayAvailable,
        start: formData.mondayStart,
        end: formData.mondayEnd,
      },
      tuesday: {
        available: formData.tuesdayAvailable,
        start: formData.tuesdayStart,
        end: formData.tuesdayEnd,
      },
      wednesday: {
        available: formData.wednesdayAvailable,
        start: formData.wednesdayStart,
        end: formData.wednesdayEnd,
      },
      thursday: {
        available: formData.thursdayAvailable,
        start: formData.thursdayStart,
        end: formData.thursdayEnd,
      },
      friday: {
        available: formData.fridayAvailable,
        start: formData.fridayStart,
        end: formData.fridayEnd,
      },
      saturday: {
        available: formData.saturdayAvailable,
        start: formData.saturdayStart,
        end: formData.saturdayEnd,
      },
      sunday: {
        available: formData.sundayAvailable,
        start: formData.sundayStart,
        end: formData.sundayEnd,
      },
    };

    const locationPreferences = {
      homeVisits: formData.homeVisits,
      clinic: formData.clinic,
      school: formData.school,
      community: formData.community,
    };

    const addressParts = [
      formData.address_line_1,
      formData.address_line_2,
      formData.city,
      formData.state ? `${formData.state} ${formData.zipcode || ""}`.trim() : formData.zipcode,
      formData.country !== "USA" ? formData.country : "",
    ].filter(Boolean);
    const addressCombined = addressParts.join(", ") || formData.address || null;

    const makeLocalId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const staffId = editingStaff?.id || `ST${Date.now()}${Math.random().toString(36).slice(2, 9)}`;
    const dataToSave = {
      ...formData,
      id: staffId,
      fullName: `${formData.firstName.trim()} ${formData.lastName.trim()}`,
      address: addressCombined,
      job_title: formData.jobTitle,
      ssn_encrypted: formData.ssn,
      address_line_1: formData.address_line_1,
      address_line_2: formData.address_line_2,
      city: formData.city,
      state: formData.state,
      zipcode: formData.zipcode,
      country: formData.country,
      emergency_contact_name: formData.emergencyContactName,
      emergency_relationship: formData.emergencyRelationship,
      emergency_phone: formData.emergencyPhone,
      emergency_email: formData.emergencyEmail,
      highest_degree: formData.highestDegree,
      year_awarded: formData.yearAwarded,
      major: formData.major,
      documents: (formData.documents || []).map((d) => ({
        doc_uuid: d.doc_uuid,
        document_type: d.document_type,
        document_path: d.document_path,
        document_filename: d.document_filename,
        document_original_filename: d.document_original_filename,
        document_file: d.document_file, // Keep for upload - parent strips before API
      })).filter((d) => d.document_path || d.document_filename || d.document_file),
      availability,
      locationPreferences,
      dateOfJoining: formData.dateOfJoining || "",
      dateOfLeaving: formData.dateOfLeaving || "",
      location: (formData.location && String(formData.location).trim()) || null,
    };

    // Normalize certifications from the form array
    const normalizedCerts = (formData.certifications || [])
      .map((c) => ({
        certification_type: c.certificationType || formData.staffType || "RBT",
        certification_number: c.certificationNumber || "",
        npi_number: c.npiNumber || null,
        issue_date: c.issueDate || null,
        expiry_date: c.expiryDate || null,
      }))
      // only include certs that have a number
      .filter((c) => !!c.certification_number);

    // Fallback for older data: if array is empty but a legacy top-level field exists
    if (normalizedCerts.length === 0 && formData.certificationNumber) {
      normalizedCerts.push({
        certification_type: formData.staffType || "RBT",
        certification_number: formData.certificationNumber,
        npi_number: formData.npiNumber || null,
        issue_date: null,
        expiry_date: null,
      });
    }

    dataToSave.certifications = normalizedCerts;

    // Remove flattened fields before sending
    Object.keys(initialStaffState).forEach((key) => {
      if (
        key.includes("Available") ||
        key.includes("Start") ||
        key.includes("End") ||
        key.includes("Visits") ||
        key.includes("clinic") ||
        key.includes("school") ||
        key.includes("community")
      ) {
        delete dataToSave[key];
      }
    });

    return dataToSave;
  };

  const validateCurrentTab = (tab) => {
    const currentTabErrors = {};
    let hasErrors = false;

    switch (tab) {
      case "personal":
        if (!formData.firstName.trim()) {
          currentTabErrors.firstName = "Missing Required Entry";
          hasErrors = true;
        }
        if (!formData.lastName.trim()) {
          currentTabErrors.lastName = "Missing Required Entry";
          hasErrors = true;
        }
        if (!formData.email.trim()) {
          currentTabErrors.email = "Missing Required Entry";
          hasErrors = true;
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
          currentTabErrors.email = "Invalid email format";
          hasErrors = true;
        }
        break;

      case "professional":
        if (!formData.staffType.trim()) {
          currentTabErrors.staffType = "Missing Required Entry";
          hasErrors = true;
        }
        if (!formData.dateOfJoining.trim()) {
          currentTabErrors.dateOfJoining = "Missing Required Entry";
          hasErrors = true;
        }
        if (!formData.status.trim()) {
          currentTabErrors.status = "Missing Required Entry";
          hasErrors = true;
        }
        if (
          formData.status === "Terminated" &&
          !String(formData.dateOfLeaving || "").trim()
        ) {
          currentTabErrors.dateOfLeaving = "Missing Required Entry";
          hasErrors = true;
        }
        break;

      case "certification":
        const certifications = formData.certifications;
        certifications.forEach((cert, index) => {
          if (!cert.certificationType.trim()) {
            currentTabErrors[`cert_type_${index}`] = "Missing Required Entry";
            hasErrors = true;
          }
          if (!cert.certificationNumber.trim()) {
            currentTabErrors[`cert_number_${index}`] = "Missing Required Entry";
            hasErrors = true;
          }
          if (!cert.issueDate.trim()) {
            currentTabErrors[`issue_date_${index}`] = "Missing Required Entry";
            hasErrors = true;
          }
          if (!cert.expiryDate.trim()) {
            currentTabErrors[`expiry_date_${index}`] = "Missing Required Entry";
            hasErrors = true;
          }
        });
        break;

      case "availability":
        const days = [
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
          "sunday",
        ];
        days.forEach((day) => {
          if (formData[`${day}Available`]) {
            if (!formData[`${day}Start`].trim()) {
              currentTabErrors[`${day}Start`] = "Missing Required Entry";
              hasErrors = true;
            }
            if (!formData[`${day}End`].trim()) {
              currentTabErrors[`${day}End`] = "Missing Required Entry";
              hasErrors = true;
            }
            if (
              formData[`${day}Start`] &&
              formData[`${day}End`] &&
              formData[`${day}Start`] >= formData[`${day}End`]
            ) {
              currentTabErrors[`${day}End`] =
                "End time must be after start time";
              hasErrors = true;
            }
          }
        });
        break;

      default:
        break;
    }

    setErrors((prev) => ({ ...prev, ...currentTabErrors }));
    return hasErrors;
  };

  const validateAllTabs = () => {
    let hasAnyErrors = false;
    let firstErrorTab = null;

    tabOrder.forEach((tab) => {
      const hasTabErrors = validateCurrentTab(tab);
      if (hasTabErrors && !firstErrorTab) {
        firstErrorTab = tab;
        hasAnyErrors = true;
      }
    });

    if (firstErrorTab) {
      setActiveTab(firstErrorTab);
    }

    return hasAnyErrors;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);

    const hasErrors = validateAllTabs();
    if (hasErrors) {
      setSaving(false);
      return;
    }

    const dataToSave = prepareDataForSave();
    const ok = await onSave(dataToSave);
    setSaving(false);
    if (ok === true) {
      handleClose();
    }
  };

  const handleNextTab = (e) => {
    e.preventDefault();
    const hasErrors = validateCurrentTab(activeTab);
    if (hasErrors) {
      return; // Stay on current tab if there are errors
    }

    const currentIndex = tabOrder.indexOf(activeTab);
    if (currentIndex < tabOrder.length - 1) {
      setActiveTab(tabOrder[currentIndex + 1]);
    } else {
      handleSave(e);
    }
  };

  const handlePreviousTab = () => {
    const currentIndex = tabOrder.indexOf(activeTab);
    if (currentIndex > 0) {
      setActiveTab(tabOrder[currentIndex - 1]);
    }
  };

  const handleClose = () => {
    setFormData(initialStaffState);
    setErrors({});
    setActiveTab("personal");

    onClose();
  };

  const isLastTab = activeTab === tabOrder[tabOrder.length - 1];

  const renderInputWithError = (id, label, value, onChange, props = {}) => (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={onChange}
        className={
          errors[id]
            ? "border-red-500 focus:border-red-500 focus:ring-red-500"
            : ""
        }
        {...props}
      />
      {errors[id] && <p className="text-red-500 text-sm mt-1">{errors[id]}</p>}
    </div>
  );

  const renderSelectWithError = (
    id,
    label,
    value,
    onValueChange,
    children,
    placeholder = "Select..."
  ) => (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger
          className={
            errors[id]
              ? "border-red-500 focus:border-red-500 focus:ring-red-500"
              : ""
          }
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
      {errors[id] && <p className="text-red-500 text-sm mt-1">{errors[id]}</p>}
    </div>
  );

  const dayOrder = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const normalizeTime = (t) => (t && String(t).slice(0, 5)) || ""; // "16:00:00" -> "16:00"
  const isRealTime = (s, e) => {
    const a = normalizeTime(s);
    const b = normalizeTime(e);
    return a && b && a !== "00:00" && b !== "00:00";
  };
  const getReferenceTimes = (excludingDay) => {
    for (const d of dayOrder) {
      if (d === excludingDay) continue;
      const avail = formData[`${d}Available`];
      const start = formData[`${d}Start`];
      const end = formData[`${d}End`];
      if (avail && isRealTime(start, end)) {
        return { start: normalizeTime(start), end: normalizeTime(end) };
      }
    }
    return { start: "08:00", end: "17:00" };
  };

  const renderDayAvailability = (day, dayLabel) => (
    <div
      key={day}
      className="flex items-center space-x-4 p-3 border border-slate-200 rounded-lg"
    >
      <div className="flex items-center space-x-2 min-w-[100px]">
        <Checkbox
          id={`${day}Available`}
          checked={formData[`${day}Available`]}
          onCheckedChange={(checked) => {
            if (checked === true) {
              const ref = getReferenceTimes(day);
              const start = normalizeTime(formData[`${day}Start`]);
              const end = normalizeTime(formData[`${day}End`]);
              const needsCopy = !start || !end || start === "00:00" || end === "00:00";
              setFormData((prev) => ({
                ...prev,
                [`${day}Available`]: true,
                ...(needsCopy ? { [`${day}Start`]: ref.start, [`${day}End`]: ref.end } : {}),
              }));
              if (needsCopy) {
                setErrors((prev) => {
                  const next = { ...prev };
                  delete next[`${day}Start`];
                  delete next[`${day}End`];
                  return next;
                });
              }
            } else {
              handleInputChange(`${day}Available`, false);
            }
          }}
        />
        <Label htmlFor={`${day}Available`} className="font-medium">
          {dayLabel}
        </Label>
      </div>
      {formData[`${day}Available`] && (
        <div className="flex items-center space-x-2">
          <div>
            <Select
              value={formData[`${day}Start`]}
              onValueChange={(value) => handleInputChange(`${day}Start`, value)}
            >
              <SelectTrigger
                className={`w-32 ${
                  errors[`${day}Start`] ? "border-red-500" : ""
                }`}
              >
                <SelectValue placeholder="Start Time">
                  {formatTimeForDropdown(formData[`${day}Start`]) ||
                    "Start Time"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {timeOptions.map((time) => (
                  <SelectItem key={time} value={time}>
                    {formatTimeForDropdown(time)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors[`${day}Start`] && (
              <p className="text-red-500 text-xs mt-1">
                {errors[`${day}Start`]}
              </p>
            )}
          </div>
          <span className="text-slate-500">to</span>
          <div>
            <Select
              value={formData[`${day}End`]}
              onValueChange={(value) => handleInputChange(`${day}End`, value)}
            >
              <SelectTrigger
                className={`w-32 ${
                  errors[`${day}End`] ? "border-red-500" : ""
                }`}
              >
                <SelectValue placeholder="End Time">
                  {formatTimeForDropdown(formData[`${day}End`]) || "End Time"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {timeOptions.map((time) => (
                  <SelectItem key={time} value={time}>
                    {formatTimeForDropdown(time)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors[`${day}End`] && (
              <p className="text-red-500 text-xs mt-1">{errors[`${day}End`]}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
  const addCertification = () => {
    setFormData((prev) => ({
      ...prev,
      certifications: [
        ...prev.certifications,
        {
          certificationType: "",
          certificationNumber: "",
          npiNumber: "",
          issueDate: "",
          expiryDate: "",
          status: "",
        },
      ],
    }));
  };

  const makeDocUuid = () => `doc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const addDocument = () => {
    setFormData((prev) => ({
      ...prev,
      documents: [...(prev.documents || []), {
        doc_uuid: makeDocUuid(),
        document_type: "",
        document_path: "",
        document_filename: "",
        document_original_filename: "",
        document_file: null,
      }],
    }));
  };

  const handleDocumentChange = (docUuid, field, value) => {
    setFormData((prev) => ({
      ...prev,
      documents: (prev.documents || []).map((d) =>
        d.doc_uuid === docUuid ? { ...d, [field]: value } : d
      ),
    }));
  };

  const handleDocumentFileSelect = (docUuid, file) => {
    if (!file) return;
    const allowed = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
    if (!allowed.includes(file.type)) {
      alert("Please upload PDF, JPG, or PNG.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      alert("File size must be less than 25MB.");
      return;
    }
    setFormData((prev) => ({
      ...prev,
      documents: (prev.documents || []).map((d) =>
        d.doc_uuid === docUuid
          ? {
              ...d,
              document_file: file,
              document_original_filename: file.name,
              document_path: "",
              document_filename: "",
            }
          : d,
      ),
    }));
  };

  const removeDocument = (docUuid) => {
    setFormData((prev) => ({
      ...prev,
      documents: (prev.documents || []).filter((d) => d.doc_uuid !== docUuid),
    }));
  };

  const removeCertification = (index) => {
    setFormData((prev) => ({
      ...prev,
      certifications: prev.certifications.filter((_, i) => i !== index),
    }));
  };

  const handleCertificationChange = (index, field, value) => {
    setFormData((prev) => {
      const updatedCerts = [...prev.certifications];
      updatedCerts[index][field] = value;
      return { ...prev, certifications: updatedCerts };
    });
  };

  // Helper to compute read-only certification status from expiry date on the client (mirrors backend)
  const computeCertStatus = (expiryDate) => {
    if (!expiryDate) return "Active";
    const today = new Date();
    const todayOnly = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const exp = new Date(expiryDate);
    if (isNaN(exp.getTime())) return "Active";
    return exp >= todayOnly ? "Active" : "Expired";
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-slate-800">
            {editingStaff ? "Edit Staff Member" : "Add New Staff Member"}
            {saving && (
              <span className="ml-2 text-sm text-gray-500 italic">
                Saving...
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-6">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="personal">
                <Users className="h-4 w-4 mr-2" /> Personal
              </TabsTrigger>
              <TabsTrigger value="professional">
                <FileText className="h-4 w-4 mr-2" /> Professional
              </TabsTrigger>
              <TabsTrigger value="certification">
                <CheckCircle className="h-4 w-4 mr-2" /> Certification
              </TabsTrigger>
              <TabsTrigger value="availability">
                <Clock className="h-4 w-4 mr-2" /> Availability
              </TabsTrigger>
              <TabsTrigger value="documents">
                <File className="h-4 w-4 mr-2" /> Documents
              </TabsTrigger>
            </TabsList>
            {/* Personal Information Tab */}
            <TabsContent value="personal" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-teal-600" /> Personal
                    Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderInputWithError(
                      "firstName",
                      "First Name *",
                      formData.firstName,
                      (e) => handleInputChange("firstName", e.target.value),
                      { placeholder: "Enter first name" }
                    )}
                    {renderInputWithError(
                      "lastName",
                      "Last Name *",
                      formData.lastName,
                      (e) => handleInputChange("lastName", e.target.value),
                      { placeholder: "Enter last name" }
                    )}
                    {renderInputWithError(
                      "jobTitle",
                      "Job Title",
                      formData.jobTitle,
                      (e) => handleInputChange("jobTitle", e.target.value),
                      { placeholder: "Enter job title" }
                    )}
                    <div>
                      <Label htmlFor="ssn">SSN</Label>
                      <Input
                        id="ssn"
                        type="text"
                        value={formatSSN(formData.ssn)}
                        onChange={(e) => handleInputChange("ssn", stripSSNFormatting(e.target.value))}
                        placeholder="XXX-XX-XXXX"
                        maxLength={11}
                        className={errors.ssn ? "border-red-500" : ""}
                      />
                      {errors.ssn && <p className="text-red-500 text-sm mt-1">{errors.ssn}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderInputWithError(
                      "email",
                      "Email *",
                      formData.email,
                      (e) => handleInputChange("email", e.target.value),
                      { type: "email", placeholder: "Enter email address" }
                    )}
                    <div>
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={formatUSPhone(formData.phone)}
                        onChange={(e) =>
                          handleInputChange("phone", stripPhoneFormatting(e.target.value))
                        }
                        placeholder="(123)-456-7890"
                        maxLength={14}
                        className={errors.phone ? "border-red-500" : ""}
                      />
                      {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
                    </div>
                  </div>
                  <div>
                    <Label className="block mb-2">Address</Label>
                    <div className="space-y-2">
                      <AddressAutocomplete
                        id="staff-address-line-1"
                        debug={process.env.NODE_ENV === "development"}
                        value={formData.address_line_1}
                        onChange={(v) => handleInputChange("address_line_1", v)}
                        onAddressSelect={(addr) => {
                          handleInputChange(
                            "address_line_1",
                            addr.addressLine1 || addr.formattedAddress
                          );
                          if (addr.locality) handleInputChange("city", addr.locality);
                          if (addr.administrativeAreaShort) {
                            handleInputChange("state", addr.administrativeAreaShort);
                          }
                          if (addr.postalCode) handleInputChange("zipcode", addr.postalCode);
                          handleInputChange(
                            "country",
                            mapCountryFromShort(addr.countryShort, addr.country)
                          );
                        }}
                        countryRestrictions={["us", "ca", "gb", "au", "de", "fr", "it", "es", "nl"]}
                        placeholder="Start typing to search address..."
                        className={errors.address_line_1 ? "border-red-500" : ""}
                      />
                      <Input
                        value={formData.address_line_2}
                        onChange={(e) => handleInputChange("address_line_2", e.target.value)}
                        placeholder="Apt, suite, unit, etc. (optional)"
                      />
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <Input
                          value={formData.city}
                          onChange={(e) => handleInputChange("city", e.target.value)}
                          placeholder="City"
                        />
                        <Input
                          value={formData.state}
                          onChange={(e) => handleInputChange("state", e.target.value)}
                          placeholder="State"
                        />
                        <Input
                          value={formData.zipcode}
                          onChange={(e) => handleInputChange("zipcode", e.target.value)}
                          placeholder="Zipcode"
                        />
                      </div>
                      <Select
                        value={formData.country === "Other" ? "Other" : formData.country || "USA"}
                        onValueChange={(v) => handleInputChange("country", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Country" />
                        </SelectTrigger>
                        <SelectContent>
                          {popularCountries.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="block mb-2 font-medium text-teal-800">Emergency Contact</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {renderInputWithError(
                        "emergencyContactName",
                        "Contact Name",
                        formData.emergencyContactName,
                        (e) => handleInputChange("emergencyContactName", e.target.value),
                        { placeholder: "Full name" }
                      )}
                      {renderInputWithError(
                        "emergencyRelationship",
                        "Relationship",
                        formData.emergencyRelationship,
                        (e) => handleInputChange("emergencyRelationship", e.target.value),
                        { placeholder: "e.g. Spouse, Parent" }
                      )}
                      <div>
                        <Label htmlFor="emergencyPhone">Phone</Label>
                        <Input
                          id="emergencyPhone"
                          type="tel"
                          value={formatUSPhone(formData.emergencyPhone)}
                          onChange={(e) =>
                            handleInputChange("emergencyPhone", stripPhoneFormatting(e.target.value))
                          }
                          placeholder="(123)-456-7890"
                          maxLength={14}
                        />
                      </div>
                      {renderInputWithError(
                        "emergencyEmail",
                        "Email",
                        formData.emergencyEmail,
                        (e) => handleInputChange("emergencyEmail", e.target.value),
                        { type: "email", placeholder: "Enter email" }
                      )}
                    </div>
                  </div>
                  {renderInputWithError(
                    "dob",
                    "Date of Birth",
                    formData.dob,
                    (e) => handleInputChange("dob", e.target.value),
                    { type: "date" }
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Professional Information Tab */}
            <TabsContent value="professional" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-teal-600" /> Professional
                    Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderInputWithError(
                      "location",
                      "Primary location / office",
                      formData.location,
                      (e) => handleInputChange("location", e.target.value),
                      { placeholder: "e.g. Naperville clinic, Home-based" }
                    )}
                    {renderSelectWithError(
                      "staffType",
                      "Staff Type *",
                      formData.staffType,
                      (value) => handleInputChange("staffType", value),
                      <>
                        <SelectItem value="RBT">
                          RBT (Registered Behavior Technician)
                        </SelectItem>
                        <SelectItem value="BT">
                          BT (Behavior Technician)
                        </SelectItem>
                        <SelectItem value="BCBA">
                          BCBA (Board Certified Behavior Analyst)
                        </SelectItem>
                        <SelectItem value="BCaBA">
                          BCaBA (Board Certified Assistant Behavior Analyst)
                        </SelectItem>
                      </>,
                      "Select staff type"
                    )}
                    {renderSelectWithError(
                      "status",
                      "Staff Status *",
                      formData.status,
                      (value) => {
                        handleInputChange("status", value);
                        if (value === "Terminated") {
                          handleInputChange("assignedStaff", []);
                          handleInputChange("assignedClients", []);
                        }
                      },
                      <>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                        <SelectItem value="On Leave">On Leave</SelectItem>
                        <SelectItem value="Terminated">Terminated</SelectItem>
                      </>,
                      "Select status"
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderInputWithError(
                      "dateOfJoining",
                      "Date of Joining *",
                      formData.dateOfJoining,
                      (e) => handleInputChange("dateOfJoining", e.target.value),
                      { type: "date" }
                    )}
                    <div>
                      <Label htmlFor="dateOfLeaving">
                        Date of Leaving
                        {formData.status === "Terminated" ? " *" : ""}
                      </Label>
                      <Input
                        id="dateOfLeaving"
                        type="date"
                        value={formData.dateOfLeaving}
                        onChange={(e) =>
                          handleInputChange("dateOfLeaving", e.target.value)
                        }
                      />
                      {errors.dateOfLeaving ? (
                        <p className="text-sm text-red-600 mt-1">
                          {errors.dateOfLeaving}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div>
                    <Label className="block mb-2 font-medium text-teal-800">Education</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {renderSelectWithError(
                        "highestDegree",
                        "Highest Degree",
                        formData.highestDegree,
                        (v) => handleInputChange("highestDegree", v),
                        <>
                          <SelectItem value="High School">High School</SelectItem>
                          <SelectItem value="Associate">Associate</SelectItem>
                          <SelectItem value="Bachelor">Bachelor</SelectItem>
                          <SelectItem value="Master">Master</SelectItem>
                          <SelectItem value="Doctorate">Doctorate</SelectItem>
                        </>,
                        "Select degree"
                      )}
                      {renderInputWithError(
                        "yearAwarded",
                        "Year Awarded",
                        formData.yearAwarded,
                        (e) => handleInputChange("yearAwarded", e.target.value),
                        { placeholder: "e.g. 2020" }
                      )}
                      {renderInputWithError(
                        "major",
                        "Major",
                        formData.major,
                        (e) => handleInputChange("major", e.target.value),
                        { placeholder: "e.g. Psychology" }
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Assigned Supervisor</Label>
                      <MultiSelect
                        options={existingStaffs.map((staff) => ({
                          value: staff.id,
                          label: staff.fullName,
                        }))}
                        selected={formData.assignedStaff}
                        onChange={(newSelected) =>
                          handleInputChange("assignedStaff", newSelected)
                        }
                        placeholder="Select staffs"
                      />
                    </div>
                    <div>
                      <Label>Assigned Clients</Label>
                      <MultiSelect
                        options={clients.filter(isClientActive).map((client) => ({
                          value: client.client_id,
                          label: `${client.first_name} ${client.last_name}`,
                        }))}
                        selected={formData.assignedClients}
                        onChange={(newSelected) =>
                          handleInputChange("assignedClients", newSelected)
                        }
                        placeholder="Select clients"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            {/* Certification Details */}
            <TabsContent value="certification" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-teal-600" />{" "}
                      Certifications
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addCertification}
                      className="flex items-center gap-2 bg-transparent"
                    >
                      <Plus className="h-4 w-4" /> Add Certification
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {formData.certifications.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">
                      No certifications added yet.
                    </p>
                  ) : (
                    <div className="space-y-6">
                      {formData.certifications.map((cert, index) => (
                        <div
                          key={index}
                          className="border rounded-lg p-4 space-y-4"
                        >
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold">
                              Certification #{index + 1}
                            </h4>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeCertification(index)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {renderSelectWithError(
                              `cert_type_${index}`,
                              "Certification Type",
                              cert.certificationType,
                              (value) =>
                                handleCertificationChange(
                                  index,
                                  "certificationType",
                                  value
                                ),
                              <>
                                <SelectItem value="BCBA-L1">BCBA-L1</SelectItem>
                                <SelectItem value="BCBA-L2">BCBA-L2</SelectItem>
                                <SelectItem value="BCBA-L3">BCBA-L3</SelectItem>
                                <SelectItem value="BCABA">BCABA</SelectItem>
                                <SelectItem value="BSA">BSA</SelectItem>
                                <SelectItem value="RBT">RBT</SelectItem>
                                <SelectItem value="BT">BT</SelectItem>
                                <SelectItem value="BCBA">BCBA</SelectItem>
                                <SelectItem value="BCaBA">BCaBA</SelectItem>
                                <SelectItem value="Not Certified">Not Certified</SelectItem>
                              </>,
                              "Select type"
                            )}
                            {renderInputWithError(
                              `cert_number_${index}`,
                              "Certification Number",
                              cert.certificationNumber,
                              (e) =>
                                handleCertificationChange(
                                  index,
                                  "certificationNumber",
                                  e.target.value
                                ),
                              { placeholder: "Enter certification number" }
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {renderInputWithError(
                              `npi_number_${index}`,
                              "NPI Number",
                              cert.npiNumber,
                              (e) =>
                                handleCertificationChange(
                                  index,
                                  "npiNumber",
                                  e.target.value
                                ),
                              { placeholder: "Enter NPI number" }
                            )}
                            {renderInputWithError(
                              `issue_date_${index}`,
                              "Issue Date",
                              cert.issueDate,
                              (e) =>
                                handleCertificationChange(
                                  index,
                                  "issueDate",
                                  e.target.value
                                ),
                              { type: "date" }
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {renderInputWithError(
                              `expiry_date_${index}`,
                              "Expiry Date",
                              cert.expiryDate,
                              (e) =>
                                handleCertificationChange(
                                  index,
                                  "expiryDate",
                                  e.target.value
                                ),
                              { type: "date" }
                            )}
                            <div>
                              <Label htmlFor={`status_${index}`}>
                                Status (auto)
                              </Label>
                              <div className="mt-2 text-sm">
                                <div
                                  className={
                                    computeCertStatus(cert.expiryDate) ===
                                    "Active"
                                      ? "bg-green-100 text-green-800 px-2 py-1 rounded-full w-fit"
                                      : "bg-red-100 text-red-800 px-2 py-1 rounded-full w-fit"
                                  }
                                >
                                  {computeCertStatus(cert.expiryDate)}
                                </div>
                                <p className="text-xs text-slate-500 mt-1">
                                  Status is computed from expiry date and cannot
                                  be edited.
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Timing Availability Tab */}
            <TabsContent value="availability" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-teal-600" /> Timing
                    Availability
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {renderDayAvailability("monday", "Monday")}
                  {renderDayAvailability("tuesday", "Tuesday")}
                  {renderDayAvailability("wednesday", "Wednesday")}
                  {renderDayAvailability("thursday", "Thursday")}
                  {renderDayAvailability("friday", "Friday")}
                  {renderDayAvailability("saturday", "Saturday")}
                  {renderDayAvailability("sunday", "Sunday")}
                </CardContent>
              </Card>
            </TabsContent>
            {/* Documents Tab */}
            <TabsContent value="documents" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <File className="h-5 w-5 text-teal-600" /> Documents
                      <Badge variant="secondary">Optional</Badge>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={addDocument}>
                      <Plus className="h-4 w-4 mr-2" /> Add Document
                    </Button>
                  </CardTitle>
                  <p className="text-sm text-slate-500 mt-1">
                    Driver License, Background Check, etc. Same document types as clients.
                  </p>
                </CardHeader>
                <CardContent>
                  {(!formData.documents || formData.documents.length === 0) ? (
                    <p className="text-slate-500 text-center py-6">No documents. Click Add Document.</p>
                  ) : (
                    <div className="space-y-4">
                      {(formData.documents || []).map((doc, index) => (
                        <div key={doc.doc_uuid} className="border rounded-lg p-4 space-y-3">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <Label>Document Type</Label>
                                <Select
                                  value={doc.document_type || ""}
                                  onValueChange={(v) => handleDocumentChange(doc.doc_uuid, "document_type", v)}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select type" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {(documentTypes.length ? documentTypes : [
                                      { type_name: "Driver License" },
                                      { type_name: "Background Check" },
                                      { type_name: "Insurance" },
                                      { type_name: "Misc" },
                                    ]).map((t) => (
                                      <SelectItem key={t.id || t.type_name} value={t.type_name || t.id}>
                                        {t.type_name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <Button type="button" variant="ghost" size="sm" onClick={() => removeDocument(doc.doc_uuid)} className="text-red-600">
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          {(doc.document_path || doc.document_file) ? (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-slate-600 truncate flex-1">
                                {doc.document_original_filename || doc.document_filename || "File attached"}
                              </span>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setViewingDocument({
                                  path: doc.document_path,
                                  filename: doc.document_original_filename || doc.document_filename || "document",
                                  documentFilename: doc.document_filename,
                                })}
                              >
                                <Eye className="h-4 w-4 mr-2" /> View
                              </Button>
                              {doc.document_path && baseUrl && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={async () => {
                                    try {
                                      const path = doc.document_path || "";
                                      const isDrive = path.startsWith("drive://");
                                      const fileId = isDrive ? (doc.document_filename || path.slice(8)) : null;
                                      let url;
                                      if (fileId) {
                                        url = `${baseUrl}/download-client-document.php?file_id=${encodeURIComponent(fileId)}${doc.document_original_filename ? "&filename=" + encodeURIComponent(doc.document_original_filename) : ""}`;
                                      } else if (path.startsWith("uploads/")) {
                                        url = `${baseUrl}/download-client-upload.php?path=${encodeURIComponent(path)}${doc.document_original_filename ? "&filename=" + encodeURIComponent(doc.document_original_filename) : ""}`;
                                      } else {
                                        alert("No downloadable file.");
                                        return;
                                      }
                                      const res = await fetch(url, { credentials: "omit" });
                                      if (!res.ok) throw new Error("Download failed");
                                      const blob = await res.blob();
                                      const a = document.createElement("a");
                                      a.href = URL.createObjectURL(blob);
                                      a.download = doc.document_original_filename || "document";
                                      a.click();
                                      URL.revokeObjectURL(a.href);
                                    } catch (e) {
                                      alert("Failed to download: " + (e.message || "Unknown error"));
                                    }
                                  }}
                                >
                                  <Download className="h-4 w-4 mr-2" /> Download
                                </Button>
                              )}
                            </div>
                          ) : (
                            <>
                              <Label htmlFor={`staff-doc-${doc.doc_uuid}`} className="block">
                                <div className="border-2 border-dashed rounded-lg p-4 cursor-pointer hover:bg-slate-50">
                                  <div className="flex flex-col items-center gap-2 text-slate-500">
                                    <Upload className="h-8 w-8" />
                                    <span className="text-sm">Click to upload (PDF, JPG, PNG, max 25MB)</span>
                                  </div>
                                </div>
                              </Label>
                              <Input
                                id={`staff-doc-${doc.doc_uuid}`}
                                type="file"
                                accept="application/pdf,image/jpeg,image/jpg,image/png"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handleDocumentFileSelect(doc.doc_uuid, f);
                                }}
                              />
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-3 pt-6 border-t">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" className="bg-teal-600 hover:bg-teal-700">
              {editingStaff ? "Update Staff" : "Add Staff"}
            </Button>
            {!isLastTab && (
              <Button
                type="button"
                onClick={handleNextTab}
                className="bg-teal-600 hover:bg-teal-700"
              >
                Next
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
      {viewingDocument && (
        <DocumentViewerModal
          isOpen={!!viewingDocument}
          documentPath={viewingDocument.path}
          filename={viewingDocument.filename}
          documentFilename={viewingDocument.documentFilename}
          baseUrl={baseUrl}
          onClose={() => setViewingDocument(null)}
        />
      )}
    </Dialog>
  );
}
