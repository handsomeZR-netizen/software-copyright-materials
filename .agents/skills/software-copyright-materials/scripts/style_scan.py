"""Flag text that reads as machine-generated in copyright deliverables; see references/natural-writing.md.

Defensive wording, “不是……而是” contrasts and bullet (小圆点) lists are blocking in the manual, checklist
and portal text: materials.py verify reports them as issues. In README and other package text they are advisory.

python style_scan.py --config config.json             scan source files, manual TeX, checklist, web-form.json, package text
python style_scan.py --config config.json --strict    exit 1 when anything is found
python style_scan.py --compare-ast OLD_DIR NEW_DIR    prove a comment rewrite left Python code unchanged
"""
from pathlib import Path
import argparse
import ast
import importlib.util
import io
import json
import re
import sys
import tokenize

# Stray Hangul/Kana inside Chinese text is a typical generation glitch, never intended.
FOREIGN_SCRIPT = re.compile(r'[\uac00-\ud7af\u3040-\u309f\u30a0-\u30ff]')
CODING_LINE = re.compile(r'^#.*-\*-\s*coding[:=]')
BANNER = re.compile(r'^\s*(#|//)\s*[=\-*~]{8,}')
ROW_COMMENT = re.compile(r'^\s*(#|//)\s*(第[一二三四五六七八九十\d]+行|行\d+)\s*[：:]')
SPEC_WORDS = re.compile(r'质朴|简洁大方|优雅|高端大气|专业级|无缝|赋能|一站式|全方位|极致|强大的')
BLOCKING_PATTERNS = [
    (re.compile(r'(不是|并非|并不是)[^。！？；\n]{0,30}而是|而不是|而非|不仅[^。！？\n]{0,30}(而且|更|还)|与其说[^。\n]{0,20}不如说|'
                r'这(不是|并非)|不是(故障|问题|bug|软件坏了)'), '“不是……而是”式对比'),
    (re.compile(r'仅供(参考|演示|展示|参照)|仅用于(演示|展示)|仅为(演示|示例)|不代表|不构成|免责|不保证|不承担|'
                r'如有(出入|疑问|不符)|以[^。；，、\n]{1,15}为准|尚未实现|未实现的|不涉及|无需担心|不必担心|'
                r'不作为[^。；\n]{0,15}(依据|评定|认证|证明|结论)|不(调用|采集|收集|上传)|不包含任何|'
                r'不提供|暂不支持|(当前|本)版本[^。，；\n]{0,4}(不|暂未)|不会被[^。，；\n]{0,8}覆盖|不自行|'
                r'不能(解释|视为|作为|当作)|不应(被)?(视为|理解)|'
                r'不会(丢失|乱码|出错|损坏|影响)|请注意|需要注意的是|值得注意的是|特此说明'), '防御性语言'),
]
# 交付文字一律写成段落：说明书不用 itemize/\item/\textbullet，清单和网页文本不用“- ”“•”开头的小圆点列表。
BULLET_TEX = re.compile(r'\\begin\{itemize\}|\\item\b|\\textbullet|\\bullet\b')
BULLET_LINE = re.compile(r'^\s*([-*+]|[•●▪◦·])\s*\S')
BULLET_GLYPH = re.compile(r'[•●▪◦]')
STYLE_PATTERNS = [
    (re.compile(r'本(说明书|手册|文档)(面向|适用于|旨在|将)'), '封面或开头的“本说明书面向/适用于……”小字'),
    (re.compile(r'小提示[：:]|温馨提示|值得一提的是'), '提示腔标签'),
    (re.compile(r'不妨|放心(修改|使用)?|一眼就能|轻松(完成|实现)|讲起来更有底|比较放心'), '口头安抚或夸张'),
    (re.compile(r'至关重要|赋能|无缝|一站式|全方位|打造|助力|深度融合|切勿|严格一致'), '宣传或命令腔词汇'),
    (re.compile(r'总账本|好帮手|小助手'), '比喻'),
]
QUESTION_HEADING = re.compile(r'\\(?:sub)*section\*?\{[^}]*(什么|怎么|为什么|哪几|吗|？|\?)[^}]*\}|^#+ .*(什么|怎么|为什么|哪几|吗|？)')
WEB_FORM_TEXT = ['purpose', 'industry', 'main_functions', 'technical_features']


def load_materials():
    spec = importlib.util.spec_from_file_location('materials', Path(__file__).with_name('materials.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def scan_python(path, rel, findings):
    src = path.read_text(encoding='utf-8-sig')
    lines = src.splitlines()
    if lines and CODING_LINE.match(lines[0]):
        findings.append((rel, 1, 'Python 3 不需要的 coding 声明'))
    try:
        tokens = list(tokenize.generate_tokens(io.StringIO(src).readline))
        tree = ast.parse(src)
    except (SyntaxError, tokenize.TokenError):
        return
    rows = 0
    trailing = []  # (line, column) of comments that follow code on the same line
    for tok in tokens:
        if tok.type != tokenize.COMMENT:
            continue
        line = lines[tok.start[0]-1]
        if line[:tok.start[1]].strip():
            trailing.append(tok.start)
        if BANNER.match(line):
            findings.append((rel, tok.start[0], '横幅分隔注释'))
        elif ROW_COMMENT.match(line):
            rows += 1
            if rows <= 3:
                findings.append((rel, tok.start[0], '逐行标号注释（行0：/第1行：），界面代码自身已能看出'))
        if SPEC_WORDS.search(tok.string):
            findings.append((rel, tok.start[0], '注释里出现需求或宣传用语：'+SPEC_WORDS.search(tok.string).group(0)))
    run = []
    for start in trailing + [(None, None)]:
        if run and start[0] == run[-1][0]+1 and start[1] == run[0][1]:
            run.append(start)
            continue
        if len(run) >= 5:
            findings.append((rel, run[0][0], f'连续 {len(run)} 行的行尾注释对齐成一列'))
        run = [start] if start[0] else []
    functions =[n for n in ast.walk(tree) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))]
    documented = [n for n in functions if ast.get_docstring(n)]
    if len(functions) >= 6 and len(documented) / len(functions) > 0.6:
        findings.append((rel, 1, f'{len(documented)}/{len(functions)} 个函数带文档字符串，多数在复述函数名'))
    module_doc = ast.get_docstring(tree) or ''
    if re.search(r'(^|\n)\s*\d+[.、]\s*\S', module_doc) or ('模块' in module_doc and '负责' in module_doc):
        findings.append((rel, 1, '“XX模块 / 负责…… / 包含：1. 2.”式文件头'))
    for node in [tree] + functions + [n for n in ast.walk(tree) if isinstance(n, ast.ClassDef)]:
        doc = ast.get_docstring(node) or ''
        if '【' in doc:
            findings.append((rel, node.body[0].lineno, '文档字符串里用【】强调'))


def prose_lines(text, tex=False):
    """Numbered lines of reader-facing prose; TeX comments are not printed and are skipped."""
    for number, line in enumerate(text.splitlines(), 1):
        if tex:
            line = re.sub(r'(?<!\\)%.*', '', line)
        yield number, line


def bullets_in_text(text, rel, tex=False):
    found = []
    fence = False
    for number, line in prose_lines(text, tex):
        if line.lstrip().startswith('```'):
            fence = not fence
            continue
        if fence:
            continue
        if tex:
            match = BULLET_TEX.search(line)
        else:
            match = BULLET_LINE.match(line) if not re.match(r'^\s*[-*]{3,}\s*$', line) else None
        match = match or BULLET_GLYPH.search(line)
        if match:
            found.append((rel, number, '小圆点列表，改写成段落：'+match.group(0).strip()))
    return found


def blocking_in_text(text, rel, tex=False):
    found = []
    for number, line in prose_lines(text, tex):
        for pattern, message in BLOCKING_PATTERNS:
            for match in pattern.finditer(line):
                found.append((rel, number, message+'：'+match.group(0)))
    found.extend(bullets_in_text(text, rel, tex))
    return found


def scan_text(path, rel, findings, prose=True):
    text = path.read_text(encoding='utf-8-sig', errors='replace')
    tex = path.suffix == '.tex'
    questions = []
    for number, line in prose_lines(text, tex):
        if FOREIGN_SCRIPT.search(line):
            findings.append((rel, number, '中文里混入韩文/日文字符：'+FOREIGN_SCRIPT.search(line).group(0)))
        if not prose:
            continue
        for pattern, message in STYLE_PATTERNS:
            match = pattern.search(line)
            if match:
                findings.append((rel, number, message+'：'+match.group(0)))
        if QUESTION_HEADING.search(line):
            questions.append(number)
    if not prose:
        return
    findings.extend(blocking_in_text(text, rel, tex))
    # One FAQ heading such as “启动不了怎么办” is natural; a run of them is a pattern.
    if len(questions) >= 4:
        findings.append((rel, questions[0], f'{len(questions)} 个问句式标题（行 {", ".join(map(str, questions))}）'))
    dashes = text.count('——')
    if dashes >= 3:
        findings.append((rel, 1, f'破折号“——”出现 {dashes} 次'))
    bold = text.count('**')//2 + text.count('\\textbf{')
    paragraphs = max(1, len([p for p in re.split(r'\n\s*\n', text) if p.strip()]))
    if bold >= 10 and bold / paragraphs > 0.5:
        findings.append((rel, 1, f'加粗 {bold} 处，平均每段超过半处'))


def web_form_paths(cfg):
    return [p for p in dict.fromkeys([cfg['_out']/'web-form.json', cfg.get('_base', cfg['_out'])/'web-form.json']) if p.is_file()]


def web_form_text(path):
    form = json.loads(path.read_text(encoding='utf-8-sig'))
    return '\n'.join(str(form.get(key, '')) for key in WEB_FORM_TEXT)


def deliverable_texts(cfg, checklist_name):
    """Reader-facing prose the user hands in or pastes into the portal: (label, path, text, is_tex)."""
    items = []
    manual = cfg['_out']/'manual-tex'/'main.tex'
    if manual.is_file():
        items.append(('manual-tex/main.tex', manual, manual.read_text(encoding='utf-8-sig'), True))
    checklist = cfg['_materials']/checklist_name
    if checklist.is_file():
        items.append((checklist_name, checklist, checklist.read_text(encoding='utf-8-sig'), False))
    for path in web_form_paths(cfg):
        items.append(('web-form.json', path, web_form_text(path), False))
    return items


def blocking_findings(cfg, checklist_name='申请信息填写清单.md'):
    """Called by materials.py verify: defensive wording and 不是……而是 contrasts block delivery."""
    found = []
    for label, _, text, tex in deliverable_texts(cfg, checklist_name):
        found.extend(blocking_in_text(text, label, tex))
    return found


def uniform_headers(paths):
    """Most files opening with the same multi-line header looks templated, even if each header is fine."""
    multi = []
    for path in paths:
        try:
            doc = ast.get_docstring(ast.parse(path.read_text(encoding='utf-8-sig'))) or ''
        except SyntaxError:
            continue
        if len([l for l in doc.splitlines() if l.strip()]) >= 2:
            multi.append(path.name)
    if len(paths) >= 5 and len(multi) / len(paths) >= 0.7:
        return [('*.py', 1, f'{len(multi)}/{len(paths)} 个文件都以多行文件头开头，过于整齐')]
    return []


def scan_config(path):
    m = load_materials()
    cfg = m.read_config(path)
    findings = []
    sources = {m.project_file(cfg, rel) for rel in cfg['source_files']}
    for file in sorted(sources):
        rel = file.relative_to(cfg['_root']).as_posix()
        if file.suffix == '.py':
            scan_python(file, rel, findings)
        scan_text(file, rel, findings, prose=False)
    findings.extend(uniform_headers([f for f in sorted(sources) if f.suffix == '.py']))
    for file in sorted(m.package_paths(cfg) - sources):
        if file.suffix.lower() in {'.md', '.txt', '.rst'}:
            scan_text(file, file.relative_to(cfg['_root']).as_posix(), findings)
        elif file.suffix == '.py':
            scan_python(file, file.relative_to(cfg['_root']).as_posix(), findings)
    for label, file, text, _ in deliverable_texts(cfg, m.CHECKLIST):
        if label == 'web-form.json':
            findings.extend(blocking_in_text(text, label))
        else:
            scan_text(file, label, findings)
    return findings


def strip_docstrings(src):
    tree = ast.parse(src)
    for node in ast.walk(tree):
        if isinstance(node, (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
            body = node.body
            if body and isinstance(body[0], ast.Expr) and isinstance(getattr(body[0], 'value', None), ast.Constant) \
                    and isinstance(body[0].value.value, str):
                body = body[1:]
            node.body = [s for s in body if not isinstance(s, ast.Pass)] or [ast.Pass()]
    return ast.dump(tree)


def compare_ast(old_root, new_root):
    changed = []
    for new in sorted(Path(new_root).rglob('*.py')):
        old = Path(old_root)/new.relative_to(new_root)
        if not old.is_file() or strip_docstrings(old.read_text(encoding='utf-8-sig')) != strip_docstrings(new.read_text(encoding='utf-8-sig')):
            changed.append(new.relative_to(new_root).as_posix())
    return changed


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--config', type=Path)
    parser.add_argument('--strict', action='store_true')
    parser.add_argument('--compare-ast', nargs=2, metavar=('OLD_DIR', 'NEW_DIR'))
    args = parser.parse_args()
    if args.compare_ast:
        changed = compare_ast(*args.compare_ast)
        print('code changed in: '+', '.join(changed) if changed else 'only comments and docstrings differ')
        sys.exit(1 if changed else 0)
    if not args.config:
        parser.error('--config or --compare-ast is required')
    found = scan_config(args.config)
    for rel, line, message in found:
        print(f'{rel}:{line}: {message}')
    print(f'{len(found)} findings')
    sys.exit(1 if args.strict and found else 0)
