import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

export type ProjectAction = "new" | "rename" | "copy" | "delete";
export default function ProjectDialog({
  action,
  name,
  onCancel,
  onConfirm,
}: {
  action: ProjectAction;
  name: string;
  onCancel: () => void;
  onConfirm: (name: string) => Promise<boolean>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState(name),
    [busy, setBusy] = useState(false);
  const titles = {
    new: "新建测试项目",
    rename: "重命名项目",
    copy: "复制测试项目",
    delete: "删除测试项目？",
  };
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || (action !== "delete" && !value.trim())) return;
    setBusy(true);
    try {
      if (await onConfirm(value.trim())) onCancel();
    } finally {
      setBusy(false);
    }
  };
  return (
    <dialog
      ref={ref}
      className="project-dialog reset-dialog"
      aria-labelledby="project-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <form onSubmit={(event) => void submit(event)}>
        <h2 id="project-dialog-title">{titles[action]}</h2>
        {action === "delete" ? (
          <p>
            将删除“{name}
            ”及其四张主图、商品和竞品配置。此操作无法撤销，建议先导出方案备份。其他项目不受影响。
          </p>
        ) : (
          <label className="field">
            <span className="field-label">项目名称</span>
            <input
              aria-label="项目名称"
              autoFocus
              maxLength={40}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              disabled={busy}
              required
            />
          </label>
        )}
        <div className="dialog-actions">
          <button type="button" onClick={onCancel} disabled={busy}>
            取消
          </button>
          <button
            type="submit"
            className="danger-button"
            disabled={busy || (action !== "delete" && !value.trim())}
          >
            {busy ? "处理中…" : action === "delete" ? "确认删除" : "确定"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
