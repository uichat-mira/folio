---
title: 在 Typora 中自动将图片上传到 Cloudflare R2
path: /api/appendix/typora-r2
description: 从旧 MiraDocs 入口迁入的写作工具附录：粘贴图片时自动转 WebP、上传 R2 并回写 Markdown。
group: 附录 · 写作工具
order: 70
type: page
status: reference
tags:
  - Typora
  - R2
  - Writing
---

> 这不是 Folio API，而是旧 MiraDocs 入口中长期保留的写作工具指南。迁移后作为附录继续保存。

写 Markdown 时，图片通常比文字更麻烦。

直接把本地图片路径写进文章，换一台电脑就可能失效；把大量截图提交到 Git 仓库，又会让仓库越来越重；每次手工压缩、上传、复制地址，也很容易打断写作。

为了解决这个小而高频的问题，我们做了一个简单工具：[typora-r2](https://github.com/dangjingtao/typora-r2)。

它把下面这条流程接进了 Typora：

```text
粘贴图片
  → 自动纠正图片方向
  → 转换为 WebP
  → 上传到 Cloudflare R2
  → 将公开 URL 写回 Markdown
```

配置完成后，在 Typora 里粘贴一张截图，最终得到的会是类似这样的内容：

```markdown
![图片说明](https://assets.example.com/images/1784054462969-image.webp)
```

不需要手动打开 Cloudflare 控制台，也不需要自己复制图片地址。

## typora-r2 做了什么

当前版本的 `typora-r2` 是一个很小的 Node.js 命令行工具，主要完成以下工作：

- 接收一张本地图片的路径；
- 使用 Sharp 读取图片，并按照 EXIF 信息纠正方向；
- 将图片转换为 WebP；
- 使用 Cloudflare R2 的 S3 兼容接口上传文件；
- 在终端输出图片的公开访问地址；
- 配合 Typora 的自定义图片上传命令，自动替换 Markdown 中的本地地址。

默认情况下，图片会上传到 R2 Bucket 的 `images/` 目录，文件名由时间戳和原文件名组成：

```text
images/1784054462969-image-20260715024102723.webp
```

时间戳可以降低重名覆盖的风险，也适合配合长期缓存使用。

## 准备工作

开始前需要准备：

- Windows 10 或 Windows 11；
- Node.js 18 或更高版本；
- Typora；
- 一个 Cloudflare 账号；
- 一个已经创建好的 R2 Bucket；
- 一个可以公开访问 R2 对象的域名；
- 对目标 Bucket 具有对象写入权限的 R2 API Token。

本文以以下示例配置说明：

```text
Bucket：mira-docs-assets
公开域名：https://assets.example.com
工具目录：D:\tool\typora-r2
```

请把示例值替换成自己的实际配置。

## 一、创建 Cloudflare R2 Bucket

进入 Cloudflare 控制台：

```text
存储和数据库
→ R2 对象存储
→ 创建存储桶
```

建议选择：

- **位置**：自动；
- **默认存储类**：标准；
- **Bucket 名称**：使用容易识别的名称，例如 `mira-docs-assets`。

对于文档图片、截图、PDF 和其他会被持续访问的静态资源，标准存储更合适。

<!-- 建议插图：Cloudflare 创建 R2 Bucket 的设置页面 -->

## 二、配置公开访问域名

新建的 R2 Bucket 默认不允许公开访问。

进入 Bucket 的设置页面，为它绑定一个自定义域名，例如：

```text
assets.example.com
```

上传对象：

```text
images/mira-logo.webp
```

公开访问地址就会是：

```text
https://assets.example.com/images/mira-logo.webp
```

建议先手工上传一张测试图片，确认自定义域名可以正常打开，再继续配置上传工具。

<!-- 建议插图：R2 自定义域名已经启用 -->

## 三、创建 R2 API Token

进入 R2 的 API Token 管理页面，创建一个只用于图片上传的令牌。

权限建议限制为：

```text
对象读取和写入
```

资源范围只选择目标 Bucket，例如：

```text
mira-docs-assets
```

创建完成后，需要保存以下信息：

```text
Account ID
Access Key ID
Secret Access Key
Bucket 名称
```

这里需要注意：

- 上传脚本使用的是 **Access Key ID** 和 **Secret Access Key**；
- 页面上用于 Cloudflare API 身份验证的普通“令牌值”不是 S3 客户端所使用的密钥；
- Secret Access Key 通常只显示一次；
- 不要把密钥放进截图、文章或 Git 仓库。

## 四、下载并安装 typora-r2

项目地址：

```text
https://github.com/dangjingtao/typora-r2
```

可以使用 Git 克隆：

```powershell
cd D:\tool
git clone https://github.com/dangjingtao/typora-r2.git
cd typora-r2
npm install
```

也可以从 GitHub 下载 ZIP，解压后进入目录执行：

```powershell
npm install
```

项目主要依赖：

- `sharp`：图片方向处理与 WebP 转换；
- `@aws-sdk/client-s3`：通过 S3 兼容接口上传到 R2；
- `dotenv`：读取本地环境变量。

`sharp` 安装时可能下载当前平台对应的原生依赖。如果安装失败，先确认 Node.js 的版本和系统架构是否匹配。

## 五、配置 `.env`

在项目目录中，将示例文件复制为 `.env`。

PowerShell：

```powershell
Copy-Item .env.example .env
notepad .env
```

填写自己的配置：

```dotenv
R2_ACCOUNT_ID=你的 Cloudflare Account ID
R2_ACCESS_KEY_ID=你的 R2 Access Key ID
R2_SECRET_ACCESS_KEY=你的 R2 Secret Access Key
R2_BUCKET=mira-docs-assets
R2_PUBLIC_BASE_URL=https://assets.example.com
```

`R2_PUBLIC_BASE_URL` 末尾不要添加 `/`，否则最终地址可能出现重复斜杠。

`.env` 包含真实密钥。项目已经通过 `.gitignore` 忽略它，但提交代码前仍然建议检查一次：

```powershell
git status
```

确认 `.env` 没有进入待提交列表。

## 六、配置 Windows 启动脚本

项目提供了 `upload.cmd.example`。

复制一份：

```powershell
Copy-Item upload.cmd.example upload.cmd
notepad upload.cmd
```

根据实际安装位置调整内容，例如：

```bat
@echo off
cd /d D:\tool\typora-r2
"C:\Program Files\nodejs\node.exe" "D:\tool\typora-r2\upload.mjs" %*
```

这里需要保证两处路径正确：

1. `node.exe` 的实际位置；
2. `typora-r2` 项目的实际目录。

如果不知道 Node.js 安装在哪里，可以执行：

```powershell
where.exe node
```

## 七、先在终端验证上传

不要急着接入 Typora，先确认命令行上传已经可用。

准备一张测试图片，然后执行：

```powershell
D:\tool\typora-r2\upload.cmd "D:\Pictures\test.png"
```

成功后，终端会输出一个公开地址：

```text
https://assets.example.com/images/1784053517922-test.webp
```

把这个地址粘贴到浏览器中。

能够正常显示图片，就说明下面这段链路已经打通：

```text
本地图片
→ Sharp 转换 WebP
→ R2 上传
→ 自定义域名公开访问
```

## 八、接入 Typora

打开 Typora：

```text
文件
→ 偏好设置
→ 图像
```

按下面配置：

### 插入图片时

选择：

```text
上传图片
```

勾选：

```text
对本地位置的图片应用上述规则
```

通常不需要勾选“对网络位置的图片应用上述规则”，否则粘贴已经在线的图片时，也可能再次上传一份。

### 上传服务设置

上传服务选择：

```text
自定义命令
```

命令填写：

```text
D:\tool\typora-r2\upload.cmd
```

然后点击：

```text
验证图片上传选项
```

验证通过后，Typora 就能调用上传脚本。

<!-- 建议插图：Typora 图像偏好设置中的自定义命令 -->

## 九、开始使用

现在新建或打开一个 Markdown 文档，直接：

- 粘贴截图；
- 拖入本地图片；
- 使用 Typora 的插入本地图片功能。

Typora 会先获得本地临时图片，然后调用 `upload.cmd`。脚本上传成功后，会把最后输出的 URL 写回 Markdown。

原本可能是：

```markdown
![image](C:\Users\me\AppData\Roaming\Typora\typora-user-images\image.png)
```

完成后变成：

```markdown
![image](https://assets.example.com/images/1784054462969-image.webp)
```

这时图片已经不再依赖当前电脑的本地路径，可以直接用于：

- Folio / Git-native 内容站；
- GitHub README；
- 静态博客；
- VitePress、Docusaurus 等文档站；
- 其他支持 Markdown 的发布系统。

## 图片处理规则

当前版本使用以下规则：

- 输出格式固定为 WebP；
- WebP 质量为 `82`；
- 根据 EXIF 信息自动纠正图片方向；
- 对象保存到 `images/` 目录；
- 文件名格式为 `时间戳-清理后的原文件名.webp`；
- 中文、英文字母、数字、下划线和连字符会保留；
- 其他特殊字符会被替换为连字符；
- 上传对象的 `Content-Type` 为 `image/webp`；
- 缓存头为 `public, max-age=31536000, immutable`；
- 原始本地图片不会被修改。

由于对象名包含时间戳，同一张图片重新上传时会产生一个新对象，不会覆盖旧文件。

## 常见问题

### Typora 提示上传失败

先在 PowerShell 中直接运行：

```powershell
D:\tool\typora-r2\upload.cmd "一张真实存在的图片路径"
```

如果命令行也失败，问题通常在脚本、密钥或网络，而不是 Typora。

如果命令行成功而 Typora 失败，重点检查：

- Typora 中是否填写了 `upload.cmd` 的完整路径；
- `.cmd` 中的 Node.js 路径是否正确；
- 项目目录是否正确；
- 命令中是否存在多余引号。

### 提示 R2 配置不完整

检查 `.env` 是否包含：

```text
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET
R2_PUBLIC_BASE_URL
```

还要确认文件名确实是 `.env`，而不是 Windows 隐藏扩展名后产生的 `.env.txt`。

### 上传返回权限错误

重点检查：

- Access Key ID 与 Secret Access Key 是否来自 R2 API Token；
- Token 是否拥有目标 Bucket 的对象写入权限；
- `.env` 中的 Bucket 名称是否准确；
- Account ID 是否属于当前 Cloudflare 账号。

### 上传成功，但 URL 无法打开

脚本只负责上传对象，不会自动开启 Bucket 的公共访问。

检查：

- 自定义域名是否已经绑定；
- 域名状态是否正常；
- `R2_PUBLIC_BASE_URL` 是否填写正确；
- 浏览器访问的对象路径是否与 R2 中的路径一致。

### 图片仍然显示为本地路径

检查 Typora 是否已经设置为：

```text
插入图片时：上传图片
```

并确认已经勾选：

```text
对本地位置的图片应用上述规则
```

也可以右键图片，手动执行“上传图片”进行验证。

## 当前版本的边界

`typora-r2` 目前保持了非常小的实现范围：

- 每次命令调用处理一张图片；
- 上传目录固定为 `images/`；
- WebP 质量固定为 `82`；
- 不负责删除 R2 中不再使用的旧对象；
- 不提供图形化配置界面；
- 不自动创建 Bucket、API Token 或自定义域名。

这些限制让工具足够简单，也让密钥、上传规则和存储位置保持清晰。后续可以按真实需要增加多图片处理、目录规则、重复图片检测和可配置压缩质量，但没有必要一开始就把它做成一个沉重的图床客户端。

## 为什么 Folio / Git-native 内容站 使用它

Folio / Git-native 内容站 的正文仍然保存在 Git 仓库中，而截图、文章配图和其他二进制资源可以存放在 R2。

这样做有几个直接好处：

- Markdown 文档仍然容易审阅和维护；
- Git 仓库不会因为大量图片持续膨胀；
- 图片地址不依赖某一台本地电脑；
- WebP 可以减少图片体积；
- 文档站迁移部署平台时，静态资源地址仍然有效；
- 写作过程不会被“压缩、上传、复制链接”反复打断。

它不是一个复杂系统，只是把写作过程中最烦的一小段机械操作接了起来。

对于 Folio / Git-native 内容站 来说，这就够了。

## 项目地址

GitHub：

```text
https://github.com/dangjingtao/typora-r2
```

项目采用 MIT License 开源。
