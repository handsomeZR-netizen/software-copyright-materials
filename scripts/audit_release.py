"""Check publishable files for blocked identifiers, credentials and local paths.

Pass any private identifier list from OUTSIDE the public repository.
Image pixels still require visual review; this script checks only image metadata.
"""
from pathlib import Path
import argparse
import json
import re
import subprocess

TEXT_EXT={'.md','.json','.py','.tex','.ps1','.cmd','.ts','.tsx','.js','.css','.html','.yml','.yaml','.txt'}

def audit(root, blocked):
    paths=[root/name for name in subprocess.check_output(['git','ls-files','-z'],cwd=root).decode().split('\0') if name]
    issues=[]; scanned=0
    credential=re.compile(r'(?:gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{24,}|-----BEGIN (?:RSA |OPENSSH )?PRIVATE KEY-----)')
    local_path=re.compile(r'[A-Za-z]:[\\/](?:Users|desktop)[\\/]',re.I)
    for path in paths:
        rel=path.relative_to(root).as_posix();scanned+=1
        if any(value in rel for value in blocked):issues.append({'file':rel,'reason':'blocked identifier in filename'})
        text=''
        if path.suffix=='.pdf':
            import fitz
            with fitz.open(path) as doc:
                text='\n'.join(p.get_text() for p in doc)+json.dumps(doc.metadata,ensure_ascii=False)+json.dumps(doc.get_toc(),ensure_ascii=False)
        elif path.suffix in {'.png','.jpg','.jpeg'}:
            from PIL import Image
            with Image.open(path) as image:text=json.dumps(image.info,default=str,ensure_ascii=False)
        elif path.suffix in TEXT_EXT or path.name in {'.gitignore','LICENSE'}:
            raw=path.read_bytes()
            text='\n'.join(raw.decode(enc,errors='replace') for enc in ['utf-8-sig','gb18030','cp1252'])
        if any(value in text for value in blocked):issues.append({'file':rel,'reason':'blocked identifier in file content/metadata'})
        if credential.search(text):issues.append({'file':rel,'reason':'possible credential'})
        if local_path.search(text):issues.append({'file':rel,'reason':'private absolute machine path'})
    return {'passed':not issues,'tracked_files_scanned':scanned,'issues':issues,'image_pixel_review':'required separately'}

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1])
    parser.add_argument('--blocklist',type=Path,required=True)
    args=parser.parse_args()
    result=audit(args.root.resolve(),json.loads(args.blocklist.read_text(encoding='utf-8-sig')))
    print(json.dumps(result,ensure_ascii=False,indent=2))
    raise SystemExit(0 if result['passed'] else 1)
