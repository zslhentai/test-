import { toBlob } from "html-to-image";

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  // Give mobile browsers time to start consuming the download before releasing it.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
export function safeFilename(name: string) {
  return name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 80);
}

/** Capture only the visible phone screen, preserving the current list scroll offset. */
export async function exportPreview(node: HTMLElement): Promise<Blob> {
  const rect = node.getBoundingClientRect();
  const width = Math.round(rect.width),
    height = Math.round(rect.height);
  const scrollTop = node.querySelector(".phone-scroll")!.scrollTop;
  if (!width || !height) throw new Error("预览区域尚未准备好");
  const clone = node.cloneNode(true) as HTMLElement;
  const host = document.createElement("div");
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;height:${height}px;pointer-events:none;`;
  clone.style.cssText += `;width:${width}px;height:${height}px;max-height:none;min-height:0;border-radius:0;--phone-width:${width}px;`;
  host.append(clone);
  document.body.append(host);
  try {
    await document.fonts.ready;
    const scroll = clone.querySelector<HTMLElement>(".phone-scroll")!;
    const contents = document.createElement("div");
    contents.append(...Array.from(scroll.childNodes));
    contents.style.transform = `translateY(-${scrollTop}px)`;
    scroll.append(contents);
    scroll.style.overflow = "hidden";
    await Promise.all(
      Array.from(clone.querySelectorAll("img")).map((image) => image.decode()),
    );
    // Computed styles are embedded, including container-relative sizes, and images are inlined.
    const blob = await toBlob(clone, {
      pixelRatio: 3,
      width,
      height,
      backgroundColor: "#fff",
      fontEmbedCSS: "",
      cacheBust: false,
    });
    if (!blob || !blob.size) throw new Error("浏览器未能生成 PNG 图片");
    return blob;
  } finally {
    host.remove();
  }
}
