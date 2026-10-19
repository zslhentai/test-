import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { editor, imageFile, ready } from "./helpers";

test("downloaded PNG contains the scrolled phone screen at 3x resolution, including the uploaded main image", async ({
  page,
}) => {
  await ready(page);
  await editor(page);
  await page
    .getByTestId("upload-A")
    .setInputFiles(await imageFile(page, "#e93090"));
  await expect(page.getByTestId("test-product").locator("img")).toHaveAttribute(
    "src",
    /^data:/,
  );
  await editor(page, false);
  await page.locator(".phone-scroll").evaluate((el) => {
    el.scrollTop = 55;
  });
  const preview = page.getByTestId("phone-preview");
  const wide = page.getByRole("button", { name: "430像素手机预览" });
  if (await wide.isVisible()) {
    await wide.click();
    await expect(preview).toHaveCSS("width", "430px");
  }
  const bounds = (await preview.boundingBox())!;
  const reference = await preview.screenshot({ scale: "css" });
  const download = page.waitForEvent("download");
  const mobileButton = page.getByRole("button", { name: "手机导出截图 PNG" });
  if (await mobileButton.isVisible()) await mobileButton.click();
  else
    await page
      .getByRole("button", { name: "导出手机截图 PNG", exact: false })
      .click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/手机预览\.png$/);
  const png = await readFile((await file.path())!);
  await test
    .info()
    .attach("phone-preview-3x.png", { body: png, contentType: "image/png" });
  expect(png.subarray(0, 8)).toEqual(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  );
  expect(png.readUInt32BE(16)).toBe(Math.round(bounds.width) * 3);
  expect(png.readUInt32BE(20)).toBe(Math.round(bounds.height) * 3);
  // Compare the actual exported bitmap with a real browser screenshot, not a mocked download.
  const meanError = await page.evaluate(
    async ({ exported, reference, width, height }) => {
      async function decode(data: string) {
        const image = new Image();
        image.src = `data:image/png;base64,${data}`;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(image, 0, 0, width, height);
        return ctx.getImageData(0, 0, width, height).data;
      }
      const a = await decode(exported),
        b = await decode(reference);
      let total = 0,
        samples = 0;
      // Exclude rounded device corners; exported PNG intentionally uses a full rectangular screen.
      for (let y = 40; y < height - 20; y += 2)
        for (let x = 4; x < width - 4; x += 2)
          for (let channel = 0; channel < 3; channel++) {
            const i = (y * width + x) * 4 + channel;
            total += Math.abs(a[i] - b[i]);
            samples++;
          }
      return total / samples;
    },
    {
      exported: png.toString("base64"),
      reference: reference.toString("base64"),
      width: Math.round(bounds.width),
      height: Math.round(bounds.height),
    },
  );
  expect(meanError).toBeLessThan(15);
  await expect(page.getByRole("alert")).toContainText("3 倍清晰度 PNG");
  await expect(page.locator(".phone-scroll")).toHaveJSProperty("scrollTop", 55);
});
