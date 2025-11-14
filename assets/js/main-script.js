const supabaseConfig = {
    url: 'https://ktasovkzriskdjrtxkpk.supabase.co', 
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0YXNvdmt6cmlza2RqcnR4a3BrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2NjEzNzcsImV4cCI6MjA3NzIzNzM3N30.tkmIYZ0KSWPCYhYEk7139Qvn0BHcE4gWMGNujR6arGw' 
};

const { createClient } = supabase;
const supabaseClient = createClient(supabaseConfig.url, supabaseConfig.key);

let currentPostId = null;
let currentImageId = null; 

// Variáveis para a Galeria Interativa (Frontend)
let galleryImagesData = [];
let currentImageIndex = 0;
let startX = 0; // Para detecção de swipe

// =========================================================
// FUNÇÕES DE UTILIDADE E MODAIS (NOVAS E CORRIGIDAS)
// =========================================================

/**
 * Aplica formatação simples (HTML) ou abre modais. (CORRIGIDO)
 * Está fora do DOMContentLoaded para ser chamada facilmente pelos listeners.
 */
function applyFormat(format, param = null) {
    const textarea = document.getElementById('postContent');
    if (!textarea) return; 
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    let newText = '';
    let offset = 0; 

    switch (format) {
        // Formatos HTML Simples
        case 'bold':
            newText = `<strong>${selectedText}</strong>`;
            offset = 8; // <strong>
            break;
        case 'italic':
            newText = `<em>${selectedText}</em>`;
            offset = 4; // <em>
            break;
        case 'underline':
            newText = `<u>${selectedText}</u>`; 
            offset = 4; // <u>
            break;
        case 'heading':
            newText = `\n\n<h2>${selectedText || 'Título Secundário'}</h2>\n\n`;
            offset = 5; // <h2>
            break;
        case 'blockquote':
            newText = `\n\n<blockquote>${selectedText || 'Insira sua citação aqui'}</blockquote>\n\n`;
            offset = 12; // <blockquote>
            break;
        case 'hr':
            newText = `\n\n<hr />\n\n`;
            offset = 0;
            break;
        
        // Formatos com Prompt (Link)
        case 'link':
            const urlLink = prompt('Insira a URL do link:', 'https://');
            if (!urlLink) return;
            const textLink = selectedText || prompt('Insira o texto do link:', 'Clique Aqui');
            if (!textLink) return;
            // Gera um link HTML com target blank
            newText = `<a href="${urlLink}" target="_blank">${textLink}</a>`;
            break;

        // Modais (Abre e encerra a função)
        // 'image' e 'frame' foram removidos
            
        case 'media': // BOTÃO ÚNICO DE MÍDIA
            openMediaModal();
            return; 
        case 'custom-style':
            openStyleModal();
            return; 
        default:
            return;
    }

    // Lógica para inserção e reposicionamento do cursor
    
    // Insere o novo texto formatado
    textarea.value = textarea.value.substring(0, start) + newText + textarea.value.substring(end);
    
    // Reposiciona o cursor ou seleção
    if (['bold', 'italic', 'underline', 'heading', 'blockquote'].includes(format) && !selectedText) {
        // Se não havia texto selecionado, posiciona o cursor DENTRO da tag
        textarea.selectionStart = start + offset;
        textarea.selectionEnd = start + newText.length - (offset + 1); // Ex: <strong>[cursor]</strong>
    } else {
        // Se havia texto selecionado, ou é um link/imagem, posiciona DEPOIS
        textarea.selectionStart = start + newText.length;
        textarea.selectionEnd = textarea.selectionStart;
    }
    
    textarea.focus();
}

/**
 * Função utilitária para inserir texto na posição do cursor/seleção.
 */
function insertAtCursor(textarea, textToInsert) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    textarea.value = textarea.value.substring(0, start) + textToInsert + textarea.value.substring(end);
    
    const newPosition = start + textToInsert.length;
    textarea.selectionStart = newPosition;
    textarea.selectionEnd = newPosition;
    textarea.focus();
}

/**
 * Função para lidar com a submissão de formulários de modais.
 */
function handleModalSubmit(e, contentGenerator, modalId, messageId, closeModalAfter = true) {
    e.preventDefault();
    
    const postContentTextarea = document.getElementById('postContent');
    const modal = document.getElementById(modalId);
    const messageElement = document.getElementById(messageId);
    
    if (!postContentTextarea || !modal || !messageElement) return;

    messageElement.style.display = 'none'; 

    try {
        const generatedContent = contentGenerator(e.target);
        
        if (generatedContent) {
            insertAtCursor(postContentTextarea, generatedContent);
            
            e.target.reset(); 
            
            if(closeModalAfter) modal.style.display = 'none'; 
            
            // Exibe mensagem de sucesso
            messageElement.textContent = 'Conteúdo inserido com sucesso!';
            messageElement.className = 'modal-message success';
            messageElement.style.display = 'block';

            setTimeout(() => {
                messageElement.style.display = 'none';
            }, 3000);
        }

    } catch (error) {
        messageElement.textContent = `Erro: ${error.message}`;
        messageElement.className = 'modal-message error';
        messageElement.style.display = 'block';
    }
}

// A função 'handleImageModalSubmit' foi removida
// A função 'openImageModal' foi removida

// Funções para abrir os modais
function openMediaModal() {
    const mediaModal = document.getElementById('mediaModal');
    if (mediaModal) mediaModal.style.display = 'block';
}

function openStyleModal() {
    const styleModal = document.getElementById('styleModal');
    if (styleModal) styleModal.style.display = 'block';
}


// =========================================================
// FUNÇÕES DE AUTENTICAÇÃO E ADMIN (MANTIDAS DO SEU CÓDIGO)
// =========================================================

async function checkAdminPassword(password) {
    const { data, error } = await supabaseClient
        .from('admin_config') 
        .select('secret_key')
        .eq('id', 1) 
        .single();

    if (error) {
        console.error("Erro ao buscar chave secreta:", error.message);
        return false;
    }

    if (data && data.secret_key === password) {
        sessionStorage.setItem('isAdminLoggedIn', 'true');
        return true;
    }
    return false;
}

function checkAuthStatus() {
    return sessionStorage.getItem('isAdminLoggedIn') === 'true';
}

function handleLogout() {
    sessionStorage.removeItem('isAdminLoggedIn');
    window.location.reload();
}

// =========================================================
// LÓGICA DE SUGESTÕES (MANTIDAS DO SEU CÓDIGO)
// =========================================================

async function loadSuggestions() {
    const listDiv = document.getElementById('suggestionList');
    if (!listDiv) {
        console.error("Elemento #suggestionList não encontrado no DOM.");
        return;
    }
    listDiv.innerHTML = '<p class="loading-message">Carregando sugestões...</p>';

    const { data: sugestoes, error } = await supabaseClient
        .from('sugestoes')
        .select('id, nome, email, ideia, created_at')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("ERRO AO CARREGAR SUGESTÕES:", error);
        listDiv.innerHTML = `<p class="error-message">Erro ao carregar sugestões: ${error.message}.</p>`;
        return;
    }

    if (!sugestoes || sugestoes.length === 0) {
        listDiv.innerHTML = `<p>Nenhuma sugestão enviada.</p>`;
        return;
    }
    
    const suggestionsHtml = sugestoes.map(s => {
        return `
            <div class="suggestion-item">
                <div>
                    <p><strong>${s.nome || 'Anônimo'}</strong> (${s.email || 'N/A'})</p>
                    <p>${s.ideia}</p>
                    <span class="meta">${new Date(s.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
                <button class="delete-suggestion-btn" data-id="${s.id}">Excluir</button>
            </div>
        `;
    }).join('');

    listDiv.innerHTML = suggestionsHtml;
}

async function deleteSuggestion(id) {
    if (!confirm('Deseja excluir esta sugestão?')) return;
    
    const { error } = await supabaseClient
        .from('sugestoes')
        .delete()
        .eq('id', id);

    if (error) {
        alert('Erro ao excluir sugestão: ' + error.message);
    } else {
        loadSuggestions();
    }
}

async function handleSuggestionSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('sugestaoName').value;
    const email = document.getElementById('sugestaoEmail').value;
    const idea = document.getElementById('sugestaoIdea').value;
    const messageEl = document.getElementById('sugestaoMessage');

    const { error } = await supabaseClient
        .from('sugestoes')
        .insert([{ nome: name, email: email, ideia: idea }]);

    if (error) {
        messageEl.textContent = 'Erro ao enviar sugestão: ' + error.message;
        messageEl.className = 'message error';
    } else {
        messageEl.textContent = 'Sugestão enviada com sucesso! Obrigado.';
        messageEl.className = 'message success';
        document.getElementById('suggestionForm').reset();
    }
    messageEl.style.display = 'block';
    setTimeout(() => messageEl.style.display = 'none', 5000);
}


// =========================================================
// LÓGICA DE POSTS ADMIN (MANTIDAS DO SEU CÓDIGO)
// =========================================================

async function loadAdminPosts() {
    const postListDiv = document.getElementById('postList');
    if (!postListDiv) return;
    postListDiv.innerHTML = '<p>Carregando posts para edição...</p>';

    const { data: posts, error } = await supabaseClient
        .from('posts')
        .select('*')
        .order('data_publicacao', { ascending: false }); 

    if (error) {
        postListDiv.innerHTML = `<p class="error-message">Erro: ${error.message}</p>`;
        return;
    }

    postListDiv.innerHTML = '';
    posts.forEach(post => {
        const postItem = document.createElement('div');
        postItem.classList.add('post-item');
        
        postItem.innerHTML = `
            <div>
                <h3>${post.titulo}</h3>
                <p>Autor: ${post.autor} | ${new Date(post.data_publicacao).toLocaleDateString('pt-BR')}</p>
            </div>
            <div>
                <button class="edit-post-btn" data-id="${post.id}">Editar</button>
                <button class="delete-post-btn" data-id="${post.id}">Excluir</button>
            </div>
        `;
        postListDiv.appendChild(postItem);
    });
}

async function editPost(postId) {
    currentPostId = postId;
    const postForm = document.getElementById('postForm');
    postForm.style.display = 'block';
    
    postForm.scrollIntoView({ behavior: 'smooth' });

    const { data: post, error } = await supabaseClient
        .from('posts')
        .select('*')
        .eq('id', postId)
        .single();

    if (error) {
        alert('Erro ao carregar post para edição: ' + error.message);
        return;
    }

    document.getElementById('postTitle').value = post.titulo;
    document.getElementById('postAuthor').value = post.autor;
    
    const dateOnly = post.data_publicacao ? new Date(post.data_publicacao).toISOString().substring(0, 10) : '';
    document.getElementById('postDate').value = dateOnly;
    
    document.getElementById('postImage').value = post.image_url || '';
    document.getElementById('postShortDesc').value = post.short_descrip || '';
    document.getElementById('postContent').value = post.conteudo || '';
    document.getElementById('postTags').value = post.tags ? post.tags.join(', ') : '';

    document.getElementById('postForm').querySelector('h3').textContent = 'Editar Postagem (ID: ' + postId + ')';
}

async function savePost(e) {
    e.preventDefault();

    const isEditing = currentPostId !== null;
    
    const tagsArray = document.getElementById('postTags').value.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    
    const postData = {
        titulo: document.getElementById('postTitle').value,
        autor: document.getElementById('postAuthor').value,
        data_publicacao: document.getElementById('postDate').value,
        image_url: document.getElementById('postImage').value.trim() || null, 
        short_descrip: document.getElementById('postShortDesc').value,
        conteudo: document.getElementById('postContent').value,
        tags: tagsArray
    };

    let result;
    if (isEditing) {
        result = await supabaseClient
            .from('posts')
            .update(postData)
            .eq('id', currentPostId);
    } else {
        result = await supabaseClient
            .from('posts')
            .insert([postData]);
    }

    if (result.error) {
        alert(`Erro ao ${isEditing ? 'atualizar' : 'criar'} post: ${result.error.message}`);
    } else {
        alert(`Postagem ${isEditing ? 'atualizada' : 'criada'} com sucesso!`);
        document.getElementById('postEditorForm').reset();
        document.getElementById('postForm').style.display = 'none';
        currentPostId = null;
        loadAdminPosts(); 
    }
}

async function deletePost(postId) {
    if (!confirm('Tem certeza que deseja EXCLUIR este post permanentemente?')) return;

    const { error } = await supabaseClient
        .from('posts')
        .delete()
        .eq('id', postId);

    if (error) {
        alert('Erro ao excluir post: ' + error.message);
    } else {
        alert('Post excluído com sucesso!');
        loadAdminPosts(); 
    }
}

// =========================================================
// LÓGICA DE GALERIA ADMIN (MANTIDAS DO SEU CÓDIGO)
// =========================================================

async function loadAdminGalleryImages() {
    const galleryListDiv = document.getElementById('galleryList');
    if (!galleryListDiv) return;
    galleryListDiv.innerHTML = '<p>Carregando imagens da galeria para edição...</p>';

    const { data: images, error } = await supabaseClient
        .from('galeria')
        .select('*')
        .order('id', { ascending: false }); 

    if (error) {
        galleryListDiv.innerHTML = `<p class="error-message">Erro: ${error.message}</p>`;
        return;
    }

    galleryListDiv.innerHTML = '';
    images.forEach(img => {
        const imageItem = document.createElement('div');
        imageItem.classList.add('post-item'); 
        
        imageItem.innerHTML = `
            <div>
                <h3>${img.alt_text}</h3>
                <p>URL: ${img.image_url.substring(0, 50)}...</p>
            </div>
            <div>
                <button class="edit-image-btn" data-id="${img.id}">Editar</button>
                <button class="delete-image-btn" data-id="${img.id}">Excluir</button>
            </div>
        `;
        galleryListDiv.appendChild(imageItem);
    });
}

async function editGalleryImage(imageId) {
    currentImageId = imageId;
    const galleryForm = document.getElementById('galleryForm');
    galleryForm.style.display = 'block';
    
    galleryForm.scrollIntoView({ behavior: 'smooth' });

    const { data: image, error } = await supabaseClient
        .from('galeria')
        .select('*')
        .eq('id', imageId)
        .single();

    if (error) {
        alert('Erro ao carregar imagem para edição: ' + error.message);
        return;
    }

    document.getElementById('imageUrl').value = image.image_url;
    document.getElementById('imageAltText').value = image.alt_text;

    document.getElementById('galleryForm').querySelector('h3').textContent = 'Editar Imagem (ID: ' + imageId + ')';
}

async function saveGalleryImage(e) {
    e.preventDefault();

    const isEditing = currentImageId !== null;
    
    const imageData = {
        image_url: document.getElementById('imageUrl').value.trim(),
        alt_text: document.getElementById('imageAltText').value,
    };

    let result;
    if (isEditing) {
        result = await supabaseClient
            .from('galeria')
            .update(imageData)
            .eq('id', currentImageId);
    } else {
        result = await supabaseClient
            .from('galeria')
            .insert([imageData]);
    }

    if (result.error) {
        alert(`Erro ao ${isEditing ? 'atualizar' : 'criar'} imagem: ${result.error.message}`);
    } else {
        alert(`Imagem ${isEditing ? 'atualizada' : 'adicionada'} com sucesso!`);
        document.getElementById('galleryEditorForm').reset();
        document.getElementById('galleryForm').style.display = 'none';
        currentImageId = null;
        loadAdminGalleryImages(); 
    }
}

async function deleteGalleryImage(imageId) {
    if (!confirm('Tem certeza que deseja EXCLUIR esta imagem permanentemente da galeria?')) return;

    const { error } = await supabaseClient
        .from('galeria')
        .delete()
        .eq('id', imageId);

    if (error) {
        alert('Erro ao excluir imagem: ' + error.message);
    } else {
        alert('Imagem excluída com sucesso!');
        loadAdminGalleryImages(); 
    }
}

// =========================================================
// LÓGICA DE POSTS FRONTEND (MANTIDAS DO SEU CÓDIGO)
// =========================================================

async function loadAllPosts() {
    const postsGrid = document.getElementById('postsGrid');
    if (!postsGrid) return;
    
    const reloadBtn = document.getElementById('reloadPostsBtn');
    if(reloadBtn) {
        reloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Carregando...';
        reloadBtn.disabled = true;
    }
    
    postsGrid.innerHTML = '<p class="loading">Carregando as últimas notícias...</p>';

    const { data: posts, error } = await supabaseClient
        .from('posts')
        .select('*')
        .order('data_publicacao', { ascending: false }); 

    if (reloadBtn) {
        reloadBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Recarregar Posts';
        reloadBtn.disabled = false;
    }

    if (error) {
        postsGrid.innerHTML = `<p class="error-message">Erro ao carregar posts: ${error.message}. Tente recarregar.</p>`;
        return;
    }

    postsGrid.innerHTML = '';
    
    if (posts.length === 0) {
        postsGrid.innerHTML = `<p class="empty-message">Nenhuma postagem publicada ainda.</p>`;
        return;
    }

    posts.forEach(post => {
        const postCard = document.createElement('div');
        postCard.classList.add('post-card');
        postCard.addEventListener('click', () => showPostDetails(post.id));

        const imageUrl = post.image_url && post.image_url.trim() !== '' 
            ? post.image_url 
            : 'images/default-cover.png'; 

        postCard.innerHTML = `
            <img src="${imageUrl}" alt="${post.titulo}" loading="lazy">
            <div class="card-info">
                <h3 class="post-title">${post.titulo}</h3>
                <p class="post-summary">${post.short_descrip ? post.short_descrip.substring(0, 120) + '...' : ''}</p>
                <div class="post-meta">
                    <span class="date">${new Date(post.data_publicacao).toLocaleDateString('pt-BR')}</span>
                    <span class="author">${post.autor}</span>
                </div>
            </div>
        `;
        postsGrid.appendChild(postCard);
    });
}

async function showPostDetails(postId) {
    const homeSection = document.getElementById('home');
    const detailsSection = document.getElementById('post-details');

    if (homeSection) homeSection.classList.remove('active');
    if (detailsSection) detailsSection.classList.add('active');
    
    window.scrollTo(0, 0);

    const { data: post, error } = await supabaseClient
        .from('posts')
        .select('*')
        .eq('id', postId)
        .single();

    if (error) {
        alert('Erro ao carregar detalhes do post: ' + error.message);
        if (detailsSection) detailsSection.classList.remove('active');
        if (homeSection) homeSection.classList.add('active');
        return;
    }
    
    const imageUrl = post.image_url && post.image_url.trim() !== '' 
        ? post.image_url 
        : 'images/default-cover.png'; 

    document.getElementById('detailImage').src = imageUrl;
    document.getElementById('detailTitle').textContent = post.titulo;
    document.getElementById('detailDate').textContent = new Date(post.data_publica).toLocaleDateString('pt-BR');
    document.getElementById('detailAuthor').textContent = post.autor;
    
    // Renderiza o conteúdo (incluindo o novo HTML/CSS)
    document.getElementById('detailContent').innerHTML = post.conteudo || '';
    
    const tagsContainer = document.getElementById('detailTags');
    const tagsHtml = post.tags && post.tags.length > 0
        ? post.tags.map(tag => `<span class="tag">${tag}</span>`).join(' ')
        : '<span>Sem tags</span>';
    tagsContainer.innerHTML = tagsHtml;
}

// =========================================================
// LÓGICA DE GALERIA FRONTEND E LIGHTBOX (MANTIDAS DO SEU CÓDIGO)
// =========================================================

async function loadGalleryImages() {
    const galleryGrid = document.getElementById('galleryGrid');
    if (!galleryGrid) return;
    galleryGrid.innerHTML = '<p class="loading">Carregando galeria...</p>';
    
    const { data: images, error } = await supabaseClient
        .from('galeria')
        .select('*')
        .order('id', { ascending: false });

    if (error) {
        galleryGrid.innerHTML = `<p class="error-message">Erro ao carregar imagens: ${error.message}</p>`;
        return;
    }

    galleryImagesData = images; // Salva os dados para navegação no modal
    galleryGrid.innerHTML = '';

    images.forEach((img, index) => {
        const item = document.createElement('div');
        item.classList.add('gallery-item');
        item.dataset.index = index; 

        item.innerHTML = `
            <img src="${img.image_url}" alt="${img.alt_text}" loading="lazy">
            <div class="alt-text-overlay">${img.alt_text}</div>
        `;
        
        item.addEventListener('click', () => openModal(index));
        galleryGrid.appendChild(item);
    });

    if (images.length === 0) {
        galleryGrid.innerHTML = `<p class="empty-message">Nenhuma imagem na galeria ainda.</p>`;
    }
}

function openModal(index) {
    currentImageIndex = index;
    const modal = document.getElementById('galleryModal');
    const modalImg = document.getElementById('modalImage');
    const captionText = document.getElementById('caption');
    
    if (galleryImagesData.length === 0) return;

    const imgData = galleryImagesData[currentImageIndex];

    modal.style.display = "block";
    modalImg.src = imgData.image_url;
    captionText.innerHTML = imgData.alt_text;
}

function closeModal() {
    document.getElementById('galleryModal').style.display = "none";
}

function changeImage(n) {
    currentImageIndex += n;
    
    if (currentImageIndex >= galleryImagesData.length) {
        currentImageIndex = 0; 
    }
    if (currentImageIndex < 0) {
        currentImageIndex = galleryImagesData.length - 1; 
    }
    
    openModal(currentImageIndex);
}

// =========================================================
// INICIALIZAÇÃO E LISTENERS GERAIS (UNIFICADOS)
// =========================================================

document.addEventListener('DOMContentLoaded', () => {
    
    // --- LÓGICA GERAL DE NAVEGAÇÃO DO HEADER ---
    document.querySelectorAll('header nav a').forEach(link => {
        link.addEventListener('click', function(e) {
            if (!this.getAttribute('href').startsWith('#')) {
                return; 
            }
            
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            
            document.querySelectorAll('.page-section').forEach(section => {
                section.classList.remove('active');
            });
            document.querySelectorAll('header nav a').forEach(a => a.classList.remove('active'));

            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.classList.add('active');
                this.classList.add('active');
            }
            
            if(targetId === 'home') {
                loadAllPosts();
            } else if (targetId === 'gallery') {
                loadGalleryImages();
            }
        });
    });

    // --- ADMIN.HTML Lógica (NOVA IMPLEMENTAÇÃO DE MODAIS INSERIDA AQUI) ---
    if (window.location.pathname.includes('admin.html')) {
        const adminLoginForm = document.getElementById('adminLoginForm');
        const adminContentDiv = document.querySelector('.admin-content');
        const loginCard = document.querySelector('.admin-login-card');
        const logoutBtn = document.getElementById('logoutBtn');
        const postListDiv = document.getElementById('postList');
        const postEditorForm = document.getElementById('postEditorForm');
        
        // Inicialização: Carrega posts e galeria se autenticado
        if (checkAuthStatus()) {
            loginCard.style.display = 'none';
            adminContentDiv.style.display = 'block';
            
            loadSuggestions(); 
            loadAdminPosts();  
            loadAdminGalleryImages(); 
        } else {
            loginCard.style.display = 'block';
            adminContentDiv.style.display = 'none';
        }

        if (adminLoginForm) {
            adminLoginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const password = document.getElementById('adminPassword').value;
                if (await checkAdminPassword(password)) {
                    window.location.reload(); 
                } else {
                    alert('Senha incorreta!');
                }
            });
        }
        
        if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

        const suggestionList = document.getElementById('suggestionList');
        if (suggestionList) {
             suggestionList.addEventListener('click', (e) => {
                if (e.target.classList.contains('delete-suggestion-btn')) {
                    deleteSuggestion(e.target.dataset.id);
                }
            });
        }
        
        // Listener para a Barra de Ferramentas de Formatação (Formatação Básica) - CORRIGIDO
        const toolbar = document.querySelector('.toolbar');
        if (toolbar) {
            toolbar.addEventListener('click', (e) => {
                let target = e.target.closest('.format-btn');
                if (!target) return;
                
                const format = target.dataset.format;
                applyFormat(format); // Chama a função global
            });
        }
        
        // Listeners para Gerenciamento de Post (Mantidos)
        document.getElementById('addPostBtn').addEventListener('click', () => {
            currentPostId = null;
            document.getElementById('postForm').style.display = 'block';
            document.getElementById('postForm').querySelector('h3').textContent = 'Adicionar Nova Postagem';
            document.getElementById('postEditorForm').reset();
            document.getElementById('postForm').scrollIntoView({ behavior: 'smooth' });
        });
        
        document.getElementById('cancelEditBtn').addEventListener('click', () => {
            document.getElementById('postEditorForm').reset();
            document.getElementById('postForm').style.display = 'none';
            currentPostId = null;
        });
        
        if (postListDiv) {
             postListDiv.addEventListener('click', (e) => {
                const postId = e.target.dataset.id;
                if (e.target.classList.contains('edit-post-btn')) {
                    editPost(postId);
                } else if (e.target.classList.contains('delete-post-btn')) {
                    deletePost(postId);
                }
            });
        }
        
        if (postEditorForm) {
            postEditorForm.addEventListener('submit', savePost);
        }
        
        // Listeners para Gerenciamento de Galeria (Mantidos)
        document.getElementById('addImageBtn').addEventListener('click', () => {
            currentImageId = null;
            document.getElementById('galleryForm').style.display = 'block';
            document.getElementById('galleryForm').querySelector('h3').textContent = 'Adicionar Nova Imagem';
            document.getElementById('galleryEditorForm').reset();
            document.getElementById('galleryForm').scrollIntoView({ behavior: 'smooth' });
        });
        
        document.getElementById('cancelImageEditBtn').addEventListener('click', () => {
            document.getElementById('galleryEditorForm').reset();
            document.getElementById('galleryForm').style.display = 'none';
            currentImageId = null;
        });

        const galleryListDiv = document.getElementById('galleryList');
        if (galleryListDiv) {
             galleryListDiv.addEventListener('click', (e) => {
                const imageId = e.target.dataset.id;
                if (e.target.classList.contains('edit-image-btn')) {
                    editGalleryImage(imageId);
                } else if (e.target.classList.contains('delete-image-btn')) {
                    deleteGalleryImage(imageId);
                }
            });
        }
        
        document.getElementById('galleryEditorForm').addEventListener('submit', saveGalleryImage);
        

        // --- LÓGICA DO MODAL DE MÍDIA ÚNICO (#mediaModal) ---
        const mediaModal = document.getElementById('mediaModal');
        const closeMediaModalBtn = document.getElementById('closeMediaModalBtn');

        // (NOVO) Lógica de troca de abas para o mediaModal
        if (mediaModal) {
            const mediaTabs = mediaModal.querySelectorAll('.tab-btn');
            const mediaTabContents = mediaModal.querySelectorAll('.tab-content');

            mediaTabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    // Desativa todas as abas e conteúdos
                    mediaTabs.forEach(t => t.classList.remove('active'));
                    mediaTabContents.forEach(c => c.style.display = 'none');

                    // Ativa a aba clicada
                    tab.classList.add('active');
                    const tabName = tab.getAttribute('data-tab');
                    const activeContent = document.getElementById(tabName);
                    if (activeContent) {
                        activeContent.style.display = 'block';
                    }
                });
            });
        }
        
        // Fechar Modal de Mídia
        if (closeMediaModalBtn) {
            closeMediaModalBtn.addEventListener('click', () => {
                if (mediaModal) mediaModal.style.display = 'none';
            });
        }

        // (NOVO) 1. Formulário de Imagem Simples
        const simpleImageForm = document.getElementById('simpleImageForm');
        if (simpleImageForm) {
            simpleImageForm.addEventListener('submit', (e) => handleModalSubmit(e, (form) => {
                const url = form.querySelector('#imgUrl').value;
                const alt = form.querySelector('#imgAlt').value;
                const caption = form.querySelector('#imgCaption').value;
                const alignment = form.querySelector('#imgAlignment').value;
                
                if (!url || !alt) throw new Error('URL e Alt Text são obrigatórios.');

                let captionHtml = caption.trim() !== '' ? `\n  <figcaption>${caption}</figcaption>` : '';
                const alignmentClass = alignment !== 'align-none' ? ` class="${alignment}"` : '';

                return `\n\n<figure${alignmentClass}>
<img src="${url}" alt="${alt}" />${captionHtml}
</figure>\n\n`;
            }, 'mediaModal', 'mediaModalMessage'));
        }

        // 2. Formulário de Carrossel (Existente)
        const carouselForm = document.getElementById('carouselForm'); 
        if (carouselForm) {
            carouselForm.addEventListener('submit', (e) => handleModalSubmit(e, (form) => {
                const urlsText = form.querySelector('#carouselUrls').value.trim(); 
                
                if (!urlsText) throw new Error('É necessário inserir pelo menos uma URL de imagem.');

                const urls = urlsText.split('\n')
                                    .map(url => url.trim())
                                    .filter(url => url.length > 0);

                if (urls.length === 0) throw new Error('Nenhuma URL válida encontrada.');
                
                const imagesHtml = urls.map((url, index) => {
                    const imageAlt = `Imagem de Carrossel ${index + 1}`; 
                    return `<img src="${url}" alt="${imageAlt}" loading="lazy" />`; 
                }).join('\n');
                
                return `\n\n<div class="post-carousel-container">\n${imagesHtml}\n</div>\n\n`;
            }, 'mediaModal', 'mediaModalMessage')); 
        }

        // 3. Formulário de Vídeo (Existente)
        const videoForm = document.getElementById('videoForm'); 
        if (videoForm) {
            videoForm.addEventListener('submit', (e) => handleModalSubmit(e, (form) => {
                const videoUrl = form.querySelector('#videoUrl').value.trim(); 
                
                if (!videoUrl) throw new Error('A URL do vídeo é obrigatória.');

                const youtubeRegex = /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([\w-]{11})(?:\S+)?$/;
                const match = videoUrl.match(youtubeRegex);

                if (match) {
                    const videoId = match[1];
                    return `\n\n<div class="video-responsive-container"><iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>\n\n`;
                } else {
                    return `\n\n<video controls style="max-width: 100%; height: auto; border-radius: 6px; margin: 15px 0;">
<source src="${videoUrl}" type="video/mp4">
Seu navegador não suporta a tag de vídeo.
</video>\n\n`;
                }
            }, 'mediaModal', 'mediaModalMessage'));
        }

        // --- LÓGICA DO MODAL DE ESTILO PERSONALIZADO (#styleModal) ---
        const styleModal = document.getElementById('styleModal');
        const closeStyleModalBtn = document.getElementById('closeStyleModalBtn');
        
        // (NOVO) Lógica de troca de abas para o styleModal
        if (styleModal) {
            const styleTabs = styleModal.querySelectorAll('.tab-btn');
            const styleTabContents = styleModal.querySelectorAll('.tab-content');

            styleTabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    // Desativa todas
                    styleTabs.forEach(t => t.classList.remove('active'));
                    styleTabContents.forEach(c => c.style.display = 'none');

                    // Ativa a clicada
                    tab.classList.add('active');
                    const tabName = tab.getAttribute('data-tab');
                    const activeContent = document.getElementById(tabName);
                    if (activeContent) {
                        activeContent.style.display = 'block';
                    }
                });
            });
        }
        
        // Fechar Modal de Estilo
        if (closeStyleModalBtn) {
            closeStyleModalBtn.addEventListener('click', () => {
                if (styleModal) styleModal.style.display = 'none';
            });
        }

        // Lógica para Aplicar Atalhos de Estilo (Span com classe CSS)
        const shortcutsTab = document.getElementById('style-shortcuts');
        if (shortcutsTab) {
            shortcutsTab.addEventListener('click', (e) => {
                const target = e.target.closest('.style-shortcut-btn');
                if (!target) return;
                
                const tag = target.dataset.styleTag;
                const textarea = document.getElementById('postContent');
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const selectedText = textarea.value.substring(start, end) || 'Texto de Destaque'; 
                
                const newText = `<span class="${tag}">${selectedText}</span>`;
                
                insertAtCursor(textarea, newText);
                
                if (styleModal) styleModal.style.display = 'none'; 
            });
        }

        // Lógica para Inserir Código HTML/CSS Personalizado
        const customCodeForm = document.getElementById('customCodeForm');
        if (customCodeForm) {
            customCodeForm.addEventListener('submit', (e) => handleModalSubmit(e, (form) => {
                const customCode = form.querySelector('#customHtmlCode').value.trim();
                
                if (!customCode) throw new Error('Insira o código HTML/CSS.');
                
                return '\n\n' + customCode + '\n\n';

            }, 'styleModal', 'styleModalMessage'));
        }
        
        // Lógica de fechar modais clicando fora (Unificada)
        window.addEventListener('click', (e) => {
            if (e.target === mediaModal) mediaModal.style.display = 'none';
            if (e.target === styleModal) styleModal.style.display = 'none';
            // O listener do imageModal foi removido
        });

    } 
    // --- INDEX.HTML Lógica (Mantida) ---
    else if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
        
        loadAllPosts(); 
        loadGalleryImages();

        const suggestionForm = document.getElementById('suggestionForm');
        if(suggestionForm) {
            suggestionForm.addEventListener('submit', handleSuggestionSubmit);
        }
        
        const reloadBtn = document.getElementById('reloadPostsBtn');
        if (reloadBtn) {
            reloadBtn.addEventListener('click', loadAllPosts);
        }
        
        const backBtn = document.getElementById('backToHomeBtn');
        if (backBtn) {
            backBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const detailsSection = document.getElementById('post-details');
                const homeSection = document.getElementById('home');
                if (detailsSection) detailsSection.classList.remove('active');
                if (homeSection) homeSection.classList.add('active');
                window.scrollTo(0, 0);
            });
        }

        // --- Lógica do Modal/Lightbox ---
        const galleryModal = document.getElementById('galleryModal');
        const closeBtn = document.querySelector('.close-btn');
        const prevBtn = document.getElementById('prevImage');
        const nextBtn = document.getElementById('nextImage');

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (prevBtn) prevBtn.addEventListener('click', () => changeImage(-1));
        if (nextBtn) nextBtn.addEventListener('click', () => changeImage(1));

        if (galleryModal) {
            galleryModal.addEventListener('click', (e) => {
                if (e.target === galleryModal) {
                    closeModal();
                }
            });
            
            document.addEventListener('keydown', (e) => {
                if (galleryModal.style.display === "block") {
                    if (e.key === "Escape") {
                        closeModal();
                    } else if (e.key === "ArrowLeft") {
                        changeImage(-1);
                    } else if (e.key === "ArrowRight") {
                        changeImage(1);
                    }
                }
            });
            
            galleryModal.addEventListener('touchstart', (e) => {
                startX = e.touches[0].clientX;
            });

            galleryModal.addEventListener('touchend', (e) => {
                const endX = e.changedTouches[0].clientX;
                const deltaX = endX - startX;
                
                if (Math.abs(deltaX) > 50) {
                    if (deltaX > 0) {
                        changeImage(-1);
                    } else {
                        changeImage(1);
                    }
                }
            });
        }
    }
});