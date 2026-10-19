import { parseWorkspace } from "./model";
import type { Workspace } from "./model";

const DATABASE = "main-image-lab";
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("workspace");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("本地数据库暂时被占用"));
  });
}
export async function readWorkspace(): Promise<Workspace | null> {
  const db = await openDatabase();
  try {
    const data = await new Promise<unknown>((resolve, reject) => {
      const request = db
        .transaction("workspace", "readonly")
        .objectStore("workspace")
        .get("current");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return data ? parseWorkspace(data) : null;
  } finally {
    db.close();
  }
}
export async function saveWorkspace(value: Workspace): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("workspace", "readwrite");
      transaction.objectStore("workspace").put(value, "current");
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}
