# 软著材料准备 Skill

基于真实源码准备计算机软件著作权登记材料：沿用TeX模板生成PDF，检查目录、页码、源码真实性和打包完整性，并按网页字段生成可粘贴的填写参考。

仓库包含一个完整的匿名天平实验示例：源码、14项测试、演示数据、7张重新采集的界面截图、14页使用说明书、55页源程序鉴别材料、TeX主稿和网页填写Markdown。示例的姓名、名称、日期、记录编号均为演示值。

## 安装到项目

下载或克隆仓库后，在PowerShell执行：

```powershell
.\scripts\install.ps1 -ProjectRoot '你的项目目录'
```

安装至项目的`.agents/skills/software-copyright-materials`，包含完整匿名示例。已有同名skill时先检查，再使用`-Force`更新。也可加`-Personal`安装到个人skills目录。

在Codex新会话中调用：

```text
使用 $software-copyright-materials 为我的新项目准备软著源码材料、TeX说明书和网页申请填写参考，并整理成code.zip和软件材料包。
```

先提供新项目路径、实际名称/版本/权利主体及已知日期。Skill会读取实现和真实截图，未知身份、权属、发表事项保留待补，不自动提交申请。

## 查看完整示例

- `examples/balance-lab/code/`：可运行源码、配置、依赖锁、测试及启停脚本。
- `examples/balance-lab/materials/`：当前两类PDF、TeX/配图、源码映射和申请信息填写清单。
- `examples/balance-lab/config.json`：对应真实源文件的制作配置。
- `.agents/skills/software-copyright-materials/`：skill、模板、规范来源和生成/核验工具。

运行示例需要Node.js 22.18及以上；进入code目录运行`npm ci`、`npm test`、`npm run build`，然后`npm start`访问本机3187端口。数据仅为演示记录，正常运行不需要在线业务接口。

## 重建材料

PDF工具需要Python3.10+、PyMuPDF、Pillow和已有XeLaTeX。当前模板使用Windows中文字库，默认在Windows环境运行；其他系统需替换字体并重新核验。无需为内置TeX编辑器安装插件。

```powershell
python -m pip install -r .agents/skills/software-copyright-materials/scripts/requirements.txt
python .agents/skills/software-copyright-materials/scripts/materials.py build --config examples/balance-lab/config.json
python .agents/skills/software-copyright-materials/scripts/check_web_form.py --input examples/balance-lab/web-form.json
python -m unittest discover -s .agents/skills/software-copyright-materials/scripts -p 'test_*.py' -v
```

内置TeX编译器可用时优先使用；命令行脚本是批量制作和环境不支持时的备用入口。目录多遍编译到交叉引用稳定，保留真实源码及行号映射，包装完成后核对ZIP哈希。

## 匿名化与使用边界

仓库没有原姓名、原项目标识、真实申请日期、个人电脑路径、原记录编号、签名、身份证件或凭据。截图来自匿名版实际运行，PDF从匿名TeX重建，PDF身份与时间元数据已清理。Git提交采用匿名作者；公开仓库托管账号仍可见。

匿名化示例用于学习材料组织和复用方法，不能把示例主体、日期或权属当作新项目事实。网页字数限制来自一次可见表单，应按申请时页面更新。技术检查不代表登记机构审查或保证获证。已有AI辅助事实须如实保留，不能签署与事实不符的声明。

本仓库公开展示源代码与材料，不在此额外授予项目源码的商业使用、再许可或转让权。第三方组件和字体仍遵守其随附许可。
