// =====================================================
// NOONRAY PAYSLIP MODULE (add-on)
// -----------------------------------------------------
// Self-contained: does not modify any existing function in app.js.
// - Admin  : maintains salary reference, generates & issues payslips
//            on the company letterhead, manages letterhead settings.
// - Employee: views / downloads only their own issued payslips.
//
// Firestore collections used (new, separate from existing data):
//   payslip_reference/{employeeSlug}  -> salary structure per employee
//   payslips/{employeeSlug}_{YYYY-MM} -> issued payslips
//   payslip_settings/config           -> letterhead image + layout
// =====================================================

import { db, collection, getDocs, getDoc, doc, deleteDoc, serverTimestamp, query, where } from "./firebase.js";
import { setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const PAGE = window.location.pathname.split("/").pop();
const HTML2PDF_URL = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";

const EARNINGS = [
    ["basic", "Basic Salary"],
    ["hra", "House Rent Allowance"],
    ["conveyance", "Conveyance Allowance"],
    ["special", "Special Allowance"],
    ["otherEarn", "Other Allowance"]
];
// prorated = reduced in proportion to paid days (LOP)
const DEDUCTIONS = [
    ["pf", "Provident Fund (PF)", true],
    ["esi", "ESI", true],
    ["pt", "Professional Tax", false],
    ["tds", "Income Tax (TDS)", false],
    ["otherDed", "Other Deductions", false]
];
const DETAILS = [
    ["empId", "Employee ID"],
    ["designation", "Designation"],
    ["department", "Department"],
    ["doj", "Date of Joining", "date"],
    ["location", "Work Location"],
    ["pan", "PAN"],
    ["uan", "UAN / PF No."],
    ["bankName", "Bank Name"],
    ["bankAcc", "Bank A/c No."]
];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const DEFAULT_SETTINGS = {
    letterhead: "",
    companyName: "NoonRay",
    topMm: 45,
    bottomMm: 30,
    sideMm: 18,
    signatoryName: "",
    signatoryTitle: "Authorised Signatory",
    footerNote: "This is a computer-generated payslip and does not require a signature."
};

// ---------------- helpers ----------------
const $ = (id) => document.getElementById(id);
const getUser = () => { try { return JSON.parse(sessionStorage.getItem("loggedInUser")); } catch (e) { return null; } };
const isAdmin = () => getUser()?.role === "admin";
const slug = (name) => String(name || "").trim().replace(/[^a-zA-Z0-9]+/g, "_");
const num = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const money = (n) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const daysInMonth = (ym) => { const [y, m] = ym.split("-").map(Number); return new Date(y, m, 0).getDate(); };
const monthLabel = (ym) => { if (!ym) return ""; const [y, m] = ym.split("-").map(Number); return `${MONTHS[m - 1]} ${y}`; };
const fmtDate = (s) => { if (!s) return "-"; const d = new Date(s); return isNaN(d) ? s : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); };
const tsToDate = (ts) => ts?.toDate ? ts.toDate() : (ts?.seconds ? new Date(ts.seconds * 1000) : null);

function previousMonth() {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function amountInWords(amount) {
    const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
        "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
    const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
    const two = (n) => n < 20 ? a[n] : b[Math.floor(n / 10)] + (n % 10 ? " " + a[n % 10] : "");
    const three = (n) => { const h = Math.floor(n / 100), r = n % 100; return (h ? a[h] + " Hundred" + (r ? " " : "") : "") + (r ? two(r) : ""); };
    const words = (n) => {
        if (n === 0) return "Zero";
        let out = "";
        const crore = Math.floor(n / 10000000); n %= 10000000;
        const lakh = Math.floor(n / 100000); n %= 100000;
        const thousand = Math.floor(n / 1000); n %= 1000;
        if (crore) out += words(crore) + " Crore ";
        if (lakh) out += two(lakh) + " Lakh ";
        if (thousand) out += two(thousand) + " Thousand ";
        if (n) out += three(n);
        return out.trim();
    };
    const rupees = Math.floor(Math.abs(amount));
    const paise = Math.round((Math.abs(amount) - rupees) * 100);
    return `Rupees ${words(rupees)}${paise ? " and " + two(paise) + " Paise" : ""} Only`;
}

function loadHtml2Pdf() {
    if (window.html2pdf) return Promise.resolve();
    return new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = HTML2PDF_URL;
        s.onload = resolve;
        s.onerror = () => reject(new Error("Could not load the PDF library. Check your internet connection."));
        document.head.appendChild(s);
    });
}

// ---------------- settings (letterhead) ----------------
let settingsCache = null;
let fallbackLetterhead = null; // letterhead.png placed in the project folder (optional)

function probeFallbackLetterhead() {
    return new Promise((resolve) => {
        if (fallbackLetterhead !== null) return resolve(fallbackLetterhead);
        const img = new Image();
        img.onload = () => { fallbackLetterhead = "letterhead.png"; resolve(fallbackLetterhead); };
        img.onerror = () => { fallbackLetterhead = ""; resolve(""); };
        img.src = "letterhead.png?v=" + Date.now();
    });
}

async function loadSettings(force = false) {
    if (settingsCache && !force) return settingsCache;
    let data = {};
    try {
        const snap = await getDoc(doc(db, "payslip_settings", "config"));
        if (snap.exists()) data = snap.data();
    } catch (e) { console.error("Payslip settings load failed", e); }
    settingsCache = { ...DEFAULT_SETTINGS, ...data };
    if (!settingsCache.letterhead) settingsCache.letterheadFallback = await probeFallbackLetterhead();
    return settingsCache;
}

function letterheadSrc(s) { return s.letterhead || s.letterheadFallback || ""; }

// Shrink the uploaded letterhead so it fits inside a Firestore document (< 1 MB)
function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Could not read file"));
        reader.onload = () => {
            const img = new Image();
            img.onerror = () => reject(new Error("Not a valid image"));
            img.onload = () => {
                const maxW = 1240; // A4 width at 150 dpi
                const scale = Math.min(1, maxW / img.width);
                const canvas = document.createElement("canvas");
                canvas.width = Math.round(img.width * scale);
                canvas.height = Math.round(img.height * scale);
                const ctx = canvas.getContext("2d");
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                let q = 0.9, out = canvas.toDataURL("image/jpeg", q);
                while (out.length > 900000 && q > 0.4) { q -= 0.1; out = canvas.toDataURL("image/jpeg", q); }
                if (out.length > 1000000) return reject(new Error("Image is too large even after compression"));
                resolve(out);
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}

// ---------------- data ----------------
async function loadReferences() {
    const map = {};
    const snap = await getDocs(collection(db, "payslip_reference"));
    snap.forEach(d => { map[d.data().employee] = { id: d.id, ...d.data() }; });
    return map;
}

function employeeNames(refs = {}) {
    const names = new Set();
    document.querySelectorAll("#employeeSelect option").forEach(o => { if (o.value) names.add(o.value); });
    Object.keys(refs).forEach(n => names.add(n));
    return Array.from(names);
}

// Build the payslip record from a reference + month inputs
function computePayslip(ref, opts) {
    const dim = daysInMonth(opts.month);
    const lop = Math.min(Math.max(num(opts.lop), 0), dim);
    const paid = dim - lop;
    const ratio = dim ? paid / dim : 1;

    const earnings = EARNINGS.map(([k, label]) => ({ label, amount: Math.round(num(ref[k]) * ratio) }));
    if (num(opts.bonus) > 0) earnings.push({ label: opts.bonusLabel || "Bonus / Incentive / Arrears", amount: Math.round(num(opts.bonus)) });

    const deductions = DEDUCTIONS.map(([k, label, pro]) => ({ label, amount: Math.round(num(ref[k]) * (pro ? ratio : 1)) }));
    if (num(opts.recovery) > 0) deductions.push({ label: opts.recoveryLabel || "Advance / Other Recovery", amount: Math.round(num(opts.recovery)) });

    const gross = earnings.reduce((s, e) => s + e.amount, 0);
    const totalDed = deductions.reduce((s, d) => s + d.amount, 0);

    const details = {};
    DETAILS.forEach(([k]) => details[k] = ref[k] || "");

    return {
        employee: ref.employee,
        slug: slug(ref.employee),
        month: opts.month,
        monthLabel: monthLabel(opts.month),
        details,
        earnings: earnings.filter((e, i) => i === 0 || e.amount > 0),
        deductions: deductions.filter(d => d.amount > 0),
        gross,
        totalDed,
        net: gross - totalDed,
        daysInMonth: dim,
        lopDays: lop,
        paidDays: paid,
        remarks: opts.remarks || ""
    };
}

// ---------------- payslip page (A4 on letterhead) ----------------
function payslipPageHTML(p, s) {
    const lh = letterheadSrc(s);
    const rows = Math.max(p.earnings.length, p.deductions.length);
    let body = "";
    for (let i = 0; i < rows; i++) {
        const e = p.earnings[i], d = p.deductions[i];
        body += `<tr>
            <td>${e ? esc(e.label) : ""}</td><td class="ps-amt">${e ? money(e.amount) : ""}</td>
            <td>${d ? esc(d.label) : ""}</td><td class="ps-amt">${d ? money(d.amount) : ""}</td>
        </tr>`;
    }
    const det = p.details || {};
    const cell = (label, value) => `<div class="ps-kv"><span>${label}</span><strong>${esc(value) || "-"}</strong></div>`;

    return `
    <div class="ps-page">
        ${lh ? `<img class="ps-letterhead" src="${lh}" alt="">` : ""}
        <div class="ps-content" style="padding:${num(s.topMm)}mm ${num(s.sideMm)}mm ${num(s.bottomMm)}mm ${num(s.sideMm)}mm;">
            ${lh ? "" : `<div class="ps-nolh">${esc(s.companyName)}</div>`}
            <div class="ps-title">PAYSLIP FOR THE MONTH OF ${esc(p.monthLabel).toUpperCase()}</div>

            <div class="ps-grid">
                ${cell("Employee Name", p.employee)}
                ${cell("Employee ID", det.empId)}
                ${cell("Designation", det.designation)}
                ${cell("Department", det.department)}
                ${cell("Date of Joining", det.doj ? fmtDate(det.doj) : "")}
                ${cell("Work Location", det.location)}
                ${cell("PAN", det.pan)}
                ${cell("UAN / PF No.", det.uan)}
                ${cell("Bank Name", det.bankName)}
                ${cell("Bank A/c No.", det.bankAcc)}
            </div>

            <div class="ps-days">
                <div><span>Days in Month</span><strong>${p.daysInMonth}</strong></div>
                <div><span>LOP Days</span><strong>${p.lopDays}</strong></div>
                <div><span>Paid Days</span><strong>${p.paidDays}</strong></div>
            </div>

            <table class="ps-table">
                <thead><tr><th>Earnings</th><th class="ps-amt">Amount (INR)</th><th>Deductions</th><th class="ps-amt">Amount (INR)</th></tr></thead>
                <tbody>${body}</tbody>
                <tfoot><tr>
                    <td>Gross Earnings</td><td class="ps-amt">${money(p.gross)}</td>
                    <td>Total Deductions</td><td class="ps-amt">${money(p.totalDed)}</td>
                </tr></tfoot>
            </table>

            <div class="ps-net">
                <div><span>NET PAY</span><strong>INR ${money(p.net)}</strong></div>
                <p>${esc(amountInWords(p.net))}</p>
            </div>

            ${p.remarks ? `<p class="ps-remarks"><strong>Remarks:</strong> ${esc(p.remarks)}</p>` : ""}

            <div class="ps-sign">
                <p class="ps-note">${esc(s.footerNote)}</p>
                <div class="ps-signbox">
                    ${s.signatoryName ? `<strong>${esc(s.signatoryName)}</strong>` : ""}
                    <span>${esc(s.signatoryTitle)}</span>
                </div>
            </div>
        </div>
    </div>`;
}

async function renderPreview(containerId, p) {
    const s = await loadSettings();
    const box = $(containerId);
    if (box) box.innerHTML = `<div class="ps-page-scroll">${payslipPageHTML(p, s)}</div>`;
}

async function downloadPayslipPDF(p) {
    try {
        await loadHtml2Pdf();
        const s = await loadSettings();
        const holder = document.createElement("div");
        holder.style.cssText = "position:fixed; left:-10000px; top:0; z-index:-1;";
        holder.innerHTML = payslipPageHTML(p, s);
        document.body.appendChild(holder);
        const img = holder.querySelector("img");
        if (img && !img.complete) await new Promise(r => { img.onload = r; img.onerror = r; });

        await window.html2pdf().set({
            margin: 0,
            filename: `Payslip_${slug(p.employee)}_${p.month}.pdf`,
            image: { type: "jpeg", quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
            jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
            pagebreak: { mode: ["avoid-all"] }
        }).from(holder.firstElementChild).save();

        holder.remove();
    } catch (e) {
        console.error(e);
        alert(e.message || "PDF download failed.");
    }
}

// =====================================================
// ADMIN UI
// =====================================================
const adminState = { refs: {}, issued: [], current: null, tab: "generate" };

function adminShell() {
    return `
    <div class="ps-head">
        <h2><i class="fa-solid fa-file-invoice-dollar" style="color:#22c55e; margin-right:8px;"></i> Payslips</h2>
        <div class="ps-tabs">
            <button class="ps-tab" data-tab="generate"><i class="fa-solid fa-gears"></i> Generate</button>
            <button class="ps-tab" data-tab="reference"><i class="fa-solid fa-sack-dollar"></i> Salary Reference</button>
            <button class="ps-tab" data-tab="issued"><i class="fa-solid fa-folder-open"></i> Issued Payslips</button>
            <button class="ps-tab" data-tab="settings"><i class="fa-solid fa-stamp"></i> Letterhead &amp; Settings</button>
        </div>
    </div>

    <!-- GENERATE -->
    <section class="ps-section" data-section="generate">
        <div class="card">
            <h3><i class="fa-solid fa-gears" style="color:#3b82f6; margin-right:8px;"></i> Generate Payslip</h3>
            <p class="ps-hint">Pick an employee and month. Amounts come from their Salary Reference; earnings, PF and ESI are pro-rated for LOP days.</p>
            <div class="ps-form-grid">
                <div><label class="label">Employee</label><select class="input status-select" id="psGenEmployee"></select></div>
                <div><label class="label">Pay Month</label><input type="month" class="input" id="psGenMonth"></div>
                <div><label class="label">LOP Days</label><input type="number" class="input" id="psGenLop" min="0" step="0.5" value="0"></div>
                <div><label class="label">Bonus / Incentive / Arrears (INR)</label><input type="number" class="input" id="psGenBonus" min="0" value="0"></div>
                <div><label class="label">Advance / Other Recovery (INR)</label><input type="number" class="input" id="psGenRecovery" min="0" value="0"></div>
                <div><label class="label">Remarks (optional)</label><input class="input" id="psGenRemarks" placeholder="Shown on the payslip"></div>
            </div>
            <p id="psGenMsg" class="ps-msg"></p>
            <div class="ps-actions">
                <button class="btn" style="background:#10b981;" id="psGenSaveBtn"><i class="fa-solid fa-paper-plane"></i> Save &amp; Issue to Employee</button>
                <button class="btn" style="background:#2563eb;" id="psGenPdfBtn"><i class="fa-solid fa-file-pdf"></i> Download PDF</button>
                <button class="btn" style="background:#8b5cf6;" id="psGenBulkBtn"><i class="fa-solid fa-layer-group"></i> Generate for All (this month)</button>
            </div>
        </div>
        <div class="card">
            <h3><i class="fa-regular fa-eye" style="color:#eab308; margin-right:8px;"></i> Preview</h3>
            <div id="psGenPreview"><p class="ps-hint">Select an employee to see the preview.</p></div>
        </div>
    </section>

    <!-- REFERENCE -->
    <section class="ps-section" data-section="reference">
        <div class="card">
            <h3><i class="fa-solid fa-sack-dollar" style="color:#22c55e; margin-right:8px;"></i> Salary Reference (monthly)</h3>
            <p class="ps-hint">Set once per employee. These details and monthly amounts are used every time a payslip is generated. Only admins can see or edit this.</p>
            <label class="label">Employee</label>
            <select class="input status-select" id="psRefEmployee" style="max-width:420px;"></select>

            <h4 class="ps-subhead">Employee Details</h4>
            <div class="ps-form-grid" id="psRefDetails"></div>

            <div class="ps-two-col">
                <div>
                    <h4 class="ps-subhead" style="color:#34d399;">Earnings (full month)</h4>
                    <div id="psRefEarnings"></div>
                </div>
                <div>
                    <h4 class="ps-subhead" style="color:#f87171;">Deductions (full month)</h4>
                    <div id="psRefDeductions"></div>
                </div>
            </div>

            <div class="ps-summary" id="psRefSummary"></div>
            <div class="ps-actions">
                <button class="btn" style="background:#10b981;" id="psRefSaveBtn"><i class="fa-solid fa-floppy-disk"></i> Save Reference</button>
            </div>
        </div>
        <div class="card">
            <h3><i class="fa-solid fa-list" style="color:#8b5cf6; margin-right:8px;"></i> Saved References</h3>
            <table class="task-table">
                <thead><tr><th>Employee</th><th>Emp ID</th><th>Designation</th><th>Gross</th><th>Deductions</th><th>Net</th><th>Actions</th></tr></thead>
                <tbody id="psRefTable"></tbody>
            </table>
        </div>
    </section>

    <!-- ISSUED -->
    <section class="ps-section" data-section="issued">
        <div class="card">
            <div class="ps-row-between">
                <h3 style="margin:0;"><i class="fa-solid fa-folder-open" style="color:#06b6d4; margin-right:8px;"></i> Issued Payslips</h3>
                <div style="display:flex; gap:10px; align-items:center;">
                    <label class="label" style="margin:0;">Month</label>
                    <input type="month" class="input" id="psIssuedMonth" style="width:200px; margin:0;">
                    <button class="btn cancel-btn" id="psIssuedClear">All</button>
                </div>
            </div>
            <table class="task-table" style="margin-top:18px;">
                <thead><tr><th>Employee</th><th>Month</th><th>Gross</th><th>Deductions</th><th>Net Pay</th><th>Issued On</th><th>Actions</th></tr></thead>
                <tbody id="psIssuedTable"></tbody>
            </table>
        </div>
        <div class="card" id="psIssuedPreviewCard" style="display:none;">
            <div class="ps-row-between">
                <h3 style="margin:0;"><i class="fa-regular fa-eye" style="color:#eab308; margin-right:8px;"></i> <span id="psIssuedPreviewTitle"></span></h3>
                <button class="btn" style="background:#2563eb;" id="psIssuedPdfBtn"><i class="fa-solid fa-file-pdf"></i> Download PDF</button>
            </div>
            <div id="psIssuedPreview" style="margin-top:18px;"></div>
        </div>
    </section>

    <!-- SETTINGS -->
    <section class="ps-section" data-section="settings">
        <div class="card">
            <h3><i class="fa-solid fa-stamp" style="color:#f59e0b; margin-right:8px;"></i> Company Letterhead</h3>
            <p class="ps-hint">Upload the company letter pad as an image (PNG or JPG, full A4 page with header and footer). If it is a PDF or Word file, export the page as an image first. Payslip text is placed between the header and footer using the spacing below.</p>
            <div class="ps-two-col">
                <div>
                    <label class="label">Letterhead Image</label>
                    <input type="file" class="input" id="psLhFile" accept="image/png,image/jpeg">
                    <p id="psLhStatus" class="ps-hint" style="margin-top:8px;"></p>
                    <div class="ps-form-grid" style="grid-template-columns:repeat(3,1fr);">
                        <div><label class="label">Header space (mm)</label><input type="number" class="input" id="psSetTop" min="0" max="150"></div>
                        <div><label class="label">Footer space (mm)</label><input type="number" class="input" id="psSetBottom" min="0" max="150"></div>
                        <div><label class="label">Side margin (mm)</label><input type="number" class="input" id="psSetSide" min="0" max="60"></div>
                    </div>
                    <label class="label">Company Name (used only if no letterhead)</label>
                    <input class="input" id="psSetCompany">
                    <div class="ps-form-grid" style="grid-template-columns:1fr 1fr;">
                        <div><label class="label">Signatory Name</label><input class="input" id="psSetSignName" placeholder="Optional"></div>
                        <div><label class="label">Signatory Title</label><input class="input" id="psSetSignTitle"></div>
                    </div>
                    <label class="label">Footer Note</label>
                    <input class="input" id="psSetNote">
                    <div class="ps-actions">
                        <button class="btn" style="background:#10b981;" id="psSetSaveBtn"><i class="fa-solid fa-floppy-disk"></i> Save Settings</button>
                        <button class="btn delete-btn" id="psLhRemoveBtn"><i class="fa-solid fa-trash"></i> Remove Letterhead</button>
                    </div>
                </div>
                <div>
                    <label class="label">Sample on Letterhead</label>
                    <div id="psSetPreview"></div>
                </div>
            </div>
        </div>
    </section>`;
}

function samplePayslip() {
    return computePayslip({
        employee: "Sample Employee", empId: "NR-000", designation: "Engineer", department: "Engineering",
        doj: "2026-01-01", location: "Chennai", pan: "ABCDE1234F", uan: "100000000000", bankName: "Bank", bankAcc: "XXXXXX1234",
        basic: 25000, hra: 10000, conveyance: 1600, special: 8400, pf: 1800, pt: 200
    }, { month: previousMonth(), lop: 0 });
}

async function adminRender() {
    const view = $("adminPayslipView");
    if (!view) return;
    if (!isAdmin()) { view.innerHTML = `<div class="card"><p>Payslip management is available to admins only.</p></div>`; return; }

    if (!view.dataset.ready) {
        view.innerHTML = adminShell();
        view.dataset.ready = "1";
        bindAdmin();
    }
    try {
        adminState.refs = await loadReferences();
    } catch (e) { console.error(e); alert("Could not load salary references."); }
    await loadSettings(true);
    fillEmployeeSelects();
    showTab(adminState.tab);
}

function fillEmployeeSelects() {
    const names = employeeNames(adminState.refs);
    ["psGenEmployee", "psRefEmployee"].forEach(id => {
        const sel = $(id);
        if (!sel) return;
        const keep = sel.value;
        sel.innerHTML = `<option value="">-- Select employee --</option>` + names.map(n =>
            `<option value="${esc(n)}">${esc(n)}${adminState.refs[n] ? "" : (id === "psGenEmployee" ? "  (no reference)" : "")}</option>`).join("");
        if (keep && names.includes(keep)) sel.value = keep;
    });
}

function showTab(tab) {
    adminState.tab = tab;
    document.querySelectorAll("#adminPayslipView .ps-tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
    document.querySelectorAll("#adminPayslipView .ps-section").forEach(s => s.style.display = s.dataset.section === tab ? "block" : "none");
    if (tab === "generate") genUpdate();
    if (tab === "reference") { refLoadForm(); refRenderTable(); }
    if (tab === "issued") issuedRender();
    if (tab === "settings") settingsFill();
}

function bindAdmin() {
    document.querySelectorAll("#adminPayslipView .ps-tab").forEach(b => b.addEventListener("click", () => showTab(b.dataset.tab)));

    // generate
    $("psGenMonth").value = previousMonth();
    ["psGenEmployee", "psGenMonth", "psGenLop", "psGenBonus", "psGenRecovery", "psGenRemarks"].forEach(id =>
        $(id).addEventListener("input", genUpdate));
    $("psGenSaveBtn").addEventListener("click", genSave);
    $("psGenPdfBtn").addEventListener("click", () => {
        if (!adminState.current) return alert("Select an employee with a salary reference first.");
        downloadPayslipPDF(adminState.current);
    });
    $("psGenBulkBtn").addEventListener("click", genBulk);

    // reference
    $("psRefDetails").innerHTML = DETAILS.map(([k, label, type]) =>
        `<div><label class="label">${label}</label><input class="input" type="${type || "text"}" data-ref="${k}"></div>`).join("");
    const amtRow = ([k, label]) => `<div class="ps-amt-row"><label>${label}</label><input class="input" type="number" min="0" step="1" data-ref="${k}" value="0"></div>`;
    $("psRefEarnings").innerHTML = EARNINGS.map(amtRow).join("");
    $("psRefDeductions").innerHTML = DEDUCTIONS.map(amtRow).join("");
    $("psRefEmployee").addEventListener("change", refLoadForm);
    document.querySelectorAll("#adminPayslipView [data-ref]").forEach(i => i.addEventListener("input", refSummary));
    $("psRefSaveBtn").addEventListener("click", refSave);

    // issued
    $("psIssuedMonth").addEventListener("change", issuedRender);
    $("psIssuedClear").addEventListener("click", () => { $("psIssuedMonth").value = ""; issuedRender(); });
    $("psIssuedPdfBtn").addEventListener("click", () => { if (adminState.issuedCurrent) downloadPayslipPDF(adminState.issuedCurrent); });

    // settings
    ["psSetTop", "psSetBottom", "psSetSide", "psSetCompany", "psSetSignName", "psSetSignTitle", "psSetNote"].forEach(id =>
        $(id).addEventListener("input", settingsPreview));
    $("psLhFile").addEventListener("change", settingsPickFile);
    $("psSetSaveBtn").addEventListener("click", settingsSave);
    $("psLhRemoveBtn").addEventListener("click", settingsRemoveLetterhead);
}

// ---------- generate ----------
function genOptions() {
    return {
        month: $("psGenMonth").value,
        lop: $("psGenLop").value,
        bonus: $("psGenBonus").value,
        recovery: $("psGenRecovery").value,
        remarks: $("psGenRemarks").value.trim()
    };
}

let genTimer = null;
function genUpdate() {
    clearTimeout(genTimer);
    genTimer = setTimeout(async () => {
        const name = $("psGenEmployee").value;
        const opts = genOptions();
        const msg = $("psGenMsg");
        adminState.current = null;
        msg.textContent = "";
        if (!name) { $("psGenPreview").innerHTML = `<p class="ps-hint">Select an employee to see the preview.</p>`; return; }
        if (!opts.month) { msg.textContent = "Choose the pay month."; return; }
        const ref = adminState.refs[name];
        if (!ref) {
            msg.innerHTML = `No salary reference for <strong>${esc(name)}</strong> yet. Add it under <a href="#" id="psGoRef">Salary Reference</a>.`;
            $("psGoRef").onclick = (e) => { e.preventDefault(); $("psRefEmployee").value = name; showTab("reference"); };
            $("psGenPreview").innerHTML = "";
            return;
        }
        if (num(opts.lop) > daysInMonth(opts.month)) { msg.textContent = "LOP days cannot exceed the days in the month."; }
        adminState.current = computePayslip(ref, opts);
        try {
            const existing = await getDoc(doc(db, "payslips", `${slug(name)}_${opts.month}`));
            if (existing.exists()) msg.innerHTML = `A payslip for ${esc(monthLabel(opts.month))} was already issued to this employee. Saving again will replace it.`;
        } catch (e) { /* ignore */ }
        renderPreview("psGenPreview", adminState.current);
    }, 150);
}

async function savePayslipRecord(p) {
    const user = getUser();
    await setDoc(doc(db, "payslips", `${p.slug}_${p.month}`), {
        ...p,
        status: "issued",
        generatedBy: user?.name || "Admin",
        generatedAt: serverTimestamp()
    });
}

async function genSave() {
    if (!isAdmin()) return;
    const p = adminState.current;
    if (!p) return alert("Select an employee with a salary reference first.");
    const btn = $("psGenSaveBtn");
    try {
        const existing = await getDoc(doc(db, "payslips", `${p.slug}_${p.month}`));
        if (existing.exists() && !confirm(`A payslip for ${p.employee} (${p.monthLabel}) already exists. Replace it?`)) return;
        btn.disabled = true;
        await savePayslipRecord(p);
        alert(`Payslip for ${p.employee} (${p.monthLabel}) issued. The employee can now view it.`);
        genUpdate();
    } catch (e) {
        console.error(e);
        alert("Failed to save payslip.");
    } finally { btn.disabled = false; }
}

async function genBulk() {
    if (!isAdmin()) return;
    const month = $("psGenMonth").value;
    if (!month) return alert("Choose the pay month first.");
    const refs = Object.values(adminState.refs);
    if (!refs.length) return alert("No salary references saved yet.");
    if (!confirm(`Generate ${monthLabel(month)} payslips for all ${refs.length} employees with a salary reference?\n\nLOP = 0, no bonus. Payslips already issued for this month are skipped (regenerate them individually if needed).`)) return;

    const btn = $("psGenBulkBtn");
    btn.disabled = true;
    let created = 0, skipped = 0, failed = 0;
    for (const ref of refs) {
        try {
            const id = `${slug(ref.employee)}_${month}`;
            const existing = await getDoc(doc(db, "payslips", id));
            if (existing.exists()) { skipped++; continue; }
            await savePayslipRecord(computePayslip(ref, { month, lop: 0 }));
            created++;
        } catch (e) { console.error(e); failed++; }
    }
    btn.disabled = false;
    alert(`${monthLabel(month)}: ${created} issued, ${skipped} already existed${failed ? `, ${failed} failed` : ""}.`);
    genUpdate();
}

// ---------- reference ----------
function refReadForm() {
    const data = {};
    document.querySelectorAll("#adminPayslipView [data-ref]").forEach(i => {
        data[i.dataset.ref] = i.type === "number" ? num(i.value) : i.value.trim();
    });
    return data;
}

function refLoadForm() {
    const name = $("psRefEmployee").value;
    const ref = adminState.refs[name] || {};
    document.querySelectorAll("#adminPayslipView [data-ref]").forEach(i => {
        const v = ref[i.dataset.ref];
        i.value = i.type === "number" ? (v ?? 0) : (v ?? "");
    });
    refSummary();
}

function refTotals(r) {
    const gross = EARNINGS.reduce((s, [k]) => s + num(r[k]), 0);
    const ded = DEDUCTIONS.reduce((s, [k]) => s + num(r[k]), 0);
    return { gross, ded, net: gross - ded };
}

function refSummary() {
    const t = refTotals(refReadForm());
    $("psRefSummary").innerHTML = `
        <div><span>Monthly Gross</span><strong>INR ${money(t.gross)}</strong></div>
        <div><span>Monthly Deductions</span><strong>INR ${money(t.ded)}</strong></div>
        <div><span>Monthly Net</span><strong style="color:#34d399;">INR ${money(t.net)}</strong></div>`;
}

async function refSave() {
    if (!isAdmin()) return;
    const name = $("psRefEmployee").value;
    if (!name) return alert("Select an employee.");
    const data = refReadForm();
    const btn = $("psRefSaveBtn");
    btn.disabled = true;
    try {
        await setDoc(doc(db, "payslip_reference", slug(name)), {
            ...data,
            employee: name,
            updatedBy: getUser()?.name || "Admin",
            updatedAt: serverTimestamp()
        });
        adminState.refs[name] = { id: slug(name), employee: name, ...data };
        fillEmployeeSelects();
        refRenderTable();
        alert(`Salary reference saved for ${name}.`);
    } catch (e) {
        console.error(e);
        alert("Failed to save reference.");
    } finally { btn.disabled = false; }
}

function refRenderTable() {
    const tb = $("psRefTable");
    const refs = Object.values(adminState.refs).sort((a, b) => a.employee.localeCompare(b.employee));
    if (!refs.length) { tb.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#94a3b8;">No salary references yet.</td></tr>`; return; }
    tb.innerHTML = refs.map(r => {
        const t = refTotals(r);
        return `<tr>
            <td><strong>${esc(r.employee)}</strong></td><td>${esc(r.empId) || "-"}</td><td>${esc(r.designation) || "-"}</td>
            <td>${money(t.gross)}</td><td>${money(t.ded)}</td><td style="color:#34d399; font-weight:600;">${money(t.net)}</td>
            <td>
                <button class="action-btn edit-btn" data-edit="${esc(r.employee)}"><i class="fa-solid fa-pen"></i> Edit</button>
                <button class="action-btn delete-btn" data-del="${esc(r.employee)}"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>`;
    }).join("");
    tb.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => {
        $("psRefEmployee").value = b.dataset.edit; refLoadForm(); window.scrollTo({ top: 0, behavior: "smooth" });
    });
    tb.querySelectorAll("[data-del]").forEach(b => b.onclick = async () => {
        const n = b.dataset.del;
        if (!confirm(`Delete the salary reference for ${n}? Already issued payslips are not affected.`)) return;
        try {
            await deleteDoc(doc(db, "payslip_reference", slug(n)));
            delete adminState.refs[n];
            fillEmployeeSelects(); refRenderTable(); refLoadForm();
        } catch (e) { console.error(e); alert("Delete failed."); }
    });
}

// ---------- issued ----------
async function issuedRender() {
    const tb = $("psIssuedTable");
    tb.innerHTML = `<tr><td colspan="7" style="text-align:center;">Loading...</td></tr>`;
    try {
        const month = $("psIssuedMonth").value;
        const q = month ? query(collection(db, "payslips"), where("month", "==", month)) : collection(db, "payslips");
        const snap = await getDocs(q);
        const list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.month || "").localeCompare(a.month || "") || (a.employee || "").localeCompare(b.employee || ""));
        adminState.issued = list;
        if (!list.length) { tb.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#94a3b8;">No payslips issued${month ? " for " + esc(monthLabel(month)) : ""}.</td></tr>`; return; }
        tb.innerHTML = list.map((p, i) => {
            const on = tsToDate(p.generatedAt);
            return `<tr>
                <td><strong>${esc(p.employee)}</strong></td><td>${esc(p.monthLabel)}</td>
                <td>${money(p.gross)}</td><td>${money(p.totalDed)}</td><td style="color:#34d399; font-weight:600;">${money(p.net)}</td>
                <td>${on ? on.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-"}</td>
                <td>
                    <button class="action-btn" style="background:#eab308;" data-view="${i}">View</button>
                    <button class="action-btn" style="background:#3b82f6;" data-pdf="${i}"><i class="fa-solid fa-download"></i></button>
                    <button class="action-btn delete-btn" data-del="${i}"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>`;
        }).join("");
        tb.querySelectorAll("[data-view]").forEach(b => b.onclick = () => {
            const p = adminState.issued[b.dataset.view];
            adminState.issuedCurrent = p;
            $("psIssuedPreviewCard").style.display = "block";
            $("psIssuedPreviewTitle").textContent = `${p.employee} — ${p.monthLabel}`;
            renderPreview("psIssuedPreview", p);
            $("psIssuedPreviewCard").scrollIntoView({ behavior: "smooth" });
        });
        tb.querySelectorAll("[data-pdf]").forEach(b => b.onclick = () => downloadPayslipPDF(adminState.issued[b.dataset.pdf]));
        tb.querySelectorAll("[data-del]").forEach(b => b.onclick = async () => {
            const p = adminState.issued[b.dataset.del];
            if (!confirm(`Delete the ${p.monthLabel} payslip of ${p.employee}? The employee will no longer see it.`)) return;
            try { await deleteDoc(doc(db, "payslips", p.id)); $("psIssuedPreviewCard").style.display = "none"; issuedRender(); }
            catch (e) { console.error(e); alert("Delete failed."); }
        });
    } catch (e) {
        console.error(e);
        tb.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#ef4444;">Error loading payslips.</td></tr>`;
    }
}

// ---------- settings ----------
let pendingLetterhead = undefined; // undefined = unchanged, "" = remove, dataURL = new

function settingsFromForm() {
    const s = settingsCache || DEFAULT_SETTINGS;
    return {
        ...s,
        letterhead: pendingLetterhead !== undefined ? pendingLetterhead : s.letterhead,
        topMm: num($("psSetTop").value),
        bottomMm: num($("psSetBottom").value),
        sideMm: num($("psSetSide").value),
        companyName: $("psSetCompany").value.trim(),
        signatoryName: $("psSetSignName").value.trim(),
        signatoryTitle: $("psSetSignTitle").value.trim(),
        footerNote: $("psSetNote").value.trim()
    };
}

function settingsFill() {
    const s = settingsCache || DEFAULT_SETTINGS;
    pendingLetterhead = undefined;
    $("psLhFile").value = "";
    $("psSetTop").value = s.topMm;
    $("psSetBottom").value = s.bottomMm;
    $("psSetSide").value = s.sideMm;
    $("psSetCompany").value = s.companyName;
    $("psSetSignName").value = s.signatoryName;
    $("psSetSignTitle").value = s.signatoryTitle;
    $("psSetNote").value = s.footerNote;
    $("psLhStatus").textContent = s.letterhead ? "Letterhead uploaded." :
        (s.letterheadFallback ? "Using letterhead.png from the project folder." : "No letterhead uploaded yet.");
    settingsPreview();
}

function settingsPreview() {
    const s = settingsFromForm();
    $("psSetPreview").innerHTML = `<div class="ps-thumb">${payslipPageHTML(samplePayslip(), s)}</div>`;
}

async function settingsPickFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    $("psLhStatus").textContent = "Processing image...";
    try {
        pendingLetterhead = await compressImage(file);
        $("psLhStatus").textContent = "New letterhead ready. Click Save Settings to apply.";
        settingsPreview();
    } catch (err) {
        $("psLhStatus").textContent = err.message;
        e.target.value = "";
    }
}

async function settingsSave() {
    if (!isAdmin()) return;
    const s = settingsFromForm();
    const btn = $("psSetSaveBtn");
    btn.disabled = true;
    try {
        await setDoc(doc(db, "payslip_settings", "config"), {
            letterhead: s.letterhead || "",
            companyName: s.companyName,
            topMm: s.topMm, bottomMm: s.bottomMm, sideMm: s.sideMm,
            signatoryName: s.signatoryName, signatoryTitle: s.signatoryTitle,
            footerNote: s.footerNote,
            updatedBy: getUser()?.name || "Admin",
            updatedAt: serverTimestamp()
        });
        await loadSettings(true);
        settingsFill();
        alert("Payslip settings saved.");
    } catch (e) {
        console.error(e);
        alert("Failed to save settings.");
    } finally { btn.disabled = false; }
}

function settingsRemoveLetterhead() {
    if (!confirm("Remove the uploaded letterhead? (Click Save Settings afterwards to apply.)")) return;
    pendingLetterhead = "";
    $("psLhFile").value = "";
    $("psLhStatus").textContent = "Letterhead will be removed when you save.";
    settingsPreview();
}

// =====================================================
// EMPLOYEE UI (view only)
// =====================================================
const empState = { list: [], current: null };

async function employeeRender() {
    const view = $("employeePayslipView");
    if (!view) return;
    const user = getUser();
    if (!user) return;

    view.innerHTML = `
        <div class="ps-head"><h2><i class="fa-solid fa-file-invoice-dollar" style="color:#22c55e; margin-right:8px;"></i> My Payslips</h2></div>
        <div class="card">
            <table class="task-table">
                <thead><tr><th>Month</th><th>Gross Earnings</th><th>Deductions</th><th>Net Pay</th><th>Issued On</th><th>Actions</th></tr></thead>
                <tbody id="psEmpTable"><tr><td colspan="6" style="text-align:center;">Loading...</td></tr></tbody>
            </table>
        </div>
        <div class="card" id="psEmpPreviewCard" style="display:none;">
            <div class="ps-row-between">
                <h3 style="margin:0;"><i class="fa-regular fa-eye" style="color:#eab308; margin-right:8px;"></i> <span id="psEmpPreviewTitle"></span></h3>
                <button class="btn" style="background:#2563eb;" id="psEmpPdfBtn"><i class="fa-solid fa-file-pdf"></i> Download PDF</button>
            </div>
            <div id="psEmpPreview" style="margin-top:18px;"></div>
        </div>`;

    $("psEmpPdfBtn").onclick = () => { if (empState.current) downloadPayslipPDF(empState.current); };

    const tb = $("psEmpTable");
    try {
        const snap = await getDocs(query(collection(db, "payslips"), where("employee", "==", user.name)));
        const list = [];
        snap.forEach(d => { const p = d.data(); if (p.employee === user.name && p.status !== "draft") list.push(p); });
        list.sort((a, b) => (b.month || "").localeCompare(a.month || ""));
        empState.list = list;

        if (!list.length) { tb.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#94a3b8;">No payslips have been issued to you yet.</td></tr>`; return; }
        tb.innerHTML = list.map((p, i) => {
            const on = tsToDate(p.generatedAt);
            return `<tr>
                <td><strong>${esc(p.monthLabel)}</strong></td>
                <td>${money(p.gross)}</td><td>${money(p.totalDed)}</td>
                <td style="color:#34d399; font-weight:600;">${money(p.net)}</td>
                <td>${on ? on.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-"}</td>
                <td>
                    <button class="action-btn" style="background:#eab308;" data-view="${i}">View</button>
                    <button class="action-btn" style="background:#3b82f6;" data-pdf="${i}"><i class="fa-solid fa-download"></i> PDF</button>
                </td>
            </tr>`;
        }).join("");
        tb.querySelectorAll("[data-view]").forEach(b => b.onclick = () => {
            const p = empState.list[b.dataset.view];
            empState.current = p;
            $("psEmpPreviewCard").style.display = "block";
            $("psEmpPreviewTitle").textContent = `Payslip — ${p.monthLabel}`;
            renderPreview("psEmpPreview", p);
            $("psEmpPreviewCard").scrollIntoView({ behavior: "smooth" });
        });
        tb.querySelectorAll("[data-pdf]").forEach(b => b.onclick = () => downloadPayslipPDF(empState.list[b.dataset.pdf]));
    } catch (e) {
        console.error(e);
        tb.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#ef4444;">Error loading payslips.</td></tr>`;
    }
}

// =====================================================
// SIDEBAR / VIEW HOOK (wraps the existing switchers without changing them)
// =====================================================
function showOnlyPayslipView(viewId) {
    document.querySelectorAll('main.main > div[id$="View"]').forEach(v => { v.style.display = v.id === viewId ? "block" : "none"; });
    document.querySelectorAll(".sidebar a").forEach(a => a.classList.remove("active"));
    $("payslipNavLink")?.classList.add("active");
}

const TT = window.TaskTracker;
if (TT) {
    if (PAGE === "admin.html" && typeof TT.switchAdminView === "function") {
        const original = TT.switchAdminView;
        TT.switchAdminView = function (view) {
            if (view === "payslip") {
                sessionStorage.setItem("currentAdminView", "payslip");
                showOnlyPayslipView("adminPayslipView");
                adminRender();
                return;
            }
            const pv = $("adminPayslipView");
            if (pv) pv.style.display = "none";
            return original.call(this, view);
        };
    }
    if (PAGE === "employee.html" && typeof TT.switchEmployeeView === "function") {
        const original = TT.switchEmployeeView;
        TT.switchEmployeeView = function (view) {
            if (view === "payslip") {
                sessionStorage.setItem("currentEmployeeView", "payslip");
                showOnlyPayslipView("employeePayslipView");
                employeeRender();
                return;
            }
            const pv = $("employeePayslipView");
            if (pv) pv.style.display = "none";
            return original.call(this, view);
        };
    }
} else {
    console.warn("Payslip module: TaskTracker not found. Make sure payslip.js is loaded after app.js.");
}
