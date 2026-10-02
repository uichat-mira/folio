---
title: 产品设计系统
path: /api/examples/product-design-system
description: 从旧 MiraDocs merge 页面迁入的完整 Claude 视觉设计系统研究。
group: 案例 · DESIGN.md
order: 60
type: page
status: reference
tags:
  - Design System
  - Claude
  - Legacy Migration
---

> 这页原先由 UIChat Mira consumer 的私有 `merge: product-design-system` 规则拼接。Folio 核心不实现该私有兼容；迁移时由 consumer 把历史分片合成为一个正常 Markdown/HTML 页面。

<div class="claude-visual">
<section class="band hero" id="overview">
      <div class="band-inner">
        <span class="eyebrow">非官方 · 第三方逆向分析 · 基于 VoltAgent/awesome-design-md</span>
        <div class="hero-grid">
          <div>
            <h1 class="hero-title">Claude 视觉设计系统研究</h1>
            <p class="lede">这份文档完整还原了社区对 Claude / Anthropic 网站视觉语言的公开分析。</p>
            <div class="hero-cta">
              <a class="btn btn-primary" href="#colors-brand">浏览完整色板</a>
              <a class="btn btn-secondary" href="#comp-nav">浏览全部组件</a>
            </div>
          </div>
          <div class="hero-illustration-card">
            <div class="stroke">
              <svg viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="100" cy="80" r="46" stroke="#cc785c" stroke-width="2"/>
                <path d="M100 34 L100 20 M100 126 L100 140 M54 80 L40 80 M146 80 L160 80" stroke="#cc785c" stroke-width="2" stroke-linecap="round"/>
                <circle cx="100" cy="80" r="6" fill="#cc785c"/>
              </svg>
            </div>
          </div>
        </div>
        <p class="note-card" style="margin-top:var(--sp-lg)">说明：以下所有代币（颜色、字号、间距、组件规则）均整理自公开的第三方分析文档，仅作学习与风格参考，并非 Anthropic 官方发布的设计规范，也不代表 claude.ai 产品界面的真实源码。</p>
      </div>
    </section>
<section class="band" id="colors-brand">
      <div class="band-inner">
        <div class="section-head">
          <span class="eyebrow">01 · 色彩</span>
          <h2>品牌色与文字色</h2>
          <p>整个系统只保留一个强调色——珊瑚陶土色，其余全部依靠明暗层次的文字色阶来建立秩序。</p>
        </div>
        <div class="swatch-grid">
          <div class="swatch"><div class="swatch-fill" style="background:var(--primary)"></div><div class="swatch-meta"><div class="name">primary</div><div class="hex">#cc785c</div><div class="role">唯一品牌强调色，按钮/CTA/徽标</div></div></div>
          <div class="swatch"><div class="swatch-fill" style="background:var(--primary-active)"></div><div class="swatch-meta"><div class="name">primary-active</div><div class="hex">#a9583e</div><div class="role">按钮按下态</div></div></div>
          <div class="swatch"><div class="swatch-fill" style="background:var(--primary-disabled)"></div><div class="swatch-meta"><div class="name">primary-disabled</div><div class="hex">#e6dfd8</div><div class="role">禁用态背景</div></div></div>
          <div class="swatch"><div class="swatch-fill" style="background:var(--ink)"></div><div class="swatch-meta"><div class="name">ink</div><div class="hex">#141413</div><div class="role">标题 / 高对比正文</div></div></div>
          <div class="swatch"><div class="swatch-fill" style="background:var(--body-c)"></div><div class="swatch-meta"><div class="name">body</div><div class="hex">#3d3d3a</div><div class="role">正文段落</div></div></div>
          <div class="swatch"><div class="swatch-fill" style="background:var(--body-strong)"></div><div class="swatch-meta"><div class="name">body-strong</div><div class="hex">#252523</div><div class="role">加粗正文 / 强调句</div></div></div>
          <div class="swatch"><div class="swatch-fill" style="background:var(--muted)"></div><div class="swatch-meta"><div class="name">muted</div><div class="hex">#6c6a64</div><div class="role">次要文字</div></div></div>
          <div class="swatch"><div class="swatch-fill" style="background:var(--muted-soft)"></div><div class="swatch-meta"><div class="name">muted-soft</div><div class="hex">#8e8b82</div><div class="role">占位符 / 三级文字</div></div></div>
        </div>
      </div>
    </section>
<section class="band" id="colors-surface">
      <div class="band-inner">
        <div class="section-head">
          <span class="eyebrow">01 · 色彩</span>
          <h2>底色与表面层级</h2>
          <p>画布必须是带暖调的米白色，而不是纯白或冷灰——这是与其它 AI 产品拉开辨识度的关键。</p>
        </div>
        <div class="swatch-grid">
          <div class="swatch"><div class="swatch-fill" style="background:var(--canvas)"></div><div class="swatch-meta"><div class="name">canvas</div><div class="hex">#faf9f5</div><div class="role">页面主底色</div></div></div>
          <div class="swatch"><div class="swatch-fill" style="background:var(--surface-soft)"></div><div class="swatch-meta"><div class="name">surface-soft</div><div class="hex">#f5f0e8</div><div class="role">轻微区隔的分区底色</div></div></div>
          <div class="swatch"><div class="swatch-fill" style="background:var(--surface-card)"></div><div class="swatch-meta"><div class="name">surface-card</div><div class="hex">#efe9de</div><div class="role">卡片背景（比画布更深一级）</div></div></div>
          <div class="swatch"><div class="swatch-fill" style="background:var(--surface-cream-strong)"></div><div class="swatch-meta"><div class="name">surface-cream-strong</div><div class="hex">#e8e0d2</div><div class="role">强调型米色区块</div></div></div>
          <div class="swatch"><div class="swatch-fill" style="background:var(--hairline)"></div><div class="swatch-meta"><div class="name">hairline</div><div class="hex">#e6dfd8</div><div class="role">卡片细边框</div></div></div>
          <div class="swatch"><div class="swatch-fill" style="background:var(--hairline-soft)"></div><div class="swatch-meta"><div class="name">hairline-soft</div><div class="hex">#ebe6df</div><div class="role">更轻的分隔线</div></div></div>
        </div>
      </div>
    </section>
<section class="band" id="colors-dark" style="background:var(--surface-dark)">
      <div class="band-inner">
        <div class="section-head">
          <span class="eyebrow" style="background:rgba(250,249,245,.1);color:var(--on-dark)">01 · 色彩</span>
          <h2 style="color:var(--on-dark)">深色对比板块</h2>
          <p style="color:var(--on-dark-soft)">深色只出现在页脚与少数收尾 CTA、以及产品截图（代码编辑器 / 聊天界面）模块中，从不作为页面主基调。</p>
        </div>
        <div class="swatch-grid">
          <div class="swatch"><div class="swatch-fill" style="background:var(--surface-dark)"></div><div class="swatch-meta"><div class="name">surface-dark</div><div class="hex">#181715</div><div class="role">深色板块底色 / 页脚</div></div></div>
          <div class="swatch"><div class="swatch-fill" style="background:var(--surface-dark-elevated)"></div><div class="swatch-meta"><div class="name">surface-dark-elevated</div><div class="hex">#252320</div><div class="role">深色内嵌卡片 / 状态栏</div></div></div>
          <div class="swatch"><div class="swatch-fill" style="background:var(--surface-dark-soft)"></div><div class="swatch-meta"><div class="name">surface-dark-soft</div><div class="hex">#1f1e1b</div><div class="role">深色次级分区</div></div></div>
          <div class="swatch"><div class="swatch-fill" style="background:var(--on-dark)"></div><div class="swatch-meta"><div class="name">on-dark</div><div class="hex">#faf9f5</div><div class="role">深色背景上的主文字</div></div></div>
          <div class="swatch"><div class="swatch-fill" style="background:var(--on-dark-soft)"></div><div class="swatch-meta"><div class="name">on-dark-soft</div><div class="hex">#a09d96</div><div class="role">深色背景上的次要文字</div></div></div>
          <div class="swatch"><div class="swatch-fill" style="background:var(--on-primary)"></div><div class="swatch-meta"><div class="name">on-primary</div><div class="hex">#ffffff</div><div class="role">珊瑚色按钮上的文字</div></div></div>
        </div>
      </div>
    </section>
<section class="band" id="colors-accent">
      <div class="band-inner">
        <div class="section-head">
          <span class="eyebrow">01 · 色彩</span>
          <h2>辅助色与状态色</h2>
          <p>青绿与琥珀作为极少量的点缀色（多见于代码高亮），成功/警告/错误则是常规语义色，同样只做点缀，不作为大面积色块。</p>
        </div>
        <div class="swatch-grid">
          <div class="swatch"><div class="swatch-fill" style="background:var(--accent-teal)"></div><div class="swatch-meta"><div class="name">accent-teal</div><div class="hex">#5db8a6</div><div class="role">代码高亮 / 图表点缀</div></div></div>
          <div class="swatch"><div class="swatch-fill" style="background:var(--accent-amber)"></div><div class="swatch-meta"><div class="name">accent-amber</div><div class="hex">#e8a55a</div><div class="role">代码高亮 / 图表点缀</div></div></div>
          <div class="swatch"><div class="swatch-fill" style="background:var(--success)"></div><div class="swatch-meta"><div class="name">success</div><div class="hex">#5db872</div><div class="role">成功状态</div></div></div>
          <div class="swatch"><div class="swatch-fill" style="background:var(--warning)"></div><div class="swatch-meta"><div class="name">warning</div><div class="hex">#d4a017</div><div class="role">警告状态</div></div></div>
          <div class="swatch"><div class="swatch-fill" style="background:var(--error)"></div><div class="swatch-meta"><div class="name">error</div><div class="hex">#c64545</div><div class="role">错误状态</div></div></div>
        </div>
      </div>
    </section>
</div>

<div class="claude-visual">
<section class="band" id="type">
      <div class="band-inner">
        <div class="section-head">
          <span class="eyebrow">02 · 字体</span>
          <h2>字体角色与字号</h2>
          <p>展示字体是原版的 Copernicus（衬线，此处用 Cormorant Garamond 替代），只用常规字重、不加粗，并且在大号字上必须带负字距，否则会失去"文学感"。正文与界面统一使用无衬线的 StyreneB（此处用 Public Sans 替代），标签常用等宽字体做点缀。</p>
        </div>
        <div class="type-row">
          <span class="type-sample" style="font-size:64px;letter-spacing:-1.5px">Aa 展示级 display-lg</span>
          <span class="type-label">Copernicus(→Cormorant Garamond) · 400 · 64px · 字距 −1.5px</span>
        </div>
        <div class="type-row">
          <span class="type-sample" style="font-size:40px;letter-spacing:-1px">Aa 区块标题 display-sm</span>
          <span class="type-label">Copernicus · 400 · 40px · 字距 −1px</span>
        </div>
        <div class="type-row">
          <span class="type-sample" style="font-size:28px;letter-spacing:-.3px">Aa 卡片大标题 title-xl</span>
          <span class="type-label">Copernicus · 400 · 28px · 字距 −0.3px</span>
        </div>
        <div class="type-row">
          <span class="type-sample-sans" style="font-size:20px;font-weight:600">Aa 卡片标题 title-lg</span>
          <span class="type-label">StyreneB(→Public Sans) · 600 · 20px</span>
        </div>
        <div class="type-row">
          <span class="type-sample-sans" style="font-size:17px;font-weight:600">Aa 组件标题 title-md</span>
          <span class="type-label">Public Sans · 600 · 17px</span>
        </div>
        <div class="type-row">
          <span class="type-sample-sans" style="font-size:16px;font-weight:400">Aa 正文段落 body-md</span>
          <span class="type-label">Public Sans · 400 · 16px / 1.6</span>
        </div>
        <div class="type-row">
          <span class="type-sample-sans" style="font-size:14px;font-weight:500">Aa 导航链接 nav-link / 按钮文字 button</span>
          <span class="type-label">Public Sans · 500 · 14px</span>
        </div>
        <div class="type-row">
          <span class="type-sample-sans" style="font-size:13px;font-weight:500">Aa 小号标签 caption</span>
          <span class="type-label">Public Sans · 500 · 13px</span>
        </div>
        <div class="type-row">
          <span class="mono-label" style="font-size:12px">AA 大写标签 CAPTION-UPPERCASE</span>
          <span class="type-label">mono · 500 · 12px · 字距 1.5px · 大写</span>
        </div>
        <div class="type-row">
          <span style="font-family:var(--font-mono);font-size:13px">const claude = "code block";</span>
          <span class="type-label">JetBrains Mono · 400 · 13px（代码块专用）</span>
        </div>
        <p class="note-card" style="margin-top:var(--sp-md)">字体替代说明：Copernicus 与 StyreneB 是 Anthropic 的授权字体，未公开提供 Web Font。第三方分析建议的替代顺序为 —— 衬线：Tiempos Headline / Cormorant Garamond / EB Garamond；无衬线：Inter / Söhne / Public Sans。</p>
      </div>
    </section>
</div>

<div class="claude-visual">
<section class="band" id="comp-nav">
      <div class="band-inner">
        <div class="section-head">
          <span class="eyebrow">03 · 组件</span>
          <h2>顶部导航 top-nav</h2>
          <p>高度固定 64px，米白底色，左侧品牌标识，中间主菜单，右侧登录链接与珊瑚色主按钮。小于 768px 时收起为汉堡菜单，展开为全屏米色抽屉。</p>
        </div>
        <div class="demo-topnav">
          <div class="brand"><span class="mark"></span>Claude</div>
          <ul class="menu">
            <li><a href="#">产品</a></li>
            <li><a href="#">定价</a></li>
            <li><a href="#">公司</a></li>
          </ul>
          <div class="right">
            <a class="text-link" href="#">登录</a>
            <a class="btn btn-primary" href="#">试用 Claude</a>
          </div>
        </div>
      </div>
    </section>
<section class="band" id="comp-buttons">
      <div class="band-inner">
        <div class="section-head">
          <span class="eyebrow">03 · 组件</span>
          <h2>按钮、徽标与分段标签</h2>
          <p>按钮统一高度 40px，圆角 8px；徽标与标签统一使用全圆角（pill）；系统明确规定"按下态只会变暗，不会有其它任何 hover 效果"。</p>
        </div>
        <div class="demo-grid">
          <div class="demo-card">
            <h4>button-primary</h4>
            <div class="row">
              <a class="btn btn-primary" href="#">默认</a>
              <a class="btn btn-primary is-disabled" href="#" aria-disabled="true">禁用</a>
            </div>
          </div>
          <div class="demo-card">
            <h4>button-secondary</h4>
            <div class="row"><a class="btn btn-secondary" href="#">次要按钮</a></div>
          </div>
          <div class="demo-card" style="background:var(--surface-dark)">
            <h4 style="color:var(--on-dark)">button-icon-circular</h4>
            <div class="row"><span class="btn-icon-circular">✦</span></div>
          </div>
          <div class="demo-card">
            <h4>badge-pill / badge-coral</h4>
            <div class="row">
              <span class="badge-pill">连接器</span>
              <span class="badge-coral">New</span>
            </div>
          </div>
          <div class="demo-card">
            <h4>category-tab</h4>
            <div class="tab-row">
              <span class="tab active">全部</span>
              <span class="tab">模型</span>
              <span class="tab">研究</span>
            </div>
          </div>
        </div>
      </div>
    </section>
<section class="band" id="comp-input">
      <div class="band-inner">
        <div class="section-head">
          <span class="eyebrow">03 · 组件</span>
          <h2>输入框</h2>
          <p>米白底色配细边框，聚焦态切换为珊瑚色描边并附加淡色光晕，不使用系统默认蓝色焦点框。</p>
        </div>
        <div class="input-demo">
          <label for="ex-email">工作邮箱</label>
          <input id="ex-email" type="email" placeholder="you@company.com">
        </div>
      </div>
    </section>
<section class="band" id="comp-model">
      <div class="band-inner">
        <div class="section-head">
          <span class="eyebrow">03 · 组件</span>
          <h2>模型对比卡片 model-comparison-card</h2>
          <p>米色底、细边框、大圆角，配抽象几何缩略图，用于并排展示不同能力档位。</p>
        </div>
        <div class="model-grid">
          <div class="model-card"><div class="thumb"></div><h3>轻量版</h3><p>响应速度快，适合高频率的简单任务。</p><a class="text-link" href="#">了解更多 →</a></div>
          <div class="model-card"><div class="thumb"></div><h3>均衡版</h3><p>日常默认选择，兼顾速度与能力。</p><a class="text-link" href="#">了解更多 →</a></div>
          <div class="model-card"><div class="thumb"></div><h3>旗舰版</h3><p>面向最复杂任务，能力优先。</p><a class="text-link" href="#">了解更多 →</a></div>
        </div>
      </div>
    </section>
<section class="band" id="comp-feature">
      <div class="band-inner">
        <div class="section-head">
          <span class="eyebrow">03 · 组件</span>
          <h2>功能卡片 feature-card</h2>
          <p>比画布更深一级的米色（#efe9de），大内边距（32px）让文字更透气，顶部小图标 + 标题 + 描述的三段式结构。</p>
        </div>
        <div class="feature-grid">
          <div class="feature-card"><div class="icon"></div><h3>长上下文</h3><p>一次性处理更长的文档与对话历史。</p></div>
          <div class="feature-card"><div class="icon"></div><h3>工具调用</h3><p>连接外部工具，完成多步骤任务。</p></div>
          <div class="feature-card"><div class="icon"></div><h3>安全对齐</h3><p>训练过程中重视可靠与可控。</p></div>
        </div>
      </div>
    </section>
<section class="band" id="comp-mockup">
      <div class="band-inner">
        <div class="section-head">
          <span class="eyebrow">03 · 组件</span>
          <h2>深色产品卡片 product-mockup-card-dark</h2>
          <p>用于展示真实产品截图（代码编辑器 / 聊天界面），自带行号、语法高亮、状态栏等"内部纵深"，因此几乎不需要额外阴影。</p>
        </div>
        <div class="mockup-dark">
          <div class="titlebar"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>
          <div class="line"><span class="kw">function</span> generateReport(<span class="str">"q3"</span>) {</div>
          <div class="line" style="padding-left:16px">return claude.analyze(data);</div>
          <div class="line">}</div>
          <div class="statusbar">main.ts · UTF-8 · Claude 正在协助编写代码</div>
        </div>
      </div>
    </section>
<section class="band" id="comp-pricing">
      <div class="band-inner">
        <div class="section-head">
          <span class="eyebrow">03 · 组件</span>
          <h2>定价卡片 pricing-tier-card</h2>
          <p>桌面端 3～4 栏并排，被选中的档位不额外加边框或角标，而是直接把整张卡片反转为深色背景——"深色即推荐"信号。移动端收起为单列。</p>
        </div>
        <div class="pricing-grid">
          <div class="pricing-card">
            <div class="plan-name">个人版</div><div class="price">¥0</div><div class="price-sub">每月 · 个人使用</div>
            <ul class="feature-list"><li>基础对话额度</li><li>标准响应速度</li><li>社区支持</li></ul>
            <a class="btn btn-secondary" href="#">开始使用</a>
          </div>
          <div class="pricing-card featured">
            <div class="plan-name">专业版</div><div class="price">¥148</div><div class="price-sub">每月 · 按人数计费</div>
            <ul class="feature-list"><li>更高使用额度</li><li>优先响应速度</li><li>团队协作空间</li></ul>
            <a class="btn btn-on-coral" href="#">升级到专业版</a>
          </div>
          <div class="pricing-card">
            <div class="plan-name">团队版</div><div class="price">¥定制</div><div class="price-sub">每月 · 面向组织</div>
            <ul class="feature-list"><li>集中管理与权限</li><li>专属技术支持</li><li>安全与合规保障</li></ul>
            <a class="btn btn-secondary" href="#">联系销售</a>
          </div>
        </div>
      </div>
    </section>
<section class="band" id="comp-cta">
      <div class="band-inner">
        <div class="section-head">
          <span class="eyebrow">03 · 组件</span>
          <h2>CTA 板块 cta-band</h2>
          <p>珊瑚色版本用于常规页面收尾；深色版本更多出现在面向开发者的页面，常与代码窗口卡片搭配。两者都保持整块纯色填充、大圆角、无阴影。</p>
        </div>
        <div style="display:flex;flex-direction:column;gap:var(--sp-md)">
          <div class="cta-band cta-band-coral">
            <h2>珊瑚色 CTA</h2>
            <p>用于常规页面收尾前的行动号召，通常搭配一句简短说明。</p>
            <div class="cta-actions">
              <a class="btn btn-on-coral" href="#">立即开始</a>
              <a class="btn btn-ghost-dark" href="#">查看文档</a>
            </div>
          </div>
          <div class="cta-band cta-band-dark">
            <h2>深色 CTA</h2>
            <p>面向开发者的页面更常用这种深色版本，常与代码窗口卡片搭配出现。</p>
            <div class="cta-actions">
              <a class="btn btn-primary" href="#">阅读接入文档</a>
              <a class="btn btn-ghost-dark" href="#">查看示例</a>
            </div>
          </div>
        </div>
      </div>
    </section>
<section class="band" id="comp-footer">
      <div class="band-inner">
        <div class="section-head">
          <span class="eyebrow">03 · 组件</span>
          <h2>页脚 footer</h2>
          <p>深棕黑底色，四栏链接列表，顶部放品牌标识，垂直内边距 64px。页脚"永远不会反转成亮色"，是全站唯一固定的深色区域。</p>
        </div>
        <div class="demo-footer">
          <div class="top-row"><span class="mark" style="width:20px;height:20px;border-radius:50%;background:var(--primary);display:inline-block;position:relative"></span>Anthropic</div>
          <div class="footer-cols">
            <div><h5>产品</h5><ul><li>Claude</li><li>API</li><li>定价</li></ul></div>
            <div><h5>公司</h5><ul><li>关于我们</li><li>招聘</li><li>新闻</li></ul></div>
            <div><h5>资源</h5><ul><li>文档</li><li>研究</li><li>安全</li></ul></div>
            <div><h5>法务</h5><ul><li>隐私政策</li><li>使用条款</li></ul></div>
          </div>
        </div>
      </div>
    </section>
</div>

<div class="claude-visual">
<section class="band" id="layout">
      <div class="band-inner">
        <div class="section-head">
          <span class="eyebrow">04 · 布局</span>
          <h2>网格、间距与页面节奏</h2>
          <p>Hero 区域采用 6:6 对称网格；主要板块之间统一使用 96px 的大间距（spacing.section），营造出杂志专栏式的呼吸感；卡片内部统一使用 32px 内边距。</p>
        </div>
        <h4 style="margin-bottom:8px">12 栏网格示意</h4>
        <div class="grid-demo">
          <div style="grid-column:span 6"></div><div style="grid-column:span 6"></div>
        </div>
        <p class="note-card" style="margin-top:var(--sp-md)">节奏规则：页面表面模式必须交替出现，不能连续两个板块使用相同底色 —— 米色 → 米色卡片 → 深色产品截图 → 米色 → 珊瑚色 CTA → 深色页脚，如此循环。</p>
        <table class="resp-table" style="margin-top:var(--sp-md)">
          <tr><th>间距代币</th><th>数值</th><th>典型用途</th></tr>
          <tr><td>sp-xs</td><td>8px</td><td>徽标 / 标签内边距</td></tr>
          <tr><td>sp-sm</td><td>16px</td><td>组件内部小间距</td></tr>
          <tr><td>sp-md</td><td>24px</td><td>卡片间距</td></tr>
          <tr><td>sp-lg</td><td>32px</td><td>卡片内边距</td></tr>
          <tr><td>sp-xl</td><td>48px</td><td>板块内左右留白</td></tr>
          <tr><td>sp-section</td><td>96px</td><td>主要板块之间的垂直间距</td></tr>
        </table>
      </div>
    </section>
</div>

<div class="claude-visual">
<section class="band" id="elevation">
      <div class="band-inner">
        <div class="section-head">
          <span class="eyebrow">05 · 深度</span>
          <h2>深度哲学：色块优先，阴影罕见</h2>
          <p>层次感几乎完全来自"米色 vs 深色"的表面对比，而不是投影。深色产品卡片依靠自身的界面细节（行号、滚动条、状态栏）制造纵深，不需要额外阴影。</p>
        </div>
        <div class="elevation-row">
          <div class="elev-card"><h4>浅色卡片</h4><p style="margin:0">细边框 + 大圆角，零阴影。</p></div>
          <div class="elev-card contrast"><h4 style="color:var(--on-dark)">深色卡片</h4><p style="margin:0;color:var(--on-dark-soft)">靠色块对比制造层次，而非投影。</p></div>
        </div>
      </div>
    </section>
</div>

<div class="claude-visual">
<section class="band" id="guidelines">
      <div class="band-inner">
        <div class="section-head">
          <span class="eyebrow">06 · 使用建议</span>
          <h2>该怎么做 / 不该怎么做</h2>
        </div>
        <div class="dd-grid">
          <div class="dd-card do">
            <div class="head">✅ Do</div>
            <ul>
              <li>始终把页面锚定在暖调米白画布上，纯白会显得像"随便一个 AI 工具"</li>
              <li>每个展示级标题都用衬线字体，正文配无衬线字体</li>
              <li>展示字号的负字距是硬性要求，去掉就会显得"离题"</li>
              <li>主要板块之间保持 96px 的统一间距</li>
            </ul>
          </div>
          <div class="dd-card dont">
            <div class="head">🚫 Don't</div>
            <ul>
              <li>不要用冷灰或纯白做画布底色</li>
              <li>不要给衬线展示字体加粗（700 字重会显得夸张，系统统一停在 400）</li>
              <li>不要用冷蓝或高饱和青色作为品牌强调色</li>
              <li>不要让珊瑚色到处出现——它只用于个别元素的点缀，只有整块的珊瑚色 CTA 卡片才允许大面积铺色</li>
              <li>不要用 Inter 做展示级标题字体，衬线字符是品牌声音的核心</li>
              <li>不要让相邻两个板块使用相同的表面模式</li>
              <li>不要叠加系统未定义的 hover 效果——按钮按下只会变暗，没有其它动效</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
</div>

<div class="claude-visual">
<section class="band" id="responsive">
      <div class="band-inner">
        <div class="section-head">
          <span class="eyebrow">07 · 响应式</span>
          <h2>断点行为</h2>
        </div>
        <table class="resp-table">
          <tr><th>组件</th><th>断点行为</th></tr>
          <tr><td>顶部导航</td><td>&lt;768px 收起为汉堡菜单，展开为全屏米色抽屉</td></tr>
          <tr><td>Hero 区块</td><td>6:6 网格收起为单列：先显示 h1 + 副标题 + 按钮，插画/产品截图卡片放在下方；标题字号从 64px 降到 32px</td></tr>
          <tr><td>功能卡片网格</td><td>缩减列数而不是缩小卡片本身</td></tr>
          <tr><td>定价卡片</td><td>4 栏 → 2 栏 → 1 栏；被选中档位的深色背景在所有断点下都保持醒目</td></tr>
          <tr><td>代码窗口卡片</td><td>代码保持原字号，横向滚动而不是换行，确保可读性</td></tr>
          <tr><td>连接器卡片</td><td>整张卡片都可点击，有效点击区域远大于 44px</td></tr>
          <tr><td>圆形图标按钮</td><td>固定 36×36px，略小于 WCAG 建议的 44px，但视觉上居中对齐</td></tr>
          <tr><td>页脚</td><td>4 栏收起为 1 栏</td></tr>
        </table>
      </div>
    </section>
</div>

<div class="claude-visual">
<section class="band" id="notes" style="border-bottom:none">
      <div class="band-inner">
        <div class="section-head">
          <span class="eyebrow">08 · 局限说明</span>
          <h2>这份分析没有覆盖什么</h2>
        </div>
        <div class="note-card">Copernicus 与 StyreneB 是 Anthropic 的授权字体，并未公开提供 Web Font，因此本页与原分析文档一样，全部使用开源替代字体。</div>
        <div class="note-card">Anthropic 的四芒星标志（spike-mark）只被当作 Logo 素材处理，没有被形式化为可复用的设计代币。</div>
        <div class="note-card">动效与过渡时长（聊天消息浮现、首页代码块打字机效果、agentic 流程图动画）不在本次分析范围内。</div>
        <div class="note-card">除输入框聚焦态外，其余表单校验状态（成功 / 失败提示）未被提取，需要真实的注册或反馈流程才能确认。</div>
        <div class="note-card">claude.ai 真实的产品聊天界面与本文档所述的营销官网共享部分代币，但还包含大量产品专属组件（对话气泡、消息工具栏、文件上传芯片、对话历史侧边栏），这些均超出本文档范围。</div>

        <p class="disclaimer">全文声明：本页内容整合自 VoltAgent/awesome-design-md 仓库中关于 Claude 的 DESIGN.md 分析及相关社区资料，属于第三方基于公开可观察界面模式做出的独立整理，不隶属于、不代表、也未获得 Anthropic 官方认可，其中的具体数值可能与真实产品存在出入，仅供学习与风格参考使用。</p>
      </div>
    </section>
</div>
