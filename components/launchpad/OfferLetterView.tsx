'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Download, ExternalLink, FileText, FileSignature, CheckCircle2, Mail } from 'lucide-react';
import { acceptMyOffer, getAttachmentViewUrl, getMyOfferAcceptance, getMyOfferInitiation, initiateOffer, uploadMySignedOfferLetterPdf, sendReminder } from '@/lib/launchpad/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { StaffListItem } from '@/lib/launchpad/api';
import { toast } from '@/components/launchpad/ui/toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// Dynamically import SignaturePad with SSR disabled (uses canvas API)
const SignaturePad = dynamic(() => import('@/components/launchpad/SignaturePad'), {
  ssr: false,
  loading: () => (
    <div className="border-2 border-slate-300 rounded-lg bg-white" style={{ width: 600, height: 200 }}>
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-500">Loading signature pad...</p>
      </div>
    </div>
  ),
});

const JOB_DESCRIPTION_PATH = '/launchpad/docs/rbt-job-description.pdf';

export default function OfferLetterView(props: {
  staff?: { staffId?: number | null; fullName?: string | null; jobTitle?: string | null };
  staffList?: StaffListItem[];
  onRefreshStaffList?: () => void;
}) {
  const staffIdProp = props.staff?.staffId ?? null;
  const offerLetterRef = useRef<HTMLDivElement | null>(null); // inner printable page
  const [employeeName, setEmployeeName] = useState(props.staff?.fullName || '');
  const [jobTitle, setJobTitle] = useState(props.staff?.jobTitle || '');
  const [payRate, setPayRate] = useState('');
  const [offerInitiated, setOfferInitiated] = useState(false);
  const [initiationLoading, setInitiationLoading] = useState(true);
  const [initiationError, setInitiationError] = useState<string | null>(null);
  const [isInitiating, setIsInitiating] = useState(false);
  const [initUsername, setInitUsername] = useState('');
  const [initEmail, setInitEmail] = useState('');
  const [initEmployeeName, setInitEmployeeName] = useState('');
  const [initJobTitle, setInitJobTitle] = useState('');
  const [initPayRate, setInitPayRate] = useState('');
  const [initAccountCreated, setInitAccountCreated] = useState<boolean | null>(null);
  const [initCreateNewStaff, setInitCreateNewStaff] = useState(false);
  const [initFirstName, setInitFirstName] = useState('');
  const [initLastName, setInitLastName] = useState('');

  const [authRole, setAuthRole] = useState<string>('');
  const isAdminLike = authRole === 'admin' || authRole === 'hr';
  const isAdmin = authRole === 'admin';
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(staffIdProp);
  const effectiveStaffId = isAdminLike ? selectedStaffId : staffIdProp;
  const [showPreview, setShowPreview] = useState(false);
  const [isInitModalOpen, setIsInitModalOpen] = useState(false);

  const selectedStaff = useMemo(() => {
    if (!effectiveStaffId) return null;
    return (props.staffList || []).find((s) => s.staff_id === effectiveStaffId) || null;
  }, [effectiveStaffId, props.staffList]);
  const staffHasAccount = !!selectedStaff?.created_by_user_id;

  const [offerSignature, setOfferSignature] = useState<string>('');
  const [offerSignatureDate, setOfferSignatureDate] = useState<string>(() => new Date().toISOString().slice(0, 10)); // default today

  const [activeTab, setActiveTab] = useState<'offer' | 'job'>('offer');
  const [offerLoading, setOfferLoading] = useState(true);
  const [offerAccepted, setOfferAccepted] = useState(false);
  const [acceptedAt, setAcceptedAt] = useState<string | null>(null);
  const [acceptedSignatureAttachmentId, setAcceptedSignatureAttachmentId] = useState<number | null>(null);
  const [acceptedSignatureDataUrl, setAcceptedSignatureDataUrl] = useState<string | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [jdReadAck, setJdReadAck] = useState(false);
  const [sendingReminder, setSendingReminder] = useState<number | null>(null);

  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('auth_user') : null;
      const u = raw ? JSON.parse(raw) : null;
      const role = String(u?.role || '').toLowerCase();
      setAuthRole(role);
    } catch {
      setAuthRole('');
    }
  }, []);

  useEffect(() => {
    // Admin view: hide preview by default. Staff view: show preview.
    setShowPreview(!isAdminLike);
  }, [isAdminLike]);

  useEffect(() => {
    // Admin: when switching staff, immediately reset/prefill fields from the selected staff row
    // so we never show stale values from the previously-selected staff.
    if (!isAdminLike) return;
    if (!effectiveStaffId) return;
    const staff = (props.staffList || []).find((s) => s.staff_id === effectiveStaffId) || null;
    if (!staff) return;

    const full = `${staff.first_name || ''} ${staff.middle_name ? staff.middle_name + ' ' : ''}${staff.last_name || ''}`.trim();
    setEmployeeName(full);
    setJobTitle(staff.job_title || '');
    // Pay rate is not part of Staff list; reset until initiation/acceptance loads or admin fills it.
    setPayRate('');
  }, [isAdminLike, effectiveStaffId, props.staffList]);

  useEffect(() => {
    // Admin: initiation form should always start empty (placeholders only).
    if (!isAdminLike) return;
    if (!isInitModalOpen) return;
    setInitiationError(null);
    setInitAccountCreated(null);
    setInitCreateNewStaff(false);
    setInitFirstName('');
    setInitLastName('');
    setInitUsername('');
    setInitEmail('');
    setInitEmployeeName('');
    setInitJobTitle('');
    setInitPayRate('');
  }, [isAdminLike, isInitModalOpen]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setOfferLoading(true);
      try {
        const res = await getMyOfferAcceptance(isAdminLike && effectiveStaffId ? { staff_id: effectiveStaffId } : undefined);
        if (cancelled) return;
        if (res.success && res.accepted && res.offer) {
          setOfferAccepted(true);
          setEmployeeName(res.offer.employee_name);
          setJobTitle(res.offer.job_title);
          setPayRate(res.offer.pay_rate);
          setOfferSignatureDate(res.offer.accepted_date);
          setAcceptedAt(res.offer.accepted_at);
          setAcceptedSignatureAttachmentId(res.offer.signature_attachment_id);
          setAcceptedSignatureDataUrl(res.offer.signature_data_url || null);
        } else {
          setOfferAccepted(false);
          setAcceptedAt(null);
          setAcceptedSignatureAttachmentId(null);
          setAcceptedSignatureDataUrl(null);
          // keep defaults/prefill from staff profile
          setOfferSignatureDate(new Date().toISOString().slice(0, 10));
        }
      } finally {
        if (!cancelled) setOfferLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdminLike, effectiveStaffId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setInitiationLoading(true);
      setInitiationError(null);
      try {
        const res = await getMyOfferInitiation(isAdminLike && effectiveStaffId ? { staff_id: effectiveStaffId } : undefined);
        if (cancelled) return;
        if (res.success && res.initiated && res.offer) {
          setOfferInitiated(true);
          // Only prefill from initiation if not already accepted
          if (!offerAccepted) {
            setEmployeeName(res.offer.employee_name);
            setJobTitle(res.offer.job_title);
            setPayRate(res.offer.pay_rate);
          }
        } else {
          setOfferInitiated(false);
        }
      } catch (e: any) {
        setInitiationError(e?.message || 'Failed to load offer initiation.');
      } finally {
        if (!cancelled) setInitiationLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [offerAccepted, isAdminLike, effectiveStaffId]);

  const acceptedSignatureUrl = useMemo(() => {
    if (!acceptedSignatureAttachmentId) return '';
    return getAttachmentViewUrl(acceptedSignatureAttachmentId);
  }, [acceptedSignatureAttachmentId]);

  const canAccept =
    !offerAccepted &&
    offerInitiated &&
    employeeName.trim() &&
    jobTitle.trim() &&
    payRate.trim() &&
    jdReadAck &&
    offerSignature &&
    offerSignature.startsWith('data:image') &&
    offerSignatureDate;

  // acceptedSignatureDataUrl is provided by offer_acceptance_get.php (signature_data_url) when accepted.

  const sanitizeFilename = (name: string) =>
    name.replace(/[^\w\s.-]/g, '').trim().replace(/\s+/g, '_').slice(0, 80) || 'document';

  const blobToDataUrl = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('Failed to read file.'));
      reader.readAsDataURL(blob);
    });

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const ensureAcceptedSignatureDataUrl = async (): Promise<void> => {
    if (!offerAccepted) return;
    if (!acceptedSignatureAttachmentId) return;
    if (acceptedSignatureDataUrl) return;

    // Fallback: fetch the signature image and convert it into a data URL so html2canvas/jsPDF
    // can export without cross-origin canvas tainting.
    try {
      const url = getAttachmentViewUrl(acceptedSignatureAttachmentId);
      const resp = await fetch(url, { method: 'GET', credentials: 'include' });
      if (!resp.ok) return;
      const ct = resp.headers.get('content-type') || '';
      if (!ct.startsWith('image/')) return;
      const blob = await resp.blob();
      const dataUrl = await blobToDataUrl(blob);
      if (dataUrl.startsWith('data:image')) setAcceptedSignatureDataUrl(dataUrl);
    } catch {
      // non-fatal: we'll still attempt the download with the URL-based <img>
    }
  };

  const renderOfferLetterPdfBlob = async (): Promise<Blob> => {
    if (!offerLetterRef.current) throw new Error('Offer letter not ready yet.');

    // Wait for fonts to settle so the PDF matches the UI
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (document?.fonts?.ready) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      await document.fonts.ready;
    }

    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ]);

    const canvas = await html2canvas(offerLetterRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
    });

    const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'letter' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Single-page PDF: render the offer letter as one image on a Letter-sized page.
    // This avoids mobile responsive reflow producing multiple PDF pages.
    let imgData = '';
    try {
      imgData = canvas.toDataURL('image/png');
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (msg.toLowerCase().includes('tainted') || msg.toLowerCase().includes('security')) {
        throw new Error('Download blocked by browser security (signature/image could not be exported). Please refresh and try again.');
      }
      throw err;
    }

    const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
    const imgW = canvas.width * ratio;
    const imgH = canvas.height * ratio;
    const x = (pageWidth - imgW) / 2;
    const y = (pageHeight - imgH) / 2;
    pdf.addImage(imgData, 'PNG', x, y, imgW, imgH);

    const ab: ArrayBuffer = pdf.output('arraybuffer');
    return new Blob([ab], { type: 'application/pdf' });
  };

  const downloadActiveDoc = async () => {
    setIsDownloading(true);
    try {
      if (activeTab === 'job') {
        const resp = await fetch(JOB_DESCRIPTION_PATH);
        if (!resp.ok) throw new Error(`Failed to download PDF (HTTP ${resp.status})`);
        const blob = await resp.blob();
        downloadBlob(blob, 'Maha_RBT_Job_Description.pdf');
        return;
      }

      // Staff should only be able to download the offer letter after accepting.
      if (!isAdminLike && !offerAccepted) {
        throw new Error('Please accept the offer before downloading the offer letter.');
      }

      await ensureAcceptedSignatureDataUrl();

      const who = sanitizeFilename(employeeName || 'Employee');
      const status = offerAccepted ? 'SIGNED' : 'DRAFT';
      const pdfBlob = await renderOfferLetterPdfBlob();
      downloadBlob(pdfBlob, `Offer_Letter_${who}_${status}.pdf`);
    } catch (e: any) {
      alert(e?.message || 'Download failed.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleAccept = async () => {
    setAcceptError(null);
    if (!canAccept) {
      if (!offerInitiated) {
        setAcceptError('Offer has not been initiated yet. Please contact Admin/HR.');
      } else if (!jdReadAck) {
        setAcceptError('Please confirm you have read the Job Description completely.');
      } else {
        setAcceptError('Please save your signature + date.');
      }
      return;
    }
    setIsAccepting(true);
    try {
      const res = await acceptMyOffer({
        signature_data_url: offerSignature,
        accepted_date: offerSignatureDate,
      });
      if (!res.success) {
        setAcceptError(res.message || 'Failed to accept offer.');
        return;
      }

      // Best-effort: generate + store signed offer PDF in Drive
      setIsUploadingPdf(true);
      try {
        const who = sanitizeFilename(employeeName || 'Employee');
        const pdfBlob = await renderOfferLetterPdfBlob();
        const up = await uploadMySignedOfferLetterPdf(pdfBlob, `Offer_Letter_${who}_SIGNED.pdf`);
        if (!up.success) {
          setAcceptError(up.message || 'Offer accepted, but failed to store signed offer letter PDF.');
        }
      } catch (e: any) {
        setAcceptError(e?.message || 'Offer accepted, but failed to store signed offer letter PDF.');
      } finally {
        setIsUploadingPdf(false);
      }

      // reload accepted state
      const next = await getMyOfferAcceptance();
      if (next.success && next.accepted && next.offer) {
        setOfferAccepted(true);
        setAcceptedAt(next.offer.accepted_at);
        setAcceptedSignatureAttachmentId(next.offer.signature_attachment_id);
      }
    } finally {
      setIsAccepting(false);
    }
  };

  const handleInitiate = async () => {
    if (!isAdminLike) return;
    setAcceptError(null);
    setInitiationError(null);
    setInitAccountCreated(null);
    if (initCreateNewStaff) {
      if (!initFirstName.trim() || !initLastName.trim()) {
        setInitiationError('First name and last name are required to create a new staff entry.');
        return;
      }
    }

    const computedEmployeeName = initCreateNewStaff
      ? `${initFirstName.trim()} ${initLastName.trim()}`.trim()
      : initEmployeeName.trim();

    if (!computedEmployeeName || !initJobTitle.trim() || !initPayRate.trim()) {
      setInitiationError('Employee name, job title, and pay rate are required.');
      return;
    }
    if (!initEmail.trim()) {
      setInitiationError('Email is required to send the offer link and create the account (if needed).');
      return;
    }
    if (!staffHasAccount && !initUsername.trim()) {
      setInitiationError('Username is required to create the account.');
      return;
    }
    if (!initCreateNewStaff && !effectiveStaffId) {
      setInitiationError('Please select a staff record, or enable “Create new staff”.');
      return;
    }
    setIsInitiating(true);
    try {
      const res = await initiateOffer({
        ...(initCreateNewStaff ? {} : { staff_id: effectiveStaffId as number }),
        employee_name: computedEmployeeName,
        ...(initCreateNewStaff ? { first_name: initFirstName.trim(), last_name: initLastName.trim() } : {}),
        job_title: initJobTitle.trim(),
        pay_rate: initPayRate.trim(),
        ...(staffHasAccount ? {} : { username: initUsername.trim() }),
        email: initEmail.trim(),
        send_email: true, // always email on initiation
      });
      if (!res.success) {
        setInitiationError(res.message || 'Failed to initiate offer.');
        toast({ title: 'Offer initiation failed', description: res.message || 'Please try again.', variant: 'error' });
        return;
      }
      setOfferInitiated(true);
      setInitAccountCreated(!!res.user_created);
      toast({
        title: 'Offer initiated',
        description: `${res.staff_created ? 'Staff created' : 'Staff selected'}. ${res.user_created ? 'Account created' : 'Account already exists'}. Email notification has been sent. You will be notified once the staff accepts.`,
        variant: 'success',
      });
      setIsInitModalOpen(false);
      props.onRefreshStaffList?.();
      if (res.staff_id) setSelectedStaffId(res.staff_id);
    } finally {
      setIsInitiating(false);
    }
  };

  const staffLabel = (s: StaffListItem) => {
    const name = `${s.first_name || ''} ${s.middle_name ? s.middle_name + ' ' : ''}${s.last_name || ''}`.trim() || 'Staff';
    return `${name} (ID: ${s.staff_id})`;
  };

  return (
    <div className="space-y-6">
      <header className="mb-6">
        <h2 className="text-3xl font-bold text-slate-800">Offer Letter</h2>
        <p className="text-slate-500 mt-2">
          {isAdminLike
            ? 'Initiate offer letters for staff, preview documents, and track acceptance status.'
            : 'Review the offer letter and job description here, then sign digitally to accept.'}
        </p>
        {/* {offerLoading ? (
          <div className="mt-3 text-sm text-slate-600">Loading offer status…</div>
        ) : offerAccepted ? (
          <div className="mt-3 flex items-center gap-2">
            <Badge className="bg-emerald-600 hover:bg-emerald-600">Accepted</Badge>
            <span className="text-sm text-slate-600">{acceptedAt ? `Accepted at ${acceptedAt}` : ''}</span>
          </div>
        ) : (
          <div className="mt-3 text-sm text-slate-600">
            Not accepted yet.
            {initiationLoading ? (
              <span className="ml-2 text-slate-500">(Checking if Admin initiated the offer…)</span>
            ) : offerInitiated ? (
              <span className="ml-2 text-emerald-700">(Offer initiated)</span>
            ) : (
              <span className="ml-2 text-amber-700">(Not initiated yet)</span>
            )}
          </div>
        )} */}
      </header>

      {isAdminLike && (
        <Card className="border-slate-200">
          <div className="flex justify-between gap-3 p-6 border-b border-slate-200">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-teal-600" />
                Staff Offer Status
              </CardTitle>
              <div className="text-sm text-slate-500 mt-1">Select a staff member to preview or initiate an offer.</div>
            </div>
            <div className="flex items-center gap-2">
             
              <Button
                type="button"
                className="bg-teal-600 hover:bg-teal-700"
                onClick={() => setIsInitModalOpen(true)}
                disabled={isInitiating}
              >
                Initiate Offer
              </Button>
            </div>
          </div>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Offer Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(props.staffList || []).map((s) => {
                  const initiated = !!s.offer_initiated_at;
                  const accepted = !!s.offer_accepted_at;
                  const isThisPreviewing = showPreview && effectiveStaffId === s.staff_id;
                  return (
                    <TableRow
                      key={s.staff_id}
                      className={effectiveStaffId === s.staff_id ? 'bg-slate-50' : ''}
                      onClick={() => setSelectedStaffId(s.staff_id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <TableCell className="font-medium">{staffLabel(s)}</TableCell>
                      <TableCell className="text-slate-700">{s.email || '—'}</TableCell>
                      <TableCell>
                        {s.created_by_user_id ? (
                          <span className="text-slate-800">Yes{s.created_by_username ? ` (${s.created_by_username})` : ''}</span>
                        ) : (
                          <span className="text-amber-700">No</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {accepted ? (
                          <Badge className="bg-emerald-600 hover:bg-emerald-600">Accepted</Badge>
                        ) : initiated ? (
                          <Badge className="bg-teal-600 hover:bg-teal-600">Initiated</Badge>
                        ) : (
                          <Badge variant="outline">Not initiated</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isAdmin && !accepted && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={async (e) => {
                                e.stopPropagation();
                                setSendingReminder(s.staff_id);
                                const res = await sendReminder(s.staff_id);
                                setSendingReminder(null);
                                if (res.success) {
                                  toast({
                                    title: 'Reminder sent',
                                    description: 'Reminder email has been sent successfully.',
                                    variant: 'success',
                                  });
                                } else {
                                  toast({
                                    title: 'Failed to send reminder',
                                    description: res.message || 'Please try again.',
                                    variant: 'error',
                                  });
                                }
                              }}
                              disabled={sendingReminder === s.staff_id}
                            >
                              <Mail className="h-4 w-4 mr-1" />
                              {sendingReminder === s.staff_id ? 'Sending…' : 'Reminder'}
                            </Button>
                          )}
                          {!initiated && !accepted ? (
                            <Button
                              type="button"
                              size="sm"
                              className="bg-teal-600 hover:bg-teal-700"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedStaffId(s.staff_id);
                                setIsInitModalOpen(true);
                              }}
                            >
                              Initiate
                            </Button>
                          ) : (
                            isThisPreviewing ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowPreview(false);
                                }}
                              >
                                Close
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedStaffId(s.staff_id);
                                  setShowPreview(true);
                                }}
                              >
                                Preview
                              </Button>
                            )
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {(props.staffList || []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-sm text-slate-600">
                      No staff records found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {isInitModalOpen && isAdminLike && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 bg-black bg-opacity-50 z-50 transition-opacity duration-300"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsInitModalOpen(false);
          }}
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 transform transition-all duration-300">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <div className="text-xl font-bold text-slate-800">Initiate Offer</div>
                <div className="text-sm text-slate-500">Create account (if needed), store offer details, and email the staff.</div>
              </div>
              <Button type="button" variant="outline" onClick={() => setIsInitModalOpen(false)}>
                Close
              </Button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  id="initCreateNewStaff"
                  type="checkbox"
                  className="h-4 w-4"
                  checked={initCreateNewStaff}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setInitCreateNewStaff(next);
                    setInitiationError(null);
                    setInitAccountCreated(null);
                    // Always keep the form empty (placeholders only)
                    setInitFirstName('');
                    setInitLastName('');
                    setInitUsername('');
                    setInitEmail('');
                    setInitEmployeeName('');
                    setInitJobTitle('');
                    setInitPayRate('');
                    if (next) {
                      // clear selection to avoid confusion
                      setSelectedStaffId(null);
                    }
                  }}
                />
                <Label htmlFor="initCreateNewStaff">Create new staff</Label>
              </div>

              {Array.isArray(props.staffList) && props.staffList.length > 0 && (
                <div className="space-y-2">
                  <Label>Staff (Name + ID)</Label>
                  <Select
                    value={selectedStaffId ? String(selectedStaffId) : ''}
                    onValueChange={(v) => {
                      setSelectedStaffId(v ? Number(v) : null);
                      // Always keep the form empty (placeholders only)
                      setInitiationError(null);
                      setInitAccountCreated(null);
                      setInitFirstName('');
                      setInitLastName('');
                      setInitUsername('');
                      setInitEmail('');
                      setInitEmployeeName('');
                      setInitJobTitle('');
                      setInitPayRate('');
                    }}
                  >
                    <SelectTrigger disabled={initCreateNewStaff}>
                      <SelectValue placeholder="Select staff..." />
                    </SelectTrigger>
                    <SelectContent>
                      {props.staffList.map((s) => (
                        <SelectItem key={s.staff_id} value={String(s.staff_id)}>
                          {staffLabel(s)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="initUsername">Username</Label>
                  <Input
                    id="initUsername"
                    value={initUsername}
                    onChange={(e) => setInitUsername(e.target.value)}
                    placeholder="e.g. jdoe"
                    autoComplete="off"
                    disabled={staffHasAccount}
                  />
                  {staffHasAccount && (
                    <div className="text-xs text-slate-600">
                      Account already exists{selectedStaff?.created_by_username ? ` (${selectedStaff.created_by_username})` : ''}.
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="initEmail">Email</Label>
                  <Input
                    id="initEmail"
                    type="email"
                    value={initEmail}
                    onChange={(e) => setInitEmail(e.target.value)}
                    placeholder="name@company.com"
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {initCreateNewStaff ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="initFirstName">First Name</Label>
                      <Input
                        id="initFirstName"
                        value={initFirstName}
                        onChange={(e) => {
                          const v = e.target.value;
                          setInitFirstName(v);
                        }}
                        placeholder="First name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="initLastName">Last Name</Label>
                      <Input
                        id="initLastName"
                        value={initLastName}
                        onChange={(e) => {
                          const v = e.target.value;
                          setInitLastName(v);
                        }}
                        placeholder="Last name"
                      />
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="employeeName">Employee Name</Label>
                    <Input
                      id="employeeName"
                      value={initEmployeeName}
                      onChange={(e) => setInitEmployeeName(e.target.value)}
                      placeholder="Full name"
                      autoComplete="off"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="jobTitle">Job Title</Label>
                  <Input
                    id="jobTitle"
                    value={initJobTitle}
                    onChange={(e) => setInitJobTitle(e.target.value)}
                    placeholder="Job title"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payRate">Pay Rate</Label>
                  <Input
                    id="payRate"
                    value={initPayRate}
                    onChange={(e) => setInitPayRate(e.target.value)}
                    placeholder="e.g. $25/hr"
                    autoComplete="off"
                  />
                </div>
              </div>

              {initiationError && <div className="text-sm text-red-600">{initiationError}</div>}

              <div className="pt-2 flex items-center justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsInitModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="bg-teal-600 hover:bg-teal-700"
                  onClick={handleInitiate}
                  disabled={isInitiating || offerInitiated}
                >
                  {isInitiating ? 'Initiating…' : offerInitiated ? 'Already Initiated' : 'Initiate & Send Email'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {(!isAdminLike || showPreview) && (
      <div className={isAdminLike ? 'grid grid-cols-1 gap-6' : 'grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6'}>
        {!isAdminLike && (
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSignature className="h-5 w-5 text-teal-600" />
                Signature & Acceptance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {offerAccepted && acceptedSignatureUrl ? (
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-slate-800">Accepted Signature</div>
                  <img
                    src={acceptedSignatureUrl}
                    alt="Accepted offer signature"
                    crossOrigin="anonymous"
                    className="border border-slate-200 rounded bg-white max-w-full"
                  />
                </div>
              ) : offerInitiated ? (
                <SignaturePad
                  onSave={(dataURL) => setOfferSignature(dataURL)}
                  onClear={() => setOfferSignature('')}
                  existingSignature={offerSignature || null}
                  width={600}
                  height={200}
                />
              ) : (
                <div className="text-sm text-slate-600">Waiting for Admin/HR to initiate the offer…</div>
              )}

              {!offerAccepted && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="offerSignatureDate">Date</Label>
                    <Input
                      id="offerSignatureDate"
                      type="date"
                      value={offerSignatureDate}
                      onChange={(e) => setOfferSignatureDate(e.target.value)}
                      disabled={offerAccepted}
                    />
                  </div>

                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="jdReadAck"
                      checked={jdReadAck}
                      onChange={(e) => setJdReadAck((e.target as HTMLInputElement).checked)}
                      disabled={!offerInitiated}
                    />
                    <div className="space-y-1">
                      <Label htmlFor="jdReadAck" className="text-sm">
                        I have read the Job Description completely.
                      </Label>
                      <div className="text-xs text-slate-500">
                        Please open and review the “Job Description” tab before accepting.
                      </div>
                      <div>
                        <Button type="button" variant="outline" size="sm" onClick={() => setActiveTab('job')}>
                          Open Job Description Tab
                        </Button>
                      </div>
                    </div>
                  </div>

                  {acceptError && <div className="text-sm text-red-600">{acceptError}</div>}
                  <Button
                    type="button"
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    onClick={handleAccept}
                    disabled={isAccepting || !offerInitiated}
                  >
                    {isAccepting ? 'Accepting…' : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Accept Offer
                      </>
                    )}
                  </Button>
                  <div className="text-xs text-slate-500">
                    Once accepted, this offer will be locked and an email will be sent to Admin/HR.
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-teal-600" />
              Document Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
              <div className="flex gap-2 mb-4">
                <Button
                  type="button"
                  variant={activeTab === 'offer' ? 'default' : 'outline'}
                  className={activeTab === 'offer' ? 'bg-teal-600 hover:bg-teal-700' : ''}
                  onClick={() => setActiveTab('offer')}
                >
                  Offer Letter
                </Button>
                <Button
                  type="button"
                  variant={activeTab === 'job' ? 'default' : 'outline'}
                  className={activeTab === 'job' ? 'bg-teal-600 hover:bg-teal-700' : ''}
                  onClick={() => setActiveTab('job')}
                >
                  Job Description
                </Button>
                <div className="flex-1" />
                <Button
                  type="button"
                  variant="outline"
                  onClick={downloadActiveDoc}
                  disabled={isDownloading || (activeTab === 'offer' && !offerAccepted && !isAdminLike)}
                  title={!isAdminLike && activeTab === 'offer' && !offerAccepted ? 'Accept the offer to enable download' : undefined}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {activeTab === 'offer'
                    ? offerAccepted
                      ? 'Download Signed Offer'
                      : isAdminLike ? 'Download Draft Offer' : 'Download Signed Offer'
                    : 'Download Job Description'}
                </Button>
                {activeTab === 'job' && (
                  <Button type="button" variant="outline" onClick={() => window.open(JOB_DESCRIPTION_PATH, '_blank')}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open PDF
                  </Button>
                )}
              </div>

              <TabsContent value="offer" className="mt-0">
                <div className="rounded-lg border border-slate-200 bg-white p-5">
                  {/* Letter-size page container so UI preview === downloaded PDF */}
                  <div className="flex justify-center bg-slate-50 p-4 rounded-lg">
                    <div
                      ref={offerLetterRef}
                      className="bg-white shadow-sm border border-slate-200"
                      style={{
                        // US Letter @ 96dpi
                        width: 816,
                        minHeight: 1056,
                        padding: 72, // 0.75in margins
                      }}
                    >
                    <div className="text-center mb-8">
                      <div className="flex items-center justify-center gap-3">
                        <img
                          src="/favicon.ico"
                          alt="Maha logo"
                          className="h-12 w-12 rounded-full bg-white border border-slate-200"
                        />
                        <div>
                          <div className="text-2xl font-bold text-slate-900">Maha Behavioral Health Services</div>
                          <div className="text-sm text-slate-600">Engage, Empower, Excel</div>
                        </div>
                      </div>
                      {/* Subject removed per requirement */}
                    </div>

                    <div className="text-sm text-slate-800 leading-7 space-y-5">
                      <div className="pt-2 font-semibold">
                        Dear {employeeName?.trim() ? employeeName.trim().split(' ')[0] : 'First Name'},
                      </div>

                      <p className="text-start">
                        We are pleased to formally offer you the position of <strong>&quot;{jobTitle?.trim() ? jobTitle.trim() : 'Job Title'}&quot;</strong> on a part-time basis at{' '}
                        <strong>&quot;Maha Behavioral Health Services&quot;</strong>.
                      </p>

                      <p className="text-start">
                        The starting compensation for this role is <strong>{payRate?.trim() ? payRate.trim() : '[Amount] per [Hour/Year]'}</strong>, with payments processed on a biweekly
                        basis. Please note that this offer is contingent upon the successful completion of a background check.
                      </p>

                      <p className="text-start">
                        We believe your skills and experience will be a valuable asset to our team, and we look forward to your contributions.
                      </p>

                      <p className="text-start">
                        Should you have any questions or require further clarification, please contact me at{' '}
                        <a className="text-blue-600 underline" href="mailto:info@mahabehavioralhealth.com">
                          info@mahabehavioralhealth.com
                        </a>.
                      </p>

                      <div className="pt-2">
                        <div>Thank you,</div>
                        <div className="mt-4 font-semibold text-red-600">Harini Chandramouli, MS, BCBA (She/her)</div>
                        <div className="text-slate-700">Founder and Clinical Director</div>
                      </div>

                      {/* Acceptance block (kept for legal acceptance in-app) */}
                      <div className="pt-8 border-t border-slate-200">
                        <div className="font-semibold text-slate-900 mb-2">Acceptance</div>
                        <div className="text-slate-600 mb-4">
                          Please sign below to indicate your acceptance. Date defaults to today.
                        </div>
                        {/* Force a fixed 2-column layout so the downloaded PDF is single-page even on mobile viewports */}
                        <div className="grid grid-cols-2 gap-10">
                          <div>
                            <div className="h-16 border-b border-slate-400 flex items-end">
                              {offerAccepted && (acceptedSignatureDataUrl || acceptedSignatureUrl) ? (
                                <img
                                  src={acceptedSignatureDataUrl || acceptedSignatureUrl}
                                  alt="Signature"
                                  crossOrigin="anonymous"
                                  className="h-14 object-contain pb-1"
                                />
                              ) : offerSignature ? (
                                <img src={offerSignature} alt="Signature" className="h-14 object-contain pb-1" />
                              ) : null}
                            </div>
                            <div className="text-xs text-slate-500 mt-2">Employee Signature</div>
                          </div>
                          <div>
                            <div className="h-16 border-b border-slate-400 flex items-end">
                              <div className="text-sm text-slate-800 pb-2">{offerSignatureDate || '—'}</div>
                            </div>
                            <div className="text-xs text-slate-500 mt-2">Date</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="job" className="mt-0">
                <div className="rounded-lg border border-slate-200 bg-white p-5">
                  <div className="max-w-3xl mx-auto">
                    <div className="text-start mb-8">
                      <div className="flex items-center justify-center gap-3">
                        <img src="/favicon.ico" alt="Maha logo" className="h-10 w-10 rounded-full bg-white border border-slate-200" />
                        <div>
                          <div className="text-xl font-bold text-slate-900">Maha Behavioral Health Services</div>
                          <div className="text-xs text-slate-600">Engage, Empower, Excel</div>
                        </div>
                      </div>

                      <div className="mt-6 font-bold text-slate-900">
                        Registered Behavior Technician Requirements and Job Description
                      </div>
                    </div>

                    <div className="text-sm text-slate-800 leading-6 space-y-4">
                      <p>
                        Registered Behavior Technicians considered for employment by <strong>MAHA BEHAVIORAL HEALTH SERVICES</strong> will meet the following requirements:
                      </p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Must have a high school diploma at a minimum, bachelor’s degree preferred with coursework in behavior analysis or other related field.</li>
                        <li>Complete 40 hour Registered Behavior Technician.</li>
                        <li>Maintain recertification of RBT training annually.</li>
                        <li>Complete all necessary Medicaid Waiver training and documents.</li>
                      </ul>

                      <div className="pt-2 font-semibold">Job Responsibilities and Expectations:</div>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Receive training on Behavior Analysis Service Plans (BASPs) for each consumer on their case load.</li>
                        <li>Implement BASPs as written.</li>
                        <li>Provide services to consumers based on hours set by the Behavior Analyst.</li>
                        <li>Collect data on a daily basis and provide it to the Behavior Analyst on a weekly basis.</li>
                        <li>Communicate regularly with the Behavior Analyst.</li>
                        <li>Train caregivers to implement the BASPs.</li>
                        <li>Implement the BASP in all relevant settings.</li>
                        <li>Attend meetings regarding consumer’s behavior services as necessary.</li>
                      </ul>

                      <div className="pt-10 grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div>
                          <div className="h-10 border-b border-slate-400" />
                          <div className="text-xs text-slate-600 mt-2">Registered Behavior Technician Signature</div>
                        </div>
                        <div>
                          <div className="h-10 border-b border-slate-400" />
                          <div className="text-xs text-slate-600 mt-2">Date</div>
                        </div>

                        <div>
                          <div className="h-10 border-b border-slate-400" />
                          <div className="text-xs text-slate-600 mt-2">Supervisor Signature</div>
                        </div>
                        <div>
                          <div className="h-10 border-b border-slate-400" />
                          <div className="text-xs text-slate-600 mt-2">Date</div>
                        </div>
                      </div>

                      <div className="pt-6 text-xs text-slate-500">
                        Need the original PDF? Use the “PDF” download button above.
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
      )}

      {isUploadingPdf && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 bg-black bg-opacity-50 z-50 transition-opacity duration-300"
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 transform transition-all duration-300">
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
              <div className="text-center">
                <div className="text-lg font-semibold text-slate-800 mb-2">Uploading Offer Letter</div>
                <div className="text-sm text-slate-600">
                  Please wait while we upload your signed offer letter to Google Drive. Do not close this window.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


