# 软著材料准备 Skill

[![Claude Code Skill](https://img.shields.io/badge/Claude_Code-Skill-d97757?style=flat-square)](#安装)
[![Codex Skill](https://img.shields.io/badge/Codex-Skill-111827?style=flat-square)](#安装)
[![GitHub release](https://img.shields.io/github/v/release/handsomeZR-netizen/software-copyright-materials?style=flat-square&label=release)](https://github.com/handsomeZR-netizen/software-copyright-materials/releases/latest)

给 AI 编程助手（Claude Code、Codex）用的技能包：根据项目的真实源码，制作中国计算机软件著作权登记需要的使用说明书、源程序鉴别材料和网页申请填写内容，并把代码整理成 `code.zip`。

[示例说明书 PDF](examples/balance-lab/materials/使用说明书.pdf) · [示例源程序 PDF](examples/balance-lab/materials/源程序鉴别材料.pdf) · [下载发布版本](https://github.com/handsomeZR-netizen/software-copyright-materials/releases/latest)

## 产出内容

| 产出 | 说明 |
| --- | --- |
| 使用说明书 PDF | 用 TeX 模板排版，交付时附 TeX 原稿和配图，方便以后修改 |
| 源程序鉴别材料 PDF | 从原始文件抽取，附文件顺序、原始行号和 SHA-256 映射 |
| 申请信息填写清单.md | 按网页表单字段顺序整理，脚本校验必填项、字数和源程序量 |
| `code.zip` | 源码、配置、锁文件、测试、构建产物、启停脚本和逐文件校验 |
| 合作开发协议 | 点名需要时，用 `agreement.py` 基于仓库内的 DOCX 模板生成 DOCX 和 PDF |

## 遵循的原则

- 说明书只写已经实现的功能，截图来自实际运行的软件。
- 源码只收原创部分，不收依赖和自动生成的代码；长行折行只按一行计数，空行不印刷。
- 超过 60 页时取前后各 30 页，不足 60 页全部提交；不靠删内容、补空行或缩小字号凑页数。
- 软件名称、版本、日期、源码行数在说明书、源程序材料和填写清单里保持一致。
- 著作权人、权属、开发完成日期、发表情况等事实以用户提供的为准，不知道的留空待补。
- 只准备材料，不替用户提交申请、签署文件或联系第三方。

## 安装

在 PowerShell 中执行：

```powershell
git clone https://github.com/handsomeZR-netizen/software-copyright-materials.git
cd software-copyright-materials
```

| 安装到 | 命令 | 目标目录 |
| --- | --- | --- |
| Claude Code 个人目录 | `.\scripts\install.ps1 -Personal -Claude` | `~/.claude/skills` |
| Claude Code 某个项目 | `.\scripts\install.ps1 -ProjectRoot '项目目录' -Claude` | `项目目录/.claude/skills` |
| Codex 个人目录 | `.\scripts\install.ps1 -Personal` | `~/.codex/skills`（或 `$CODEX_HOME/skills`） |
| Codex 某个项目 | `.\scripts\install.ps1 -ProjectRoot '项目目录'` | `项目目录/.agents/skills` |

安装脚本会把完整示例一起复制到 skill 的 `assets/complete-example`。目标位置已有同名 skill 时脚本会停止，检查过现有内容后再加 `-Force` 覆盖。不用 PowerShell 的话，可以手动把 `.agents/skills/software-copyright-materials` 复制到对应的 skills 目录。

## 使用

在 Claude Code 里直接描述任务，例如“帮我给 D:\projects\xxx 准备软著材料”，或输入 `/software-copyright-materials`。

在 Codex 里：

```text
使用 $software-copyright-materials 为我的新项目准备软著源码材料、TeX说明书和网页申请填写参考，并整理成code.zip和软件材料包。
```

开始前准备好这些信息：

- 项目路径
- 软件全称和版本号
- 著作权人
- 开发完成日期（已知的话）
- 已有的说明书模板或历史材料（如果有）

## 运行环境

- Python 3.10 及以上，以及 PyMuPDF、Pillow：`pip install -r .agents/skills/software-copyright-materials/scripts/requirements.txt`
- XeLaTeX（TeX Live 或 MiKTeX）。不在 PATH 里时，在配置中用 `xelatex` 字段写绝对路径。
- 模板默认使用 Windows 中文字体。macOS 或 Linux 上，在配置中设置 `ctex_fontset`（如 `mac`、`fandol`）和 `cjk_mono_font`。

## 命令行流程

Agent 会按这个流程调用脚本，也可以手动运行。所有路径都相对于配置文件解析，与当前工作目录无关。

```text
写配置 → init → 编写说明书、截图 → build → 目视检查 → package
```

```powershell
$kit = '.agents/skills/software-copyright-materials/scripts'
python $kit/materials.py init    --config 配置.json   # 生成说明书 TeX 骨架（已存在时不覆盖）
python $kit/materials.py build   --config 配置.json   # 编译两份 PDF，并自动执行 verify
python $kit/materials.py verify  --config 配置.json   # 单独复核
python $kit/materials.py package --config 配置.json   # 复核通过后打包
python $kit/check_web_form.py --input 字段.json --stats 输出目录/源码清单与统计.json
python $kit/agreement.py --config agreement.json --pdf   # 合作开发协议（需要时）
```

`verify` 会检查源码哈希和行号顺序、A4 尺寸、页眉页脚、目录页码与实际跳转目标、残留的模板文字，并把每页渲染成图片放进 `qa/`，供人工目视检查。机器检查通过不代表排版没有问题，联系页（多页缩略图拼在一张图上）和关键页面仍然需要人看一遍。

输出目录结构：

```text
输出目录/
├─ manual-tex/              说明书 TeX 原稿和配图
├─ source-tex/              源程序 TeX（每次 build 重新生成）
├─ 使用说明书.pdf
├─ 源程序鉴别材料.pdf
├─ 源码清单与统计.json      文件、原始行号、哈希、每页行号区间
├─ 复核结果.json
├─ qa/                      逐页图片和联系页
├─ 交付/
│  ├─ code.zip
│  └─ 软件材料包/           两份 PDF、填写清单、可编辑原稿、源码映射
└─ 完整交付.zip             制作过程的完整归档
```

`交付/` 每次 `package` 都会重新生成，不要在里面修改。确认无误后，再把 `code.zip` 和 `软件材料包/` 移到项目根目录。

### 配置

从 [config.example.json](.agents/skills/software-copyright-materials/references/config.example.json) 复制一份开始填写。必填项：

| 字段 | 说明 |
| --- | --- |
| `software_name` / `software_version` | 软件全称和版本，各份材料必须一致 |
| `copyright_owner` | 实际著作权人 |
| `project_root` | 项目根目录，相对于配置文件 |
| `source_files` | 收入源程序材料的原创源文件，按排版顺序列出 |

常用可选项：`package_files` 列出放进 `code.zip` 的其他文件，可以写目录或通配符，如 `"dist/**"`。`development_date` 是开发完成日期。`stale_terms` 列出不应出现在 PDF 中的旧项目名称。完整说明见 [材料制作与复核](.agents/skills/software-copyright-materials/references/materials-workflow.md)。

## 完整示例

[examples/balance-lab](examples/balance-lab/README.md) 是一个匿名的“天平实验训练示例”，可以运行，配套材料是按上面的流程做出来的：

| 内容 | 数量 |
| --- | --- |
| 使用说明书 | 14 页，目录 1 页 |
| 源程序材料 | 55 页，共 2,756 个非空源码行 |
| 界面截图 | 7 张，均从实际运行中采集 |
| 应用测试 | 14 项 |

![天平实验训练示例的主界面](examples/balance-lab/materials/manual-tex/figures/01-home.png)

运行示例需要 Node.js 22.18 及以上：

```powershell
cd examples/balance-lab/code
npm ci
npm test
npm run build
npm start          # 打开 http://localhost:3187
```

在仓库根目录重新生成示例材料：

```powershell
python .agents/skills/software-copyright-materials/scripts/materials.py build --config examples/balance-lab/config.json
```

示例的软件名称、著作权人、日期和记录编号都是虚构的，不能用于真实申请。这些页数也只是这个示例的结果，不是其他项目必须达到的要求。

## 仓库结构

```text
.agents/skills/software-copyright-materials/
├─ SKILL.md                 技能入口
├─ references/              制作流程、登记要求、网页字段、交付布局、协议模板说明
├─ assets/
│  ├─ tex-template/         说明书与源程序 TeX 模板、等宽字体
│  └─ agreement-template/   合作开发协议 DOCX 模板
└─ scripts/                 materials.py、check_web_form.py、agreement.py 及测试
examples/balance-lab/       完整匿名示例（代码 + 材料）
scripts/
├─ install.ps1              安装脚本
└─ audit_release.py         发布前检查身份信息、凭据和本机路径
```

## 开发

```powershell
python -m unittest discover -s .agents/skills/software-copyright-materials/scripts -p 'test_*.py' -v
```

修改脚本后要跑这 14 项测试；修改示例应用逻辑后要跑示例的 npm 测试并重新构建。贡献约定见 [AGENTS.md](AGENTS.md)。

## 使用边界

- 本技能只提供材料制作和技术检查，不代替身份与权属确认，也不代替登记机构的审查，不保证获证。
- 登记规则和网页字段会变。仓库记录的字数限制来自 2026 年 10 月的表单截图，正式申请时要以当时的官方要求和页面为准。
- 开发过程中用过 AI 辅助的，按事实保留，不要在材料或声明里写成“未使用 AI”。
- 公开仓库中的示例已经匿名处理，不包含真实姓名、项目标识、申请日期、本机路径、签名、证件或凭据，Git 提交也使用匿名作者。
- 本仓库公开展示源码和材料，但不额外授予商业使用、再许可或转让的权利。第三方组件和字体遵守各自附带的许可。
