export const VARIANTS = ["A", "B", "C", "D"] as const;
export type Variant = (typeof VARIANTS)[number];
export type Product = {
  id: string;
  title: string;
  subtitle: string;
  price: string;
  oldPrice: string;
  sales: string;
  reviews: string;
  store: string;
  tags: string;
  selfOperated: boolean;
  subsidized: boolean;
  image: string;
};
export type Workspace = {
  version: 1;
  keyword: string;
  active: Variant;
  images: Record<Variant, string>;
  imageFit: "cover" | "contain";
  position: number;
  test: Product;
  competitors: Product[];
};

const asset = (name: string) =>
  `${import.meta.env.BASE_URL}products/${name}.svg`;
export function createWorkspace(): Workspace {
  return {
    version: 1,
    keyword: "头灯",
    active: "A",
    imageFit: "cover",
    position: 1,
    images: {
      A: asset("outdoor"),
      B: asset("sunset"),
      C: asset("minimal"),
      D: asset("beam"),
    },
    test: {
      id: "test",
      title: "小野人轻便头戴式照明强光头灯",
      subtitle: "店铺被3万人种草｜近7日人气商品｜超长续航",
      price: "28",
      oldPrice: "",
      sales: "8万+",
      reviews: "95%好评",
      store: "小野人京东自营旗舰店",
      tags: "超级补贴,明日达,限时立减5元,买贵双倍赔",
      selfOperated: true,
      subsidized: true,
      image: asset("outdoor"),
    },
    competitors: [
      {
        id: "competitor-1",
        title: "轻便超长续航【变焦感应头灯-当日达】",
        subtitle: "超10万人关注店铺｜400+店铺粉丝浏览",
        price: "28",
        oldPrice: "",
        sales: "4万+",
        reviews: "95%好评",
        store: "小野人京东自营旗舰店",
        tags: "超级补贴,明日达,公益好物,限时立减7元",
        selfOperated: true,
        subsidized: true,
        image: asset("sunset"),
      },
      {
        id: "competitor-2",
        title: "warsun沃尔森感应头灯",
        subtitle: "热卖榜｜头灯榜第1名",
        price: "32.8",
        oldPrice: "",
        sales: "90万+",
        reviews: "30天加购飙升5倍",
        store: "10万人来逛 Warsun京东自营旗舰店",
        tags: "超级补贴,明日达,买贵双倍赔,支持送礼",
        selfOperated: true,
        subsidized: false,
        image: asset("minimal"),
      },
      {
        id: "competitor-3",
        title: "奥克斯 头灯强光超亮超长续航夜钓",
        subtitle: "店铺被3万人种草｜续航超持久｜1万+人已买",
        price: "55.89",
        oldPrice: "68.89",
        sales: "2万+",
        reviews: "97%好评",
        store: "奥克斯运动户外京东自营旗舰店",
        tags: "超级补贴,明日达,限时立减13元,买贵双倍赔",
        selfOperated: true,
        subsidized: false,
        image: asset("beam"),
      },
      {
        id: "competitor-4",
        title: "GREYBEE挥手感应钓鱼灯充电强光头灯",
        subtitle: "防水耐用｜100+人加购｜稳定光源不易损",
        price: "13.2",
        oldPrice: "16.9",
        sales: "100+",
        reviews: "99%好评",
        store: "GreyBee专业照明旗舰店",
        tags: "焕新补贴,限时立减3元,支持送礼,7天价保",
        selfOperated: false,
        subsidized: false,
        image: asset("night"),
      },
    ],
  };
}

function validImage(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length < 8_000_000 &&
    (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value) ||
      Object.values(createWorkspace().images).includes(value) ||
      value === asset("night"))
  );
}
export function parseWorkspace(value: unknown): Workspace {
  if (!value || typeof value !== "object") throw new Error("无效的方案文件");
  const v = value as Workspace;
  if (
    v.version !== 1 ||
    !VARIANTS.includes(v.active) ||
    typeof v.keyword !== "string" ||
    v.keyword.length > 50 ||
    !Number.isInteger(v.position) ||
    v.position < 1 ||
    v.position > 5 ||
    !["cover", "contain"].includes(v.imageFit) ||
    !v.images ||
    !VARIANTS.every((k) => validImage(v.images[k])) ||
    !Array.isArray(v.competitors) ||
    v.competitors.length !== 4
  )
    throw new Error("方案格式不兼容，请导入本工具导出的 JSON 文件");
  for (const [i, product] of [v.test, ...v.competitors].entries()) {
    if (!product || typeof product !== "object")
      throw new Error("商品信息不完整");
    for (const key of [
      "id",
      "title",
      "subtitle",
      "price",
      "oldPrice",
      "sales",
      "reviews",
      "store",
      "tags",
    ] as const) {
      if (typeof product[key] !== "string" || product[key].length > 500)
        throw new Error("商品字段格式错误");
    }
    if (
      product.id !== (i === 0 ? "test" : `competitor-${i}`) ||
      !/^\d{1,7}(\.\d{0,2})?$/.test(product.price) ||
      (product.oldPrice !== "" &&
        !/^\d{1,7}(\.\d{0,2})?$/.test(product.oldPrice)) ||
      typeof product.selfOperated !== "boolean" ||
      typeof product.subsidized !== "boolean" ||
      !validImage(product.image)
    )
      throw new Error("商品字段格式错误");
  }
  return v;
}

export function listProducts(workspace: Workspace): Product[] {
  const list = [...workspace.competitors];
  list.splice(workspace.position - 1, 0, {
    ...workspace.test,
    image: workspace.images[workspace.active],
  });
  return list;
}

export async function processImage(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("请选择 JPG、PNG 或 WebP 图片");
  if (file.size > 15 * 1024 * 1024) throw new Error("图片不能超过 15 MB");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight)
      throw new Error("图片内容无法读取");
    const scale = Math.min(
      1,
      1200 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("当前浏览器不支持图片处理");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/webp", 0.9);
  } finally {
    URL.revokeObjectURL(url);
  }
}
