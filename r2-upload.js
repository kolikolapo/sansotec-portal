// r2-upload.js
// მინი-იუტილიტი R2-ზე ატვირთვისთვის შენი Worker-ის /upload endpoint-ით.
// VISUAL/UI-ს არაფერს ცვლის. უბრალოდ ფუნქციას აჩენს window-ზე.

/**
 * გამოყენება (შემდეგ ეტაპზე გვერდში ჩავრთავთ):
 * const { publicUrl, key } = await window.uploadToR2(file, {
 *   endpoint: "https://restless-lab-c6ef.n-gogolashvili.workers.dev/upload",
 *   maxSizeMB: 20
 * });
 */

// ნაგულისხმები პარამეტრები — შეგიძლია მერე შეცვალო ინტეგრაციისას
const R2_UPLOAD_DEFAULTS = {
  endpoint: "https://restless-lab-c6ef.n-gogolashvili.workers.dev/upload",
  maxSizeMB: 20,
  allowedTypes: new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]),
};

/**
 * ატვირთავს ფაილს R2-ზე შენი Worker /upload-ის მეშვეობით
 * @param {File} file - ბრაუზერის File input-იდან
 * @param {{endpoint?: string, maxSizeMB?: number, allowedTypes?: Set<string>, signal?: AbortSignal}} opts
 * @returns {Promise<{publicUrl: string, key: string}>}
 */
async function uploadToR2(file, opts = {}) {
  const cfg = { ...R2_UPLOAD_DEFAULTS, ...opts };

  if (!file) throw new Error("ფაილი არ არის არჩეული.");
  if (!cfg.endpoint) throw new Error("R2 upload endpoint არ არის მითითებული.");

  // ზომის ჩეკი
  const maxBytes = (cfg.maxSizeMB || 20) * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error(`ფაილი ძალიან დიდია (> ${cfg.maxSizeMB}MB)`);
  }

  // ტიპის ჩეკი — ზუსტად იმავე whitelist-ით, რაც Worker-ში გაქვს
  if (!cfg.allowedTypes.has(file.type)) {
    throw new Error("ამ ტიპის ფაილების ატვირთვა ამ ეტაპზე არ არის დაშვებული.");
  }

  const fd = new FormData();
  fd.append("file", file, file.name);

  const res = await fetch(cfg.endpoint, {
    method: "POST",
    body: fd,
    signal: cfg.signal,
  });

  let data;
  try {
    data = await res.json();
  } catch {
    const t = await res.text().catch(() => "");
    throw new Error(`უცნობი პასუხი სერვერიდან (${res.status}): ${t || "—"}`);
  }

  if (!res.ok) {
    // Worker აბრუნებს { error, status, body } სტრუქტურას შეცდომაზე
    const msg = data?.error || data?.message || JSON.stringify(data);
    throw new Error(`ატვირთვა ვერ შედგა (${res.status}): ${msg}`);
  }

  if (!data?.ok || !data?.publicUrl || !data?.key) {
    throw new Error(`უცნობი პასუხი: ${JSON.stringify(data)}`);
  }

  return { publicUrl: data.publicUrl, key: data.key };
}

// გლობალურად გამოვიტანოთ, რომ შემდეგ ნაბიჯზე ნებისმიერ გვერდზე მარტივად გამოვიყენოთ
window.uploadToR2 = uploadToR2;
