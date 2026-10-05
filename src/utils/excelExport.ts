import ExcelJS from 'exceljs';
import { OrderData } from '../types/order';
import { amountToEnglishWords, amountToChineseWords } from './numberToWords';
import { groupColorsByRatio } from './ratioGrouping';

// =========================================================================
// Typography & Styles (Module Scope)
// =========================================================================
const FONT_EN_TITLE: Partial<ExcelJS.Font> = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF000000' } };
const FONT_EN_SUBTITLE: Partial<ExcelJS.Font> = { name: 'Calibri', size: 9, color: { argb: 'FF333333' } };
const FONT_EN_H2: Partial<ExcelJS.Font> = { name: 'Calibri', size: 14, bold: true, underline: true, color: { argb: 'FF000000' } };
const FONT_EN_BOLD: Partial<ExcelJS.Font> = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF000000' } };
const FONT_EN_REGULAR: Partial<ExcelJS.Font> = { name: 'Calibri', size: 10, color: { argb: 'FF000000' } };
const FONT_EN_SMALL: Partial<ExcelJS.Font> = { name: 'Calibri', size: 9, color: { argb: 'FF555555' } };
const FONT_EN_RATIO: Partial<ExcelJS.Font> = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF581C87' } };

const FONT_ZH_TITLE: Partial<ExcelJS.Font> = { name: 'Microsoft JhengHei', size: 18, bold: true, color: { argb: 'FF000000' } };
const FONT_ZH_SUBTITLE: Partial<ExcelJS.Font> = { name: 'Microsoft JhengHei', size: 9, color: { argb: 'FF333333' } };
const FONT_ZH_H2: Partial<ExcelJS.Font> = { name: 'Microsoft JhengHei', size: 16, bold: true, underline: true, color: { argb: 'FF000000' } };
const FONT_ZH_BOLD: Partial<ExcelJS.Font> = { name: 'Microsoft JhengHei', size: 10, bold: true, color: { argb: 'FF000000' } };
const FONT_ZH_REGULAR: Partial<ExcelJS.Font> = { name: 'Microsoft JhengHei', size: 10, color: { argb: 'FF000000' } };
const FONT_ZH_SMALL: Partial<ExcelJS.Font> = { name: 'Microsoft JhengHei', size: 9, color: { argb: 'FF555555' } };
const FONT_ZH_RATIO: Partial<ExcelJS.Font> = { name: 'Microsoft JhengHei', size: 10, bold: true, color: { argb: 'FF581C87' } };
const FONT_ZH_REACH: Partial<ExcelJS.Font> = { name: 'Microsoft JhengHei', size: 11, bold: true, color: { argb: 'FF000000' } };

const BORDER_THIN_ALL: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FF000000' } },
  left: { style: 'thin', color: { argb: 'FF000000' } },
  bottom: { style: 'thin', color: { argb: 'FF000000' } },
  right: { style: 'thin', color: { argb: 'FF000000' } },
};

const BORDER_TABLE_HEADER: Partial<ExcelJS.Borders> = {
  top: { style: 'medium', color: { argb: 'FF000000' } },
  bottom: { style: 'medium', color: { argb: 'FF000000' } },
  left: { style: 'thin', color: { argb: 'FF000000' } },
  right: { style: 'thin', color: { argb: 'FF000000' } },
};

const BORDER_TOTAL_ROW: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FF000000' } },
  bottom: { style: 'double', color: { argb: 'FF000000' } },
  left: { style: 'thin', color: { argb: 'FF000000' } },
  right: { style: 'thin', color: { argb: 'FF000000' } },
};

const FILL_HEADER: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF2F2F2' },
};

const FILL_RATIO_ROW: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF5F3FF' },
};

const FILL_PACK_BOX: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF8F9FA' },
};

async function saveWorkbookToFile(wb: ExcelJS.Workbook, filename: string): Promise<void> {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  setTimeout(() => {
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, 1500);
}


/**
 * 構建英文 Proforma Invoice (P/I) 工作表內容
 */
export function buildProformaInvoiceSheet(wsPI: ExcelJS.Worksheet, order: OrderData): void {
  const company = order.companyHeader || {
    name: 'SPORTS KITE INTERNATIONAL CO., LTD.',
    address: '7F., No. 522, Sec. 5, Zhongshan N. Rd., Shilin Dist., Taipei City 111005 , Taiwan (R.O.C.)',
    tel: '886-2-2763-5455',
    fax: '886-2-2763-5177',
    web: 'www.sportskite.com.tw',
    managerDirector: 'Giant Kao',
  };
  const isMultiplePack = order.packingType === 'MULTIPLE PACK' || order.orderType === 'prepack_kit';

  wsPI.columns = [
    { key: 'A', width: 6 },   // SEP.
    { key: 'B', width: 18 },  // ITEM NO.
    { key: 'C', width: 34 },  // DESCRIPTION / COLOR COMBINATION / COLOR/SIZE
    { key: 'D', width: 12 },  // SIZE 1
    { key: 'E', width: 12 },  // SIZE 2
    { key: 'F', width: 12 },  // SIZE 3
    { key: 'G', width: 12 },  // SIZE 4
    { key: 'H', width: 12 },  // SIZE 5
    { key: 'I', width: 16 },  // QUANTITY (PCS) / TOTAL
    { key: 'J', width: 16 },  // UNIT PRICE (USD)
    { key: 'K', width: 18 },  // AMOUNT (USD)
  ];

  let r = 1;

  // Row 1: Company Name
  wsPI.mergeCells(`A${r}:K${r}`);
  const cellCName = wsPI.getCell(`A${r}`);
  cellCName.value = company.name;
  cellCName.font = FONT_EN_TITLE;
  cellCName.alignment = { horizontal: 'center', vertical: 'middle' };
  wsPI.getRow(r).height = 24;
  r++;

  // Row 2: Address & Page
  wsPI.mergeCells(`A${r}:J${r}`);
  const cellAddr = wsPI.getCell(`A${r}`);
  cellAddr.value = company.address;
  cellAddr.font = FONT_EN_SUBTITLE;
  cellAddr.alignment = { horizontal: 'center', vertical: 'middle' };
  const cellPage = wsPI.getCell(`K${r}`);
  cellPage.value = 'PAGE: 1OF 2';
  cellPage.font = FONT_EN_SMALL;
  cellPage.alignment = { horizontal: 'right', vertical: 'middle' };
  r++;

  // Row 3: TEL / FAX / WEB
  wsPI.mergeCells(`A${r}:K${r}`);
  const cellContact = wsPI.getCell(`A${r}`);
  cellContact.value = `TEL: ${company.tel}    FAX: ${company.fax}    ${company.web}`;
  cellContact.font = FONT_EN_SUBTITLE;
  cellContact.alignment = { horizontal: 'center', vertical: 'middle' };
  r++;

  r++; // spacer

  // Row 5: Document Title (Underlined)
  wsPI.mergeCells(`A${r}:K${r}`);
  const cellTitle = wsPI.getCell(`A${r}`);
  cellTitle.value = 'PROFORMA INVOICE';
  cellTitle.font = FONT_EN_H2;
  cellTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  wsPI.getRow(r).height = 22;
  r++;

  r++; // spacer

  // Meta Section: Row 7 to 18
  wsPI.getCell(`A${r}`).value = 'MESSRS.:';
  wsPI.getCell(`A${r}`).font = FONT_EN_BOLD;
  wsPI.getCell(`B${r}`).value = order.customerName;
  wsPI.getCell(`B${r}`).font = FONT_EN_BOLD;

  wsPI.getCell(`H${r}`).value = 'DATE:';
  wsPI.getCell(`H${r}`).font = FONT_EN_BOLD;
  wsPI.getCell(`I${r}`).value = order.piDate;
  wsPI.getCell(`I${r}`).font = FONT_EN_BOLD;
  r++;

  wsPI.getCell(`H${r}`).value = 'P/I NO.:';
  wsPI.getCell(`H${r}`).font = FONT_EN_BOLD;
  wsPI.getCell(`I${r}`).value = order.piNumber;
  wsPI.getCell(`I${r}`).font = FONT_EN_BOLD;
  r++;

  wsPI.getCell(`A${r}`).value = 'PAYMENT:';
  wsPI.getCell(`A${r}`).font = FONT_EN_BOLD;
  wsPI.getCell(`B${r}`).value = order.paymentTerms;
  wsPI.getCell(`B${r}`).font = FONT_EN_REGULAR;

  wsPI.getCell(`H${r}`).value = "CISALFA'S ORDER NO.:";
  wsPI.getCell(`H${r}`).font = FONT_EN_BOLD;
  wsPI.getCell(`I${r}`).value = order.poNumber;
  wsPI.getCell(`I${r}`).font = FONT_EN_BOLD;
  r++;

  wsPI.getCell(`B${r}`).value = `"${order.bankInfo.beneficiary}"`;
  wsPI.getCell(`B${r}`).font = FONT_EN_BOLD;

  wsPI.getCell(`H${r}`).value = 'CUST#:';
  wsPI.getCell(`H${r}`).font = FONT_EN_BOLD;
  wsPI.getCell(`I${r}`).value = order.customerCode;
  wsPI.getCell(`I${r}`).font = FONT_EN_BOLD;
  r++;

  wsPI.getCell(`B${r}`).value = order.bankInfo.bankName;
  wsPI.getCell(`B${r}`).font = FONT_EN_REGULAR;
  r++;

  wsPI.getCell(`B${r}`).value = order.bankInfo.address;
  wsPI.getCell(`B${r}`).font = FONT_EN_REGULAR;

  // MULTIPLE PACK BOX in columns H-I across 2 rows
  wsPI.mergeCells(`H${r - 1}:I${r}`);
  const packBox = wsPI.getCell(`H${r - 1}`);
  packBox.value = order.packingType || 'MULTIPLE PACK';
  packBox.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF000000' } };
  packBox.alignment = { horizontal: 'center', vertical: 'middle' };
  packBox.border = {
    top: { style: 'medium', color: { argb: 'FF000000' } },
    bottom: { style: 'medium', color: { argb: 'FF000000' } },
    left: { style: 'medium', color: { argb: 'FF000000' } },
    right: { style: 'medium', color: { argb: 'FF000000' } },
  };
  packBox.fill = FILL_PACK_BOX;
  r++;

  wsPI.getCell(`B${r}`).value = `ACCOUNT NO. ${order.bankInfo.accountNo}`;
  wsPI.getCell(`B${r}`).font = FONT_EN_BOLD;
  r++;

  wsPI.getCell(`B${r}`).value = `SWIFT ADD: ${order.bankInfo.swiftCode}`;
  wsPI.getCell(`B${r}`).font = FONT_EN_BOLD;
  r++;

  wsPI.getCell(`A${r}`).value = 'SHIPMENT:';
  wsPI.getCell(`A${r}`).font = FONT_EN_BOLD;
  wsPI.getCell(`B${r}`).value = order.shipmentDate;
  wsPI.getCell(`B${r}`).font = FONT_EN_BOLD;
  r++;

  wsPI.getCell(`A${r}`).value = 'TERMS:';
  wsPI.getCell(`A${r}`).font = FONT_EN_BOLD;
  wsPI.getCell(`B${r}`).value = order.tradeTerms;
  wsPI.getCell(`B${r}`).font = FONT_EN_BOLD;
  r++;

  wsPI.getCell(`A${r}`).value = 'REMARK :';
  wsPI.getCell(`A${r}`).font = FONT_EN_BOLD;
  wsPI.getCell(`B${r}`).value = order.remarks[0] || '1. PLUS 3% IN QUANTITY AND VALUE IS ACCEPTABLE.';
  wsPI.getCell(`B${r}`).font = FONT_EN_REGULAR;
  r++;

  if (order.remarks[1]) {
    wsPI.getCell(`B${r}`).value = order.remarks[1];
    wsPI.getCell(`B${r}`).font = FONT_EN_REGULAR;
    r++;
  }
  if (order.remarks[2]) {
    wsPI.getCell(`B${r}`).value = order.remarks[2];
    wsPI.getCell(`B${r}`).font = FONT_EN_REGULAR;
    r++;
  }

  r++; // spacer

  // =========================================================================
  // Product Table Header
  // =========================================================================
  wsPI.getCell(`A${r}`).value = 'SEP.';
  wsPI.getCell(`B${r}`).value = 'ITEM NO.';
  wsPI.getCell(`C${r}`).value = 'DESCRIPTION';
  wsPI.getCell(`I${r}`).value = 'QUANTITY\n(PCS)';
  wsPI.getCell(`J${r}`).value = 'UNIT PRICE\n(USD)';
  wsPI.getCell(`K${r}`).value = 'AMOUNT\n(USD)';

  for (let c = 1; c <= 11; c++) {
    const cell = wsPI.getRow(r).getCell(c);
    cell.font = FONT_EN_BOLD;
    cell.border = BORDER_TABLE_HEADER;
    cell.alignment = {
      vertical: 'middle',
      horizontal: c >= 9 ? 'right' : c === 1 ? 'center' : 'left',
      wrapText: true,
    };
  }
  wsPI.getRow(r).height = 24;
  r++;

  let sepIndex = 1;
  let totalOrderPcs = 0;
  let totalOrderAmount = 0;

  order.items.forEach((item) => {
    const itemTotalPcs = item.colors.reduce((sum, c) => sum + c.totalQuantity, 0);
    const itemTotalAmt = itemTotalPcs * item.unitPriceUSD;
    totalOrderPcs += itemTotalPcs;
    totalOrderAmount += itemTotalAmt;

    // Main Item Line
    wsPI.getCell(`A${r}`).value = `${sepIndex++}.`;
    wsPI.getCell(`A${r}`).font = FONT_EN_BOLD;
    wsPI.getCell(`A${r}`).alignment = { horizontal: 'center', vertical: 'top' };

    wsPI.getCell(`B${r}`).value = item.itemNo;
    wsPI.getCell(`B${r}`).font = FONT_EN_BOLD;
    wsPI.getCell(`B${r}`).alignment = { vertical: 'top' };

    wsPI.getCell(`C${r}`).value = item.styleName;
    wsPI.getCell(`C${r}`).font = FONT_EN_BOLD;
    wsPI.getCell(`C${r}`).alignment = { vertical: 'top' };

    wsPI.getCell(`I${r}`).value = itemTotalPcs;
    wsPI.getCell(`I${r}`).font = FONT_EN_BOLD;
    wsPI.getCell(`I${r}`).alignment = { horizontal: 'right', vertical: 'top' };
    wsPI.getCell(`I${r}`).numFmt = '#,##0';

    wsPI.getCell(`J${r}`).value = item.unitPriceUSD;
    wsPI.getCell(`J${r}`).font = FONT_EN_BOLD;
    wsPI.getCell(`J${r}`).alignment = { horizontal: 'right', vertical: 'top' };
    wsPI.getCell(`J${r}`).numFmt = '0.00';

    wsPI.getCell(`K${r}`).value = itemTotalAmt;
    wsPI.getCell(`K${r}`).font = FONT_EN_BOLD;
    wsPI.getCell(`K${r}`).alignment = { horizontal: 'right', vertical: 'top' };
    wsPI.getCell(`K${r}`).numFmt = '#,##0.00';
    r++;

    // Description line 2: Spec
    wsPI.getCell(`C${r}`).value = item.description;
    wsPI.getCell(`C${r}`).font = FONT_EN_REGULAR;
    r++;

    // Description line 3: Sizes (PACK RATIO removed from here per user screenshot)
    wsPI.getCell(`C${r}`).value = `SIZE: ${item.sizes.join('/ ')}`;
    wsPI.getCell(`C${r}`).font = FONT_EN_BOLD;
    r++;

    // -------------------------------------------------------------
    // Sub-Table 1: COLOR COMBINATION
    // -------------------------------------------------------------
    wsPI.getCell(`C${r}`).value = 'COLOR COMBINATION';
    wsPI.getCell(`C${r}`).font = FONT_EN_BOLD;
    wsPI.getCell(`C${r}`).alignment = { horizontal: 'left', vertical: 'middle' };
    wsPI.getCell(`C${r}`).border = BORDER_THIN_ALL;
    wsPI.getCell(`C${r}`).fill = FILL_HEADER;

    item.colors.forEach((c, cIdx) => {
      const colLetter = String.fromCharCode(68 + cIdx); // D, E, F...
      const cell = wsPI.getCell(`${colLetter}${r}`);
      cell.value = c.colorCode;
      cell.font = FONT_EN_BOLD;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = BORDER_THIN_ALL;
    });
    r++;

    // Row: COLOR(1) (通用品項，不寫死特定衣物種類如 T-SHIRT)
    wsPI.getCell(`C${r}`).value = 'COLOR(1)';
    wsPI.getCell(`C${r}`).font = FONT_EN_BOLD;
    wsPI.getCell(`C${r}`).alignment = { horizontal: 'left', vertical: 'middle' };
    wsPI.getCell(`C${r}`).border = BORDER_THIN_ALL;

    item.colors.forEach((c, cIdx) => {
      const colLetter = String.fromCharCode(68 + cIdx);
      const cell = wsPI.getCell(`${colLetter}${r}`);
      cell.value = c.colorName;
      cell.font = FONT_EN_REGULAR;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = BORDER_THIN_ALL;
    });
    r++;

    // Row: QUANTITY
    wsPI.getCell(`C${r}`).value = 'QUANTITY';
    wsPI.getCell(`C${r}`).font = FONT_EN_BOLD;
    wsPI.getCell(`C${r}`).alignment = { horizontal: 'left', vertical: 'middle' };
    wsPI.getCell(`C${r}`).border = BORDER_THIN_ALL;

    item.colors.forEach((c, cIdx) => {
      const colLetter = String.fromCharCode(68 + cIdx);
      const cell = wsPI.getCell(`${colLetter}${r}`);
      cell.value = c.totalQuantity;
      cell.font = FONT_EN_BOLD;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = BORDER_THIN_ALL;
      cell.numFmt = '#,##0';
    });
    r++;
    r++; // spacer

    // -------------------------------------------------------------
    // Sub-Table 2: COLOR / SIZE MATRIX (PACK RATIO DIRECTLY UNDER SIZE - GROUPED BY RATIO!)
    // -------------------------------------------------------------
    const startColCode = 68; // 'D'
    const numSizes = item.sizes.length;
    const endColCode = startColCode + numSizes - 1;
    const totalColLetter = String.fromCharCode(endColCode + 1);

    const mHeadRow1 = r;
    const mHeadRow2 = r + 1;

    wsPI.mergeCells(`C${mHeadRow1}:C${mHeadRow2}`);
    const cHead = wsPI.getCell(`C${mHeadRow1}`);
    cHead.value = 'COLOR / SIZE';
    cHead.font = FONT_EN_BOLD;
    cHead.alignment = { horizontal: 'left', vertical: 'middle' };
    cHead.border = BORDER_THIN_ALL;
    cHead.fill = FILL_HEADER;
    wsPI.getCell(`C${mHeadRow2}`).border = BORDER_THIN_ALL;

    if (numSizes > 0) {
      wsPI.mergeCells(`${String.fromCharCode(startColCode)}${mHeadRow1}:${String.fromCharCode(endColCode)}${mHeadRow1}`);
      const sizeGroupHead = wsPI.getCell(`${String.fromCharCode(startColCode)}${mHeadRow1}`);
      sizeGroupHead.value = 'SIZE';
      sizeGroupHead.font = FONT_EN_BOLD;
      sizeGroupHead.alignment = { horizontal: 'center', vertical: 'middle' };
      sizeGroupHead.border = BORDER_THIN_ALL;
      sizeGroupHead.fill = FILL_HEADER;

      item.sizes.forEach((s, sIdx) => {
        const colLetter = String.fromCharCode(startColCode + sIdx);
        const sCell = wsPI.getCell(`${colLetter}${mHeadRow2}`);
        sCell.value = s;
        sCell.font = FONT_EN_BOLD;
        sCell.alignment = { horizontal: 'center', vertical: 'middle' };
        sCell.border = BORDER_THIN_ALL;
        sCell.fill = FILL_HEADER;
      });
    }

    wsPI.mergeCells(`${totalColLetter}${mHeadRow1}:${totalColLetter}${mHeadRow2}`);
    const totHead = wsPI.getCell(`${totalColLetter}${mHeadRow1}`);
    totHead.value = 'TOTAL\n(PCS)';
    totHead.font = FONT_EN_BOLD;
    totHead.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    totHead.border = BORDER_THIN_ALL;
    totHead.fill = FILL_HEADER;
    wsPI.getCell(`${totalColLetter}${mHeadRow2}`).border = BORDER_THIN_ALL;

    r += 2;

    if (isMultiplePack) {
      const ratioGroups = groupColorsByRatio(item.colors, item.sizes);

      ratioGroups.forEach((group) => {
        const ratioRowIdx = r;
        const ratioCellTitle = wsPI.getCell(`C${ratioRowIdx}`);
        ratioCellTitle.value = `PACK RATIO (${group.piecesPerPack} PCS/PACK)`;
        ratioCellTitle.font = FONT_EN_RATIO;
        ratioCellTitle.alignment = { horizontal: 'left', vertical: 'middle' };
        ratioCellTitle.border = BORDER_THIN_ALL;
        ratioCellTitle.fill = FILL_RATIO_ROW;

        item.sizes.forEach((s, sIdx) => {
          const colLetter = String.fromCharCode(startColCode + sIdx);
          const ratioCell = wsPI.getCell(`${colLetter}${ratioRowIdx}`);
          const rVal = group.ratioBySize[s] !== undefined ? group.ratioBySize[s] : '-';
          ratioCell.value = rVal;
          ratioCell.font = FONT_EN_RATIO;
          ratioCell.alignment = { horizontal: 'center', vertical: 'middle' };
          ratioCell.border = BORDER_THIN_ALL;
          ratioCell.fill = FILL_RATIO_ROW;
        });

        const totRatioCell = wsPI.getCell(`${totalColLetter}${ratioRowIdx}`);
        totRatioCell.value = `${group.piecesPerPack} PCS/PACK`;
        totRatioCell.font = FONT_EN_RATIO;
        totRatioCell.alignment = { horizontal: 'center', vertical: 'middle' };
        totRatioCell.border = BORDER_THIN_ALL;
        totRatioCell.fill = FILL_RATIO_ROW;
        r++;

        group.colors.forEach((c) => {
          const nameCell = wsPI.getCell(`C${r}`);
          nameCell.value = c.colorName;
          nameCell.font = FONT_EN_REGULAR;
          nameCell.alignment = { horizontal: 'left', vertical: 'middle' };
          nameCell.border = BORDER_THIN_ALL;

          item.sizes.forEach((s, sIdx) => {
            const colLetter = String.fromCharCode(startColCode + sIdx);
            const qCell = wsPI.getCell(`${colLetter}${r}`);
            const qVal = c.quantitiesBySize[s] ?? 0;
            qCell.value = qVal;
            qCell.font = FONT_EN_REGULAR;
            qCell.alignment = { horizontal: 'center', vertical: 'middle' };
            qCell.border = BORDER_THIN_ALL;
            qCell.numFmt = '#,##0';
          });

          const tCell = wsPI.getCell(`${totalColLetter}${r}`);
          tCell.value = c.totalQuantity;
          tCell.font = FONT_EN_BOLD;
          tCell.alignment = { horizontal: 'center', vertical: 'middle' };
          tCell.border = BORDER_THIN_ALL;
          tCell.numFmt = '#,##0';
          r++;
        });
      });
    } else {
      item.colors.forEach((c) => {
        const nameCell = wsPI.getCell(`C${r}`);
        nameCell.value = c.colorName;
        nameCell.font = FONT_EN_REGULAR;
        nameCell.alignment = { horizontal: 'left', vertical: 'middle' };
        nameCell.border = BORDER_THIN_ALL;

        item.sizes.forEach((s, sIdx) => {
          const colLetter = String.fromCharCode(startColCode + sIdx);
          const qCell = wsPI.getCell(`${colLetter}${r}`);
          const qVal = c.quantitiesBySize[s] ?? 0;
          qCell.value = qVal;
          qCell.font = FONT_EN_REGULAR;
          qCell.alignment = { horizontal: 'center', vertical: 'middle' };
          qCell.border = BORDER_THIN_ALL;
          qCell.numFmt = '#,##0';
        });

        const tCell = wsPI.getCell(`${totalColLetter}${r}`);
        tCell.value = c.totalQuantity;
        tCell.font = FONT_EN_BOLD;
        tCell.alignment = { horizontal: 'center', vertical: 'middle' };
        tCell.border = BORDER_THIN_ALL;
        tCell.numFmt = '#,##0';
        r++;
      });
    }

    r++; // space between items
  });

  // Grand Total Row
  wsPI.getCell(`A${r}`).value = 'TOTAL:';
  wsPI.getCell(`A${r}`).font = FONT_EN_BOLD;

  wsPI.getCell(`I${r}`).value = totalOrderPcs;
  wsPI.getCell(`I${r}`).font = FONT_EN_BOLD;
  wsPI.getCell(`I${r}`).alignment = { horizontal: 'right', vertical: 'middle' };
  wsPI.getCell(`I${r}`).numFmt = '#,##0 "PCS"';

  wsPI.getCell(`J${r}`).value = 'USD';
  wsPI.getCell(`J${r}`).font = FONT_EN_BOLD;
  wsPI.getCell(`J${r}`).alignment = { horizontal: 'right', vertical: 'middle' };

  wsPI.getCell(`K${r}`).value = totalOrderAmount;
  wsPI.getCell(`K${r}`).font = FONT_EN_BOLD;
  wsPI.getCell(`K${r}`).alignment = { horizontal: 'right', vertical: 'middle' };
  wsPI.getCell(`K${r}`).numFmt = '#,##0.00';

  for (let c = 1; c <= 11; c++) {
    wsPI.getRow(r).getCell(c).border = BORDER_TOTAL_ROW;
  }
  wsPI.getRow(r).height = 24;
  r++;

  // Say Total Words
  wsPI.mergeCells(`A${r}:K${r}`);
  const sayCell = wsPI.getCell(`A${r}`);
  sayCell.value = amountToEnglishWords(totalOrderAmount);
  sayCell.font = FONT_EN_BOLD;
  sayCell.alignment = { vertical: 'middle' };
  r += 2;

  // Signatures
  wsPI.getCell(`A${r}`).value = order.customerName;
  wsPI.getCell(`A${r}`).font = FONT_EN_BOLD;

  wsPI.getCell(`H${r}`).value = company.name;
  wsPI.getCell(`H${r}`).font = FONT_EN_BOLD;
  r++;

  wsPI.getCell(`H${r}`).value = 'Giant Kao';
  wsPI.getCell(`H${r}`).font = { name: 'Calibri', size: 12, italic: true };
  r++;

  wsPI.getCell(`A${r}`).value = '(PLEASE KINDLY SIGN BACK ,THANKS!!)';
  wsPI.getCell(`A${r}`).font = FONT_EN_SMALL;

  wsPI.getCell(`H${r}`).value = `( Manager Director: ${company.managerDirector} )`;
  wsPI.getCell(`H${r}`).font = FONT_EN_SMALL;

}


/**
 * 構建中文工廠採購單工作表內容
 */
export function buildFactoryPOSheet(
  wsPO: ExcelJS.Worksheet,
  order: OrderData,
  options?: { poCurrency?: 'RMB' | 'USD'; prepackMode?: 'detail' | 'summary' }
): void {
  const company = order.companyHeader || {
    name: 'SPORTS KITE INTERNATIONAL CO., LTD.',
    address: '7F., No. 522, Sec. 5, Zhongshan N. Rd., Shilin Dist., Taipei City 111005 , Taiwan (R.O.C.)',
    tel: '886-2-2763-5455',
    fax: '886-2-2763-5177',
    web: 'www.sportskite.com.tw',
    managerDirector: 'Giant Kao',
  };
  const poCurrency: 'RMB' | 'USD' = options?.poCurrency || order.factoryCurrency || 'RMB';
  const prepackMode: 'detail' | 'summary' = options?.prepackMode || 'detail';
  const isMultiplePack = order.packingType === 'MULTIPLE PACK' || order.orderType === 'prepack_kit';

  const currencyUnitLabel = poCurrency === 'USD' ? 'USD/件' : 'RMB/件';
  const currencyAmtLabel = poCurrency === 'USD' ? '(USD)' : '(RMB)';
  const activeCurrencySymbol = poCurrency === 'USD' ? 'USD ' : 'RMB ';

  // Columns: 6 欄，版面寬敞不擁擠
  wsPO.columns = [
    { key: 'A', width: 6 },   // 序號
    { key: 'B', width: 18 },  // 產品編號
    { key: 'C', width: 46 },  // 規 格 / 說 明 (品名 + 下一列面料規格 + 尺寸)
    { key: 'D', width: 14 },  // 總 數 (件)
    { key: 'E', width: 16 },  // 單 價
    { key: 'F', width: 18 },  // 金 額
  ];

  let fr = 1;

  // Row 1: Company Name
  wsPO.mergeCells(`A${fr}:F${fr}`);
  const poCompName = wsPO.getCell(`A${fr}`);
  poCompName.value = 'SPORTS KITE INTERNATIONAL CO., LTD.';
  poCompName.font = FONT_ZH_TITLE;
  poCompName.alignment = { horizontal: 'center', vertical: 'middle' };
  wsPO.getRow(fr).height = 24;
  fr++;

  // Row 2: Subtitle
  wsPO.mergeCells(`A${fr}:E${fr}`);
  const poContact = wsPO.getCell(`A${fr}`);
  poContact.value = 'TEL : (886) 2763-5455    FAX: (886) 2753-4365    www.sportskite.com.tw';
  poContact.font = FONT_ZH_SUBTITLE;
  poContact.alignment = { horizontal: 'center', vertical: 'middle' };
  const poPageCell = wsPO.getCell(`F${fr}`);
  poPageCell.value = 'Page: 1 of 1';
  poPageCell.font = FONT_ZH_SMALL;
  poPageCell.alignment = { horizontal: 'right', vertical: 'middle' };
  fr++;

  // Row 3: Title (Underlined)
  wsPO.mergeCells(`A${fr}:F${fr}`);
  const poTitle = wsPO.getCell(`A${fr}`);
  poTitle.value = '採 購 單';
  poTitle.font = FONT_ZH_H2;
  poTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  wsPO.getRow(fr).height = 24;
  fr++;

  fr++; // spacer

  // Metadata block
  wsPO.getCell(`A${fr}`).value = '供 應 商:';
  wsPO.getCell(`A${fr}`).font = FONT_ZH_BOLD;
  wsPO.getCell(`B${fr}`).value = order.factorySupplier;
  wsPO.getCell(`B${fr}`).font = FONT_ZH_BOLD;

  wsPO.getCell(`E${fr}`).value = '採購日期:';
  wsPO.getCell(`E${fr}`).font = FONT_ZH_BOLD;
  wsPO.getCell(`F${fr}`).value = order.piDate.includes('年') ? order.piDate : '2025年07月29日';
  wsPO.getCell(`F${fr}`).font = FONT_ZH_REGULAR;
  fr++;

  wsPO.getCell(`E${fr}`).value = '採購單號:';
  wsPO.getCell(`E${fr}`).font = FONT_ZH_BOLD;
  wsPO.getCell(`F${fr}`).value = order.piNumber;
  wsPO.getCell(`F${fr}`).font = FONT_ZH_BOLD;
  fr++;

  wsPO.getCell(`E${fr}`).value = '客人訂單:';
  wsPO.getCell(`E${fr}`).font = FONT_ZH_BOLD;
  wsPO.getCell(`F${fr}`).value = order.poNumber;
  wsPO.getCell(`F${fr}`).font = FONT_ZH_REGULAR;
  fr++;

  // 付款方式（支援訂金備註）
  wsPO.getCell(`A${fr}`).value = '付款方式 :';
  wsPO.getCell(`A${fr}`).font = FONT_ZH_BOLD;

  const totalAmountCalc = order.items.reduce((acc, item) => {
    const itemQty = item.colors.reduce((sum, c) => sum + c.totalQuantity, 0);
    const uPrice = poCurrency === 'USD' ? item.unitPriceUSD : item.unitPriceRMB;
    return acc + itemQty * uPrice;
  }, 0);

  const depositAmt = order.hasDeposit ? (totalAmountCalc * (order.depositPercent || 20)) / 100 : 0;
  const paymentText = order.hasDeposit
    ? `1. 下单后支付${order.depositPercent || 20}%订金(${activeCurrencySymbol}${depositAmt.toFixed(2)})\n2. 出货后备齐装箱明细, 请款发票, 我司于收到此份文件後15日内即以T/T支付余下货款.`
    : order.factoryTerms ||
      `出货後備齊重量装箱明细, 请款发票, 产地证予我司, 本公司於收到此份文件後15日即以${poCurrency === 'USD' ? '美金' : '人民幣'}T/T支付货款.`;

  wsPO.mergeCells(`B${fr}:D${fr + 1}`);
  const payCell = wsPO.getCell(`B${fr}`);
  payCell.value = paymentText;
  payCell.font = FONT_ZH_REGULAR;
  payCell.alignment = { vertical: 'top', wrapText: true };

  wsPO.getCell(`E${fr}`).value = '供應商號:';
  wsPO.getCell(`E${fr}`).font = FONT_ZH_BOLD;
  wsPO.getCell(`F${fr}`).value = order.supplierCode || 'LA';
  wsPO.getCell(`F${fr}`).font = FONT_ZH_REGULAR;
  fr += 2;

  wsPO.getCell(`A${fr}`).value = '交貨地點 :';
  wsPO.getCell(`A${fr}`).font = FONT_ZH_BOLD;
  wsPO.getCell(`B${fr}`).value = order.deliveryPlace || '待通知';
  wsPO.getCell(`B${fr}`).font = FONT_ZH_REGULAR;
  fr++;

  wsPO.getCell(`A${fr}`).value = '交貨日期 :';
  wsPO.getCell(`A${fr}`).font = FONT_ZH_BOLD;
  wsPO.getCell(`B${fr}`).value = order.factoryShipDate;
  wsPO.getCell(`B${fr}`).font = FONT_ZH_BOLD;

  // 包裝標籤
  wsPO.getCell(`D${fr}`).value = isMultiplePack ? '混码包装' : '单码包装';
  wsPO.getCell(`D${fr}`).font = FONT_ZH_BOLD;
  wsPO.getCell(`D${fr}`).alignment = { horizontal: 'center', vertical: 'middle' };
  wsPO.getCell(`D${fr}`).border = BORDER_THIN_ALL;
  wsPO.getCell(`D${fr}`).fill = FILL_PACK_BOX;
  fr++;

  wsPO.getCell(`A${fr}`).value = '交易條件 :';
  wsPO.getCell(`A${fr}`).font = FONT_ZH_BOLD;
  wsPO.getCell(`B${fr}`).value = order.tradeTerms.includes('FOB') ? `FOB ${order.port}` : order.tradeTerms;
  wsPO.getCell(`B${fr}`).font = FONT_ZH_BOLD;
  fr += 2;

  // =========================================================================
  // Main Table Header: 序號、產品編號、規 格 / 說 明、總 數 (件)、單 價、金 額
  // =========================================================================
  wsPO.getCell(`A${fr}`).value = '序號';
  wsPO.getCell(`B${fr}`).value = '產品編號';
  wsPO.getCell(`C${fr}`).value = '規 格 / 說 明';
  wsPO.getCell(`D${fr}`).value = '總 數\n(件)';
  wsPO.getCell(`E${fr}`).value = `單 價\n(${currencyUnitLabel})`;
  wsPO.getCell(`F${fr}`).value = `金 額\n${currencyAmtLabel}`;

  for (let c = 1; c <= 6; c++) {
    const cell = wsPO.getRow(fr).getCell(c);
    cell.font = FONT_ZH_BOLD;
    cell.border = BORDER_TABLE_HEADER;
    cell.fill = FILL_HEADER;
    cell.alignment = {
      vertical: 'middle',
      horizontal: c >= 4 ? 'right' : c === 1 ? 'center' : 'left',
      wrapText: true,
    };
  }
  wsPO.getRow(fr).height = 24;
  fr++;

  let fIndex = 1;
  let totalFactoryQty = 0;
  let totalFactoryAmt = 0;

  order.items.forEach((item) => {
    const itemQty = item.colors.reduce((sum, c) => sum + c.totalQuantity, 0);
    const unitPrice = poCurrency === 'USD' ? item.unitPriceUSD : item.unitPriceRMB;
    const itemAmt = itemQty * unitPrice;
    totalFactoryQty += itemQty;
    totalFactoryAmt += itemAmt;

    // Line 1: 品名 + 總數 + 單價 + 金額
    wsPO.getCell(`A${fr}`).value = fIndex++;
    wsPO.getCell(`A${fr}`).font = FONT_ZH_REGULAR;
    wsPO.getCell(`A${fr}`).alignment = { horizontal: 'center', vertical: 'top' };

    wsPO.getCell(`B${fr}`).value = item.itemNo;
    wsPO.getCell(`B${fr}`).font = FONT_ZH_BOLD;
    wsPO.getCell(`B${fr}`).alignment = { horizontal: 'left', vertical: 'top' };

    wsPO.getCell(`C${fr}`).value = item.chineseName;
    wsPO.getCell(`C${fr}`).font = FONT_ZH_BOLD;
    wsPO.getCell(`C${fr}`).alignment = { horizontal: 'left', vertical: 'top' };

    wsPO.getCell(`D${fr}`).value = itemQty;
    wsPO.getCell(`D${fr}`).font = FONT_ZH_BOLD;
    wsPO.getCell(`D${fr}`).alignment = { horizontal: 'right', vertical: 'top' };
    wsPO.getCell(`D${fr}`).numFmt = '#,##0';

    wsPO.getCell(`E${fr}`).value = unitPrice;
    wsPO.getCell(`E${fr}`).font = FONT_ZH_REGULAR;
    wsPO.getCell(`E${fr}`).alignment = { horizontal: 'right', vertical: 'top' };
    wsPO.getCell(`E${fr}`).numFmt = '0.00';

    wsPO.getCell(`F${fr}`).value = itemAmt;
    wsPO.getCell(`F${fr}`).font = FONT_ZH_BOLD;
    wsPO.getCell(`F${fr}`).alignment = { horizontal: 'right', vertical: 'top' };
    wsPO.getCell(`F${fr}`).numFmt = '#,##0.00';
    fr++;

    // Line 2 (放再下一列！): 面料規格 / 成分克重 (布重)
    wsPO.getCell(`C${fr}`).value = `面料: ${item.chineseSpec}`;
    wsPO.getCell(`C${fr}`).font = FONT_ZH_REGULAR;
    fr++;

    // Line 3: 尺寸範圍
    wsPO.getCell(`C${fr}`).value = `尺寸: ${item.sizes.join('/ ')}`;
    wsPO.getCell(`C${fr}`).font = FONT_ZH_SMALL;
    fr++;

    // 若為混碼包裝且選擇「含混碼裝袋明細」版本，展開尺碼與配比明細（同一數量配比合併分組）
    const showPrepackDetail = isMultiplePack && prepackMode !== 'summary';
    if (showPrepackDetail) {
      const fNumSizes = item.sizes.length;
      const fStartCol = 68; // 'D'
      const fEndCol = fStartCol + fNumSizes - 1;
      const fTotColLetter = String.fromCharCode(fEndCol + 1);

      const fHead1 = fr;
      const fHead2 = fr + 1;

      wsPO.mergeCells(`C${fHead1}:C${fHead2}`);
      const fItemHead = wsPO.getCell(`C${fHead1}`);
      fItemHead.value = '項目 / 顏色明細';
      fItemHead.font = FONT_ZH_BOLD;
      fItemHead.alignment = { horizontal: 'left', vertical: 'middle' };
      fItemHead.border = BORDER_THIN_ALL;
      fItemHead.fill = FILL_HEADER;
      wsPO.getCell(`C${fHead2}`).border = BORDER_THIN_ALL;

      if (fNumSizes > 0) {
        wsPO.mergeCells(`${String.fromCharCode(fStartCol)}${fHead1}:${String.fromCharCode(fEndCol)}${fHead1}`);
        const fSizeHead = wsPO.getCell(`${String.fromCharCode(fStartCol)}${fHead1}`);
        fSizeHead.value = '尺碼 (SIZE)';
        fSizeHead.font = FONT_ZH_BOLD;
        fSizeHead.alignment = { horizontal: 'center', vertical: 'middle' };
        fSizeHead.border = BORDER_THIN_ALL;
        fSizeHead.fill = FILL_HEADER;

        item.sizes.forEach((s, sIdx) => {
          const colLetter = String.fromCharCode(fStartCol + sIdx);
          const sCell = wsPO.getCell(`${colLetter}${fHead2}`);
          sCell.value = s;
          sCell.font = FONT_ZH_BOLD;
          sCell.alignment = { horizontal: 'center', vertical: 'middle' };
          sCell.border = BORDER_THIN_ALL;
          sCell.fill = FILL_HEADER;
        });
      }

      wsPO.mergeCells(`${fTotColLetter}${fHead1}:${fTotColLetter}${fHead2}`);
      const fTotHead = wsPO.getCell(`${fTotColLetter}${fHead1}`);
      fTotHead.value = '合計';
      fTotHead.font = FONT_ZH_BOLD;
      fTotHead.alignment = { horizontal: 'center', vertical: 'middle' };
      fTotHead.border = BORDER_THIN_ALL;
      fTotHead.fill = FILL_HEADER;
      wsPO.getCell(`${fTotColLetter}${fHead2}`).border = BORDER_THIN_ALL;

      fr += 2;

      const ratioGroups = groupColorsByRatio(item.colors, item.sizes);

      ratioGroups.forEach((group) => {
        const fRatioRowIdx = fr;
        const fRatioLabel = wsPO.getCell(`C${fRatioRowIdx}`);
        fRatioLabel.value = `每袋混碼配比 (${group.piecesPerPack} 件/包)`;
        fRatioLabel.font = FONT_ZH_RATIO;
        fRatioLabel.alignment = { horizontal: 'left', vertical: 'middle' };
        fRatioLabel.border = BORDER_THIN_ALL;
        fRatioLabel.fill = FILL_RATIO_ROW;

        item.sizes.forEach((s, sIdx) => {
          const colLetter = String.fromCharCode(fStartCol + sIdx);
          const cell = wsPO.getCell(`${colLetter}${fRatioRowIdx}`);
          const rVal = group.ratioBySize[s] !== undefined ? group.ratioBySize[s] : '-';
          cell.value = rVal;
          cell.font = FONT_ZH_RATIO;
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = BORDER_THIN_ALL;
          cell.fill = FILL_RATIO_ROW;
        });

        const fRatioTotCell = wsPO.getCell(`${fTotColLetter}${fRatioRowIdx}`);
        fRatioTotCell.value = `${group.piecesPerPack} 件/包`;
        fRatioTotCell.font = FONT_ZH_RATIO;
        fRatioTotCell.alignment = { horizontal: 'center', vertical: 'middle' };
        fRatioTotCell.border = BORDER_THIN_ALL;
        fRatioTotCell.fill = FILL_RATIO_ROW;
        fr++;

        group.colors.forEach((c) => {
          const cLabel = wsPO.getCell(`C${fr}`);
          cLabel.value = `${c.colorName} (${c.colorCode}) 實際裁剪件數`;
          cLabel.font = FONT_ZH_REGULAR;
          cLabel.alignment = { horizontal: 'left', vertical: 'middle' };
          cLabel.border = BORDER_THIN_ALL;

          item.sizes.forEach((s, sIdx) => {
            const colLetter = String.fromCharCode(fStartCol + sIdx);
            const cell = wsPO.getCell(`${colLetter}${fr}`);
            const qVal = c.quantitiesBySize[s] ?? 0;
            cell.value = qVal;
            cell.font = FONT_ZH_REGULAR;
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = BORDER_THIN_ALL;
            cell.numFmt = '#,##0';
          });

          const cTot = wsPO.getCell(`${fTotColLetter}${fr}`);
          cTot.value = `${c.totalQuantity.toLocaleString()} 件`;
          cTot.font = FONT_ZH_BOLD;
          cTot.alignment = { horizontal: 'center', vertical: 'middle' };
          cTot.border = BORDER_THIN_ALL;
          fr++;
        });
      });
    }

    fr++; // space between items
  });

  // Factory total row: 合 計 :
  wsPO.mergeCells(`A${fr}:C${fr}`);
  wsPO.getCell(`A${fr}`).value = '合 計 :';
  wsPO.getCell(`A${fr}`).font = FONT_ZH_BOLD;

  wsPO.getCell(`D${fr}`).value = totalFactoryQty;
  wsPO.getCell(`D${fr}`).font = FONT_ZH_BOLD;
  wsPO.getCell(`D${fr}`).alignment = { horizontal: 'right', vertical: 'middle' };
  wsPO.getCell(`D${fr}`).numFmt = '#,##0';

  wsPO.getCell(`E${fr}`).value = poCurrency;
  wsPO.getCell(`E${fr}`).font = FONT_ZH_BOLD;
  wsPO.getCell(`E${fr}`).alignment = { horizontal: 'right', vertical: 'middle' };

  wsPO.getCell(`F${fr}`).value = totalFactoryAmt;
  wsPO.getCell(`F${fr}`).font = FONT_ZH_BOLD;
  wsPO.getCell(`F${fr}`).alignment = { horizontal: 'right', vertical: 'middle' };
  wsPO.getCell(`F${fr}`).numFmt = '#,##0.00';

  for (let c = 1; c <= 6; c++) {
    wsPO.getRow(fr).getCell(c).border = BORDER_TOTAL_ROW;
  }
  fr++;

  // 金額總計大寫
  wsPO.mergeCells(`A${fr}:F${fr}`);
  const fSayCell = wsPO.getCell(`A${fr}`);
  const zhWords =
    poCurrency === 'USD'
      ? `金額總計: 美金 ${amountToChineseWords(totalFactoryAmt).replace(/人民幣/g, '美金')}`
      : `金額總計: ${amountToChineseWords(totalFactoryAmt)}`;
  fSayCell.value = zhWords;
  fSayCell.font = FONT_ZH_BOLD;
  fr += 2;

  // =========================================================================
  // REACH 環保標準 (原版大字粗體置中 - 全繁體字)
  // =========================================================================
  wsPO.mergeCells(`A${fr}:F${fr}`);
  const reachCell = wsPO.getCell(`A${fr}`);
  reachCell.value = '****所有主副料均需環保,符合歐洲REACH環保標準****';
  reachCell.font = FONT_ZH_REACH;
  reachCell.alignment = { horizontal: 'center', vertical: 'middle' };
  fr += 2;

  // =========================================================================
  // 注意事項條款 (完整 3 條合規與違約空運責任)
  // =========================================================================
  wsPO.mergeCells(`A${fr}:F${fr}`);
  wsPO.getCell(`A${fr}`).value = '注意事項:';
  wsPO.getCell(`A${fr}`).font = FONT_ZH_BOLD;
  fr++;

  wsPO.mergeCells(`A${fr}:F${fr}`);
  wsPO.getCell(`A${fr}`).value = '1. 大貨生產務必遵循客人的製造協議之合規要求。';
  wsPO.getCell(`A${fr}`).font = FONT_ZH_SMALL;
  fr++;

  wsPO.mergeCells(`A${fr}:F${fr}`);
  wsPO.getCell(`A${fr}`).value =
    '2. 出貨數量許不超過百分之三（+/- 3%）的超量生產(依照每色算), 若有多出或短少數量, 必須提前通知客人,得到客人允許才能多出貨。生產數量少於訂購數量的3%，必須出貨前45天通知客人，以決定是否繼續生產不足數量或對已生產數量給予10%折扣。';
  wsPO.getCell(`A${fr}`).font = FONT_ZH_SMALL;
  wsPO.getCell(`A${fr}`).alignment = { wrapText: true };
  wsPO.getRow(fr).height = 28;
  fr++;

  wsPO.mergeCells(`A${fr}:F${fr}`);
  wsPO.getCell(`A${fr}`).value = '3. 延遲交貨時間, 若客人要求空運需由貴司自行負責空運費用。';
  wsPO.getCell(`A${fr}`).font = FONT_ZH_SMALL;
  fr += 2;

  // =========================================================================
  // 簽字回簽區 (依指示：我司簽名與印章不顯示，僅保留工廠回簽)
  // =========================================================================
  wsPO.getCell(`A${fr}`).value = order.factorySupplier;
  wsPO.getCell(`A${fr}`).font = FONT_ZH_BOLD;
  fr++;

  wsPO.getCell(`A${fr}`).value = '(請簽回,謝謝!)';
  wsPO.getCell(`A${fr}`).font = FONT_ZH_SMALL;

}


/**
 * 1. 獨立導出英文 Proforma Invoice (P/I) Excel 檔案（單一獨立檔案，無 Sheet2）
 */
export async function exportProformaInvoiceExcel(
  order: OrderData,
  customFilename?: string
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SPORTS KITE INTERNATIONAL CO., LTD.';
  wb.lastModifiedBy = 'SPORTS KITE INTERNATIONAL CO., LTD.';
  wb.created = new Date();
  wb.modified = new Date();

  const wsPI = wb.addWorksheet('PROFORMA_INVOICE', {
    views: [{ showGridLines: true }],
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToWidth: 1, fitToHeight: 0 },
  });

  buildProformaInvoiceSheet(wsPI, order);

  const filename =
    customFilename || `PI_${order.piNumber || order.poNumber || 'ORDER'}.xlsx`;
  await saveWorkbookToFile(wb, filename);
}

/**
 * 2. 獨立導出中文工廠採購單 Excel 檔案（單一獨立檔案，無 Sheet1）
 */
export async function exportFactoryPOExcel(
  order: OrderData,
  customFilename?: string,
  options?: { poCurrency?: 'RMB' | 'USD'; prepackMode?: 'detail' | 'summary' }
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SPORTS KITE INTERNATIONAL CO., LTD.';
  wb.lastModifiedBy = 'SPORTS KITE INTERNATIONAL CO., LTD.';
  wb.created = new Date();
  wb.modified = new Date();

  const wsPO = wb.addWorksheet('工廠採購單', {
    views: [{ showGridLines: true }],
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToWidth: 1, fitToHeight: 0 },
  });

  buildFactoryPOSheet(wsPO, order, options);

  const filename =
    customFilename || `採購單_${order.poNumber || order.piNumber || 'ORDER'}.xlsx`;
  await saveWorkbookToFile(wb, filename);
}

/**
 * 3. 一鍵導出 P/I & 採購單：分開為 2 個獨立 Excel 檔案依序下載（絕不放在同一檔案的 Sheet1 & Sheet2）
 */
export async function exportOrderToExcel(
  order: OrderData,
  _filename?: string,
  options?: { poCurrency?: 'RMB' | 'USD'; prepackMode?: 'detail' | 'summary' }
): Promise<void> {
  // 第 1 檔：英文 P/I 檔案 (PI_xxx.xlsx)
  await exportProformaInvoiceExcel(order);

  // 延遲 600ms 避免瀏覽器並發下載阻擋，接著下載第 2 檔
  await new Promise((resolve) => setTimeout(resolve, 600));

  // 第 2 檔：中文工廠採購單檔案 (採購單_xxx.xlsx)
  await exportFactoryPOExcel(order, undefined, options);
}

/**
 * 導出 5 欄簡易產品號碼/數量/客戶金額 Excel 表格（完全按照使用者截圖指定格式，欄位均不更動）
 * 欄位：
 * A: 產品編號
 * B: 客戶產品編號
 * C: 數量
 * D: 金額
 * E: 組合數量
 */
export async function exportSimpleProductExcel(
  order: OrderData,
  customFilename?: string
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SPORTS KITE INTERNATIONAL CO., LTD.';
  wb.created = new Date();

  const ws = wb.addWorksheet('Sheet1', {
    views: [{ showGridLines: true }],
  });

  // 欄位寬度
  ws.columns = [
    { key: 'itemNo', width: 18 },
    { key: 'customerItemNo', width: 18 },
    { key: 'quantity', width: 12 },
    { key: 'amount', width: 12 },
    { key: 'comboQty', width: 14 },
  ];

  // 第 1 列標題列：欄位絕對不能更動
  const headers = ['產品編號', '客戶產品編號', '數量', '金額', '組合數量'];
  const headerRow = ws.addRow(headers);
  headerRow.height = 20;

  const FONT_STD: Partial<ExcelJS.Font> = {
    name: 'Microsoft JhengHei',
    size: 11,
    color: { argb: 'FF000000' },
  };

  const FONT_HEADER: Partial<ExcelJS.Font> = {
    name: 'Microsoft JhengHei',
    size: 11,
    bold: false,
    color: { argb: 'FF000000' },
  };

  headerRow.eachCell((cell, colNumber) => {
    cell.font = FONT_HEADER;
    if (colNumber >= 3) {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    } else {
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
    }
  });

  // 填寫資料列
  order.items.forEach((item) => {
    const itemQty =
      item.totalQuantity ||
      item.colors.reduce((sum, c) => sum + (c.totalQuantity || 0), 0);
    const unitPrice = item.unitPriceUSD || 0;

    const row = ws.addRow([
      item.itemNo, // A: 產品編號
      '',          // B: 客戶產品編號 (留空如圖片範例)
      itemQty,     // C: 數量
      unitPrice,   // D: 金額 (客戶金額)
      item.kitQty ? item.kitQty : '', // E: 組合數量 (留空如圖片範例)
    ]);
    row.height = 20;

    // A: 產品編號
    const cellA = row.getCell(1);
    cellA.font = FONT_STD;
    cellA.alignment = { horizontal: 'left', vertical: 'middle' };

    // B: 客戶產品編號
    const cellB = row.getCell(2);
    cellB.font = FONT_STD;
    cellB.alignment = { horizontal: 'left', vertical: 'middle' };

    // C: 數量
    const cellC = row.getCell(3);
    cellC.font = FONT_STD;
    cellC.alignment = { horizontal: 'right', vertical: 'middle' };
    cellC.numFmt = '#,##0';

    // D: 金額
    const cellD = row.getCell(4);
    cellD.font = FONT_STD;
    cellD.alignment = { horizontal: 'right', vertical: 'middle' };
    cellD.numFmt = Number.isInteger(unitPrice) ? '0' : '0.00';

    // E: 組合數量
    const cellE = row.getCell(5);
    cellE.font = FONT_STD;
    cellE.alignment = { horizontal: 'right', vertical: 'middle' };
  });

  // 下載 Excel
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download =
    customFilename ||
    `${order.poNumber || order.piNumber || 'ORDER'}_產品數量金額清單.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
}
