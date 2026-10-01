import json
from pathlib import Path
import unittest
from check_web_form import check, browser_length

class WebFormTests(unittest.TestCase):
    def setUp(self):
        self.schema=json.loads((Path(__file__).resolve().parents[1]/'references/web-form-schema.json').read_text(encoding='utf-8'))
        self.values={key: '实际内容' for key in self.schema['fields']}
        self.values.update(short_name='',languages=['Python'],source_lines=100,technical_category=['教育软件'],main_functions='测'*500)
    def test_valid_bounds_and_blank_abbreviation(self):
        self.assertTrue(check(self.values,self.schema)['passed'])
        self.values['main_functions']='测'*1300
        self.assertTrue(check(self.values,self.schema)['passed'])
    def test_limits_reject_too_short_and_long(self):
        for key,value in [('main_functions','测'*499),('main_functions','测'*1301),('purpose','测'*51),('technical_features','测'*101)]:
            with self.subTest(key=key,length=len(value)):
                data=dict(self.values);data[key]=value
                self.assertFalse(check(data,self.schema)['passed'])
    def test_source_units_and_fake_abbreviation_rejected(self):
        for value in ['100行',True,0]:
            data=dict(self.values);data['source_lines']=value
            self.assertFalse(check(data,self.schema)['passed'])
        self.values['short_name']='无'
        self.assertFalse(check(self.values,self.schema)['passed'])
    def test_browser_unicode_length(self):
        self.assertEqual(browser_length('中文A\U0001f600'),5)

if __name__=='__main__': unittest.main()
