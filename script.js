// Impor Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getFirestore, collection, doc, onSnapshot, addDoc, setDoc, deleteDoc, query, writeBatch, where, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

// --- KONFIGURASI FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyA0hPu7lHjX-j_w4A9G8zIYjR1EgudZhx4",
    authDomain: "manager-prompt-lokal.firebaseapp.com",
    databaseURL: "https://manager-prompt-lokal-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "manager-prompt-lokal",
    storageBucket: "manager-prompt-lokal.firebasestorage.app",
    messagingSenderId: "357496600242",
    appId: "1:357496600242:web:f1f9adb39b9d4304a63bab",
    measurementId: "G-46WTHJN6YX"
};
const appId = firebaseConfig.projectId || 'default-imajinasi-lokal';
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Variabel Global
let userId = null;
let unsubscribePrompts = null;
let unsubscribeHistory = null;
let unsubscribeVariations = null;
let allPrompts = [];
let importHistory = [];
let currentPromptId = null;
let currentCategory = null;

// --- Selektor DOM ---
const loginPage = document.getElementById('page-login');
const appContainer = document.getElementById('app-container');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const pages = document.querySelectorAll('.page');
const categoryGrid = document.getElementById('category-grid');
const promptList = document.getElementById('prompt-list');
const historyList = document.getElementById('history-list');
const promptListTitle = document.getElementById('prompt-list-title');
const emptyStateCategories = document.getElementById('empty-state-categories');
const backToCategoriesBtn = document.getElementById('backToCategoriesBtn');
const backToPromptsBtn = document.getElementById('backToPromptsBtn');
const backToCategoriesBtnFromHistory = document.getElementById('backToCategoriesBtnFromHistory');
const historyBtn = document.getElementById('historyBtn');
const promptDetailContent = document.getElementById('prompt-detail-content');
const variationHistoryList = document.getElementById('variation-history-list');
const globalSearchInput = document.getElementById('globalSearchInput');
const settingsBtn = document.getElementById('settingsBtn');
const addPromptBtn = document.getElementById('addPromptBtn');
const importCsvBtn = document.getElementById('importCsvBtn');
const exportBtn = document.getElementById('exportBtn');
const csvFileInput = document.getElementById('csvFileInput');
const modal = document.getElementById('promptModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelBtn = document.getElementById('cancelBtn');
const promptForm = document.getElementById('promptForm');
const modalTitle = document.getElementById('modalTitle');
const userInfo = document.getElementById('userInfo');
const alertModal = document.getElementById('alertModal');
const alertMessage = document.getElementById('alertMessage');
let alertConfirmBtn = document.getElementById('alertConfirmBtn');
let alertCancelBtn = document.getElementById('alertCancelBtn');
const variationModal = document.getElementById('variationModal');
const closeVariationModalBtn = document.getElementById('closeVariationModalBtn');
const closeVariationModalBtnFooter = document.getElementById('closeVariationModalBtnFooter');
const originalPromptText = document.getElementById('originalPromptText');
const manualVariationInput = document.getElementById('manual-variation');
const generateVariationBtn = document.getElementById('generate-variation-btn');
const variationSpinner = document.getElementById('variation-spinner');
const variationResultsContainer = document.getElementById('variation-results-container');
const suggestMetadataBtn = document.getElementById('suggestMetadataBtn');
const metadataSpinner = document.getElementById('metadata-spinner');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsModalBtn = document.getElementById('closeSettingsModalBtn');
const apiKeyInput = document.getElementById('apiKeyInput');
const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
const styleVariationSelect = document.getElementById('style-variation');
const clothingStyleVariationSelect = document.getElementById('clothing-style-variation');
const clothingCoverageVariationSelect = document.getElementById('clothing-coverage-variation');
const hijabVariationSelect = document.getElementById('hijab-variation');
const backgroundVariationSelect = document.getElementById('background-variation');
const cameraAngleVariationSelect = document.getElementById('camera-angle-variation');

// --- Fungsi Panggilan API Gemini ---
async function callGemini(prompt, schema) {
    const apiKey = localStorage.getItem('geminiApiKey');
    if (!apiKey) {
        alert("Kunci API Gemini belum diatur. Silakan masukkan di menu Pengaturan.");
        return null;
    }
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const payload = { 
        contents: [{ role: "user", parts: [{ text: prompt }] }], 
        generationConfig: { responseMimeType: "application/json", responseSchema: schema } 
    };
    try {
        const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) {
            if (response.status === 400) {
                alert("Kunci API Gemini tidak valid. Periksa kembali di Pengaturan.");
            } else {
                alert(`Error API: ${response.status}`);
            }
            throw new Error(`API call failed: ${response.status}`);
        }
        const result = await response.json();
        if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
            return JSON.parse(result.candidates[0].content.parts[0].text);
        }
        return null;
    } catch (error) { 
        console.error("Error calling Gemini:", error); 
        return null; 
    }
}

// --- Fungsi UI ---
const showPage = (pageId) => pages.forEach(p => p.classList.toggle('active', p.id === pageId));
const openModal = (modalElement) => modalElement.classList.remove('hidden');
const closeModal = (modalElement) => modalElement.classList.add('hidden');

const showConfirmation = (message, onConfirm) => {
    alertMessage.textContent = message;
    const newConfirmBtn = alertConfirmBtn.cloneNode(true);
    alertConfirmBtn.parentNode.replaceChild(newConfirmBtn, alertConfirmBtn);
    alertConfirmBtn = newConfirmBtn;
    const newCancelBtn = alertCancelBtn.cloneNode(true);
    alertCancelBtn.parentNode.replaceChild(newCancelBtn, alertCancelBtn);
    alertCancelBtn = newCancelBtn;

    alertConfirmBtn.onclick = () => { onConfirm(); closeModal(alertModal); };
    alertCancelBtn.onclick = () => { closeModal(alertModal); };
    openModal(alertModal);
};

function copyToClipboard(text, element) {
    navigator.clipboard.writeText(text).then(() => {
        const originalIcon = element.innerHTML;
        element.innerHTML = '<i class="fas fa-check text-green-500"></i>';
        setTimeout(() => { element.innerHTML = originalIcon; }, 1500);
    }).catch(() => alert('Gagal menyalin.'));
}

// --- Render UI ---
const renderCategories = () => {
    const categories = [...new Set(allPrompts.map(p => p.kategori).filter(Boolean))];
    categoryGrid.innerHTML = '';
    emptyStateCategories.classList.toggle('hidden', categories.length > 0);
    if (categories.length === 0) return;
    categories.sort().forEach(cat => {
        const promptCount = allPrompts.filter(p => p.kategori === cat).length;
        const card = document.createElement('div');
        card.className = 'category-card bg-white rounded-lg shadow p-6 flex flex-col items-center justify-center text-center cursor-pointer';
        card.dataset.category = cat;
        card.innerHTML = `<i class="fas fa-folder text-4xl text-indigo-500 mb-4"></i><h3 class="font-bold text-lg text-gray-800">${cat}</h3><p class="text-sm text-gray-500">${promptCount} prompt</p>`;
        card.onclick = () => renderPrompts(allPrompts.filter(p => p.kategori === cat), `Kategori: ${cat}`);
        categoryGrid.appendChild(card);
    });
};

const renderPrompts = (promptsToRender, title) => {
    currentCategory = title.includes("Kategori:") ? title.replace("Kategori: ", "") : null;
    promptListTitle.textContent = title;
    promptList.innerHTML = '';
    if (promptsToRender.length === 0) {
        promptList.innerHTML = `<div class="text-center p-10 text-gray-500">Tidak ada prompt yang cocok.</div>`;
    } else {
        promptsToRender.forEach(prompt => {
            const item = document.createElement('div');
            item.className = 'prompt-item flex flex-col sm:flex-row items-start sm:items-center p-4 gap-4 cursor-pointer';
            item.dataset.id = prompt.id;
            item.innerHTML = `<div class="flex-1"><h3 class="font-bold text-md text-gray-900 mb-1">${prompt.judul || 'Tanpa Judul'}</h3><p class="text-gray-600 text-sm pr-8">${prompt.promptText.substring(0, 150)}...</p></div>`;
            item.onclick = () => renderPromptDetail(prompt);
            promptList.appendChild(item);
        });
    }
    showPage('page-prompts');
};

const renderPromptDetail = (prompt) => {
    currentPromptId = prompt.id;
    promptDetailContent.innerHTML = `<div class="bg-white rounded-lg shadow p-6">
        <div class="flex justify-between items-start">
            <div>
                <h2 class="text-2xl font-bold text-gray-800">${prompt.judul}</h2>
                <p class="text-sm text-gray-500 mb-4">Kategori: ${prompt.kategori}</p>
                <p class="text-gray-700 whitespace-pre-wrap">${prompt.promptText}</p>
            </div>
            <div class="flex items-center gap-4">
                <button class="text-gray-500 hover:text-indigo-600 text-lg copy-main-prompt-btn" title="Salin Prompt Utama"><i class="fas fa-copy"></i></button>
                <button class="text-gray-500 hover:text-blue-600 text-lg edit-main-prompt-btn" title="Edit Prompt Utama"><i class="fas fa-pencil-alt"></i></button>
                <button class="text-gray-500 hover:text-red-600 text-lg delete-main-prompt-btn" title="Hapus Prompt Utama"><i class="fas fa-trash-alt"></i></button>
            </div>
        </div>
        <button id="open-variation-generator-btn" class="mt-6 w-full bg-purple-100 text-purple-700 font-semibold px-4 py-2 rounded-lg hover:bg-purple-200 flex items-center justify-center gap-2">
            <i class="fas fa-wand-magic-sparkles"></i><span>Buat Variasi Baru</span>
        </button>
    </div>`;

    const copyBtn = promptDetailContent.querySelector('.copy-main-prompt-btn');
    const editBtn = promptDetailContent.querySelector('.edit-main-prompt-btn');
    const deleteBtn = promptDetailContent.querySelector('.delete-main-prompt-btn');
    const variationBtn = promptDetailContent.querySelector('#open-variation-generator-btn');

    copyBtn.onclick = (e) => { e.stopPropagation(); copyToClipboard(prompt.promptText, copyBtn); };
    editBtn.onclick = (e) => { e.stopPropagation(); handleEditPrompt(prompt); };
    deleteBtn.onclick = (e) => { e.stopPropagation(); handleDeletePrompt(prompt.id, prompt.kategori); };
    variationBtn.onclick = (e) => { e.stopPropagation(); openVariationModal(prompt); };

    if (unsubscribeVariations) unsubscribeVariations();
    const variationsPath = `artifacts/${appId}/users/${userId}/prompts/${prompt.id}/variations`;
    unsubscribeVariations = onSnapshot(query(collection(db, variationsPath)), (snapshot) => {
        const variations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderVariationHistory(variations);
    });

    showPage('page-prompt-detail');
};

const renderVariationHistory = (variations) => {
    variationHistoryList.innerHTML = '';
    if (!variations || variations.length === 0) {
        variationHistoryList.innerHTML = `<div class="text-center p-6 bg-white rounded-lg shadow text-gray-500 text-sm">Belum ada variasi yang disimpan.</div>`;
        return;
    }
    variations.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).forEach(v => {
        const item = document.createElement('div');
        item.className = 'bg-white rounded-lg shadow p-4';
        item.innerHTML = `<p class="text-sm text-gray-700 whitespace-pre-wrap">${v.promptText}</p><div class="flex justify-end items-center gap-4 mt-3 pt-3 border-t"><button class="copy-variation-btn text-sm text-indigo-600 font-semibold hover:text-indigo-800">Salin</button><button data-id="${v.id}" class="delete-variation-btn text-sm text-red-600 font-semibold hover:text-red-800">Hapus</button></div>`;
        item.querySelector('.copy-variation-btn').onclick = () => copyToClipboard(v.promptText, item.querySelector('.copy-variation-btn'));
        item.querySelector('.delete-variation-btn').onclick = () => showConfirmation("Hapus variasi ini?", () => handleDeleteVariation(v.id));
        variationHistoryList.appendChild(item);
    });
};

const renderHistory = () => {
    historyList.innerHTML = '';
    if (importHistory.length === 0) {
        historyList.innerHTML = `<div class="text-center p-10 text-gray-500">Belum ada riwayat impor.</div>`;
    } else {
        importHistory.sort((a, b) => b.timestamp - a.timestamp).forEach(item => {
            const date = item.timestamp.toDate();
            const formattedDate = date.toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' });
            const historyItem = document.createElement('div');
            historyItem.className = 'p-4 flex justify-between items-center';
            historyItem.innerHTML = `<div><p class="font-semibold text-gray-800">${item.promptCount} prompt diimpor</p><p class="text-sm text-gray-500">Pada: ${formattedDate}</p></div><button data-import-id="${item.id}" class="delete-history-btn bg-red-100 text-red-700 px-3 py-1 rounded-md text-sm font-semibold hover:bg-red-200">Hapus Impor</button>`;
            historyItem.querySelector('.delete-history-btn').onclick = () => handleDeleteHistory(item.id);
            historyList.appendChild(historyItem);
        });
    }
    showPage('page-history');
};

// --- Logika Database ---
const setupListeners = () => {
    if (!userId) return;
    const promptsPath = `artifacts/${appId}/users/${userId}/prompts`;
    if (unsubscribePrompts) unsubscribePrompts();
    unsubscribePrompts = onSnapshot(query(collection(db, promptsPath)), (snapshot) => {
        allPrompts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        allPrompts.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
        if (appContainer.classList.contains('hidden')) return;
        if (document.getElementById('page-categories').classList.contains('active')) {
            renderCategories();
        } else if (document.getElementById('page-prompts').classList.contains('active') && currentCategory) {
            renderPrompts(allPrompts.filter(p => p.kategori === currentCategory), `Kategori: ${currentCategory}`);
        }
    });

    const historyPath = `artifacts/${appId}/users/${userId}/importHistory`;
    if (unsubscribeHistory) unsubscribeHistory();
    unsubscribeHistory = onSnapshot(query(collection(db, historyPath)), (snapshot) => {
        importHistory = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    });
};

const handleSavePrompt = async (e) => {
    e.preventDefault();
    if (!userId) return;
    const promptData = { 
        judul: document.getElementById('judul').value, 
        kategori: document.getElementById('kategori').value, 
        promptText: document.getElementById('promptText').value 
    };
    const id = document.getElementById('promptId').value;
    const collectionPath = `artifacts/${appId}/users/${userId}/prompts`;
    try {
        if (id) {
            await setDoc(doc(db, collectionPath, id), promptData, { merge: true });
        } else {
            await addDoc(collection(db, collectionPath), { ...promptData, createdAt: serverTimestamp() });
        }
        closeModal(modal);
    } catch (error) { console.error("Error saving prompt:", error); }
};

async function deleteCollection(collectionPath) {
    const collectionRef = collection(db, collectionPath);
    const q = query(collectionRef);
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
}

const handleDeletePrompt = async (id, category) => {
    showConfirmation('Hapus prompt utama ini beserta semua variasinya?', async () => {
        try {
            const variationsPath = `artifacts/${appId}/users/${userId}/prompts/${id}/variations`;
            await deleteCollection(variationsPath);
            await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/prompts`, id));
            showPage('page-categories');
        } catch (error) { console.error("Error deleting prompt:", error); }
    });
};

const handleDeleteVariation = async (variationId) => {
    try {
        await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/prompts/${currentPromptId}/variations`, variationId));
    } catch (error) { console.error("Error deleting variation:", error); }
};

const handleDeleteHistory = async (importId) => {
    showConfirmation('Hapus semua prompt dari sesi impor ini?', async () => {
        try {
            const batch = writeBatch(db);
            const promptsQuery = query(collection(db, `artifacts/${appId}/users/${userId}/prompts`), where("importId", "==", importId));
            const promptsSnapshot = await getDocs(promptsQuery);
            for (const promptDoc of promptsSnapshot.docs) {
                const variationsPath = `artifacts/${appId}/users/${userId}/prompts/${promptDoc.id}/variations`;
                const variationsSnapshot = await getDocs(collection(db, variationsPath));
                variationsSnapshot.forEach(variationDoc => batch.delete(variationDoc.ref));
                batch.delete(promptDoc.ref);
            }
            const historyDocRef = doc(db, `artifacts/${appId}/users/${userId}/importHistory`, importId);
            batch.delete(historyDocRef);
            await batch.commit();
            showPage('page-categories');
        } catch (error) { console.error("Error deleting import:", error); }
    });
};

// --- CSV & Ekspor ---
function parseRobustCSV(csvText) {
    const rows = []; let fields = []; let currentField = ''; let inQuotes = false;
    const text = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (inQuotes) {
            if (char === '"') {
                if (i + 1 < text.length && text[i + 1] === '"') { currentField += '"'; i++; } 
                else { inQuotes = false; }
            } else { currentField += char; }
        } else {
            if (char === '"') { inQuotes = true; } 
            else if (char === ',') { fields.push(currentField); currentField = ''; } 
            else if (char === '\n') { fields.push(currentField); rows.push(fields); fields = []; currentField = ''; } 
            else { currentField += char; }
        }
    }
    if (currentField || fields.length > 0) { fields.push(currentField); rows.push(fields); }
    return rows.filter(row => row.length > 0 && row.some(field => field.trim() !== ''));
}

const handleCsvImport = (event) => {
    const file = event.target.files[0];
    if (!file || !userId) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        const text = e.target.result;
        const data = parseRobustCSV(text);
        if (data.length < 2) { alert("File CSV tidak valid."); return; }
        const headers = data[0].map(h => h.toLowerCase().trim());
        const rows = data.slice(1);
        const headerMap = { 
            prompt: ['prompt', 'prompttext', 'prompt utama', 'prompt imajinasi lokal'], 
            judul: ['judul', 'title'], 
            kategori: ['kategori', 'category', 'tags'] 
        };
        const getIndex = keys => keys.reduce((acc, key) => acc !== -1 ? acc : headers.indexOf(key), -1);
        const promptIdx = getIndex(headerMap.prompt);
        if (promptIdx === -1) { alert("Kolom 'prompt' tidak ditemukan."); return; }
        const judulIdx = getIndex(headerMap.judul);
        const kategoriIdx = getIndex(headerMap.kategori);
        const importId = crypto.randomUUID();
        const promptsBatch = writeBatch(db);
        const promptsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/prompts`);
        
        rows.forEach((values, index) => {
            if (values.length <= promptIdx || !values[promptIdx]) return;
            const promptText = values[promptIdx] || '';
            const judul = judulIdx !== -1 ? values[judulIdx] : promptText.split(',')[0].substring(0, 50);
            const newDocRef = doc(promptsCollectionRef);
            promptsBatch.set(newDocRef, { 
                promptText, 
                judul: judul || 'Tanpa Judul', 
                kategori: kategoriIdx !== -1 && values[kategoriIdx] ? values[kategoriIdx] : 'Impor', 
                importId,
                createdAt: serverTimestamp(),
                orderIndex: index // 👈 INI YANG MEMASTIKAN URUTAN
            });
        });

        const historyDocRef = doc(db, `artifacts/${appId}/users/${userId}/importHistory`, importId);
        const historyBatch = writeBatch(db);
        historyBatch.set(historyDocRef, { timestamp: serverTimestamp(), promptCount: rows.length, fileName: file.name });
        
        try { 
            await promptsBatch.commit(); 
            await historyBatch.commit(); 
            alert(`${rows.length} prompt berhasil diimpor.`);
            showPage('page-categories');
        } catch (error) { 
            console.error("Error importing:", error); 
        }
    };
    reader.readAsText(file);
    csvFileInput.value = '';
};

const handleExport = () => {
    if (allPrompts.length === 0) { alert("Tidak ada data untuk diekspor."); return; }
    const headers = ['judul', 'kategori', 'promptText'];
    const csvRows = [headers.join(',')];
    const escapeCsvField = (field) => `"${(field || '').toString().replace(/"/g, '""')}"`;
    allPrompts.forEach(p => {
        const row = [p.judul, p.kategori, p.promptText].map(escapeCsvField);
        csvRows.push(row.join(','));
    });
    const csvString = csvRows.join('\r\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'prompts_export.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// --- Helper ---
const handleEditPrompt = (prompt) => {
    document.getElementById('promptId').value = prompt.id;
    document.getElementById('judul').value = prompt.judul || '';
    document.getElementById('kategori').value = prompt.kategori || '';
    document.getElementById('promptText').value = prompt.promptText || '';
    modalTitle.innerText = "Edit Prompt Utama";
    openModal(modal);
};

const openVariationModal = (prompt) => {
    originalPromptText.textContent = prompt.promptText;
    variationResultsContainer.innerHTML = '';
    manualVariationInput.value = '';
    styleVariationSelect.value = '';
    clothingStyleVariationSelect.value = '';
    clothingCoverageVariationSelect.value = '';
    hijabVariationSelect.value = '';
    backgroundVariationSelect.value = '';
    cameraAngleVariationSelect.value = '';
    openModal(variationModal);
};

// --- Event Listeners ---
addPromptBtn.addEventListener('click', (e) => {
    e.preventDefault();
    promptForm.reset();
    document.getElementById('promptId').value = '';
    modalTitle.innerText = "Tambah Prompt Baru";
    openModal(modal);
});

importCsvBtn.addEventListener('click', () => csvFileInput.click());
csvFileInput.addEventListener('change', handleCsvImport);
exportBtn.addEventListener('click', handleExport);
backToCategoriesBtn.addEventListener('click', () => showPage('page-categories'));
backToPromptsBtn.addEventListener('click', () => renderPrompts(allPrompts.filter(p => p.kategori === currentCategory), `Kategori: ${currentCategory}`));
backToCategoriesBtnFromHistory.addEventListener('click', () => showPage('page-categories'));
historyBtn.addEventListener('click', renderHistory);
closeModalBtn.addEventListener('click', (e) => { e.stopPropagation(); closeModal(modal); });
cancelBtn.addEventListener('click', (e) => { e.stopPropagation(); closeModal(modal); });
closeVariationModalBtn.addEventListener('click', (e) => { e.stopPropagation(); closeModal(variationModal); });
closeVariationModalBtnFooter.addEventListener('click', (e) => { e.stopPropagation(); closeModal(variationModal); });
closeSettingsModalBtn.addEventListener('click', (e) => { e.stopPropagation(); closeModal(settingsModal); });
saveApiKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (key) {
        localStorage.setItem('geminiApiKey', key);
        alert("Kunci API berhasil disimpan.");
        closeModal(settingsModal);
    } else {
        alert("Mohon masukkan kunci API.");
    }
});

promptForm.addEventListener('submit', handleSavePrompt);
settingsBtn.addEventListener('click', () => {
    apiKeyInput.value = localStorage.getItem('geminiApiKey') || '';
    openModal(settingsModal);
});
// --- Event Listener untuk Saran Judul & Kategori ---
suggestMetadataBtn.addEventListener('click', async () => {
    const promptText = document.getElementById('promptText').value.trim();
    if (!promptText) {
        alert("Mohon isi Prompt Teks terlebih dahulu.");
        return;
    }

    const apiKey = localStorage.getItem('geminiApiKey');
    if (!apiKey) {
        alert("Kunci API Gemini belum diatur. Silakan masukkan di menu Pengaturan.");
        return;
    }

    metadataSpinner.classList.remove('hidden');
    suggestMetadataBtn.disabled = true;

    const geminiPrompt = `
Berdasarkan prompt gambar AI berikut: "${promptText}", hasilkan satu judul, satu kategori umum, dan satu sub-kategori yang lebih spesifik.

Aturan:
- **Judul:** Buat judul yang deskriptif, menarik, dan maksimal 5 kata.
- **Kategori:** Pilih satu kategori yang paling relevan dari daftar pengelompokan umum (contoh: Potret, Karakter, Ilustrasi, Alam, Arsitektur).
- **Sub-kategori:** Buat satu sub-kategori yang lebih spesifik dan relevan dengan isi prompt (maksimal 2 kata).
- **Format:** Berikan hasil Anda hanya dalam format JSON seperti berikut:
{"title": "Judul yang disarankan", "category": "Kategori Umum", "sub_category": "Kategori Spesifik"}
`;

    const schema = { 
        type: "OBJECT", 
        properties: { 
            "title": { "type": "STRING" }, 
            "category": { "type": "STRING" } 
        },
        required: ["title", "category"]
    };

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: geminiPrompt }] }],
                generationConfig: { responseMimeType: "application/json", responseSchema: schema }
            })
        });

        if (!response.ok) {
            const error = await response.json();
            console.error("Gemini API Error:", error);
            alert("Gagal memanggil AI. Periksa kunci API Anda.");
            return;
        }

        const result = await response.json();
        const content = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!content) {
            alert("AI tidak mengembalikan data.");
            return;
        }

        const parsed = JSON.parse(content);
        document.getElementById('judul').value = parsed.title || '';
        document.getElementById('kategori').value = parsed.category || '';

    } catch (error) {
        console.error("Error saat memproses saran:", error);
        alert("Gagal mendapatkan saran dari AI. Coba lagi.");
    } finally {
        metadataSpinner.classList.add('hidden');
        suggestMetadataBtn.disabled = false;
    }
});

globalSearchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    if (searchTerm.length < 3) {
        showPage('page-categories');
        return;
    }
    const results = allPrompts.filter(p => p.judul.toLowerCase().includes(searchTerm) || p.promptText.toLowerCase().includes(searchTerm));
    renderPrompts(results, `Hasil Pencarian untuk: "${searchTerm}"`);
});

// --- Autentikasi ---
loginBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Login error:", error);
        alert("Gagal masuk.");
    }
});

logoutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Logout error:", error);
    }
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        userId = user.uid;
        appContainer.classList.remove('hidden');
        loginPage.classList.add('hidden');
        userInfo.innerHTML = `<img src="${user.photoURL}" alt="Foto Profil" class="profile-picture"><span class="font-semibold text-gray-700">${user.displayName}</span>`;
        setupListeners();
        showPage('page-categories');
    } else {
        userId = null;
        appContainer.classList.add('hidden');
        loginPage.classList.remove('hidden');
        loginPage.classList.add('active');
        if (unsubscribePrompts) unsubscribePrompts();
        if (unsubscribeHistory) unsubscribeHistory();
        if (unsubscribeVariations) unsubscribeVariations();
        allPrompts = [];
        importHistory = [];
        categoryGrid.innerHTML = '';
        emptyStateCategories.classList.remove('hidden');
    }
});

// --- Fitur Buat Variasi ---
generateVariationBtn.addEventListener('click', async () => {
    if (!currentPromptId) {
        alert("Prompt tidak dipilih. Buka detail prompt terlebih dahulu.");
        return;
    }
    const prompt = allPrompts.find(p => p.id === currentPromptId);
    if (!prompt) {
        alert("Prompt tidak ditemukan.");
        return;
    }

    let instruction = manualVariationInput.value.trim();
    if (!instruction) {
        const variations = [
            styleVariationSelect.value,
            clothingStyleVariationSelect.value,
            clothingCoverageVariationSelect.value,
            hijabVariationSelect.value,
            backgroundVariationSelect.value,
            cameraAngleVariationSelect.value
        ].filter(v => v);
        instruction = variations.join(', ');
    }
    if (!instruction) {
        alert("Silakan pilih setidaknya satu variasi atau tulis perubahan manual.");
        return;
    }

    variationSpinner.classList.remove('hidden');
    generateVariationBtn.disabled = true;
    variationResultsContainer.innerHTML = `<div class="flex justify-center items-center p-4"><div class="spinner"></div><p class="ml-3 text-sm text-gray-500">Membuat variasi...</p></div>`;

    const geminiPrompt = `
You are a world-class, expert prompt engineer for photorealistic image generation. Your task is to creatively and intelligently rewrite a base prompt into three distinct, high-quality variations based on a set of modification instructions.

Follow these rules STRICTLY:
1.  **Integrate, Don't Just Append:** You must intelligently integrate the instructions into the prompt's structure. DO NOT simply append the instructions at the end. The final prompt must be a single, coherent sentence.
2.  **Maintain Original Language:** The output language MUST exactly match the language of the original prompt. If the original is in English, all variations must be in English.
3.  **Preserve Core Concepts:** You must preserve the core, defining elements of the original prompt (like a specific character, a key object, or an unchangeable attribute like "hijab" or "glasses") unless the instructions explicitly ask to change them.
4.  **No Rendering Terms for Realism:** For prompts with a realistic or photographic style, you are STRICTLY FORBIDDEN from using words like 'render', 'rendering', '3D', 'OC rendering', 'unreal engine', etc. If the original prompt contains these words, you must REMOVE them.
5.  **Create 3 Distinct Variations:** Each of the three variations should be unique.

BASE PROMPT:
"""
${prompt.promptText}
"""

MODIFICATION INSTRUCTIONS:
"""
Apply the following changes: ${instruction}
"""

Now, generate the three variations.
`;

    const schema = { type: "OBJECT", properties: { "variations": { "type": "ARRAY", "items": { "type": "STRING" } } } };
    const result = await callGemini(geminiPrompt, schema);

    variationResultsContainer.innerHTML = '';
    variationSpinner.classList.add('hidden');
    generateVariationBtn.disabled = false;

    if (result && result.variations) {
        result.variations.forEach((text) => {
            const div = document.createElement('div');
            div.className = 'variation-suggestion bg-white p-3 rounded-lg shadow-sm';
            div.innerHTML = `<p class="text-sm">${text}</p><div class="flex justify-end gap-3 mt-2"><button class="copy-new-variation-btn text-sm font-semibold text-indigo-600 hover:text-indigo-800">Salin</button><button class="save-new-variation-btn text-sm font-semibold text-green-600 hover:text-green-800">Simpan ke Riwayat</button></div>`;
            variationResultsContainer.appendChild(div);
        });
    } else {
        variationResultsContainer.innerHTML = `<p class="text-red-500 text-sm p-4">Gagal membuat variasi. Coba lagi.</p>`;
    }
});

variationResultsContainer.addEventListener('click', async (e) => {
    const saveBtn = e.target.closest('.save-new-variation-btn');
    if (saveBtn) {
        const button = saveBtn;
        button.textContent = 'Menyimpan...';
        button.disabled = true;
        const suggestion = saveBtn.closest('.variation-suggestion');
        const textToSave = suggestion.querySelector('p').textContent;
        try {
            const path = `artifacts/${appId}/users/${userId}/prompts/${currentPromptId}/variations`;
            await addDoc(collection(db, path), { promptText: textToSave, createdAt: serverTimestamp() });
            suggestion.remove();
        } catch (error) {
            console.error("Gagal menyimpan variasi:", error);
            alert("Gagal menyimpan.");
            button.textContent = 'Simpan ke Riwayat';
            button.disabled = false;
        }
    }

    const copyBtn = e.target.closest('.copy-new-variation-btn');
    if (copyBtn) {
        const text = copyBtn.closest('.variation-suggestion').querySelector('p').textContent;
        copyToClipboard(text, copyBtn);
    }
});
