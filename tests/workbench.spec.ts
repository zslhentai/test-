import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function openEditor(page: Page) {
  const button = page.getByRole("button", { name: "编辑测试", exact: true });
  if (await button.isVisible()) await button.click();
}
async function closeEditor(page: Page) {
  const button = page.getByRole("button", { name: "关闭编辑器", exact: true });
  if (await button.isVisible()) await button.click();
}
async function imageFile(page: Page, color: string) {
  const base64 = await page.evaluate((color) => {
    const canvas = document.createElement("canvas");
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 300, 300);
    ctx.fillStyle = "white";
    ctx.font = "40px sans-serif";
    ctx.fillText("TEST", 90, 160);
    return canvas.toDataURL("image/png").split(",")[1];
  }, color);
  return {
    name: "main-image.png",
    mimeType: "image/png",
    buffer: Buffer.from(base64, "base64"),
  };
}

test.beforeEach(async ({ page }) => {
  await page.goto("./");
  await expect(page.getByText("已保存到本地", { exact: true })).toBeVisible();
});

test("reference layout, square main images and all production assets load below /test-/", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const responses: { url: string; status: number }[] = [];
  page.on("response", (response) =>
    responses.push({ url: response.url(), status: response.status() }),
  );
  await page.reload();
  await expect(page.locator(".brand")).toContainText("非官方模拟");
  await expect(page.getByTestId("test-product")).toBeVisible();
  await expect(page.getByTestId("competitor")).toHaveCount(4);
  const images = page.locator(".jd-app .product-image");
  await expect(images).toHaveCount(5);
  for (const image of await images.all()) {
    await expect(image).toHaveJSProperty("complete", true);
    expect(
      await image.evaluate((img: HTMLImageElement) => img.naturalWidth),
    ).toBeGreaterThan(0);
    const src = await image.getAttribute("src");
    expect(src).toMatch(/^\/test-\/products\/.+\.svg$/);
  }
  const row = await page.getByTestId("test-product").boundingBox();
  const image = await page
    .getByTestId("test-product")
    .locator(".product-image")
    .boundingBox();
  expect(image!.width / row!.width).toBeGreaterThan(0.31);
  expect(image!.width / row!.width).toBeLessThan(0.36);
  expect(Math.abs(image!.height - image!.width)).toBeLessThan(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  expect(responses.filter((r) => r.status >= 400)).toEqual([]);
});

test("edit product details and search scene, persist them through a refresh", async ({
  page,
}) => {
  await openEditor(page);
  await page
    .getByLabel("商品标题", { exact: false })
    .fill("测试专用 高亮防水头灯");
  await page.getByLabel("商品价格", { exact: true }).fill("39.90");
  await page.getByLabel("销量", { exact: true }).fill("12万+");
  await page.getByLabel("评价文案", { exact: true }).fill("98%好评");
  await page.getByLabel("店铺名称", { exact: true }).fill("测试户外旗舰店");
  await page
    .getByLabel("促销标签", { exact: false })
    .fill("超级补贴,明日达,限时立减8元");
  await page.getByLabel("搜索关键词", { exact: true }).fill("强光头灯");
  await closeEditor(page);
  const product = page.getByTestId("test-product");
  await expect(product.locator(".product-title")).toContainText(
    "测试专用 高亮防水头灯",
  );
  await expect(product.locator(".price")).toHaveText("¥39.90");
  await expect(product.locator(".product-sales")).toContainText("12万+");
  await expect(product.locator(".product-sales")).toContainText("98%好评");
  await expect(product.locator(".product-store")).toContainText(
    "测试户外旗舰店",
  );
  await expect(product.locator(".promo-tags")).toContainText("限时立减8元");
  await expect(page.locator(".search-box")).toContainText("强光头灯");
  await expect(page.getByText("已保存到本地", { exact: true })).toBeVisible();
  await page.reload();
  await expect(product.locator(".product-title")).toContainText(
    "测试专用 高亮防水头灯",
  );
  await expect(product.locator(".price")).toHaveText("¥39.90");
  await expect(page.locator(".search-box")).toContainText("强光头灯");
});

test("upload four images, switch with controls and keyboard, persist uploaded images", async ({
  page,
}) => {
  await openEditor(page);
  const sources: Record<string, string> = {};
  for (const [index, variant] of ["A", "B", "C", "D"].entries()) {
    const file = await imageFile(
      page,
      ["#e9303c", "#3355dd", "#22aa77", "#aa44cc"][index],
    );
    await page.getByTestId(`upload-${variant}`).setInputFiles(file);
    const image = page.getByTestId("test-product").locator(".product-image");
    await expect(image).toHaveAttribute("src", /^data:image\/webp;base64,/);
    await expect(
      page.getByRole("button", { name: `预览方案 ${variant}`, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    sources[variant] = (await image.getAttribute("src"))!;
  }
  expect(new Set(Object.values(sources)).size).toBe(4);
  await closeEditor(page);
  for (const variant of ["A", "B", "C", "D"]) {
    await page.locator("body").click({ position: { x: 1, y: 1 } });
    await page.keyboard.press(variant.toLowerCase());
    await expect(
      page.getByTestId("test-product").locator(".product-image"),
    ).toHaveAttribute("src", sources[variant]);
  }
  await expect(page.getByText("已保存到本地", { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByTestId("test-product").locator(".product-image"),
  ).toHaveAttribute("src", sources.D);
  await openEditor(page);
  await page.getByRole("button", { name: "预览方案 B", exact: true }).click();
  await expect(
    page.getByTestId("test-product").locator(".product-image"),
  ).toHaveAttribute("src", sources.B);
});

test("move the test product without losing competitors and edit a competitor independently", async ({
  page,
}) => {
  await openEditor(page);
  const competitors = await page
    .getByTestId("competitor")
    .locator(".product-title")
    .allTextContents();
  await page
    .getByRole("combobox", { name: "测试商品位置", exact: true })
    .selectOption("4");
  await expect(page.getByTestId("test-product")).toHaveAttribute(
    "data-position",
    "4",
  );
  await expect(page.getByTestId("competitor")).toHaveCount(4);
  expect(
    await page
      .getByTestId("competitor")
      .locator(".product-title")
      .allTextContents(),
  ).toEqual(competitors);
  await page.getByRole("button", { name: "测试商品下移", exact: true }).click();
  await expect(page.getByTestId("test-product")).toHaveAttribute(
    "data-position",
    "5",
  );
  await expect(
    page.getByRole("button", { name: "测试商品下移", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("编辑对象", { exact: true })
    .selectOption("competitor-2");
  await page.getByLabel("商品标题", { exact: false }).fill("可编辑的竞品参照");
  await expect(
    page.getByTestId("competitor").nth(1).locator(".product-title"),
  ).toContainText("可编辑的竞品参照");
  await expect(
    page.getByTestId("test-product").locator(".product-title"),
  ).toContainText("小野人");
});

test("export and import a complete backup, reject invalid data, reset only after confirmation", async ({
  page,
}) => {
  await openEditor(page);
  await page.getByLabel("商品标题", { exact: false }).fill("备份方案标题");
  await page.getByRole("button", { name: "预览方案 C", exact: true }).click();
  await closeEditor(page);
  const downloadEvent = page.waitForEvent("download");
  const desktopExport = page.getByRole("button", {
    name: "导出方案",
    exact: true,
  });
  if (await desktopExport.isVisible()) await desktopExport.click();
  else await page.getByRole("button", { name: "手机导出方案" }).click();
  const download = await downloadEvent;
  const path = await download.path();
  expect(path).toBeTruthy();
  await page.getByRole("button", { name: "恢复默认方案", exact: true }).click();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(
    page.getByTestId("test-product").locator(".product-title"),
  ).toContainText("备份方案标题");
  await page.getByRole("button", { name: "恢复默认方案", exact: true }).click();
  await page.getByRole("button", { name: "恢复默认", exact: true }).click();
  await expect(
    page.getByTestId("test-product").locator(".product-title"),
  ).toContainText("小野人");
  await page.getByTestId("import-plan").setInputFiles(path!);
  await expect(
    page.getByTestId("test-product").locator(".product-title"),
  ).toContainText("备份方案标题");
  await page
    .getByTestId("import-plan")
    .setInputFiles({
      name: "invalid.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"version":999}'),
    });
  await expect(page.getByRole("alert")).toContainText("方案格式不兼容");
  await expect(
    page.getByTestId("test-product").locator(".product-title"),
  ).toContainText("备份方案标题");
});

test("reject unsupported images and keep the existing main image", async ({
  page,
}) => {
  await openEditor(page);
  const image = page.getByTestId("test-product").locator(".product-image");
  const original = await image.getAttribute("src");
  await page
    .getByTestId("upload-A")
    .setInputFiles({
      name: "invalid.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from("<svg></svg>"),
    });
  await expect(page.getByRole("alert")).toContainText(
    "请选择 JPG、PNG 或 WebP 图片",
  );
  await expect(image).toHaveAttribute("src", original!);
});
