import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties, ReactNode, RefObject } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BatteryFull,
  Camera,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Download,
  Expand,
  ImagePlus,
  LayoutGrid,
  Maximize2,
  Monitor,
  Plus,
  RotateCcw,
  ScanLine,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Upload,
  Wifi,
  X,
  Zap,
} from "lucide-react";
import {
  createWorkspace,
  listProducts,
  parseWorkspace,
  processImage,
  VARIANTS,
} from "./model";
import type { Product, Variant, Workspace } from "./model";
import { readWorkspace, saveWorkspace } from "./storage";

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {hint && <small>{hint}</small>}
      </span>
      {children}
    </label>
  );
}

function UploadSlot({
  variant,
  source,
  active,
  fit,
  onSelect,
  onUpload,
  notify,
}: {
  variant: Variant;
  source: string;
  active: boolean;
  fit: "cover" | "contain";
  onSelect: () => void;
  onUpload: (file: File) => Promise<void>;
  notify: (message: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      await onUpload(file);
    } catch (error) {
      notify(error instanceof Error ? error.message : "图片上传失败，请重试");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  return (
    <div
      className={`upload-slot ${active ? "active" : ""} ${dragging ? "dragging" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        void upload(event.dataTransfer.files[0]);
      }}
    >
      <button
        className="variant-image"
        onClick={onSelect}
        aria-label={`预览方案 ${variant}`}
        aria-pressed={active}
      >
        <img
          src={source}
          alt={`方案 ${variant} 商品主图`}
          style={{ objectFit: fit }}
        />
        <span className="variant-letter">{variant}</span>
        {active && (
          <span className="variant-check">
            <Check size={11} />
          </span>
        )}
      </button>
      <button
        className="replace-image"
        onClick={() => input.current?.click()}
        disabled={busy}
        aria-label={`上传方案 ${variant} 主图`}
      >
        <ImagePlus size={12} />
        {busy ? "处理中" : "替换图片"}
      </button>
      <input
        ref={input}
        data-testid={`upload-${variant}`}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(event) => void upload(event.target.files?.[0])}
      />
    </div>
  );
}

function ProductCard({
  product,
  test,
  fit,
  onEdit,
  index,
}: {
  product: Product;
  test: boolean;
  fit: "cover" | "contain";
  onEdit: () => void;
  index: number;
}) {
  const price = product.price.split(".");
  const tags = product.tags
    .split(/[,，]/)
    .map((t) => t.trim())
    .filter(Boolean);
  return (
    <article
      className={`product-row ${test ? "test-product" : ""}`}
      data-testid={test ? "test-product" : "competitor"}
      data-position={index + 1}
    >
      <button
        className="product-image-button"
        onClick={onEdit}
        aria-label={`编辑${test ? "测试商品" : product.title}`}
      >
        <img
          className="product-image"
          src={product.image}
          alt={product.title}
          style={{ objectFit: fit }}
        />
        <span className="ad-label">广告</span>
      </button>
      <div className="product-details">
        <button
          className="product-title"
          onClick={onEdit}
          title="点击编辑商品信息"
        >
          {product.selfOperated && <span className="self-badge">自营</span>}
          {product.title}
        </button>
        <div
          className={`product-subtitle ${product.subtitle.includes("热卖榜") ? "ranking" : ""}`}
        >
          {product.subtitle}
        </div>
        <div className={`price-line ${product.subsidized ? "subsidized" : ""}`}>
          {product.subsidized && <span className="subsidy-label">补贴后</span>}
          <span className="price">
            <small>¥</small>
            {price[0]}
            {price[1] && <span className="decimal">.{price[1]}</span>}
          </span>
          {!product.subsidized && product.oldPrice && (
            <>
              <span className="price-caption">到手价</span>
              <del>¥{product.oldPrice}</del>
            </>
          )}
          {!product.subsidized && !product.oldPrice && (
            <span className="price-caption">全网低价</span>
          )}
          <Plus className="cart-add" aria-hidden="true" />
        </div>
        <div className="promo-tags">
          {tags.map((tag, i) => (
            <span
              key={`${tag}-${i}`}
              className={
                tag === "超级补贴"
                  ? "tag-orange"
                  : tag === "明日达"
                    ? "tag-delivery"
                    : tag.includes("补贴")
                      ? "tag-green"
                      : tag.includes("立减")
                        ? "tag-discount"
                        : "tag-gold"
              }
            >
              {tag === "明日达" && <Zap size={10} fill="currentColor" />}
              {tag}
            </span>
          ))}
        </div>
        <div className="product-sales">
          已售 {product.sales}
          <span>{product.reviews}</span>
        </div>
        <button
          className="product-store"
          onClick={onEdit}
          title="点击编辑店铺信息"
        >
          {product.store}
          <ChevronRight size={12} />
        </button>
      </div>
    </article>
  );
}

function PhonePreview({
  workspace,
  onEdit,
  scrollRef,
}: {
  workspace: Workspace;
  onEdit: (id: string) => void;
  scrollRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="jd-app" data-testid="phone-preview">
      <div className="status-bar" aria-hidden="true">
        <b>16:39</b>
        <div className="dynamic-island">
          <span className="island-dot" />
        </div>
        <div className="status-icons">
          <Wifi size={16} strokeWidth={3} />
          <span className="battery">
            22
            <BatteryFull size={26} />
          </span>
        </div>
      </div>
      <div className="search-header">
        <ArrowLeft className="jd-back" aria-hidden="true" />
        <div className="search-box">
          <span>
            {workspace.keyword || "头灯"}
            <X size={11} />
          </span>
          <div className="ai-camera">
            <Camera size={21} />
            <small>AI</small>
          </div>
        </div>
        <LayoutGrid size={22} className="jd-grid" aria-hidden="true" />
      </div>
      <div className="sort-peek" aria-hidden="true">
        <span>综合</span>
        <span>销量</span>
        <span>价格</span>
        <span>筛选</span>
      </div>
      <div className="jd-filters" aria-label="参考场景筛选标签">
        <span>京东物流</span>
        <span>明日达</span>
        <span className="national">国家补贴</span>
        <span className="super">
          超级<span>补</span>贴
        </span>
        <span>
          品牌
          <ChevronDown size={12} />
        </span>
      </div>
      <div className="phone-scroll" ref={scrollRef}>
        <div className="ad-peek" aria-hidden="true">
          <span>
            精选 <b>好物推荐</b> 超值购
          </span>
          <span>
            精选 <b>官方直降</b> 商品
          </span>
        </div>
        {listProducts(workspace).map((product, index) => (
          <ProductCard
            key={product.id}
            product={product}
            test={product.id === "test"}
            fit={workspace.imageFit}
            onEdit={() => onEdit(product.id)}
            index={index}
          />
        ))}
        <div className="list-end">仅供视觉模拟 · 无真实交易功能</div>
      </div>
      <div className="jd-floating" aria-hidden="true">
        <span className="jd-service">问京言</span>
        <span>
          <ShoppingCart size={22} />
          <i>93</i>
        </span>
        <span>
          <ClipboardList size={23} />
        </span>
      </div>
      <div className="home-indicator" aria-hidden="true" />
    </div>
  );
}

export default function App() {
  const [workspace, setWorkspace] = useState<Workspace>(createWorkspace);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saving" | "saved" | "error">(
    "saving",
  );
  const [toast, setToast] = useState("");
  const [selected, setSelected] = useState("test");
  const [mobileEditor, setMobileEditor] = useState(false);
  const [width, setWidth] = useState(390);
  const [focused, setFocused] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const storageReady = useRef(false);

  useEffect(() => {
    let live = true;
    readWorkspace()
      .then((data) => {
        if (live) {
          if (data) setWorkspace(data);
          storageReady.current = true;
          setLoaded(true);
        }
      })
      .catch(() => {
        if (live) {
          setLoadError(true);
          setSaveStatus("error");
          setToast(
            "无法读取本地方案。为保护已有数据，暂不自动覆盖；可导入备份或重置。",
          );
          setLoaded(true);
        }
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (!loaded || !storageReady.current) return;
    let current = true;
    setSaveStatus("saving");
    const timer = window.setTimeout(() => {
      saveWorkspace(workspace)
        .then(() => {
          if (current) setSaveStatus("saved");
        })
        .catch(() => {
          if (current) {
            setSaveStatus("error");
            setToast("本地保存失败，请导出方案备份，并检查浏览器存储空间。");
          }
        });
    }, 250);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [workspace, loaded]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 6500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        target.closest("input,textarea,select,[contenteditable]") ||
        !loaded
      )
        return;
      const variant = event.key.toUpperCase() as Variant;
      if (VARIANTS.includes(variant))
        setWorkspace((value) => ({ ...value, active: variant }));
      if (event.key === "Escape") {
        setMobileEditor(false);
        setFocused(false);
        setResetOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loaded]);

  const update = (patch: Partial<Workspace>) =>
    setWorkspace((value) => ({ ...value, ...patch }));
  const edited =
    selected === "test"
      ? workspace.test
      : workspace.competitors.find((p) => p.id === selected)!;
  const updateProduct = (patch: Partial<Product>) =>
    setWorkspace((value) =>
      selected === "test"
        ? { ...value, test: { ...value.test, ...patch } }
        : {
            ...value,
            competitors: value.competitors.map((p) =>
              p.id === selected ? { ...p, ...patch } : p,
            ),
          },
    );
  const editProduct = (id: string) => {
    setSelected(id);
    setMobileEditor(true);
    setFocused(false);
  };
  const goToTest = () =>
    scrollRef.current
      ?.querySelector('[data-testid="test-product"]')
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  const exportPlan = () => {
    const blob = new Blob([JSON.stringify(workspace, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `主图实验室-方案${workspace.active}-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setToast("方案已导出，包含四张主图和全部商品信息");
  };
  const importPlan = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 40 * 1024 * 1024)
        throw new Error("方案文件不能超过 40 MB");
      const data = parseWorkspace(JSON.parse(await file.text()));
      storageReady.current = true;
      setLoadError(false);
      setWorkspace(data);
      setSelected("test");
      setToast("方案已恢复");
    } catch (error) {
      setToast(
        error instanceof Error ? error.message : "导入失败，请检查方案文件",
      );
    } finally {
      event.target.value = "";
    }
  };
  const selectVariant = (active: Variant) => update({ active });
  const priceInput = (key: "price" | "oldPrice", value: string) => {
    if (/^\d{1,7}(\.\d{0,2})?$/.test(value)) updateProduct({ [key]: value });
    else if (!value) updateProduct({ [key]: key === "price" ? "0" : "" });
  };

  return (
    <div className={`app ${focused ? "focus-mode" : ""}`}>
      <header className="app-header">
        <a
          className="brand"
          href={import.meta.env.BASE_URL}
          aria-label="主图实验室首页"
        >
          <span className="brand-mark">
            <ScanLine size={23} />
          </span>
          <span>
            主图实验室<small>IMAGE LAB · 非官方模拟</small>
          </span>
          <span className="beta">BETA</span>
        </a>
        <div className="header-center">
          <span className="workspace-dot" />
          京东搜索场景
          <span className="header-divider" />
          非官方模拟工具
        </div>
        <div className="header-actions">
          <span className={`save-state ${saveStatus}`} role="status">
            {saveStatus === "saved" ? (
              <CheckCheck size={14} />
            ) : (
              <span className="state-dot" />
            )}
            {saveStatus === "saved"
              ? "已保存到本地"
              : saveStatus === "error"
                ? "未能保存"
                : "保存中…"}
          </span>
          <button
            className="icon-button"
            title="恢复默认方案"
            aria-label="恢复默认方案"
            onClick={() => setResetOpen(true)}
          >
            <RotateCcw size={16} />
          </button>
          <button
            className="export-button"
            onClick={exportPlan}
            disabled={!loaded}
          >
            <Download size={15} />
            <span>导出方案</span>
          </button>
        </div>
      </header>

      <main className="workspace">
        <div className="page-intro">
          <div>
            <div className="breadcrumb">
              工作台 <ChevronRight size={12} /> 搜索场景模拟
            </div>
            <h1>
              放进搜索页，看见主图的竞争力<span className="intro-dot">.</span>
            </h1>
            <p>在同一场景中快速对比，让每一次主图选择更有依据。</p>
          </div>
          <div className="local-note">
            <ShieldCheck size={18} />
            <span>
              图片仅保存在当前浏览器<small>无需登录 · 无上传服务器</small>
            </span>
          </div>
        </div>

        <div className="workbench">
          {mobileEditor && (
            <button
              className="editor-backdrop"
              aria-label="关闭编辑面板"
              onClick={() => setMobileEditor(false)}
            />
          )}
          <aside
            className={`editor-panel ${mobileEditor ? "mobile-open" : ""}`}
            aria-label="测试方案编辑器"
          >
            <div className="panel-heading">
              <div>
                <Settings2 size={16} />
                <strong>方案设置</strong>
              </div>
              <span className="live-label">
                <i />
                实时生效
              </span>
              <button
                className="mobile-close icon-button"
                onClick={() => setMobileEditor(false)}
                aria-label="关闭编辑器"
              >
                <X size={18} />
              </button>
            </div>
            <fieldset className="editor-body" disabled={!loaded}>
              {loadError && (
                <div className="storage-warning">
                  本地数据读取失败，自动保存已暂停。请先导出当前方案，或导入有效备份。
                </div>
              )}
              <section className="editor-section">
                <div className="section-heading">
                  <span className="step-number">01</span>
                  <h2>测试主图</h2>
                  <span className="section-meta">A/B/C/D 对比</span>
                </div>
                <p className="section-description">
                  点击切换方案，拖入或替换你自己的商品主图。
                </p>
                <div className="upload-grid">
                  {VARIANTS.map((variant) => (
                    <UploadSlot
                      key={variant}
                      variant={variant}
                      source={workspace.images[variant]}
                      active={workspace.active === variant}
                      fit={workspace.imageFit}
                      onSelect={() => selectVariant(variant)}
                      notify={setToast}
                      onUpload={async (file) => {
                        const image = await processImage(file);
                        setWorkspace((value) => ({
                          ...value,
                          active: variant,
                          images: { ...value.images, [variant]: image },
                        }));
                        setToast(`方案 ${variant} 主图已替换`);
                      }}
                    />
                  ))}
                </div>
                <div className="upload-hint">
                  <ImagePlus size={12} />
                  <span>JPG / PNG / WebP · 最大 15 MB · 建议 1:1</span>
                </div>
                <div className="inline-setting">
                  <span>图片显示方式</span>
                  <div className="segmented small">
                    <button
                      onClick={() => update({ imageFit: "cover" })}
                      aria-pressed={workspace.imageFit === "cover"}
                      className={
                        workspace.imageFit === "cover" ? "selected" : ""
                      }
                    >
                      填满
                    </button>
                    <button
                      onClick={() => update({ imageFit: "contain" })}
                      aria-pressed={workspace.imageFit === "contain"}
                      className={
                        workspace.imageFit === "contain" ? "selected" : ""
                      }
                    >
                      完整
                    </button>
                  </div>
                </div>
              </section>

              <section className="editor-section">
                <div className="section-heading">
                  <span className="step-number">02</span>
                  <h2>商品信息</h2>
                  <span className="section-meta">即时预览</span>
                </div>
                <Field label="编辑对象">
                  <select
                    aria-label="编辑对象"
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                  >
                    <option value="test">测试商品 · 当前主角</option>
                    {workspace.competitors.map((p, i) => (
                      <option value={p.id} key={p.id}>
                        竞品 {i + 1} · {p.title.slice(0, 12)}
                      </option>
                    ))}
                  </select>
                </Field>
                {selected !== "test" && (
                  <div className="competitor-upload">
                    <span>竞品主图也可以替换</span>
                    <label className="text-upload">
                      <Upload size={12} />
                      上传图片
                      <input
                        type="file"
                        hidden
                        accept="image/jpeg,image/png,image/webp"
                        aria-label="上传竞品主图"
                        onChange={async (e) => {
                          const input = e.target,
                            file = input.files?.[0],
                            productId = selected;
                          if (!file) return;
                          try {
                            const image = await processImage(file);
                            setWorkspace((value) => ({
                              ...value,
                              competitors: value.competitors.map((p) =>
                                p.id === productId ? { ...p, image } : p,
                              ),
                            }));
                            setToast("竞品主图已替换");
                          } catch (error) {
                            setToast(
                              error instanceof Error
                                ? error.message
                                : "图片上传失败",
                            );
                          } finally {
                            input.value = "";
                          }
                        }}
                      />
                    </label>
                  </div>
                )}
                <Field label="商品标题" hint={`${edited.title.length}/80`}>
                  <textarea
                    maxLength={80}
                    rows={2}
                    value={edited.title}
                    onChange={(e) => updateProduct({ title: e.target.value })}
                  />
                </Field>
                <Field label="推荐文案">
                  <input
                    value={edited.subtitle}
                    maxLength={100}
                    onChange={(e) =>
                      updateProduct({ subtitle: e.target.value })
                    }
                  />
                </Field>
                <div className="field-row">
                  <Field label="商品价格">
                    <div className="input-with-prefix">
                      <span>¥</span>
                      <input
                        aria-label="商品价格"
                        inputMode="decimal"
                        value={edited.price}
                        onChange={(e) => priceInput("price", e.target.value)}
                      />
                    </div>
                  </Field>
                  <Field label="划线价格" hint="可选">
                    <div className="input-with-prefix">
                      <span>¥</span>
                      <input
                        aria-label="划线价格"
                        inputMode="decimal"
                        placeholder="不显示"
                        value={edited.oldPrice}
                        onChange={(e) => priceInput("oldPrice", e.target.value)}
                      />
                    </div>
                  </Field>
                </div>
                <div className="field-row">
                  <Field label="销量">
                    <input
                      value={edited.sales}
                      maxLength={20}
                      onChange={(e) => updateProduct({ sales: e.target.value })}
                    />
                  </Field>
                  <Field label="评价文案">
                    <input
                      value={edited.reviews}
                      maxLength={30}
                      onChange={(e) =>
                        updateProduct({ reviews: e.target.value })
                      }
                    />
                  </Field>
                </div>
                <Field label="店铺名称">
                  <input
                    value={edited.store}
                    maxLength={60}
                    onChange={(e) => updateProduct({ store: e.target.value })}
                  />
                </Field>
                <Field label="促销标签" hint="用逗号分隔">
                  <input
                    value={edited.tags}
                    maxLength={100}
                    onChange={(e) => updateProduct({ tags: e.target.value })}
                  />
                </Field>
                <div className="checkbox-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={edited.selfOperated}
                      onChange={(e) =>
                        updateProduct({ selfOperated: e.target.checked })
                      }
                    />
                    自营标识
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={edited.subsidized}
                      onChange={(e) =>
                        updateProduct({ subsidized: e.target.checked })
                      }
                    />
                    补贴价格条
                  </label>
                </div>
              </section>

              <section className="editor-section">
                <div className="section-heading">
                  <span className="step-number">03</span>
                  <h2>搜索场景</h2>
                </div>
                <Field label="搜索关键词">
                  <input
                    value={workspace.keyword}
                    maxLength={50}
                    onChange={(e) => update({ keyword: e.target.value })}
                  />
                </Field>
                <div className="field">
                  <span className="field-label">测试商品位置</span>
                  <div className="position-control">
                    <button
                      onClick={() =>
                        update({ position: workspace.position - 1 })
                      }
                      disabled={workspace.position === 1}
                      aria-label="测试商品上移"
                    >
                      <ArrowUp size={15} />
                    </button>
                    <select
                      aria-label="测试商品位置"
                      value={workspace.position}
                      onChange={(e) =>
                        update({ position: Number(e.target.value) })
                      }
                    >
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                          第 {n} 位
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() =>
                        update({ position: workspace.position + 1 })
                      }
                      disabled={workspace.position === 5}
                      aria-label="测试商品下移"
                    >
                      <ArrowDown size={15} />
                    </button>
                  </div>
                </div>
                <p className="setting-help">
                  改变测试商品的位置，周围四个竞品始终保留。
                </p>
                <button
                  className="import-button"
                  onClick={() => importRef.current?.click()}
                >
                  <Upload size={14} />
                  导入已保存的方案
                  <ArrowRight size={13} />
                </button>
              </section>
              <div className="editor-footnote">
                <ShieldCheck size={13} />
                本地保存 · 刷新后可继续编辑
              </div>
            </fieldset>
            <button
              className="mobile-done"
              onClick={() => setMobileEditor(false)}
            >
              <Check size={16} />
              完成，查看预览
            </button>
          </aside>

          <section className="preview-panel" aria-label="手机预览区域">
            <div className="preview-toolbar">
              <div className="preview-title">
                <span className="green-dot" />
                <strong>实时预览</strong>
                <span>方案 {workspace.active}</span>
              </div>
              <div className="preview-tools">
                <div className="segmented device-switch">
                  <button
                    className={width === 390 ? "selected" : ""}
                    onClick={() => setWidth(390)}
                    aria-label="390像素手机预览"
                  >
                    <Smartphone size={13} />
                    390
                  </button>
                  <button
                    className={width === 430 ? "selected" : ""}
                    onClick={() => setWidth(430)}
                    aria-label="430像素手机预览"
                  >
                    430
                  </button>
                </div>
                <button
                  className="icon-button focus-button"
                  aria-label={focused ? "退出专注预览" : "专注预览"}
                  title="专注预览"
                  onClick={() => setFocused(!focused)}
                >
                  <Expand size={16} />
                </button>
              </div>
            </div>
            <div className="preview-stage">
              <div className="preview-decoration">
                <span />
                场景内的第一眼，才是真实的第一眼
                <span />
              </div>
              <div
                className="phone-shell"
                style={{ "--phone-width": `${width}px` } as CSSProperties}
              >
                <PhonePreview
                  workspace={workspace}
                  onEdit={editProduct}
                  scrollRef={scrollRef}
                />
              </div>
              <div className="preview-bottom">
                <Monitor size={13} />
                <span>按原生手机比例模拟</span>
                <span className="dot-separator">·</span>
                <span>主图占行宽约 34%</span>
              </div>
            </div>
            <div className="comparison-bar">
              <span>快速对比</span>
              <div className="variant-tabs">
                {VARIANTS.map((variant) => (
                  <button
                    key={variant}
                    className={workspace.active === variant ? "active" : ""}
                    aria-pressed={workspace.active === variant}
                    aria-label={`切换到方案 ${variant}`}
                    onClick={() => selectVariant(variant)}
                  >
                    {variant}
                    {workspace.active === variant && <span>当前</span>}
                  </button>
                ))}
              </div>
              <span className="keyboard-hint">
                键盘 <kbd>A</kbd> – <kbd>D</kbd>
              </span>
            </div>
          </section>

          <aside className="context-panel" aria-label="场景说明">
            <div className="context-heading">
              <span className="small-red-line" />
              观察，而后选择
            </div>
            <h2>
              让主图回到
              <br />
              它该在的地方。
            </h2>
            <p className="context-intro">
              不孤立地看一张图。
              <br />
              放进竞品之间，感受视觉差异。
            </p>
            <div className="context-card">
              <div className="context-card-heading">
                <span>当前测试方案</span>
                <span className="red-label">{workspace.active}</span>
              </div>
              <img
                className="current-image"
                src={workspace.images[workspace.active]}
                alt="当前测试方案主图"
                style={{ objectFit: workspace.imageFit }}
              />
              <div className="current-caption">
                方案 {workspace.active}
                <span>1 : 1 展示区域</span>
              </div>
              <div className="context-separator" />
              <div className="metric">
                <span>列表位置</span>
                <b>
                  第 {workspace.position} 位 <small>/ 5</small>
                </b>
              </div>
              <button className="locate-button" onClick={goToTest}>
                定位测试商品
                <Maximize2 size={13} />
              </button>
            </div>
            <div className="tips">
              <CircleHelp size={15} />
              <div>
                <strong>小提示</strong>
                <p>点击预览中的商品图或标题，即可编辑对应商品。</p>
                <p>切换主图时，其他信息保持一致，更容易看出差别。</p>
              </div>
            </div>
            <div className="simulation-note">
              非京东官方产品
              <br />
              仅模拟视觉场景，不代表真实搜索排序、点击率或转化效果。内置主图为示意素材。
            </div>
          </aside>
        </div>
      </main>

      <footer className="app-footer">
        <span>
          主图实验室 <span> / </span> 让每一张主图，都有比较的场景。
        </span>
        <span>
          <ShieldCheck size={12} />
          无真实交易 · 无付费 API
        </span>
      </footer>
      <div className="mobile-controls">
        <button className="mobile-edit" onClick={() => setMobileEditor(true)}>
          <Settings2 size={16} />
          编辑测试
        </button>
        <div>
          {VARIANTS.map((variant) => (
            <button
              key={variant}
              className={workspace.active === variant ? "active" : ""}
              onClick={() => selectVariant(variant)}
              aria-label={`手机切换方案 ${variant}`}
            >
              {variant}
            </button>
          ))}
        </div>
        <button
          className="icon-button"
          aria-label="手机导出方案"
          onClick={exportPlan}
        >
          <Download size={19} />
        </button>
      </div>
      <input
        ref={importRef}
        hidden
        type="file"
        accept="application/json,.json"
        data-testid="import-plan"
        onChange={(event) => void importPlan(event)}
      />
      {toast && (
        <div className="toast" role="alert">
          <span>{toast}</span>
          <button onClick={() => setToast("")} aria-label="关闭提示">
            <X size={15} />
          </button>
        </div>
      )}
      {!loaded && <div className="loading-bar" aria-label="正在读取本地方案" />}
      {resetOpen && (
        <div className="dialog-backdrop" onClick={() => setResetOpen(false)}>
          <section
            className="reset-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-title"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="dialog-icon">
              <RotateCcw size={24} />
            </span>
            <h2 id="reset-title">恢复默认方案？</h2>
            <p>当前的四张主图和编辑内容将被替换。建议先导出方案留存备份。</p>
            <div>
              <button onClick={() => setResetOpen(false)} autoFocus>
                取消
              </button>
              <button
                className="danger-button"
                onClick={() => {
                  storageReady.current = true;
                  setLoadError(false);
                  setWorkspace(createWorkspace());
                  setSelected("test");
                  setResetOpen(false);
                  setToast("已恢复默认方案");
                }}
              >
                恢复默认
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
