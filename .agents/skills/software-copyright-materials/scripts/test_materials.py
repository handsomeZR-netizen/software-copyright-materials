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
    def test_tail_merge_respects_page_capacity(self):
        rows=[str(i) for i in range(190)]
        self.assertEqual([len(x) for x in m.source_pages(rows)],[50,50,50,40])
        self.assertEqual([len(x) for x in m.source_pages(rows,capacity=95)],[50,50,90])
        self.assertEqual(m.page_capacity({}),(72,107))
    def test_wrapped_lines_count_toward_capacity(self):
        self.assertEqual(m.visual_rows('a'*107,107),1)
        self.assertEqual(m.visual_rows('a'*108,107),2)
        self.assertEqual(m.visual_rows('中'*54,107),2)
        rows=['x'*200]*50+['y']*10
        self.assertEqual([len(x) for x in m.source_pages(rows,columns=107)],[50,10])
        self.assertEqual([len(x) for x in m.source_pages(['y']*60,columns=107)],[60])
    def test_package_files_expand_built_output_but_not_dependencies(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            for rel in ['dist/assets/app.js','dist/index.html','tests/a.test.ts','node_modules/x/i.js','tests/run.log','build/gen.py']:
                (root/rel).parent.mkdir(parents=True,exist_ok=True);(root/rel).write_text('x',encoding='utf-8')
            cfg={'_root':root.resolve(),'package_files':['dist/**','tests']}
            found={p.relative_to(cfg['_root']).as_posix() for p in m.package_paths(cfg)}
            self.assertEqual(found,{'dist/assets/app.js','dist/index.html','tests/a.test.ts'})
            with self.assertRaises(ValueError):m.project_file(cfg,'dist/index.html')
            with self.assertRaises(ValueError):m.project_file(cfg,'build/gen.py')
            cfg['allow_excluded_dirs']=['build']
            self.assertTrue(m.project_file(cfg,'build/gen.py').is_file())
            for bad in [['missing/**'],['node_modules/**'],['../**']]:
                with self.subTest(bad=bad),self.assertRaises(ValueError):
                    m.package_paths({'_root':cfg['_root'],'package_files':bad})
    def test_overfull_tolerance_and_missing_glyphs(self):
        log='Overfull \\hbox (0.4pt too wide) in paragraph\nOverfull \\hbox (3.2pt too wide) in paragraph\nOverfull \\vbox (1.5pt too high) has occurred\nMissing character: There is no X in font\n'
        self.assertEqual(len(m.layout_failures(log,1.0)),3)
        self.assertEqual(len(m.layout_failures(log,5.0)),1)
    def test_fonts_and_geometry_are_configurable(self):
        self.assertIn('fontset=windows',m.font_options('fontset=@@ctex_fontset@@',{}))
        self.assertIn('{FandolFang}',m.font_options('{@@cjk_mono_font@@}',{'cjk_mono_font':'FandolFang'}))
        with self.assertRaises(ValueError):m.font_options('x',{'ctex_fontset':'windows}\\input{x'})
        with tempfile.TemporaryDirectory() as tmp:
            tex=Path(tmp)/'main.tex'
            tex.write_text('\\usepackage[a4paper,left=20mm,right=20mm,top=30mm,bottom=25mm]{geometry}',encoding='utf-8')
            self.assertEqual(m.tex_geometry(tex,'manual'),{'top':30.0,'bottom':25.0,'left':20.0,'right':20.0})
            self.assertEqual(m.tex_geometry(Path(tmp)/'none.tex','source'),m.GEOMETRY_DEFAULTS['source'])

if __name__=='__main__':unittest.main()
