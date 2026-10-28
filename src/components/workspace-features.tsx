"use client";

import {
  Archive,
  Download,
  FileText,
  FolderKanban,
  LoaderCircle,
  Pencil,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

type FeatureSection = "goals" | "blog" | "knowledge" | "ai";
type GoalStatus = "active" | "completed" | "paused" | "archived";
type BlogStatus = "draft" | "scheduled" | "published" | "archived";
type GoalItem = {
  id: string;
  title: string;
  description: string;
  targetValue: number | null;
  currentValue: number;
  unit: string | null;
  status: GoalStatus;
  startsOn: string | null;
  targetDate: string | null;
};
type ProjectItem = {
  id: string;
  goalId: string | null;
  title: string;
  description: string;
  status: GoalStatus;
  startsOn: string | null;
  targetDate: string | null;
};
type BlogItem = {
  id: string;
  title: string;
  body: string;
  status: BlogStatus;
  tags: string[];
  scheduledAt: string | null;
  updatedAt: string;
};
type RelatedItem = {
  id: string;
  title: string;
};
type AttachmentItem = {
  id: string;
  relatedType: string;
  relatedId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  description: string;
  createdAt: string;
};
type AiAnswer = { answer: string; model: string; saved: boolean; notice: string | null };

const initialGoal = {
  title: "",
  description: "",
  targetValue: "",
  currentValue: "0",
  unit: "",
  status: "active" as GoalStatus,
  startsOn: "",
  targetDate: "",
};
const initialProject = {
  title: "",
  description: "",
  goalId: "",
  status: "active" as GoalStatus,
  startsOn: "",
  targetDate: "",
};
const initialBlog = {
  title: "",
  body: "",
  tags: "",
  status: "draft" as BlogStatus,
  scheduledAt: "",
};

async function readJson<T>(response: Response): Promise<T> {
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof result === "object" && result !== null && "error" in result
      ? String(Reflect.get(result, "error"))
      : "The request could not be completed.";
    throw new Error(message);
  }
  return result as T;
}

function dateTimeLocalValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FeatureMessage({ children, error = false }: { children: React.ReactNode; error?: boolean }) {
  return <p className={`feature-message ${error ? "feature-message-error" : ""}`} role={error ? "alert" : "status"}>{children}</p>;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return <label className="feature-field"><span>{label}</span>{children}</label>;
}

export default function WorkspaceFeatures({
  section,
  cloudMode,
  cloudChecked,
}: {
  section: FeatureSection;
  cloudMode: boolean;
  cloudChecked: boolean;
}) {
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [posts, setPosts] = useState<BlogItem[]>([]);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [tasks, setTasks] = useState<RelatedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [goal, setGoal] = useState(initialGoal);
  const [project, setProject] = useState(initialProject);
  const [blog, setBlog] = useState(initialBlog);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTarget, setUploadTarget] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AiAnswer | null>(null);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (section === "goals") {
        const [goalData, projectData] = await Promise.all([
          fetch("/api/workspace/goals").then(readJson<{ items: GoalItem[] }>),
          fetch("/api/workspace/projects").then(readJson<{ items: ProjectItem[] }>),
        ]);
        setGoals(goalData.items);
        setProjects(projectData.items);
      } else if (section === "blog") {
        const result = await fetch("/api/workspace/blog").then(readJson<{ items: BlogItem[] }>);
        setPosts(result.items);
      } else if (section === "knowledge") {
        const [attachmentData, taskData, goalData, projectData, postData] = await Promise.all([
          fetch("/api/attachments").then(readJson<{ items: AttachmentItem[] }>),
          fetch("/api/tasks?limit=200").then(readJson<{ tasks: RelatedItem[] }>),
          fetch("/api/workspace/goals").then(readJson<{ items: GoalItem[] }>),
          fetch("/api/workspace/projects").then(readJson<{ items: ProjectItem[] }>),
          fetch("/api/workspace/blog").then(readJson<{ items: BlogItem[] }>),
        ]);
        setAttachments(attachmentData.items);
        setTasks(taskData.tasks);
        setGoals(goalData.items);
        setProjects(projectData.items);
        setPosts(postData.items);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load this workspace.");
    } finally {
      setLoading(false);
    }
  }, [section]);

  useEffect(() => {
    if (!cloudMode) return;
    const timeout = window.setTimeout(() => void loadWorkspace(), 0);
    return () => window.clearTimeout(timeout);
  }, [cloudMode, loadWorkspace]);

  const attachmentTargets = useMemo(() => [
    ...tasks.map((item) => ({ ...item, type: "task" })),
    ...projects.map((item) => ({ ...item, type: "project" })),
    ...posts.map((item) => ({ ...item, type: "blog" })),
  ], [posts, projects, tasks]);

  function clearNotice() {
    setMessage("");
    setError("");
  }

  async function submitWorkspace(
    event: FormEvent<HTMLFormElement>,
    collection: "goals" | "projects" | "blog",
    body: unknown,
    editId: string | null,
    reset: () => void,
  ) {
    event.preventDefault();
    clearNotice();
    setSaving(true);
    try {
      const response = await fetch(editId
        ? `/api/workspace/${collection}/${editId}`
        : `/api/workspace/${collection}`, {
        method: editId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await readJson(response);
      reset();
      setMessage(editId ? "Changes saved." : "Added to your workspace.");
      await loadWorkspace();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save your changes.");
    } finally {
      setSaving(false);
    }
  }

  async function archiveItem(
    collection: "goals" | "projects" | "blog",
    item: GoalItem | ProjectItem | BlogItem,
    body: Record<string, unknown>,
  ) {
    clearNotice();
    setSaving(true);
    try {
      await readJson(await fetch(`/api/workspace/${collection}/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }));
      setMessage("Archived. You can still find the record in your database.");
      await loadWorkspace();
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Could not archive this item.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadAttachment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearNotice();
    if (!uploadFile || !uploadTarget) {
      setError("Choose a file and the task, project, or post it belongs to.");
      return;
    }
    const [relatedType, relatedId] = uploadTarget.split(":");
    const form = new FormData();
    form.set("file", uploadFile);
    form.set("relatedType", relatedType);
    form.set("relatedId", relatedId);
    form.set("description", uploadDescription);
    setSaving(true);
    try {
      await readJson(await fetch("/api/attachments", { method: "POST", body: form }));
      setUploadFile(null);
      setUploadDescription("");
      const fileInput = document.getElementById("attachment-file");
      if (fileInput instanceof HTMLInputElement) fileInput.value = "";
      setMessage("Private file uploaded.");
      await loadWorkspace();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Could not upload this file.");
    } finally {
      setSaving(false);
    }
  }

  async function downloadAttachment(item: AttachmentItem) {
    clearNotice();
    try {
      const result = await readJson<{ url: string }>(await fetch(`/api/attachments/${item.id}`));
      window.location.assign(result.url);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Could not download this file.");
    }
  }

  async function deleteAttachment(item: AttachmentItem) {
    if (!window.confirm(`Permanently delete "${item.filename}"?`)) return;
    clearNotice();
    setSaving(true);
    try {
      await readJson(await fetch(`/api/attachments/${item.id}`, { method: "DELETE" }));
      setMessage("File deleted.");
      await loadWorkspace();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete this file.");
    } finally {
      setSaving(false);
    }
  }

  async function askAi(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearNotice();
    setAnswer(null);
    setSaving(true);
    try {
      const result = await readJson<AiAnswer>(await fetch("/api/ai/studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      }));
      setAnswer(result);
      if (result.notice) setMessage(result.notice);
      setQuestion("");
    } catch (aiError) {
      setError(aiError instanceof Error ? aiError.message : "AI request failed.");
    } finally {
      setSaving(false);
    }
  }

  const heading = {
    goals: ["MAKE ROOM FOR THE LONG GAME", "Goals & projects", "Turn meaningful outcomes into small, trackable next steps."],
    blog: ["YOUR PRIVATE WORKSPACE", "Blog studio", "Capture ideas, revise drafts, and keep your writing in one private place."],
    knowledge: ["YOUR PRIVATE WORKSPACE", "Knowledge", "Keep useful files attached to the tasks and projects they support."],
    ai: ["THOUGHTFUL, EVIDENCE-BASED SUPPORT", "AI studio", "Ask planning questions grounded in records saved in your workspace."],
  }[section];

  if (!cloudChecked) {
    return <section className="section-page"><PageHeading eyebrow={heading[0]} title={heading[1]} subtitle={heading[2]} /><div className="surface-card feature-panel"><p>Checking your private workspace connection…</p></div></section>;
  }
  if (!cloudMode) {
    return (
      <section className="section-page">
        <PageHeading eyebrow={heading[0]} title={heading[1]} subtitle={heading[2]} />
        <div className="surface-card feature-panel">
          <div className="feature-icon"><FolderKanban size={22} /></div>
          <h2>Connect your private workspace</h2>
          <p>These features save records to Supabase. Tasks are not connected right now, so changes here are disabled rather than pretending they were saved.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="section-page">
      <PageHeading eyebrow={heading[0]} title={heading[1]} subtitle={heading[2]} />
      {error && <FeatureMessage error>{error}</FeatureMessage>}
      {message && <FeatureMessage>{message}</FeatureMessage>}
      {loading && <FeatureMessage><LoaderCircle className="feature-spinner" size={14} /> Loading saved records…</FeatureMessage>}

      {section === "goals" && (
        <div className="feature-columns">
          <div className="surface-card feature-panel">
            <div className="card-heading"><div><p className="eyebrow">{editingGoalId ? "UPDATE YOUR DIRECTION" : "START WITH WHAT MATTERS"}</p><h2>{editingGoalId ? "Edit goal" : "Add a goal"}</h2></div></div>
            <form className="feature-form" onSubmit={(event) => void submitWorkspace(event, "goals", {
              title: goal.title,
              description: goal.description,
              targetValue: goal.targetValue ? Number(goal.targetValue) : null,
              currentValue: Number(goal.currentValue) || 0,
              unit: goal.unit.trim() || null,
              status: goal.status,
              startsOn: goal.startsOn || null,
              targetDate: goal.targetDate || null,
            }, editingGoalId, () => { setGoal(initialGoal); setEditingGoalId(null); })}>
              <Field label="Goal name"><input maxLength={180} onChange={(event) => setGoal({ ...goal, title: event.target.value })} required value={goal.title} /></Field>
              <Field label="Description"><textarea maxLength={4000} onChange={(event) => setGoal({ ...goal, description: event.target.value })} rows={3} value={goal.description} /></Field>
              <div className="feature-form-grid">
                <Field label="Target"><input min="0.01" onChange={(event) => setGoal({ ...goal, targetValue: event.target.value })} step="any" type="number" value={goal.targetValue} /></Field>
                <Field label="Current progress"><input min="0" onChange={(event) => setGoal({ ...goal, currentValue: event.target.value })} step="any" type="number" value={goal.currentValue} /></Field>
                <Field label="Unit"><input maxLength={40} onChange={(event) => setGoal({ ...goal, unit: event.target.value })} placeholder="books, hours…" value={goal.unit} /></Field>
                <Field label="Status"><select onChange={(event) => setGoal({ ...goal, status: event.target.value as GoalStatus })} value={goal.status}>{["active", "completed", "paused"].map((item) => <option key={item} value={item}>{item}</option>)}</select></Field>
                <Field label="Start date"><input onChange={(event) => setGoal({ ...goal, startsOn: event.target.value })} type="date" value={goal.startsOn} /></Field>
                <Field label="Target date"><input onChange={(event) => setGoal({ ...goal, targetDate: event.target.value })} type="date" value={goal.targetDate} /></Field>
              </div>
              <div className="feature-form-actions">{editingGoalId && <button className="secondary-button" onClick={() => { setGoal(initialGoal); setEditingGoalId(null); }} type="button"><X size={14} /> Cancel</button>}<button className="primary-button" disabled={saving || !goal.title.trim()} type="submit">{saving ? <LoaderCircle className="feature-spinner" size={15} /> : <Plus size={15} />}{editingGoalId ? "Save goal" : "Add goal"}</button></div>
            </form>

            <div className="feature-divider" />
            <div className="card-heading"><div><p className="eyebrow">{editingProjectId ? "UPDATE YOUR NEXT STEPS" : "MAKE IT ACTIONABLE"}</p><h2>{editingProjectId ? "Edit project" : "Add a project"}</h2></div></div>
            <form className="feature-form" onSubmit={(event) => void submitWorkspace(event, "projects", {
              title: project.title,
              description: project.description,
              goalId: project.goalId || null,
              status: project.status,
              startsOn: project.startsOn || null,
              targetDate: project.targetDate || null,
            }, editingProjectId, () => { setProject(initialProject); setEditingProjectId(null); })}>
              <Field label="Project name"><input maxLength={180} onChange={(event) => setProject({ ...project, title: event.target.value })} required value={project.title} /></Field>
              <Field label="Description"><textarea maxLength={4000} onChange={(event) => setProject({ ...project, description: event.target.value })} rows={2} value={project.description} /></Field>
              <div className="feature-form-grid">
                <Field label="Linked goal"><select onChange={(event) => setProject({ ...project, goalId: event.target.value })} value={project.goalId}><option value="">No linked goal</option>{goals.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></Field>
                <Field label="Status"><select onChange={(event) => setProject({ ...project, status: event.target.value as GoalStatus })} value={project.status}>{["active", "completed", "paused"].map((item) => <option key={item} value={item}>{item}</option>)}</select></Field>
                <Field label="Start date"><input onChange={(event) => setProject({ ...project, startsOn: event.target.value })} type="date" value={project.startsOn} /></Field>
                <Field label="Target date"><input onChange={(event) => setProject({ ...project, targetDate: event.target.value })} type="date" value={project.targetDate} /></Field>
              </div>
              <div className="feature-form-actions">{editingProjectId && <button className="secondary-button" onClick={() => { setProject(initialProject); setEditingProjectId(null); }} type="button"><X size={14} /> Cancel</button>}<button className="primary-button" disabled={saving || !project.title.trim()} type="submit">{saving ? <LoaderCircle className="feature-spinner" size={15} /> : <Plus size={15} />}{editingProjectId ? "Save project" : "Add project"}</button></div>
            </form>
          </div>

          <div className="feature-stack">
            <section className="surface-card feature-panel">
              <div className="card-heading"><div><p className="eyebrow">LONG-TERM DIRECTION</p><h2>Your goals <span className="feature-count">{goals.length}</span></h2></div></div>
              {goals.length ? goals.map((item) => {
                const progress = item.targetValue ? Math.min(100, Math.round((item.currentValue / item.targetValue) * 100)) : null;
                return <article className="feature-record" key={item.id}>
                  <div className="feature-record-top"><div><span className={`feature-status status-${item.status}`}>{item.status}</span><h3>{item.title}</h3></div><div className="feature-record-actions"><button aria-label={`Edit ${item.title}`} className="icon-button" onClick={() => { setGoal({ title: item.title, description: item.description, targetValue: item.targetValue === null ? "" : String(item.targetValue), currentValue: String(item.currentValue), unit: item.unit ?? "", status: item.status, startsOn: item.startsOn ?? "", targetDate: item.targetDate ?? "" }); setEditingGoalId(item.id); }} type="button"><Pencil size={14} /></button><button aria-label={`Archive ${item.title}`} className="icon-button" onClick={() => void archiveItem("goals", item, { title: item.title, description: item.description, targetValue: item.targetValue, currentValue: item.currentValue, unit: item.unit, status: "archived", startsOn: item.startsOn, targetDate: item.targetDate })} type="button"><Archive size={14} /></button></div></div>
                  {item.description && <p className="feature-record-description">{item.description}</p>}
                  {progress !== null && <><div className="feature-progress-label"><span>{item.currentValue} / {item.targetValue} {item.unit ?? ""}</span><b>{progress}%</b></div><div className="feature-progress"><span style={{ width: `${progress}%` }} /></div></>}
                  {item.targetDate && <p className="feature-record-foot">Target · {item.targetDate}</p>}
                </article>;
              }) : <p className="feature-empty-copy">Add a goal to make your long-term direction visible.</p>}
            </section>
            <section className="surface-card feature-panel">
              <div className="card-heading"><div><p className="eyebrow">THE WORK IN MOTION</p><h2>Your projects <span className="feature-count">{projects.length}</span></h2></div></div>
              {projects.length ? projects.map((item) => <article className="feature-record" key={item.id}>
                <div className="feature-record-top"><div><span className={`feature-status status-${item.status}`}>{item.status}</span><h3>{item.title}</h3></div><div className="feature-record-actions"><button aria-label={`Edit ${item.title}`} className="icon-button" onClick={() => { setProject({ title: item.title, description: item.description, goalId: item.goalId ?? "", status: item.status, startsOn: item.startsOn ?? "", targetDate: item.targetDate ?? "" }); setEditingProjectId(item.id); }} type="button"><Pencil size={14} /></button><button aria-label={`Archive ${item.title}`} className="icon-button" onClick={() => void archiveItem("projects", item, { title: item.title, description: item.description, goalId: item.goalId, status: "archived", startsOn: item.startsOn, targetDate: item.targetDate })} type="button"><Archive size={14} /></button></div></div>
                {item.description && <p className="feature-record-description">{item.description}</p>}
                <p className="feature-record-foot">{goals.find((goalItem) => goalItem.id === item.goalId)?.title ?? "No linked goal"}{item.targetDate ? ` · Due ${item.targetDate}` : ""}</p>
              </article>) : <p className="feature-empty-copy">Projects help turn goals into manageable steps.</p>}
            </section>
          </div>
        </div>
      )}

      {section === "blog" && (
        <div className="feature-columns feature-columns-blog">
          <div className="surface-card feature-panel">
            <div className="card-heading"><div><p className="eyebrow">{editingPostId ? "KEEP REFINING" : "CAPTURE AN IDEA"}</p><h2>{editingPostId ? "Edit post" : "New post"}</h2></div></div>
            <form className="feature-form" onSubmit={(event) => void submitWorkspace(event, "blog", {
              title: blog.title,
              body: blog.body,
              tags: blog.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
              status: blog.status,
              scheduledAt: blog.scheduledAt ? new Date(blog.scheduledAt).toISOString() : null,
            }, editingPostId, () => { setBlog(initialBlog); setEditingPostId(null); })}>
              <Field label="Title"><input maxLength={180} onChange={(event) => setBlog({ ...blog, title: event.target.value })} required value={blog.title} /></Field>
              <Field label="Draft"><textarea className="blog-editor" maxLength={50000} onChange={(event) => setBlog({ ...blog, body: event.target.value })} placeholder="Write your thoughts…" rows={12} value={blog.body} /></Field>
              <Field label="Tags · comma separated"><input maxLength={500} onChange={(event) => setBlog({ ...blog, tags: event.target.value })} placeholder="reflection, learning" value={blog.tags} /></Field>
              <div className="feature-form-grid">
                <Field label="Status"><select onChange={(event) => setBlog({ ...blog, status: event.target.value as BlogStatus })} value={blog.status}>{["draft", "scheduled", "published"].map((item) => <option key={item} value={item}>{item}</option>)}</select></Field>
                {blog.status === "scheduled" && <Field label="Publish date and time"><input onChange={(event) => setBlog({ ...blog, scheduledAt: event.target.value })} required type="datetime-local" value={blog.scheduledAt} /></Field>}
              </div>
              <div className="feature-form-actions">{editingPostId && <button className="secondary-button" onClick={() => { setBlog(initialBlog); setEditingPostId(null); }} type="button"><X size={14} /> Cancel</button>}<button className="primary-button" disabled={saving || !blog.title.trim()} type="submit">{saving ? <LoaderCircle className="feature-spinner" size={15} /> : <Plus size={15} />}{editingPostId ? "Save draft" : "Save post"}</button></div>
            </form>
          </div>
          <section className="surface-card feature-panel">
            <div className="card-heading"><div><p className="eyebrow">YOUR WRITING</p><h2>Posts <span className="feature-count">{posts.length}</span></h2></div></div>
            {posts.length ? posts.map((item) => <article className="feature-record" key={item.id}>
              <div className="feature-record-top"><div><span className={`feature-status status-${item.status}`}>{item.status}</span><h3>{item.title}</h3></div><div className="feature-record-actions"><button aria-label={`Edit ${item.title}`} className="icon-button" onClick={() => { setBlog({ title: item.title, body: item.body, tags: item.tags.join(", "), status: item.status, scheduledAt: dateTimeLocalValue(item.scheduledAt) }); setEditingPostId(item.id); }} type="button"><Pencil size={14} /></button><button aria-label={`Archive ${item.title}`} className="icon-button" onClick={() => void archiveItem("blog", item, { title: item.title, body: item.body, tags: item.tags, status: "archived", scheduledAt: item.scheduledAt })} type="button"><Archive size={14} /></button></div></div>
              {item.tags.length > 0 && <p className="feature-tags">{item.tags.map((tag) => <span key={tag}>{tag}</span>)}</p>}
              <p className="feature-record-description feature-blog-excerpt">{item.body || "No writing yet."}</p>
              <p className="feature-record-foot">Updated {new Date(item.updatedAt).toLocaleDateString()}</p>
            </article>) : <p className="feature-empty-copy">Your saved drafts and published posts will show here.</p>}
          </section>
        </div>
      )}

      {section === "knowledge" && (
        <div className="feature-columns feature-columns-knowledge">
          <section className="surface-card feature-panel">
            <div className="card-heading"><div><p className="eyebrow">PRIVATE FILE STORAGE</p><h2>Attachments <span className="feature-count">{attachments.length}</span></h2></div></div>
            <p className="feature-help">Files are private. Downloads use temporary signed links. Maximum size: 25 MB.</p>
            {attachments.length ? attachments.map((item) => <article className="feature-record attachment-record" key={item.id}>
              <div className="feature-record-top"><div className="attachment-title"><span className="feature-file-icon"><FileText size={17} /></span><div><h3>{item.filename}</h3><span>{formatBytes(item.sizeBytes)} · {item.relatedType}</span></div></div><div className="feature-record-actions"><button aria-label={`Download ${item.filename}`} className="icon-button" onClick={() => void downloadAttachment(item)} type="button"><Download size={15} /></button><button aria-label={`Delete ${item.filename}`} className="icon-button" onClick={() => void deleteAttachment(item)} type="button"><Trash2 size={15} /></button></div></div>
              {item.description && <p className="feature-record-description">{item.description}</p>}
              <p className="feature-record-foot">Added {new Date(item.createdAt).toLocaleDateString()}</p>
            </article>) : <p className="feature-empty-copy">No files uploaded yet. Add one and link it to a task, project, or blog post.</p>}
          </section>
          <section className="surface-card feature-panel">
            <div className="card-heading"><div><p className="eyebrow">KEEP CONTEXT TOGETHER</p><h2>Upload a file</h2></div></div>
            <form className="feature-form" onSubmit={(event) => void uploadAttachment(event)}>
              <Field label="Link to a saved item"><select onChange={(event) => setUploadTarget(event.target.value)} required value={uploadTarget}><option value="">Choose a task, project, or post</option>{attachmentTargets.map((item) => <option key={`${item.type}:${item.id}`} value={`${item.type}:${item.id}`}>{item.type}: {item.title}</option>)}</select></Field>
              <Field label="File"><input accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.md,application/pdf,image/png,image/jpeg,image/webp,text/plain,text/markdown" id="attachment-file" onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)} required type="file" /></Field>
              <Field label="Description · optional"><textarea maxLength={500} onChange={(event) => setUploadDescription(event.target.value)} rows={3} value={uploadDescription} /></Field>
              <button className="primary-button" disabled={saving || !uploadFile || !uploadTarget} type="submit">{saving ? <LoaderCircle className="feature-spinner" size={15} /> : <Upload size={15} />}Upload privately</button>
            </form>
            <p className="feature-footnote">Supported: PDF, PNG, JPEG, WebP, TXT, and Markdown. Your bucket must be private and named <b>Attachments</b>.</p>
          </section>
        </div>
      )}

      {section === "ai" && (
        <div className="ai-studio-layout">
          <section className="surface-card feature-panel ai-prompt-panel">
            <div className="feature-icon"><Sparkles size={22} /></div>
            <h2>Your data comes first</h2>
            <p className="feature-help">Ask about records currently saved in Supabase: tasks, goals, projects, daily logs, and completed focus sessions. Browser-only journal and timer entries are not synced yet. Your prompt and answer are saved privately as an AI insight.</p>
            <form className="feature-form" onSubmit={(event) => void askAi(event)}>
              <Field label="What would you like help thinking through?"><textarea maxLength={1200} onChange={(event) => setQuestion(event.target.value)} placeholder="For example: Based on my current goals and tasks, suggest one realistic next step." required rows={5} value={question} /></Field>
              <div className="feature-form-actions"><span className="feature-footnote">On submit, the question and saved Supabase evidence are sent to Gemini. Nothing is sent before you submit.</span><button className="primary-button" disabled={saving || question.trim().length < 3} type="submit">{saving ? <LoaderCircle className="feature-spinner" size={15} /> : <Send size={15} />}Ask Gemini</button></div>
            </form>
          </section>
          <section className="surface-card feature-panel ai-answer-panel">
            <div className="card-heading"><div><p className="eyebrow">SAVED-RECORD ANALYSIS</p><h2>A thoughtful next step</h2></div></div>
            {saving ? <div className="ai-empty"><LoaderCircle className="feature-spinner" size={21} /><p>Reviewing your saved evidence…</p></div> : answer ? <><div className="ai-answer">{answer.answer}</div><p className="feature-record-foot">Model: {answer.model} · {answer.saved ? "Saved to AI insights" : "Not saved"}</p></> : <div className="ai-empty"><Sparkles size={22} /><p>Your answer will appear here. No AI request is sent until you submit a question.</p></div>}
          </section>
        </div>
      )}
    </section>
  );
}

function PageHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-subtitle">{subtitle}</p></div></div>;
}
