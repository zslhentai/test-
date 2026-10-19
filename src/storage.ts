import { createWorkspace, parseWorkspace } from "./model";
import type { Workspace } from "./model";

export type Project = {
  id: string;
  name: string;
  workspace: Workspace;
  revision: number;
  createdAt: number;
  updatedAt: number;
  writer?: string;
  sequence?: number;
};
type PendingEdit = {
  project: Project;
  baseRevision: number;
  writer: string;
  sequence: number;
};
const PREFIX = "project:",
  JOURNAL = "main-image-lab:pending:";
const range = () => IDBKeyRange.bound(PREFIX, `${PREFIX}\uffff`);
let connection: Promise<IDBDatabase> | undefined;
let loading:
  | Promise<{ projects: Project[]; activeId: string; recovered: number }>
  | undefined;
function uniqueId() {
  return (
    crypto.randomUUID?.() ??
    Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("")
  );
}
const writer = uniqueId();
let sequence = 0;

export class ConflictError extends Error {
  constructor() {
    super(
      "此项目已被其他页面修改或删除。请另存为新项目，或重新载入已保存版本。",
    );
  }
}
function openDatabase(): Promise<IDBDatabase> {
  if (connection) return connection;
  connection = new Promise((resolve, reject) => {
    // Keep the V1.0 database version and store; migration never destroys the current key.
    const request = indexedDB.open("main-image-lab", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("workspace");
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        connection = undefined;
      };
      resolve(db);
    };
    request.onerror = () => {
      connection = undefined;
      reject(request.error);
    };
    request.onblocked = () => {
      connection = undefined;
      reject(new Error("本地数据库暂时被占用"));
    };
  });
  return connection;
}
function transactionResult<T>(
  tx: IDBTransaction,
  getResult: () => T,
): Promise<T> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      try {
        resolve(getResult());
      } catch (error) {
        reject(error);
      }
    };
    tx.onabort = () => reject(tx.error ?? new Error("本地保存事务已取消"));
    tx.onerror = () => {
      /* Request success is not transaction completion. */
    };
  });
}
function validateProject(value: unknown): Project {
  const p = value as Project;
  if (
    !p ||
    typeof p.id !== "string" ||
    !p.id ||
    typeof p.name !== "string" ||
    !p.name.trim() ||
    p.name.length > 40 ||
    !Number.isInteger(p.revision) ||
    p.revision < 1 ||
    !Number.isFinite(p.createdAt) ||
    !Number.isFinite(p.updatedAt)
  )
    throw new Error("项目记录损坏，请保留原始浏览器数据并导入备份");
  parseWorkspace(p.workspace);
  return p;
}
function newProject(name: string, workspace: Workspace): Project {
  const now = Date.now();
  return {
    id: uniqueId(),
    name: name.trim().slice(0, 40) || "未命名项目",
    workspace,
    revision: 1,
    createdAt: now,
    updatedAt: now,
  };
}
function journalKey(edit: PendingEdit) {
  return `${JOURNAL}${edit.writer}:${edit.project.id}`;
}
function removeJournal(edit: PendingEdit) {
  try {
    const key = journalKey(edit),
      stored = localStorage.getItem(key);
    if (stored && JSON.parse(stored).sequence <= edit.sequence)
      localStorage.removeItem(key);
  } catch {
    /* A stale journal cannot overwrite a newer committed revision. */
  }
}
function writeJournal(edit: PendingEdit): boolean {
  try {
    localStorage.setItem(journalKey(edit), JSON.stringify(edit));
    return true;
  } catch {
    return false;
  } // Large images can exceed localStorage; beforeunload protects pending IDB writes.
}
async function commitEdit(edit: PendingEdit): Promise<Project> {
  const db = await openDatabase();
  const tx = db.transaction("workspace", "readwrite", { durability: "strict" }),
    store = tx.objectStore("workspace");
  let result: Project,
    conflict = false,
    failure: unknown;
  const request = store.get(PREFIX + edit.project.id);
  request.onsuccess = () => {
    try {
      const current = request.result as Project | undefined;
      if (
        !current ||
        (current.revision !== edit.baseRevision &&
          current.writer !== edit.writer)
      ) {
        conflict = true;
        tx.abort();
        return;
      }
      // Recovery can already have applied this snapshot. Do not replay an older sequence.
      if (
        current.writer === edit.writer &&
        (current.sequence ?? 0) >= edit.sequence
      ) {
        result = current;
        return;
      }
      result = {
        ...edit.project,
        revision: current.revision + 1,
        updatedAt: Date.now(),
        writer: edit.writer,
        sequence: edit.sequence,
      };
      store.put(result, PREFIX + result.id);
    } catch (error) {
      failure = error;
      tx.abort();
    }
  };
  try {
    return await transactionResult(tx, () => result);
  } catch (error) {
    if (conflict) throw new ConflictError();
    throw failure ?? error;
  }
}
export async function createProject(
  name: string,
  workspace = createWorkspace(),
): Promise<Project> {
  parseWorkspace(workspace);
  const p = newProject(name, workspace),
    db = await openDatabase();
  const tx = db.transaction("workspace", "readwrite", { durability: "strict" }),
    store = tx.objectStore("workspace");
  store.add(p, PREFIX + p.id);
  store.put(p.id, "active-project");
  return transactionResult(tx, () => p);
}
export async function readProject(id: string): Promise<Project> {
  const db = await openDatabase(),
    tx = db.transaction("workspace", "readonly");
  const request = tx.objectStore("workspace").get(PREFIX + id);
  const data = await transactionResult(tx, () => request.result);
  if (!data) throw new ConflictError();
  return validateProject(data);
}
export async function selectProject(id: string): Promise<Project> {
  const p = await readProject(id),
    db = await openDatabase(),
    tx = db.transaction("workspace", "readwrite");
  tx.objectStore("workspace").put(id, "active-project");
  return transactionResult(tx, () => p);
}
export async function deleteProject(project: Project): Promise<Project> {
  const db = await openDatabase(),
    tx = db.transaction("workspace", "readwrite", { durability: "strict" }),
    store = tx.objectStore("workspace");
  let result: Project,
    conflict = false;
  const request = store.getAll(range());
  request.onsuccess = () => {
    const projects = request.result as Project[];
    if (
      projects.find((p) => p.id === project.id)?.revision !== project.revision
    ) {
      conflict = true;
      tx.abort();
      return;
    }
    result =
      projects.find((p) => p.id !== project.id) ??
      newProject("未命名项目", createWorkspace());
    store.delete(PREFIX + project.id);
    if (projects.length === 1) store.add(result, PREFIX + result.id);
    store.put(result.id, "active-project");
  };
  try {
    return await transactionResult(tx, () => result);
  } catch (error) {
    if (conflict) throw new ConflictError();
    throw error;
  }
}
export function loadProjects(): Promise<{
  projects: Project[];
  activeId: string;
  recovered: number;
}> {
  if (!loading) {
    const load = () => readProjectsAndRecover();
    // Serialize recovery across tabs as well as React StrictMode's duplicate effect.
    loading = Promise.resolve(
      navigator.locks
        ? navigator.locks.request("main-image-lab:recovery", load)
        : load(),
    ).finally(() => {
      loading = undefined;
    });
  }
  return loading!;
}
async function readProjectsAndRecover(): Promise<{
  projects: Project[];
  activeId: string;
  recovered: number;
}> {
  const db = await openDatabase(),
    tx = db.transaction("workspace", "readwrite", { durability: "strict" }),
    store = tx.objectStore("workspace");
  let projects: Project[] = [],
    activeId: string,
    validationError: unknown;
  const active = store.get("active-project"),
    all = store.getAll(range());
  all.onsuccess = () => {
    try {
      projects = all.result.map(validateProject);
      if (projects.length) {
        activeId = projects.some((p) => p.id === active.result)
          ? active.result
          : projects[0].id;
        return;
      }
      const legacy = store.get("current");
      legacy.onsuccess = () => {
        try {
          const p = newProject(
            "默认项目",
            legacy.result ? parseWorkspace(legacy.result) : createWorkspace(),
          );
          projects = [p];
          activeId = p.id;
          store.add(p, PREFIX + p.id);
          store.put(p.id, "active-project");
        } catch (error) {
          validationError = error;
          tx.abort();
        }
      };
    } catch (error) {
      validationError = error;
      tx.abort();
    }
  };
  try {
    await transactionResult(tx, () => undefined);
  } catch (error) {
    throw validationError ?? error;
  }

  let recovered = 0;
  const pending: PendingEdit[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)!;
      if (!key.startsWith(JOURNAL)) continue;
      try {
        const edit = JSON.parse(localStorage.getItem(key)!) as PendingEdit;
        validateProject(edit.project);
        if (
          typeof edit.writer === "string" &&
          Number.isSafeInteger(edit.sequence) &&
          Number.isSafeInteger(edit.baseRevision) &&
          key === journalKey(edit)
        )
          pending.push(edit);
      } catch {
        /* Keep malformed journals intact for manual recovery. */
      }
    }
  } catch {
    /* IndexedDB still works when localStorage is unavailable. */
  }
  for (const edit of pending) {
    try {
      const saved = await commitEdit(edit);
      if (saved.writer === edit.writer && saved.sequence === edit.sequence)
        recovered++;
    } catch (error) {
      if (!(error instanceof ConflictError)) throw error;
      const copy = await createProject(
        `${edit.project.name.slice(0, 28)}（未保存恢复）`,
        edit.project.workspace,
      );
      activeId = copy.id;
      recovered++;
    }
    removeJournal(edit);
  }
  const read = db.transaction("workspace", "readonly"),
    latest = read.objectStore("workspace").getAll(range());
  projects = await transactionResult(read, () =>
    latest.result.map(validateProject),
  );
  projects.sort(
    (a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id),
  );
  return { projects, activeId: activeId!, recovered };
}

/** One in-flight transaction per session; only the newest pending snapshot is queued. */
export class ProjectSession {
  project: Project;
  private pending?: PendingEdit;
  private running = false;
  private error?: unknown;
  private journalProtected = true;
  private waiters: { resolve: () => void; reject: (error: unknown) => void }[] =
    [];
  constructor(
    project: Project,
    private changed: (
      project: Project,
      status: "saving" | "saved" | "error",
      error?: unknown,
    ) => void,
  ) {
    this.project = project;
  }
  get dirty() {
    return !!this.pending || this.running;
  }
  get needsUnloadWarning() {
    return !!this.error || (this.dirty && !this.journalProtected);
  }
  edit(workspace: Workspace, name = this.project.name) {
    this.project = { ...this.project, workspace, name };
    this.pending = {
      project: this.project,
      baseRevision: this.project.revision,
      writer,
      sequence: ++sequence,
    };
    this.journalProtected = writeJournal(this.pending);
    this.changed(this.project, this.error ? "error" : "saving", this.error);
    this.pump();
  }
  retry() {
    this.error = undefined;
    this.pump();
  }
  abandon() {
    if (this.pending) removeJournal(this.pending);
    this.pending = undefined;
    this.error = undefined;
  }
  flush(): Promise<void> {
    if (this.error) return Promise.reject(this.error);
    if (!this.dirty) return Promise.resolve();
    return new Promise((resolve, reject) =>
      this.waiters.push({ resolve, reject }),
    );
  }
  private pump() {
    if (this.running || this.error || !this.pending) return;
    this.running = true;
    const edit = this.pending;
    this.changed(this.project, "saving");
    commitEdit(edit)
      .then((saved) => {
        this.project = {
          ...this.project,
          revision: saved.revision,
          updatedAt: saved.updatedAt,
        };
        if (this.pending?.sequence === edit.sequence) {
          this.pending = undefined;
          removeJournal(edit);
        } else if (this.pending) {
          this.pending = { ...this.pending, baseRevision: saved.revision };
          this.journalProtected = writeJournal(this.pending);
        }
        this.changed(this.project, this.pending ? "saving" : "saved");
      })
      .catch((error) => {
        this.error = error;
        this.changed(this.project, "error", error);
      })
      .finally(() => {
        this.running = false;
        if (this.error)
          this.waiters.splice(0).forEach((w) => w.reject(this.error));
        else if (this.pending) this.pump();
        else this.waiters.splice(0).forEach((w) => w.resolve());
      });
  }
}
