// DOM Elements
const CLIENT_ID = '397456705277-snngf473ovck1nisb06uq21pqu96655p.apps.googleusercontent.com';
const FOLDER_ID = '18ted6k0Xa3lebJ2ob_wCXrDqRi6s5CVB';

const authBtn = document.getElementById('authBtn');
const authStatus = document.getElementById('authStatus');
const configPanel = document.getElementById('configPanel');
const userProfileBar = document.getElementById('userProfileBar');
const userEmail = document.getElementById('userEmail');
const userName = document.getElementById('userName');
const userAvatar = document.getElementById('userAvatar');
const userDefaultAvatar = document.getElementById('userDefaultAvatar');
const logoutBtn = document.getElementById('logoutBtn');

const demoBtn = document.getElementById('demoBtn');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const imageList = document.getElementById('imageList');
const loader = document.getElementById('loader');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');
const emptyState = document.getElementById('emptyState');
const emptyStateDesc = document.getElementById('emptyStateDesc');
const itemCount = document.getElementById('itemCount');
const itemCountText = document.getElementById('itemCountText');
const btnListView = document.getElementById('btnListView');
const btnGridView = document.getElementById('btnGridView');

// Modal Elements
const imageModal = document.getElementById('imageModal');
const modalBackdrop = document.getElementById('modalBackdrop');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalImage = document.getElementById('modalImage');
const modalFileName = document.getElementById('modalFileName');
const modalCopyBtn = document.getElementById('modalCopyBtn');
const modalOpenBtn = document.getElementById('modalOpenBtn');

// Toast Element
const toast = document.getElementById('toast');
const toastMsg = document.getElementById('toastMsg');
let toastTimer = null;

// Biến lưu trữ dữ liệu
let allImages = [];
let currentFilteredImages = [];
let tokenClient;
let accessToken = null;
let currentSearchTerm = '';
let currentActiveImage = null;

// Khởi tạo và yêu cầu Token khi bấm Đăng nhập Google
authBtn.addEventListener('click', () => {
    try {
        if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
            showError('Thư viện Google Identity Services chưa tải xong hoặc bị chặn bởi trình duyệt. Vui lòng tải lại trang.');
            return;
        }

        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.email openid email profile',
            callback: async (tokenResponse) => {
                if (tokenResponse.error !== undefined) {
                    throw (tokenResponse);
                }
                accessToken = tokenResponse.access_token;
                
                // Cập nhật trạng thái UI
                if (authStatus) {
                    authStatus.className = 'status-badge status-online';
                    authStatus.textContent = 'Đã kết nối';
                }

                // Lấy thông tin tài khoản Gmail của người dùng và hiển thị lên góc trên phải + ẩn phần xác thực
                await fetchUserProfile(accessToken);

                showToast('Đăng nhập thành công! Bắt đầu quét dữ liệu...', 'success');

                // Lấy dữ liệu từ Google Drive
                fetchImages(accessToken, FOLDER_ID);
            },
        });

        tokenClient.requestAccessToken();
    } catch (error) {
        showError('Lỗi khi khởi tạo đăng nhập Google. Kiểm tra lại Client ID hoặc kết nối mạng.');
        console.error(error);
    }
});

// Hàm lấy thông tin người dùng Google
async function fetchUserProfile(token) {
    let email = '';
    let name = '';
    let photo = '';

    // 1. Thử lấy từ Google Drive about API (dùng sẵn scope drive.readonly)
    try {
        const driveAboutRes = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (driveAboutRes.ok) {
            const data = await driveAboutRes.json();
            if (data.user) {
                email = data.user.emailAddress || '';
                name = data.user.displayName || '';
                photo = data.user.photoLink || '';
            }
        }
    } catch (e) {
        console.warn('Không lấy được profile từ Drive API:', e);
    }

    // 2. Nếu chưa có email, thử gọi thêm Google OAuth2 userinfo API
    if (!email) {
        try {
            const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (userInfoRes.ok) {
                const userData = await userInfoRes.json();
                email = userData.email || email;
                name = userData.name || name;
                photo = userData.picture || photo;
            }
        } catch (e) {
            console.warn('Không lấy được profile từ userinfo API:', e);
        }
    }

    showUserProfile({ email, name, photo });
}

// Hàm hiển thị profile góc trên phải và ẩn phần xác thực tài khoản
function showUserProfile(profile) {
    if (userEmail) {
        userEmail.textContent = profile.email || 'Google User';
        userEmail.title = profile.email || '';
    }
    if (userName) {
        userName.textContent = profile.name || (profile.email ? profile.email.split('@')[0] : 'Đã kết nối');
    }
    if (userAvatar && profile.photo) {
        userAvatar.src = profile.photo;
        userAvatar.classList.remove('hidden');
        if (userDefaultAvatar) userDefaultAvatar.classList.add('hidden');
    } else {
        if (userAvatar) userAvatar.classList.add('hidden');
        if (userDefaultAvatar) userDefaultAvatar.classList.remove('hidden');
    }

    // Hiển thị thanh profile phía trên góc phải màn hình
    if (userProfileBar) {
        userProfileBar.classList.remove('hidden');
    }

    // Ẩn phần xác thực tài khoản theo yêu cầu của người dùng
    if (configPanel) {
        configPanel.classList.add('hidden');
    }
}

// Xử lý sự kiện Đăng xuất
if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
}

function handleLogout() {
    if (accessToken && typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
        try {
            google.accounts.oauth2.revoke(accessToken, () => {
                console.log('Access token revoked');
            });
        } catch (err) {
            console.warn('Revoke token error:', err);
        }
    }

    accessToken = null;
    allImages = [];
    currentFilteredImages = [];

    // Ẩn thanh profile góc phải
    if (userProfileBar) {
        userProfileBar.classList.add('hidden');
    }

    // Hiện lại phần xác thực tài khoản
    if (configPanel) {
        configPanel.classList.remove('hidden');
    }
    if (authStatus) {
        authStatus.className = 'status-badge status-offline';
        authStatus.textContent = 'Chưa kết nối';
    }

    // Reset tìm kiếm & danh sách ảnh
    searchInput.value = '';
    searchInput.disabled = true;
    if (clearSearchBtn) clearSearchBtn.classList.add('hidden');
    if (itemCount) itemCount.classList.add('hidden');
    imageList.innerHTML = '';
    showEmptyState('Vui lòng đăng nhập để xem danh sách hình ảnh.');
    showToast('Đã đăng xuất tài khoản thành công!');
}

// Chế độ xem trước giao diện mẫu (Demo Mode)
if (demoBtn) {
    demoBtn.addEventListener('click', () => {
        loadDemoData();
    });
}

function loadDemoData() {
    hideError();
    emptyState.classList.add('hidden');
    loader.classList.remove('hidden');
    searchInput.disabled = true;

    if (authStatus) {
        authStatus.className = 'status-badge status-online';
        authStatus.textContent = 'Chế độ Demo';
    }

    showUserProfile({
        email: 'spx.thaidan@gmail.com',
        name: 'Thái Dân (SPX)',
        photo: ''
    });

    setTimeout(() => {
        allImages = [
            {
                id: 'demo-1',
                name: 'HANG_ROI_KHU_A_SPX_984210.jpg',
                url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80'
            },
            {
                id: 'demo-2',
                name: 'KIEN_HANG_RACK_04_HCM_77123.jpg',
                url: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=800&q=80'
            },
            {
                id: 'demo-3',
                name: 'THUNG_CARTON_VO_BANG_KEO_CAM_01.png',
                url: 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?auto=format&fit=crop&w=800&q=80'
            },
            {
                id: 'demo-4',
                name: 'DON_GIAO_THAT_LAC_BAGGAGE_0911.jpg',
                url: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=800&q=80'
            },
            {
                id: 'demo-5',
                name: 'KIEN_DONG_GOI_NHAN_MA_VACH_8820.jpg',
                url: 'https://images.unsplash.com/photo-1580674285054-bed31e145f59?auto=format&fit=crop&w=800&q=80'
            },
            {
                id: 'demo-6',
                name: 'HANG_DIEN_TU_ROI_SAN_KHO_03.webp',
                url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&q=80'
            },
            {
                id: 'demo-7',
                name: 'GOI_HANG_NHO_BANG_CHUYEN_HN_551.jpg',
                url: 'https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&w=800&q=80'
            },
            {
                id: 'demo-8',
                name: 'KIEM_KE_HANG_ROI_NGAY_HOM_NAY.jpg',
                url: 'https://images.unsplash.com/photo-1587293852726-70cdb56c2866?auto=format&fit=crop&w=800&q=80'
            }
        ];

        loader.classList.add('hidden');
        searchInput.disabled = false;
        searchInput.value = '';
        renderImages(allImages);
        showToast('Đã tải 8 hình ảnh mẫu để xem trước giao diện!', 'info');
    }, 400);
}

// Xử lý sự kiện tìm kiếm
searchInput.addEventListener('input', (e) => {
    currentSearchTerm = e.target.value.trim().toLowerCase();
    
    // Toggle nút xóa tìm kiếm
    if (currentSearchTerm.length > 0) {
        clearSearchBtn.classList.remove('hidden');
    } else {
        clearSearchBtn.classList.add('hidden');
    }

    const filteredImages = allImages.filter(img =>
        img.name.toLowerCase().includes(currentSearchTerm)
    );
    renderImages(filteredImages, currentSearchTerm);
});

// Nút xóa tìm kiếm
clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    currentSearchTerm = '';
    clearSearchBtn.classList.add('hidden');
    renderImages(allImages);
    searchInput.focus();
});

// Chuyển đổi chế độ xem (List / Grid)
if (btnListView && btnGridView) {
    btnListView.addEventListener('click', () => {
        btnListView.classList.add('active');
        btnGridView.classList.remove('active');
        imageList.classList.remove('grid-view');
        const header = document.getElementById('listHeader');
        if (header) header.style.display = '';
    });

    btnGridView.addEventListener('click', () => {
        btnGridView.classList.add('active');
        btnListView.classList.remove('active');
        imageList.classList.add('grid-view');
        const header = document.getElementById('listHeader');
        if (header) header.style.display = 'none';
    });
}

// Hàm gọi API Google Drive đệ quy (BFS)
async function fetchImages(token, rootFolderId) {
    hideError();
    emptyState.classList.add('hidden');
    imageList.innerHTML = '';
    loader.classList.remove('hidden');
    searchInput.disabled = true;
    allImages = [];

    try {
        let foldersToProcess = [rootFolderId];
        let imageFiles = [];

        while (foldersToProcess.length > 0) {
            let currentFolderId = foldersToProcess.shift();
            let pageToken = null;

            do {
                const query = `'${currentFolderId}' in parents and trashed = false`;
                const fields = 'nextPageToken,files(id,name,mimeType,thumbnailLink,webContentLink)';
                let url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}&pageSize=1000`;

                if (pageToken) {
                    url += `&pageToken=${pageToken}`;
                }

                const response = await fetch(url, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error?.message || 'Lỗi khi kết nối với Google Drive API');
                }

                const data = await response.json();

                if (data.files) {
                    for (let file of data.files) {
                        if (file.mimeType === 'application/vnd.google-apps.folder') {
                            foldersToProcess.push(file.id);
                        } else if (file.mimeType && file.mimeType.startsWith('image/')) {
                            imageFiles.push(file);
                        }
                    }
                }
                pageToken = data.nextPageToken;
            } while (pageToken);
        }

        if (imageFiles.length > 0) {
            allImages = imageFiles.map(file => {
                let imgUrl = file.thumbnailLink;
                if (imgUrl) {
                    imgUrl = imgUrl.replace('=s220', '=s800');
                }
                return {
                    id: file.id,
                    name: file.name,
                    url: imgUrl || file.webContentLink
                };
            });

            renderImages(allImages);
            searchInput.disabled = false;
            searchInput.value = '';
            showToast(`Đã đồng bộ thành công ${allImages.length} hình ảnh!`);
        } else {
            showEmptyState('Không có hình ảnh nào trong thư mục được chỉ định.');
        }
    } catch (error) {
        showError(`Đã xảy ra lỗi: ${error.message}`);
        if (error.message.includes('Insufficient Permission') || error.message.includes('unauthenticated')) {
            showError('Lỗi phân quyền: Đảm bảo bạn đăng nhập bằng email công ty có quyền vào thư mục này.');
        }
    } finally {
        loader.classList.add('hidden');
    }
}

// Hàm render danh sách hình ảnh
function renderImages(images, highlightTerm = '') {
    imageList.innerHTML = '';
    currentFilteredImages = images;

    // Cập nhật số lượng
    if (itemCount && itemCountText) {
        itemCount.classList.remove('hidden');
        if (allImages.length > 0 && images.length !== allImages.length) {
            itemCountText.textContent = `Lọc ${images.length} / ${allImages.length} ảnh`;
        } else {
            itemCountText.textContent = `${images.length} ảnh`;
        }
    }

    if (images.length === 0) {
        showEmptyState(highlightTerm ? `Không có ảnh nào khớp với "${highlightTerm}"` : 'Không tìm thấy hình ảnh nào');
        return;
    }

    emptyState.classList.add('hidden');

    images.forEach((img, index) => {
        const li = document.createElement('li');
        li.className = 'list-item';
        li.style.animationDelay = `${Math.min(index * 0.04, 0.5)}s`;

        // Container ảnh
        const imgContainer = document.createElement('div');
        imgContainer.className = 'col-image item-image';
        imgContainer.title = 'Bấm để phóng to hình ảnh';

        const imageElement = document.createElement('img');
        imageElement.src = img.url || 'https://via.placeholder.com/150?text=No+Image';
        imageElement.alt = img.name;
        imageElement.loading = 'lazy';

        imageElement.onerror = function () {
            this.src = 'https://via.placeholder.com/300x200/fff7ed/ff5f00?text=Ảnh+bảo+mật';
        };

        // Overlay icon kính lúp xem chi tiết
        const overlay = document.createElement('div');
        overlay.className = 'item-image-overlay';
        overlay.innerHTML = '<i class="ph-bold ph-magnifying-glass-plus"></i>';

        imgContainer.appendChild(imageElement);
        imgContainer.appendChild(overlay);

        // Click ảnh mở Lightbox
        imgContainer.addEventListener('click', () => {
            openModal(img);
        });

        // Tên file & Metadata
        const nameWrapper = document.createElement('div');
        nameWrapper.className = 'col-name item-name-wrapper';

        const titleDiv = document.createElement('div');
        titleDiv.className = 'item-title';
        titleDiv.innerHTML = formatHighlightedName(img.name, highlightTerm);

        const metaDiv = document.createElement('div');
        metaDiv.className = 'item-meta';

        // Lấy đuôi file
        const extMatch = img.name.match(/\.([0-9a-z]+)(?:[\?#]|$)/i);
        const ext = extMatch ? extMatch[1].toUpperCase() : 'IMG';

        const extBadge = document.createElement('span');
        extBadge.className = 'file-badge';
        extBadge.innerHTML = `<i class="ph-fill ph-file"></i> ${ext}`;

        metaDiv.appendChild(extBadge);
        nameWrapper.appendChild(titleDiv);
        nameWrapper.appendChild(metaDiv);

        // Cột Thao tác (Action buttons)
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'col-actions item-actions';

        // Nút phóng to
        const viewBtn = document.createElement('button');
        viewBtn.className = 'action-icon-btn';
        viewBtn.title = 'Phóng to ảnh';
        viewBtn.innerHTML = '<i class="ph-bold ph-arrows-out"></i>';
        viewBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openModal(img);
        });

        // Nút sao chép tên
        const copyBtn = document.createElement('button');
        copyBtn.className = 'action-icon-btn';
        copyBtn.title = 'Sao chép tên file';
        copyBtn.innerHTML = '<i class="ph-bold ph-copy"></i>';
        copyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            copyToClipboard(img.name);
        });

        actionsDiv.appendChild(viewBtn);
        actionsDiv.appendChild(copyBtn);

        li.appendChild(imgContainer);
        li.appendChild(nameWrapper);
        li.appendChild(actionsDiv);

        imageList.appendChild(li);
    });
}

// Highlight từ khóa tìm kiếm
function formatHighlightedName(name, keyword) {
    if (!keyword) return escapeHTML(name);
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedKeyword})`, 'gi');
    return escapeHTML(name).replace(regex, '<mark class="search-match">$1</mark>');
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

// Modal / Lightbox Logic
function openModal(img) {
    currentActiveImage = img;
    modalFileName.textContent = img.name;
    modalImage.src = img.url;
    modalOpenBtn.href = img.url;
    imageModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    imageModal.classList.add('hidden');
    document.body.style.overflow = '';
    currentActiveImage = null;
}

if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
if (modalBackdrop) modalBackdrop.addEventListener('click', closeModal);

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !imageModal.classList.contains('hidden')) {
        closeModal();
    }
});

if (modalCopyBtn) {
    modalCopyBtn.addEventListener('click', () => {
        if (currentActiveImage) {
            copyToClipboard(currentActiveImage.name);
        }
    });
}

// Clipboard & Toast Notification
function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
            showToast(`Đã sao chép: "${text}"`);
        }).catch(() => {
            fallbackCopy(text);
        });
    } else {
        fallbackCopy(text);
    }
}

function fallbackCopy(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
        showToast(`Đã sao chép: "${text}"`);
    } catch (err) {
        showToast('Không thể tự động sao chép');
    }
    document.body.removeChild(textArea);
}

function showToast(message) {
    if (!toast) return;
    toastMsg.textContent = message;
    toast.classList.remove('hidden');

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.add('hidden');
    }, 2800);
}

// Error & Empty state helpers
function showError(message) {
    if (errorText) {
        errorText.textContent = message;
    } else {
        errorMessage.textContent = message;
    }
    errorMessage.classList.remove('hidden');
}

function hideError() {
    errorMessage.classList.add('hidden');
}

function showEmptyState(desc = 'Không tìm thấy hình ảnh nào') {
    if (emptyStateDesc) emptyStateDesc.textContent = desc;
    emptyState.classList.remove('hidden');
}
