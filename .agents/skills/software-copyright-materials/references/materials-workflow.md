# 材料制作与复核

阅读requirements.md及sources.md，官方原文链接见sources.md。一般交存分别判断程序和文档：不足60页交全部，超过60页前后各连续30页；除特定情形外，代码每页不少于50行、文档每页不少于30行，A4。特殊页面按具体内容与当时要求核对，不能推导统一最低说明书页数。

assets/tex-template为参数化TeX骨架及字体许可，模板事实全部替换为新项目数据。骨架存在待编写内容，完成真实正文与截图后才能验收。保留著作权人的真实归属，旧署名不套用。

将config.example.json复制到新项目外或项目中，填写实际project_root、output_dir、名称/版本/主体、真实date及权属状态；按实际枚举source_files和package_files。开发日期、权属或发表未确认时保留待补，不妨碍技术准备。脚本需要Python3.10+、PyMuPDF和Pillow及既有XeLaTeX，设置xelatex字段可指定其绝对路径。

python /绝对路径/scripts/materials.py init --config /绝对路径/config.json
python /绝对路径/scripts/materials.py build --config /绝对路径/config.json
python /绝对路径/scripts/materials.py verify --config /绝对路径/config.json
python /绝对路径/scripts/materials.py package --config /绝对路径/config.json

init不覆盖已存在的TeX；后续直接编辑。build最多五次编译到目录和交叉引用稳定，超60页另外保存提交选页版，并保留完整原稿。源码50行分页，短末尾可合并，但实际长行溢出时须调整分页/行距，禁止删代码。源码量以可解释的真实原始行数统计，不算生成JS或依赖。

verify会核对源码/TeX/原文件哈希、行号顺序、PDF边界、页眉页脚、纯文本页行数、旧信息及目录真实链接目标；不能替代目视。检查全部联系页、关键完整页，封面日期、目录、分页表格、长代码、页脚间距尤其要检查。修订后重打包，保留检查命令、结果和待确认项。

package的ZIP用于制作验收，最终面向用户整理为delivery-layout.md的两部分；要保留运行资源和配置，不能依赖示例package_files默认范围。已有打包代码时先安全解压，确保目标路径在临时工作目录内。
