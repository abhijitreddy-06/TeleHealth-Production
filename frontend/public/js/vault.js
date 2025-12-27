/* =========================
   THEME TOGGLE
========================= */
const themeToggle = document.getElementById("themeToggle");
const mobileThemeToggle = document.getElementById("mobileThemeToggle");
const html = document.documentElement;

const savedTheme =
    localStorage.getItem("theme") ||
    (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

html.setAttribute("data-theme", savedTheme);
updateThemeIcon(savedTheme);

function toggleTheme() {
    const next = html.getAttribute("data-theme") === "dark" ? "light" : "dark";
    html.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    updateThemeIcon(next);
}

function updateThemeIcon(theme) {
    const icon = theme === "dark" ? "fa-sun" : "fa-moon";
    if (themeToggle) themeToggle.innerHTML = `<i class="fas ${icon}"></i>`;
    if (mobileThemeToggle) mobileThemeToggle.innerHTML = `<i class="fas ${icon}"></i>`;
}

themeToggle?.addEventListener("click", toggleTheme);
mobileThemeToggle?.addEventListener("click", toggleTheme);

/* =========================
   MOBILE MENU
========================= */
const mobileMenuBtn = document.getElementById("mobileMenuBtn");
const closeMenuBtn = document.getElementById("closeMenu");
const mobileMenu = document.getElementById("mobileMenu");

mobileMenuBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    mobileMenu.classList.add("active");
    document.body.style.overflow = "hidden";
});

closeMenuBtn?.addEventListener("click", () => {
    mobileMenu.classList.remove("active");
    document.body.style.overflow = "auto";
});

document.addEventListener("click", (e) => {
    if (
        mobileMenu?.classList.contains("active") &&
        !mobileMenu.contains(e.target) &&
        e.target !== mobileMenuBtn
    ) {
        mobileMenu.classList.remove("active");
        document.body.style.overflow = "auto";
    }
});

/* =========================
   UPLOAD MODAL
========================= */
function openUploadModal() {
    document.getElementById("uploadModal")?.classList.add("active");
    document.body.style.overflow = "hidden";
    resetUploadForm();
}

function closeUploadModal() {
    document.getElementById("uploadModal")?.classList.remove("active");
    document.body.style.overflow = "auto";
    resetUploadForm();
}

function resetUploadForm() {
    const fileInput = document.getElementById("fileInput");
    const filePreview = document.getElementById("filePreview");

    if (fileInput) fileInput.value = "";
    if (filePreview) filePreview.classList.remove("active");

    document.getElementById("fileName").textContent = "No file selected";
    document.getElementById("fileSize").innerHTML =
        '<i class="fas fa-weight-hanging"></i> 0 KB';
    document.getElementById("fileType").innerHTML =
        '<i class="fas fa-file-alt"></i> No file type';

    const fileIcon = document.getElementById("fileIcon");
    if (fileIcon) {
        fileIcon.innerHTML = '<i class="fas fa-file"></i>';
        fileIcon.style.color = "var(--primary)";
    }
}

/* =========================
   DRAG & DROP
========================= */
const dropArea = document.getElementById("dropArea");
const fileInput = document.getElementById("fileInput");
const filePreview = document.getElementById("filePreview");

dropArea?.classList.add("active");

["dragenter", "dragover", "dragleave", "drop"].forEach((event) => {
    dropArea?.addEventListener(event, preventDefaults);
    document.body.addEventListener(event, preventDefaults);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

dropArea?.addEventListener("drop", (e) => {
    const files = e.dataTransfer.files;
    if (files.length) {
        fileInput.files = files;
        updateFilePreview(files[0]);
    }
});

fileInput?.addEventListener("change", () => {
    if (fileInput.files.length) {
        updateFilePreview(fileInput.files[0]);
    }
});

function updateFilePreview(file) {
    filePreview.classList.add("active");
    document.getElementById("fileName").textContent = file.name;

    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    document.getElementById("fileSize").innerHTML =
        `<i class="fas fa-weight-hanging"></i> ${sizeMB} MB`;

    const ext = file.name.split(".").pop().toLowerCase();
    document.getElementById("fileType").innerHTML =
        `<i class="fas fa-file-alt"></i> ${ext.toUpperCase()} File`;

    const iconMap = {
        pdf: ["fa-file-pdf", "#f40f02"],
        doc: ["fa-file-word", "#2b579a"],
        docx: ["fa-file-word", "#2b579a"],
        xls: ["fa-file-excel", "#217346"],
        xlsx: ["fa-file-excel", "#217346"],
        jpg: ["fa-file-image", "#e74c3c"],
        jpeg: ["fa-file-image", "#e74c3c"],
        png: ["fa-file-image", "#e74c3c"]
    };

    const icon = iconMap[ext] || ["fa-file", "var(--primary)"];
    const fileIcon = document.getElementById("fileIcon");
    fileIcon.innerHTML = `<i class="fas ${icon[0]}"></i>`;
    fileIcon.style.color = icon[1];
}

/* =========================
   LOAD RECORDS
========================= */
async function loadRecords() {
    try {
        const res = await fetch("/api/vault/user", {
            credentials: "include"
        });
        if (!res.ok) throw new Error("Failed");

        const records = await res.json();
        const grid = document.getElementById("recordsGrid");

        if (!records.length) {
            grid.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-folder-open"></i>
          <h3>No Records Found</h3>
          <button class="btn btn-primary" onclick="openUploadModal()">Upload</button>
        </div>
      `;
            return;
        }

        grid.innerHTML = "";
        records.forEach((r) => {
            const card = document.createElement("div");
            card.className = "record-card";
            card.innerHTML = `
        <div class="record-icon">
          <i class="fas ${getRecordIcon(r.record_type)}"></i>
        </div>
        <div class="record-info">
          <h3>${r.file_name}</h3>
          <span class="record-type">${formatRecordType(r.record_type)}</span>
          <div class="record-date">${formatDate(new Date(r.uploaded_at))}</div>
          <div class="record-actions">
            <a href="/vault/file/${r.id}" class="btn btn-primary">Download</a>
          </div>
        </div>
      `;
            grid.appendChild(card);
        });

    } catch (err) {
        console.error(err);
    }
}

/* =========================
   HELPERS
========================= */
function getRecordIcon(type) {
    return {
        prescription: "fa-prescription-bottle-alt",
        report: "fa-file-medical-alt",
        lab: "fa-flask",
        imaging: "fa-x-ray",
        insurance: "fa-file-invoice-dollar",
        general: "fa-file-medical"
    }[type] || "fa-file-medical";
}

function formatRecordType(type) {
    return type.charAt(0).toUpperCase() + type.slice(1);
}

function formatDate(date) {
    return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric"
    });
}

/* =========================
   INIT
========================= */
loadRecords();
