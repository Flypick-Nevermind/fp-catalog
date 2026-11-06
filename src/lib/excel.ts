import { Category, Product } from "@/types/database";
import {
  DEFAULT_CALC_WEIGHT_GRAMS,
  DEFAULT_RATE_PER_KG,
  DEFAULT_YUAN_MULTIPLIER,
  extractJastipCalcMeta,
  getPublicAttributes,
  computeJastipFinalPrice,
  isSub200gCategory,
} from "@/lib/jastip-calc";

export interface ExcelCell {
  value: string | number | null | undefined;
  type?: "string" | "number";
  style?: "header" | "data" | "currency" | "number" | "muted" | "badge";
}

export interface ExcelWorksheet {
  name: string;
  columns: { header: string; width: number }[];
  rows: ExcelCell[][];
}

/**
 * Standar kolom spesifikasi utama agar selalu muncul berurutan di Excel
 */
export const STANDARD_SPEC_KEYS = [
  "Weight",
  "Dimensions",
  "Material",
  "Colors",
  "Highlights",
];

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    // Hapus karakter kontrol ASCII yang tidak valid di XML 1.0
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}

/**
 * Konversi indeks kolom (0-based) menjadi huruf kolom Excel (A, B, ..., Z, AA, AB, dst.)
 */
export function getExcelColumnLetter(colIndex: number): string {
  let temp = colIndex + 1;
  let letter = "";
  while (temp > 0) {
    const rem = (temp - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    temp = Math.floor((temp - 1) / 26);
  }
  return letter;
}

/**
 * Pembuat CRC32 standar untuk format kontainer ZIP (.xlsx)
 */
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Membuat arsip ZIP (STORE method 0) yang 100% kompatibel dengan spesifikasi OpenXML (.xlsx)
 */
function createZipArchive(files: { path: string; content: string }[]): Uint8Array {
  const encoder = new TextEncoder();
  const entries = files.map((f) => {
    const nameBytes = encoder.encode(f.path);
    const dataBytes = encoder.encode(f.content);
    const crc = crc32(dataBytes);
    return {
      nameBytes,
      dataBytes,
      crc,
      offset: 0,
    };
  });

  let localTotalSize = 0;
  for (const entry of entries) {
    entry.offset = localTotalSize;
    localTotalSize += 30 + entry.nameBytes.length + entry.dataBytes.length;
  }

  let centralDirSize = 0;
  for (const entry of entries) {
    centralDirSize += 46 + entry.nameBytes.length;
  }

  const totalSize = localTotalSize + centralDirSize + 22;
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const out = new Uint8Array(buffer);

  let pos = 0;

  // 1. Local File Headers + File Data
  for (const entry of entries) {
    view.setUint32(pos, 0x04034b50, true); // Local file header signature
    view.setUint16(pos + 4, 20, true); // Version needed to extract (2.0)
    view.setUint16(pos + 6, 0x0800, true); // General purpose bit flag (UTF-8)
    view.setUint16(pos + 8, 0, true); // Compression method (0 = STORE)
    view.setUint16(pos + 10, 0, true); // Last mod file time
    view.setUint16(pos + 12, 0x5821, true); // Last mod file date
    view.setUint32(pos + 14, entry.crc, true); // CRC-32
    view.setUint32(pos + 18, entry.dataBytes.length, true); // Compressed size
    view.setUint32(pos + 22, entry.dataBytes.length, true); // Uncompressed size
    view.setUint16(pos + 26, entry.nameBytes.length, true); // File name length
    view.setUint16(pos + 28, 0, true); // Extra field length
    pos += 30;

    out.set(entry.nameBytes, pos);
    pos += entry.nameBytes.length;

    out.set(entry.dataBytes, pos);
    pos += entry.dataBytes.length;
  }

  const centralDirOffset = pos;

  // 2. Central Directory File Headers
  for (const entry of entries) {
    view.setUint32(pos, 0x02014b50, true); // Central file header signature
    view.setUint16(pos + 4, 20, true); // Version made by
    view.setUint16(pos + 6, 20, true); // Version needed to extract
    view.setUint16(pos + 8, 0x0800, true); // General purpose bit flag (UTF-8)
    view.setUint16(pos + 10, 0, true); // Compression method (0 = STORE)
    view.setUint16(pos + 12, 0, true); // Last mod file time
    view.setUint16(pos + 14, 0x5821, true); // Last mod file date
    view.setUint32(pos + 16, entry.crc, true); // CRC-32
    view.setUint32(pos + 20, entry.dataBytes.length, true); // Compressed size
    view.setUint32(pos + 24, entry.dataBytes.length, true); // Uncompressed size
    view.setUint16(pos + 28, entry.nameBytes.length, true); // File name length
    view.setUint16(pos + 30, 0, true); // Extra field length
    view.setUint16(pos + 32, 0, true); // File comment length
    view.setUint16(pos + 34, 0, true); // Disk number start
    view.setUint16(pos + 36, 0, true); // Internal file attributes
    view.setUint32(pos + 38, 0, true); // External file attributes
    view.setUint32(pos + 42, entry.offset, true); // Relative offset of local header
    pos += 46;

    out.set(entry.nameBytes, pos);
    pos += entry.nameBytes.length;
  }

  // 3. End of Central Directory Record (EOCD)
  view.setUint32(pos, 0x06054b50, true); // EOCD signature
  view.setUint16(pos + 4, 0, true); // Number of this disk
  view.setUint16(pos + 6, 0, true); // Disk where central directory starts
  view.setUint16(pos + 8, entries.length, true); // Number of central directory records on this disk
  view.setUint16(pos + 10, entries.length, true); // Total number of central directory records
  view.setUint32(pos + 12, centralDirSize, true); // Size of central directory
  view.setUint32(pos + 16, centralDirOffset, true); // Offset of start of central directory
  view.setUint16(pos + 20, 0, true); // Comment length

  return out;
}

/**
 * Pemetaan indeks style di xl/styles.xml:
 * 0 = Default
 * 1 = Header (Dark Slate #0F172A, Teks Putih Bold, Rata Tengah/Kiri, Border)
 * 2 = Data Teks Reguler (Rata Atas, Wrap Text, Border Tipis)
 * 3 = Angka / Harga Format Ribuan (#,##0, Rata Kanan, Border Tipis)
 * 4 = Teks Muted / Abu-abu (untuk ID / Slug, Border Tipis)
 */
function getStyleIndex(style?: ExcelCell["style"]): number {
  switch (style) {
    case "header":
      return 1;
    case "currency":
    case "number":
      return 3;
    case "muted":
      return 4;
    case "data":
    case "badge":
    default:
      return 2;
  }
}

function buildWorksheetXml(sheet: ExcelWorksheet): string {
  const colsXml = sheet.columns
    .map(
      (col, idx) =>
        `<col min="${idx + 1}" max="${idx + 1}" width="${col.width}" customWidth="1"/>`
    )
    .join("");

  // Baris 1 adalah Header
  const headerCellsXml = sheet.columns
    .map((col, colIdx) => {
      const cellRef = `${getExcelColumnLetter(colIdx)}1`;
      return `<c r="${cellRef}" t="inlineStr" s="1"><is><t xml:space="preserve">${escapeXml(
        col.header
      )}</t></is></c>`;
    })
    .join("");

  const dataRowsXml = sheet.rows
    .map((row, rowIdx) => {
      const excelRowNumber = rowIdx + 2;
      const cellsXml = row
        .map((cell, colIdx) => {
          const cellRef = `${getExcelColumnLetter(colIdx)}${excelRowNumber}`;
          const styleIdx = getStyleIndex(cell.style);

          if (cell.value === null || cell.value === undefined || cell.value === "") {
            return `<c r="${cellRef}" s="${styleIdx}"/>`;
          }

          if (cell.type === "number" || typeof cell.value === "number") {
            const numVal = Number(cell.value);
            if (Number.isFinite(numVal)) {
              return `<c r="${cellRef}" s="${styleIdx}"><v>${numVal}</v></c>`;
            }
          }

          const strVal = String(cell.value);
          return `<c r="${cellRef}" t="inlineStr" s="${styleIdx}"><is><t xml:space="preserve">${escapeXml(
            strVal
          )}</t></is></c>`;
        })
        .join("");

      return `<row r="${excelRowNumber}" ht="22" customHeight="1">${cellsXml}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews>
    <sheetView tabSelected="1" workbookViewId="0">
      <pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>
    </sheetView>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="20"/>
  <cols>${colsXml}</cols>
  <sheetData>
    <row r="1" ht="28" customHeight="1">${headerCellsXml}</row>
    ${dataRowsXml}
  </sheetData>
</worksheet>`;
}

function buildStylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1">
    <numFmt numFmtId="164" formatCode="#,##0"/>
  </numFmts>
  <fonts count="4">
    <font>
      <sz val="10"/>
      <color rgb="FF0F172A"/>
      <name val="Calibri"/>
    </font>
    <font>
      <b/>
      <sz val="10"/>
      <color rgb="FFFFFFFF"/>
      <name val="Calibri"/>
    </font>
    <font>
      <sz val="10"/>
      <color rgb="FF0F172A"/>
      <name val="Calibri"/>
    </font>
    <font>
      <sz val="9"/>
      <color rgb="FF64748B"/>
      <name val="Calibri"/>
    </font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill>
      <patternFill patternType="solid">
        <fgColor rgb="FF0F172A"/>
        <bgColor indexed="64"/>
      </patternFill>
    </fill>
  </fills>
  <borders count="2">
    <border>
      <left/><right/><top/><bottom/><diagonal/>
    </border>
    <border>
      <left style="thin"><color rgb="FFE2E8F0"/></left>
      <right style="thin"><color rgb="FFE2E8F0"/></right>
      <top style="thin"><color rgb="FFE2E8F0"/></top>
      <bottom style="thin"><color rgb="FFE2E8F0"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="5">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment vertical="center" wrapText="1"/>
    </xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment vertical="top" wrapText="1"/>
    </xf>
    <xf numFmtId="164" fontId="2" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="top"/>
    </xf>
    <xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment vertical="top"/>
    </xf>
  </cellXfs>
</styleSheet>`;
}

/**
 * Menghasilkan byte array file .xlsx dari daftar worksheet
 */
export function generateXlsxBytes(sheets: ExcelWorksheet[]): Uint8Array {
  const contentTypesSheetOverrides = sheets
    .map(
      (_, idx) =>
        `<Override PartName="/xl/worksheets/sheet${
          idx + 1
        }.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    )
    .join("\n  ");

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${contentTypesSheetOverrides}
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookSheetsXml = sheets
    .map((s, idx) => {
      const safeSheetName = escapeXml(s.name.slice(0, 31));
      return `<sheet name="${safeSheetName}" sheetId="${idx + 1}" r:id="rId${
        idx + 1
      }"/>`;
    })
    .join("\n    ");

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    ${workbookSheetsXml}
  </sheets>
</workbook>`;

  const workbookRelsItems = sheets
    .map(
      (_, idx) =>
        `<Relationship Id="rId${
          idx + 1
        }" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${
          idx + 1
        }.xml"/>`
    )
    .join("\n  ");

  const stylesRelId = `rId${sheets.length + 1}`;
  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${workbookRelsItems}
  <Relationship Id="${stylesRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const files: { path: string; content: string }[] = [
    { path: "[Content_Types].xml", content: contentTypesXml },
    { path: "_rels/.rels", content: rootRelsXml },
    { path: "xl/workbook.xml", content: workbookXml },
    { path: "xl/_rels/workbook.xml.rels", content: workbookRelsXml },
    { path: "xl/styles.xml", content: buildStylesXml() },
  ];

  sheets.forEach((sheet, idx) => {
    files.push({
      path: `xl/worksheets/sheet${idx + 1}.xml`,
      content: buildWorksheetXml(sheet),
    });
  });

  return createZipArchive(files);
}

/**
 * Mengonversi daftar Produk & Kategori menjadi struktur Worksheet Excel lengkap
 * (Siap untuk di-download maupun di-upload kembali pada fitur Bulk Upload)
 */
export function buildProductCatalogWorksheets(
  products: Product[],
  categories: Category[],
  options?: { isTemplateOnly?: boolean }
): ExcelWorksheet[] {
  const isTemplate = Boolean(options?.isTemplateOnly);

  const columns: { header: string; width: number }[] = [
    { header: "Link Produk", width: 38 },
    { header: "Slug URL", width: 30 },
    { header: "Nama Produk *", width: 38 },
    { header: "Kategori", width: 18 },
    { header: "Status (published/draft)", width: 22 },
    { header: "Harga Yuan (¥)", width: 16 },
    { header: "Pengali Kurs (Rp/¥)", width: 20 },
    { header: "Berat Riil (Gram)", width: 18 },
    { header: "Berat Tagihan Jastip (Gram)", width: 26 },
    { header: "Tarif Ongkir/KG (Rp)", width: 20 },
    { header: "Harga Jual Final (Rp)", width: 22 },
    { header: "Deskripsi Produk", width: 45 },
  ];

  const rows: ExcelCell[][] = [];

  if (isTemplate) {
    // Contoh baris 1: Produk Tas / Umum (Hitungan rumus otomatis dengan Yuan & Berat)
    const sampleCategory = categories[0]?.name || "Bag";
    rows.push([
      { value: "https://item.taobao.com/item.htm?id=...", style: "muted" },
      { value: "", style: "muted" }, // Kosongkan slug untuk produk baru
      { value: "CONTOH: Songmont Small Yore Hobo Bag", style: "data" },
      { value: sampleCategory, style: "data" },
      { value: "draft", style: "data" },
      { value: 1580, type: "number", style: "number" },
      { value: DEFAULT_YUAN_MULTIPLIER, type: "number", style: "number" },
      { value: 350, type: "number", style: "number" },
      { value: DEFAULT_CALC_WEIGHT_GRAMS, type: "number", style: "number" },
      { value: DEFAULT_RATE_PER_KG, type: "number", style: "currency" },
      {
        value: 1580 * DEFAULT_YUAN_MULTIPLIER + DEFAULT_RATE_PER_KG,
        type: "number",
        style: "currency",
      },
      {
        value: "Tas bahu kulit asli dengan desain minimalis dan elegan.",
        style: "data",
      },
    ]);

    // Contoh baris 2: Produk Food / Snack (Harga manual langsung all-in tanpa perlu pusing berat/kurs)
    rows.push([
      { value: "https://item.taobao.com/item.htm?id=...", style: "muted" },
      { value: "", style: "muted" }, // Kosongkan slug untuk produk baru
      { value: "CONTOH: Lays Stax Crisps China Edition (Food)", style: "data" },
      { value: "Food", style: "data" },
      { value: "draft", style: "data" },
      { value: "", style: "muted" }, // Kolom Yuan dikosongkan
      { value: "", style: "muted" }, // Kolom Kurs dikosongkan
      { value: "", style: "muted" }, // Kolom Berat Riil dikosongkan
      { value: "", style: "muted" }, // Kolom Berat Tagihan dikosongkan
      { value: "", style: "muted" }, // Kolom Tarif Ongkir dikosongkan
      {
        value: 85000,
        type: "number",
        style: "currency",
      },
      {
        value: "Keripik kentang tabung import China rasa original. Harga all-in.",
        style: "data",
      },
    ]);
  } else {
    products.forEach((product) => {
      const calcMeta = extractJastipCalcMeta(product);

      rows.push([
        { value: calcMeta.sourceUrl || "", style: "muted" },
        { value: product.slug, style: "muted" },
        { value: product.name, style: "data" },
        { value: product.categories?.name || "", style: "data" },
        { value: product.status, style: "data" },
        {
          value: calcMeta.yuanPrice > 0 ? calcMeta.yuanPrice : "",
          type: calcMeta.yuanPrice > 0 ? "number" : "string",
          style: "number",
        },
        {
          value: calcMeta.yuanMultiplier,
          type: "number",
          style: "number",
        },
        {
          value:
            calcMeta.actualWeightGrams > 0 ? calcMeta.actualWeightGrams : "",
          type: calcMeta.actualWeightGrams > 0 ? "number" : "string",
          style: "number",
        },
        {
          value: calcMeta.weightGrams,
          type: "number",
          style: "number",
        },
        {
          value: calcMeta.ratePerKg,
          type: "number",
          style: "currency",
        },
        {
          value: Number(product.price) || 0,
          type: "number",
          style: "currency",
        },
        { value: product.description || "", style: "data" },
      ]);
    });
  }

  // Sheet 2: Panduan & Daftar Kategori
  const guideSheet: ExcelWorksheet = {
    name: "Panduan & Kategori",
    columns: [
      { header: "Kolom di Sheet Data Produk", width: 32 },
      { header: "Wajib / Opsional", width: 18 },
      { header: "Penjelasan & Cara Pengisian", width: 68 },
    ],
    rows: [
      [
        { value: "Link Produk", style: "data" },
        { value: "Internal / Opsional", style: "muted" },
        {
          value:
            "Link sumber barang / toko supplier (misal: Taobao / Tmall / Website Brand) khusus untuk catatan internal admin.",
          style: "data",
        },
      ],
      [
        { value: "Slug URL", style: "data" },
        { value: "Otomatis / Unik", style: "muted" },
        {
          value:
            "Identitas unik produk (huruf kecil & tanda minus). Jangan ubah slug jika ingin meng-update produk lama. Kosongkan jika ingin menambah produk baru (slug otomatis dibuat dari Nama Produk).",
          style: "data",
        },
      ],
      [
        { value: "Nama Produk *", style: "data" },
        { value: "WAJIB", style: "data" },
        {
          value:
            "Nama lengkap produk yang akan tampil di katalog (contoh: SONG*MONT Small Yore Hobo Bag).",
          style: "data",
        },
      ],
      [
        { value: "Kategori", style: "data" },
        { value: "Opsional", style: "data" },
        {
          value: `Ketik nama kategori. Kategori yang tersedia saat ini: ${
            categories.map((c) => c.name).join(", ") || "Bag"
          }.`,
          style: "data",
        },
      ],
      [
        { value: "Status (published/draft)", style: "data" },
        { value: "Opsional", style: "data" },
        {
          value:
            "Isi 'published' agar langsung tampil di katalog publik, atau 'draft' jika ingin disembunyikan dulu.",
          style: "data",
        },
      ],
      [
        { value: "Harga Yuan (¥)", style: "data" },
        { value: "Disarankan", style: "data" },
        {
          value:
            "Harga asli barang dalam mata uang Yuan (¥). Jika diisi, Harga Jual Final (Rp) dapat dihitung otomatis.",
          style: "data",
        },
      ],
      [
        { value: "Pengali Kurs (Rp/¥)", style: "data" },
        { value: "Opsional", style: "data" },
        {
          value: `Default: ${DEFAULT_YUAN_MULTIPLIER} (Rp 2.800 per 1 Yuan).`,
          style: "data",
        },
      ],
      [
        { value: "Berat Riil (Gram)", style: "data" },
        { value: "Opsional", style: "data" },
        {
          value:
            "Berat asli fisik produk dalam satuan gram (misal: 300).",
          style: "data",
        },
      ],
      [
        { value: "Berat Tagihan Jastip (Gram)", style: "data" },
        { value: "Opsional", style: "data" },
        {
          value: `Berat yang dipakai menghitung ongkir di Kalkulator Jastip. Default tas = ${DEFAULT_CALC_WEIGHT_GRAMS} gram (1 kg). Untuk kategori Food/Snack, jika belum diketahui beratnya boleh diisi 0 (ongkir Rp 0).`,
          style: "data",
        },
      ],
      [
        { value: "Tarif Ongkir/KG (Rp)", style: "data" },
        { value: "Opsional", style: "data" },
        {
          value: `Default: ${DEFAULT_RATE_PER_KG} (Rp 220.000 per KG).`,
          style: "data",
        },
      ],
      [
        { value: "Harga Jual Final (Rp)", style: "data" },
        { value: "Otomatis / Manual", style: "data" },
        {
          value:
            "Bisa diisi manual (all-in) atau dihitung otomatis dari rumus: (Harga Yuan × Pengali Kurs) + ((Berat Tagihan / 1000) × Tarif Ongkir/KG). Khusus kategori Food/Makanan, batas minimum 200g ditiadakan (dihitung proporsional murni per gram, atau jika berat 0 gr ongkir = Rp 0).",
          style: "data",
        },
      ],
      [
        { value: "Deskripsi Produk", style: "data" },
        { value: "Opsional", style: "data" },
        {
          value: "Deskripsi lengkap produk.",
          style: "data",
        },
      ],
    ],
  };

  return [
    {
      name: isTemplate ? "Template Upload Produk" : "Data Produk",
      columns,
      rows,
    },
    guideSheet,
  ];
}

/**
 * Memicu download file .xlsx langsung di browser Admin
 */
export function downloadProductsExcel(
  products: Product[],
  categories: Category[],
  options?: { filenamePrefix?: string; isTemplateOnly?: boolean }
): void {
  const sheets = buildProductCatalogWorksheets(products, categories, {
    isTemplateOnly: options?.isTemplateOnly,
  });
  const bytes = generateXlsxBytes(sheets);

  const dateStr = new Date().toISOString().slice(0, 10);
  const prefix =
    options?.filenamePrefix ||
    (options?.isTemplateOnly
      ? "Template-Upload-Flypick-Catalog"
      : "Data-Produk-Flypick-Catalog");
  const filename = `${prefix}-${dateStr}.xlsx`;

  const blob = new Blob([bytes as unknown as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ============================================================================
// FITUR IMPORT / UPLOAD BULKY PRODUK DARI FILE EXCEL (.XLSX & .CSV)
// ============================================================================

export interface ParsedProductImportRow {
  rowIndex: number;
  sourceUrl: string;
  slug: string;
  name: string;
  categoryName: string;
  status: "published" | "draft";
  yuanPrice: number;
  yuanMultiplier: number;
  actualWeightGrams: number;
  weightGrams: number;
  ratePerKg: number;
  finalPrice: number;
  isPriceCalculated: boolean;
  description: string;
  error?: string;
}

export interface ParsedProductImportResult {
  rows: ParsedProductImportRow[];
  summary: {
    totalRows: number;
    validRows: number;
    errorRows: number;
  };
}

/**
 * Decompress buffer menggunakan Web Streams DecompressionStream (deflate-raw)
 */
async function decompressDeflateRaw(
  compressed: Uint8Array
): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error(
      "Browser tidak mendukung DecompressionStream untuk membaca file Excel (.xlsx)."
    );
  }
  const ds = new DecompressionStream("deflate-raw");
  const writer = ds.writable.getWriter();
  writer.write(compressed as unknown as BufferSource);
  writer.close();
  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
  const out = new Uint8Array(totalLen);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

/**
 * Membaca entri file dari arsip ZIP (struktur dasar file .xlsx)
 */
async function readZipEntries(
  buffer: ArrayBuffer
): Promise<Map<string, string>> {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder();
  const filesMap = new Map<string, string>();

  // Cari EOCD signature (0x06054b50) dari akhir file
  let eocdOffset = -1;
  const searchStart = Math.max(0, buffer.byteLength - 65557);
  for (let i = buffer.byteLength - 22; i >= searchStart; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    throw new Error("Format file Excel (.xlsx) tidak valid atau rusak.");
  }

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const centralDirOffset = view.getUint32(eocdOffset + 16, true);

  let curOffset = centralDirOffset;
  for (let idx = 0; idx < totalEntries; idx++) {
    if (view.getUint32(curOffset, true) !== 0x02014b50) {
      break;
    }

    const compressionMethod = view.getUint16(curOffset + 10, true);
    const compressedSize = view.getUint32(curOffset + 20, true);
    const fileNameLen = view.getUint16(curOffset + 28, true);
    const extraFieldLen = view.getUint16(curOffset + 30, true);
    const fileCommentLen = view.getUint16(curOffset + 32, true);
    const localHeaderOffset = view.getUint32(curOffset + 42, true);

    const fileNameBytes = bytes.subarray(
      curOffset + 46,
      curOffset + 46 + fileNameLen
    );
    const fileName = decoder.decode(fileNameBytes);

    curOffset += 46 + fileNameLen + extraFieldLen + fileCommentLen;

    // Baca data file dari Local Header
    if (view.getUint32(localHeaderOffset, true) === 0x04034b50) {
      const localFileNameLen = view.getUint16(localHeaderOffset + 26, true);
      const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
      const dataStart =
        localHeaderOffset + 30 + localFileNameLen + localExtraLen;
      const dataEnd = dataStart + compressedSize;
      const compressedData = bytes.subarray(dataStart, dataEnd);

      let decompressedBytes: Uint8Array;
      if (compressionMethod === 0) {
        decompressedBytes = compressedData;
      } else if (compressionMethod === 8) {
        decompressedBytes = await decompressDeflateRaw(compressedData);
      } else {
        continue;
      }

      filesMap.set(fileName, decoder.decode(decompressedBytes));
    }
  }

  return filesMap;
}

/**
 * Konversi string huruf kolom (A, B, AA) ke indeks 0-based
 */
function columnLetterToIndex(colStr: string): number {
  let index = 0;
  for (let i = 0; i < colStr.length; i++) {
    index = index * 26 + (colStr.charCodeAt(i) - 64);
  }
  return index - 1;
}

/**
 * Parsing sel ref seperti "A1", "C12" menjadi { col, row }
 */
function parseCellRef(ref: string): { col: number; row: number } {
  const match = ref.match(/^([A-Za-z]+)(\d+)$/);
  if (!match) return { col: 0, row: 0 };
  const col = columnLetterToIndex(match[1].toUpperCase());
  const row = parseInt(match[2], 10) - 1;
  return { col, row };
}

/**
 * Parsing file .xlsx menjadi array 2D baris teks
 */
async function parseXlsxToRows(buffer: ArrayBuffer): Promise<string[][]> {
  const files = await readZipEntries(buffer);

  // 1. Ambil tabel shared strings jika ada
  const sharedStrings: string[] = [];
  const sstXml =
    files.get("xl/sharedStrings.xml") || files.get("xl/SharedStrings.xml");
  if (sstXml && typeof DOMParser !== "undefined") {
    const parser = new DOMParser();
    const doc = parser.parseFromString(sstXml, "application/xml");
    const siElements = doc.getElementsByTagName("si");
    for (let i = 0; i < siElements.length; i++) {
      const si = siElements[i];
      // Teks bisa berada langsung di <t> atau dipecah dalam <r><t>
      const tElements = si.getElementsByTagName("t");
      let text = "";
      for (let j = 0; j < tElements.length; j++) {
        text += tElements[j].textContent || "";
      }
      sharedStrings.push(text);
    }
  }

  // 2. Ambil worksheet pertama
  let sheetXml =
    files.get("xl/worksheets/sheet1.xml") ||
    files.get("xl/worksheets/Sheet1.xml");
  if (!sheetXml) {
    files.forEach((val, key) => {
      if (
        !sheetXml &&
        key.startsWith("xl/worksheets/sheet") &&
        key.endsWith(".xml")
      ) {
        sheetXml = val;
      }
    });
  }

  if (!sheetXml) {
    throw new Error(
      "Tidak ditemukan worksheet data produk pada file Excel ini."
    );
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(sheetXml, "application/xml");
  const rowElements = doc.getElementsByTagName("row");

  const tableRows: string[][] = [];

  for (let rIdx = 0; rIdx < rowElements.length; rIdx++) {
    const rowEl = rowElements[rIdx];
    const rowNumAttr = rowEl.getAttribute("r");
    const parsedRowNum = rowNumAttr
      ? parseInt(rowNumAttr, 10) - 1
      : tableRows.length;

    while (tableRows.length <= parsedRowNum) {
      tableRows.push([]);
    }
    const currentRow = tableRows[parsedRowNum];

    const cElements = rowEl.getElementsByTagName("c");
    for (let cIdx = 0; cIdx < cElements.length; cIdx++) {
      const cell = cElements[cIdx];
      const cellRef = cell.getAttribute("r") || "";
      const { col } = parseCellRef(cellRef);
      const cellType = cell.getAttribute("t");

      let cellValue = "";
      if (cellType === "s") {
        // Shared String index
        const vEl = cell.getElementsByTagName("v")[0];
        const sstIdx = vEl ? parseInt(vEl.textContent || "", 10) : -1;
        cellValue = sstIdx >= 0 ? sharedStrings[sstIdx] || "" : "";
      } else if (cellType === "inlineStr") {
        const isEl = cell.getElementsByTagName("is")[0];
        cellValue = isEl?.textContent || "";
      } else {
        const vEl = cell.getElementsByTagName("v")[0];
        cellValue = vEl?.textContent || "";
      }

      while (currentRow.length <= col) {
        currentRow.push("");
      }
      currentRow[col] = cellValue.trim();
    }
  }

  // 3. Tangani sel yang di-merge / di-block (e.g. <mergeCell ref="A2:A6"/>)
  // Nilai pada sel acuan utama (kiri-atas) disalin ke seluruh baris/kolom dalam rentang merge tersebut
  const mergeElements = doc.getElementsByTagName("mergeCell");
  for (let mIdx = 0; mIdx < mergeElements.length; mIdx++) {
    const mergeEl = mergeElements[mIdx];
    const ref = mergeEl.getAttribute("ref") || "";
    if (!ref.includes(":")) continue;

    const [startRef, endRef] = ref.split(":");
    const start = parseCellRef(startRef);
    const end = parseCellRef(endRef);

    // Ambil nilai master dari sel kiri-atas blok merge
    const masterValue =
      tableRows[start.row] && tableRows[start.row][start.col] !== undefined
        ? tableRows[start.row][start.col]
        : "";

    if (!masterValue) continue;

    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);
    const minCol = Math.min(start.col, end.col);
    const maxCol = Math.max(start.col, end.col);

    for (let r = minRow; r <= maxRow; r++) {
      while (tableRows.length <= r) {
        tableRows.push([]);
      }
      for (let c = minCol; c <= maxCol; c++) {
        while (tableRows[r].length <= c) {
          tableRows[r].push("");
        }
        tableRows[r][c] = masterValue;
      }
    }
  }

  return tableRows.filter((r) => r.some((val) => val !== ""));
}

/**
 * Parsing file CSV jika admin mengunggah format CSV
 */
function parseCsvToRows(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  const firstLine = text.split(/\r?\n/)[0] || "";
  const delimiter =
    firstLine.split(";").length > firstLine.split(",").length ? ";" : ",";

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = "";
    } else if ((char === "\r" || char === "\n") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") i++;
      currentRow.push(currentCell.trim());
      if (currentRow.some((c) => c !== "")) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = "";
    } else {
      currentCell += char;
    }
  }

  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c !== "")) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Membersihkan format angka (menghapus titik ribuan, Rp, ¥, koma desimal)
 */
function cleanNumber(val: string | number | undefined | null): number {
  if (typeof val === "number") return val;
  if (!val) return 0;
  const str = String(val)
    .replace(/[Rp¥$,]/gi, "")
    .replace(/\s+/g, "")
    .trim();
  const num = parseFloat(str);
  return Number.isFinite(num) ? num : 0;
}

/**
 * Fungsi Utama: Parsing File (.xlsx / .csv) yang di-upload oleh Admin
 */
export async function parseProductImportFile(
  file: File
): Promise<ParsedProductImportResult> {
  const fileName = file.name.toLowerCase();
  let rawRows: string[][] = [];

  if (fileName.endsWith(".xlsx")) {
    const buffer = await file.arrayBuffer();
    rawRows = await parseXlsxToRows(buffer);
  } else if (fileName.endsWith(".csv") || fileName.endsWith(".txt")) {
    const text = await file.text();
    rawRows = parseCsvToRows(text);
  } else {
    throw new Error(
      "Format file tidak didukung. Harap unggah file Excel (.xlsx) atau .csv."
    );
  }

  if (rawRows.length < 2) {
    throw new Error(
      "File Excel tidak memiliki data baris produk (minimal harus ada 1 baris header dan 1 baris produk)."
    );
  }

  // Deteksi indeks kolom berdasarkan nama header (sangat fleksibel terhadap urutan kolom)
  const headers = rawRows[0].map((h) => h.toLowerCase().trim());

  let linkIdx = -1;
  let slugIdx = -1;
  let nameIdx = -1;
  let categoryIdx = -1;
  let statusIdx = -1;
  let yuanIdx = -1;
  let kursIdx = -1;
  let actualWeightIdx = -1;
  let weightIdx = -1;
  let rateIdx = -1;
  let priceIdx = -1;
  let descIdx = -1;

  headers.forEach((h, idx) => {
    if (
      linkIdx === -1 &&
      (h.includes("link") || h.includes("sumber") || h.includes("supplier") || h.includes("url sumber"))
    ) {
      linkIdx = idx;
    } else if (slugIdx === -1 && h.includes("slug")) {
      slugIdx = idx;
    } else if (
      nameIdx === -1 &&
      (h.includes("nama") || h.includes("name") || h.includes("produk") || h.includes("product")) &&
      !h.includes("link") &&
      !h.includes("id")
    ) {
      nameIdx = idx;
    } else if (categoryIdx === -1 && (h.includes("kategori") || h.includes("category"))) {
      categoryIdx = idx;
    } else if (statusIdx === -1 && h.includes("status")) {
      statusIdx = idx;
    } else if (yuanIdx === -1 && (h.includes("yuan") || h.includes("¥") || h.includes("rmb"))) {
      yuanIdx = idx;
    } else if (kursIdx === -1 && (h.includes("kurs") || h.includes("multiplier") || h.includes("pengali"))) {
      kursIdx = idx;
    } else if (actualWeightIdx === -1 && (h.includes("riil") || h.includes("actual"))) {
      actualWeightIdx = idx;
    } else if (
      weightIdx === -1 &&
      (h.includes("tagihan") || h.includes("jastip") || h.includes("berat") || h.includes("weight")) &&
      !h.includes("riil") &&
      !h.includes("actual")
    ) {
      weightIdx = idx;
    } else if (rateIdx === -1 && (h.includes("tarif") || h.includes("ongkir") || h.includes("rate"))) {
      rateIdx = idx;
    } else if (
      priceIdx === -1 &&
      (h.includes("harga jual") || h.includes("harga final") || h.includes("final") || h.includes("price") || h.includes("harga")) &&
      !h.includes("yuan") &&
      !h.includes("dasar")
    ) {
      priceIdx = idx;
    } else if (descIdx === -1 && (h.includes("deskripsi") || h.includes("desc") || h.includes("keterangan"))) {
      descIdx = idx;
    }
  });

  if (nameIdx === -1) {
    throw new Error(
      "Kolom 'Nama Produk' tidak ditemukan pada baris header file Excel."
    );
  }

  const parsedRows: ParsedProductImportRow[] = [];
  let validCount = 0;
  let errorCount = 0;

  for (let r = 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    const name = (nameIdx >= 0 ? row[nameIdx] : "")?.trim() || "";

    // Lewati baris contoh template jika ada
    if (name.toUpperCase().startsWith("CONTOH:")) {
      continue;
    }

    if (!name) {
      errorCount++;
      parsedRows.push({
        rowIndex: r + 1,
        sourceUrl: "",
        slug: "",
        name: "",
        categoryName: "",
        status: "draft",
        yuanPrice: 0,
        yuanMultiplier: DEFAULT_YUAN_MULTIPLIER,
        actualWeightGrams: 0,
        weightGrams: DEFAULT_CALC_WEIGHT_GRAMS,
        ratePerKg: DEFAULT_RATE_PER_KG,
        finalPrice: 0,
        isPriceCalculated: false,
        description: "",
        error: "Nama Produk kosong (wajib diisi).",
      });
      continue;
    }

    const sourceUrl = (linkIdx >= 0 ? row[linkIdx] : "")?.trim() || "";
    const slug = (slugIdx >= 0 ? row[slugIdx] : "")?.trim() || "";
    const categoryName =
      (categoryIdx >= 0 ? row[categoryIdx] : "")?.trim() || "";

    const rawStatus = (
      statusIdx >= 0 ? row[statusIdx] : ""
    )?.toLowerCase().trim();
    const status: "published" | "draft" =
      rawStatus === "published" || rawStatus === "publish"
        ? "published"
        : "draft";

    const yuanPrice = cleanNumber(yuanIdx >= 0 ? row[yuanIdx] : 0);
    const yuanMultiplier =
      cleanNumber(kursIdx >= 0 ? row[kursIdx] : 0) || DEFAULT_YUAN_MULTIPLIER;
    const actualWeightGrams = cleanNumber(
      actualWeightIdx >= 0 ? row[actualWeightIdx] : 0
    );
    const hasExplicitWeight =
      weightIdx >= 0 &&
      row[weightIdx] !== undefined &&
      row[weightIdx].trim() !== "";
    const isFoodCategory = isSub200gCategory(categoryName);
    const isBagCategory =
      categoryName.toLowerCase().includes("bag") ||
      categoryName.toLowerCase().includes("tas");

    const weightGrams = hasExplicitWeight
      ? cleanNumber(row[weightIdx])
      : isBagCategory
      ? DEFAULT_CALC_WEIGHT_GRAMS
      : 0;

    const ratePerKg =
      cleanNumber(rateIdx >= 0 ? row[rateIdx] : 0) || DEFAULT_RATE_PER_KG;

    let finalPrice = cleanNumber(priceIdx >= 0 ? row[priceIdx] : 0);
    let isPriceCalculated = false;

    // Otomatis hitung harga jual jika kolom harga final kosong tapi harga Yuan ada
    if (finalPrice <= 0 && yuanPrice > 0) {
      const { finalPrice: calcPrice } = computeJastipFinalPrice(
        {
          weightGrams,
          yuanPrice,
          yuanMultiplier,
          ratePerKg,
        },
        { allowSub200g: isFoodCategory }
      );
      finalPrice = calcPrice;
      isPriceCalculated = true;
    }

    const description = (descIdx >= 0 ? row[descIdx] : "")?.trim() || "";

    validCount++;
    parsedRows.push({
      rowIndex: r + 1,
      sourceUrl,
      slug,
      name,
      categoryName,
      status,
      yuanPrice,
      yuanMultiplier,
      actualWeightGrams,
      weightGrams,
      ratePerKg,
      finalPrice,
      isPriceCalculated,
      description,
    });
  }

  return {
    rows: parsedRows,
    summary: {
      totalRows: parsedRows.length,
      validRows: validCount,
      errorRows: errorCount,
    },
  };
}

