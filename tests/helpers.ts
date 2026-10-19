import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

export async function ready(page: Page) {
  await page.goto("./");
  await expect(page.getByText("已保存到本地", { exact: true })).toBeVisible();
}
export async function editor(page: Page, open = true) {
  const button = page.getByRole("button", {
    name: open ? "编辑测试" : "关闭编辑器",
    exact: true,
  });
  if (await button.isVisible()) await button.click();
}
export async function projectAction(
  page: Page,
  action: "新建" | "命名" | "复制",
  name: string,
) {
  await page.getByRole("button", { name: action, exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("项目名称").fill(name);
  await dialog.getByRole("button", { name: "确定", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "当前项目" }).locator("option:checked"),
  ).toHaveText(name);
}
export async function imageFile(page: Page, color: string) {
  const data = await page.evaluate((color) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 300;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 300, 300);
    return canvas.toDataURL("image/png").split(",")[1];
  }, color);
  return {
    name: "image.png",
    mimeType: "image/png",
    buffer: Buffer.from(data, "base64"),
  };
}
export async function storedProjects(page: Page) {
  return page.evaluate(
    () =>
      new Promise<
        {
          id: string;
          name: string;
          revision: number;
          workspace: {
            test: { title: string };
            images: Record<string, string>;
          };
        }[]
      >((resolve, reject) => {
        const open = indexedDB.open("main-image-lab", 1);
        open.onsuccess = () => {
          const db = open.result,
            tx = db.transaction("workspace", "readonly");
          const request = tx
            .objectStore("workspace")
            .getAll(IDBKeyRange.bound("project:", "project:\uffff"));
          tx.oncomplete = () => {
            resolve(request.result);
            db.close();
          };
          tx.onabort = () => {
            reject(tx.error);
            db.close();
          };
        };
        open.onerror = () => reject(open.error);
      }),
  );
}
