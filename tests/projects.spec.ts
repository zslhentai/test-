import { expect, test } from "@playwright/test";
import {
  editor,
  imageFile,
  projectAction,
  ready,
  storedProjects,
} from "./helpers";

test.beforeEach(async ({ page }) => ready(page));

test("project IDs also work when the browser does not expose randomUUID", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(crypto, "randomUUID", { value: undefined }),
  );
  await page.reload();
  await expect(page.getByRole("status")).toHaveText("已保存到本地");
  await editor(page);
  await projectAction(page, "新建", "兼容手机浏览器");
  const id = await page
    .getByRole("combobox", { name: "当前项目" })
    .inputValue();
  expect(id).toMatch(/^[a-f0-9]{32}$/);
  await page
    .getByLabel("商品标题", { exact: false })
    .fill("兼容环境中的正常编辑");
  await expect(page.getByRole("status")).toHaveText("已保存到本地");
  await page.reload();
  await expect(
    page.getByTestId("test-product").locator(".product-title"),
  ).toContainText("兼容环境中的正常编辑");
});

test("create, name, switch, copy and delete independent projects with their images and competitors", async ({
  page,
}) => {
  await editor(page);
  const title = page.getByLabel("商品标题", { exact: false });
  const select = page.getByRole("combobox", { name: "当前项目" });
  const firstId = await select.inputValue();
  await title.fill("头灯原项目");
  await page
    .getByRole("combobox", { name: "测试商品位置", exact: true })
    .selectOption("3");
  await page
    .getByLabel("编辑对象", { exact: true })
    .selectOption("competitor-1");
  await title.fill("自定义参照竞品");
  await page.getByLabel("编辑对象", { exact: true }).selectOption("test");
  const sources: Record<string, string> = {};
  for (const [index, variant] of ["A", "B", "C", "D"].entries()) {
    await page
      .getByTestId(`upload-${variant}`)
      .setInputFiles(
        await imageFile(page, ["red", "blue", "green", "purple"][index]),
      );
    await expect(
      page.getByRole("button", { name: `预览方案 ${variant}`, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    sources[variant] = (await page
      .getByTestId("test-product")
      .locator("img")
      .getAttribute("src"))!;
  }
  await projectAction(page, "命名", "头灯对比项目");
  await projectAction(page, "复制", "头灯副本");
  const copyId = await select.inputValue();
  expect(copyId).not.toBe(firstId);
  await expect(title).toHaveValue("头灯原项目");
  await expect(page.getByTestId("test-product")).toHaveAttribute(
    "data-position",
    "3",
  );
  await expect(page.getByTestId("competitor").first()).toContainText(
    "自定义参照竞品",
  );
  await expect(page.getByTestId("test-product").locator("img")).toHaveAttribute(
    "src",
    sources.D,
  );
  await title.fill("副本的独立编辑");
  await page
    .getByTestId("upload-D")
    .setInputFiles(await imageFile(page, "orange"));
  await expect(
    page.getByTestId("test-product").locator("img"),
  ).not.toHaveAttribute("src", sources.D);
  await select.selectOption(firstId);
  await expect(title).toHaveValue("头灯原项目");
  for (const variant of ["A", "B", "C", "D"]) {
    await page
      .getByRole("button", { name: `预览方案 ${variant}`, exact: true })
      .click();
    await expect(
      page.getByTestId("test-product").locator("img"),
    ).toHaveAttribute("src", sources[variant]);
  }
  await projectAction(page, "新建", "新品实验");
  await expect(title).toHaveValue("小野人轻便头戴式照明强光头灯");
  await expect(page.getByTestId("test-product").locator("img")).toHaveAttribute(
    "src",
    "/test-/products/outdoor.svg",
  );
  await select.selectOption(copyId);
  await expect(title).toHaveValue("副本的独立编辑");
  await page.getByRole("button", { name: "删除当前项目" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "取消", exact: true })
    .click();
  await expect(select.locator("option")).toHaveCount(3);
  await page.getByRole("button", { name: "删除当前项目" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "确认删除" })
    .click();
  await expect(select.locator("option")).toHaveCount(2);
  await expect(select.locator("option")).not.toContainText(["头灯副本"]);
  await select.selectOption(firstId);
  await page.reload();
  await editor(page);
  await expect(select.locator("option:checked")).toHaveText("头灯对比项目");
  await expect(title).toHaveValue("头灯原项目");
});

test("deleting the last project creates a fresh project and does not resurrect deleted data", async ({
  page,
}) => {
  await editor(page);
  await page.getByLabel("商品标题", { exact: false }).fill("需要删除的内容");
  await page.getByRole("button", { name: "删除当前项目" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "确认删除" })
    .click();
  await expect(
    page.getByRole("combobox", { name: "当前项目" }).locator("option"),
  ).toHaveCount(1);
  await page.reload();
  await expect(
    page.getByTestId("test-product").locator(".product-title"),
  ).not.toContainText("需要删除的内容");
  expect(await storedProjects(page)).toHaveLength(1);
});

test("price can be cleared and typed normally, and uploading a corrupt file preserves the previous image", async ({
  page,
}) => {
  await editor(page);
  const price = page.getByLabel("商品价格", { exact: true });
  await price.fill("");
  await expect(price).toHaveValue("");
  await price.pressSequentially("19.90");
  await expect(price).toHaveValue("19.90");
  await expect(page.getByTestId("test-product").locator(".price")).toHaveText(
    "¥19.90",
  );
  const image = page.getByTestId("test-product").locator(".product-image"),
    source = await image.getAttribute("src");
  await page.getByTestId("upload-A").setInputFiles({
    name: "broken.png",
    mimeType: "image/png",
    buffer: Buffer.from("broken image"),
  });
  await expect(page.getByRole("alert")).toContainText("图片内容损坏");
  await expect(image).toHaveAttribute("src", source!);
  await editor(page, false);
  await page.locator("body").click({ position: { x: 1, y: 1 } });
  await page.keyboard.press("b");
  await expect(image).toHaveAttribute("src", "/test-/products/sunset.svg");
});

test("an image still processing cannot overwrite a different project or a reset", async ({
  page,
}) => {
  await editor(page);
  const file = await imageFile(page, "red");
  await page.evaluate(() => {
    const decode = HTMLImageElement.prototype.decode;
    Object.assign(window, { releaseImage: null });
    HTMLImageElement.prototype.decode = function () {
      if (!this.src.startsWith("blob:")) return decode.call(this);
      return new Promise<void>((resolve) => {
        Object.assign(window, {
          releaseImage: () => {
            void decode.call(this).then(resolve);
          },
        });
      });
    };
  });
  await page.getByTestId("upload-A").setInputFiles(file);
  await expect(
    page.getByRole("button", { name: "上传方案 A 主图" }),
  ).toBeDisabled();
  await projectAction(page, "新建", "新项目不能串图");
  await page.evaluate(() =>
    (window as unknown as { releaseImage: () => void }).releaseImage(),
  );
  await expect(page.getByRole("alert")).toContainText("未覆盖当前图片");
  await expect(page.getByTestId("test-product").locator("img")).toHaveAttribute(
    "src",
    "/test-/products/outdoor.svg",
  );
  await page.getByTestId("upload-B").setInputFiles(file);
  await editor(page, false);
  await page.getByRole("button", { name: "恢复默认方案", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "恢复默认", exact: true })
    .click();
  await page.evaluate(() =>
    (window as unknown as { releaseImage: () => void }).releaseImage(),
  );
  await expect(page.getByRole("alert")).toContainText("未覆盖当前图片");
  await expect(page.getByTestId("test-product").locator("img")).toHaveAttribute(
    "src",
    "/test-/products/outdoor.svg",
  );
});
