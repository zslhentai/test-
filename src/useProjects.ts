import { useEffect, useRef, useState } from "react";
import type { SetStateAction } from "react";
import { createWorkspace } from "./model";
import type { Workspace } from "./model";
import {
  createProject,
  deleteProject,
  loadProjects,
  ProjectSession,
  selectProject,
} from "./storage";
import type { Project } from "./storage";

export function useProjects(notify: (message: string) => void) {
  const [project, setProject] = useState<Project>(() => ({
    id: "unsaved",
    name: "未保存项目",
    workspace: createWorkspace(),
    revision: 0,
    createdAt: 0,
    updatedAt: 0,
  }));
  const [projects, setProjects] = useState<Project[]>([]);
  const [loaded, setLoaded] = useState(false),
    [loadError, setLoadError] = useState(false),
    [busy, setBusy] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saving" | "saved" | "error">(
    "saving",
  );
  const [saveError, setSaveError] = useState<unknown>();
  const session = useRef<ProjectSession | null>(null),
    alive = useRef(true),
    operating = useRef(false),
    fallback = useRef(project);
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  function attach(p: Project) {
    const next = new ProjectSession(p, (value, status, error) => {
      if (!alive.current || session.current !== next) return;
      setProject(value);
      fallback.current = value;
      setSaveStatus(status);
      setSaveError(error);
      setProjects((list) =>
        list.map((item) => (item.id === value.id ? value : item)),
      );
      if (error)
        notifyRef.current(
          error instanceof Error
            ? error.message
            : "本地保存失败，请导出方案备份并重试",
        );
    });
    session.current = next;
    fallback.current = p;
    setProject(p);
    setSaveStatus("saved");
    setSaveError(undefined);
    setLoadError(false);
  }
  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    loadProjects()
      .then((result) => {
        if (cancelled) return;
        setProjects(result.projects);
        attach(
          result.projects.find((p) => p.id === result.activeId) ??
            result.projects[0],
        );
        setLoaded(true);
        if (result.recovered)
          notifyRef.current(
            "已恢复上次尚未完成保存的编辑；冲突内容保留为独立恢复项目",
          );
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(true);
        setSaveStatus("error");
        setLoaded(true);
        notifyRef.current(
          "无法读取本地项目，原数据未被覆盖。可导入备份或另存为新项目。",
        );
      });
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (session.current?.needsUnloadWarning) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      cancelled = true;
      alive.current = false;
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, []);
  const setWorkspace = (next: SetStateAction<Workspace>) => {
    if (!loaded || operating.current) return;
    const current = session.current?.project ?? fallback.current;
    const workspace =
      typeof next === "function" ? next(current.workspace) : next;
    if (session.current) session.current.edit(workspace);
    else {
      fallback.current = { ...current, workspace };
      setProject(fallback.current);
    }
  };
  async function operate(action: () => Promise<Project>, allowUnsaved = false) {
    if (operating.current || !loaded) return false;
    operating.current = true;
    setBusy(true);
    try {
      try {
        await session.current?.flush();
      } catch (error) {
        if (!allowUnsaved) throw error;
      }
      const next = await action();
      if (allowUnsaved) session.current?.abandon();
      const result = await loadProjects();
      setProjects(result.projects);
      attach(next);
      return true;
    } catch (error) {
      notifyRef.current(
        error instanceof Error ? error.message : "项目操作失败，当前编辑已保留",
      );
      return false;
    } finally {
      operating.current = false;
      setBusy(false);
    }
  }
  return {
    project,
    projects,
    workspace: project.workspace,
    setWorkspace,
    loaded,
    busy,
    loadError,
    saveStatus,
    saveError,
    currentId: () => (session.current?.project ?? fallback.current).id,
    switchProject: (id: string) => operate(() => selectProject(id)),
    newProject: (name: string) => operate(() => createProject(name)),
    copyProject: (name: string) =>
      operate(
        () =>
          createProject(
            name,
            (session.current?.project ?? fallback.current).workspace,
          ),
        true,
      ),
    removeProject: () => operate(() => deleteProject(session.current!.project)),
    renameProject: async (name: string) => {
      if (!session.current || operating.current) return false;
      session.current.edit(session.current.project.workspace, name);
      try {
        await session.current.flush();
        return true;
      } catch {
        return false;
      }
    },
    retrySave: () => session.current?.retry(),
    reloadProject: () =>
      operate(
        () => selectProject((session.current?.project ?? fallback.current).id),
        true,
      ),
    importWorkspace: (workspace: Workspace) =>
      session.current
        ? (session.current.edit(workspace), Promise.resolve(true))
        : operate(() => createProject("导入的项目", workspace), true),
  };
}
