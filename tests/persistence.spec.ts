import { expect, test } from "@playwright/test";
import { editor, projectAction, ready, storedProjects } from "./helpers";

test("an immediate refresh after typing retains the latest edit", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.getByText("已保存到本地", { exact: true })).toBeVisible();
  const mobile = page.getByRole("button", { name: "编辑测试", exact: true });
  if (await mobile.isVisible()) await mobile.click();
  await page
    .getByLabel("商品标题", { exact: false })
    .fill("刷新不能丢失的最后一次编辑");
  // Deliberately do not wait for the save badge: reproduce navigation during a pending save.
  await page.reload();
  await expect(
    page.getByTestId("test-product").locator(".product-title"),
  ).toContainText("刷新不能丢失的最后一次编辑");
});

test("queued writes stay unsaved until the real transaction commits and preserve the newest snapshot", async ({
  page,
  context,
}) => {
  await ready(page);
  await editor(page);
  const holder = await context.newPage();
  await ready(holder);
  await holder.evaluate(
    () =>
      new Promise<void>((resolve) => {
        Object.assign(window, { releaseLock: false });
        const open = indexedDB.open("main-image-lab", 1);
        open.onsuccess = () => {
          const db = open.result,
            tx = db.transaction("workspace", "readwrite"),
            store = tx.objectStore("workspace");
          const keepAlive = () => {
            const request = store.get("hold-test-lock");
            request.onsuccess = () => {
              resolve();
              if (!(window as unknown as { releaseLock: boolean }).releaseLock)
                keepAlive();
            };
          };
          tx.oncomplete = () => db.close();
          keepAlive();
        };
      }),
  );
  try {
    const title = page.getByLabel("商品标题", { exact: false });
    await title.fill("较早的编辑");
    await title.fill("最后一次编辑应当获胜");
    await page
      .getByLabel("店铺名称", { exact: true })
      .fill("独立店铺配置也要保存");
    await expect(page.getByRole("status")).toHaveText("保存中…");
    await page.reload();
  } finally {
    await holder.evaluate(() => Object.assign(window, { releaseLock: true }));
  }
  await expect(
    page.getByTestId("test-product").locator(".product-title"),
  ).toContainText("最后一次编辑应当获胜");
  await expect(
    page.getByTestId("test-product").locator(".product-store"),
  ).toContainText("独立店铺配置也要保存");
  await expect(page.getByRole("status")).toHaveText("已保存到本地");
  expect((await storedProjects(page))[0].workspace.test.title).toBe(
    "最后一次编辑应当获胜",
  );
  await holder.close();
});

test("V1.0 IndexedDB and JSON migrate without changing the legacy backup or losing uploaded images", async ({
  page,
}) => {
  await ready(page);
  const legacy = await page.evaluate(async () => {
    return new Promise<Record<string, unknown>>((resolve) => {
      const open = indexedDB.open("main-image-lab", 1);
      open.onsuccess = () => {
        const db = open.result,
          tx = db.transaction("workspace", "readwrite"),
          store = tx.objectStore("workspace");
        let legacy: Record<string, unknown>;
        const request = store.getAll(
          IDBKeyRange.bound("project:", "project:\uffff"),
        );
        request.onsuccess = () => {
          const p = request.result[0];
          legacy = p.workspace;
          p.workspace.test.title = "V1.0 原始项目";
          p.workspace.position = 4;
          p.workspace.active = "C";
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = 20;
          canvas.getContext("2d")!.fillRect(0, 0, 20, 20);
          p.workspace.images.C = canvas.toDataURL("image/png");
          for (const record of request.result)
            store.delete("project:" + record.id);
          store.delete("active-project");
          store.put(legacy, "current");
          localStorage.clear();
        };
        tx.oncomplete = () => {
          db.close();
          resolve(legacy);
        };
      };
    });
  });
  await page.reload();
  await expect(
    page.getByTestId("test-product").locator(".product-title"),
  ).toContainText("V1.0 原始项目");
  await expect(page.getByTestId("test-product")).toHaveAttribute(
    "data-position",
    "4",
  );
  await expect(page.getByTestId("test-product").locator("img")).toHaveAttribute(
    "src",
    /^data:image\/png/,
  );
  await editor(page);
  await expect(
    page.getByRole("combobox", { name: "当前项目" }).locator("option:checked"),
  ).toHaveText("默认项目");
  await projectAction(page, "新建", "兼容旧 JSON");
  await page.getByTestId("import-plan").setInputFiles({
    name: "v1.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(legacy)),
  });
  await expect(
    page.getByTestId("test-product").locator(".product-title"),
  ).toContainText("V1.0 原始项目");
  const preserved = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const open = indexedDB.open("main-image-lab", 1);
        open.onsuccess = () => {
          const db = open.result,
            tx = db.transaction("workspace", "readonly"),
            request = tx.objectStore("workspace").get("current");
          tx.oncomplete = () => {
            resolve(request.result);
            db.close();
          };
        };
      }),
  );
  expect(preserved).toEqual(legacy);
  expect(await storedProjects(page)).toHaveLength(2);
});

test("a stale tab cannot overwrite another tab, and its unsaved work can be copied safely", async ({
  page,
  context,
}) => {
  await ready(page);
  await editor(page);
  const other = await context.newPage();
  await ready(other);
  await editor(other);
  await page.getByLabel("商品标题", { exact: false }).fill("已提交的新版本");
  await expect(page.getByRole("status")).toHaveText("已保存到本地");
  await other
    .getByLabel("商品标题", { exact: false })
    .fill("另一个标签页的独立修改");
  await expect(other.getByRole("status")).toHaveText("未能保存");
  await expect(other.locator(".save-recovery")).toContainText("其他页面修改");
  expect((await storedProjects(page))[0].workspace.test.title).toBe(
    "已提交的新版本",
  );
  await other
    .getByRole("button", { name: "另存为新项目", exact: true })
    .click();
  await other.getByRole("dialog").getByLabel("项目名称").fill("冲突保留副本");
  await other
    .getByRole("dialog")
    .getByRole("button", { name: "确定", exact: true })
    .click();
  await expect(other.getByRole("dialog")).not.toBeVisible();
  const projects = await storedProjects(other);
  expect(
    projects.find((p) => p.name === "冲突保留副本")?.workspace.test.title,
  ).toBe("另一个标签页的独立修改");
  expect(
    projects.find((p) => p.name === "默认项目")?.workspace.test.title,
  ).toBe("已提交的新版本");
  await other.close();
});

test("failed storage never claims success; retry commits and refresh can recover the journal", async ({
  page,
}) => {
  await ready(page);
  await editor(page);
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    Object.assign(window, {
      restorePut: () => {
        IDBObjectStore.prototype.put = put;
      },
    });
    IDBObjectStore.prototype.put = function (value, key) {
      if (String(key).startsWith("project:"))
        throw new DOMException("模拟空间不足", "QuotaExceededError");
      return put.call(this, value, key!);
    };
  });
  await page
    .getByLabel("商品标题", { exact: false })
    .fill("存储失败也要保留的编辑");
  await expect(page.getByRole("status")).toHaveText("未能保存");
  expect((await storedProjects(page))[0].workspace.test.title).not.toBe(
    "存储失败也要保留的编辑",
  );
  await page.evaluate(() =>
    (window as unknown as { restorePut: () => void }).restorePut(),
  );
  await page.getByRole("button", { name: "重试保存", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("已保存到本地");
  expect((await storedProjects(page))[0].workspace.test.title).toBe(
    "存储失败也要保留的编辑",
  );
  // Simulate a page disappearing before an outstanding write reached IndexedDB.
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      if (String(key).startsWith("project:"))
        throw new DOMException("模拟事务中断", "AbortError");
      return put.call(this, value, key!);
    };
  });
  await page
    .getByLabel("商品标题", { exact: false })
    .fill("重新打开后从日志恢复");
  await expect(page.getByRole("status")).toHaveText("未能保存");
  page.on("dialog", (dialog) => void dialog.accept());
  await page.reload();
  await expect(page.getByRole("status")).toHaveText("已保存到本地");
  await expect(
    page.getByTestId("test-product").locator(".product-title"),
  ).toContainText("重新打开后从日志恢复");
});
