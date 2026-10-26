# 用户交付布局

每个软著一个文件夹，里面只有“代码”和“材料”两个子文件夹。多个软著并列放在用户的工作目录中，不在顶层另建“材料制作”“输出”“交付”等目录。

```text
<软件全称> V1.0/
├─ 代码/                      项目源码（project_root）及 package 生成的 code.zip
└─ 材料/
   ├─ 使用说明书.pdf
   ├─ 源程序鉴别材料.pdf
   ├─ 使用说明书_鉴别选页.pdf   仅说明书超过60页时生成
   ├─ 合作开发协议.docx         仅用户要求时生成
   ├─ 申请信息填写清单.md
   └─ 制作底稿/                 config.json、agreement.json、web-form.json、manual-tex、source-tex、qa、统计与复核记录
```

- 文件夹名用软件全称加版本号；用户已有编号前缀（如“软著2_”）时保留。Windows 文件名不能含半角冒号等字符，全角冒号可用但建议改用下划线或空格。
- config.json 放在 材料/制作底稿/，project_root 默认 ../../代码，materials_dir 默认 ..（即 材料/），code.zip 默认写到 代码/code.zip。符合这个布局时配置里不必写这三个路径。
- build 直接把两份PDF写进 材料/；package 只生成 代码/code.zip 和 制作底稿/交付文件校验.json，不再生成“交付/”“软件材料包/”“完整交付.zip”。
- 申请信息填写清单.md 由 init 按 assets/checklist-template 建在 材料/ 下，之后直接编辑同一文件；package 发现“待填”会拒绝打包。
- 材料/ 根部只放上面列出的文件。TeX、配图、截图原图、qa联系页、JSON记录、协议审阅用PDF全部放 制作底稿/，不在 材料/ 或软著文件夹根部散放。
- code.zip 含全部原创源码、必要运行资源（含可直接运行所需dist）、测试、配置、锁文件、启停脚本、构建/启动说明、第三方许可和逐文件校验，排除 node_modules、缓存、运行日志、CLAUDE.md/AGENTS.md 及 .claude/.codex/.cursor 等编程助手配置。

## 交付内容不提及AI工具

材料/ 中的PDF、填写清单、协议以及 code.zip 中的文件，只描述软件本身，不出现 Claude、Claude Code、Codex、ChatGPT、Copilot、Cursor 等AI编程工具名称，也不写“AI辅助开发/AI编程”之类的制作过程说明。verify 会扫描这些内容，发现即报错：

- 源码注释中出现工具名时，删除该注释（注释不影响功能），然后重新 build。
- 软件本身确实调用某个模型服务（如产品功能接入 OpenAI 接口）时，把该词写入 config.json 的 allowed_ai_terms，并在说明书中按实际功能描述。
- 不因此改写软件功能或开发事实；平台若要求就开发方式作声明，由申请人本人按实际情况填写。

## 整理已有项目

旧项目材料散在多处时，按上面的布局整理：盘点→把源码放进 代码/→把当前PDF和填写清单放进 材料/→把TeX、配图、记录放进 材料/制作底稿/→更新 config.json 路径→verify/package。删除或移动文件前先确认存在可恢复副本；Windows 递归操作用原生 LiteralPath，并核验绝对路径在用户指定项目范围内。旧版本PDF、历史DOCX等不再使用的文件放 制作底稿/归档/，不在 材料/ 累积版本。

后续修改源码直接在 代码/ 中进行，改完重新 build/verify/package。只有 code.zip 没有散放源码时，先解压到独立临时目录核对，再决定是否展开到 代码/。
