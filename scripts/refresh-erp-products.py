"""Create a local CSQ snapshot using SK-KPI's read-only ERP queries."""
import json
import os
import sys
import re
from pathlib import Path
from datetime import datetime, timezone

root = Path(__file__).resolve().parents[1]
backend = Path(os.environ.get('SK_KPI_BACKEND', r'C:\AI\sk-kpi\backend'))
sys.path.insert(0, str(backend))
sys.path.insert(0, str(backend.parent/'venv'/'Lib'/'site-packages'))
from app.erp.connection import erp_cursor
from app.eoi.csq_master import load_csq_master

def ordering_company(sc):
    suffix=re.search(r'(FA|ME|PS|IT|IF)$',sc)
    if suffix:return {'FA':'FALIS','ME':'MEDICO','PS':'PREMIUM SPORTS','IT':'INTERSPORT','IF':'ITALIAN FITNESS'}[suffix[1]]
    return 'CISALFA' if re.fullmatch(r'CS\d{8}',sc) else 'CSQ（下單公司未確認）'

def snapshot():
    with erp_cursor() as cur:
        histories={}
        purchase_prices={}
        cur.execute("SELECT RTRIM(l.gb03),RTRIM(h.ga01),l.gb02,RTRIM(h.ga03),RTRIM(h.ga04),RTRIM(h.ga19),l.gb19,RTRIM(l.gb10),RTRIM(s.ca02),RTRIM(h.ga2301) FROM tgm02 l JOIN tgm01 h ON h.ga01=l.gb01 JOIN tfm01 sales ON sales.fa01=h.ga2301 LEFT JOIN tcm01 s ON s.ca01=h.ga04 WHERE sales.fa04='CSQ' AND ISNULL(h.ga111,'')<>'Y' ORDER BY h.ga03,h.ga01,l.gb02")
        for code,document,line,date,supplier,currency,price,unit,name,sc in cur.fetchall():
            d=str(date or '').strip()
            purchase_prices.setdefault(str(code).strip(),[]).append(dict(id='erp-purchase:'+str(document).strip()+':'+str(line),kind='factory',party=str(supplier or '').strip(),partyName=str(name or '').strip(),date=(d[:4]+'-'+d[4:6]+'-'+d[6:8]) if len(d)==8 else d,currency=str(currency or '').strip(),price=float(price or 0),unit=str(unit or '').strip(),remarks='來源 S/C '+str(sc or '').strip(),createdAt='',source='ERP 採購成交價',document=str(document).strip()))
        cur.execute("SELECT RTRIM(l.fb03),RTRIM(h.fa03),RTRIM(h.fa01),RTRIM(h.fa08),l.fb09,RTRIM(l.fb10),l.fb19,RTRIM(h.fa19) FROM tfm02 l JOIN tfm01 h ON h.fa01=l.fb01 WHERE h.fa04='CSQ' AND ISNULL(h.fa63,'')<>'Y' ORDER BY h.fa03,h.fa01,l.fb02")
        for code,date,sc,po,qty,unit,price,currency in cur.fetchall():
            histories.setdefault(str(code).strip(),[]).append(dict(kind='order',date=str(date or '').strip(),document=str(sc).strip(),scNumber=str(sc).strip(),poNumber=str(po or '').strip(),quantity=float(qty or 0),unit=str(unit or '').strip(),price=float(price or 0),currency=str(currency or '').strip(),amount=float(qty or 0)*float(price or 0)))
        cur.execute("SELECT RTRIM(l.hd03),RTRIM(h.ha23),RTRIM(h.ha01),RTRIM(l.hd012),RTRIM(l.hd032),l.hd09,RTRIM(l.hd10),l.hd11,RTRIM(h.ha19) FROM thm04 l JOIN thm01 h ON h.ha01=l.hd011 WHERE h.ha04='CSQ' AND ISNULL(h.ha11,'')<>'Y' AND ISNULL(h.ha30c,'')<>'Y' ORDER BY h.ha23,h.ha01,l.hd02")
        for code,date,invoice,sc,po,qty,unit,price,currency in cur.fetchall():
            histories.setdefault(str(code).strip(),[]).append(dict(kind='shipment',date=str(date or '').strip(),document=str(invoice).strip(),scNumber=str(sc or '').strip(),poNumber=str(po or '').strip(),quantity=float(qty or 0),unit=str(unit or '').strip(),price=float(price or 0),currency=str(currency or '').strip(),amount=float(qty or 0)*float(price or 0)))
        cur.execute("SELECT DISTINCT RTRIM(l.fb03) FROM tfm02 l JOIN tfm01 h ON h.fa01=l.fb01 WHERE h.fa04=?", 'CSQ')
        codes = sorted(set(str(row[0]).strip() for row in cur.fetchall() if row[0])|set(histories)|set(purchase_prices))
        products = []
        for start in range(0, len(codes), 200):
            batch=codes[start:start+200]
            specs={}
            cur.execute("SELECT RTRIM(db01),RTRIM(db04) FROM tdm02 WHERE db03='M' AND db01 IN ("+','.join('?' for _ in batch)+") ORDER BY db01,db02",*batch)
            for code, line in cur.fetchall():
                if line: specs.setdefault(str(code).strip(),[]).append(str(line).strip())
            quotes={}
            cur.execute("SELECT RTRIM(p.ce02),RTRIM(p.ce011),RTRIM(p.ce05),p.ce06,RTRIM(p.ce12),RTRIM(p.ce07),RTRIM(s.ca02) FROM tcm05 p LEFT JOIN tcm01 s ON s.ca01=p.ce011 WHERE p.ce010='M' AND p.ce02 IN ("+','.join('?' for _ in batch)+")",*batch)
            for code,supplier,currency,cost,uom,date,name in cur.fetchall():
                quotes.setdefault(str(code).strip(),[]).append(dict(supplierCode=str(supplier or '').strip(),factorySupplier=str(name or '').strip(),factoryCurrency=str(currency or '').strip(),factoryPrice=float(cost) if cost is not None else None,purchaseUom=str(uom or '').strip(),quoteDate=str(date or '').strip()))
            for code, data in load_csq_master(cur, batch).items():
                product=dict(itemNo=code, chineseName=data.get('fb07',''), chineseSpec='\n'.join(specs.get(code,[])) or data.get('fb08',''),
                    supplierCode=data.get('supplier',''), factorySupplier=data.get('supplier_name',''),
                    factoryCurrency=data.get('purchase_currency',''), factoryPrice=data.get('purchase_cost'),
                    uom=data.get('uom',''), issue=data.get('purchase_issue',''), quoteDate=data.get('purchase_quote_date',''))
                if len(quotes.get(code,[]))==1: product.update(quotes[code][0])
                product['quotes'] = quotes.get(code, [])
                product['transactions'] = histories.get(code, [])
                for transaction in product['transactions']:transaction['company']=ordering_company(transaction['scNumber'])
                product['purchasePrices'] = purchase_prices.get(code, [])
                products.append(product)
    if not products:
        raise ValueError('ERP 查無 CSQ 產品，本機原有快照未變更。')
    payload = json.dumps(dict(account='CSQ', updatedAt=datetime.now(timezone.utc).isoformat(), products=products), ensure_ascii=False)
    for folder in [root/'public',root/'offline_package'/'外貿成衣訂單轉換系統_單機離線完整包']:
        folder.mkdir(parents=True, exist_ok=True)
        target=folder/'erp-products.json'
        temp=target.with_suffix('.json.tmp')
        temp.write_text(payload,encoding='utf-8')
        temp.replace(target)
    print(f'已更新 {len(products)} 筆 CSQ ERP 產品；只查詢，未寫入 ERP。')

if __name__ == '__main__':
    try:
        snapshot()
    except Exception:
        # Never print connection strings or driver messages containing credentials.
        print('更新失敗，原有快照保留。請確認 SK-KPI ERP 連線、公司網路與 Python 環境。',file=sys.stderr)
        sys.exit(1)
