/* ARC Receipt Engine — independent receipt parsing core, no external services.
   Input: OCR text. Output: structured receipt + reconciliation diagnostics.
   OCR image recognition is NOT implemented in this module. */
export function parseReceipt(text) {
  const lines=String(text||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const receipt={store:null,date:null,total:null,tax:null,taxExemption:0,items:[],warnings:[]};
  const money=s=>Number(s.replace(',','.'));
  const amount=/(-?\d{1,5}[.,]\d{2})\b/g;
  const categories=[
    [/purina|pet food|dog food|cat food/i,'Питомцы'],
    [/mr\.? clean|detergent|bleach|laundry/i,'Бытовая химия'],
    [/hersh|choc|brownie|cinnamon|candy/i,'Сладости'],
    [/avocado|cucumber|tomato|watermelon/i,'Овощи и фрукты'],
    [/milk|sour cream|yogurt/i,'Молочные продукты'],
    [/water|sftdk|cran|juice/i,'Напитки'],
    [/recycl|bag charge/i,'Сборы']
  ];
  for (const line of lines) {
    if (/\bVONS\b/i.test(line)) receipt.store='Vons';
    else if (/CIRCLE\s*K/i.test(line)) receipt.store='Circle K';
    else if (/STATER\s*BROS/i.test(line)) receipt.store='Stater Bros.';
    const date=line.match(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/);
    if(date) receipt.date=date[0];
    const numbers=[...line.matchAll(amount)].map(m=>money(m[1]));
    if (/^(?:\*+\s*)?BALANCE\b/i.test(line)&&numbers.length) receipt.total=numbers.at(-1);
    if (/^TAX\s+EXEMPTION\b/i.test(line)&&numbers.length) receipt.taxExemption+=numbers.at(-1);
    else if (/^TAX\b/i.test(line)&&numbers.length) receipt.tax=numbers.at(-1);
    if (/^(MEMBER SAVINGS|TAX|BALANCE|ACH|CHANGE|TOTAL|YOUR SAVINGS|GROCERY|GROC NONEDIBLE|MISCELLANEOUS|REFRIG|PRODUCE|DELI|MEAT|BAKED GOODS|GEN MERCHANDISE|PRICE|YOU PAY|STORE|MAIN|CASHIER|WT\b)/i.test(line)) continue;
    const match=line.match(/^(?:\d{4,14}\s+)?(.{3,}?)\s+(\d{1,5}[.,]\d{2})\s+(\d{1,5}[.,]\d{2})(?:\s+[ST])?$/i);
    if (!match) continue;
    const [,name,originalText,priceText]=match;
    const original=money(originalText),price=money(priceText);
    receipt.items.push({name:name.trim(),original,price,discount:Math.max(0,Number((original-price).toFixed(2))),category:categories.find(([re])=>re.test(name))?.[1]||'Не определено'});
  }
  receipt.itemSum=Number(receipt.items.reduce((sum,item)=>sum+item.price,0).toFixed(2));
  receipt.reconciled=receipt.total!==null&&receipt.tax!==null&&Math.abs(receipt.itemSum+receipt.tax-receipt.total)<0.02;
  if(receipt.total===null) receipt.warnings.push('Не найден итог');
  if(receipt.tax===null) receipt.warnings.push('Не найден налог');
  if(!receipt.reconciled) receipt.warnings.push('Сумма товаров и налог не подтверждают итог');
  return receipt;
}
