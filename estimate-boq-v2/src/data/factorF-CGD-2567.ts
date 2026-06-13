/**
 * ตาราง Factor F งานก่อสร้างอาคาร — กรมบัญชีกลาง (สงป. 2567)
 * ดอกเบี้ยเงินกู้ 7% ต่อปี, VAT 7%
 *
 * 12 combinations: เงินล่วงหน้า (0/5/10/15%) × เงินประกันผลงาน (0/5/10%)
 * 24 ช่วงค่างาน (≤0.5 ถึง >500 ล้านบาท)
 *
 * แต่ละ bracket: [ค่างาน(ล้าน), ค่าอำนวยการ%, ค่าดอกเบี้ย%, กำไร%, รวม%, รวมFactor, VAT, FactorF]
 */

export interface FactorFBracket {
  cost: number;       // ค่างาน (ล้านบาท) — 0.5 = "≤0.5", 9999 = ">500"
  admin: number;      // ค่าอำนวยการ %
  interest: number;   // ค่าดอกเบี้ย %
  profit: number;     // กำไร %
  totalPct: number;   // รวมค่าใช้จ่าย %
  factor: number;     // รวมในรูป Factor
  vat: number;        // ภาษีมูลค่าเพิ่ม (1.0700)
  factorF: number;    // ค่า Factor F
}

export interface FactorFTable {
  advance: number;    // เงินล่วงหน้าจ่าย %
  retention: number;  // เงินประกันผลงานหัก %
  loanRate: number;   // ดอกเบี้ยเงินกู้ % ต่อปี
  vatRate: number;    // VAT %
  brackets: FactorFBracket[];
}

// ─── หน้า 2: เงินล่วงหน้า 0%, ประกัน 0% ───
const T_A0_R0: FactorFBracket[] = [
  { cost: 0.5,  admin: 15.6856, interest: 1.1666, profit: 5.5, totalPct: 22.3522, factor: 1.2235, vat: 1.07, factorF: 1.3091 },
  { cost: 1,    admin: 15.4654, interest: 1.1666, profit: 5.5, totalPct: 22.1320, factor: 1.2213, vat: 1.07, factorF: 1.3067 },
  { cost: 2,    admin: 15.3220, interest: 1.1666, profit: 5.5, totalPct: 21.9886, factor: 1.2198, vat: 1.07, factorF: 1.3051 },
  { cost: 5,    admin: 15.0245, interest: 1.1666, profit: 5.5, totalPct: 21.6911, factor: 1.2169, vat: 1.07, factorF: 1.3020 },
  { cost: 10,   admin: 14.9659, interest: 1.1666, profit: 5.0, totalPct: 21.1325, factor: 1.2113, vat: 1.07, factorF: 1.2960 },
  { cost: 15,   admin: 11.7000, interest: 1.1666, profit: 5.0, totalPct: 17.8666, factor: 1.1786, vat: 1.07, factorF: 1.2611 },
  { cost: 20,   admin: 10.9884, interest: 1.1666, profit: 5.0, totalPct: 17.1550, factor: 1.1715, vat: 1.07, factorF: 1.2535 },
  { cost: 25,   admin: 8.9675,  interest: 1.1666, profit: 4.5, totalPct: 14.6341, factor: 1.1463, vat: 1.07, factorF: 1.2265 },
  { cost: 30,   admin: 8.1852,  interest: 1.1666, profit: 4.5, totalPct: 13.8518, factor: 1.1385, vat: 1.07, factorF: 1.2181 },
  { cost: 40,   admin: 8.1487,  interest: 1.1666, profit: 4.5, totalPct: 13.8153, factor: 1.1381, vat: 1.07, factorF: 1.2177 },
  { cost: 50,   admin: 8.1374,  interest: 1.1666, profit: 4.5, totalPct: 13.8040, factor: 1.1380, vat: 1.07, factorF: 1.2176 },
  { cost: 60,   admin: 7.7209,  interest: 1.1666, profit: 4.0, totalPct: 12.8875, factor: 1.1288, vat: 1.07, factorF: 1.2078 },
  { cost: 70,   admin: 7.6178,  interest: 1.1666, profit: 4.0, totalPct: 12.7844, factor: 1.1278, vat: 1.07, factorF: 1.2067 },
  { cost: 80,   admin: 7.6178,  interest: 1.1666, profit: 4.0, totalPct: 12.7844, factor: 1.1278, vat: 1.07, factorF: 1.2067 },
  { cost: 90,   admin: 7.6095,  interest: 1.1666, profit: 4.0, totalPct: 12.7761, factor: 1.1277, vat: 1.07, factorF: 1.2066 },
  { cost: 100,  admin: 7.6095,  interest: 1.1666, profit: 4.0, totalPct: 12.7761, factor: 1.1277, vat: 1.07, factorF: 1.2066 },
  { cost: 150,  admin: 7.3600,  interest: 1.1666, profit: 4.0, totalPct: 12.5266, factor: 1.1252, vat: 1.07, factorF: 1.2039 },
  { cost: 200,  admin: 7.3617,  interest: 1.1666, profit: 4.0, totalPct: 12.5283, factor: 1.1252, vat: 1.07, factorF: 1.2039 },
  { cost: 250,  admin: 7.2736,  interest: 1.1666, profit: 4.0, totalPct: 12.4402, factor: 1.1244, vat: 1.07, factorF: 1.2031 },
  { cost: 300,  admin: 7.1950,  interest: 1.1666, profit: 3.5, totalPct: 11.8616, factor: 1.1186, vat: 1.07, factorF: 1.1969 },
  { cost: 350,  admin: 6.4098,  interest: 1.1666, profit: 3.5, totalPct: 11.0764, factor: 1.1107, vat: 1.07, factorF: 1.1884 },
  { cost: 400,  admin: 6.3344,  interest: 1.1666, profit: 3.5, totalPct: 11.0010, factor: 1.1100, vat: 1.07, factorF: 1.1877 },
  { cost: 500,  admin: 6.2868,  interest: 1.1666, profit: 3.5, totalPct: 10.9534, factor: 1.1095, vat: 1.07, factorF: 1.1871 },
  { cost: 9999, admin: 5.6676,  interest: 1.1666, profit: 3.5, totalPct: 10.3342, factor: 1.1033, vat: 1.07, factorF: 1.1805 },
];

// ─── หน้า 3: เงินล่วงหน้า 0%, ประกัน 5% ───
const T_A0_R5: FactorFBracket[] = [
  { cost: 0.5,  admin: 15.6856, interest: 1.2104, profit: 5.5, totalPct: 22.3960, factor: 1.2239, vat: 1.07, factorF: 1.3095 },
  { cost: 1,    admin: 15.4654, interest: 1.2250, profit: 5.5, totalPct: 22.1904, factor: 1.2219, vat: 1.07, factorF: 1.3074 },
  { cost: 2,    admin: 15.3220, interest: 1.2395, profit: 5.5, totalPct: 22.0615, factor: 1.2206, vat: 1.07, factorF: 1.3060 },
  { cost: 5,    admin: 15.0245, interest: 1.3125, profit: 5.5, totalPct: 21.8370, factor: 1.2183, vat: 1.07, factorF: 1.3035 },
  { cost: 10,   admin: 14.9659, interest: 1.3562, profit: 5.0, totalPct: 21.3221, factor: 1.2132, vat: 1.07, factorF: 1.2981 },
  { cost: 15,   admin: 11.7000, interest: 1.3562, profit: 5.0, totalPct: 18.0562, factor: 1.1805, vat: 1.07, factorF: 1.2631 },
  { cost: 20,   admin: 10.9884, interest: 1.3708, profit: 5.0, totalPct: 17.3592, factor: 1.1735, vat: 1.07, factorF: 1.2556 },
  { cost: 25,   admin: 8.9675,  interest: 1.3708, profit: 4.5, totalPct: 14.8383, factor: 1.1483, vat: 1.07, factorF: 1.2286 },
  { cost: 30,   admin: 8.1852,  interest: 1.3854, profit: 4.5, totalPct: 14.0706, factor: 1.1407, vat: 1.07, factorF: 1.2205 },
  { cost: 40,   admin: 8.1487,  interest: 1.3854, profit: 4.5, totalPct: 14.0341, factor: 1.1403, vat: 1.07, factorF: 1.2201 },
  { cost: 50,   admin: 8.1374,  interest: 1.4145, profit: 4.5, totalPct: 14.0519, factor: 1.1405, vat: 1.07, factorF: 1.2203 },
  { cost: 60,   admin: 7.7209,  interest: 1.4145, profit: 4.0, totalPct: 13.1354, factor: 1.1313, vat: 1.07, factorF: 1.2104 },
  { cost: 70,   admin: 7.6178,  interest: 1.4291, profit: 4.0, totalPct: 13.0469, factor: 1.1304, vat: 1.07, factorF: 1.2095 },
  { cost: 80,   admin: 7.6178,  interest: 1.4291, profit: 4.0, totalPct: 13.0469, factor: 1.1304, vat: 1.07, factorF: 1.2095 },
  { cost: 90,   admin: 7.6095,  interest: 1.4291, profit: 4.0, totalPct: 13.0386, factor: 1.1303, vat: 1.07, factorF: 1.2094 },
  { cost: 100,  admin: 7.6095,  interest: 1.4291, profit: 4.0, totalPct: 13.0386, factor: 1.1303, vat: 1.07, factorF: 1.2094 },
  { cost: 150,  admin: 7.3600,  interest: 1.4583, profit: 4.0, totalPct: 12.8183, factor: 1.1281, vat: 1.07, factorF: 1.2070 },
  { cost: 200,  admin: 7.3617,  interest: 1.4875, profit: 4.0, totalPct: 12.8492, factor: 1.1284, vat: 1.07, factorF: 1.2073 },
  { cost: 250,  admin: 7.2736,  interest: 1.5458, profit: 4.0, totalPct: 12.8194, factor: 1.1281, vat: 1.07, factorF: 1.2070 },
  { cost: 300,  admin: 7.1950,  interest: 1.5750, profit: 3.5, totalPct: 12.2700, factor: 1.1227, vat: 1.07, factorF: 1.2012 },
  { cost: 350,  admin: 6.4098,  interest: 1.6041, profit: 3.5, totalPct: 11.5139, factor: 1.1151, vat: 1.07, factorF: 1.1931 },
  { cost: 400,  admin: 6.3344,  interest: 1.6625, profit: 3.5, totalPct: 11.4969, factor: 1.1149, vat: 1.07, factorF: 1.1929 },
  { cost: 500,  admin: 6.2868,  interest: 1.6770, profit: 3.5, totalPct: 11.4638, factor: 1.1146, vat: 1.07, factorF: 1.1926 },
  { cost: 9999, admin: 5.6676,  interest: 1.7208, profit: 3.5, totalPct: 10.8884, factor: 1.1088, vat: 1.07, factorF: 1.1864 },
];

// ─── หน้า 4: เงินล่วงหน้า 0%, ประกัน 10% ───
const T_A0_R10: FactorFBracket[] = [
  { cost: 0.5,  admin: 15.6856, interest: 1.2541, profit: 5.5, totalPct: 22.4397, factor: 1.2243, vat: 1.07, factorF: 1.3100 },
  { cost: 1,    admin: 15.4654, interest: 1.2833, profit: 5.5, totalPct: 22.2487, factor: 1.2224, vat: 1.07, factorF: 1.3079 },
  { cost: 2,    admin: 15.3220, interest: 1.3125, profit: 5.5, totalPct: 22.1345, factor: 1.2213, vat: 1.07, factorF: 1.3067 },
  { cost: 5,    admin: 15.0245, interest: 1.4583, profit: 5.5, totalPct: 21.9828, factor: 1.2198, vat: 1.07, factorF: 1.3051 },
  { cost: 10,   admin: 14.9659, interest: 1.5458, profit: 5.0, totalPct: 21.5117, factor: 1.2151, vat: 1.07, factorF: 1.3001 },
  { cost: 15,   admin: 11.7000, interest: 1.5458, profit: 5.0, totalPct: 18.2458, factor: 1.1824, vat: 1.07, factorF: 1.2651 },
  { cost: 20,   admin: 10.9884, interest: 1.5750, profit: 5.0, totalPct: 17.5634, factor: 1.1756, vat: 1.07, factorF: 1.2578 },
  { cost: 25,   admin: 8.9675,  interest: 1.5750, profit: 4.5, totalPct: 15.0425, factor: 1.1504, vat: 1.07, factorF: 1.2309 },
  { cost: 30,   admin: 8.1852,  interest: 1.6041, profit: 4.5, totalPct: 14.2893, factor: 1.1428, vat: 1.07, factorF: 1.2227 },
  { cost: 40,   admin: 8.1487,  interest: 1.6041, profit: 4.5, totalPct: 14.2528, factor: 1.1425, vat: 1.07, factorF: 1.2224 },
  { cost: 50,   admin: 8.1374,  interest: 1.6625, profit: 4.5, totalPct: 14.2999, factor: 1.1429, vat: 1.07, factorF: 1.2229 },
  { cost: 60,   admin: 7.7209,  interest: 1.6625, profit: 4.0, totalPct: 13.3834, factor: 1.1338, vat: 1.07, factorF: 1.2131 },
  { cost: 70,   admin: 7.6178,  interest: 1.6916, profit: 4.0, totalPct: 13.3094, factor: 1.1330, vat: 1.07, factorF: 1.2123 },
  { cost: 80,   admin: 7.6178,  interest: 1.6916, profit: 4.0, totalPct: 13.3094, factor: 1.1330, vat: 1.07, factorF: 1.2123 },
  { cost: 90,   admin: 7.6095,  interest: 1.6916, profit: 4.0, totalPct: 13.3011, factor: 1.1330, vat: 1.07, factorF: 1.2123 },
  { cost: 100,  admin: 7.6095,  interest: 1.6916, profit: 4.0, totalPct: 13.3011, factor: 1.1330, vat: 1.07, factorF: 1.2123 },
  { cost: 150,  admin: 7.3600,  interest: 1.7500, profit: 4.0, totalPct: 13.1100, factor: 1.1311, vat: 1.07, factorF: 1.2102 },
  { cost: 200,  admin: 7.3617,  interest: 1.8083, profit: 4.0, totalPct: 13.1700, factor: 1.1317, vat: 1.07, factorF: 1.2109 },
  { cost: 250,  admin: 7.2736,  interest: 1.9250, profit: 4.0, totalPct: 13.1986, factor: 1.1319, vat: 1.07, factorF: 1.2111 },
  { cost: 300,  admin: 7.1950,  interest: 1.9833, profit: 3.5, totalPct: 12.6783, factor: 1.1267, vat: 1.07, factorF: 1.2055 },
  { cost: 350,  admin: 6.4098,  interest: 2.0416, profit: 3.5, totalPct: 11.9514, factor: 1.1195, vat: 1.07, factorF: 1.1978 },
  { cost: 400,  admin: 6.3344,  interest: 2.1583, profit: 3.5, totalPct: 11.9927, factor: 1.1199, vat: 1.07, factorF: 1.1982 },
  { cost: 500,  admin: 6.2868,  interest: 2.1875, profit: 3.5, totalPct: 11.9743, factor: 1.1197, vat: 1.07, factorF: 1.1980 },
  { cost: 9999, admin: 5.6676,  interest: 2.2750, profit: 3.5, totalPct: 11.4426, factor: 1.1144, vat: 1.07, factorF: 1.1924 },
];

// ─── หน้า 5: เงินล่วงหน้า 5%, ประกัน 0% ───
const T_A5_R0: FactorFBracket[] = [
  { cost: 0.5,  admin: 15.6856, interest: 1.0645, profit: 5.5, totalPct: 22.2501, factor: 1.2225, vat: 1.07, factorF: 1.3080 },
  { cost: 1,    admin: 15.4654, interest: 1.0500, profit: 5.5, totalPct: 22.0154, factor: 1.2201, vat: 1.07, factorF: 1.3055 },
  { cost: 2,    admin: 15.3220, interest: 1.0354, profit: 5.5, totalPct: 21.8574, factor: 1.2185, vat: 1.07, factorF: 1.3037 },
  { cost: 5,    admin: 15.0245, interest: 0.9625, profit: 5.5, totalPct: 21.4870, factor: 1.2148, vat: 1.07, factorF: 1.2998 },
  { cost: 10,   admin: 14.9659, interest: 0.9187, profit: 5.0, totalPct: 20.8846, factor: 1.2088, vat: 1.07, factorF: 1.2934 },
  { cost: 15,   admin: 11.7000, interest: 0.9187, profit: 5.0, totalPct: 17.6187, factor: 1.1761, vat: 1.07, factorF: 1.2584 },
  { cost: 20,   admin: 10.9884, interest: 0.9041, profit: 5.0, totalPct: 16.8925, factor: 1.1689, vat: 1.07, factorF: 1.2507 },
  { cost: 25,   admin: 8.9675,  interest: 0.9041, profit: 4.5, totalPct: 14.3716, factor: 1.1437, vat: 1.07, factorF: 1.2237 },
  { cost: 30,   admin: 8.1852,  interest: 0.8895, profit: 4.5, totalPct: 13.5747, factor: 1.1357, vat: 1.07, factorF: 1.2151 },
  { cost: 40,   admin: 8.1487,  interest: 0.8895, profit: 4.5, totalPct: 13.5382, factor: 1.1353, vat: 1.07, factorF: 1.2147 },
  { cost: 50,   admin: 8.1374,  interest: 0.8604, profit: 4.5, totalPct: 13.4978, factor: 1.1349, vat: 1.07, factorF: 1.2143 },
  { cost: 60,   admin: 7.7209,  interest: 0.8604, profit: 4.0, totalPct: 12.5813, factor: 1.1258, vat: 1.07, factorF: 1.2046 },
  { cost: 70,   admin: 7.6178,  interest: 0.8458, profit: 4.0, totalPct: 12.4636, factor: 1.1246, vat: 1.07, factorF: 1.2033 },
  { cost: 80,   admin: 7.6178,  interest: 0.8458, profit: 4.0, totalPct: 12.4636, factor: 1.1246, vat: 1.07, factorF: 1.2033 },
  { cost: 90,   admin: 7.6095,  interest: 0.8458, profit: 4.0, totalPct: 12.4553, factor: 1.1245, vat: 1.07, factorF: 1.2032 },
  { cost: 100,  admin: 7.6095,  interest: 0.8458, profit: 4.0, totalPct: 12.4553, factor: 1.1245, vat: 1.07, factorF: 1.2032 },
  { cost: 150,  admin: 7.3600,  interest: 0.8166, profit: 4.0, totalPct: 12.1766, factor: 1.1217, vat: 1.07, factorF: 1.2002 },
  { cost: 200,  admin: 7.3617,  interest: 0.7875, profit: 4.0, totalPct: 12.1492, factor: 1.1214, vat: 1.07, factorF: 1.1998 },
  { cost: 250,  admin: 7.2736,  interest: 0.7291, profit: 4.0, totalPct: 12.0027, factor: 1.1200, vat: 1.07, factorF: 1.1984 },
  { cost: 300,  admin: 7.1950,  interest: 0.7000, profit: 3.5, totalPct: 11.3950, factor: 1.1139, vat: 1.07, factorF: 1.1918 },
  { cost: 350,  admin: 6.4098,  interest: 0.6708, profit: 3.5, totalPct: 10.5806, factor: 1.1058, vat: 1.07, factorF: 1.1832 },
  { cost: 400,  admin: 6.3344,  interest: 0.6125, profit: 3.5, totalPct: 10.4469, factor: 1.1044, vat: 1.07, factorF: 1.1817 },
  { cost: 500,  admin: 6.2868,  interest: 0.5979, profit: 3.5, totalPct: 10.3847, factor: 1.1038, vat: 1.07, factorF: 1.1810 },
  { cost: 9999, admin: 5.6676,  interest: 0.5541, profit: 3.5, totalPct: 9.7217,  factor: 1.0972, vat: 1.07, factorF: 1.1740 },
];

// ─── หน้า 6: เงินล่วงหน้า 5%, ประกัน 5% ───
const T_A5_R5: FactorFBracket[] = [
  { cost: 0.5,  admin: 15.6856, interest: 1.1083, profit: 5.5, totalPct: 22.2939, factor: 1.2229, vat: 1.07, factorF: 1.3085 },
  { cost: 1,    admin: 15.4654, interest: 1.1083, profit: 5.5, totalPct: 22.0737, factor: 1.2207, vat: 1.07, factorF: 1.3061 },
  { cost: 2,    admin: 15.3220, interest: 1.1083, profit: 5.5, totalPct: 21.9303, factor: 1.2193, vat: 1.07, factorF: 1.3046 },
  { cost: 5,    admin: 15.0245, interest: 1.1083, profit: 5.5, totalPct: 21.6328, factor: 1.2163, vat: 1.07, factorF: 1.3014 },
  { cost: 10,   admin: 14.9659, interest: 1.1083, profit: 5.0, totalPct: 21.0742, factor: 1.2107, vat: 1.07, factorF: 1.2954 },
  { cost: 15,   admin: 11.7000, interest: 1.1083, profit: 5.0, totalPct: 17.8083, factor: 1.1780, vat: 1.07, factorF: 1.2604 },
  { cost: 20,   admin: 10.9884, interest: 1.1083, profit: 5.0, totalPct: 17.0967, factor: 1.1709, vat: 1.07, factorF: 1.2528 },
  { cost: 25,   admin: 8.9675,  interest: 1.1083, profit: 4.5, totalPct: 14.5758, factor: 1.1457, vat: 1.07, factorF: 1.2258 },
  { cost: 30,   admin: 8.1852,  interest: 1.1083, profit: 4.5, totalPct: 13.7935, factor: 1.1379, vat: 1.07, factorF: 1.2175 },
  { cost: 40,   admin: 8.1487,  interest: 1.1083, profit: 4.5, totalPct: 13.7570, factor: 1.1375, vat: 1.07, factorF: 1.2171 },
  { cost: 50,   admin: 8.1374,  interest: 1.1083, profit: 4.5, totalPct: 13.7457, factor: 1.1374, vat: 1.07, factorF: 1.2170 },
  { cost: 60,   admin: 7.7209,  interest: 1.1083, profit: 4.0, totalPct: 12.8292, factor: 1.1282, vat: 1.07, factorF: 1.2071 },
  { cost: 70,   admin: 7.6178,  interest: 1.1083, profit: 4.0, totalPct: 12.7261, factor: 1.1272, vat: 1.07, factorF: 1.2061 },
  { cost: 80,   admin: 7.6178,  interest: 1.1083, profit: 4.0, totalPct: 12.7261, factor: 1.1272, vat: 1.07, factorF: 1.2061 },
  { cost: 90,   admin: 7.6095,  interest: 1.1083, profit: 4.0, totalPct: 12.7178, factor: 1.1271, vat: 1.07, factorF: 1.2059 },
  { cost: 100,  admin: 7.6095,  interest: 1.1083, profit: 4.0, totalPct: 12.7178, factor: 1.1271, vat: 1.07, factorF: 1.2059 },
  { cost: 150,  admin: 7.3600,  interest: 1.1083, profit: 4.0, totalPct: 12.4683, factor: 1.1246, vat: 1.07, factorF: 1.2033 },
  { cost: 200,  admin: 7.3617,  interest: 1.1083, profit: 4.0, totalPct: 12.4700, factor: 1.1247, vat: 1.07, factorF: 1.2034 },
  { cost: 250,  admin: 7.2736,  interest: 1.1083, profit: 4.0, totalPct: 12.3819, factor: 1.1238, vat: 1.07, factorF: 1.2024 },
  { cost: 300,  admin: 7.1950,  interest: 1.1083, profit: 3.5, totalPct: 11.8033, factor: 1.1180, vat: 1.07, factorF: 1.1962 },
  { cost: 350,  admin: 6.4098,  interest: 1.1083, profit: 3.5, totalPct: 11.0181, factor: 1.1101, vat: 1.07, factorF: 1.1878 },
  { cost: 400,  admin: 6.3344,  interest: 1.1083, profit: 3.5, totalPct: 10.9427, factor: 1.1094, vat: 1.07, factorF: 1.1870 },
  { cost: 500,  admin: 6.2868,  interest: 1.1083, profit: 3.5, totalPct: 10.8951, factor: 1.1089, vat: 1.07, factorF: 1.1865 },
  { cost: 9999, admin: 5.6676,  interest: 1.1083, profit: 3.5, totalPct: 10.2759, factor: 1.1027, vat: 1.07, factorF: 1.1798 },
];

// ─── หน้า 7: เงินล่วงหน้า 5%, ประกัน 10% ───
const T_A5_R10: FactorFBracket[] = [
  { cost: 0.5,  admin: 15.6856, interest: 1.1520, profit: 5.5, totalPct: 22.3376, factor: 1.2233, vat: 1.07, factorF: 1.3089 },
  { cost: 1,    admin: 15.4654, interest: 1.1666, profit: 5.5, totalPct: 22.1320, factor: 1.2213, vat: 1.07, factorF: 1.3067 },
  { cost: 2,    admin: 15.3220, interest: 1.1812, profit: 5.5, totalPct: 22.0032, factor: 1.2200, vat: 1.07, factorF: 1.3054 },
  { cost: 5,    admin: 15.0245, interest: 1.2541, profit: 5.5, totalPct: 21.7786, factor: 1.2177, vat: 1.07, factorF: 1.3029 },
  { cost: 10,   admin: 14.9659, interest: 1.2979, profit: 5.0, totalPct: 21.2638, factor: 1.2126, vat: 1.07, factorF: 1.2974 },
  { cost: 15,   admin: 11.7000, interest: 1.2979, profit: 5.0, totalPct: 17.9979, factor: 1.1799, vat: 1.07, factorF: 1.2624 },
  { cost: 20,   admin: 10.9884, interest: 1.3125, profit: 5.0, totalPct: 17.3009, factor: 1.1730, vat: 1.07, factorF: 1.2551 },
  { cost: 25,   admin: 8.9675,  interest: 1.3125, profit: 4.5, totalPct: 14.7800, factor: 1.1478, vat: 1.07, factorF: 1.2281 },
  { cost: 30,   admin: 8.1852,  interest: 1.3270, profit: 4.5, totalPct: 14.0122, factor: 1.1401, vat: 1.07, factorF: 1.2199 },
  { cost: 40,   admin: 8.1487,  interest: 1.3270, profit: 4.5, totalPct: 13.9757, factor: 1.1397, vat: 1.07, factorF: 1.2194 },
  { cost: 50,   admin: 8.1374,  interest: 1.3562, profit: 4.5, totalPct: 13.9936, factor: 1.1399, vat: 1.07, factorF: 1.2196 },
  { cost: 60,   admin: 7.7209,  interest: 1.3562, profit: 4.0, totalPct: 13.0771, factor: 1.1307, vat: 1.07, factorF: 1.2098 },
  { cost: 70,   admin: 7.6178,  interest: 1.3708, profit: 4.0, totalPct: 12.9886, factor: 1.1298, vat: 1.07, factorF: 1.2088 },
  { cost: 80,   admin: 7.6178,  interest: 1.3708, profit: 4.0, totalPct: 12.9886, factor: 1.1298, vat: 1.07, factorF: 1.2088 },
  { cost: 90,   admin: 7.6095,  interest: 1.3708, profit: 4.0, totalPct: 12.9803, factor: 1.1298, vat: 1.07, factorF: 1.2088 },
  { cost: 100,  admin: 7.6095,  interest: 1.3708, profit: 4.0, totalPct: 12.9803, factor: 1.1298, vat: 1.07, factorF: 1.2088 },
  { cost: 150,  admin: 7.3600,  interest: 1.4000, profit: 4.0, totalPct: 12.7600, factor: 1.1276, vat: 1.07, factorF: 1.2065 },
  { cost: 200,  admin: 7.3617,  interest: 1.4291, profit: 4.0, totalPct: 12.7908, factor: 1.1279, vat: 1.07, factorF: 1.2068 },
  { cost: 250,  admin: 7.2736,  interest: 1.4875, profit: 4.0, totalPct: 12.7611, factor: 1.1276, vat: 1.07, factorF: 1.2065 },
  { cost: 300,  admin: 7.1950,  interest: 1.5166, profit: 3.5, totalPct: 12.2116, factor: 1.1221, vat: 1.07, factorF: 1.2006 },
  { cost: 350,  admin: 6.4098,  interest: 1.5458, profit: 3.5, totalPct: 11.4556, factor: 1.1145, vat: 1.07, factorF: 1.1925 },
  { cost: 400,  admin: 6.3344,  interest: 1.6041, profit: 3.5, totalPct: 11.4385, factor: 1.1143, vat: 1.07, factorF: 1.1923 },
  { cost: 500,  admin: 6.2868,  interest: 1.6187, profit: 3.5, totalPct: 11.4055, factor: 1.1140, vat: 1.07, factorF: 1.1919 },
  { cost: 9999, admin: 5.6676,  interest: 1.6625, profit: 3.5, totalPct: 10.8301, factor: 1.1083, vat: 1.07, factorF: 1.1858 },
];

// ─── หน้า 8: เงินล่วงหน้า 10%, ประกัน 0% ───
const T_A10_R0: FactorFBracket[] = [
  { cost: 0.5,  admin: 15.6856, interest: 0.9625, profit: 5.5, totalPct: 22.1481, factor: 1.2214, vat: 1.07, factorF: 1.3068 },
  { cost: 1,    admin: 15.4654, interest: 0.9333, profit: 5.5, totalPct: 21.8987, factor: 1.2189, vat: 1.07, factorF: 1.3042 },
  { cost: 2,    admin: 15.3220, interest: 0.9041, profit: 5.5, totalPct: 21.7261, factor: 1.2172, vat: 1.07, factorF: 1.3024 },
  { cost: 5,    admin: 15.0245, interest: 0.7583, profit: 5.5, totalPct: 21.2828, factor: 1.2128, vat: 1.07, factorF: 1.2976 },
  { cost: 10,   admin: 14.9659, interest: 0.6708, profit: 5.0, totalPct: 20.6367, factor: 1.2063, vat: 1.07, factorF: 1.2907 },
  { cost: 15,   admin: 11.7000, interest: 0.6708, profit: 5.0, totalPct: 17.3708, factor: 1.1737, vat: 1.07, factorF: 1.2558 },
  { cost: 20,   admin: 10.9884, interest: 0.6416, profit: 5.0, totalPct: 16.6300, factor: 1.1663, vat: 1.07, factorF: 1.2479 },
  { cost: 25,   admin: 8.9675,  interest: 0.6416, profit: 4.5, totalPct: 14.1091, factor: 1.1410, vat: 1.07, factorF: 1.2208 },
  { cost: 30,   admin: 8.1852,  interest: 0.6125, profit: 4.5, totalPct: 13.2977, factor: 1.1329, vat: 1.07, factorF: 1.2122 },
  { cost: 40,   admin: 8.1487,  interest: 0.6125, profit: 4.5, totalPct: 13.2612, factor: 1.1326, vat: 1.07, factorF: 1.2118 },
  { cost: 50,   admin: 8.1374,  interest: 0.5541, profit: 4.5, totalPct: 13.1915, factor: 1.1319, vat: 1.07, factorF: 1.2111 },
  { cost: 60,   admin: 7.7209,  interest: 0.5541, profit: 4.0, totalPct: 12.2750, factor: 1.1227, vat: 1.07, factorF: 1.2012 },
  { cost: 70,   admin: 7.6178,  interest: 0.5250, profit: 4.0, totalPct: 12.1428, factor: 1.1214, vat: 1.07, factorF: 1.1998 },
  { cost: 80,   admin: 7.6178,  interest: 0.5250, profit: 4.0, totalPct: 12.1428, factor: 1.1214, vat: 1.07, factorF: 1.1998 },
  { cost: 90,   admin: 7.6095,  interest: 0.5250, profit: 4.0, totalPct: 12.1345, factor: 1.1213, vat: 1.07, factorF: 1.1997 },
  { cost: 100,  admin: 7.6095,  interest: 0.5250, profit: 4.0, totalPct: 12.1345, factor: 1.1213, vat: 1.07, factorF: 1.1997 },
  { cost: 150,  admin: 7.3600,  interest: 0.4666, profit: 4.0, totalPct: 11.8266, factor: 1.1182, vat: 1.07, factorF: 1.1964 },
  { cost: 200,  admin: 7.3617,  interest: 0.4083, profit: 4.0, totalPct: 11.7700, factor: 1.1177, vat: 1.07, factorF: 1.1959 },
  { cost: 250,  admin: 7.2736,  interest: 0.2916, profit: 4.0, totalPct: 11.5652, factor: 1.1156, vat: 1.07, factorF: 1.1936 },
  { cost: 300,  admin: 7.1950,  interest: 0.2333, profit: 3.5, totalPct: 10.9283, factor: 1.1092, vat: 1.07, factorF: 1.1868 },
  { cost: 350,  admin: 6.4098,  interest: 0.1750, profit: 3.5, totalPct: 10.0848, factor: 1.1008, vat: 1.07, factorF: 1.1778 },
  { cost: 400,  admin: 6.3344,  interest: 0.0583, profit: 3.5, totalPct: 9.8927,  factor: 1.0989, vat: 1.07, factorF: 1.1758 },
  { cost: 500,  admin: 6.2868,  interest: 0.0291, profit: 3.5, totalPct: 9.8159,  factor: 1.0981, vat: 1.07, factorF: 1.1749 },
  { cost: 9999, admin: 5.6676,  interest: -0.0583, profit: 3.5, totalPct: 9.1093, factor: 1.0910, vat: 1.07, factorF: 1.1673 },
];

// ─── หน้า 9: เงินล่วงหน้า 10%, ประกัน 5% ───
const T_A10_R5: FactorFBracket[] = [
  { cost: 0.5,  admin: 15.6856, interest: 1.0062, profit: 5.5, totalPct: 22.1918, factor: 1.2219, vat: 1.07, factorF: 1.3074 },
  { cost: 1,    admin: 15.4654, interest: 0.9916, profit: 5.5, totalPct: 21.9570, factor: 1.2195, vat: 1.07, factorF: 1.3048 },
  { cost: 2,    admin: 15.3220, interest: 0.9770, profit: 5.5, totalPct: 21.7990, factor: 1.2179, vat: 1.07, factorF: 1.3031 },
  { cost: 5,    admin: 15.0245, interest: 0.9041, profit: 5.5, totalPct: 21.4286, factor: 1.2142, vat: 1.07, factorF: 1.2991 },
  { cost: 10,   admin: 14.9659, interest: 0.8604, profit: 5.0, totalPct: 20.8263, factor: 1.2082, vat: 1.07, factorF: 1.2927 },
  { cost: 15,   admin: 11.7000, interest: 0.8604, profit: 5.0, totalPct: 17.5604, factor: 1.1756, vat: 1.07, factorF: 1.2578 },
  { cost: 20,   admin: 10.9884, interest: 0.8458, profit: 5.0, totalPct: 16.8342, factor: 1.1683, vat: 1.07, factorF: 1.2500 },
  { cost: 25,   admin: 8.9675,  interest: 0.8458, profit: 4.5, totalPct: 14.3133, factor: 1.1431, vat: 1.07, factorF: 1.2231 },
  { cost: 30,   admin: 8.1852,  interest: 0.8312, profit: 4.5, totalPct: 13.5164, factor: 1.1351, vat: 1.07, factorF: 1.2145 },
  { cost: 40,   admin: 8.1487,  interest: 0.8312, profit: 4.5, totalPct: 13.4799, factor: 1.1347, vat: 1.07, factorF: 1.2141 },
  { cost: 50,   admin: 8.1374,  interest: 0.8020, profit: 4.5, totalPct: 13.4394, factor: 1.1343, vat: 1.07, factorF: 1.2137 },
  { cost: 60,   admin: 7.7209,  interest: 0.8020, profit: 4.0, totalPct: 12.5229, factor: 1.1252, vat: 1.07, factorF: 1.2039 },
  { cost: 70,   admin: 7.6178,  interest: 0.7875, profit: 4.0, totalPct: 12.4053, factor: 1.1240, vat: 1.07, factorF: 1.2026 },
  { cost: 80,   admin: 7.6178,  interest: 0.7875, profit: 4.0, totalPct: 12.4053, factor: 1.1240, vat: 1.07, factorF: 1.2026 },
  { cost: 90,   admin: 7.6095,  interest: 0.7875, profit: 4.0, totalPct: 12.3970, factor: 1.1239, vat: 1.07, factorF: 1.2025 },
  { cost: 100,  admin: 7.6095,  interest: 0.7875, profit: 4.0, totalPct: 12.3970, factor: 1.1239, vat: 1.07, factorF: 1.2025 },
  { cost: 150,  admin: 7.3600,  interest: 0.7583, profit: 4.0, totalPct: 12.1183, factor: 1.1211, vat: 1.07, factorF: 1.1995 },
  { cost: 200,  admin: 7.3617,  interest: 0.7291, profit: 4.0, totalPct: 12.0908, factor: 1.1209, vat: 1.07, factorF: 1.1993 },
  { cost: 250,  admin: 7.2736,  interest: 0.6708, profit: 4.0, totalPct: 11.9444, factor: 1.1194, vat: 1.07, factorF: 1.1977 },
  { cost: 300,  admin: 7.1950,  interest: 0.6416, profit: 3.5, totalPct: 11.3366, factor: 1.1133, vat: 1.07, factorF: 1.1912 },
  { cost: 350,  admin: 6.4098,  interest: 0.6125, profit: 3.5, totalPct: 10.5223, factor: 1.1052, vat: 1.07, factorF: 1.1825 },
  { cost: 400,  admin: 6.3344,  interest: 0.5541, profit: 3.5, totalPct: 10.3885, factor: 1.1038, vat: 1.07, factorF: 1.1810 },
  { cost: 500,  admin: 6.2868,  interest: 0.5395, profit: 3.5, totalPct: 10.3263, factor: 1.1032, vat: 1.07, factorF: 1.1804 },
  { cost: 9999, admin: 5.6676,  interest: 0.4958, profit: 3.5, totalPct: 9.6634,  factor: 1.0966, vat: 1.07, factorF: 1.1733 },
];

// ─── หน้า 10: เงินล่วงหน้า 10%, ประกัน 10% ───
const T_A10_R10: FactorFBracket[] = [
  { cost: 0.5,  admin: 15.6856, interest: 1.0500, profit: 5.5, totalPct: 22.2356, factor: 1.2223, vat: 1.07, factorF: 1.3078 },
  { cost: 1,    admin: 15.4654, interest: 1.0500, profit: 5.5, totalPct: 22.0154, factor: 1.2201, vat: 1.07, factorF: 1.3055 },
  { cost: 2,    admin: 15.3220, interest: 1.0500, profit: 5.5, totalPct: 21.8720, factor: 1.2187, vat: 1.07, factorF: 1.3040 },
  { cost: 5,    admin: 15.0245, interest: 1.0500, profit: 5.5, totalPct: 21.5745, factor: 1.2157, vat: 1.07, factorF: 1.3007 },
  { cost: 10,   admin: 14.9659, interest: 1.0500, profit: 5.0, totalPct: 21.0159, factor: 1.2101, vat: 1.07, factorF: 1.2948 },
  { cost: 15,   admin: 11.7000, interest: 1.0500, profit: 5.0, totalPct: 17.7500, factor: 1.1775, vat: 1.07, factorF: 1.2599 },
  { cost: 20,   admin: 10.9884, interest: 1.0500, profit: 5.0, totalPct: 17.0384, factor: 1.1703, vat: 1.07, factorF: 1.2522 },
  { cost: 25,   admin: 8.9675,  interest: 1.0500, profit: 4.5, totalPct: 14.5175, factor: 1.1451, vat: 1.07, factorF: 1.2252 },
  { cost: 30,   admin: 8.1852,  interest: 1.0500, profit: 4.5, totalPct: 13.7352, factor: 1.1373, vat: 1.07, factorF: 1.2169 },
  { cost: 40,   admin: 8.1487,  interest: 1.0500, profit: 4.5, totalPct: 13.6987, factor: 1.1369, vat: 1.07, factorF: 1.2164 },
  { cost: 50,   admin: 8.1374,  interest: 1.0500, profit: 4.5, totalPct: 13.6874, factor: 1.1368, vat: 1.07, factorF: 1.2163 },
  { cost: 60,   admin: 7.7209,  interest: 1.0500, profit: 4.0, totalPct: 12.7709, factor: 1.1277, vat: 1.07, factorF: 1.2066 },
  { cost: 70,   admin: 7.6178,  interest: 1.0500, profit: 4.0, totalPct: 12.6678, factor: 1.1266, vat: 1.07, factorF: 1.2054 },
  { cost: 80,   admin: 7.6178,  interest: 1.0500, profit: 4.0, totalPct: 12.6678, factor: 1.1266, vat: 1.07, factorF: 1.2054 },
  { cost: 90,   admin: 7.6095,  interest: 1.0500, profit: 4.0, totalPct: 12.6595, factor: 1.1265, vat: 1.07, factorF: 1.2053 },
  { cost: 100,  admin: 7.6095,  interest: 1.0500, profit: 4.0, totalPct: 12.6595, factor: 1.1265, vat: 1.07, factorF: 1.2053 },
  { cost: 150,  admin: 7.3600,  interest: 1.0500, profit: 4.0, totalPct: 12.4100, factor: 1.1241, vat: 1.07, factorF: 1.2027 },
  { cost: 200,  admin: 7.3617,  interest: 1.0500, profit: 4.0, totalPct: 12.4117, factor: 1.1241, vat: 1.07, factorF: 1.2027 },
  { cost: 250,  admin: 7.2736,  interest: 1.0500, profit: 4.0, totalPct: 12.3236, factor: 1.1232, vat: 1.07, factorF: 1.2018 },
  { cost: 300,  admin: 7.1950,  interest: 1.0500, profit: 3.5, totalPct: 11.7450, factor: 1.1174, vat: 1.07, factorF: 1.1956 },
  { cost: 350,  admin: 6.4098,  interest: 1.0500, profit: 3.5, totalPct: 10.9598, factor: 1.1095, vat: 1.07, factorF: 1.1871 },
  { cost: 400,  admin: 6.3344,  interest: 1.0500, profit: 3.5, totalPct: 10.8844, factor: 1.1088, vat: 1.07, factorF: 1.1864 },
  { cost: 500,  admin: 6.2868,  interest: 1.0500, profit: 3.5, totalPct: 10.8368, factor: 1.1083, vat: 1.07, factorF: 1.1858 },
  { cost: 9999, admin: 5.6676,  interest: 1.0500, profit: 3.5, totalPct: 10.2176, factor: 1.1021, vat: 1.07, factorF: 1.1792 },
];

// ─── หน้า 11: เงินล่วงหน้า 15%, ประกัน 0% ───
const T_A15_R0: FactorFBracket[] = [
  { cost: 0.5,  admin: 15.6856, interest: 0.8604, profit: 5.5, totalPct: 22.0460, factor: 1.2204, vat: 1.07, factorF: 1.3058 },
  { cost: 1,    admin: 15.4654, interest: 0.8166, profit: 5.5, totalPct: 21.7820, factor: 1.2178, vat: 1.07, factorF: 1.3030 },
  { cost: 2,    admin: 15.3220, interest: 0.7729, profit: 5.5, totalPct: 21.5949, factor: 1.2159, vat: 1.07, factorF: 1.3010 },
  { cost: 5,    admin: 15.0245, interest: 0.5541, profit: 5.5, totalPct: 21.0786, factor: 1.2107, vat: 1.07, factorF: 1.2954 },
  { cost: 10,   admin: 14.9659, interest: 0.4229, profit: 5.0, totalPct: 20.3888, factor: 1.2038, vat: 1.07, factorF: 1.2880 },
  { cost: 15,   admin: 11.7000, interest: 0.4229, profit: 5.0, totalPct: 17.1229, factor: 1.1712, vat: 1.07, factorF: 1.2531 },
  { cost: 20,   admin: 10.9884, interest: 0.3791, profit: 5.0, totalPct: 16.3675, factor: 1.1636, vat: 1.07, factorF: 1.2450 },
  { cost: 25,   admin: 8.9675,  interest: 0.3791, profit: 4.5, totalPct: 13.8466, factor: 1.1384, vat: 1.07, factorF: 1.2180 },
  { cost: 30,   admin: 8.1852,  interest: 0.3354, profit: 4.5, totalPct: 13.0206, factor: 1.1302, vat: 1.07, factorF: 1.2093 },
  { cost: 40,   admin: 8.1487,  interest: 0.3354, profit: 4.5, totalPct: 12.9841, factor: 1.1298, vat: 1.07, factorF: 1.2088 },
  { cost: 50,   admin: 8.1374,  interest: 0.2479, profit: 4.5, totalPct: 12.8853, factor: 1.1288, vat: 1.07, factorF: 1.2078 },
  { cost: 60,   admin: 7.7209,  interest: 0.2479, profit: 4.0, totalPct: 11.9688, factor: 1.1196, vat: 1.07, factorF: 1.1979 },
  { cost: 70,   admin: 7.6178,  interest: 0.2041, profit: 4.0, totalPct: 11.8219, factor: 1.1182, vat: 1.07, factorF: 1.1964 },
  { cost: 80,   admin: 7.6178,  interest: 0.2041, profit: 4.0, totalPct: 11.8219, factor: 1.1182, vat: 1.07, factorF: 1.1964 },
  { cost: 90,   admin: 7.6095,  interest: 0.2041, profit: 4.0, totalPct: 11.8136, factor: 1.1181, vat: 1.07, factorF: 1.1963 },
  { cost: 100,  admin: 7.6095,  interest: 0.2041, profit: 4.0, totalPct: 11.8136, factor: 1.1181, vat: 1.07, factorF: 1.1963 },
  { cost: 150,  admin: 7.3600,  interest: 0.1166, profit: 4.0, totalPct: 11.4766, factor: 1.1147, vat: 1.07, factorF: 1.1927 },
  { cost: 200,  admin: 7.3617,  interest: 0.0291, profit: 4.0, totalPct: 11.3908, factor: 1.1139, vat: 1.07, factorF: 1.1918 },
  { cost: 250,  admin: 7.2736,  interest: -0.1458, profit: 4.0, totalPct: 11.1278, factor: 1.1112, vat: 1.07, factorF: 1.1889 },
  { cost: 300,  admin: 7.1950,  interest: -0.2333, profit: 3.5, totalPct: 10.4617, factor: 1.1046, vat: 1.07, factorF: 1.1819 },
  { cost: 350,  admin: 6.4098,  interest: -0.3208, profit: 3.5, totalPct: 9.5890,  factor: 1.0958, vat: 1.07, factorF: 1.1725 },
  { cost: 400,  admin: 6.3344,  interest: -0.4958, profit: 3.5, totalPct: 9.3386,  factor: 1.0933, vat: 1.07, factorF: 1.1698 },
  { cost: 500,  admin: 6.2868,  interest: -0.5395, profit: 3.5, totalPct: 9.2473,  factor: 1.0924, vat: 1.07, factorF: 1.1688 },
  { cost: 9999, admin: 5.6676,  interest: -0.6708, profit: 3.5, totalPct: 8.4968,  factor: 1.0849, vat: 1.07, factorF: 1.1608 },
];

// ─── หน้า 12: เงินล่วงหน้า 15%, ประกัน 5% ───
const T_A15_R5: FactorFBracket[] = [
  { cost: 0.5,  admin: 15.6856, interest: 0.9041, profit: 5.5, totalPct: 22.0897, factor: 1.2208, vat: 1.07, factorF: 1.3062 },
  { cost: 1,    admin: 15.4654, interest: 0.8750, profit: 5.5, totalPct: 21.8404, factor: 1.2184, vat: 1.07, factorF: 1.3036 },
  { cost: 2,    admin: 15.3220, interest: 0.8458, profit: 5.5, totalPct: 21.6678, factor: 1.2166, vat: 1.07, factorF: 1.3017 },
  { cost: 5,    admin: 15.0245, interest: 0.7000, profit: 5.5, totalPct: 21.2245, factor: 1.2122, vat: 1.07, factorF: 1.2970 },
  { cost: 10,   admin: 14.9659, interest: 0.6125, profit: 5.0, totalPct: 20.5784, factor: 1.2057, vat: 1.07, factorF: 1.2900 },
  { cost: 15,   admin: 11.7000, interest: 0.6125, profit: 5.0, totalPct: 17.3125, factor: 1.1731, vat: 1.07, factorF: 1.2552 },
  { cost: 20,   admin: 10.9884, interest: 0.5833, profit: 5.0, totalPct: 16.5717, factor: 1.1657, vat: 1.07, factorF: 1.2472 },
  { cost: 25,   admin: 8.9675,  interest: 0.5833, profit: 4.5, totalPct: 14.0508, factor: 1.1405, vat: 1.07, factorF: 1.2203 },
  { cost: 30,   admin: 8.1852,  interest: 0.5541, profit: 4.5, totalPct: 13.2393, factor: 1.1323, vat: 1.07, factorF: 1.2115 },
  { cost: 40,   admin: 8.1487,  interest: 0.5541, profit: 4.5, totalPct: 13.2028, factor: 1.1320, vat: 1.07, factorF: 1.2112 },
  { cost: 50,   admin: 8.1374,  interest: 0.4958, profit: 4.5, totalPct: 13.1332, factor: 1.1313, vat: 1.07, factorF: 1.2104 },
  { cost: 60,   admin: 7.7209,  interest: 0.4958, profit: 4.0, totalPct: 12.2167, factor: 1.1221, vat: 1.07, factorF: 1.2006 },
  { cost: 70,   admin: 7.6178,  interest: 0.4666, profit: 4.0, totalPct: 12.0844, factor: 1.1208, vat: 1.07, factorF: 1.1992 },
  { cost: 80,   admin: 7.6178,  interest: 0.4666, profit: 4.0, totalPct: 12.0844, factor: 1.1208, vat: 1.07, factorF: 1.1992 },
  { cost: 90,   admin: 7.6095,  interest: 0.4666, profit: 4.0, totalPct: 12.0761, factor: 1.1207, vat: 1.07, factorF: 1.1991 },
  { cost: 100,  admin: 7.6095,  interest: 0.4666, profit: 4.0, totalPct: 12.0761, factor: 1.1207, vat: 1.07, factorF: 1.1991 },
  { cost: 150,  admin: 7.3600,  interest: 0.4083, profit: 4.0, totalPct: 11.7683, factor: 1.1176, vat: 1.07, factorF: 1.1958 },
  { cost: 200,  admin: 7.3617,  interest: 0.3500, profit: 4.0, totalPct: 11.7117, factor: 1.1171, vat: 1.07, factorF: 1.1952 },
  { cost: 250,  admin: 7.2736,  interest: 0.2333, profit: 4.0, totalPct: 11.5069, factor: 1.1150, vat: 1.07, factorF: 1.1930 },
  { cost: 300,  admin: 7.1950,  interest: 0.1750, profit: 3.5, totalPct: 10.8700, factor: 1.1087, vat: 1.07, factorF: 1.1863 },
  { cost: 350,  admin: 6.4098,  interest: 0.1166, profit: 3.5, totalPct: 10.0264, factor: 1.1002, vat: 1.07, factorF: 1.1772 },
  { cost: 400,  admin: 6.3344,  interest: 0.0000, profit: 3.5, totalPct: 9.8344,  factor: 1.0983, vat: 1.07, factorF: 1.1751 },
  { cost: 500,  admin: 6.2868,  interest: -0.0291, profit: 3.5, totalPct: 9.7577, factor: 1.0975, vat: 1.07, factorF: 1.1743 },
  { cost: 9999, admin: 5.6676,  interest: -0.1166, profit: 3.5, totalPct: 9.0510, factor: 1.0905, vat: 1.07, factorF: 1.1668 },
];

// ─── หน้า 13: เงินล่วงหน้า 15%, ประกัน 10% ───
const T_A15_R10: FactorFBracket[] = [
  { cost: 0.5,  admin: 15.6856, interest: 0.9479, profit: 5.5, totalPct: 22.1335, factor: 1.2213, vat: 1.07, factorF: 1.3067 },
  { cost: 1,    admin: 15.4654, interest: 0.9333, profit: 5.5, totalPct: 21.8987, factor: 1.2189, vat: 1.07, factorF: 1.3042 },
  { cost: 2,    admin: 15.3220, interest: 0.9187, profit: 5.5, totalPct: 21.7407, factor: 1.2174, vat: 1.07, factorF: 1.3026 },
  { cost: 5,    admin: 15.0245, interest: 0.8458, profit: 5.5, totalPct: 21.3703, factor: 1.2137, vat: 1.07, factorF: 1.2986 },
  { cost: 10,   admin: 14.9659, interest: 0.8020, profit: 5.0, totalPct: 20.7679, factor: 1.2076, vat: 1.07, factorF: 1.2921 },
  { cost: 15,   admin: 11.7000, interest: 0.8020, profit: 5.0, totalPct: 17.5020, factor: 1.1750, vat: 1.07, factorF: 1.2572 },
  { cost: 20,   admin: 10.9884, interest: 0.7875, profit: 5.0, totalPct: 16.7759, factor: 1.1677, vat: 1.07, factorF: 1.2494 },
  { cost: 25,   admin: 8.9675,  interest: 0.7875, profit: 4.5, totalPct: 14.2550, factor: 1.1425, vat: 1.07, factorF: 1.2224 },
  { cost: 30,   admin: 8.1852,  interest: 0.7729, profit: 4.5, totalPct: 13.4581, factor: 1.1345, vat: 1.07, factorF: 1.2139 },
  { cost: 40,   admin: 8.1487,  interest: 0.7729, profit: 4.5, totalPct: 13.4216, factor: 1.1342, vat: 1.07, factorF: 1.2135 },
  { cost: 50,   admin: 8.1374,  interest: 0.7437, profit: 4.5, totalPct: 13.3811, factor: 1.1338, vat: 1.07, factorF: 1.2131 },
  { cost: 60,   admin: 7.7209,  interest: 0.7437, profit: 4.0, totalPct: 12.4646, factor: 1.1246, vat: 1.07, factorF: 1.2033 },
  { cost: 70,   admin: 7.6178,  interest: 0.7291, profit: 4.0, totalPct: 12.3469, factor: 1.1234, vat: 1.07, factorF: 1.2020 },
  { cost: 80,   admin: 7.6178,  interest: 0.7291, profit: 4.0, totalPct: 12.3469, factor: 1.1234, vat: 1.07, factorF: 1.2020 },
  { cost: 90,   admin: 7.6095,  interest: 0.7291, profit: 4.0, totalPct: 12.3386, factor: 1.1233, vat: 1.07, factorF: 1.2019 },
  { cost: 100,  admin: 7.6095,  interest: 0.7291, profit: 4.0, totalPct: 12.3386, factor: 1.1233, vat: 1.07, factorF: 1.2019 },
  { cost: 150,  admin: 7.3600,  interest: 0.7000, profit: 4.0, totalPct: 12.0600, factor: 1.1206, vat: 1.07, factorF: 1.1990 },
  { cost: 200,  admin: 7.3617,  interest: 0.6708, profit: 4.0, totalPct: 12.0325, factor: 1.1203, vat: 1.07, factorF: 1.1987 },
  { cost: 250,  admin: 7.2736,  interest: 0.6125, profit: 4.0, totalPct: 11.8861, factor: 1.1188, vat: 1.07, factorF: 1.1971 },
  { cost: 300,  admin: 7.1950,  interest: 0.5833, profit: 3.5, totalPct: 11.2783, factor: 1.1127, vat: 1.07, factorF: 1.1905 },
  { cost: 350,  admin: 6.4098,  interest: 0.5541, profit: 3.5, totalPct: 10.4639, factor: 1.1046, vat: 1.07, factorF: 1.1819 },
  { cost: 400,  admin: 6.3344,  interest: 0.4958, profit: 3.5, totalPct: 10.3302, factor: 1.1033, vat: 1.07, factorF: 1.1805 },
  { cost: 500,  admin: 6.2868,  interest: 0.4812, profit: 3.5, totalPct: 10.2680, factor: 1.1026, vat: 1.07, factorF: 1.1797 },
  { cost: 9999, admin: 5.6676,  interest: 0.4375, profit: 3.5, totalPct: 9.6051,  factor: 1.0960, vat: 1.07, factorF: 1.1727 },
];

// ─── Export: รวมทุกตาราง ───
export const FACTOR_F_TABLES: FactorFTable[] = [
  { advance: 0,  retention: 0,  loanRate: 7, vatRate: 7, brackets: T_A0_R0 },
  { advance: 0,  retention: 5,  loanRate: 7, vatRate: 7, brackets: T_A0_R5 },
  { advance: 0,  retention: 10, loanRate: 7, vatRate: 7, brackets: T_A0_R10 },
  { advance: 5,  retention: 0,  loanRate: 7, vatRate: 7, brackets: T_A5_R0 },
  { advance: 5,  retention: 5,  loanRate: 7, vatRate: 7, brackets: T_A5_R5 },
  { advance: 5,  retention: 10, loanRate: 7, vatRate: 7, brackets: T_A5_R10 },
  { advance: 10, retention: 0,  loanRate: 7, vatRate: 7, brackets: T_A10_R0 },
  { advance: 10, retention: 5,  loanRate: 7, vatRate: 7, brackets: T_A10_R5 },
  { advance: 10, retention: 10, loanRate: 7, vatRate: 7, brackets: T_A10_R10 },
  { advance: 15, retention: 0,  loanRate: 7, vatRate: 7, brackets: T_A15_R0 },
  { advance: 15, retention: 5,  loanRate: 7, vatRate: 7, brackets: T_A15_R5 },
  { advance: 15, retention: 10, loanRate: 7, vatRate: 7, brackets: T_A15_R10 },
];

/**
 * Lookup Factor F ด้วย interpolation
 * @param costMillions - ค่างาน (ล้านบาท)
 * @param advance - เงินล่วงหน้า % (0/5/10/15)
 * @param retention - เงินประกัน % (0/5/10)
 * @returns Factor F (หรือ null ถ้าไม่เจอตาราง)
 */
export function lookupFactorF(
  costMillions: number,
  advance: number = 0,
  retention: number = 0
): number | null {
  const table = FACTOR_F_TABLES.find(
    (t) => t.advance === advance && t.retention === retention
  );
  if (!table) return null;

  const brackets = table.brackets;

  // exact match
  const exact = brackets.find((b) => b.cost === costMillions || (costMillions <= 0.5 && b.cost === 0.5));
  if (exact) return exact.factorF;

  // >500
  if (costMillions > 500) return brackets[brackets.length - 1].factorF;

  // interpolation
  for (let i = 0; i < brackets.length - 1; i++) {
    const lo = brackets[i];
    const hi = brackets[i + 1];
    if (costMillions >= lo.cost && costMillions < hi.cost) {
      const ratio = (costMillions - lo.cost) / (hi.cost - lo.cost);
      return lo.factorF + ratio * (hi.factorF - lo.factorF);
    }
  }

  return brackets[0].factorF;
}

export interface FactorFRange {
  rangeLowM: number;   // ค่างานตัวต่ำ (ล้านบาท)
  rangeHighM: number;  // ค่างานตัวสูง (ล้านบาท)
  fLow: number;
  fHigh: number;
}

/**
 * หา bracket ที่ lookupFactorF ใช้ interpolate (2 breakpoint + factorF)
 * → ฝั่ง export ป้อนเข้า master ให้ interpolate เองตรงกัน (advance/retention ต้อง snap มาแล้ว)
 */
export function factorFBracket(
  costMillions: number,
  advance: number = 0,
  retention: number = 0,
): FactorFRange | null {
  const table = FACTOR_F_TABLES.find(
    (t) => t.advance === advance && t.retention === retention,
  );
  if (!table) return null;
  const b = table.brackets;
  // ≤0.5 → คงที่ (F เท่ากัน, ช่วงคนละค่า กัน DIV/0 ใน master)
  if (costMillions <= b[0].cost) {
    return { rangeLowM: b[0].cost, rangeHighM: b[1].cost, fLow: b[0].factorF, fHigh: b[0].factorF };
  }
  // >500 → คงที่ของ bracket สุดท้าย
  if (costMillions > 500) {
    const lo = b[b.length - 2], hi = b[b.length - 1];
    return { rangeLowM: lo.cost, rangeHighM: hi.cost, fLow: hi.factorF, fHigh: hi.factorF };
  }
  // bracket ขนาบ (เงื่อนไขเดียวกับ lookupFactorF)
  for (let i = 0; i < b.length - 1; i++) {
    const lo = b[i], hi = b[i + 1];
    if (costMillions >= lo.cost && costMillions < hi.cost) {
      return { rangeLowM: lo.cost, rangeHighM: hi.cost, fLow: lo.factorF, fHigh: hi.factorF };
    }
  }
  return { rangeLowM: b[0].cost, rangeHighM: b[1].cost, fLow: b[0].factorF, fHigh: b[0].factorF };
}
