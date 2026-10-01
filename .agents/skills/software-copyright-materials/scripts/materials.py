"""Config-driven copyright material preparation. Python 3.10+, XeLaTeX, PyMuPDF, Pillow.

init creates an editable TeX skeleton; build generates real source and PDFs;
verify checks PDFs and provenance; package archives editable source and materials.
All paths are relative to the configuration file/project root, never the caller's cwd.
"""
from pathlib import Path
import argparse
import hashlib
import json
import math
import re
import shutil
import subprocess
from zipfile import ZipFile, ZIP_DEFLATED

KIT = Path(__file__).resolve().parents[1]
EXCLUDED = {'.git', 'node_modules', 'dist', 'build', '.venv', '__pycache__', '.runtime', 'tmp'}

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')

def tex_escape(value):
    replacements = {'\\': r'\textbackslash{}', '&': r'\&', '%': r'\%', '$': r'\$',
                    '#': r'\#', '_': r'\_', '{': r'\{', '}': r'\}',
                    '~': r'\textasciitilde{}', '^': r'\textasciicircum{}'}
    return ''.join(replacements.get(c, c) for c in str(value))

def read_config(path):
    path = Path(path).resolve()
    cfg = json.loads(path.read_text(encoding='utf-8-sig'))
    for key in ['software_name', 'software_version', 'copyright_owner', 'project_root', 'source_files']:
        if not cfg.get(key):
            raise ValueError('Missing required configuration: '+key)
    root = (path.parent / cfg['project_root']).resolve()
    if not root.is_dir():
        raise ValueError('Project root is not a directory: '+str(root))
    out = (root / cfg.get('output_dir', '软著材料准备包')).resolve()
    cfg['_root'], cfg['_out'] = root, out
    return cfg

def project_file(cfg, relative):
    rel = Path(relative)
    if rel.is_absolute() or any(p in EXCLUDED for p in rel.parts):
        raise ValueError('Use explicit original source/config paths, not generated/dependency files: '+str(rel))
    root = cfg['_root']
    path = (root / rel).resolve()
    if not path.is_relative_to(root) or not path.is_file():
        raise ValueError('File missing or outside project root: '+str(rel))
    return path

def source_pages(rows, per_page=50, merge_remainder=True):
    if per_page < 50:
        raise ValueError('source_lines_per_page must be >=50')
    if not rows:
        raise ValueError('No non-empty real source lines were found')
    pages = [rows[i:i+per_page] for i in range(0, len(rows), per_page)]
    if merge_remainder and len(pages) > 1 and len(pages[-1]) < 50:
        pages[-2].extend(pages.pop())
    return pages

def deposit_selection(count):
    return list(range(count)) if count <= 60 else list(range(30))+list(range(count-30, count))

def init(cfg):
    out = cfg['_out']
    folder = out / 'manual-tex'
    folder.mkdir(parents=True, exist_ok=True)
    template = (KIT / 'assets/tex-template/main.template.tex').read_text(encoding='utf-8')
    for key in ['software_name', 'software_version', 'copyright_owner', 'audience']:
        template = template.replace('@@'+key+'@@', tex_escape(cfg.get(key, '待核实')))
    date = cfg.get('development_date', '')
    template = template.replace('@@development_date@@', tex_escape(date) if date else r'\redblank{42mm}')
    target = folder / 'main.tex'
    if target.exists():
        raise FileExistsError('Existing manual preserved. Edit it directly: '+str(target))
    target.write_text(template, encoding='utf-8')
    (folder / 'figures').mkdir(exist_ok=True)
    print(target)

def generate_source(cfg):
    root, out = cfg['_root'], cfg['_out']
    folder = out / 'source-tex'
    folder.mkdir(parents=True, exist_ok=True)
    fonts = folder / 'fonts'
    shutil.copytree(KIT / 'assets/tex-template/fonts', fonts, dirs_exist_ok=True)
    rows, files, seen = [], [], set()
    for index, rel in enumerate(cfg['source_files'], 1):
        path = project_file(cfg, rel)
        if path in seen:
            raise ValueError('Duplicate source file: '+rel)
        seen.add(path)
        lines = path.read_text(encoding='utf-8-sig').splitlines()
        useful = [(i, line.expandtabs(2)) for i, line in enumerate(lines, 1) if line.strip()]
        if any(r'\end{Verbatim}' in line for _, line in useful):
            raise ValueError('Source contains TeX environment delimiter; use a separate verbatim input strategy: '+rel)
        start = len(rows)+1
        rows.extend(line for _, line in useful)
        files.append({'file': path.relative_to(root).as_posix(), 'index': index,
                      'sha256': digest(path), 'lines': len(lines), 'nonempty_lines': len(useful),
                      'deposit_line_start': start, 'deposit_line_end': len(rows),
                      'source_line_numbers': [i for i, _ in useful]})
    pages = source_pages(rows, cfg.get('source_lines_per_page', 50), cfg.get('merge_last_remainder', True))
    selected = deposit_selection(len(pages))
    preamble = (KIT / 'assets/tex-template/source.template.tex').read_text(encoding='utf-8')
    for key in ['software_name', 'software_version', 'copyright_owner']:
        preamble = preamble.replace('@@'+key+'@@', tex_escape(cfg[key]))
    size = float(cfg.get('source_font_size', 8))
    leading = float(cfg.get('source_line_height', 10))
    if not 6 <= size <= 12 or not size <= leading <= 16:
        raise ValueError('Invalid source font/leading; choose legible values and verify actual pagination')
    body, ranges = [], []
    for page in selected:
        first = sum(len(chunk) for chunk in pages[:page])+1
        ranges.append([first, first+len(pages[page])-1])
        body.append(r'\begin{Verbatim}[baselinestretch=1,fontsize=\fontsize{' + str(size) + '}{'+str(leading) +
                    r'}\selectfont,breaklines=true,breakanywhere=true,breaksymbolleft={},numbers=left,numbersep=5pt,firstnumber='+
                    str(first)+']\n'+'\n'.join(pages[page])+'\n'+r'\end{Verbatim}')
    (folder / 'main.tex').write_text(preamble+'\n\\clearpage\n'.join(body)+'\n\\end{document}\n', encoding='utf-8')
    stats = {'software': cfg['software_name']+' '+cfg['software_version'], 'files': files,
             'nonempty_source_lines': len(rows), 'full_pages': len(pages), 'submitted_pages': len(selected),
             'selected_pages': [x+1 for x in selected],
             'page_source_line_counts': [len(pages[x]) for x in selected], 'page_line_ranges': ranges,
             'note': 'Long lines wrap without inflating source line counts; blank lines omitted, comments preserved.'}
    write_json(out / '源码清单与统计.json', stats)
    return folder

def compile_tex(cfg, folder, target):
    engine = cfg.get('xelatex') or shutil.which('xelatex')
    if not engine:
        raise RuntimeError('XeLaTeX unavailable. TeX source preserved; compilation is unverified.')
    build = folder / 'build'
    build.mkdir(exist_ok=True)
    # A two-page TOC changes body pagination after the first clean build.
    # Continue until auxiliary files stabilize, instead of assuming two passes suffice.
    converged = False
    used_passes = 0
    for attempt in range(5):
        before = [digest(build/('main.'+suffix)) if (build/('main.'+suffix)).exists() else None
                  for suffix in ['aux','toc','out']]
        result = subprocess.run([engine, '-interaction=nonstopmode', '-halt-on-error',
                                 '-output-directory='+str(build), 'main.tex'], cwd=folder,
                                stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        if result.returncode:
            raise RuntimeError(result.stdout.decode('utf-8', errors='replace')[-5000:])
        after = [digest(build/('main.'+suffix)) if (build/('main.'+suffix)).exists() else None
                 for suffix in ['aux','toc','out']]
        used_passes = attempt+1
        if used_passes>=2 and before==after:
            converged = True
            break
    if not converged:
        raise RuntimeError('TOC/cross references did not stabilize after 5 passes; inspect the TeX log')
    log = (build / 'main.log').read_text(encoding='utf-8', errors='replace')
    failures = [line for line in log.splitlines() if 'Missing character:' in line or 'Overfull' in line]
    if failures:
        raise RuntimeError('Fix missing glyphs or overflowing text before delivery:\n'+'\n'.join(failures[:15]))
    shutil.copy2(build / 'main.pdf', target)
    cfg.setdefault('_compile_runs',[]).append({'file':target.name,'passes':used_passes,'auxiliary_files_stable':True})

def build(cfg):
    out = cfg['_out']
    manual = out / 'manual-tex'
    if not (manual / 'main.tex').is_file():
        raise FileNotFoundError('Run init and author the real manual before build')
    compile_tex(cfg, manual, out / '使用说明书.pdf')
    compile_tex(cfg, generate_source(cfg), out / '源程序鉴别材料.pdf')
    write_json(out/'编译收敛记录.json',cfg['_compile_runs'])
    import fitz
    full = fitz.open(out / '使用说明书.pdf')
    selection = deposit_selection(len(full))
    if len(full) > 60:
        selected = fitz.open()
        for i in selection:
            selected.insert_pdf(full, from_page=i, to_page=i)
        selected.save(out / '使用说明书_鉴别选页.pdf')
        selected.close()
    write_json(out / '文档页序.json', {'full_pages': len(full), 'selected_pages': [x+1 for x in selection],
                                      'note': 'Full manual retained; selected manual pages preserve their original header numbers.'})
    full.close()
    report = verify(cfg)
    if report['issues']:
        raise RuntimeError('Build verification failed; read 复核结果.json')

def verify(cfg):
    import fitz
    from PIL import Image, ImageDraw
    out, issues, summaries = cfg['_out'], [], []
    stats = json.loads((out / '源码清单与统计.json').read_text(encoding='utf-8'))
    for item in stats['files']:
        if digest(project_file(cfg, item['file'])) != item['sha256']:
            issues.append('Source changed after deposit extraction: '+item['file'])
    # Also prove that generated verbatim blocks contain the selected real source verbatim.
    source_rows = []
    for item in stats['files']:
        source_rows.extend(line.expandtabs(2) for line in project_file(cfg, item['file']).read_text(encoding='utf-8-sig').splitlines() if line.strip())
    source_tex = (out / 'source-tex/main.tex').read_text(encoding='utf-8')
    actual = re.findall(r'\\begin\{Verbatim\}\[[^\n]+\]\n(.*?)\n\\end\{Verbatim\}', source_tex, re.S)
    expected = ['\n'.join(source_rows[a-1:b]) for a, b in stats['page_line_ranges']]
    if actual != expected:
        issues.append('TeX source content differs from selected real source lines')
    title = cfg['software_name']
    qa = out / 'qa'
    for name, kind in [('使用说明书.pdf', 'manual'), ('源程序鉴别材料.pdf', 'source')]:
        doc = fitz.open(out / name)
        folder = qa / kind
        folder.mkdir(parents=True, exist_ok=True)
        counts = []
        if kind == 'source' and len(doc) != stats['submitted_pages']:
            issues.append('Actual source page count differs from plan; reduce line height or disable remainder merge and rebuild')
        for index, page in enumerate(doc):
            label = name+':'+str(index+1)
            if abs(page.rect.width-595.28)>2 or abs(page.rect.height-841.89)>2:
                issues.append(label+' is not A4 portrait')
            text = page.get_text()
            normalized = re.sub(r'\s+', '', text)
            header = ''.join(b[4] for b in page.get_text('blocks') if b[1]<65)
            footer = ''.join(b[4] for b in page.get_text('blocks') if b[1]>790)
            has_header = kind == 'source' or index >= cfg.get('manual_front_pages_without_header', 1)
            if has_header:
                if re.sub(r'\s+', '', title) not in re.sub(r'\s+', '', header):
                    issues.append(label+' software name missing from header')
                if re.sub(r'\s+', '', cfg['software_version']) not in re.sub(r'\s+', '', header):
                    issues.append(label+' version missing from header')
                page_no = index+1 if kind == 'source' else index+1-cfg.get('manual_front_pages_without_header', 1)
                if not re.search(r'第\s*'+str(page_no)+r'\s*页', header):
                    issues.append(label+' header page number mismatch')
                if re.sub(r'\s+', '', cfg['copyright_owner']) not in re.sub(r'\s+', '', footer):
                    issues.append(label+' copyright owner missing from footer')
            for word in cfg.get('stale_terms', []):
                if re.sub(r'\s+', '', word) in normalized:
                    issues.append(label+' stale project information: '+word)
            if any(word in text for word in ['TODO', '待编写', '示例软件名称']):
                issues.append(label+' unfinished template content')
            if '\ufffd' in text or '\uffff' in text:
                issues.append(label+' missing or replacement glyph')
            for block in page.get_text('dict')['blocks']:
                if block['type'] != 0:
                    continue
                for line in block['lines']:
                    for span in line['spans']:
                        x0,y0,x1,y1 = span['bbox']
                        if x0 < -1 or y0 < -1 or x1 > page.rect.width+1 or y1 > page.rect.height+1:
                            issues.append(label+' text outside physical page')
                        # Keep body text away from the header/footer; section of either excludes it.
                        if 55 < y0 < 790 and y1 > 787:
                            issues.append(label+' body text enters footer rule region')
            if kind == 'source':
                numbers = [int(w[4]) for w in page.get_text('words') if w[0]<39 and w[4].isdigit() and 55<w[1]<780]
                target = list(range(*[stats['page_line_ranges'][index][0], stats['page_line_ranges'][index][1]+1])) if index < len(stats['page_line_ranges']) else []
                counts.append(len(numbers))
                if numbers != target:
                    issues.append(label+' source line numbers missing, duplicated, reordered or spilled')
            else:
                is_contents = index < 6 and '. . .' in text
                if is_contents:
                    words = page.get_text('words')
                    for link in page.get_links():
                        dest = link.get('page',-1)
                        if dest < 0 or not str(link.get('nameddest','')).startswith(('section.','subsection.')):
                            continue
                        rect = link['from']
                        displayed = [int(w[4]) for w in words if w[4].isdigit() and w[0] > page.rect.width*0.8
                                     and rect.y0-1 <= (w[1]+w[3])/2 <= rect.y1+1]
                        expected = dest+1-cfg.get('manual_front_pages_without_header',1)
                        if displayed != [expected]:
                            issues.append(label+' TOC printed page differs from real destination: '+str(link.get('nameddest')))
                if index > 0 and index != len(doc)-1 and not is_contents and not page.get_images():
                    rows = {round(line['bbox'][1]) for block in page.get_text('dict')['blocks'] if block['type']==0
                            for line in block['lines'] if 65<line['bbox'][1]<780}
                    if len(rows)<30:
                        issues.append(label+' text-only non-final body page has fewer than 30 rows')
            page.get_pixmap(matrix=fitz.Matrix(1.5,1.5), alpha=False).save(folder/f'page-{index+1:03}.png')
        for start in range(0,len(doc),12):
            sheet = Image.new('RGB',(1200,1820),'#dde2e5')
            draw = ImageDraw.Draw(sheet)
            for i in range(start,min(start+12,len(doc))):
                picture = Image.open(folder/f'page-{i+1:03}.png')
                picture.thumbnail((380,425))
                x,y = (i-start)%3*400+10,(i-start)//3*455+25
                sheet.paste(picture,(x,y)); draw.text((x,y-20),str(i+1),fill='black')
            sheet.save(folder/f'contact-{start//12+1}.png')
        summaries.append({'file':name,'pages':len(doc),'source_rows':counts,'sha256':digest(out/name)})
        doc.close()
    outstanding = [key for key in ['development_date','publication_status','rights_confirmed'] if not cfg.get(key)]
    report = {'status':'technical_checks_passed' if not issues else 'failed', 'issues':issues, 'pdfs':summaries,
              'outstanding_human_fields':outstanding, 'visual_review':'required: inspect every contact sheet and important full-size pages',
              'platform_requirements':'recheck latest official form; this report is not registration approval'}
    write_json(out/'复核结果.json',report)
    print(json.dumps(report,ensure_ascii=False,indent=2))
    return report

def package(cfg):
    out, root = cfg['_out'], cfg['_root']
    report = verify(cfg)
    if report['issues']:
        raise RuntimeError('Resolve verification issues before packaging')
    files = sorted(set(project_file(cfg, rel) for rel in cfg['source_files']+cfg.get('package_files', [])))
    records = [{'path':p.relative_to(root).as_posix(),'sha256':digest(p)} for p in files]
    source_zip = out/'完整源码.zip'
    with ZipFile(source_zip,'w',ZIP_DEFLATED) as archive:
        for path in files:
            archive.write(path,path.relative_to(root).as_posix())
        archive.writestr('源码文件校验.json',json.dumps(records,ensure_ascii=False,indent=2))
    with ZipFile(source_zip) as archive:
        if archive.testzip():
            raise RuntimeError('ZIP CRC failure')
        for item in records:
            if hashlib.sha256(archive.read(item['path'])).hexdigest()!=item['sha256']:
                raise RuntimeError('ZIP source hash mismatch')
    # Complete material archive also contains TeX, images, provenance, review and source ZIP.
    material_files = sorted(p for p in out.rglob('*') if p.is_file() and
                            not set(p.relative_to(out).parts)&{'build','qa'} and p.name not in {'完整交付.zip','交付文件校验.json'}
                            and p.suffix not in {'.log','.aux','.out','.toc'})
    manifest = [{'path':p.relative_to(out).as_posix(),'sha256':digest(p)} for p in material_files]
    write_json(out/'交付文件校验.json',manifest)
    with ZipFile(out/'完整交付.zip','w',ZIP_DEFLATED) as archive:
        for path in material_files+[out/'交付文件校验.json']:
            archive.write(path,path.relative_to(out).as_posix())
    with ZipFile(out/'完整交付.zip') as archive:
        if archive.testzip():
            raise RuntimeError('Material ZIP CRC failure')
        for item in manifest:
            if hashlib.sha256(archive.read(item['path'])).hexdigest()!=item['sha256']:
                raise RuntimeError('Material ZIP hash mismatch: '+item['path'])
    print(source_zip); print(out/'完整交付.zip')

if __name__=='__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation',choices=['init','build','verify','package'])
    parser.add_argument('--config',required=True,type=Path)
    args = parser.parse_args()
    try:
        cfg = read_config(args.config)
        result = globals()[args.operation](cfg)
        if args.operation=='verify' and result['issues']:
            raise SystemExit(1)
    except (ValueError,RuntimeError,FileNotFoundError,FileExistsError) as error:
        parser.exit(1,str(error)+'\n')
