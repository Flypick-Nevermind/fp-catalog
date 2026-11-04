import { Category, Product } from "@/types/database";
import {
  DEFAULT_CALC_WEIGHT_GRAMS,
  DEFAULT_RATE_PER_KG,
  DEFAULT_YUAN_MULTIPLIER,
  extractJastipCalcMeta,
  getPublicAttributes,
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
    // Contoh baris pengisian untuk Template Kosong
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
          value: `Berat yang dipakai menghitung ongkir di Kalkulator Jastip. Default tas = ${DEFAULT_CALC_WEIGHT_GRAMS} gram (1 kg).`,
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
            "Rumus otomatis: (Harga Yuan × Pengali Kurs) + ((Berat Tagihan / 1000) × Tarif Ongkir/KG).",
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

