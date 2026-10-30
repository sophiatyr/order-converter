from pathlib import Path
import zipfile,json,copy,re,xml.etree.ElementTree as E
ns={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'};m='{'+ns['m']+'}'
E.register_namespace('',ns['m']);E.register_namespace('r','http://schemas.openxmlformats.org/officeDocument/2006/relationships')
p=Path('CSQ參考資料/訂單追蹤/訂單進度.xlsx');out=Path('public/csq-internal-tracking-template.xlsx');meta=Path('public/csq-internal-tracking-template.json')
if not p.exists():
 if out.exists() and meta.exists():raise SystemExit('Existing internal tracking template retained.')
 raise SystemExit('Missing internal tracking reference workbook')
with zipfile.ZipFile(p) as z:
 root=E.fromstring(z.read('xl/worksheets/sheet1.xml'));strings=E.fromstring(z.read('xl/sharedStrings.xml'));ss=strings.findall('m:si',ns)
 def val(c):
  v=c.find('m:v',ns)
  return ''.join(ss[int(v.text)].itertext()) if c.get('t')=='s' and v is not None else (v.text if v is not None else '')
 rates={}
 for c in root.findall('.//m:c',ns):
  f=c.find('m:f',ns)
  if c.get('r','').startswith('M') and f is not None and f.text:
   match=re.fullmatch(r'L\d+/([0-9.]+)',f.text)
   if match:rates[int(c.get('r')[1:])]=float(match[1])
 for merge in root.findall('m:mergeCells/m:mergeCell',ns):
  match=re.fullmatch(r'M(\d+):M(\d+)',merge.get('ref',''))
  if match and int(match[1]) in rates:
   for ri in range(int(match[1]),int(match[2])+1):rates[ri]=rates[int(match[1])]
 records=[];shared={}
 for row in root.findall('m:sheetData/m:row',ns):
  ri=int(row.get('r'));cells={re.sub(r'\d','',c.get('r')):c for c in row}
  formulas={}
  for key,c in cells.items():
   f=c.find('m:f',ns)
   if f is not None and f.text: formulas[key]=f.text
  if ri>=5:
   records.append({'row':ri,'sc':val(cells.get('A',E.Element('c'))),'po':val(cells.get('B',E.Element('c'))),'style':val(cells.get('O',E.Element('c'))),'factory':val(cells.get('J',E.Element('c'))),'conversionRate':rates.get(ri),'hasTotals':bool(val(cells.get('H',E.Element('c')))) and bool(val(cells.get('L',E.Element('c'))))})
  for c in row:
   if ri<5 and c.get('t')=='s':
    idx=int(c.find('m:v',ns).text);[c.remove(x) for x in list(c)];c.set('t','inlineStr');inline=E.SubElement(c,m+'is');[inline.append(copy.deepcopy(x)) for x in ss[idx]]
   elif ri>=5:
    [c.remove(x) for x in list(c)];c.attrib.pop('t',None)
 # Body values/formulas are generated from current workspace data, never retained from the reference orders.
 root.find('m:sheetData',ns)
 data_xml=E.tostring(root.find('m:sheetData',ns),encoding='utf-8')
 xml=re.sub(rb'<sheetData\b[^>]*>.*?</sheetData>',lambda _:data_xml,z.read('xl/worksheets/sheet1.xml'),flags=re.S)
 with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as dest:
  for name in z.namelist():
   if name=='xl/calcChain.xml':continue
   data=z.read(name)
   if name=='xl/worksheets/sheet1.xml':data=xml
   elif name=='xl/sharedStrings.xml':data=b'<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="0" uniqueCount="0"/>'
   elif name=='xl/_rels/workbook.xml.rels':data=re.sub(rb'<Relationship\b[^>]*Type="[^"]*/calcChain"[^>]*/>',b'',data)
   elif name=='[Content_Types].xml':data=re.sub(rb'<Override\b[^>]*PartName="/xl/calcChain.xml"[^>]*/>',b'',data)
   dest.writestr(name,data)
 meta.write_text(json.dumps({'version':1,'rows':records},ensure_ascii=False),encoding='utf-8')
print('Internal tracking template prepared without order quantities, prices or progress values.')
