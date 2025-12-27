
    const themeToggle = document.getElementById('themeToggle');
    const mobileThemeToggle = document.getElementById('mobileThemeToggle');
    const html = document.documentElement;

    const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    if (savedTheme) {
        html.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
        }

    function toggleTheme() {
            const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
        }

    function updateThemeIcon(theme) {
            const icon = theme === 'dark' ? 'fa-sun' : 'fa-moon';
    themeToggle.innerHTML = `<i class="fas ${icon}"></i>`;
    mobileThemeToggle.innerHTML = `<i class="fas ${icon}"></i>`;
        }

    themeToggle.addEventListener('click', toggleTheme);
    mobileThemeToggle.addEventListener('click', toggleTheme);


    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const closeMenuBtn = document.getElementById('closeMenu');
    const mobileMenu = document.getElementById('mobileMenu');

        mobileMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
    mobileMenu.classList.add('active');
    document.body.style.overflow = 'hidden';
        });

        closeMenuBtn.addEventListener('click', () => {
        mobileMenu.classList.remove('active');
    document.body.style.overflow = '';
        });

        document.addEventListener('click', (e) => {
            if (mobileMenu.classList.contains('active') &&
    !mobileMenu.contains(e.target) &&
    e.target !== mobileMenuBtn) {
        mobileMenu.classList.remove('active');
    document.body.style.overflow = '';
            }
        });

    // Upload Modal
    function openUploadModal() {
        document.getElementById('uploadModal').classList.add('active');
    document.body.style.overflow = 'hidden';
    // Reset form when opening
    resetUploadForm();
        }

    function closeUploadModal() {
        document.getElementById('uploadModal').classList.remove('active');
    document.body.style.overflow = '';
    resetUploadForm();
        }

    function resetUploadForm() {
        document.getElementById('fileInput').value = '';
    document.getElementById('filePreview').classList.remove('active');
    document.getElementById('fileName').textContent = 'No file selected';
    document.getElementById('fileSize').innerHTML = '<i class="fas fa-weight-hanging"></i> 0 KB';
    document.getElementById('fileType').innerHTML = '<i class="fas fa-file-alt"></i> No file type';

    // Reset icon
    const fileIcon = document.getElementById('fileIcon');
    fileIcon.innerHTML = '<i class="fas fa-file"></i>';
    fileIcon.style.color = 'var(--primary)';
        }

    function removeSelectedFile() {
        document.getElementById('fileInput').value = '';
    document.getElementById('filePreview').classList.remove('active');
    document.getElementById('fileName').textContent = 'No file selected';
    document.getElementById('fileSize').innerHTML = '<i class="fas fa-weight-hanging"></i> 0 KB';
    document.getElementById('fileType').innerHTML = '<i class="fas fa-file-alt"></i> No file type';

    // Reset icon
    const fileIcon = document.getElementById('fileIcon');
    fileIcon.innerHTML = '<i class="fas fa-file"></i>';
    fileIcon.style.color = 'var(--primary)';
        }

    // View/Preview Modal
    function openPreviewModal(recordId) {
            // Find the record data
            const record = getRecordById(recordId);
    if (!record) {
        alert('Record not found!');
    return;
            }

    const previewBody = document.getElementById('previewBody');
    const icon = getRecordIcon(record.record_type);
    const fileType = getFileTypeFromName(record.file_name);

    previewBody.innerHTML = `
    <div class="preview-document">
        <div class="preview-icon">
            <i class="fas ${icon}"></i>
        </div>
        <h4>${record.file_name}</h4>
        <p>This is a preview of your medical document. In a real application, this would display the actual document content.</p>

        <div class="preview-info">
            <div class="info-item">
                <span class="info-label">Document Type:</span>
                <span class="info-value">${formatRecordType(record.record_type)}</span>
            </div>
            <div class="info-item">
                <span class="info-label">File Type:</span>
                <span class="info-value">${fileType.toUpperCase()}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Upload Date:</span>
                <span class="info-value">${formatDate(new Date(record.uploaded_at || new Date()))}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Document ID:</span>
                <span class="info-value">${record.id}</span>
            </div>
        </div>

        <div class="preview-actions">
            <a href="/vault/file/${record.id}" class="btn btn-primary" download>
                <i class="fas fa-download"></i> Download
            </a>
            <button class="btn btn-outline" onclick="closePreviewModal()">
                <i class="fas fa-times"></i> Close
            </button>
        </div>
    </div>
    `;

    document.getElementById('previewModal').classList.add('active');
    document.body.style.overflow = 'hidden';
        }

    function closePreviewModal() {
        document.getElementById('previewModal').classList.remove('active');
    document.body.style.overflow = '';
        }

    function getRecordById(recordId) {
            // This would normally come from the API, but for demo we'll use session data
            // In a real app, you would fetch this from the server
            const storedRecords = localStorage.getItem('telehealth_records');
    if (storedRecords) {
                const records = JSON.parse(storedRecords);
                return records.find(r => r.id === recordId);
            }
    return null;
        }

    function getFileTypeFromName(fileName) {
            const extension = fileName.split('.').pop().toLowerCase();
    return extension || 'unknown';
        }

    // Drag and Drop functionality
    const dropArea = document.getElementById('dropArea');
    const fileInput = document.getElementById('fileInput');
    const filePreview = document.getElementById('filePreview');
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');
    const fileType = document.getElementById('fileType');
    const fileIcon = document.getElementById('fileIcon');

    // Make drop area always visible
    dropArea.classList.add('active');

        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
        });

    function preventDefaults(e) {
        e.preventDefault();
    e.stopPropagation();
        }

        // Highlight drop area when item is dragged over it
        ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
        });

    function highlight() {
        dropArea.classList.add('drag-over');
        }

    function unhighlight() {
        dropArea.classList.remove('drag-over');
        }

    // Handle dropped files
    dropArea.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
            const dt = e.dataTransfer;
    const files = dt.files;

            if (files.length > 0) {
        fileInput.files = files;
    updateFilePreview(files[0]);
            }
        }

    // Handle file input change
    fileInput.addEventListener('change', function () {
            if (this.files.length > 0) {
        updateFilePreview(this.files[0]);
            }
        });

    function updateFilePreview(file) {
        filePreview.classList.add('active');
    fileName.textContent = file.name;

    // Format file size
    const sizeInKB = Math.round(file.size / 1024);
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);

            if (sizeInMB > 1) {
        fileSize.innerHTML = `<i class="fas fa-weight-hanging"></i> ${sizeInMB} MB`;
            } else {
        fileSize.innerHTML = `<i class="fas fa-weight-hanging"></i> ${sizeInKB} KB`;
            }

    // Get file type and extension
    const fileExtension = file.name.split('.').pop().toLowerCase();
    fileType.innerHTML = `<i class="fas fa-file-alt"></i> ${fileExtension.toUpperCase()} File`;

    // Update icon based on file type
    const iconElement = fileIcon.querySelector('i');
    let iconClass = 'fa-file';
    let iconColor = 'var(--primary)';

    if (fileExtension.match(/(pdf)$/)) {
        iconClass = 'fa-file-pdf';
    iconColor = '#f40f02';
            } else if (fileExtension.match(/(doc|docx)$/)) {
        iconClass = 'fa-file-word';
    iconColor = '#2b579a';
            } else if (fileExtension.match(/(xls|xlsx)$/)) {
        iconClass = 'fa-file-excel';
    iconColor = '#217346';
            } else if (fileExtension.match(/(jpg|jpeg|png|gif|bmp)$/)) {
        iconClass = 'fa-file-image';
    iconColor = '#e74c3c';
            } else if (fileExtension.match(/(txt)$/)) {
        iconClass = 'fa-file-alt';
    iconColor = '#666';
            } else {
        iconClass = 'fa-file';
    iconColor = 'var(--primary)';
            }

    iconElement.className = `fas ${iconClass}`;
    fileIcon.style.color = iconColor;
        }

    // Load Records
    async function loadRecords() {
            try {
                const res = await fetch("/api/vault/user");
    const data = await res.json();

    const recordsGrid = document.getElementById("recordsGrid");

    if (data.length === 0) {
        recordsGrid.innerHTML = `
                        <div class="empty-state">
                            <div class="empty-icon">
                                <i class="fas fa-folder-open"></i>
                            </div>
                            <h3>No Records Found</h3>
                            <p>You haven't uploaded any medical records yet.</p>
                            <button class="btn btn-primary" onclick="openUploadModal()">
                                <i class="fas fa-cloud-upload-alt"></i> Upload Your First Record
                            </button>
                        </div>
                    `;
    return;
                }

    recordsGrid.innerHTML = "";

                data.forEach(r => {
                    const icon = getRecordIcon(r.record_type);
    const typeClass = getRecordTypeClass(r.record_type);
    const date = r.uploaded_at ? new Date(r.uploaded_at) : new Date();

    const recordCard = document.createElement("div");
    recordCard.className = "record-card";
    recordCard.innerHTML = `
    <div class="record-icon">
        <i class="fas ${icon}"></i>
    </div>
    <div class="record-info">
        <h3>${r.file_name}</h3>
        <span class="record-type ${typeClass}">${formatRecordType(r.record_type)}</span>
        <div class="record-date">
            <i class="far fa-calendar"></i>
            ${formatDate(date)}
        </div>
        <div class="record-actions">
            <a href="/vault/file/${r.id}" class="btn btn-primary" title="Download">
                <i class="fas fa-download"></i> Download
            </a>
            <button class="btn btn-outline" onclick="openPreviewModal('${r.id}')" title="Preview">
                <i class="fas fa-eye"></i> View
            </button>
        </div>
    </div>
    `;
    recordsGrid.appendChild(recordCard);
                });

    // Store records for preview modal access
    localStorage.setItem('telehealth_records', JSON.stringify(data));
            } catch (error) {
        console.error("Error loading records:", error);
    const recordsGrid = document.getElementById("recordsGrid");
    recordsGrid.innerHTML = `
    <div class="empty-state">
        <div class="empty-icon">
            <i class="fas fa-exclamation-triangle"></i>
        </div>
        <h3>Unable to Load Records</h3>
        <p>Please try again later.</p>
        <button class="btn btn-primary" onclick="loadRecords()">
            <i class="fas fa-redo"></i> Retry
        </button>
    </div>
    `;
            }
        }

    function getRecordIcon(recordType) {
            const icons = {
        'prescription': 'fa-prescription-bottle-alt',
    'report': 'fa-file-medical-alt',
    'lab': 'fa-flask',
    'imaging': 'fa-x-ray',
    'insurance': 'fa-file-invoice-dollar',
    'general': 'fa-file-medical'
            };
    return icons[recordType] || 'fa-file-medical';
        }

    function getRecordTypeClass(recordType) {
            const classes = {
        'prescription': 'prescription',
    'report': 'report',
    'lab': 'lab',
    'imaging': 'imaging',
    'insurance': 'insurance',
    'general': 'general'
            };
    return classes[recordType] || 'general';
        }

    function formatRecordType(type) {
            return type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ');
        }

    function formatDate(date) {
            return date.toLocaleDateString('en-US', {
        year: 'numeric',
    month: 'long',
    day: 'numeric'
            });
        }

    // Form submission feedback
    const uploadForm = document.getElementById('uploadForm');
    uploadForm.addEventListener('submit', function (e) {
            const fileInput = document.querySelector('input[type="file"]');
    if (!fileInput.files.length) {
        e.preventDefault();
    alert('Please select a file to upload.');
    return;
            }

    // Show loading state
    const submitBtn = uploadForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
    submitBtn.disabled = true;

            // Reset button after submission (in real app, this would be after successful upload)
            setTimeout(() => {
        submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
    closeUploadModal();
    loadRecords(); // Refresh records list

    // Show success message
    alert('File uploaded successfully!');
            }, 2000);
        });

    // Close modals with Escape key
    document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
        closeUploadModal();
    closePreviewModal();
            }
        });

    // Initialize
    loadRecords();
