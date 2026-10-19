# 主图实验室

React + TypeScript + Vite 实现的京东 App 搜索结果页主图模拟工具。根据参考截图还原横向商品行、方形主图、搜索栏、补贴价格、促销标签和店铺信息；不是京东官方产品，不提供交易、真实搜索排序或点击率预测。

**线上访问：<https://zslhentai.github.io/test-/>**

## V1.1

- **本地多项目**：在原设置面板顶部新建、命名、切换、复制和删除项目。每个项目独立保存四张主图、商品信息、竞品和位置。删除需要确认；删除最后一个项目后会建立一个新的默认示例项目。
- **手机截图 PNG**：点击设置面板的“导出手机截图 PNG”，或手机底栏的相机按钮。导出当前可见的手机屏幕，保留列表滚动位置，分辨率为预览尺寸的 3 倍；不含编辑面板、工作台、手机外框。截图在当前浏览器生成。
- **保存保护**：串行提交 IndexedDB 事务，排队时合并为最新编辑，只有事务提交后才显示“已保存”。提交前使用本地恢复日志保护刷新；项目切换、复制和删除会先等待当前保存完成。
- **冲突与错误恢复**：另一个标签页修改了同一项目时，旧页面不会覆盖新版本。可导出当前编辑、另存为新项目，或确认后重新载入。临时保存失败支持重试。重新打开时可恢复日志；发生修订冲突的内容保留为独立恢复项目。
- **V1.0 兼容**：已有 IndexedDB `workspace/current` 自动迁移为“默认项目”，原始记录保留不变。继续使用 `version: 1` 的 JSON 方案格式；导出当前项目内容，文件名包含项目名。导入替换当前项目的内容，不改变项目名称或其他项目。整个项目库需要逐个导出备份。

恢复日志受浏览器 localStorage 容量限制。大图超过日志容量或浏览器禁用此存储时，IndexedDB 仍会正常保存，但未提交前离开页面会提示等待；保存失败也会提示。浏览器清理、强制关闭、存储驱逐等情况无法提供绝对的数据保证，重要方案请定期导出。

## 使用

- 上传 A / B / C / D 四版主图，点击缩略图、预览下方的按钮，或按键盘 A–D 快速切换；输入文字时快捷键不会生效。
- 支持 JPG、PNG、WebP，单张最大 15 MB。图片在浏览器中缩放至最长边 1200 像素并转为 WebP，不发送到服务器。
- 编辑标题、推荐文案、价格、划线价、销量、评价、店铺、促销标签、自营标识及补贴价格条。促销标签使用逗号分隔。
- 把测试商品放到第 1–5 位，四个竞品始终保留。通过“编辑对象”或点击预览中的商品，单独编辑竞品文字或上传竞品图。
- PC 端可选择 390 / 430 像素手机模拟及专注预览；手机端直接适应屏幕宽度，点击底部“编辑测试”打开设置。
- IndexedDB 自动保存图片和文字，刷新后恢复。“导出方案 / 导入已保存的方案”可迁移完整 JSON 备份。数据属于当前浏览器和网站域名；清理站点数据或使用隐私模式可能丢失，请导出重要方案。
- 内置的五张商品图是本地 SVG 示意素材，未使用整张截图背景，不能视为原图的像素级复刻。可上传实际主图进行更接近参考的视觉测试。

## 本地开发

使用 Node.js 24（见 `.nvmrc`），依赖版本由 `package-lock.json` 锁定。

```sh
npm ci
npm run dev
```

Vite 的 `base` 固定为 `/test-/`，本地访问终端提示的 `/test-/` 路径。

```sh
npm run typecheck
npm run build
npm run preview
```

应用没有后端、密钥、付费 API、远程图片或外部字体依赖。内置资源使用 `import.meta.env.BASE_URL`，入口图标使用 `%BASE_URL%`，上传图使用本地 data URL，兼容 GitHub Pages 的仓库子路径。

## 测试

测试运行在生产构建上，覆盖桌面 Chromium 和手机视口下的资源加载、方形图片比例、四图上传切换、字段编辑、位置调整、竞品编辑、本地持久化、备份恢复及无效输入。V1.1 增加立即刷新、真实 IndexedDB 事务阻塞、排队保存、多标签页修订冲突、写入失败与恢复日志、V1.0 数据及 JSON 兼容、多项目独立性、异步上传串图保护、PNG 下载尺寸与实际画面对比等回归检查。手机视口测试不等于真实 iOS Safari 设备测试。

```sh
npm run build
npx playwright install --with-deps chromium
npm test
```

已有系统 Chromium 时可复用（无需重新下载浏览器）：

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm test
```

失败时的截图、trace 和 HTML 报告位于忽略的 `test-results/`、`playwright-report/`。可以使用 `npx playwright show-report` 查看。

## GitHub Pages 自动部署

`.github/workflows/deploy.yml` 在每次推送到 `main` 时自动执行：

1. Node.js 24 + `npm ci` 安装锁定依赖。
2. TypeScript 检查和 Vite 生产构建。
3. 在桌面和手机视口运行 Playwright 功能测试。
4. 仅在构建和测试成功后上传 `dist` 并使用 GitHub Pages 官方 Actions 部署。

Pull Request 只运行构建与测试，不部署。也支持在 GitHub Actions 页面手动运行。部署权限仅授予部署 job 的 `pages: write` 和 `id-token: write`，无需个人访问令牌。

仓库 **Settings → Pages → Source** 应为 **GitHub Actions**。正式网址是 <https://zslhentai.github.io/test-/>；如仓库名称更改，需要同步修改 `vite.config.ts` 的 `base`。本项目没有客户端路由，子路径无需额外 404 回退。
