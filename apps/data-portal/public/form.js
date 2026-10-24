const strings = {
  fa: {
    skip: "رفتن به فرم",
    brand: "متو",
    title: "به کامل شدن اطلاعات مترو کمک کن",
    intro:
      "برنامهٔ حرکت، عکس تابلو یا اطلاعات ایستگاهت رو بفرست. نیازی به ساختن حساب نیست.",
    city: "شهر",
    mashhad: "مشهد",
    tehran: "تهران",
    other: "شهر دیگر",
    kind: "نوع اطلاعات",
    timetable: "زمان حرکت قطارها",
    amenities: "امکانات ایستگاه",
    station: "نام، مکان یا وضعیت ایستگاه",
    otherInfo: "اطلاعات دیگر",
    line: "خط یا ایستگاه (اختیاری)",
    details: "اطلاعاتت",
    hint: "مثلاً جهت حرکت، روزها و ساعت‌ها، تاریخ اطلاعات و پیوند منبع. می‌تونی به‌جای نوشتن، عکس بفرستی.",
    photo: "عکس تابلو یا ایستگاه (اختیاری)",
    photoHint:
      "یک عکس تا ۸ مگابایت. می‌تونی پیوند عکس رو هم در بخش اطلاعات بنویسی.",
    contactHeading: "راه تماس برای پیگیری (اختیاری)",
    contactNote:
      "اگه دوست داری دربارهٔ اطلاعاتت باهات تماس بگیریم، این بخش رو پر کن. نام و راه تماست عمومی نمی‌شه.",
    name: "نام (اختیاری)",
    contact: "ایمیل یا شناسهٔ تماس (اختیاری)",
    review:
      "اطلاعات و عکست برای بررسی در یک گزارش عمومی گیت‌هاب ثبت می‌شه؛ نام و راه تماست خصوصی می‌مونه. حساب لازم نیست.",
    send: "فرستادن اطلاعات",
    sending: "در حال فرستادن…",
    thanks: "ممنون! اطلاعاتت برای بررسی فرستاده شد.",
    another: "فرستادن اطلاعات دیگر",
    back: "برگشت به متو",
    github: "پروژه در گیت‌هاب",
    empty: "اطلاعاتت رو بنویس یا یک عکس اضافه کن.",
    photoError:
      "این عکس قابل استفاده نیست. یک عکس JPG، PNG یا WebP تا ۸ مگابایت انتخاب کن، یا پیوندش رو بنویس.",
    network:
      "فرستاده نشد. اتصال اینترنتت رو بررسی کن و دوباره امتحان کن؛ اطلاعاتت هنوز توی فرم هست.",
    busy: "در حال حاضر امکان دریافت اطلاعات نیست. لطفاً کمی بعد دوباره امتحان کن؛ اطلاعاتت هنوز توی فرم هست.",
    limited: "چند بار پشت سر هم فرستادی. لطفاً کمی بعد دوباره امتحان کن.",
    receipt: "کد پیگیری: ",
  },
  en: {
    skip: "Skip to form",
    brand: "metto",
    title: "Help improve metro information",
    intro:
      "Send a timetable, a station-board photo or a correction. No account needed.",
    city: "City",
    mashhad: "Mashhad",
    tehran: "Tehran",
    other: "Another city",
    kind: "Information type",
    timetable: "Train times",
    amenities: "Station amenities",
    station: "Station name, location or status",
    otherInfo: "Other information",
    line: "Line or station (optional)",
    details: "Your information",
    hint: "For example: direction, operating days and times, when the information was current, and a source link. You can send a photo instead of writing.",
    photo: "Station or timetable photo (optional)",
    photoHint:
      "One photo, up to 8 MB. You can also paste a photo link in the information field.",
    contactHeading: "Contact for follow-up (optional)",
    contactNote:
      "Fill this in only if you want us to contact you about your information. Your name and contact details stay private.",
    name: "Name (optional)",
    contact: "Email or contact handle (optional)",
    review:
      "Your information and photo will appear in a public GitHub issue for review. Your name and contact details stay private. No account is needed.",
    send: "Send information",
    sending: "Sending…",
    thanks: "Thank you! Your information was sent for review.",
    another: "Send more information",
    back: "Back to metto",
    github: "Project on GitHub",
    empty: "Write some information or add a photo.",
    photoError:
      "Choose a JPG, PNG or WebP photo up to 8 MB, or paste a link instead.",
    network:
      "Not sent. Check your connection and try again; your information is still in the form.",
    busy: "We cannot receive information right now. Please try again later; your information is still in the form.",
    limited:
      "You have sent several submissions recently. Please try again later.",
    receipt: "Reference: ",
  },
};
const form = document.querySelector("form"),
  status = document.querySelector("#status"),
  send = document.querySelector("#send");
const query = new URLSearchParams(location.search);
let lang = query.get("lang") === "en" ? "en" : "fa",
  pending = false,
  previewUrl = null,
  lastPayload = null,
  submissionId = null,
  errorKey = null,
  receiptId = null;
function applyLanguage() {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "fa" ? "rtl" : "ltr";
  document.title = `${strings[lang].title} | metto`;
  document
    .querySelectorAll("[data-i18n]")
    .forEach((el) => (el.textContent = strings[lang][el.dataset.i18n]));
  const button = document.querySelector("#language");
  button.textContent = lang === "fa" ? "English" : "فارسی";
  button.lang = lang === "fa" ? "en" : "fa";
  if (pending) send.textContent = strings[lang].sending;
  if (errorKey) status.textContent = strings[lang][errorKey];
  if (receiptId)
    document.querySelector("#receipt").textContent =
      strings[lang].receipt + receiptId;
}
applyLanguage();
document.querySelector("#language").addEventListener("click", () => {
  lang = lang === "fa" ? "en" : "fa";
  query.set("lang", lang);
  history.replaceState(null, "", `?${query}`);
  applyLanguage();
});
for (const name of ["city", "kind"]) {
  const value = query.get(name) ?? (name === "kind" ? query.get("type") : null);
  if ([...form.elements[name].options].some((o) => o.value === value))
    form.elements[name].value = value;
}
function showError(key) {
  errorKey = key;
  status.className = "error";
  status.textContent = strings[lang][key];
  status.setAttribute("role", "alert");
  status.focus();
}
form.elements.photo.addEventListener("change", () => {
  const image = document.querySelector("#photo-preview");
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  const file = form.elements.photo.files[0];
  if (
    file &&
    ["image/jpeg", "image/png", "image/webp"].includes(file.type) &&
    file.size <= 8 * 1024 * 1024
  ) {
    previewUrl = URL.createObjectURL(file);
    image.src = previewUrl;
    image.hidden = false;
  } else {
    image.hidden = true;
    if (file) showError("photoError");
  }
});
async function photoPayload(file) {
  if (!file?.size) return undefined;
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 8 * 1024 * 1024
  )
    throw new Error("photo");
  const source = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = source;
    await image.decode();
    const canvas = document.createElement("canvas");
    const scale = Math.min(
      1,
      2048 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    let blob;
    for (const quality of [0.85, 0.75, 0.65, 0.55]) {
      blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
      );
      if (blob && blob.size <= 512 * 1024) break;
    }
    if (!blob || blob.size > 512 * 1024) throw new Error("photo");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192)
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return { mimeType: "image/jpeg", data: btoa(binary) };
  } catch {
    throw new Error("photo");
  } finally {
    URL.revokeObjectURL(source);
  }
}
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (pending) return;
  const fields = new FormData(form);
  if (
    !String(fields.get("details") ?? "").trim() &&
    !form.elements.photo.files[0]
  ) {
    showError("empty");
    return;
  }
  pending = true;
  send.disabled = true;
  send.textContent = strings[lang].sending;
  status.textContent = "";
  errorKey = null;
  status.setAttribute("role", "status");
  try {
    if (
      typeof window.METTO_CONTRIBUTIONS_ENDPOINT !== "string" ||
      !window.METTO_CONTRIBUTIONS_ENDPOINT
    )
      throw new Error("busy");
    const photo = await photoPayload(form.elements.photo.files[0]);
    const fieldsPayload = {
      city: fields.get("city"),
      kind: fields.get("kind"),
      station: String(fields.get("station") ?? "").trim(),
      details: String(fields.get("details") ?? "").trim(),
      name: String(fields.get("name") ?? "").trim(),
      contact: String(fields.get("contact") ?? "").trim(),
      website: fields.get("website"),
      ...(photo ? { photo } : {}),
    };
    const fingerprint = JSON.stringify(fieldsPayload);
    if (fingerprint !== lastPayload) {
      submissionId = crypto.randomUUID();
      lastPayload = fingerprint;
    }
    const payload = { id: submissionId, ...fieldsPayload };
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 30000);
    let response;
    try {
      response = await fetch(window.METTO_CONTRIBUTIONS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "omit",
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok)
      throw new Error(
        response.status === 429
          ? "limited"
          : response.status === 400 || response.status === 413
            ? "photo"
            : "busy",
      );
    const result = await response.json();
    if (!result.id) throw new Error("busy");
    form.hidden = true;
    document.querySelector("#success").hidden = false;
    receiptId = result.id;
    document.querySelector("#receipt").textContent =
      strings[lang].receipt + receiptId;
    document.querySelector("#success").focus();
  } catch (error) {
    showError(
      error.message === "photo"
        ? "photoError"
        : ["limited", "busy"].includes(error.message)
          ? error.message
          : "network",
    );
  } finally {
    pending = false;
    send.disabled = false;
    send.textContent = strings[lang].send;
  }
});
document.querySelector("#another").addEventListener("click", () => {
  form.reset();
  lastPayload = null;
  submissionId = null;
  receiptId = null;
  errorKey = null;
  status.textContent = "";
  document.querySelector("#photo-preview").hidden = true;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  form.hidden = false;
  document.querySelector("#success").hidden = true;
  form.elements.city.focus();
});
