import { Product, ProductAttribute } from "@/types/database";

export const DEFAULT_RATE_PER_KG = 220000; // Rp 220.000 / kg
export const DEFAULT_PROXY_COST_PER_KG = 200000; // Rp 200.000 / kg biaya proxy
export const DEFAULT_YUAN_MULTIPLIER = 2800; // Rp 2.800 / ¥
export const DEFAULT_CALC_WEIGHT_GRAMS = 1000; // Default 1.000 gram (1 kg) untuk kalkulator Jastip
export const MIN_CHARGEABLE_KG = 0.2; // Minimum 200 gram (0,2 kg)
export const INTERNAL_CALC_ATTR_KEY = "__jastip_calc";

export interface JastipCalcMeta {
  useAutoCalc: boolean;
  actualWeightGrams: number; // Berat riil barang (gram) sesuai spesifikasi Weight
  weightGrams: number; // Berat tagihan di kalkulator Jastip (default 1000 gr = 1 kg)
  yuanPrice: number;
  yuanMultiplier: number;
  ratePerKg: number;
  sourceUrl?: string; // Link sumber barang internal admin (Taobao / Brand / Supplier)
}

/**
 * Mengecek apakah sebuah atribut adalah metadata internal sistem (diawali "__")
 * sehingga tidak ditampilkan di tabel Spesifikasi Produk publik maupun baris form.
 */
export function isInternalAttribute(attr: ProductAttribute): boolean {
  if (!attr || typeof attr.key !== "string") return false;
  return (
    attr.key === INTERNAL_CALC_ATTR_KEY || attr.key.trim().startsWith("__")
  );
}

/**
 * Mengambil hanya atribut spesifikasi produk yang ditujukan untuk tampilan publik / form spesifikasi.
 */
export function getPublicAttributes(
  attributes?: ProductAttribute[] | null
): ProductAttribute[] {
  if (!Array.isArray(attributes)) return [];
  return attributes.filter((attr) => !isInternalAttribute(attr));
}

/**
 * Mengekstrak angka berat riil dalam gram dari atribut spesifikasi "Weight" / "Berat".
 * Mengembalikan 0 jika belum diisi oleh admin.
 */
export function extractSpecWeightGrams(
  attributes?: ProductAttribute[] | null
): number {
  const publicAttrs = getPublicAttributes(attributes);
  const weightAttr = publicAttrs.find((a) => {
    const k = a.key.toLowerCase();
    return k.includes("weight") || k.includes("berat");
  });
  if (!weightAttr || !weightAttr.value) return 0;

  const val = weightAttr.value.toLowerCase();
  const numMatch = val.match(/(\d+([.,]\d+)?)/);
  if (!numMatch) return 0;

  const parsed = parseFloat(numMatch[1].replace(",", "."));
  if (val.includes("kg") && !val.includes("gr")) {
    return Math.round(parsed * 1000);
  }
  return Math.round(parsed);
}

/**
 * Menghitung rincian harga jual Jastip berdasarkan rumus resmi:
 * Harga Jual Final = (Harga Yuan * Pengali Kurs) + (max(berat_kg, 0.2) * Tarif/kg)
 */
export function computeJastipFinalPrice(
  meta: Pick<
    JastipCalcMeta,
    "weightGrams" | "yuanPrice" | "yuanMultiplier" | "ratePerKg"
  >
) {
  const safeGrams = Math.max(0, Number(meta.weightGrams) || 0);
  const actualKg = safeGrams / 1000;
  const chargeableKg = Math.max(actualKg, MIN_CHARGEABLE_KG);
  const isMinWeightApplied = actualKg < MIN_CHARGEABLE_KG;

  const safeYuan = Math.max(0, Number(meta.yuanPrice) || 0);
  const safeMultiplier = Math.max(0, Number(meta.yuanMultiplier) || 0);
  const safeRatePerKg = Math.max(0, Number(meta.ratePerKg) || 0);

  const baseItemPrice = Math.round(safeYuan * safeMultiplier);
  const shippingCost = Math.round(chargeableKg * safeRatePerKg);
  const finalPrice = Math.round(baseItemPrice + shippingCost);

  const proxyShippingCost = Math.round(
    chargeableKg * DEFAULT_PROXY_COST_PER_KG
  );
  const shippingMargin = shippingCost - proxyShippingCost;

  return {
    actualKg,
    chargeableKg,
    isMinWeightApplied,
    baseItemPrice,
    shippingCost,
    finalPrice,
    shippingMargin,
  };
}

/**
 * Membaca data Kalkulator Jastip dari produk.
 * Urutan prioritas:
 * 1. Kolom khusus di tabel `products` (`yuan_price`, `weight_grams`, `actual_weight_grams`, `yuan_multiplier`, `rate_per_kg`)
 * 2. Metadata cadangan `__jastip_calc` di `attributes` (jika kolom DB belum dimigrasi)
 * 3. Deteksi cerdas dari `price` untuk produk lama
 * 4. Default produk baru: `weightGrams = 1000` (1 kg), `yuanMultiplier = 2800`, `ratePerKg = 220000`
 */
export function extractJastipCalcMeta(
  product?: Product | null
): JastipCalcMeta {
  const specWeightGrams = extractSpecWeightGrams(product?.attributes);

  // Jika sedang Tambah Produk Baru (!product), default weightGrams = 1000 (1 kg)
  if (!product) {
    return {
      useAutoCalc: true,
      actualWeightGrams: 0,
      weightGrams: DEFAULT_CALC_WEIGHT_GRAMS,
      yuanPrice: 0,
      yuanMultiplier: DEFAULT_YUAN_MULTIPLIER,
      ratePerKg: DEFAULT_RATE_PER_KG,
      sourceUrl: "",
    };
  }

  const dbActualWeight =
    typeof product.actual_weight_grams === "number" &&
    product.actual_weight_grams > 0
      ? product.actual_weight_grams
      : specWeightGrams;

  // Cek apakah ada metadata cadangan di `attributes` (`__jastip_calc`) untuk mengambil sourceUrl jika kolom DB belum dimigrasi
  let fallbackParsed: Partial<JastipCalcMeta> | null = null;
  if (product.attributes && Array.isArray(product.attributes)) {
    const rawMetaAttr = product.attributes.find(
      (a) => a.key === INTERNAL_CALC_ATTR_KEY
    );
    if (rawMetaAttr?.value) {
      try {
        fallbackParsed = JSON.parse(rawMetaAttr.value) as Partial<JastipCalcMeta>;
      } catch {
        // ignore
      }
    }
  }

  const resolvedSourceUrl =
    (typeof product.source_url === "string" && product.source_url.trim()) ||
    (typeof fallbackParsed?.sourceUrl === "string" &&
      fallbackParsed.sourceUrl.trim()) ||
    "";

  // 1. Cek apakah kolom khusus di tabel `products` sudah memiliki nilai yuan_price > 0
  if (
    typeof product.yuan_price === "number" &&
    Number(product.yuan_price) > 0
  ) {
    return {
      useAutoCalc: true,
      actualWeightGrams: dbActualWeight,
      weightGrams:
        typeof product.weight_grams === "number" && product.weight_grams > 0
          ? product.weight_grams
          : DEFAULT_CALC_WEIGHT_GRAMS,
      yuanPrice: Number(product.yuan_price),
      yuanMultiplier:
        typeof product.yuan_multiplier === "number" &&
        Number(product.yuan_multiplier) > 0
          ? Number(product.yuan_multiplier)
          : DEFAULT_YUAN_MULTIPLIER,
      ratePerKg:
        typeof product.rate_per_kg === "number" &&
        Number(product.rate_per_kg) > 0
          ? Number(product.rate_per_kg)
          : DEFAULT_RATE_PER_KG,
      sourceUrl: resolvedSourceUrl,
    };
  }

  // 2. Cek metadata cadangan di `attributes` (`__jastip_calc`)
  if (fallbackParsed) {
    return {
      useAutoCalc:
        typeof fallbackParsed.useAutoCalc === "boolean"
          ? fallbackParsed.useAutoCalc
          : true,
      actualWeightGrams:
        typeof fallbackParsed.actualWeightGrams === "number" &&
        fallbackParsed.actualWeightGrams > 0
          ? fallbackParsed.actualWeightGrams
          : dbActualWeight,
      weightGrams:
        typeof fallbackParsed.weightGrams === "number" &&
        fallbackParsed.weightGrams > 0
          ? fallbackParsed.weightGrams
          : DEFAULT_CALC_WEIGHT_GRAMS,
      yuanPrice:
        typeof fallbackParsed.yuanPrice === "number" &&
        fallbackParsed.yuanPrice >= 0
          ? fallbackParsed.yuanPrice
          : 0,
      yuanMultiplier:
        typeof fallbackParsed.yuanMultiplier === "number" &&
        fallbackParsed.yuanMultiplier > 0
          ? fallbackParsed.yuanMultiplier
          : DEFAULT_YUAN_MULTIPLIER,
      ratePerKg:
        typeof fallbackParsed.ratePerKg === "number" &&
        fallbackParsed.ratePerKg >= 0
          ? fallbackParsed.ratePerKg
          : DEFAULT_RATE_PER_KG,
      sourceUrl: resolvedSourceUrl,
    };
  }

  // 3. Fallback cerdas untuk produk lama di database:
  const price = Number(product.price || 0);
  if (price > 0) {
    const candidateWeights: number[] = [];
    // Utamakan 1000g (1 kg) dan berat spesifikasi terlebih dahulu
    candidateWeights.push(DEFAULT_CALC_WEIGHT_GRAMS);
    const minCheckedSpec = Math.max(specWeightGrams || 200, 200);
    if (!candidateWeights.includes(minCheckedSpec)) {
      candidateWeights.push(minCheckedSpec);
    }

    for (let w = 200; w <= 5000; w += 50) {
      if (!candidateWeights.includes(w)) {
        candidateWeights.push(w);
      }
    }

    candidateWeights.sort(
      (a, b) => Math.abs(a - minCheckedSpec) - Math.abs(b - minCheckedSpec)
    );

    for (const rate of [DEFAULT_RATE_PER_KG, 240000]) {
      for (const w of candidateWeights) {
        const chargeableKg = Math.max(w / 1000, MIN_CHARGEABLE_KG);
        const shipping = Math.round(chargeableKg * rate);
        const remaining = price - shipping;
        if (remaining > 0 && remaining % DEFAULT_YUAN_MULTIPLIER === 0) {
          const inferredYuan = remaining / DEFAULT_YUAN_MULTIPLIER;
          return {
            useAutoCalc: true,
            actualWeightGrams: dbActualWeight,
            weightGrams: w,
            yuanPrice: inferredYuan,
            yuanMultiplier: DEFAULT_YUAN_MULTIPLIER,
            ratePerKg: rate,
            sourceUrl: resolvedSourceUrl,
          };
        }
      }
    }
  }

  return {
    useAutoCalc: true,
    actualWeightGrams: dbActualWeight,
    weightGrams:
      typeof product.weight_grams === "number" && product.weight_grams > 0
        ? product.weight_grams
        : DEFAULT_CALC_WEIGHT_GRAMS,
    yuanPrice: 0,
    yuanMultiplier: DEFAULT_YUAN_MULTIPLIER,
    ratePerKg: DEFAULT_RATE_PER_KG,
    sourceUrl: resolvedSourceUrl,
  };
}

/**
 * Menyisipkan metadata cadangan ke dalam array attributes (jika kolom DB belum dimigrasi).
 */
export function attachJastipCalcMeta(
  publicAttributes: ProductAttribute[],
  meta: JastipCalcMeta
): ProductAttribute[] {
  const cleaned = getPublicAttributes(publicAttributes);
  return [
    ...cleaned,
    {
      key: INTERNAL_CALC_ATTR_KEY,
      value: JSON.stringify({
        useAutoCalc: Boolean(meta.useAutoCalc),
        actualWeightGrams: Number(meta.actualWeightGrams) || 0,
        weightGrams: Number(meta.weightGrams) || DEFAULT_CALC_WEIGHT_GRAMS,
        yuanPrice: Number(meta.yuanPrice) || 0,
        yuanMultiplier: Number(meta.yuanMultiplier) || DEFAULT_YUAN_MULTIPLIER,
        ratePerKg: Number(meta.ratePerKg) || DEFAULT_RATE_PER_KG,
        sourceUrl: (meta.sourceUrl || "").trim(),
      }),
    },
  ];
}
