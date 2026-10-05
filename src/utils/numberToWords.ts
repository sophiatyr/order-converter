// Convert USD number to English financial uppercase words
// e.g. 1104.00 -> "SAY TOTAL US DOLLARS ONE THOUSAND ONE HUNDRED AND FOUR ONLY."
export function amountToEnglishWords(amount: number): string {
  if (isNaN(amount) || amount === 0) {
    return 'SAY TOTAL US DOLLARS ZERO ONLY.';
  }

  const ones = [
    '', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE',
    'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN',
    'SEVENTEEN', 'EIGHTEEN', 'NINETEEN',
  ];

  const tens = [
    '', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY',
  ];

  function convertHundreds(n: number): string {
    let str = '';
    if (n >= 100) {
      str += ones[Math.floor(n / 100)] + ' HUNDRED ';
      n %= 100;
    }
    if (n >= 20) {
      str += tens[Math.floor(n / 10)];
      if (n % 10 > 0) str += '-' + ones[n % 10];
      str += ' ';
    } else if (n > 0) {
      str += ones[n] + ' ';
    }
    return str.trim();
  }

  const intPart = Math.floor(amount);
  const cents = Math.round((amount - intPart) * 100);

  let result = '';
  let temp = intPart;

  if (temp >= 1000000) {
    const millions = Math.floor(temp / 1000000);
    result += convertHundreds(millions) + ' MILLION ';
    temp %= 1000000;
  }
  if (temp >= 1000) {
    const thousands = Math.floor(temp / 1000);
    result += convertHundreds(thousands) + ' THOUSAND ';
    temp %= 1000;
  }
  if (temp > 0) {
    result += convertHundreds(temp) + ' ';
  }

  result = result.trim();

  let finalStr = `SAY TOTAL US DOLLARS ${result || 'ZERO'}`;
  if (cents > 0) {
    finalStr += ` AND CENTS ${convertHundreds(cents)}`;
  }
  finalStr += ' ONLY.';

  return finalStr;
}

// Convert RMB number to traditional financial Chinese uppercase
// e.g. 6480.00 -> "人民幣陸仟肆佰捌拾元整"
export function amountToChineseWords(num: number): string {
  if (isNaN(num) || num === 0) {
    return '人民幣零元整';
  }

  const digits = ['零', '壹', '貳', '參', '肆', '伍', '陸', '柒', '捌', '玖'];
  const radices = ['', '拾', '佰', '仟'];
  const bigRadices = ['', '萬', '億'];

  let intPart = Math.floor(num);
  const decPart = Math.round((num - intPart) * 100);

  let chineseStr = '';
  let zeroCount = 0;
  let sectionIndex = 0;

  if (intPart === 0) {
    chineseStr = '零';
  } else {
    while (intPart > 0) {
      const section = intPart % 10000;
      let sectionStr = '';
      let secZero = 0;
      let secTemp = section;

      for (let i = 0; i < 4; i++) {
        const d = secTemp % 10;
        if (d === 0) {
          secZero++;
        } else {
          if (secZero > 0) {
            sectionStr = digits[0] + sectionStr;
            secZero = 0;
          }
          sectionStr = digits[d] + radices[i] + sectionStr;
        }
        secTemp = Math.floor(secTemp / 10);
      }

      if (section > 0) {
        chineseStr = sectionStr + bigRadices[sectionIndex] + chineseStr;
      }
      sectionIndex++;
      intPart = Math.floor(intPart / 10000);
    }
  }

  // Clean double zeros
  chineseStr = chineseStr.replace(/零+/g, '零').replace(/零$/, '');

  let res = '人民幣' + (chineseStr || '零') + '元';

  if (decPart === 0) {
    res += '整';
  } else {
    const jiao = Math.floor(decPart / 10);
    const fen = decPart % 10;
    if (jiao > 0) res += digits[jiao] + '角';
    if (fen > 0) res += digits[fen] + '分';
  }

  return res;
}
