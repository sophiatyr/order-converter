"""Create a local CSQ snapshot using SK-KPI's read-only ERP queries."""
import json
import os
import sys
from pathlib import Path
from datetime import datetime, timezone

root = Path(__file__).resolve().parents[1]
backend = Path(os.environ.get('SK_KPI_BACKEND', r'C:\AI\sk-kpi\backend'))
sys.path.insert(0, str(backend))
sys.path.insert(0, str(backend.parent/'venv'/'Lib'/'site-packages'))
from app.erp.connection import erp_cursor
from app.eoi.csq_master import load_csq_master

def snapshot():
    with erp_cursor() as cur:
        cur.execute("SELECT DISTINCT RTRIM(l.fb03) FROM tfm02 l JOIN tfm01 h ON h.fa01=l.fb01 WHERE h.fa04=?", 'CSQ')
        codes = [str(row[0]).strip() for row in cur.fetchall() if row[0]]
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
