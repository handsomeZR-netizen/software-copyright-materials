"""Focused tests for reusable pagination, project isolation and source extraction."""
import importlib.util
from pathlib import Path
import json
import tempfile
import unittest

spec=importlib.util.spec_from_file_location('materials',Path(__file__).with_name('materials.py'))
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class MaterialsTests(unittest.TestCase):
    def test_page_selection_boundary(self):
        self.assertEqual(m.deposit_selection(60),list(range(60)))
        self.assertEqual(m.deposit_selection(61),list(range(30))+list(range(31,61)))
        self.assertEqual(len(m.deposit_selection(120)),60)
    def test_remainder_keeps_real_rows(self):
        rows=[str(i) for i in range(2756)]
        pages=m.source_pages(rows)
        self.assertEqual([len(x) for x in pages],[50]*54+[56])
        self.assertEqual([x for page in pages for x in page],rows)
        self.assertEqual(len(m.source_pages(rows,merge_remainder=False)),56)
        with self.assertRaises(ValueError):m.source_pages(rows,49)
    def test_paths_metadata_and_exact_selected_source(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp); project=root/'新项目'; project.mkdir()
            (project/'main.py').write_text('# 作者原注释\n\nprint("真实功能")\n',encoding='utf-8')
            cfgpath=root/'config.json'
            cfgpath.write_text(json.dumps({'software_name':'新项目验证系统','software_version':'V3.2',
                                          'copyright_owner':'测试主体','project_root':'新项目',
                                          'source_files':['main.py'],'package_files':[]},ensure_ascii=False),encoding='utf-8')
            cfg=m.read_config(cfgpath)
            folder=m.generate_source(cfg)
            tex=(folder/'main.tex').read_text(encoding='utf-8')
            self.assertIn('新项目验证系统 V3.2',tex)
            self.assertIn('著作权人：测试主体',tex)
            self.assertNotIn('旧项目主体',tex)
            self.assertNotIn('旧项目标识',tex)
            self.assertIn('# 作者原注释\nprint("真实功能")',tex)
            stats=json.loads((cfg['_out']/'源码清单与统计.json').read_text(encoding='utf-8'))
            self.assertEqual(stats['files'][0]['source_line_numbers'],[1,3])
            self.assertEqual(stats['page_line_ranges'],[[1,2]])
            self.assertEqual(stats['nonempty_source_lines'],2)
            m.init(cfg)
            manual=(cfg['_out']/'manual-tex/main.tex').read_text(encoding='utf-8')
            self.assertNotIn('旧模板名称',manual)
            self.assertNotIn('2026 年 5 月 2 日',manual)
            with self.assertRaises(FileExistsError):m.init(cfg)
            outside=root/'outside.py'; outside.write_text('secret',encoding='utf-8')
            with self.assertRaises(ValueError):m.project_file(cfg,'../outside.py')
            with self.assertRaises(ValueError):m.project_file(cfg,str(outside))
            with self.assertRaises(ValueError):m.project_file(cfg,'node_modules/lib.js')
            cfg['source_files']=['main.py','main.py']
            with self.assertRaises(ValueError):m.generate_source(cfg)
    def test_empty_source_refused(self):
        with self.assertRaises(ValueError):m.source_pages([])

if __name__=='__main__':unittest.main()
