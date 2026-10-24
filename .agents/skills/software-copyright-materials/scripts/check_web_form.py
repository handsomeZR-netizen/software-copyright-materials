"""Validate webpage application fields against observed, replaceable limits."""
from pathlib import Path
import argparse
import json

SCHEMA = Path(__file__).resolve().parents[1] / 'references/web-form-schema.json'

def browser_length(value):
    return len(value.encode('utf-16-le')) // 2

def check(values, schema, stats=None):
    errors, counts = [], {}
    if stats is not None and values.get('source_lines') != stats.get('nonempty_source_lines'):
        errors.append('source_lines: ' + str(values.get('source_lines')) + ' differs from 源码清单与统计.json nonempty_source_lines '
                      + str(stats.get('nonempty_source_lines')))
    for key, rule in schema['fields'].items():
        value = values.get(key)
        if value is None or value == '' or value == []:
            if rule.get('required'):
                errors.append(key + ': required field missing')
            continue
        kind = rule.get('type', 'text')
        if kind == 'positive_integer':
            if isinstance(value, bool) or not isinstance(value, int) or value < 1:
                errors.append(key + ': use a positive integer without a unit')
            continue
        if kind == 'list':
            if not isinstance(value, list) or not all(isinstance(v, str) and v.strip() for v in value):
                errors.append(key + ': use a list of selected language/category names')
            continue
        if not isinstance(value, str):
            errors.append(key + ': text required')
            continue
        count = browser_length(value)
        counts[key] = count
        if count < rule.get('min', 0) or count > rule.get('max', float('inf')):
            errors.append(key + ': length ' + str(count) + ' outside observed limits')
        if key == 'short_name' and value.strip() in {'无', '没有', '暂无'}:
            errors.append(key + ': leave empty when no actual abbreviation exists')
    return {'passed': not errors, 'errors': errors, 'lengths': counts,
            'schema_observed_date': schema.get('observed_date'),
            'note': 'Actual current portal fields and counter take precedence.'}

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, required=True)
    parser.add_argument('--schema', type=Path, default=SCHEMA)
    parser.add_argument('--stats', type=Path, help='源码清单与统计.json; source_lines must equal its nonempty_source_lines')
    args = parser.parse_args()
    result = check(json.loads(args.input.read_text(encoding='utf-8-sig')),
                   json.loads(args.schema.read_text(encoding='utf-8-sig')),
                   json.loads(args.stats.read_text(encoding='utf-8-sig')) if args.stats else None)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    raise SystemExit(0 if result['passed'] else 1)
