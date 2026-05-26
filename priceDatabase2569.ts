/**
 * ฐานราคาวัสดุและค่าแรงงาน ปี 2569
 * แหล่งข้อมูล:
 *   1. บัญชีราคาค่าวัสดุและค่าแรงงาน ปี 2569 กลุ่มออกแบบและก่อสร้าง สพฐ.
 *   2. สำนักงานพาณิชย์จังหวัดสกลนคร (สนค.) เมษายน 2569
 *   3. กรมบัญชีกลาง ว.809
 * 
 * หมายเหตุ: ราคาเงินสด ไม่รวม VAT ไม่รวมค่าขนส่ง (ยกเว้นระบุ)
 * ผู้ใช้ควรตรวจสอบราคาจากพาณิชย์จังหวัด (ท้องถิ่น) อีกครั้ง
 */

// ============================================================
// SECTION A: งานโครงสร้างวิศวกรรม
// ============================================================

export const PRICE_DB_2569 = {
  source: "สพฐ.+สนค.สกลนคร ปี2569",
  lastUpdate: "2569-04",
  
  // ─── A1: งานขุดดิน ───
  earthwork: {
    // ขุดดินฐานรากแล้วถมคืน
    excavation_backfill: {
      over100cbm_depth_lte1m: { unit: "ลบ.ม.", labor: 112 },
      qty25_100_depth1_1_5m: { unit: "ลบ.ม.", labor: 142 },
      under25cbm_depth_gt1_5m: { unit: "ลบ.ม.", labor: 168 },
    },
    // ดินลูกรัง
    laterite_excavation: {
      over100cbm: { unit: "ลบ.ม.", labor: 220 },
      qty25_100: { unit: "ลบ.ม.", labor: 271 },
      under25cbm: { unit: "ลบ.ม.", labor: 320 },
    },
    general_excavation: { unit: "ลบ.ม.", labor: 60 },
    machine_excavation: { unit: "ลบ.ม.", labor: 18 },
    // วัสดุรองฐานราก
    sand_base: { unit: "ลบ.ม.", material: 510, labor: 104 },
    brick_rubble_base: { unit: "ลบ.ม.", material: 150, labor: 117 },
    // คอนกรีตหยาบ
    lean_concrete_135_type1: { unit: "ลบ.ม.", material: 1610, labor: 426 },
    lean_concrete_135_type5: { unit: "ลบ.ม.", material: 1650, labor: 426 },
    // วัสดุถม
    sand_fill: { unit: "ลบ.ม.", material: 410, labor: 99 },
    soil_fill: { unit: "ลบ.ม.", material: 413, labor: 99 },
    laterite_fill: { unit: "ลบ.ม.", material: 393, labor: 99 },
    crushed_rock_fill: { unit: "ลบ.ม.", material: 498, labor: 99 },
    // อัดแน่น
    normal_compaction: { unit: "ลบ.ม.", labor: 25 },
    compaction_85pct: { unit: "ลบ.ม.", labor: 35, note: "ลูกรัง 46 บาท/ลบ.ม." },
    // ราคาวัสดุ
    coarse_sand: { unit: "ลบ.ม.", material: 510 },
    fine_sand: { unit: "ลบ.ม.", material: 498 },
    crushed_stone_no1: { unit: "ลบ.ม.", material: 620 },
    crushed_stone_no2: { unit: "ลบ.ม.", material: 593 },
  },

  // ─── A4: คอนกรีตโครงสร้าง ───
  concrete: {
    // คอนกรีตผสมในที่ 1:2:4
    mix124_ground: { unit: "ลบ.ม.", material: 1845, labor: 466 },
    mix124_1story: { unit: "ลบ.ม.", material: 1845, labor: 532 },
    mix124_2story_up: { unit: "ลบ.ม.", material: 1845, labor: 579 },
    // คอนกรีตผสมเสร็จ (Cylinder/Cube)
    readymix_180_140: { unit: "ลบ.ม.", material: 2449, note: "ติดดิน ค่าแรง327, ชั้นเดียว419, หลายชั้น512" },
    readymix_210_180: { unit: "ลบ.ม.", material: 2434 },
    readymix_240_210: { unit: "ลบ.ม.", material: 2470 },
    readymix_280_240: { unit: "ลบ.ม.", material: 2507 },
    readymix_320_280: { unit: "ลบ.ม.", material: 2460 },
    readymix_lean_135: { unit: "ลบ.ม.", material: 2193 },
    // คอนกรีตผสมเสร็จทนซัลเฟต
    readymix_sulfate_240: { unit: "ลบ.ม.", material: 2570 },
    readymix_sulfate_280: { unit: "ลบ.ม.", material: 2610 },
    readymix_sulfate_320: { unit: "ลบ.ม.", material: 2680 },
    readymix_sulfate_350: { unit: "ลบ.ม.", material: 2730 },
    // ปูนซีเมนต์
    portland_type1: { unit: "ตัน", material: 2694 },
    portland_type5: { unit: "ตัน", material: 2797 },
    portland_mixed: { unit: "ตัน", material: 2667 },
    portland_hydraulic: { unit: "ตัน", material: 2832 },
    portland_bag_type1: { unit: "ถุง 50กก.", material: 134 },
    portland_bag_mixed: { unit: "ถุง 50กก.", material: 133 },
    portland_bag_plaster: { unit: "ถุง 50กก.", material: 152 },
    portland_bag_white: { unit: "ถุง 40กก.", material: 400 },
    // กันซึม
    waterproof_sheet: { unit: "หลา", material: 7 },
    waterproof_liquid: { unit: "ลิตร", material: 43, note: "1 ลบ.ม. ใช้ 5.24 ลิตร" },
  },

  // ─── A5: เหล็กเสริมคอนกรีต ───
  rebar: {
    // SR.24 (ราคาต่อตัน) — สพฐ.
    SR24_RB6_per_ton: { unit: "ตัน", material: 21850, labor: 4400 },
    SR24_RB9_per_ton: { unit: "ตัน", material: 21050, labor: 4400 },
    SR24_RB12_per_ton: { unit: "ตัน", material: 20610, labor: 3600 },
    SR24_RB15_per_ton: { unit: "ตัน", material: 20500, labor: 3600 },
    SR24_RB19_per_ton: { unit: "ตัน", material: 20600, labor: 3100 },
    SR24_RB25_per_ton: { unit: "ตัน", material: 20600, labor: 3100 },
    // SD.40 (ราคาต่อตัน) — สพฐ.
    SD40_DB12_per_ton: { unit: "ตัน", material: 21150, labor: 3600 },
    SD40_DB16_per_ton: { unit: "ตัน", material: 20950, labor: 3600 },
    SD40_DB20_per_ton: { unit: "ตัน", material: 20950, labor: 3100 },
    SD40_DB25_per_ton: { unit: "ตัน", material: 20950, labor: 3100 },
    SD40_DB28_per_ton: { unit: "ตัน", material: 21050, labor: 3100 },
    // SD.50 (ราคาต่อตัน)
    SD50_DB12_per_ton: { unit: "ตัน", material: 20900, labor: 3600 },
    SD50_DB16_per_ton: { unit: "ตัน", material: 20700, labor: 3600 },
    SD50_DB20_per_ton: { unit: "ตัน", material: 20700, labor: 3100 },
    // สนค. สกลนคร (เม.ย.69) ราคาต่อตัน
    SNK_SR24_RB6: { unit: "ตัน", material: 24420, source: "สนค.สกลนคร" },
    SNK_SR24_RB9: { unit: "ตัน", material: 22912, source: "สนค.สกลนคร" },
    SNK_SR24_RB12: { unit: "ตัน", material: 24414, source: "สนค.สกลนคร" },
    SNK_SR24_RB15: { unit: "ตัน", material: 22609, source: "สนค.สกลนคร" },
    SNK_SR24_RB19: { unit: "ตัน", material: 22963, source: "สนค.สกลนคร" },
    SNK_SR24_RB25: { unit: "ตัน", material: 24785, source: "สนค.สกลนคร" },
    SNK_SD40_DB12: { unit: "ตัน", material: 22450, source: "สนค.สกลนคร" },
    SNK_SD40_DB16: { unit: "ตัน", material: 22536, source: "สนค.สกลนคร" },
    SNK_SD40_DB20: { unit: "ตัน", material: 21603, source: "สนค.สกลนคร" },
    SNK_SD40_DB25: { unit: "ตัน", material: 24275, source: "สนค.สกลนคร" },
    // ลวดผูกเหล็ก
    tie_wire: { unit: "กก.", material: 58, note: "ใช้ 30 กก./ตัน" },
    SNK_tie_wire: { unit: "กก.", material: 28.08, source: "สนค.สกลนคร" },
    // Wire Mesh
    wiremesh_4mm_25x25: { unit: "ตร.ม.", material: 26, labor: 5 },
    wiremesh_4mm_20x20: { unit: "ตร.ม.", material: 32, labor: 5 },
    wiremesh_4mm_15x15: { unit: "ตร.ม.", material: 42.5, labor: 5 },
    wiremesh_6mm_20x20: { unit: "ตร.ม.", material: 55.5, labor: 5 },
    wiremesh_6mm_15x15: { unit: "ตร.ม.", material: 66, labor: 5 },
    wiremesh_9mm_20x20: { unit: "ตร.ม.", material: 70, labor: 5 },
  },

  // ─── A3: งานแบบหล่อ ───
  formwork: {
    timber_1story_80pct: { unit: "ลบ.ฟ.", material: 400 },
    timber_2story_70pct: { unit: "ลบ.ฟ.", material: 400 },
    timber_3story_60pct: { unit: "ลบ.ฟ.", material: 400 },
    timber_4story_50pct: { unit: "ลบ.ฟ.", material: 400 },
    // ค่าแรงไม้แบบ
    labor_general_over5000sqm: { unit: "ตร.ม.", labor: 121 },
    labor_general_under5000sqm: { unit: "ตร.ม.", labor: 139 },
    labor_exposed_smooth: { unit: "ตร.ม.", labor: 162 },
    labor_exposed_pattern: { unit: "ตร.ม.", labor: 204 },
  },

  // ============================================================
  // SECTION B: งานสถาปัตยกรรม
  // ============================================================

  // ─── B1: งานมุงหลังคา ───
  roofing: {
    // กระเบื้องลอนคู่
    double_curve_50x120_cement: { unit: "แผ่น", material: 58 },
    double_curve_50x120_color: { unit: "แผ่น", material: 64 },
    double_curve_50x150_cement: { unit: "แผ่น", material: 80 },
    double_curve_50x150_color: { unit: "แผ่น", material: 87 },
    // กระเบื้องคอนกรีต (สนค.)
    SNK_concrete_tile: { unit: "แผ่น", material: 15.89, source: "สนค.สกลนคร" },
    // หลังคาเหล็กเคลือบสี
    metal_sheet_galv_color_037: { unit: "ตร.ม.", material: 350, labor: 70, note: "หลังคาจั่ว" },
    metal_sheet_galv_color_047: { unit: "ตร.ม.", material: 430, labor: 70 },
    metal_sheet_aluzinc_040: { unit: "ตร.ม.", material: 270, labor: 70 },
    metal_sheet_aluzinc_047: { unit: "ตร.ม.", material: 320, labor: 70 },
    metal_sheet_aluzinc_050: { unit: "ตร.ม.", material: 490, labor: 80 },
    // ฉนวนกันร้อน
    insulation_PE_5mm: { unit: "ตร.ม.", material: 250, labor: 25 },
    insulation_PU_25mm: { unit: "ตร.ม.", material: 200, labor: 25 },
    insulation_PU_50mm: { unit: "ตร.ม.", material: 355, labor: 25 },
    // ค่าแรงติดตั้งกระเบื้อง
    install_double_curve_gable: { unit: "ตร.ม.", labor: 45 },
    install_double_curve_hip: { unit: "ตร.ม.", labor: 50 },
    install_concrete_tile: { unit: "ตร.ม.", labor: 74 },
    // แปหลังคา
    purlin_055mm: { unit: "ท่อน 4ม.", material: 130, labor: 25 },
    purlin_070mm: { unit: "ท่อน 4ม.", material: 148, labor: 25 },
  },

  // ─── B2: ฝ้าเพดาน ───
  ceiling: {
    // ยิปซัมบอร์ด โครงคร่าวเหล็ก
    gypsum_9mm_steel_frame: { unit: "ตร.ม.", material: 258, labor: 75 },
    gypsum_12mm_steel_frame: { unit: "ตร.ม.", material: 275, labor: 75 },
    gypsum_9mm_foil_steel: { unit: "ตร.ม.", material: 301, labor: 75 },
    gypsum_12mm_moisture_steel: { unit: "ตร.ม.", material: 328, labor: 75 },
    gypsum_12mm_fire_steel: { unit: "ตร.ม.", material: 360, labor: 75 },
    // ซีเมนต์เส้นใย โครงเหล็ก
    fiber_4mm_steel_frame: { unit: "ตร.ม.", material: 220, labor: 75 },
    fiber_6mm_steel_frame: { unit: "ตร.ม.", material: 255, labor: 75 },
    // T-Bar
    gypsum_9mm_tbar: { unit: "ตร.ม.", material: 326, labor: 52 },
    // ฉาบปูนใต้พื้น
    plaster_ceiling: { unit: "ตร.ม.", material: 100, labor: 87 },
  },

  // ─── B3: งานพื้น ───
  flooring: {
    // ขัดมัน
    polished_floor: { unit: "ตร.ม.", material: 172, labor: 82 },
    mortar_leveling_rough: { unit: "ตร.ม.", material: 114, labor: 64 },
    mortar_leveling_polish: { unit: "ตร.ม.", material: 119, labor: 87 },
    // กระเบื้องเคลือบ (เซรามิก)
    ceramic_4x4: { unit: "ตร.ม.", material: 473, labor: 193, note: "รวมปูนทราย" },
    ceramic_8x8: { unit: "ตร.ม.", material: 442, labor: 158 },
    ceramic_12x12: { unit: "ตร.ม.", material: 347, labor: 158 },
    ceramic_16x16: { unit: "ตร.ม.", material: 375, labor: 158 },
    // Porcelain
    porcelain_12x12: { unit: "ตร.ม.", material: 421, labor: 184 },
    porcelain_12x24: { unit: "ตร.ม.", material: 457, labor: 217 },
    porcelain_16x16: { unit: "ตร.ม.", material: 451, labor: 184 },
    porcelain_24x24: { unit: "ตร.ม.", material: 567, labor: 217 },
    // หินอ่อน-แกรนิต
    marble_30x60: { unit: "ตร.ม.", material: 1168, labor: 207 },
    granite_gray_30x60: { unit: "ตร.ม.", material: 1988, labor: 207 },
    granite_black_30x60: { unit: "ตร.ม.", material: 2388, labor: 207 },
    // คอนกรีตบล็อกปูพื้น
    paving_block_6cm_cement: { unit: "ตร.ม.", material: 450, labor: 55 },
    paving_block_6cm_color: { unit: "ตร.ม.", material: 529, labor: 55 },
    paving_block_10cm_cement: { unit: "ตร.ม.", material: 885, labor: 55 },
    // หินขัด ทรายล้าง
    terrazzo_1cm: { unit: "ตร.ม.", material: 475, labor: 161 },
    exposed_aggregate: { unit: "ตร.ม.", material: 439, labor: 104 },
    washed_stone: { unit: "ตร.ม.", material: 447, labor: 104 },
  },

  // ─── B4: งานผนัง ───
  wall: {
    // ก่ออิฐมอญ
    brick_half: { unit: "ตร.ม.", material: 333, labor: 94, note: "รั้ว-กำแพง ค่าแรง78" },
    brick_full: { unit: "ตร.ม.", material: 682, labor: 176, note: "รั้ว-กำแพง ค่าแรง130" },
    // คอนกรีตบล็อก
    cmu_7cm: { unit: "ตร.ม.", material: 139, labor: 84 },
    cmu_9cm: { unit: "ตร.ม.", material: 152, labor: 91 },
    cmu_19cm: { unit: "ตร.ม.", material: 217, labor: 103 },
    // คอนกรีตมวลเบา (AAC)
    aac_75mm_G4: { unit: "ตร.ม.", material: 320, labor: 56 },
    aac_100mm_G4: { unit: "ตร.ม.", material: 421, labor: 60 },
    aac_125mm_G4: { unit: "ตร.ม.", material: 645, labor: 63 },
    aac_200mm_G4: { unit: "ตร.ม.", material: 945, labor: 78 },
    // ผนังบุกระเบื้อง (ไม่รวมฉาบ)
    wall_tile_4x4: { unit: "ตร.ม.", material: 419, labor: 201 },
    wall_tile_8x8: { unit: "ตร.ม.", material: 461, labor: 166 },
    wall_tile_12x12: { unit: "ตร.ม.", material: 489, labor: 181 },
    // ผนังยิปซัมบอร์ด โครงเหล็ก 2 ด้าน
    gypsum_9mm_steel_2side: { unit: "ตร.ม.", material: 626, labor: 130 },
    gypsum_12mm_steel_2side: { unit: "ตร.ม.", material: 680, labor: 130 },
  },

  // ─── B6: ฉาบปูน ───
  plastering: {
    interior_brick: { unit: "ตร.ม.", material: 84, labor: 87, note: "ภายนอก95" },
    interior_with_lines: { unit: "ตร.ม.", material: 84, labor: 118 },
    aac_interior_exterior: { unit: "ตร.ม.", material: 120, labor: 80 },
    rcc_interior: { unit: "ตร.ม.", material: 80, labor: 105, note: "ภายนอก115" },
    // เสาเอ็น-คานทับหลัง
    lintel_half: { unit: "เมตร", material: 105, labor: 44 },
    lintel_full: { unit: "เมตร", material: 123, labor: 62 },
  },

  // ─── B9: สุขภัณฑ์ ───
  sanitary: {
    squat_toilet_flush_tank: { unit: "ที่", material: 3200, labor: 450 },
    squat_toilet_flush_valve: { unit: "ที่", material: 5000, labor: 450 },
    sit_toilet_2piece: { unit: "ที่", material: 4850, labor: 450 },
    sit_toilet_flush_valve: { unit: "ที่", material: 6500, labor: 450 },
    urinal_push_faucet: { unit: "ที่", material: 2100, labor: 450 },
    urinal_flush_valve: { unit: "ที่", material: 5500, labor: 450 },
    wash_basin_wall: { unit: "ชุด", material: 2300, labor: 450 },
    wash_basin_counter: { unit: "ชุด", material: 3500, labor: 450 },
    wash_basin_vessel: { unit: "ชุด", material: 5100, labor: 450 },
    // ผนังกั้นห้องน้ำ HPL
    toilet_partition_HPL: { unit: "ชุด", material: 11000, note: "รวมค่าแรง, ผนัง+ประตู+เสาข้าง" },
  },

  // ─── B10: งานทาสี ───
  painting: {
    // สีน้ำอะครีลิค ปูนใหม่
    acrylic_exterior_new: { unit: "ตร.ม.", material: 43, labor: 31, note: ">5000ตร.ม. ค่าแรง34" },
    acrylic_interior_new: { unit: "ตร.ม.", material: 37, labor: 28, note: ">5000ตร.ม. ค่าแรง30" },
    // สีน้ำมันเหล็ก
    alkyd_enamel_metal: { unit: "ตร.ม.", material: 62, labor: 30, note: ">5000ตร.ม. ค่าแรง35" },
    polyurethane_metal: { unit: "ตร.ม.", material: 228, labor: 30 },
    // สีย้อมไม้
    wood_stain: { unit: "ตร.ม.", material: 145, labor: 35 },
    oil_paint_wood: { unit: "ตร.ม.", material: 92, labor: 35 },
    // วัสดุสี
    acrylic_ext_gallon: { unit: "แกลลอน 3.785ล.", material: 348 },
    acrylic_int_gallon: { unit: "แกลลอน 3.785ล.", material: 274 },
    primer_new_gallon: { unit: "แกลลอน 3.785ล.", material: 294 },
    primer_old_gallon: { unit: "แกลลอน 3.785ล.", material: 391 },
    enamel_gallon: { unit: "แกลลอน 3.785ล.", material: 650 },
  },

  // ============================================================
  // SECTION C: งานระบบสุขาภิบาล
  // ============================================================
  plumbing: {
    // ท่อเหล็กเคลือบสังกะสี (6 ม.)
    gi_pipe_half: { unit: "ท่อน 6ม.", material: 270 },
    gi_pipe_3_4: { unit: "ท่อน 6ม.", material: 347 },
    gi_pipe_1: { unit: "ท่อน 6ม.", material: 516 },
    gi_pipe_1_5: { unit: "ท่อน 6ม.", material: 764 },
    gi_pipe_2: { unit: "ท่อน 6ม.", material: 1075 },
    gi_pipe_3: { unit: "ท่อน 6ม.", material: 1723 },
    gi_pipe_4: { unit: "ท่อน 6ม.", material: 2510 },
    // สนค. ท่อเหล็กเคลือบสังกะสี (ไม่รวมข้อต่อ)
    SNK_gi_pipe_half: { unit: "ท่อน 6ม.", material: 195.80, source: "สนค.สกลนคร" },
    SNK_gi_pipe_3_4: { unit: "ท่อน 6ม.", material: 234.58, source: "สนค.สกลนคร" },
    SNK_gi_pipe_1: { unit: "ท่อน 6ม.", material: 317.76, source: "สนค.สกลนคร" },
    SNK_gi_pipe_1_25: { unit: "ท่อน 6ม.", material: 409.35, source: "สนค.สกลนคร" },
    SNK_gi_pipe_1_5: { unit: "ท่อน 6ม.", material: 490.19, source: "สนค.สกลนคร" },
    SNK_gi_pipe_2: { unit: "ท่อน 6ม.", material: 608.88, source: "สนค.สกลนคร" },
    SNK_gi_pipe_2_5: { unit: "ท่อน 6ม.", material: 873.83, source: "สนค.สกลนคร" },
    // ท่อ PVC ชั้น 13.5 (4 ม.)
    pvc_13_5_half: { unit: "ท่อน 4ม.", material: 45 },
    pvc_13_5_3_4: { unit: "ท่อน 4ม.", material: 54 },
    pvc_13_5_1: { unit: "ท่อน 4ม.", material: 85 },
    pvc_13_5_1_5: { unit: "ท่อน 4ม.", material: 143 },
    pvc_13_5_2: { unit: "ท่อน 4ม.", material: 219 },
    pvc_13_5_3: { unit: "ท่อน 4ม.", material: 505 },
    pvc_13_5_4: { unit: "ท่อน 4ม.", material: 814 },
    pvc_13_5_6: { unit: "ท่อน 4ม.", material: 1725 },
    // ท่อ PVC ชั้น 8.5 (4 ม.)
    pvc_8_5_2: { unit: "ท่อน 4ม.", material: 152 },
    pvc_8_5_3: { unit: "ท่อน 4ม.", material: 333 },
    pvc_8_5_4: { unit: "ท่อน 4ม.", material: 534 },
    pvc_8_5_6: { unit: "ท่อน 4ม.", material: 1143 },
    // ค่าแรงเดินท่อ (ต่อจุด เฉลี่ย)
    drainage_per_point_toilet: { unit: "จุด", material: 1500, note: "รวมค่าแรง" },
    drainage_per_point_basin: { unit: "จุด", material: 900, note: "รวมค่าแรง" },
    water_supply_per_point: { unit: "จุด", material: 600, note: "รวมค่าแรง" },
    // ถังบำบัด
    septic_aeration_1000L: { unit: "ชุด", material: 17000, labor: 2550 },
    septic_aeration_2000L: { unit: "ชุด", material: 25500, labor: 3825 },
    septic_aeration_3000L: { unit: "ชุด", material: 29500, labor: 4425 },
    septic_no_air_1600L: { unit: "ชุด", material: 5739, labor: 1800 },
    septic_no_air_2000L: { unit: "ชุด", material: 8332, labor: 2400 },
    // ถังเก็บน้ำ
    fiberglass_tank_1000L: { unit: "ถัง", material: 3675, labor: 800 },
    fiberglass_tank_2000L: { unit: "ถัง", material: 6975, labor: 800 },
    stainless_tank_1000L: { unit: "ถัง", material: 9900, labor: 800 },
    stainless_tank_2000L: { unit: "ถัง", material: 16700, labor: 800 },
    // ปั๊มน้ำ
    auto_pump_150W: { unit: "เครื่อง", material: 5480, labor: 600 },
    auto_pump_250W: { unit: "เครื่อง", material: 7280, labor: 600 },
    auto_pump_400W: { unit: "เครื่อง", material: 13990, labor: 600 },
  },

  // ============================================================
  // SECTION D: งานไฟฟ้า
  // ============================================================
  electrical: {
    // ดวงโคม LED ติดลอย
    led_panel_1x9W_20x60: { unit: "ชุด", material: 748, labor: 135 },
    led_panel_2x9W_30x60: { unit: "ชุด", material: 996, labor: 135 },
    led_panel_2x18W_30x120: { unit: "ชุด", material: 1186, labor: 150 },
    led_panel_4x18W_60x120: { unit: "ชุด", material: 2362, labor: 250 },
    // โคมอื่นๆ
    led_panel_light_18W_30x60: { unit: "ชุด", material: 828, labor: 135 },
    led_panel_light_36W_30x120: { unit: "ชุด", material: 1066, labor: 135 },
    downlight_4in_9W: { unit: "ชุด", material: 110, labor: 115 },
    downlight_6in_17W: { unit: "ชุด", material: 154, labor: 115 },
    downlight_8in_24W: { unit: "ชุด", material: 240, labor: 115 },
    street_light_LED_30W: { unit: "ชุด", material: 1190, labor: 180 },
    street_light_LED_50W: { unit: "ชุด", material: 1390, labor: 180 },
    floodlight_LED_100W: { unit: "ชุด", material: 750, labor: 300 },
    // สวิตช์ ปลั๊ก
    switch_1gang: { unit: "ชุด", material: 95, labor: 80 },
    switch_2gang: { unit: "ชุด", material: 125, labor: 80 },
    switch_3gang: { unit: "ชุด", material: 155, labor: 80 },
    outlet_1_grounded: { unit: "ชุด", material: 107, labor: 90 },
    outlet_2_grounded: { unit: "ชุด", material: 170, labor: 90 },
    outlet_2_grounded_safety: { unit: "ชุด", material: 245, labor: 90 },
    // ตู้ควบคุม
    consumer_unit_6ch: { unit: "ชุด", material: 2180, labor: 900 },
    consumer_unit_10ch: { unit: "ชุด", material: 3390, labor: 900 },
    consumer_unit_14ch: { unit: "ชุด", material: 3899, labor: 900 },
    load_center_100A_12ch: { unit: "ชุด", material: 8560, labor: 1200 },
    load_center_100A_24ch: { unit: "ชุด", material: 9877, labor: 1200 },
    // ค่าเดินสายต่อจุด (อาคาร ≤40 ม.)
    wiring_per_lamp_point: { unit: "จุด", material: 159, labor: 143 },
    wiring_per_switch_point: { unit: "จุด", material: 155, labor: 139 },
    wiring_per_outlet_point: { unit: "จุด", material: 232, labor: 193 },
    // สายไฟ
    VAF_2x1_5: { unit: "เมตร", material: 13.30, labor: 12 },
    VAF_2x2_5: { unit: "เมตร", material: 20.23, labor: 14 },
    VAF_GRD_2x2_5_1_5: { unit: "เมตร", material: 42.00, labor: 16 },
    THW_1x2_5: { unit: "เมตร", material: 9.23, labor: 7 },
    THW_1x4: { unit: "เมตร", material: 13.93, labor: 10 },
    THW_1x10: { unit: "เมตร", material: 39.93, labor: 16 },
    THW_1x16: { unit: "เมตร", material: 61.96, labor: 20 },
    THW_1x25: { unit: "เมตร", material: 97.20, labor: 25 },
    THW_1x35: { unit: "เมตร", material: 129.03, labor: 30 },
    // สายล่อฟ้า
    lightning_rod_3prong: { unit: "ชุด", material: 12000, labor: 1800 },
  },

  // ============================================================
  // SECTION E: เครื่องปรับอากาศ (ไม่รวม VAT)
  // ============================================================
  aircon: {
    // ชนิดติดผนัง
    wall_12000BTU: { unit: "เครื่อง", material: 15701, note: "รวมค่าติดตั้ง" },
    wall_18000BTU: { unit: "เครื่อง", material: 20093, note: "รวมค่าติดตั้ง" },
    wall_24000BTU: { unit: "เครื่อง", material: 22336, note: "รวมค่าติดตั้ง" },
    // ชนิดแขวน
    ceiling_18000BTU: { unit: "เครื่อง", material: 26729, note: "รวมค่าติดตั้ง" },
    ceiling_24000BTU: { unit: "เครื่อง", material: 30093, note: "รวมค่าติดตั้ง" },
    ceiling_36000BTU: { unit: "เครื่อง", material: 42523, note: "รวมค่าติดตั้ง" },
    ceiling_48000BTU: { unit: "เครื่อง", material: 50000, note: "รวมค่าติดตั้ง" },
    // Inverter ติดผนัง
    inverter_wall_12000BTU: { unit: "เครื่อง", material: 18224, note: "รวมค่าติดตั้ง" },
    inverter_wall_18000BTU: { unit: "เครื่อง", material: 26075, note: "รวมค่าติดตั้ง" },
    inverter_wall_24000BTU: { unit: "เครื่อง", material: 35421, note: "รวมค่าติดตั้ง" },
    // พัดลม
    wall_fan_16in: { unit: "เครื่อง", material: 1795, labor: 345 },
    ceiling_fan_48in: { unit: "เครื่อง", material: 2190, labor: 345 },
    ceiling_fan_56in: { unit: "เครื่อง", material: 2580, labor: 345 },
    ventilator_dome_22in: { unit: "เครื่อง", material: 1750, labor: 500 },
  },

  // ============================================================
  // SECTION J: งานภูมิทัศน์ (ไม่รวม Factor F)
  // ============================================================
  landscape: {
    // ถนน ค.ส.ล.
    road_csl_3m: { unit: "เมตร", material: 1700, note: "รวมค่าแรง" },
    road_csl_4m: { unit: "เมตร", material: 2190, note: "รวมค่าแรง" },
    road_csl_6m: { unit: "เมตร", material: 3160, note: "รวมค่าแรง" },
    // ผิวจราจร
    pavement_csl_12cm: { unit: "ตร.ม.", material: 341, note: "รวมค่าแรง" },
    pavement_csl_15cm: { unit: "ตร.ม.", material: 368, note: "รวมค่าแรง" },
    pavement_csl_20cm: { unit: "ตร.ม.", material: 468, note: "รวมค่าแรง" },
    // ลาน
    slab_csl_10cm_wiremesh: { unit: "ตร.ม.", material: 256, note: "รวมค่าแรง" },
    // รั้ว
    fence_solid_pile: { unit: "เมตร", material: 2590, note: "รวมค่าแรง" },
    fence_solid_no_pile: { unit: "เมตร", material: 2190, note: "รวมค่าแรง" },
    fence_open_pile: { unit: "เมตร", material: 2880, note: "รวมค่าแรง" },
    fence_barb_wire_7: { unit: "เมตร", material: 290, note: "รวมค่าแรง" },
    fence_barb_wire_12: { unit: "เมตร", material: 2890, note: "รวมค่าแรง" },
    // รางระบายน้ำ
    drain_v_channel: { unit: "เมตร", material: 1060, note: "รวมค่าแรง" },
    drain_steel_cover: { unit: "เมตร", material: 2680, note: "รวมค่าแรง" },
    drain_open_cover: { unit: "เมตร", material: 1470, note: "รวมค่าแรง" },
  },

  // ============================================================
  // FACTOR F (งานก่อสร้างอาคาร)
  // เงินล่วงหน้าจ่าย 0%, ประกันผลงาน 0%, ดอกเบี้ย 7%, VAT 7%
  // ============================================================
  factorF: {
    table: [
      { cost_million: 0.5, factor: 1.3091 },
      { cost_million: 1, factor: 1.3067 },
      { cost_million: 2, factor: 1.3051 },
      { cost_million: 5, factor: 1.3020 },
      { cost_million: 10, factor: 1.2960 },
      { cost_million: 15, factor: 1.2611 },
      { cost_million: 20, factor: 1.2535 },
      { cost_million: 25, factor: 1.2265 },
      { cost_million: 30, factor: 1.2181 },
      { cost_million: 40, factor: 1.2177 },
      { cost_million: 50, factor: 1.2176 },
      { cost_million: 60, factor: 1.2078 },
      { cost_million: 70, factor: 1.2067 },
      { cost_million: 80, factor: 1.2067 },
      { cost_million: 100, factor: 1.2066 },
      { cost_million: 150, factor: 1.2039 },
      { cost_million: 200, factor: 1.2039 },
      { cost_million: 300, factor: 1.1969 },
      { cost_million: 500, factor: 1.1871 },
      { cost_million: 501, factor: 1.1805 },
    ],
    formula: "F = D - [(D-E) × (A-B) / (C-B)]",
    note: "A=ค่างานต้นทุน, B=ตัวล่าง, C=ตัวบน, D=Factor F ตัวล่าง, E=Factor F ตัวบน",
  },

  // ============================================================
  // เหล็กโครงสร้างรูปพรรณ (ท่อนละ 6 ม.)
  // ============================================================
  steel_sections: {
    // เหล็กฉาก
    angle_40x40x3: { unit: "ท่อน", material: 243, labor: 101, weight_kg: 10.98 },
    angle_40x40x5: { unit: "ท่อน", material: 393, labor: 177, weight_kg: 17.70 },
    angle_50x50x5: { unit: "ท่อน", material: 502, labor: 226, weight_kg: 22.62 },
    angle_50x50x6: { unit: "ท่อน", material: 608, labor: 268, weight_kg: 26.58 },
    angle_75x75x6: { unit: "ท่อน", material: 928, labor: 411, weight_kg: 41.10 },
    angle_100x100x10: { unit: "ท่อน", material: 1788, labor: 892, weight_kg: 89.20 },
    // SNK เหล็กฉาก
    SNK_angle_40x40x4: { unit: "ท่อน", material: 328.04, source: "สนค.สกลนคร", weight_kg: 14.5 },
    // ท่อเหล็กกลวงสี่เหลี่ยม
    box_1x1_1_2mm: { unit: "ท่อน", material: 109, labor: 44, weight_kg: 5.22 },
    box_1_5x1_5_2mm: { unit: "ท่อน", material: 274, labor: 111, weight_kg: 13.08 },
    box_2x2_2mm: { unit: "ท่อน", material: 369, labor: 149, weight_kg: 17.58 },
    box_2x2_2_3mm: { unit: "ท่อน", material: 420, labor: 170, weight_kg: 20.04 },
    box_3x3_3_2mm: { unit: "ท่อน", material: 883, labor: 358, weight_kg: 42.06 },
    box_4x4_3_2mm: { unit: "ท่อน", material: 1128, labor: 538, weight_kg: 53.76 },
    // SNK ท่อเหล็กกลวง
    SNK_box_1x1_1_2mm: { unit: "ท่อน", material: 128.51, source: "สนค.สกลนคร" },
    SNK_box_1_5x1_5_2mm: { unit: "ท่อน", material: 328.97, source: "สนค.สกลนคร" },
    SNK_box_2x2_2mm: { unit: "ท่อน", material: 427.57, source: "สนค.สกลนคร" },
    SNK_box_3x3_2mm: { unit: "ท่อน", material: 600.00, source: "สนค.สกลนคร" },
    // เหล็กตัวซี (Light Lip Channel)
    c_75x45x15_2_3mm: { unit: "ท่อน", material: 414, labor: 210, weight_kg: 21.00 },
    c_100x50x20_2_3mm: { unit: "ท่อน", material: 503, labor: 244, weight_kg: 23.50 },
    c_100x50x20_3_2mm: { unit: "ท่อน", material: 668, labor: 340, weight_kg: 34.00 },
    c_150x50x20_2_3mm: { unit: "ท่อน", material: 600, labor: 295, weight_kg: 29.50 },
    c_150x50x20_3_2mm: { unit: "ท่อน", material: 823, labor: 406, weight_kg: 40.56 },
    // SNK เหล็กตัวซี
    SNK_c_75x45x15_2_3mm: { unit: "ท่อน", material: 447.67, source: "สนค.สกลนคร" },
    SNK_c_100x50x20_2_3mm: { unit: "ท่อน", material: 462.62, source: "สนค.สกลนคร" },
    SNK_c_100x50x20_3_2mm: { unit: "ท่อน", material: 741.75, source: "สนค.สกลนคร" },
    SNK_c_150x50x20_2_3mm: { unit: "ท่อน", material: 660.44, source: "สนค.สกลนคร" },
    // H-Beam
    h_150x150x7x10: { unit: "ท่อน", material: 5764, labor: 2268, weight_kg: 189 },
    h_200x200x8x12: { unit: "ท่อน", material: 9119, labor: 3588, weight_kg: 299 },
    h_250x250x9x14: { unit: "ท่อน", material: 13237, labor: 5208, weight_kg: 434 },
    h_300x300x10x15: { unit: "ท่อน", material: 17202, labor: 6768, weight_kg: 564 },
    // ค่าแรงประกอบเหล็ก
    steel_assembly_general: { unit: "กก.", labor: 10, note: "รวมลวดเชื่อม" },
    steel_assembly_truss: { unit: "กก.", labor: 13, note: "รวมลวดเชื่อม" },
    // เหล็กแผ่นเรียบดำ 4'x8'
    plate_2mm: { unit: "แผ่น", material: 1104, weight_kg: 47 },
    plate_3mm: { unit: "แผ่น", material: 1645, weight_kg: 70 },
    plate_6mm: { unit: "แผ่น", material: 3290, weight_kg: 140 },
  },

  // ============================================================
  // เสาเข็ม
  // ============================================================
  piling: {
    // เสาเข็ม คอร. สี่เหลี่ยมตัน 21 ม.
    square_18x18_21m: { unit: "ต้น", material: 3780, labor_gt100: 920, labor_50_100: 980, labor_25_50: 1280 },
    square_22x22_21m: { unit: "ต้น", material: 4200, labor_gt100: 950, labor_50_100: 1120, labor_25_50: 1430 },
    square_26x26_21m: { unit: "ต้น", material: 5565, labor_gt100: 1080, labor_50_100: 1340, labor_25_50: 1450 },
    square_30x30_21m: { unit: "ต้น", material: 6930, labor_gt100: 1525, labor_50_100: 1725, labor_25_50: 1925 },
    square_35x35_21m: { unit: "ต้น", material: 9660, labor_gt100: 1830, labor_50_100: 2070, labor_25_50: 2550 },
    square_40x40_21m: { unit: "ต้น", material: 12600, labor_gt100: 2070, labor_50_100: 2340, labor_25_50: 2880 },
    // เสาเข็มรูปตัวไอ 21 ม.
    i_22x22_21m: { unit: "ต้น", material: 3738, labor_gt100: 950, labor_50_100: 1120, labor_25_50: 1430 },
    i_26x26_21m: { unit: "ต้น", material: 4515, labor_gt100: 1080, labor_50_100: 1340, labor_25_50: 1450 },
    i_30x30_21m: { unit: "ต้น", material: 5607, labor_gt100: 1525, labor_50_100: 1725, labor_25_50: 1925 },
    i_35x35_21m: { unit: "ต้น", material: 7770, labor_gt100: 1830, labor_50_100: 2070, labor_25_50: 2550 },
    i_40x40_21m: { unit: "ต้น", material: 10290, labor_gt100: 2070, labor_50_100: 2340, labor_25_50: 2880 },
    // เสาเข็มเจาะ
    bored_35cm_21m: { unit: "ต้น", material: 18500, note: "รวมค่าเจาะ" },
    bored_40cm_21m: { unit: "ต้น", material: 22500, note: "รวมค่าเจาะ" },
    bored_50cm_21m: { unit: "ต้น", material: 27500, note: "รวมค่าเจาะ" },
    bored_60cm_21m: { unit: "ต้น", material: 43000, note: "รวมค่าเจาะ" },
    // เสาเข็ม คอร. ขนาดเล็ก
    small_i_15cm_2m: { unit: "ต้น", material: 151, labor_gt200: 45 },
    small_i_15cm_3m: { unit: "ต้น", material: 235, labor_gt200: 68 },
    small_i_15cm_4m: { unit: "ต้น", material: 314, labor_gt200: 91 },
    small_i_15cm_5m: { unit: "ต้น", material: 401, labor_gt200: 107 },
    small_i_15cm_6m: { unit: "ต้น", material: 532, labor_gt200: 126 },
    // ค่าสกัดหัวเสาเข็ม
    cut_pile_head_22: { unit: "ต้น", labor: 180 },
    cut_pile_head_26: { unit: "ต้น", labor: 230 },
    cut_pile_head_30: { unit: "ต้น", labor: 250 },
    cut_pile_head_35: { unit: "ต้น", labor: 280 },
    cut_pile_head_40: { unit: "ต้น", labor: 300 },
  },
};

// ============================================================
// สรุปราคาเปรียบเทียบ สพฐ. vs สนค.
// ============================================================
export const PRICE_COMPARISON = {
  note: "ราคา สนค. มักสูงกว่า สพฐ. 5-15% เพราะรวมค่าขนส่งท้องถิ่น",
  items: [
    { item: "เหล็ก SR24 RB6", spbt: 21850, snk: 24420, diff_pct: 11.8 },
    { item: "เหล็ก SR24 RB9", spbt: 21050, snk: 22912, diff_pct: 8.8 },
    { item: "เหล็ก SD40 DB12", spbt: 21150, snk: 22450, diff_pct: 6.1 },
    { item: "เหล็ก SD40 DB16", spbt: 20950, snk: 22536, diff_pct: 7.6 },
    { item: "เหล็ก SD40 DB20", spbt: 20950, snk: 21603, diff_pct: 3.1 },
    { item: "ลวดผูกเหล็ก", spbt: 58, snk: 28.08, diff_pct: -51.6, note: "สนค.ราคาต่ำกว่ามาก" },
    { item: "เหล็กฉาก 40x40x4", spbt: 321, snk: 328, diff_pct: 2.2 },
    { item: "ท่อGI 1/2\"", spbt: 270, snk: 196, diff_pct: -27.4, note: "สนค.ไม่รวมข้อต่อ, สพฐ.มอก.277" },
  ],
};

/**
 * สร้าง prompt snippet สำหรับฝังใน AI prompt
 */
export function generatePricePromptSnippet(): string {
  return `
## ฐานราคาวัสดุก่อสร้าง ปี 2569 (สพฐ. + สนค.สกลนคร)
ราคาเงินสด ไม่รวม VAT ไม่รวมค่าขนส่ง

### ราคาหลักที่ใช้บ่อย (บาท):

**คอนกรีต:**
- คอนกรีตผสมเสร็จ 240/210: 2,470 บาท/ลบ.ม. (ค่าแรง: ติดดิน327, ชั้นเดียว419, หลายชั้น512)
- คอนกรีตผสมเสร็จ 280/240: 2,507 บาท/ลบ.ม.
- คอนกรีตหยาบ 1:3:5 ประเภท1: วัสดุ1,610 + แรง426 = 2,036 บาท/ลบ.ม.
- ปูนซีเมนต์ปอร์ตแลนด์ ประเภท1: 2,694 บาท/ตัน (ถุง134 บาท/50กก.)

**เหล็ก (ราคาต่อตัน):**
- SR.24 RB6: 21,850 (สนค.24,420) | RB9: 21,050 (สนค.22,912) | RB12: 20,610
- SD.40 DB12: 21,150 (สนค.22,450) | DB16: 20,950 | DB20: 20,950 | DB25: 20,950
- SD.50 DB12: 20,900 | DB16: 20,700 | DB20: 20,700
- ค่าแรงเหล็ก: SR24 RB6-9mm=4,400/ตัน, RB12-15mm=3,600/ตัน, RB19-25mm=3,100/ตัน
- ลวดผูกเหล็ก: 58 บาท/กก. (ใช้ 30 กก./ตัน)
- Wire Mesh Ø4mm @25x25: 26 บาท/ตร.ม. | Ø4mm @15x15: 42.50 | Ø6mm @15x15: 66

**ไม้แบบ:**
- ไม้แบบทั่วไป: 400 บาท/ลบ.ฟ. (ใช้ 50-80% ตามจำนวนชั้น)
- ค่าแรงไม้แบบ: >5,000ตร.ม.=121, <5,000ตร.ม.=139 บาท/ตร.ม.

**งานขุดดิน:**
- ขุดฐานรากถมคืน >100ลบ.ม./ลึก≤1ม.: 112 บาท/ลบ.ม.
- ทรายหยาบรองพื้น: วัสดุ510+แรง104 = 614 บาท/ลบ.ม.
- ทรายถม/ดินถม: วัสดุ~410+แรง99 = ~510 บาท/ลบ.ม.

**งานสถาปัตยกรรม:**
- ก่ออิฐมอญครึ่งแผ่น: วัสดุ333+แรง94 = 427 บาท/ตร.ม.
- ก่อคอนกรีตบล็อก 9ซม.: วัสดุ152+แรง91 = 243 บาท/ตร.ม.
- AAC 10ซม. G4: วัสดุ421+แรง60 = 481 บาท/ตร.ม.
- ฉาบปูนผนังภายใน: วัสดุ84+แรง87 = 171 บาท/ตร.ม.
- เสาเอ็น-คานทับหลัง ครึ่งแผ่น: วัสดุ105+แรง44 = 149 บาท/เมตร
- พื้นกระเบื้องเคลือบ 12"x12": วัสดุ347+แรง158 = 505 บาท/ตร.ม.
- พื้น Porcelain 24"x24": วัสดุ567+แรง217 = 784 บาท/ตร.ม.
- ฝ้ายิปซัม 9มม. โครงเหล็ก: วัสดุ258+แรง75 = 333 บาท/ตร.ม.
- สีน้ำอะครีลิค ภายนอก ปูนใหม่: วัสดุ43+แรง31 = 74 บาท/ตร.ม.

**หลังคาเหล็ก:**
- เหล็กเคลือบสี 0.47มม.: วัสดุ430+แรง70 = 500 บาท/ตร.ม.
- เหล็กเคลือบอะลูซิงค์ 0.47มม.: วัสดุ320+แรง70 = 390 บาท/ตร.ม.

**ท่อ PVC ชั้น 13.5 (ท่อนละ 4 ม.):**
- Ø1/2": 45 | Ø3/4": 54 | Ø1": 85 | Ø1½": 143 | Ø2": 219 | Ø3": 505 | Ø4": 814

**ท่อเหล็กเคลือบสังกะสี (ท่อนละ 6 ม.):**
- Ø1/2": 270 | Ø3/4": 347 | Ø1": 516 | Ø1½": 764 | Ø2": 1,075 | Ø3": 1,723 | Ø4": 2,510

**ไฟฟ้า (ต่อจุด อาคาร≤40ม.):**
- จุดดวงโคม: วัสดุ159+แรง143 = 302 บาท/จุด
- จุดสวิตช์: วัสดุ155+แรง139 = 294 บาท/จุด
- จุดปลั๊ก: วัสดุ232+แรง193 = 425 บาท/จุด
- โคม LED Panel 2x18W: วัสดุ1,186+แรง150 = 1,336 บาท/ชุด

**สุขภัณฑ์:**
- โถส้วมนั่งราบ+หม้อน้ำ: วัสดุ4,850+แรง450 = 5,300 บาท/ที่
- อ่างล้างหน้าแขวนผนัง: วัสดุ2,300+แรง450 = 2,750 บาท/ชุด
- ผนังกั้นห้องน้ำ HPL: 11,000 บาท/ชุด (รวมค่าแรง)

**Factor F (อาคาร ดอกเบี้ย7% VAT7%):**
| ค่างาน(ล้าน) | Factor F |
|---|---|
| ≤0.5 | 1.3091 |
| 1 | 1.3067 |
| 5 | 1.3020 |
| 10 | 1.2960 |
| 20 | 1.2535 |
| 50 | 1.2176 |
| 100 | 1.2066 |
| >500 | 1.1805 |

สูตร: F = D - [(D-E)×(A-B)/(C-B)]
`;
}
