// DOM要素の取得
const loader = document.getElementById('loader');
const loaderText = document.getElementById('loaderText');
const resultsSection = document.getElementById('resultsSection');
const videoList = document.getElementById('videoList');
const totalCountDisplay = document.getElementById('totalCountDisplay');
const topPagination = document.getElementById('topPagination');
const bottomPagination = document.getElementById('bottomPagination');
const searchSection = document.getElementById('searchSection');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');

// 並び替え用ボタンのDOM取得
const sortSection = document.getElementById('sortSection');
const sortDateBtn = document.getElementById('sortDateBtn');
const sortTitleBtn = document.getElementById('sortTitleBtn');

// ==========================================
// ⚠️ 【あなた専用のデータ書き出し設定】
// JSONファイルを作るときだけ、ここに自分のキーを書き込んでください。
// ファイルを作った後は、ここを空（''）のまま GitHub にアップします。
const MY_API_KEY =''; 
const MY_CHANNEL_ID =''; 
// ==========================================

// グローバル変数
let allVideos = [];
let filteredVideos = []; 
let currentPage = 1;
let currentSortType = 'date'; // 'date' または 'title'
const ITEMS_PER_PAGE = 100;

const API_BASE_URL = 'https://www.googleapis.com/youtube/v3';

// 初期化処理
async function init() {
    allVideos = [];
    filteredVideos = [];
    currentPage = 1;
    resultsSection.classList.add('hidden');
    searchSection.classList.add('hidden');
    sortSection.classList.add('hidden');
    loader.classList.remove('hidden');

    // APIキーが入力されている場合は「データ抽出モード（あなた用）」
    if (MY_API_KEY && MY_API_KEY !== 'ここにあなたのAPIキーを貼り付け' && MY_CHANNEL_ID && MY_CHANNEL_ID !== 'ここにあなたのチャンネルIDを貼り付け') {
        try {
            loaderText.textContent = '【管理者モード】チャンネル情報を取得中...';
            const uploadsPlaylistId = await getUploadsPlaylistId(MY_API_KEY, MY_CHANNEL_ID);
            if (!uploadsPlaylistId) throw new Error('プレイリストが見つかりません。');
            
            loaderText.textContent = '【管理者モード】動画データを通信取得中...';
            await fetchAllVideos(MY_API_KEY, uploadsPlaylistId);
            
            // 抽出完了後に自動ダウンロードボタンを設置
            createDownloadButton();
            
            startApp();
        } catch (error) {
            alert(`API取得エラー: ${error.message}`);
            loader.classList.add('hidden');
        }
    } 
    // APIキーがない場合は「JSON読み込みモード（ユーザー用）」
    else {
        try {
            loaderText.textContent = 'データを読み込み中...';
            const response = await fetch('videos.json');
            if (!response.ok) throw new Error('videos.json が見つからないか、読み込めません。');
            
            allVideos = await response.json();
            startApp();
        } catch (error) {
            console.error(error);
            alert('データの読み込みに失敗しました。videos.jsonが正しく配置されているか確認してください。');
            loader.classList.add('hidden');
        }
    }
}

// データの準備ができた後にアプリを起動する
function startApp() {
    // 初期ソートは「日付が新しい順」
    sortVideos('date');
    filteredVideos = [...allVideos];
    
    renderPage();
    
    loader.classList.add('hidden');
    searchSection.classList.remove('hidden');
    sortSection.classList.remove('hidden');
    resultsSection.classList.remove('hidden');
}

init();

// ==========================================
// データ抽出＆保存用ロジック（あなた用）
// ==========================================
async function getUploadsPlaylistId(apiKey, channelId) {
    const url = `${API_BASE_URL}/channels?part=contentDetails&id=${channelId}&key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    if (data.items && data.items.length > 0) return data.items[0].contentDetails.relatedPlaylists.uploads;
    return null;
}

async function fetchAllVideos(apiKey, playlistId) {
    let nextPageToken = '';
    let fetchedCount = 0;
    do {
        let url = `${API_BASE_URL}/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}&key=${apiKey}`;
        if (nextPageToken) url += `&pageToken=${nextPageToken}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        
        if (data.items) {
            data.items.forEach(item => {
                const snippet = item.snippet;
                const thumbnailUrl = snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || '';
                allVideos.push({
                    title: snippet.title,
                    videoId: snippet.resourceId.videoId,
                    thumbnail: thumbnailUrl,
                    publishedAt: snippet.publishedAt
                });
            });
            fetchedCount += data.items.length;
            loaderText.textContent = `【管理者モード】動画を取得中... (${fetchedCount}件取得済み)`;
        }
        nextPageToken = data.nextPageToken;
    } while (nextPageToken);
}
// 画面最上部にJSONダウンロード用の案内ボタンを作る関数
function createDownloadButton() {
    const btn = document.createElement('button');
    btn.textContent = '✨ 抽出したデータを videos.json として保存';
    btn.className = 'primary-btn';
    btn.style.width = '100%';
    btn.style.marginBottom = '2rem';
    btn.style.backgroundColor = '#10b981'; // 緑色
    
    btn.addEventListener('click', () => {
        const jsonString = JSON.stringify(allVideos, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "videos.json";
        link.click();
        URL.revokeObjectURL(link.href);
    });
    document.querySelector('.container').insertBefore(btn, document.getElementById('searchSection'));
}

// ==========================================
// 並び替え（ソート）処理
// ==========================================
function sortVideos(type) {
    currentSortType = type;
    if (type === 'date') {
        // 公開日が新しい順（降順）
        allVideos.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
        // ボタンの見た目の切り替え
        sortDateBtn.style.backgroundColor = 'var(--primary-color)';
        sortDateBtn.style.color = 'white';
        sortTitleBtn.style.backgroundColor = 'var(--bg-main)';
        sortTitleBtn.style.color = 'var(--text-main)';
    } else if (type === 'title') {
        // タイトル順（あいうえお・ABC順）
        allVideos.sort((a, b) => a.title.localeCompare(b.title, 'ja'));
        // ボタンの見た目の切り替え
        sortTitleBtn.style.backgroundColor = 'var(--primary-color)';
        sortTitleBtn.style.color = 'white';
        sortDateBtn.style.backgroundColor = 'var(--bg-main)';
        sortDateBtn.style.color = 'var(--text-main)';
    }
}

// 並び替えボタンのイベント監視
sortDateBtn.addEventListener('click', () => {
    sortVideos('date');
    applySearchAndRender();
});
sortTitleBtn.addEventListener('click', () => {
    sortVideos('title');
    applySearchAndRender();
});

// ==========================================
// 検索処理
// ==========================================
function applySearchAndRender() {
    const keyword = searchInput.value.trim().toLowerCase();
    if (keyword === '') {
        filteredVideos = [...allVideos];
    } else {
        filteredVideos = allVideos.filter(video => 
            video.title.toLowerCase().includes(keyword)
        );
    }
    currentPage = 1;
    renderPage();
}

searchBtn.addEventListener('click', applySearchAndRender);
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') applySearchAndRender();
});

// ==========================================
// 描画・ページネーション処理
// ==========================================
function renderPage() {
    videoList.innerHTML = '';
    totalCountDisplay.textContent = `全 ${filteredVideos.length} 件`;
    
    if (filteredVideos.length === 0) {
        videoList.innerHTML = '<li>動画が見つかりませんでした。</li>';
        topPagination.innerHTML = '';
        bottomPagination.innerHTML = '';
        return;
    }
    
    const totalPages = Math.ceil(filteredVideos.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, filteredVideos.length);
    
    const pageVideos = filteredVideos.slice(startIndex, endIndex);
    
    pageVideos.forEach(video => {
        const li = document.createElement('li');
        li.className = 'video-item';
        
        const videoUrl = `https://youtube.com{video.videoId}`;
        
        const thumbDiv = document.createElement('div');
        thumbDiv.className = 'video-thumb';
        if (video.thumbnail) {
            const img = document.createElement('img');
            img.src = video.thumbnail;
            img.alt = 'thumbnail';
            img.loading = 'lazy';
            thumbDiv.appendChild(img);
        }
        
        const infoDiv = document.createElement('div');
        infoDiv.className = 'video-info';
        
        const titleLink = document.createElement('a');
        titleLink.className = 'video-title';
        titleLink.href = videoUrl;
        titleLink.target = '_blank';
        titleLink.rel = 'noopener noreferrer';
        titleLink.textContent = video.title;
        
        // 公開日のプチ表示
        const dateP = document.createElement('p');
        dateP.style.fontSize = '0.8rem';
        dateP.style.color = 'var(--text-muted)';
        dateP.style.marginTop = '0.25rem';
        dateP.textContent = `公開日: ${video.publishedAt.substring(0, 10)}`;
        
        infoDiv.appendChild(titleLink);
        infoDiv.appendChild(dateP);
        li.appendChild(thumbDiv);
        li.appendChild(infoDiv);
        videoList.appendChild(li);
    });
    
    renderPaginationControls(totalPages);
}

function renderPaginationControls(totalPages) {
    const controlsHtml = `
        <button class="page-btn" id="prevBtn" ${currentPage === 1 ? 'disabled' : ''}>前へ</button>
        <span class="page-info">${currentPage} / ${totalPages} ページ</span>
        <button class="page-btn" id="nextBtn" ${currentPage === totalPages ? 'disabled' : ''}>次へ</button>
    `;
    topPagination.innerHTML = controlsHtml;
    bottomPagination.innerHTML = controlsHtml;
    
    const topPrev = topPagination.querySelector('#prevBtn');
    const topNext = topPagination.querySelector('#nextBtn');
    if (topPrev) topPrev.addEventListener('click', () => goToPage(currentPage - 1));
    if (topNext) topNext.addEventListener('click', () => goToPage(currentPage + 1));
    
    const bottomPrev = bottomPagination.querySelector('#prevBtn');
    const bottomNext = bottomPagination.querySelector('#nextBtn');
    if (bottomPrev) bottomPrev.addEventListener('click', () => goToPage(currentPage - 1));
    if (bottomNext) bottomNext.addEventListener('click', () => goToPage(currentPage + 1));
}

function goToPage(page) {
    currentPage = page;
    renderPage();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
