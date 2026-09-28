'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LayoutDashboard, FileText, MoreVertical, Search, User, Phone, Heart, GraduationCap, Building2, Shield, CreditCard, Download, File, Eye } from 'lucide-react';
import type { StaffListItem } from '@/lib/launchpad/api';
import { checkAuth, ensureAuth, getAttachmentDownloadUrl, formatFileSize, getDriveOAuthStartUrl, getDriveOAuthLink, getDriveStatus, disconnectDrive, createShareKey } from '@/lib/launchpad/api';
import FileViewerModal from '@/components/launchpad/FileViewerModal';
import ShareKeyModal from '@/components/launchpad/ShareKeyModal';

interface DashboardProps {
  onNavigate: (view: string) => void;
  onCreateNew?: () => void;
  myStaff?: StaffListItem[];
  myStaffLoading?: boolean;
  myStaffError?: string | null;
  onRefreshMyStaff?: (opts?: { name?: string; share_key?: string }) => void;
  onEditStaff?: (staff: StaffListItem) => void;
}

export default function Dashboard({
  onNavigate,
  onCreateNew,
  myStaff = [],
  myStaffLoading = false,
  myStaffError = null,
  onRefreshMyStaff,
  onEditStaff,
}: DashboardProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [shareKey, setShareKey] = useState('');
  const [driveStatus, setDriveStatus] = useState<{
    enabled?: boolean;
    auth_mode?: string;
    connected?: boolean;
    connected_by?: string | null;
    updated_at?: string | null;
  } | null>(null);
  const [driveLoading, setDriveLoading] = useState(false);
  const [expandedStaffId, setExpandedStaffId] = useState<number | null>(null);
  const [viewingAttachment, setViewingAttachment] = useState<{
    attachmentId: number;
    filename: string;
    mimeType: string;
  } | null>(null);
  const [isGeneratingShareKey, setIsGeneratingShareKey] = useState<number | null>(null);
  const [shareKeyModal, setShareKeyModal] = useState<{
    isOpen: boolean;
    shareKey?: string;
    expiresAt?: string;
    error?: string;
  }>({ isOpen: false });

  const [auth, setAuth] = useState<{ success: boolean; user?: any }>({ success: false });
  useEffect(() => {
    let mounted = true;
    (async () => {
      const res = await ensureAuth();
      if (!mounted) return;
      if (res.success) {
        setAuth({ success: true, user: res.user });
      } else {
        setAuth(checkAuth());
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);
  const normalizeRole = (role?: string | null) => {
    const value = (role || '').toLowerCase();
    if (value === 'viewer' || value === 'reader') return 'reader';
    if (value === 'staff' || value === 'employee') return 'employee';
    if (value === 'hr') return 'admin';
    return value || 'employee';
  };
  const formatRoleLabel = (role?: string | null) => {
    const normalized = normalizeRole(role);
    return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : 'Unknown';
  };
  const currentRole = auth.success ? normalizeRole(auth.user?.role as string | undefined) : undefined;
  const isAdminLike = currentRole === 'admin';
  const isReader = currentRole === 'reader';
  const isEmployeeLike = currentRole === 'employee';
  const canCreateNewEntry = !isReader && (isAdminLike || !isEmployeeLike || myStaff.length === 0);
  const detailsColSpan = isAdminLike ? 5 : 3;

  useEffect(() => {
    if (!isAdminLike) return;
    let mounted = true;
    (async () => {
      const res = await getDriveStatus();
      if (!mounted) return;
      if (res && res.success) {
        setDriveStatus({
          enabled: res.enabled,
          auth_mode: res.auth_mode,
          connected: res.connected,
          connected_by: res.connected_by ?? null,
          updated_at: res.updated_at ?? null,
        });
      }
    })();
    return () => {
      mounted = false;
    };
  }, [isAdminLike]);

  const filteredStaff = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return myStaff.filter((s) => {
      const fullName = `${s.first_name} ${s.middle_name ? s.middle_name + ' ' : ''}${s.last_name}`.toLowerCase();
      const matchesSearch =
        q === '' ||
        fullName.includes(q) ||
        (s.email || '').toLowerCase().includes(q) ||
        String(s.staff_id).includes(q);
      return matchesSearch;
    });
  }, [myStaff, searchTerm]);

  return (
    <div className="space-y-6">
      <header className="mb-6">
        {/* <div className="flex items-center space-x-2 text-sm text-teal-600 mb-2 font-semibold tracking-wide uppercase">
          <LayoutDashboard className="h-5 w-5" />
          <span>Dashboard</span>
        </div> */}
        <h2 className="text-3xl font-bold text-slate-800">Welcome to Maha Launchpad</h2>
        <p className="text-slate-500 mt-2">
          Complete all profile sections to finalize your onboarding process.
        </p>
      </header>

      {/* {isAdminLike && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-teal-600" />
              Google Drive Storage
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="text-sm text-slate-600">
              Status:{' '}
              <span className="font-semibold text-slate-800">
                {driveStatus?.enabled ? 'Enabled' : 'Disabled'}
              </span>
              {driveStatus?.auth_mode ? (
                <>
                  {' '}
                  · Mode: <span className="font-semibold text-slate-800">{driveStatus.auth_mode}</span>
                </>
              ) : null}
              {typeof driveStatus?.connected === 'boolean' ? (
                <>
                  {' '}
                  · Connected:{' '}
                  <span className="font-semibold text-slate-800">{driveStatus.connected ? 'Yes' : 'No'}</span>
                </>
              ) : null}
            </div>

            {driveStatus?.connected_by ? (
              <div className="text-xs text-slate-500">Connected by: {driveStatus.connected_by}</div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                className="bg-teal-600 hover:bg-teal-700"
                onClick={async () => {
                  const returnTo = typeof window !== 'undefined' ? window.location.href : undefined;
                  setDriveLoading(true);
                  try {
                    // Prefer JSON link endpoint (avoids shared-host redirect issues).
                    const link = await getDriveOAuthLink({ returnTo });
                    if (link?.success && link.auth_url) {
                      window.location.href = link.auth_url;
                      return;
                    }

                    // Fallback to the original redirect endpoint
                    window.location.href = getDriveOAuthStartUrl({ returnTo });
                  } finally {
                    setDriveLoading(false);
                  }
                }}
                disabled={driveLoading}
              >
                Connect / Reconnect Drive
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  setDriveLoading(true);
                  try {
                    await disconnectDrive();
                    const res = await getDriveStatus();
                    if (res && res.success) {
                      setDriveStatus({
                        enabled: res.enabled,
                        auth_mode: res.auth_mode,
                        connected: res.connected,
                        connected_by: res.connected_by ?? null,
                        updated_at: res.updated_at ?? null,
                      });
                    }
                  } finally {
                    setDriveLoading(false);
                  }
                }}
                disabled={driveLoading}
              >
                Disconnect
              </Button>
            </div>
            <div className="text-xs text-slate-500">
              Tip: use Service Account mode for the most HIPAA-friendly, non-interactive setup. OAuth mode is supported for
              “Connect Drive” workflows.
            </div>
          </CardContent>
        </Card>
      )} */}

      {/* <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-teal-600" />
            Form Sections
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {formSteps.map((step) => (
              <div
                key={step.id}
                className="p-4 border rounded-lg hover:bg-slate-50 cursor-pointer transition"
                onClick={() => onNavigate(step.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-teal-600">Step {step.number}</span>
                  <Badge variant="secondary">{step.number}</Badge>
                </div>
                <h3 className="font-semibold text-slate-800">{step.label}</h3>
              </div>
            ))}
          </div>
        </CardContent>
      </Card> */}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-teal-600" />
              {isAdminLike ? 'All Staff Entries' : isReader ? 'Staff Entries (Read-only)' : 'My Staff Entries'}
            </CardTitle>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {isReader && (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center w-full">
                  <Input
                    value={shareKey}
                    onChange={(e) => setShareKey(e.target.value)}
                    placeholder="Enter share key to load records…"
                    disabled={myStaffLoading}
                    className="w-full sm:w-72"
                  />
                  <Button
                    className="bg-teal-600 hover:bg-teal-700"
                    onClick={() => onRefreshMyStaff?.({ share_key: shareKey })}
                    disabled={myStaffLoading}
                  >
                    Search
                  </Button>
                </div>
              )}
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={isReader ? 'Filter results…' : 'Search name, email, or ID…'}
                  className="pl-9"
                  disabled={myStaffLoading}
                />
              </div>
              {onRefreshMyStaff && (
                <Button
                  variant="outline"
                  onClick={() => onRefreshMyStaff(isReader && shareKey ? { share_key: shareKey } : undefined)}
                  disabled={myStaffLoading}
                >
                  {myStaffLoading ? 'Refreshing…' : 'Refresh'}
                </Button>
              )}
              {canCreateNewEntry && (
                <Button
                  onClick={() => {
                    if (onCreateNew) {
                      onCreateNew();
                    } else {
                      onNavigate('personal');
                    }
                  }}
                  className="bg-teal-600 hover:bg-teal-700"
                >
                  New Entry
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {myStaffError ? (
            <div className="text-sm text-red-600">
              {myStaffError}
            </div>
          ) : myStaffLoading ? (
            <div className="text-sm text-slate-600">Loading your entries…</div>
          ) : myStaff.length === 0 ? (
            <div className="text-sm text-slate-600">
            {isReader
                ? 'Enter a share key above and click Search to load matching entries.'
                : 'No entries yet. Submit a packet to see it show up here.'}
            </div>
          ) : (
            <div className="overflow-x-auto overflow-y-visible">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Staff</TableHead>
                    <TableHead className="hidden md:table-cell">Email</TableHead>
                    {isAdminLike && (
                      <>
                        <TableHead className="hidden md:table-cell">Entered By</TableHead>
                        {/* <TableHead className="hidden md:table-cell">Created By Role</TableHead> */}
                      </>
                    )}
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStaff.map((s) => {
                    const isExpanded = expandedStaffId === s.staff_id;
                    const fullName = `${s.first_name} ${s.middle_name ? s.middle_name + ' ' : ''}${s.last_name}`;
                    return (
                      <Fragment key={s.staff_id}>
                        <TableRow>
                          <TableCell>
                            <div className="font-semibold text-slate-800">{fullName}</div>
                            <div className="text-xs text-slate-500">ID: {s.staff_id}</div>
                            <div className="text-sm text-slate-600 md:hidden truncate">{s.email}</div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">{s.email}</TableCell>
                          {isAdminLike && (
                            <>
                              <TableCell className="hidden md:table-cell">
                                {s.created_by_username || (s.created_by_user_id ? `User #${s.created_by_user_id}` : 'N/A')}
                              </TableCell>
                              {/* <TableCell className="hidden md:table-cell">
                                <Badge variant="outline">{formatRoleLabel(s.created_by_role)}</Badge>
                              </TableCell> */}
                            </>
                          )}
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent>
                                <DropdownMenuItem
                                  onClick={() => setExpandedStaffId(isExpanded ? null : s.staff_id)}
                                >
                                  {isExpanded ? 'Hide details' : 'View details'}
                                </DropdownMenuItem>
                                {!isReader && (
                                  <DropdownMenuItem onClick={() => onEditStaff?.(s)}>
                                    Edit entry
                                  </DropdownMenuItem>
                                )}
                                {!isReader && (
                                  <DropdownMenuItem
                                    onClick={async () => {
                                      setIsGeneratingShareKey(s.staff_id);
                                      const res = await createShareKey(s.staff_id);
                                      setIsGeneratingShareKey(null);
                                      if (res.success && res.share_key) {
                                        setShareKeyModal({
                                          isOpen: true,
                                          shareKey: res.share_key,
                                          expiresAt: res.expires_at,
                                        });
                                      } else {
                                        setShareKeyModal({
                                          isOpen: true,
                                          error: res.message || 'Failed to generate share key.',
                                        });
                                      }
                                    }}
                                  >
                                    {isGeneratingShareKey === s.staff_id ? 'Generating key…' : 'Generate share key'}
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow className="bg-slate-50">
                            <TableCell colSpan={detailsColSpan} className="px-6 py-6">
                              <div className="space-y-6">
                                {/* Personal Information */}
                                <Card className="border-slate-200">
                                  <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-base">
                                      <User className="h-4 w-4 text-teal-600" />
                                      Personal Information
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent className="space-y-3 text-sm">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                      <div>
                                        <p className="text-slate-500 mb-1">First Name</p>
                                        <p className="font-medium">{s.first_name || 'N/A'}</p>
                                      </div>
                                      <div>
                                        <p className="text-slate-500 mb-1">Middle Name</p>
                                        <p className="font-medium">{s.middle_name || 'N/A'}</p>
                                      </div>
                                      <div>
                                        <p className="text-slate-500 mb-1">Last Name</p>
                                        <p className="font-medium">{s.last_name || 'N/A'}</p>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                      <div>
                                        <p className="text-slate-500 mb-1">Date of Birth</p>
                                        <p className="font-medium">{s.date_of_birth || 'N/A'}</p>
                                      </div>
                                      <div>
                                        <p className="text-slate-500 mb-1">SSN Last 4</p>
                                        <p className="font-medium">{s.ssn_last_4_digits || 'N/A'}</p>
                                      </div>
                                      <div>
                                        <p className="text-slate-500 mb-1">Job Title</p>
                                        <p className="font-medium">{s.job_title || 'N/A'}</p>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                      <div>
                                        <p className="text-slate-500 mb-1">Status</p>
                                        <p className="font-medium">{s.employment_status || 'N/A'}</p>
                                      </div>
                                    </div>
                                    <div>
                                      <p className="text-slate-500 mb-1">Full Address</p>
                                      <p className="font-medium">{s.full_address || 'N/A'}</p>
                                    </div>
                                  </CardContent>
                                </Card>

                                {/* Contact Information */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                  <Card className="border-slate-200">
                                    <CardHeader className="pb-3">
                                      <CardTitle className="flex items-center gap-2 text-base">
                                        <Phone className="h-4 w-4 text-teal-600" />
                                        Contact Information
                                      </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3 text-sm">
                                      <div>
                                        <p className="text-slate-500 mb-1">Email</p>
                                        <p className="font-medium">{s.email || 'N/A'}</p>
                                      </div>
                                      <div>
                                        <p className="text-slate-500 mb-1">Cell Phone</p>
                                        <p className="font-medium">{s.cell_phone || 'N/A'}</p>
                                      </div>
                                      <div>
                                        <p className="text-slate-500 mb-1">Home Phone</p>
                                        <p className="font-medium">{s.home_phone || 'N/A'}</p>
                                      </div>
                                      <div>
                                        <p className="text-slate-500 mb-1">Work Phone</p>
                                        <p className="font-medium">{s.work_phone || 'N/A'}</p>
                                      </div>
                                    </CardContent>
                                  </Card>

                                  {/* Emergency Contact */}
                                  <Card className="border-slate-200">
                                    <CardHeader className="pb-3">
                                      <CardTitle className="flex items-center gap-2 text-base">
                                        <Heart className="h-4 w-4 text-teal-600" />
                                        Emergency Contact
                                      </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3 text-sm">
                                      <div>
                                        <p className="text-slate-500 mb-1">Contact Name</p>
                                        <p className="font-medium">{s.emergency_contact_name || 'N/A'}</p>
                                      </div>
                                      <div>
                                        <p className="text-slate-500 mb-1">Relationship</p>
                                        <p className="font-medium">{s.emergency_relationship || 'N/A'}</p>
                                      </div>
                                      <div>
                                        <p className="text-slate-500 mb-1">Primary Phone</p>
                                        <p className="font-medium">{s.emergency_primary_phone || 'N/A'}</p>
                                      </div>
                                      <div>
                                        <p className="text-slate-500 mb-1">Secondary Phone</p>
                                        <p className="font-medium">{s.emergency_secondary_phone || 'N/A'}</p>
                                      </div>
                                    </CardContent>
                                  </Card>
                                </div>

                                {/* Professional Data */}
                                <Card className="border-slate-200">
                                  <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-base">
                                      <GraduationCap className="h-4 w-4 text-teal-600" />
                                      Professional Data
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent className="space-y-3 text-sm">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                      <div>
                                        <p className="text-slate-500 mb-1">Highest Degree</p>
                                        <p className="font-medium">{s.highest_degree || 'N/A'}</p>
                                      </div>
                                      <div>
                                        <p className="text-slate-500 mb-1">Year Awarded</p>
                                        <p className="font-medium">{s.year_awarded || 'N/A'}</p>
                                      </div>
                                      <div>
                                        <p className="text-slate-500 mb-1">Major</p>
                                        <p className="font-medium">{s.major || 'N/A'}</p>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                      <div>
                                        <p className="text-slate-500 mb-1">License Status</p>
                                        <p className="font-medium">{s.license_status || 'N/A'}</p>
                                      </div>
                                      <div>
                                        <p className="text-slate-500 mb-1">License Exp Date</p>
                                        <p className="font-medium">{s.license_exp_date || 'N/A'}</p>
                                      </div>
                                      <div>
                                        <p className="text-slate-500 mb-1">NPI Number</p>
                                        <p className="font-medium">{s.npi_number || 'N/A'}</p>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                      <div>
                                        <p className="text-slate-500 mb-1">Languages</p>
                                        <p className="font-medium">{s.languages || 'N/A'}</p>
                                      </div>
                                      <div>
                                        <p className="text-slate-500 mb-1">Specialty Areas</p>
                                        <p className="font-medium">{s.specialty_areas || 'N/A'}</p>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>

                                {/* Certifications */}
                                {s.certifications && s.certifications.length > 0 && (
                                  <Card className="border-slate-200">
                                    <CardHeader className="pb-3">
                                      <CardTitle className="flex items-center gap-2 text-base">
                                        <Building2 className="h-4 w-4 text-teal-600" />
                                        Certifications
                                      </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                      <div className="space-y-3">
                                        {s.certifications.map((cert, idx) => (
                                          <div key={idx} className="border rounded-lg p-3 bg-slate-50">
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                                              <div>
                                                <p className="text-slate-500 mb-1">Certification Type</p>
                                                <p className="font-medium">{cert.cert_type || 'N/A'}</p>
                                              </div>
                                              <div>
                                                <p className="text-slate-500 mb-1">Cert Number</p>
                                                <p className="font-medium">{cert.cert_number || 'N/A'}</p>
                                              </div>
                                              <div>
                                                <p className="text-slate-500 mb-1">Expiration Date</p>
                                                <p className="font-medium">{cert.exp_date || 'N/A'}</p>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </CardContent>
                                  </Card>
                                )}

                                {/* Attachments */}
                                {(() => {
                                  const attachments = (s.attachments || []).filter((att) =>
                                    isReader ? att.attachment_type !== 'SIGNATURE' : true
                                  );
                                  if (attachments.length === 0) return null;
                                  return (
                                  <Card className="border-slate-200">
                                    <CardHeader className="pb-3">
                                      <CardTitle className="flex items-center gap-2 text-base">
                                        <File className="h-4 w-4 text-teal-600" />
                                        Attachments
                                      </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                      <div className="space-y-3">
                                        {attachments.map((att) => (
                                          <div key={att.attachment_id} className="border rounded-lg p-3 bg-slate-50">
                                            <div className="flex items-center justify-between">
                                              <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                  <Badge variant="secondary" className="text-xs">
                                                    {att.attachment_type}
                                                  </Badge>
                                                  <p className="font-medium text-sm">{att.original_filename}</p>
                                                </div>
                                                <div className="flex items-center gap-4 text-xs text-slate-500">
                                                  <span>{formatFileSize(att.size_bytes)}</span>
                                                  <span>
                                                    {new Date(att.created_at).toLocaleDateString('en-US', {
                                                      year: 'numeric',
                                                      month: 'short',
                                                      day: 'numeric',
                                                    })}
                                                  </span>
                                                </div>
                                              </div>
                                              <div className="flex items-center gap-2 ml-4">
                                                <Button
                                                  variant="outline"
                                                  size="sm"
                                                  onClick={() => {
                                                    setViewingAttachment({
                                                      attachmentId: att.attachment_id,
                                                      filename: att.original_filename,
                                                      mimeType: att.mime_type,
                                                    });
                                                  }}
                                                >
                                                  <Eye className="h-4 w-4 mr-2" />
                                                  View
                                                </Button>
                                                <Button
                                                  variant="outline"
                                                  size="sm"
                                                  onClick={() => {
                                                    const url = getAttachmentDownloadUrl(
                                                      att.attachment_id,
                                                      isReader && shareKey ? { share_key: shareKey } : undefined
                                                    );
                                                    window.open(url, '_blank');
                                                  }}
                                                >
                                                  <Download className="h-4 w-4 mr-2" />
                                                  Download
                                                </Button>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </CardContent>
                                  </Card>
                                  );
                                })()}

                                {/* Bank Information */}
                                {s.bank_name && (
                                  <Card className="border-slate-200">
                                    <CardHeader className="pb-3">
                                      <CardTitle className="flex items-center gap-2 text-base">
                                        <CreditCard className="h-4 w-4 text-teal-600" />
                                        Bank Information
                                      </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3 text-sm">
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                          <p className="text-slate-500 mb-1">Bank Name</p>
                                          <p className="font-medium">{s.bank_name || 'N/A'}</p>
                                        </div>
                                        <div>
                                          <p className="text-slate-500 mb-1">Account Name</p>
                                          <p className="font-medium">{s.account_name || 'N/A'}</p>
                                        </div>
                                        <div>
                                          <p className="text-slate-500 mb-1">Account Number</p>
                                          <p className="font-medium">{s.account_number ? '••••' + s.account_number.slice(-4) : 'N/A'}</p>
                                        </div>
                                        <div>
                                          <p className="text-slate-500 mb-1">Routing Number</p>
                                          <p className="font-medium">{s.routing_number ? '••••' + s.routing_number.slice(-4) : 'N/A'}</p>
                                        </div>
                                        <div>
                                          <p className="text-slate-500 mb-1">Account Type</p>
                                          <p className="font-medium">{s.account_type || 'N/A'}</p>
                                        </div>
                                        <div>
                                          <p className="text-slate-500 mb-1">Payroll Authorization</p>
                                          <Badge variant={s.authorization_agreed ? 'default' : 'secondary'}>
                                            {s.authorization_agreed ? 'Authorized' : 'Not Authorized'}
                                          </Badge>
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                )}

                                {/* Compliance */}
                                <Card className="border-slate-200">
                                  <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-base">
                                      <Shield className="h-4 w-4 text-teal-600" />
                                      Compliance Agreements
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent className="space-y-3 text-sm">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      <div>
                                        <p className="text-slate-500 mb-1">HIPAA Acknowledged</p>
                                        <div className="flex items-center gap-2">
                                          <Badge variant={s.hipaa_acknowledged ? 'default' : 'secondary'}>
                                            {s.hipaa_acknowledged ? 'Yes' : 'No'}
                                          </Badge>
                                          {s.hipaa_acknowledged_at && (
                                            <span className="text-xs text-slate-500">
                                              {new Date(s.hipaa_acknowledged_at).toLocaleDateString()}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <div>
                                        <p className="text-slate-500 mb-1">Abuse Reporting Acknowledged</p>
                                        <div className="flex items-center gap-2">
                                          <Badge variant={s.abuse_reporting_acknowledged ? 'default' : 'secondary'}>
                                            {s.abuse_reporting_acknowledged ? 'Yes' : 'No'}
                                          </Badge>
                                          {s.abuse_reporting_acknowledged_at && (
                                            <span className="text-xs text-slate-500">
                                              {new Date(s.abuse_reporting_acknowledged_at).toLocaleDateString()}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}

                  {filteredStaff.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={detailsColSpan} className="text-center text-slate-600 py-10">
                        No matches for your current filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* File Viewer Modal */}
      {viewingAttachment && (
        <FileViewerModal
          isOpen={!!viewingAttachment}
          attachmentId={viewingAttachment.attachmentId}
          filename={viewingAttachment.filename}
          mimeType={viewingAttachment.mimeType}
          shareKey={isReader ? shareKey : undefined}
          onClose={() => setViewingAttachment(null)}
        />
      )}
      <ShareKeyModal
        isOpen={shareKeyModal.isOpen}
        shareKey={shareKeyModal.shareKey}
        expiresAt={shareKeyModal.expiresAt}
        error={shareKeyModal.error}
        onClose={() => setShareKeyModal({ isOpen: false })}
      />
    </div>
  );
}

