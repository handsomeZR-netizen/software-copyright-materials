"""Tests for the advisory style scanner."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('style_scan', Path(__file__).with_name('style_scan.py'))
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)


class StyleScanTests(unittest.TestCase):
    def scan(self, name, text, prose=True):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp)/name
            path.write_text(text, encoding='utf-8')
            found = []
            if name.endswith('.py'):
                s.scan_python(path, name, found)
            s.scan_text(path, name, found, prose)
            return [message for _, _, message in found]

    def test_generated_comment_patterns(self):
        code = ('# -*- coding: utf-8 -*-\n"""\n界面模块\n负责：\n1. 列表\n2. 表单\n"""\n'
                '# =========================\n# 行0：编号\nx = 1  # 保持质朴外观\n# 右侧：规则 상세录入\n')
        messages = ' '.join(self.scan('a.py', code, prose=False))
        for expected in ['coding', '横幅', '逐行标号', '质朴', '文件头', '韩文']:
            self.assertIn(expected, messages)

    def test_bullet_lists_block(self):
        tex = '正文一段。\n\\begin{itemize}\n  \\item 作品管理\n\\end{itemize}\n% \\item 注释里的不算\n'
        found = s.blocking_in_text(tex, 'main.tex', tex=True)
        self.assertEqual([line for _, line, _ in found], [2, 3])
        md = '## 需要本人确认\n\n- 开发完成日期：待填。\n• 发表状态\n| 字段 | 值 |\n| --- | --- |\n```text\n- 代码块里的不算\n```\n'
        found = s.blocking_in_text(md, 'a.md')
        self.assertEqual([line for _, line, _ in found], [3, 4])
        self.assertEqual(s.blocking_in_text('开发完成日期是2026年11月3日，发表状态按未发表填写。', 'b.md'), [])

    def test_aligned_trailing_comments(self):
        code = ''.join(f'COLOR_{i} = "#00000{i}"   # 颜色{i}\n' for i in range(6))
        self.assertIn('对齐成一列', ' '.join(self.scan('c.py', code, prose=False)))
        loose = 'a = 1  # 先算\nbb = 2\nc = 3  # 再算\n'
        self.assertEqual(self.scan('d.py', loose, prose=False), [])

    def test_uniform_headers(self):
        with tempfile.TemporaryDirectory() as tmp:
            paths = []
            for i in range(5):
                p = Path(tmp)/f'm{i}.py'
                header = '"""\n第一行\n第二行\n第三行\n"""\n' if i < 4 else '"""一句话。"""\n'
                p.write_text(header+'x = 1\n', encoding='utf-8')
                paths.append(p)
            self.assertTrue(s.uniform_headers(paths))
            for p in paths[:2]:
                p.write_text('x = 1\n', encoding='utf-8')
            self.assertEqual(s.uniform_headers(paths), [])

    def test_plain_code_is_quiet(self):
        code = '"""阶段规则页。"""\n\n\ndef load():\n    # 先 pack 按钮，窗口矮时才不会被挤出去\n    return 1\n'
        self.assertEqual(self.scan('b.py', code, prose=False), [])

    def test_prose_patterns(self):
        text = ('本说明书面向第一次使用本软件的教师。\n这不是软件坏了，而是还没有数据。\n小提示：先备份。\n'
                '\\subsection{签名是什么}\n\\subsection{怎么筛选}\n\\subsection{为什么备份}\n\\subsection{数据存在哪里？}\n')
        messages = ' '.join(self.scan('m.tex', text))
        for expected in ['本说明书面向', '这不是', '小提示', '问句式标题']:
            self.assertIn(expected, messages)

    def test_defensive_and_contrast_wording_blocks(self):
        text = ('前一步没做完时列表为空，这不是故障。\n本清单不代表已提交。\n正式填写以网页计数器为准。\n'
                '截图仅供参考。\n用镊子而不是手拨游码。\n正常关闭不会丢失内容。\n它不仅能导出，而且能备份。\n'
                '得分不作为正式考试评定。\n不调用摄像头识别或云端模型。\n'
                '当前版本不提供导入恢复界面。\n演示轮次不能解释为真实成绩。\n旧轮次不会被新轮次的操作覆盖。\n')
        found = s.blocking_in_text(text, 'm.md')
        self.assertEqual(sorted({line for _, line, _ in found}), list(range(1, 13)))

    def test_plain_prose_passes_blocking(self):
        text = ('阶段规则页把每个实验分为准备与调平等四个阶段。\n点保存后内容立即写入硬盘。\n'
                '% 示例数据，不代表真实申请\n各自的数据互不影响。\n'
                '软件在本机运行，不需要联网，也不需要注册账号。\n编号不能空，长度 4 至 24 位。\n')
        self.assertEqual(s.blocking_in_text(text, 'm.tex', tex=True), [])

    def test_blocking_findings_reads_manual_checklist_and_web_form(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            (base/'manual-tex').mkdir()
            (base/'manual-tex'/'main.tex').write_text('这不是软件坏了。\n', encoding='utf-8')
            (base/'申请信息填写清单.md').write_text('本清单不代表已通过审查。\n', encoding='utf-8')
            (base/'web-form.json').write_text('{"main_functions": "仅供演示"}', encoding='utf-8')
            cfg = {'_out': base, '_materials': base, '_base': base}
            labels = {label for label, _, _ in s.blocking_findings(cfg)}
            self.assertEqual(labels, {'manual-tex/main.tex', '申请信息填写清单.md', 'web-form.json'})

    def test_single_faq_heading_allowed(self):
        self.assertEqual(self.scan('m.tex', '\\subsection{启动不了怎么办}\n按顺序排查。\n'), [])

    def test_compare_ast_ignores_comments_only(self):
        with tempfile.TemporaryDirectory() as tmp:
            old, new = Path(tmp)/'old', Path(tmp)/'new'
            old.mkdir(); new.mkdir()
            (old/'m.py').write_text('"""模块说明"""\n# 注释\ndef f():\n    """复述"""\n    return 1\n', encoding='utf-8')
            (new/'m.py').write_text('def f():\n    return 1\n', encoding='utf-8')
            self.assertEqual(s.compare_ast(old, new), [])
            (new/'m.py').write_text('def f():\n    return 2\n', encoding='utf-8')
            self.assertEqual(s.compare_ast(old, new), ['m.py'])


if __name__ == '__main__':
    unittest.main()
