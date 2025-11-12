const supabaseConfig = {
    url: 'https://ktasovkzriskdjrtxkpk.supabase.co', 
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0YXNvdmt6cmlza2RqcnR4a3BrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2NjEzNzcsImV4cCI6MjA3NzIzNzM3N30.tkmIYZ0KSWPCYhYEk7139Qvn0BHcE4gWMGNujR6arGw' 
};

const { createClient } = supabase;
const supabaseClient = createClient(supabaseConfig.url, supabaseConfig.key);

let currentPostId = null;
let currentImageId = null; // Variável para controle da galeria

// =========================================================
// FUNÇÕES DE AUTENTICAÇÃO E ADMIN
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
// FUNÇÕES DE SUGESTÕES
// =========================================================

async function loadSuggestions() {
    const listDiv = document.getElementById('suggestionList');
    if (!listDiv) return;
    listDiv.innerHTML = '<p class="loading-message">Carregando sugestões...</p>';

    const { data: sugestoes, error } = await supabaseClient
        .from('sugestoes')
        .select('id, nome, email, ideia, created_at')
        .order('created_at', { ascending: false });

    if (error) {
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
// FUNÇÕES DE POSTS (ADMIN)
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
// FUNÇÕES DE POSTS (FRONTEND)
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
            <img src="${imageUrl}" alt="${post.titulo}">
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
    document.querySelectorAll('.page-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById('post-details').classList.add('active');
    window.scrollTo(0, 0);

    const { data: post, error } = await supabaseClient
        .from('posts')
        .select('*')
        .eq('id', postId)
        .single();

    if (error) {
        alert('Erro ao carregar detalhes do post.');
        document.getElementById('post-details').classList.remove('active');
        document.getElementById('home').classList.add('active');
        return;
    }
    
    const imageUrl = post.image_url && post.image_url.trim() !== '' 
        ? post.image_url 
        : 'images/default-cover.png'; 

    document.getElementById('detailImage').src = imageUrl;
    document.getElementById('detailTitle').textContent = post.titulo;
    document.getElementById('detailDate').textContent = new Date(post.data_publicacao).toLocaleDateString('pt-BR');
    document.getElementById('detailAuthor').textContent = post.autor;
    document.getElementById('detailContent').innerHTML = post.conteudo || '';
    
    const tagsContainer = document.getElementById('detailTags');
    const tagsHtml = post.tags && post.tags.length > 0
        ? post.tags.map(tag => `<span class="tag">${tag}</span>`).join(' ')
        : '<span>Sem tags</span>';
    tagsContainer.innerHTML = tagsHtml;
}


// =========================================================
// FUNÇÕES DE GALERIA (ADMIN)
// =========================================================

async function loadAdminGallery() {
    const galleryListDiv = document.getElementById('galleryList');
    if (!galleryListDiv) return;
    galleryListDiv.innerHTML = '<p>Carregando imagens da galeria...</p>';

    const { data: images, error } = await supabaseClient
        .from('galeria') // Assumindo o nome da tabela no Supabase é 'galeria'
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
                <p><strong>URL:</strong> ${img.image_url.length > 50 ? img.image_url.substring(0, 50) + '...' : img.image_url}</p>
                <p>Alt Text: ${img.alt_text}</p>
            </div>
            <div>
                <button class="edit-image-btn" data-id="${img.id}">Editar</button>
                <button class="delete-image-btn" data-id="${img.id}">Excluir</button>
            </div>
        `;
        galleryListDiv.appendChild(imageItem);
    });
}

async function editImage(imageId) {
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

async function saveImage(e) {
    e.preventDefault();

    const isEditing = currentImageId !== null;
    
    const imageData = {
        image_url: document.getElementById('imageUrl').value.trim(),
        alt_text: document.getElementById('imageAltText').value.trim()
    };
    
    if (imageData.image_url === '' || imageData.alt_text === '') {
        alert('URL da Imagem e Alt Text são obrigatórios.');
        return;
    }

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
        loadAdminGallery(); 
    }
}

async function deleteImage(imageId) {
    if (!confirm('Tem certeza que deseja EXCLUIR esta imagem permanentemente da galeria?')) return;

    const { error } = await supabaseClient
        .from('galeria')
        .delete()
        .eq('id', imageId);

    if (error) {
        alert('Erro ao excluir imagem: ' + error.message);
    } else {
        alert('Imagem excluída com sucesso!');
        loadAdminGallery(); 
    }
}

// =========================================================
// FUNÇÃO DE GALERIA (FRONTEND)
// =========================================================

async function loadGallery() {
    const galleryGrid = document.getElementById('galleryGrid');
    if (!galleryGrid) return;
    
    galleryGrid.innerHTML = '<p class="loading">Carregando imagens...</p>';

    const { data: images, error } = await supabaseClient
        .from('galeria') // O nome da sua tabela
        .select('*')
        .order('id', { ascending: false }); 

    if (error) {
        galleryGrid.innerHTML = `<p class="error-message">Erro ao carregar galeria: ${error.message}.</p>`;
        return;
    }

    galleryGrid.innerHTML = '';
    
    if (images.length === 0) {
        galleryGrid.innerHTML = `<p class="empty-message">Nenhuma imagem na galeria ainda.</p>`;
        return;
    }

    images.forEach(img => {
        const imageCard = document.createElement('div');
        imageCard.classList.add('gallery-item');

        imageCard.innerHTML = `
            <img src="${img.image_url}" alt="${img.alt_text}">
            <div class="alt-text-overlay">${img.alt_text}</div>
        `;
        galleryGrid.appendChild(imageCard);
    });
}


// =========================================================
// INICIALIZAÇÃO E LISTENERS
// =========================================================

document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('admin.html')) {
        const adminLoginForm = document.getElementById('adminLoginForm');
        const adminContentDiv = document.querySelector('.admin-content');
        const loginCard = document.querySelector('.admin-login-card');
        const logoutBtn = document.getElementById('logoutBtn');
        const postListDiv = document.getElementById('postList');
        const postEditorForm = document.getElementById('postEditorForm');


        if (checkAuthStatus()) {
            loginCard.style.display = 'none';
            adminContentDiv.style.display = 'block';
            
            loadSuggestions(); 
            loadAdminPosts(); 
            loadAdminGallery(); 
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
        
        // Listeners dos Posts
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
        
        // NOVO: Listener para Inserir Imagem no Conteúdo
        const insertImageToContentBtn = document.getElementById('insertImageToContentBtn');
        if (insertImageToContentBtn) {
            insertImageToContentBtn.addEventListener('click', () => {
                const imageUrl = prompt("Insira a URL completa da imagem (ex: https://.../img.jpg):");
                if (!imageUrl) return;

                const imageAltText = prompt("Insira o Texto Alternativo (Alt Text) para a imagem:");
                const altText = imageAltText ? imageAltText : "imagem do post"; 

                // Adiciona o estilo para responsividade e centralização
                const imageHtml = `<img src="${imageUrl}" alt="${altText}" style="max-width: 100%; height: auto; display: block; margin: 20px auto;">`;
                const postContentTextarea = document.getElementById('postContent');

                // Insere o HTML da imagem na posição atual do cursor no textarea
                const start = postContentTextarea.selectionStart;
                const end = postContentTextarea.selectionEnd;
                const value = postContentTextarea.value;

                postContentTextarea.value = value.substring(0, start) + imageHtml + '\n\n' + value.substring(end);
                
                // Coloca o cursor após a imagem inserida
                postContentTextarea.selectionStart = postContentTextarea.selectionEnd = start + imageHtml.length + 2; 
                postContentTextarea.focus();
            });
        }

        // Listeners da Galeria
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
                    editImage(imageId);
                } else if (e.target.classList.contains('delete-image-btn')) {
                    deleteImage(imageId);
                }
            });
        }

        const galleryEditorForm = document.getElementById('galleryEditorForm');
        if (galleryEditorForm) {
            galleryEditorForm.addEventListener('submit', saveImage);
        }

    }

    if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
        loadAllPosts(); 
        
        const suggestionForm = document.getElementById('suggestionForm');
        if(suggestionForm) {
            suggestionForm.addEventListener('submit', handleSuggestionSubmit);
        }
        
        const reloadBtn = document.getElementById('reloadPostsBtn');
        if (reloadBtn) {
            reloadBtn.addEventListener('click', loadAllPosts);
        }
    }
    
    // Navegação e Carregamento de Seções
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
            
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.classList.add('active');
            }

            if(targetId === 'home') {
                loadAllPosts();
            } else if (targetId === 'gallery') {
                loadGallery(); // Carrega a galeria
            }
            
            document.querySelectorAll('header nav a').forEach(a => a.classList.remove('active'));
            this.classList.add('active');
        });
    });
});