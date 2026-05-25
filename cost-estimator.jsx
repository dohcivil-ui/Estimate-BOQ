import { useState, useRef, useCallback, useEffect, useMemo } from "react";

// ============================================================
// บัญชีค่าแรงงาน/ดำเนินการ (ว.809 ลว.14 พ.ย.68)
// ============================================================
const LABOR_RATES = {
  structure: {
    label: "1. งานโครงสร้างวิศวกรรม",
    items: [
      { id: "1.3.1a", name: "ขุดหลุมฐานรากและถมคืน (ดินทั่วไป >100 ลบ.ม.)", unit: "ลบ.ม.", rate: 121 },
      { id: "1.3.1b", name: "ขุดหลุมฐานรากและถมคืน (ดินทั่วไป 25-100 ลบ.ม.)", unit: "ลบ.ม.", rate: 153 },
      { id: "1.3.1c", name: "ขุดหลุมฐานรากและถมคืน (ดินทั่วไป <25 ลบ.ม.)", unit: "ลบ.ม.", rate: 181 },
      { id: "1.4", name: "ดินถมหรือทรายปรับระดับ", unit: "ลบ.ม.", rate: 121 },
      { id: "1.6.1", name: "คอนกรีตหยาบ (ผสมเอง) รองก้นหลุม", unit: "ลบ.ม.", rate: 427 },
      { id: "1.6.2a", name: "คอนกรีตโครงสร้าง (ผสมเอง) ทางเท้า/ถนน", unit: "ลบ.ม.", rate: 467 },
      { id: "1.6.2b", name: "คอนกรีตโครงสร้าง (ผสมเอง) อาคารชั้นเดียว", unit: "ลบ.ม.", rate: 533 },
      { id: "1.6.2c", name: "คอนกรีตโครงสร้าง (ผสมเอง) อาคารหลายชั้น", unit: "ลบ.ม.", rate: 581 },
      { id: "1.7a", name: "คอนกรีตผสมเสร็จ ทางเท้า/ถนน", unit: "ลบ.ม.", rate: 329 },
      { id: "1.7b", name: "คอนกรีตผสมเสร็จ อาคารชั้นเดียว", unit: "ลบ.ม.", rate: 421 },
      { id: "1.7c", name: "คอนกรีตผสมเสร็จ อาคารหลายชั้น", unit: "ลบ.ม.", rate: 522 },
      { id: "1.8.1a", name: "แบบหล่อทั่วไป (≥5,000 ตร.ม.)", unit: "ตร.ม.", rate: 144 },
      { id: "1.8.1b", name: "แบบหล่อทั่วไป (<5,000 ตร.ม.)", unit: "ตร.ม.", rate: 163 },
      { id: "1.10.1", name: "เหล็กเสริม ผิวเรียบ (<10มม.)", unit: "ตัน", rate: 4900 },
      { id: "1.10.2", name: "เหล็กเสริม ผิวเรียบ/ข้ออ้อย (10-16มม.)", unit: "ตัน", rate: 3900 },
      { id: "1.10.3", name: "เหล็กเสริม ผิวเรียบ/ข้ออ้อย (>16มม.)", unit: "ตัน", rate: 3500 },
      { id: "1.10.4", name: "ตะแกรงเหล็กสำเร็จรูป (Wire Mesh)", unit: "ตร.ม.", rate: 6 },
      { id: "1.11.1", name: "เหล็กรูปพรรณ โครงหลังคาทั่วไป", unit: "กก.", rate: 12 },
      { id: "1.11.2", name: "เหล็กรูปพรรณ โครง TRUSS", unit: "กก.", rate: 14 },
    ],
  },
  architecture: {
    label: "2. งานสถาปัตยกรรม",
    items: [
      { id: "2.1.1a", name: "กระเบื้องลอนคู่ ทรงจั่ว", unit: "ตร.ม.", rate: 46 },
      { id: "2.1.1b", name: "กระเบื้องลอนคู่ ทรงปั้นหยา", unit: "ตร.ม.", rate: 51 },
      { id: "2.1.8a", name: "หลังคาเหล็กรีดลอน (Metal Sheet) ทรงเพิง/จั่ว", unit: "ตร.ม.", rate: 72 },
      { id: "2.2.3", name: "ฝ้ายิบซั่ม โครงเหล็กชุบสังกะสี ฉาบเรียบ", unit: "ตร.ม.", rate: 77 },
      { id: "2.2.4", name: "ฝ้ายิบซั่ม โครง ที-บาร์", unit: "ตร.ม.", rate: 53 },
      { id: "2.3.1a", name: "ก่ออิฐมอญ ครึ่งแผ่น", unit: "ตร.ม.", rate: 104 },
      { id: "2.3.1b", name: "ก่ออิฐมอญ เต็มแผ่น", unit: "ตร.ม.", rate: 195 },
      { id: "2.3.1c", name: "ก่ออิฐมวลเบา 0.20x0.60x0.075", unit: "ตร.ม.", rate: 73 },
      { id: "2.3.1d", name: "ก่ออิฐมวลเบา 0.20x0.60x0.10", unit: "ตร.ม.", rate: 76 },
      { id: "2.3.12a", name: "ฉาบปูนโครงสร้าง (ภายใน)", unit: "ตร.ม.", rate: 109 },
      { id: "2.3.12b", name: "ฉาบปูนโครงสร้าง (ภายนอก)", unit: "ตร.ม.", rate: 132 },
      { id: "2.3.12c", name: "ฉาบปูนผนัง (ภายใน)", unit: "ตร.ม.", rate: 96 },
      { id: "2.3.12d", name: "ฉาบปูนผนัง (ภายนอก)", unit: "ตร.ม.", rate: 109 },
      { id: "2.4.6a", name: "พื้นกระเบื้องเซรามิค 8x8, 12x12", unit: "ตร.ม.", rate: 161 },
      { id: "2.4.6b", name: "พื้นกระเบื้องเซรามิค 18x18, 20x20, 24x24", unit: "ตร.ม.", rate: 178 },
      { id: "2.4.8a", name: "พื้นแกรนิตโต้ 12x12 ถึง 16x16", unit: "ตร.ม.", rate: 188 },
      { id: "2.4.11a", name: "พื้นหินอ่อน/แกรนิต 0.30x0.30", unit: "ตร.ม.", rate: 181 },
      { id: "2.5.2a", name: "ติดตั้งวงกบ ประตู/ช่องแสง", unit: "ตร.ม.", rate: 103 },
      { id: "2.5.3a", name: "ติดตั้งบานประตูไม้", unit: "ตร.ม.", rate: 108 },
      { id: "2.6.1", name: "ส้วมนั่งราบ มีหม้อน้ำ", unit: "ชุด", rate: 461 },
      { id: "2.6.6", name: "อ่างล้างหน้าพร้อมอุปกรณ์", unit: "ชุด", rate: 461 },
      { id: "2.8.1a", name: "ทาสีน้ำ ภายใน (≥5,000 ตร.ม.)", unit: "ตร.ม.", rate: 29 },
      { id: "2.8.1b", name: "ทาสีน้ำ ภายใน (<5,000 ตร.ม.)", unit: "ตร.ม.", rate: 31 },
      { id: "2.8.1c", name: "ทาสีน้ำ ภายนอก (≥5,000 ตร.ม.)", unit: "ตร.ม.", rate: 32 },
      { id: "2.8.1d", name: "ทาสีน้ำ ภายนอก (<5,000 ตร.ม.)", unit: "ตร.ม.", rate: 35 },
    ],
  },
  plumbing: {
    label: "3. งานระบบสุขาภิบาลและดับเพลิง",
    items: [
      { id: "3.1a", name: "ท่อเหล็กหล่อปากระฆัง Dia 2\"", unit: "เมตร", rate: 169 },
      { id: "3.1b", name: "ท่อเหล็กหล่อปากระฆัง Dia 3\"", unit: "เมตร", rate: 282 },
      { id: "3.1c", name: "ท่อเหล็กหล่อปากระฆัง Dia 4\"", unit: "เมตร", rate: 359 },
      { id: "3.7a", name: "ท่อ PVC ระบายน้ำ Dia 2\"", unit: "เมตร", rate: 41 },
      { id: "3.7b", name: "ท่อ PVC ระบายน้ำ Dia 3\"", unit: "เมตร", rate: 77 },
      { id: "3.7c", name: "ท่อ PVC ระบายน้ำ Dia 4\"", unit: "เมตร", rate: 103 },
      { id: "3.8a", name: "ท่อ PVC ระบบประปา Dia 1/2\"", unit: "เมตร", rate: 31 },
      { id: "3.8b", name: "ท่อ PVC ระบบประปา Dia 3/4\"", unit: "เมตร", rate: 31 },
      { id: "3.8c", name: "ท่อ PVC ระบบประปา Dia 1\"", unit: "เมตร", rate: 31 },
    ],
  },
  electrical: {
    label: "4. งานระบบไฟฟ้าและสื่อสาร",
    items: [
      { id: "4.2a", name: "สาย THW 2.5 sq.mm.", unit: "เมตร", rate: 7 },
      { id: "4.2b", name: "สาย THW 4 sq.mm.", unit: "เมตร", rate: 10 },
      { id: "4.2c", name: "สาย THW 16 sq.mm.", unit: "เมตร", rate: 21 },
      { id: "4.2d", name: "สาย THW 25 sq.mm.", unit: "เมตร", rate: 26 },
      { id: "4.2e", name: "สาย THW 35 sq.mm.", unit: "เมตร", rate: 31 },
      { id: "4.53a", name: "Single Switch 1 Gang", unit: "ชุด", rate: 82 },
      { id: "4.53b", name: "Single Switch 2 Gang", unit: "ชุด", rate: 92 },
      { id: "4.53c", name: "Single Receptacle", unit: "ชุด", rate: 92 },
      { id: "4.53d", name: "Duplex Receptacle 2P+G", unit: "ชุด", rate: 92 },
      { id: "4.58a", name: "โคมไฟ Downlight dia 4-6\"", unit: "ชุด", rate: 118 },
      { id: "4.58b", name: "โคมเรืองแสง 1x18 วัตต์", unit: "ชุด", rate: 118 },
      { id: "4.58c", name: "โคมเรืองแสง 2x36 วัตต์", unit: "ชุด", rate: 154 },
    ],
  },
  hvac: {
    label: "5. งานระบบปรับอากาศ",
    items: [
      { id: "5.1a", name: "แอร์ Ceiling Mounted 9,000 BTU", unit: "ชุด", rate: 1538 },
      { id: "5.1b", name: "แอร์ Ceiling Mounted 12,000 BTU", unit: "ชุด", rate: 1538 },
      { id: "5.1c", name: "แอร์ Ceiling Mounted 18,000 BTU", unit: "ชุด", rate: 1538 },
      { id: "5.1d", name: "แอร์ Ceiling Mounted 24,000 BTU", unit: "ชุด", rate: 1538 },
      { id: "5.1e", name: "แอร์ Ceiling Mounted 36,000 BTU", unit: "ชุด", rate: 2050 },
      { id: "5.2a", name: "พัดลมระบายอากาศ Wall Mount dia 8\"", unit: "ชุด", rate: 410 },
      { id: "5.2b", name: "พัดลมระบายอากาศ Wall Mount dia 10\"", unit: "ชุด", rate: 461 },
    ],
  },
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================
function calcPolygonArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    a += pts[i].x * pts[j].y;
    a -= pts[j].x * pts[i].y;
  }
  return Math.abs(a / 2);
}

function calcPolylineLength(pts) {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x;
    const dy = pts[i].y - pts[i - 1].y;
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len;
}

function distPt(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function formatNum(n) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ============================================================
// MAIN APP
// ============================================================
export default function CostEstimator() {
  // --- State ---
  const [image, setImage] = useState(null);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [tool, setTool] = useState("polygon"); // polygon | line | calibrate | select
  const [drawingPts, setDrawingPts] = useState([]);
  const [shapes, setShapes] = useState([]);
  const [selectedShapeIdx, setSelectedShapeIdx] = useState(null);
  const [scale, setScale] = useState(1); // pixels per meter
  const [calibDist, setCalibDist] = useState("1"); // user input for calibration distance (m)
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [snapRadius] = useState(12);
  const [cursorPos, setCursorPos] = useState(null);
  const [snappedPt, setSnappedPt] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState(null);
  const [tab, setTab] = useState("draw"); // draw | boq | rates
  const [boqItems, setBoqItems] = useState([]);
  const [searchRate, setSearchRate] = useState("");
  const [showHelp, setShowHelp] = useState(false);

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const imgRef = useRef(null);

  // --- All snap-able nodes ---
  const allNodes = useMemo(() => {
    const nodes = [];
    shapes.forEach((s) => s.points.forEach((p) => nodes.push(p)));
    return nodes;
  }, [shapes]);

  // --- Find snap point ---
  const findSnap = useCallback(
    (pt) => {
      if (!snapEnabled) return null;
      let best = null;
      let bestDist = snapRadius / zoom;
      allNodes.forEach((n) => {
        const d = distPt(pt, n);
        if (d < bestDist) {
          bestDist = d;
          best = n;
        }
      });
      // Also snap to drawing points
      drawingPts.forEach((n) => {
        const d = distPt(pt, n);
        if (d < bestDist) {
          bestDist = d;
          best = n;
        }
      });
      return best;
    },
    [snapEnabled, allNodes, drawingPts, snapRadius, zoom]
  );

  // --- Screen to canvas coords ---
  const screenToCanvas = useCallback(
    (sx, sy) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (sx - rect.left - pan.x) / zoom,
        y: (sy - rect.top - pan.y) / zoom,
      };
    },
    [zoom, pan]
  );

  // --- Load image ---
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        setImgSize({ w: img.width, h: img.height });
        setImage(ev.target.result);
        setZoom(1);
        setPan({ x: 0, y: 0 });
        setShapes([]);
        setDrawingPts([]);
        setSelectedShapeIdx(null);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  // --- Canvas drawing ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const rect = containerRef.current.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + "px";
    canvas.style.height = rect.height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw image
    if (imgRef.current && image) {
      ctx.drawImage(imgRef.current, 0, 0);
    }

    // Draw existing shapes
    shapes.forEach((s, idx) => {
      const isSelected = idx === selectedShapeIdx;
      ctx.beginPath();
      if (s.type === "polygon" && s.points.length > 0) {
        ctx.moveTo(s.points[0].x, s.points[0].y);
        s.points.forEach((p, i) => { if (i > 0) ctx.lineTo(p.x, p.y); });
        ctx.closePath();
        ctx.fillStyle = isSelected
          ? "rgba(255, 200, 0, 0.35)"
          : "rgba(0, 150, 255, 0.2)";
        ctx.fill();
        ctx.strokeStyle = isSelected ? "#ffb300" : "#0077ff";
        ctx.lineWidth = (isSelected ? 3 : 2) / zoom;
        ctx.stroke();
      } else if (s.type === "line" && s.points.length > 0) {
        ctx.moveTo(s.points[0].x, s.points[0].y);
        s.points.forEach((p, i) => { if (i > 0) ctx.lineTo(p.x, p.y); });
        ctx.strokeStyle = isSelected ? "#ffb300" : "#00cc66";
        ctx.lineWidth = (isSelected ? 3 : 2) / zoom;
        ctx.stroke();
      } else if (s.type === "calibrate" && s.points.length === 2) {
        ctx.moveTo(s.points[0].x, s.points[0].y);
        ctx.lineTo(s.points[1].x, s.points[1].y);
        ctx.strokeStyle = "#ff3366";
        ctx.lineWidth = 2.5 / zoom;
        ctx.setLineDash([8 / zoom, 4 / zoom]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Node dots
      s.points.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4 / zoom, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? "#ffb300" : "#fff";
        ctx.fill();
        ctx.strokeStyle = "#333";
        ctx.lineWidth = 1.5 / zoom;
        ctx.stroke();
      });

      // Label
      if (s.label) {
        const cx = s.points.reduce((a, p) => a + p.x, 0) / s.points.length;
        const cy = s.points.reduce((a, p) => a + p.y, 0) / s.points.length;
        ctx.font = `bold ${14 / zoom}px 'Prompt', sans-serif`;
        ctx.fillStyle = isSelected ? "#ffb300" : "#0055cc";
        ctx.textAlign = "center";
        ctx.fillText(s.label, cx, cy);
      }
    });

    // Draw current drawing
    if (drawingPts.length > 0) {
      ctx.beginPath();
      ctx.moveTo(drawingPts[0].x, drawingPts[0].y);
      drawingPts.forEach((p, i) => { if (i > 0) ctx.lineTo(p.x, p.y); });
      if (cursorPos && tool !== "select") {
        const pt = snappedPt || cursorPos;
        ctx.lineTo(pt.x, pt.y);
      }
      if (tool === "polygon") {
        ctx.fillStyle = "rgba(255, 100, 0, 0.15)";
        ctx.fill();
      }
      ctx.strokeStyle = tool === "calibrate" ? "#ff3366" : "#ff6600";
      ctx.lineWidth = 2 / zoom;
      if (tool === "calibrate") {
        ctx.setLineDash([8 / zoom, 4 / zoom]);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      drawingPts.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5 / zoom, 0, Math.PI * 2);
        ctx.fillStyle = "#ff6600";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5 / zoom;
        ctx.stroke();
      });
    }

    // Snap indicator
    if (snappedPt && tool !== "select") {
      ctx.beginPath();
      ctx.arc(snappedPt.x, snappedPt.y, 8 / zoom, 0, Math.PI * 2);
      ctx.strokeStyle = "#00ff88";
      ctx.lineWidth = 2.5 / zoom;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(snappedPt.x, snappedPt.y, 3 / zoom, 0, Math.PI * 2);
      ctx.fillStyle = "#00ff88";
      ctx.fill();
    }

    // Crosshair cursor
    if (cursorPos && tool !== "select" && !isPanning) {
      const pt = snappedPt || cursorPos;
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 1 / zoom;
      ctx.setLineDash([4 / zoom, 4 / zoom]);
      ctx.beginPath();
      ctx.moveTo(pt.x - 20 / zoom, pt.y);
      ctx.lineTo(pt.x + 20 / zoom, pt.y);
      ctx.moveTo(pt.x, pt.y - 20 / zoom);
      ctx.lineTo(pt.x, pt.y + 20 / zoom);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  });

  // --- Mouse handlers ---
  const handleMouseDown = (e) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }
    if (e.button !== 0) return;

    const pt = screenToCanvas(e.clientX, e.clientY);
    const snap = findSnap(pt);
    const finalPt = snap || pt;

    if (tool === "select") {
      // Find shape under click
      let found = -1;
      for (let i = shapes.length - 1; i >= 0; i--) {
        const s = shapes[i];
        if (s.type === "polygon") {
          // Simple point-in-polygon test
          let inside = false;
          const pts = s.points;
          for (let a = 0, b = pts.length - 1; a < pts.length; b = a++) {
            if (
              pts[a].y > pt.y !== pts[b].y > pt.y &&
              pt.x < ((pts[b].x - pts[a].x) * (pt.y - pts[a].y)) / (pts[b].y - pts[a].y) + pts[a].x
            ) {
              inside = !inside;
            }
          }
          if (inside) { found = i; break; }
        } else {
          // For lines, check proximity
          for (let j = 0; j < s.points.length - 1; j++) {
            const a2 = s.points[j], b2 = s.points[j + 1];
            const len = distPt(a2, b2);
            if (len === 0) continue;
            const t = Math.max(0, Math.min(1, ((pt.x - a2.x) * (b2.x - a2.x) + (pt.y - a2.y) * (b2.y - a2.y)) / (len * len)));
            const proj = { x: a2.x + t * (b2.x - a2.x), y: a2.y + t * (b2.y - a2.y) };
            if (distPt(pt, proj) < 10 / zoom) { found = i; break; }
          }
          if (found >= 0) break;
        }
      }
      setSelectedShapeIdx(found >= 0 ? found : null);
      return;
    }

    if (tool === "calibrate") {
      if (drawingPts.length === 0) {
        setDrawingPts([finalPt]);
      } else {
        const pxLen = distPt(drawingPts[0], finalPt);
        const dist = parseFloat(calibDist) || 1;
        setScale(pxLen / dist);
        setShapes((prev) => [...prev, { type: "calibrate", points: [drawingPts[0], finalPt], label: `${dist} ม.` }]);
        setDrawingPts([]);
        setTool("polygon");
      }
      return;
    }

    // Close polygon if clicking near first point
    if (tool === "polygon" && drawingPts.length >= 3) {
      if (distPt(finalPt, drawingPts[0]) < 12 / zoom) {
        const area = calcPolygonArea(drawingPts) / (scale * scale);
        setShapes((prev) => [
          ...prev,
          {
            type: "polygon",
            points: [...drawingPts],
            areaSqm: area,
            label: `${formatNum(area)} ตร.ม.`,
          },
        ]);
        setDrawingPts([]);
        return;
      }
    }

    setDrawingPts((prev) => [...prev, finalPt]);
  };

  const handleMouseMove = (e) => {
    if (isPanning && panStart) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      return;
    }
    const pt = screenToCanvas(e.clientX, e.clientY);
    setCursorPos(pt);
    setSnappedPt(findSnap(pt));
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const newZoom = Math.max(0.1, Math.min(20, zoom * factor));
    setPan({
      x: mx - (mx - pan.x) * (newZoom / zoom),
      y: my - (my - pan.y) * (newZoom / zoom),
    });
    setZoom(newZoom);
  };

  const handleDblClick = () => {
    if (tool === "line" && drawingPts.length >= 2) {
      const len = calcPolylineLength(drawingPts) / scale;
      setShapes((prev) => [
        ...prev,
        {
          type: "line",
          points: [...drawingPts],
          lengthM: len,
          label: `${formatNum(len)} ม.`,
        },
      ]);
      setDrawingPts([]);
    } else if (tool === "polygon" && drawingPts.length >= 3) {
      const area = calcPolygonArea(drawingPts) / (scale * scale);
      setShapes((prev) => [
        ...prev,
        {
          type: "polygon",
          points: [...drawingPts],
          areaSqm: area,
          label: `${formatNum(area)} ตร.ม.`,
        },
      ]);
      setDrawingPts([]);
    }
  };

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape") {
        setDrawingPts([]);
      } else if (e.key === "z" && e.ctrlKey && drawingPts.length > 0) {
        setDrawingPts((prev) => prev.slice(0, -1));
      } else if (e.key === "Delete" && selectedShapeIdx !== null) {
        setShapes((prev) => prev.filter((_, i) => i !== selectedShapeIdx));
        setSelectedShapeIdx(null);
      }
    },
    [drawingPts, selectedShapeIdx]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // --- BOQ management ---
  const addBoqItem = (rateItem) => {
    setBoqItems((prev) => [
      ...prev,
      { ...rateItem, qty: 0, shapeIdx: selectedShapeIdx },
    ]);
  };

  const updateBoqQty = (idx, qty) => {
    setBoqItems((prev) => prev.map((item, i) => (i === idx ? { ...item, qty: parseFloat(qty) || 0 } : item)));
  };

  const removeBoqItem = (idx) => {
    setBoqItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const autoFillQty = (boqIdx) => {
    if (selectedShapeIdx === null) return;
    const shape = shapes[selectedShapeIdx];
    if (!shape) return;
    const item = boqItems[boqIdx];
    let qty = 0;
    if (item.unit === "ตร.ม." && shape.areaSqm) qty = shape.areaSqm;
    else if (item.unit === "เมตร" && shape.lengthM) qty = shape.lengthM;
    else if (item.unit === "ลบ.ม." && shape.areaSqm) qty = shape.areaSqm; // user adjusts thickness
    updateBoqQty(boqIdx, qty.toFixed(2));
  };

  const totalCost = boqItems.reduce((sum, item) => sum + item.qty * item.rate, 0);

  // --- Filtered rates ---
  const filteredRates = useMemo(() => {
    if (!searchRate.trim()) return LABOR_RATES;
    const q = searchRate.toLowerCase();
    const result = {};
    Object.entries(LABOR_RATES).forEach(([key, cat]) => {
      const filtered = cat.items.filter(
        (item) => item.name.toLowerCase().includes(q) || item.id.toLowerCase().includes(q)
      );
      if (filtered.length > 0) {
        result[key] = { ...cat, items: filtered };
      }
    });
    return result;
  }, [searchRate]);

  // --- Hidden image element ---
  useEffect(() => {
    if (image) {
      const img = new Image();
      img.src = image;
      imgRef.current = img;
    }
  }, [image]);

  // --- Styles ---
  const colors = {
    bg: "#0f1218",
    panel: "#181d26",
    panelBorder: "#2a3040",
    accent: "#3b82f6",
    accentHover: "#60a5fa",
    warn: "#f59e0b",
    danger: "#ef4444",
    success: "#10b981",
    text: "#e2e8f0",
    textDim: "#94a3b8",
    textBright: "#f8fafc",
  };

  const btnStyle = (active, color = colors.accent) => ({
    padding: "6px 14px",
    borderRadius: 6,
    border: active ? `2px solid ${color}` : "1px solid " + colors.panelBorder,
    background: active ? color + "22" : "transparent",
    color: active ? color : colors.text,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: active ? 700 : 500,
    transition: "all 0.15s",
    display: "flex",
    alignItems: "center",
    gap: 5,
  });

  return (
    <div style={{ display: "flex", height: "100vh", background: colors.bg, color: colors.text, fontFamily: "'Prompt', 'Noto Sans Thai', sans-serif", fontSize: 13, overflow: "hidden" }}>
      {/* ============ LEFT PANEL ============ */}
      <div style={{ width: 320, minWidth: 320, background: colors.panel, borderRight: `1px solid ${colors.panelBorder}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "14px 16px 10px", borderBottom: `1px solid ${colors.panelBorder}` }}>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: colors.accentHover, letterSpacing: 0.5 }}>
            🏗️ ประมาณราคาก่อสร้าง
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 11, color: colors.textDim }}>
            ว.809 (14 พ.ย. 2568) บัญชีค่าแรง กรมบัญชีกลาง
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: `1px solid ${colors.panelBorder}` }}>
          {[
            { key: "draw", label: "📐 วาด/วัด" },
            { key: "boq", label: "📋 BOQ" },
            { key: "rates", label: "💰 บัญชีค่าแรง" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                flex: 1, padding: "10px 0", border: "none", cursor: "pointer",
                background: tab === t.key ? colors.accent + "18" : "transparent",
                color: tab === t.key ? colors.accent : colors.textDim,
                borderBottom: tab === t.key ? `2px solid ${colors.accent}` : "2px solid transparent",
                fontWeight: tab === t.key ? 700 : 500, fontSize: 12,
                fontFamily: "inherit",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
          {/* === DRAW TAB === */}
          {tab === "draw" && (
            <>
              {/* File upload */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", padding: "10px 14px", border: `2px dashed ${colors.panelBorder}`, borderRadius: 8, textAlign: "center", cursor: "pointer", color: colors.textDim, transition: "border-color 0.2s" }}>
                  📁 เปิดไฟล์ (JPG, PNG, PDF)
                  <input type="file" accept="image/*,.pdf" onChange={handleFile} style={{ display: "none" }} />
                </label>
              </div>

              {/* Tools */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: colors.textDim, marginBottom: 6, fontWeight: 600 }}>เครื่องมือ</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button style={btnStyle(tool === "polygon")} onClick={() => setTool("polygon")}>
                    ⬡ วาดพื้นที่
                  </button>
                  <button style={btnStyle(tool === "line", colors.success)} onClick={() => setTool("line")}>
                    📏 วัดความยาว
                  </button>
                  <button style={btnStyle(tool === "calibrate", "#ff3366")} onClick={() => setTool("calibrate")}>
                    📐 ตั้งสเกล
                  </button>
                  <button style={btnStyle(tool === "select", colors.warn)} onClick={() => setTool("select")}>
                    🖱️ เลือก
                  </button>
                </div>
              </div>

              {/* Calibration */}
              {tool === "calibrate" && (
                <div style={{ background: "#ff336615", border: "1px solid #ff336644", borderRadius: 8, padding: 10, marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#ff6688", marginBottom: 6 }}>
                    📐 ตั้งสเกล: คลิก 2 จุดที่ทราบระยะจริง
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12, color: colors.textDim }}>ระยะจริง:</span>
                    <input
                      type="number"
                      value={calibDist}
                      onChange={(e) => setCalibDist(e.target.value)}
                      style={{
                        width: 70, padding: "4px 8px", borderRadius: 4, border: `1px solid ${colors.panelBorder}`,
                        background: colors.bg, color: colors.text, fontSize: 13, fontFamily: "inherit",
                      }}
                    />
                    <span style={{ fontSize: 12, color: colors.textDim }}>เมตร</span>
                  </div>
                </div>
              )}

              {/* Snap toggle */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={snapEnabled}
                    onChange={(e) => setSnapEnabled(e.target.checked)}
                    style={{ accentColor: colors.success }}
                  />
                  🧲 Snap เข้าจุด
                </label>
                <span style={{ fontSize: 11, color: colors.textDim }}>
                  สเกล: {scale > 1 ? `${(1/scale * 100).toFixed(1)} px/ม.` : "ยังไม่ตั้ง"}
                </span>
              </div>

              {/* Shapes list */}
              <div style={{ fontSize: 11, color: colors.textDim, marginBottom: 6, fontWeight: 600 }}>
                รายการที่วาด ({shapes.filter((s) => s.type !== "calibrate").length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {shapes.map((s, i) => {
                  if (s.type === "calibrate") return null;
                  return (
                    <div
                      key={i}
                      onClick={() => { setSelectedShapeIdx(i); setTool("select"); }}
                      style={{
                        padding: "8px 10px", borderRadius: 6, cursor: "pointer",
                        background: selectedShapeIdx === i ? colors.accent + "20" : colors.bg,
                        border: `1px solid ${selectedShapeIdx === i ? colors.accent : colors.panelBorder}`,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 600 }}>
                          {s.type === "polygon" ? "⬡" : "📏"} {s.label}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShapes((prev) => prev.filter((_, j) => j !== i));
                            if (selectedShapeIdx === i) setSelectedShapeIdx(null);
                          }}
                          style={{
                            background: "none", border: "none", color: colors.danger, cursor: "pointer",
                            fontSize: 14, padding: "0 4px",
                          }}
                        >
                          ✕
                        </button>
                      </div>
                      <div style={{ fontSize: 11, color: colors.textDim }}>
                        {s.type === "polygon"
                          ? `พื้นที่ ${formatNum(s.areaSqm)} ตร.ม. (${s.points.length} จุด)`
                          : `ความยาว ${formatNum(s.lengthM)} ม. (${s.points.length} จุด)`}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Help */}
              <div style={{ marginTop: 16, background: colors.bg, borderRadius: 8, padding: 10, fontSize: 11, lineHeight: 1.8, color: colors.textDim }}>
                <div style={{ fontWeight: 700, color: colors.textBright, marginBottom: 4 }}>💡 วิธีใช้</div>
                <div>• <b>ตั้งสเกล</b>: เลือก 📐 แล้วคลิก 2 จุดที่ทราบระยะ</div>
                <div>• <b>วาดพื้นที่</b>: คลิกมุมทีละจุด ปิดรูปคลิกจุดแรก / Double-click</div>
                <div>• <b>วัดความยาว</b>: คลิกจุดต่อจุด Double-click จบ</div>
                <div>• <b>Snap</b>: จะ snap เข้าจุดมุมที่มีอยู่อัตโนมัติ</div>
                <div>• <b>Zoom</b>: ล้อ mouse / <b>Pan</b>: Alt+ลาก หรือ middle click</div>
                <div>• <b>Esc</b>: ยกเลิก | <b>Ctrl+Z</b>: undo จุด | <b>Del</b>: ลบ shape</div>
              </div>
            </>
          )}

          {/* === BOQ TAB === */}
          {tab === "boq" && (
            <>
              <div style={{ fontSize: 11, color: colors.textDim, marginBottom: 8 }}>
                เลือกรายการจากแท็บ "บัญชีค่าแรง" แล้วกดเพิ่มเข้า BOQ
                {selectedShapeIdx !== null && (
                  <span style={{ color: colors.warn }}> (เลือก shape #{selectedShapeIdx + 1})</span>
                )}
              </div>

              {boqItems.length === 0 ? (
                <div style={{ textAlign: "center", padding: 30, color: colors.textDim }}>
                  ยังไม่มีรายการ<br />ไปที่แท็บ "บัญชีค่าแรง" เพื่อเพิ่ม
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {boqItems.map((item, i) => (
                    <div key={i} style={{ background: colors.bg, borderRadius: 8, padding: 10, border: `1px solid ${colors.panelBorder}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: 12, flex: 1 }}>{item.name}</span>
                        <button
                          onClick={() => removeBoqItem(i)}
                          style={{ background: "none", border: "none", color: colors.danger, cursor: "pointer", fontSize: 14 }}
                        >
                          ✕
                        </button>
                      </div>
                      <div style={{ fontSize: 11, color: colors.textDim, marginBottom: 6 }}>
                        อัตราค่าแรง: {formatNum(item.rate)} บาท/{item.unit}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 12 }}>ปริมาณ:</span>
                        <input
                          type="number"
                          value={item.qty || ""}
                          onChange={(e) => updateBoqQty(i, e.target.value)}
                          style={{
                            width: 80, padding: "4px 8px", borderRadius: 4, border: `1px solid ${colors.panelBorder}`,
                            background: colors.panel, color: colors.text, fontSize: 13, fontFamily: "inherit",
                          }}
                        />
                        <span style={{ fontSize: 12, color: colors.textDim }}>{item.unit}</span>
                        {selectedShapeIdx !== null && (
                          <button
                            onClick={() => autoFillQty(i)}
                            style={{
                              padding: "3px 8px", borderRadius: 4, border: `1px solid ${colors.success}44`,
                              background: colors.success + "15", color: colors.success, cursor: "pointer",
                              fontSize: 11, fontFamily: "inherit",
                            }}
                          >
                            ← จาก shape
                          </button>
                        )}
                      </div>
                      <div style={{ textAlign: "right", fontSize: 13, fontWeight: 700, marginTop: 6, color: colors.accentHover }}>
                        {formatNum(item.qty * item.rate)} บาท
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Total */}
              {boqItems.length > 0 && (
                <div style={{
                  marginTop: 16, padding: 14, borderRadius: 10,
                  background: `linear-gradient(135deg, ${colors.accent}25, ${colors.success}15)`,
                  border: `1px solid ${colors.accent}44`,
                }}>
                  <div style={{ fontSize: 12, color: colors.textDim, marginBottom: 4 }}>ค่าแรงรวมทั้งสิ้น</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: colors.accentHover }}>
                    ฿ {formatNum(totalCost)}
                  </div>
                  <div style={{ fontSize: 11, color: colors.textDim, marginTop: 4 }}>
                    * เป็นเฉพาะค่าแรง ไม่รวมค่าวัสดุ | อ้างอิง ว.809 (14 พ.ย. 68)
                  </div>
                </div>
              )}
            </>
          )}

          {/* === RATES TAB === */}
          {tab === "rates" && (
            <>
              <input
                type="text"
                placeholder="🔍 ค้นหา เช่น ก่ออิฐ, คอนกรีต, ฉาบปูน..."
                value={searchRate}
                onChange={(e) => setSearchRate(e.target.value)}
                style={{
                  width: "100%", padding: "8px 12px", borderRadius: 6, border: `1px solid ${colors.panelBorder}`,
                  background: colors.bg, color: colors.text, fontSize: 13, marginBottom: 10,
                  fontFamily: "inherit", boxSizing: "border-box",
                }}
              />
              {Object.entries(filteredRates).map(([key, cat]) => (
                <div key={key} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: colors.accent, marginBottom: 6, paddingBottom: 4, borderBottom: `1px solid ${colors.panelBorder}` }}>
                    {cat.label}
                  </div>
                  {cat.items.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        padding: "6px 8px", marginBottom: 3, borderRadius: 6, cursor: "pointer",
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        background: colors.bg, border: `1px solid ${colors.panelBorder}`,
                        transition: "border-color 0.15s",
                      }}
                      onClick={() => { addBoqItem(item); setTab("boq"); }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 500 }}>{item.name}</div>
                        <div style={{ fontSize: 11, color: colors.textDim }}>
                          {formatNum(item.rate)} บาท/{item.unit}
                        </div>
                      </div>
                      <span style={{ fontSize: 16, color: colors.success, marginLeft: 6 }}>＋</span>
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* ============ CANVAS AREA ============ */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {/* Toolbar */}
        <div style={{
          position: "absolute", top: 10, left: 10, right: 10, zIndex: 10,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          background: colors.panel + "ee", borderRadius: 8, padding: "6px 12px",
          border: `1px solid ${colors.panelBorder}`, backdropFilter: "blur(8px)",
        }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: colors.textDim }}>
              🔍 {(zoom * 100).toFixed(0)}%
            </span>
            <button
              onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
              style={{ ...btnStyle(false), padding: "4px 8px", fontSize: 11 }}
            >
              Reset
            </button>
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: colors.accent }}>
            {tool === "polygon" && "⬡ วาดพื้นที่ (Polygon)"}
            {tool === "line" && "📏 วัดความยาว (Polyline)"}
            {tool === "calibrate" && "📐 ตั้งสเกล (Calibrate)"}
            {tool === "select" && "🖱️ เลือก (Select)"}
          </div>
          <div style={{ fontSize: 11, color: colors.textDim }}>
            {cursorPos && `X: ${cursorPos.x.toFixed(0)}, Y: ${cursorPos.y.toFixed(0)}`}
            {snappedPt && <span style={{ color: colors.success, marginLeft: 6 }}>● SNAP</span>}
          </div>
        </div>

        {/* Canvas */}
        <div
          ref={containerRef}
          style={{
            width: "100%", height: "100%",
            cursor: isPanning ? "grabbing" : tool === "select" ? "default" : "crosshair",
            background: "#0a0d12",
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDoubleClick={handleDblClick}
          onWheel={handleWheel}
          onContextMenu={(e) => e.preventDefault()}
        >
          <canvas ref={canvasRef} style={{ display: "block" }} />
        </div>

        {/* No image placeholder */}
        {!image && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", pointerEvents: "none",
          }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>📐</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: colors.textDim, marginBottom: 8 }}>
              โปรแกรมประมาณราคาก่อสร้าง
            </div>
            <div style={{ fontSize: 13, color: colors.textDim, textAlign: "center", lineHeight: 2 }}>
              เปิดไฟล์แบบก่อสร้าง (JPG, PNG) จากแผงซ้าย<br />
              ตั้งสเกล → วาดพื้นที่/วัดระยะ → เพิ่มรายการ BOQ<br />
              อ้างอิงบัญชีค่าแรงงาน ว.809 ลว.14 พ.ย. 2568
            </div>
          </div>
        )}

        {/* Selected shape info */}
        {selectedShapeIdx !== null && shapes[selectedShapeIdx] && (
          <div style={{
            position: "absolute", bottom: 12, left: 12, right: 12, zIndex: 10,
            background: colors.panel + "ee", borderRadius: 10, padding: "10px 14px",
            border: `1px solid ${colors.warn}55`, backdropFilter: "blur(8px)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700, color: colors.warn }}>
                ✦ {shapes[selectedShapeIdx].type === "polygon" ? "พื้นที่" : "เส้น"} #{selectedShapeIdx + 1}
              </span>
              <span style={{ fontSize: 16, fontWeight: 800, color: colors.textBright }}>
                {shapes[selectedShapeIdx].label}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
