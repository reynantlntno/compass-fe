"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Check,
  CircleStop,
  FileText,
  HeartHandshake,
  Info,
  LockKeyhole,
  RefreshCw,
  Save,
  Video,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { DailyCall } from "@daily-co/daily-js";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { usePortalAccess } from "@/components/portal/portal-access-provider";
import { PortalCollectionFrame } from "@/components/portal/portal-collection-frame";
import { PortalPageHeader } from "@/components/portal/portal-page-header";
import { PORTAL_CAPABILITIES } from "@/components/portal/portal-navigation";
import {
  cancelPortalCounselingSession,
  completePortalCounselingSession,
  CounselingApiError,
  finalizePortalCounselingSession,
  lockPortalCounselingSession,
  noShowPortalCounselingSession,
  savePortalCounselingNote,
  startPortalCounselingSession,
} from "@/lib/api/counseling";
import {
  getPortalCounselorNote,
  getPortalCounselingSessionWorkspace,
  getPortalRecordingStatus,
  joinPortalEcounseling,
  startPortalRecording,
  stopPortalRecording,
  type PortalCounselingNote,
  type PortalCounselingSessionWorkspace,
  type PortalRecordingStatus,
} from "@/lib/api/counseling-session-workspace";
import { createIdempotencyKey, type IdempotencyKey } from "@/lib/api/idempotency";
import {
  getPortalRoutineInterviewDetail,
  getPortalRoutineInterviewSensitiveDetail,
  type PortalRoutineInterviewDetail,
  type PortalRoutineInterviewSensitiveDetail,
} from "@/lib/api/routine-interviews";

type Panel = "student" | "pre-intake" | "notes" | "summary" | "recording";
type WorkspaceLoadState =
  | { kind: "loading" }
  | { kind: "ready"; context: PortalCounselingSessionWorkspace }
  | { kind: "error" };
type NoteState = { kind: "idle" | "loading" | "error" } | { kind: "ready"; note: PortalCounselingNote };
type RoutineState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; detail: PortalRoutineInterviewDetail; sensitive: PortalRoutineInterviewSensitiveDetail | null };
type RecordingState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; status: PortalRecordingStatus };
type VideoState = "idle" | "joining" | "joined" | "error";
type SessionAction = "start" | "save" | "complete" | "cancel" | "no-show" | "finalize" | "lock";
type MutationState = { kind: "pending" | "success" | "error"; message: string };

const PANELS: readonly { value: Panel; label: string }[] = [
  { value: "student", label: "Student information" },
  { value: "pre-intake", label: "Pre-intake" },
  { value: "notes", label: "Evaluation and notes" },
  { value: "summary", label: "Shared summary" },
  { value: "recording", label: "Recording" },
];

const EMPTY_NOTE: PortalCounselingNote = {
  student_visible_summary: "",
  counselor_narrative: "",
  recommendations: "",
  special_concerns: "",
  follow_up_needed: false,
  follow_up_notes: "",
};

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function labelForValue(value: string | null | undefined) {
  if (!value) return "Not available";
  return value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatSchedule(context: PortalCounselingSessionWorkspace) {
  if (!context.scheduled_start_at) return "Schedule not set";
  const start = formatTimestamp(context.scheduled_start_at);
  return context.scheduled_end_at ? `${start} – ${formatTimestamp(context.scheduled_end_at)}` : start;
}

function detailId(referenceCode: string) {
  return `portal-counseling-session-${referenceCode.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function actionLabel(action: SessionAction) {
  switch (action) {
    case "start": return "Start session";
    case "save": return "Save notes";
    case "complete": return "Complete session";
    case "cancel": return "Cancel session";
    case "no-show": return "Mark no-show";
    case "finalize": return "Finalize session";
    default: return "Lock session";
  }
}

function mutationMessage(error: CounselingApiError) {
  switch (error.kind) {
    case "conflict": return "This session changed. Refresh the workspace and try again.";
    case "permission": return "This action is not available for this account.";
    case "validation": return "Check the session details and try again.";
    case "rate_limited": return "Too many attempts. Please wait before trying again.";
    default: return "This session action is temporarily unavailable. Try again.";
  }
}

function FactList({ facts }: { facts: readonly [string, ReactNode][] }) {
  return <dl className="portal-session-workspace__facts">{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}

function StateMessage({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="portal-session-workspace__state" role="status"><p>{message}</p>{onRetry ? <Button onClick={onRetry} size="sm" type="button" variant="outline"><RefreshCw aria-hidden="true" />Try again</Button> : null}</div>;
}

function RoutinePanel({ state, onLoad, onLoadSensitive }: { state: RoutineState; onLoad: () => void; onLoadSensitive: () => void }) {
  if (state.kind === "idle") return <StateMessage message="Pre-intake is loaded only when requested." onRetry={onLoad} />;
  if (state.kind === "loading") return <div className="portal-session-workspace__state" role="status"><Skeleton as="span" /><Skeleton as="span" /></div>;
  if (state.kind === "error") return <StateMessage message="Pre-intake details are unavailable right now." onRetry={onLoad} />;
  const detail = state.detail;
  const sensitive = state.sensitive;
  return <div className="portal-session-workspace__panel-body">
    <p className="portal-session-workspace__eyebrow">Read-only for counselor staff</p>
    <FactList facts={[
      ["Status", <Badge key="status" variant="outline">{labelForValue(detail.status)}</Badge>],
      ["Interview date", detail.visit_date ?? "Not set"],
      ["Interview time", detail.visit_time ?? "Not set"],
      ["Last submitted", formatTimestamp(detail.submitted_at)],
    ]} />
    {sensitive ? <div className="portal-session-workspace__sensitive-copy">
      <h3>Intake and evaluation details</h3>
      <FactList facts={[
        ["Reason for coming", sensitive.reason_for_coming || "Not provided"],
        ["Coping challenges", sensitive.coping_challenges || "Not provided"],
        ["Evaluation date", sensitive.evaluation_date ?? "Not set"],
        ["Special concern", sensitive.special_concern || "Not provided"],
        ["Recommendations", sensitive.recommendations || "Not provided"],
      ]} />
    </div> : <Button onClick={onLoadSensitive} size="sm" type="button" variant="outline"><FileText aria-hidden="true" />View intake and evaluation details</Button>}
  </div>;
}

function NotesPanel({ mode, state, note, canEdit, onChange, onLoad, onSave }: { mode: "notes" | "summary"; state: NoteState; note: PortalCounselingNote; canEdit: boolean; onChange: (patch: Partial<PortalCounselingNote>) => void; onLoad: () => void; onSave: () => void }) {
  if (state.kind === "idle") return <StateMessage message="Private session content is loaded only when requested." onRetry={onLoad} />;
  if (state.kind === "loading") return <div className="portal-session-workspace__state" role="status"><Skeleton as="span" /><Skeleton as="span" /><Skeleton as="span" /></div>;
  if (state.kind === "error") return <StateMessage message="Private session content is unavailable for this account right now." onRetry={onLoad} />;
  if (mode === "summary") {
    return <div className="portal-session-workspace__panel-body">
      <p className="portal-session-workspace__eyebrow">Student-visible content</p>
      <div className="portal-session-workspace__field"><Label htmlFor="portal-session-shared-summary">Shared summary</Label><Textarea disabled={!canEdit} id="portal-session-shared-summary" maxLength={2_000} onChange={(event) => onChange({ student_visible_summary: event.target.value })} value={note.student_visible_summary} /></div>
      <p className="portal-session-workspace__help">This summary is separate from private counselor notes and is saved explicitly.</p>
      {canEdit ? <Button onClick={onSave} size="sm" type="button"><Save aria-hidden="true" />Save shared summary</Button> : <p className="portal-session-workspace__help">This session is read-only for this account.</p>}
    </div>;
  }
  return <div className="portal-session-workspace__panel-body">
    <p className="portal-session-workspace__eyebrow">Private counselor content</p>
    <div className="portal-session-workspace__field"><Label htmlFor="portal-session-narrative">Counselor notes</Label><Textarea disabled={!canEdit} id="portal-session-narrative" maxLength={4_000} onChange={(event) => onChange({ counselor_narrative: event.target.value })} value={note.counselor_narrative} /></div>
    <div className="portal-session-workspace__field"><Label htmlFor="portal-session-recommendations">Recommendations</Label><Textarea disabled={!canEdit} id="portal-session-recommendations" maxLength={2_000} onChange={(event) => onChange({ recommendations: event.target.value })} value={note.recommendations} /></div>
    <div className="portal-session-workspace__field"><Label htmlFor="portal-session-special-concerns">Special concerns</Label><Textarea disabled={!canEdit} id="portal-session-special-concerns" maxLength={2_000} onChange={(event) => onChange({ special_concerns: event.target.value })} value={note.special_concerns} /></div>
    <div className="portal-session-workspace__field"><Label htmlFor="portal-session-follow-up">Follow-up notes</Label><Textarea disabled={!canEdit} id="portal-session-follow-up" maxLength={2_000} onChange={(event) => onChange({ follow_up_notes: event.target.value })} value={note.follow_up_notes} /></div>
    {canEdit ? <Button onClick={onSave} size="sm" type="button"><Save aria-hidden="true" />Save private notes</Button> : <p className="portal-session-workspace__help">This session is read-only for this account.</p>}
  </div>;
}

function RecordingPanel({ context, state, onLoad, onStart, onStop }: { context: PortalCounselingSessionWorkspace; state: RecordingState; onLoad: () => void; onStart: () => void; onStop: (runId: string) => void }) {
  if (!context.ecounseling_reference_code) return <StateMessage message="Recording is available only for an authorized online session." />;
  if (state.kind === "idle") return <StateMessage message="Recording status is loaded only when requested." onRetry={onLoad} />;
  if (state.kind === "loading") return <div className="portal-session-workspace__state" role="status"><Skeleton as="span" /><Skeleton as="span" /></div>;
  if (state.kind === "error") return <StateMessage message="Recording status is unavailable right now." onRetry={onLoad} />;
  const run = state.status.run;
  const active = Boolean(run && ["REQUESTED", "STARTING", "RECORDING", "STOP_REQUESTED", "PROCESSING"].includes(run.status));
  return <div className="portal-session-workspace__panel-body">
    <p className="portal-session-workspace__eyebrow">Consent-bound recording</p>
    <FactList facts={[
      ["Consent", <Badge key="consent" variant="outline">{labelForValue(context.recording_consent_status)}</Badge>],
      ["Requested", context.recording_requested ? "Yes" : "No"],
      ["Current status", labelForValue(state.status.status)],
      ["Transcript", run?.transcript_available ? "Available" : "Not available"],
    ]} />
    <p className="portal-session-workspace__help">Recording never starts automatically. Student consent and the server recording policy must allow it.</p>
    {context.recording_controls_enabled && context.recording_consent_status === "APPROVED" && context.status === "IN_PROGRESS" && !active ? <Button onClick={onStart} size="sm" type="button"><Video aria-hidden="true" />Start audio recording</Button> : null}
    {context.recording_controls_enabled && run?.run_id && active ? <Button onClick={() => onStop(run.run_id)} size="sm" type="button" variant="outline"><CircleStop aria-hidden="true" />Stop recording</Button> : null}
  </div>;
}

export function PortalCounselingSessionWorkspace({ referenceCode }: { referenceCode: string }) {
  const { hasCapability } = usePortalAccess();
  const [loadState, setLoadState] = useState<WorkspaceLoadState>({ kind: "loading" });
  const [panel, setPanel] = useState<Panel>("student");
  const [reloadKey, setReloadKey] = useState(0);
  const [noteState, setNoteState] = useState<NoteState>({ kind: "idle" });
  const [note, setNote] = useState<PortalCounselingNote>(EMPTY_NOTE);
  const [routineState, setRoutineState] = useState<RoutineState>({ kind: "idle" });
  const [recordingState, setRecordingState] = useState<RecordingState>({ kind: "idle" });
  const [videoState, setVideoState] = useState<VideoState>("idle");
  const [actionIntent, setActionIntent] = useState<SessionAction | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [mutation, setMutation] = useState<MutationState | null>(null);
  const mutationKeysRef = useRef<Map<string, { fingerprint: string; key: IdempotencyKey }>>(new Map());
  const videoMountRef = useRef<HTMLDivElement>(null);
  const dailyCallRef = useRef<DailyCall | null>(null);
  const meetingTokenRef = useRef<string | null>(null);
  const videoGenerationRef = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void Promise.resolve().then(() => {
      if (!active || controller.signal.aborted) return null;
      setLoadState({ kind: "loading" });
      return getPortalCounselingSessionWorkspace(referenceCode, controller.signal);
    }).then((context) => {
      if (context && active && !controller.signal.aborted) setLoadState({ kind: "ready", context });
    }).catch((error: unknown) => {
      if (active && !controller.signal.aborted && !isAbortError(error)) setLoadState({ kind: "error" });
    });
    return () => { active = false; controller.abort(); };
  }, [referenceCode, reloadKey]);

  useEffect(() => {
    if (loadState.kind !== "ready" || !["notes", "summary"].includes(panel) || noteState.kind !== "idle") return;
    const controller = new AbortController();
    let active = true;
    void Promise.resolve().then(() => {
      if (!active || controller.signal.aborted) return null;
      setNoteState({ kind: "loading" });
      return getPortalCounselorNote(referenceCode, controller.signal);
    }).then((value) => {
      if (value && active && !controller.signal.aborted) { setNote(value); setNoteState({ kind: "ready", note: value }); }
    }).catch((error: unknown) => {
      if (active && !controller.signal.aborted && !isAbortError(error)) setNoteState({ kind: "error" });
    });
    return () => { active = false; controller.abort(); };
  }, [loadState, noteState.kind, panel, referenceCode]);

  useEffect(() => {
    if (loadState.kind !== "ready" || panel !== "pre-intake" || !loadState.context.routine_interview_available || routineState.kind !== "idle") return;
    const controller = new AbortController();
    let active = true;
    void Promise.resolve().then(() => {
      if (!active || controller.signal.aborted) return null;
      setRoutineState({ kind: "loading" });
      return getPortalRoutineInterviewDetail(referenceCode, controller.signal);
    }).then((detail) => {
      if (detail && active && !controller.signal.aborted) setRoutineState({ kind: "ready", detail, sensitive: null });
    }).catch((error: unknown) => {
      if (active && !controller.signal.aborted && !isAbortError(error)) setRoutineState({ kind: "error" });
    });
    return () => { active = false; controller.abort(); };
  }, [loadState, panel, referenceCode, routineState.kind]);

  useEffect(() => {
    if (loadState.kind !== "ready" || panel !== "recording" || !loadState.context.ecounseling_reference_code || recordingState.kind !== "idle") return;
    const ecounselingReferenceCode = loadState.context.ecounseling_reference_code;
    const controller = new AbortController();
    let active = true;
    void Promise.resolve().then(() => {
      if (!active || controller.signal.aborted) return null;
      setRecordingState({ kind: "loading" });
      return getPortalRecordingStatus(ecounselingReferenceCode, controller.signal);
    }).then((status) => {
      if (status && active && !controller.signal.aborted) setRecordingState({ kind: "ready", status });
    }).catch((error: unknown) => {
      if (active && !controller.signal.aborted && !isAbortError(error)) setRecordingState({ kind: "error" });
    });
    return () => { active = false; controller.abort(); };
  }, [loadState, panel, recordingState.kind]);

  useEffect(() => {
    return () => {
      videoGenerationRef.current += 1;
      const call = dailyCallRef.current;
      dailyCallRef.current = null;
      meetingTokenRef.current = null;
      if (call) void call.leave().catch(() => undefined).finally(() => void call.destroy().catch(() => undefined));
    };
  }, [referenceCode]);

  const context = loadState.kind === "ready" ? loadState.context : null;
  const canEditNotes = Boolean(context && context.assignment_state === "Assigned to you" && ["IN_PROGRESS", "COUNSELOR_NOTES_DRAFT"].includes(context.status));
  const canLock = hasCapability(PORTAL_CAPABILITIES.counselingSessionLock);
  const availableActions = useMemo<SessionAction[]>(() => {
    if (!context || context.assignment_state !== "Assigned to you") return [];
    if (context.status === "SCHEDULED") return ["start", "cancel", "no-show"];
    if (["IN_PROGRESS", "COUNSELOR_NOTES_DRAFT"].includes(context.status)) return ["save", "complete"];
    if (context.status === "COMPLETED") return ["finalize"];
    if (context.status === "FINALIZED" && canLock) return ["lock"];
    return [];
  }, [canLock, context]);

  const updateContext = () => {
    setReloadKey((value) => value + 1);
    setNoteState({ kind: "idle" });
    setRoutineState({ kind: "idle" });
    setRecordingState({ kind: "idle" });
  };

  const retryPanel = (target: Panel) => {
    if (target === "notes" || target === "summary") setNoteState({ kind: "idle" });
    if (target === "pre-intake") setRoutineState({ kind: "idle" });
    if (target === "recording") setRecordingState({ kind: "idle" });
  };

  const loadRoutineSensitive = () => {
    setRoutineState((current) => current.kind === "ready" ? { ...current, sensitive: null } : current);
    void getPortalRoutineInterviewSensitiveDetail(referenceCode).then((sensitive) => setRoutineState((current) => current.kind === "ready" ? { ...current, sensitive } : current)).catch(() => setRoutineState({ kind: "error" }));
  };

  const cleanupVideo = async () => {
    videoGenerationRef.current += 1;
    const call = dailyCallRef.current;
    dailyCallRef.current = null;
    meetingTokenRef.current = null;
    if (call) {
      try { await call.leave(); } finally { await call.destroy().catch(() => undefined); }
    }
    setVideoState("idle");
  };

  const joinVideo = async () => {
    const mount = videoMountRef.current;
    if (!context?.ecounseling_reference_code || !mount) return;
    const generation = ++videoGenerationRef.current;
    setVideoState("joining");
    try {
      const join = await joinPortalEcounseling(context.ecounseling_reference_code);
      if (videoGenerationRef.current !== generation || !videoMountRef.current) return;
      meetingTokenRef.current = join.meeting_token;
      const dailyModule = await import("@daily-co/daily-js");
      if (videoGenerationRef.current !== generation || !videoMountRef.current) return;
      const call = dailyModule.default.createFrame(mount, { showLeaveButton: false });
      dailyCallRef.current = call;
      await call.join({ url: join.room_url, token: join.meeting_token });
      if (videoGenerationRef.current !== generation) return;
      setVideoState("joined");
    } catch (error: unknown) {
      if (!isAbortError(error)) {
        if (videoGenerationRef.current !== generation) return;
        await cleanupVideo().catch(() => undefined);
        setVideoState("error");
      }
    }
  };

  const getMutationKey = (scope: string, fingerprint: string) => {
    const existing = mutationKeysRef.current.get(scope);
    if (existing?.fingerprint === fingerprint) return existing.key;
    const key = createIdempotencyKey();
    mutationKeysRef.current.set(scope, { fingerprint, key });
    return key;
  };

  const openAction = (action: SessionAction) => {
    setActionIntent(action);
    setActionReason("");
    setActionError(null);
  };

  const confirmAction = async () => {
    if (!context || !actionIntent) return;
    const reason = actionReason.trim();
    if (actionIntent === "cancel" && !reason) { setActionError("Add a short reason before cancelling this session."); return; }
    const payload = { ...note };
    const fingerprint = JSON.stringify({ action: actionIntent, referenceCode, reason, payload });
    const scope = `counseling-session-workspace:${actionIntent}:${referenceCode}`;
    const key = getMutationKey(scope, fingerprint);
    setMutation({ kind: "pending", message: "Saving session change…" });
    try {
      if (actionIntent === "start") await startPortalCounselingSession(referenceCode, key);
      else if (actionIntent === "save") await savePortalCounselingNote(referenceCode, payload, key);
      else if (actionIntent === "complete") await completePortalCounselingSession(referenceCode, payload, key);
      else if (actionIntent === "cancel") await cancelPortalCounselingSession(referenceCode, { reason }, key);
      else if (actionIntent === "no-show") await noShowPortalCounselingSession(referenceCode, key);
      else if (actionIntent === "finalize") await finalizePortalCounselingSession(referenceCode, key);
      else await lockPortalCounselingSession(referenceCode, key);
      mutationKeysRef.current.delete(scope);
      setMutation({ kind: "success", message: "Session updated." });
      setActionIntent(null);
      updateContext();
    } catch (error: unknown) {
      const apiError = error instanceof CounselingApiError ? error : new CounselingApiError("unavailable");
      if (apiError.kind !== "unavailable" && apiError.kind !== "rate_limited") mutationKeysRef.current.delete(scope);
      setMutation({ kind: "error", message: mutationMessage(apiError) });
    }
  };

  const saveNotes = () => openAction("save");

  const startRecordingAction = () => {
    if (!context?.ecounseling_reference_code) return;
    const scope = `recording-start:${context.ecounseling_reference_code}`;
    const key = getMutationKey(scope, JSON.stringify({ scope: "AUDIO_ONLY", referenceCode: context.ecounseling_reference_code }));
    setMutation({ kind: "pending", message: "Starting recording…" });
    void startPortalRecording(context.ecounseling_reference_code, "AUDIO_ONLY", key).then(() => {
      setMutation({ kind: "success", message: "Recording requested." });
      setRecordingState({ kind: "idle" });
    }).catch((error: unknown) => setMutation({ kind: "error", message: mutationMessage(error instanceof CounselingApiError ? error : new CounselingApiError("unavailable")) }));
  };

  const stopRecordingAction = (runId: string) => {
    if (!context?.ecounseling_reference_code) return;
    const scope = `recording-stop:${context.ecounseling_reference_code}`;
    const key = getMutationKey(scope, JSON.stringify({ runId, referenceCode: context.ecounseling_reference_code }));
    setMutation({ kind: "pending", message: "Stopping recording…" });
    void stopPortalRecording(context.ecounseling_reference_code, runId, key).then(() => {
      setMutation({ kind: "success", message: "Recording stop requested." });
      setRecordingState({ kind: "idle" });
    }).catch((error: unknown) => setMutation({ kind: "error", message: mutationMessage(error instanceof CounselingApiError ? error : new CounselingApiError("unavailable")) }));
  };

  const panelContent = context ? (
    panel === "student" ? <div className="portal-session-workspace__panel-body"><FactList facts={[["Student", context.student_display_name ?? "Student details unavailable"], ["Student number", context.student_number ?? "Not available"], ["Session", context.reference_code], ["Type", labelForValue(context.session_type)], ["Mode", labelForValue(context.session_mode)], ["Source", labelForValue(context.session_source)], ["Schedule", formatSchedule(context)], ["Assignment", context.assignment_state ?? "Assignment unavailable"]]} /><div className="portal-session-workspace__related-links"><Link href="/portal/counseling?section=sessions">Back to sessions</Link>{context.routine_interview_available ? <Link href={`/portal/counseling?section=routine-interviews&status=${encodeURIComponent("INTAKE_SUBMITTED")}`}>Open routine interviews</Link> : null}</div></div>
      : panel === "pre-intake" ? <RoutinePanel onLoad={() => retryPanel("pre-intake")} onLoadSensitive={loadRoutineSensitive} state={routineState} />
        : panel === "notes" ? <NotesPanel canEdit={canEditNotes} mode="notes" note={note} onChange={(patch) => setNote((current) => ({ ...current, ...patch }))} onLoad={() => retryPanel("notes")} onSave={saveNotes} state={noteState} />
          : panel === "summary" ? <NotesPanel canEdit={canEditNotes} mode="summary" note={note} onChange={(patch) => setNote((current) => ({ ...current, ...patch }))} onLoad={() => retryPanel("summary")} onSave={saveNotes} state={noteState} />
            : <RecordingPanel context={context} onLoad={() => retryPanel("recording")} onStart={startRecordingAction} onStop={stopRecordingAction} state={recordingState} />
  ) : null;

  if (loadState.kind === "loading") return <section aria-busy="true" className="portal-session-workspace portal-session-workspace--state" role="status"><PortalPageHeader current="Counseling session" description="Loading the authorized session workspace." headingId="portal-session-workspace-heading" title="Counseling session" /><PortalCollectionFrame className="portal-session-workspace__loading"><Skeleton as="span" /><Skeleton as="span" /><Skeleton as="span" /></PortalCollectionFrame></section>;
  if (loadState.kind === "error" || !context) return <section className="portal-session-workspace portal-session-workspace--state" role="alert"><PortalPageHeader current="Counseling session" description="The session workspace is unavailable for this account." headingId="portal-session-workspace-heading" title="Counseling session" /><PortalCollectionFrame className="portal-session-workspace__loading"><HeartHandshake aria-hidden="true" className="portal-session-workspace__state-icon" /><h2>We couldn’t load this session.</h2><p>Return to Counseling or try again when the connection is ready.</p><div className="portal-session-workspace__state-actions"><Button onClick={() => setReloadKey((value) => value + 1)} type="button" variant="outline"><RefreshCw aria-hidden="true" />Try again</Button><Button render={<Link href="/portal/counseling?section=sessions" />} type="button" variant="ghost">Back to sessions</Button></div></PortalCollectionFrame></section>;

  return <section aria-labelledby="portal-session-workspace-heading" className="portal-session-workspace">
    <PortalPageHeader actions={<Button render={<Link href="/portal/counseling?section=sessions" />} size="sm" type="button" variant="outline"><ArrowLeft aria-hidden="true" />Sessions</Button>} className="portal-session-workspace__page-header" current="Counseling session" description="Keep the call visible while you review the authorized session context." headingId="portal-session-workspace-heading" meta={<Badge variant="outline">{labelForValue(context.status)}</Badge>} title={context.student_display_name ?? "Counseling session"} />
    <div className="portal-session-workspace__header-meta"><span>{context.reference_code}</span><span>{labelForValue(context.session_mode)}</span><span>{formatSchedule(context)}</span>{mutation ? <span role={mutation.kind === "error" ? "alert" : "status"}>{mutation.message}</span> : null}</div>
    <div className="portal-session-workspace__actions" aria-label="Session actions">{availableActions.map((action) => <Button key={action} onClick={() => openAction(action)} size="sm" type="button" variant={action === "cancel" || action === "no-show" || action === "lock" ? "outline" : "default"}>{action === "lock" ? <LockKeyhole aria-hidden="true" /> : action === "save" ? <Save aria-hidden="true" /> : action === "start" ? <Video aria-hidden="true" /> : null}{actionLabel(action)}</Button>)}</div>
    <div className="portal-session-workspace__grid">
      <PortalCollectionFrame className="portal-session-workspace__video-frame">
        <div className="portal-session-workspace__video-heading"><div><p className="portal-session-workspace__eyebrow">Daily video</p><h2>Session stage</h2></div><Badge variant="outline">{videoState === "joined" ? "Joined" : context.ecounseling_join_available ? "Ready to join" : "Not available"}</Badge></div>
        <div className="portal-session-workspace__video-stage" ref={videoMountRef}>{videoState !== "joined" ? <div className="portal-session-workspace__video-placeholder"><Video aria-hidden="true" /><p>{videoState === "joining" ? "Joining the private room…" : videoState === "error" ? "The video room could not be joined. Try again." : context.ecounseling_join_available ? "Join when you are ready to begin the session." : "Video is not available for this session."}</p></div> : null}</div>
        <div className="portal-session-workspace__video-controls">{videoState === "joined" ? <Button onClick={() => void cleanupVideo()} size="sm" type="button" variant="outline"><CircleStop aria-hidden="true" />Leave call</Button> : context.ecounseling_join_available ? <Button disabled={videoState === "joining"} onClick={() => void joinVideo()} size="sm" type="button"><Video aria-hidden="true" />Join video</Button> : null}<p>Joining is explicit. The meeting token is held only in this page session.</p></div>
      </PortalCollectionFrame>
      <PortalCollectionFrame className="portal-session-workspace__context-frame">
        <nav aria-label="Session context" className="portal-session-workspace__panel-nav" role="tablist">{PANELS.map((item) => <button aria-controls={`${detailId(referenceCode)}-${item.value}`} aria-selected={panel === item.value} className={panel === item.value ? "is-current" : undefined} key={item.value} onClick={() => setPanel(item.value)} role="tab" type="button">{item.label}</button>)}</nav>
        <div aria-live="polite" className="portal-session-workspace__panel" id={`${detailId(referenceCode)}-${panel}`} role="tabpanel"><div className="portal-session-workspace__panel-heading"><div><p className="portal-session-workspace__eyebrow">Session context</p><h2>{PANELS.find((item) => item.value === panel)?.label}</h2></div>{panel === "summary" ? <Check aria-hidden="true" /> : panel === "notes" ? <FileText aria-hidden="true" /> : <Info aria-hidden="true" />}</div>{panelContent}</div>
      </PortalCollectionFrame>
    </div>
    <AlertDialog onOpenChange={(open) => { if (!open && mutation?.kind !== "pending") { setActionIntent(null); setActionError(null); } }} open={actionIntent !== null}>
      <AlertDialogContent className="portal-session-workspace__dialog" size="sm"><AlertDialogHeader><AlertDialogTitle>{actionIntent ? actionLabel(actionIntent) : "Session action"}</AlertDialogTitle><AlertDialogDescription>{actionIntent === "cancel" ? "Canceling a session requires a short reason." : "Review this session action before continuing."}</AlertDialogDescription></AlertDialogHeader>{actionIntent === "cancel" ? <div className="portal-session-workspace__field"><Label htmlFor="portal-session-action-reason">Reason</Label><Textarea id="portal-session-action-reason" maxLength={2_000} onChange={(event) => setActionReason(event.target.value)} value={actionReason} /></div> : null}{actionError ? <p className="portal-session-workspace__error" role="alert">{actionError}</p> : null}<AlertDialogFooter><AlertDialogCancel disabled={mutation?.kind === "pending"}>Keep session</AlertDialogCancel><AlertDialogAction disabled={mutation?.kind === "pending"} onClick={() => void confirmAction()}>{mutation?.kind === "pending" ? "Saving…" : "Continue"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
  </section>;
}

export function PortalCounselingSessionWorkspaceLoading() {
  return <section aria-busy="true" className="portal-session-workspace portal-session-workspace--state" role="status"><PortalPageHeader current="Counseling session" description="Loading the authorized session workspace." headingId="portal-session-workspace-loading-heading" title="Counseling session" /><PortalCollectionFrame className="portal-session-workspace__loading"><Skeleton as="span" /><Skeleton as="span" /><Skeleton as="span" /></PortalCollectionFrame></section>;
}
