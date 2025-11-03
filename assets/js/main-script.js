const supabaseConfig = {
    // ATUALIZE AQUI COM SUAS CHAVES REAIS
    url: 'https://ktasovkzriskdjrtxkpk.supabase.co', 
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0YXNvdmt6cmlza2RqcnR4a3BrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2NjEzNzcsImV4cCI6MjA3NzIzNzM3N30.tkmIYZ0KSWPCYhYEk7139Qvn0BHcE4gWMGNujR6arGw' 
};

const { createClient } = supabase;
const supabaseClient = createClient(supabaseConfig.url, supabaseConfig.key);

let currentPostId = null;

// =========================================================
// 🔑 LÓGICA DE AUTENTICAÇÃO SIMPLIFICADA
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
// 📧 MÓDULO DE SUGESTÕES (ADMIN.HTML) - CORRIGIDO
// =========================================================

/**
 * Função CORRIGIDA para carregar sugestões, usando mapeamento explícito
 * para string e injeção única no DOM (mais robusto para renderização).
 */
async function loadSuggestions() {
    const listDiv = document.getElementById('suggestionList');
    if (!listDiv) {
        console.error("Elemento #suggestionList não encontrado no DOM.");
        return;
    }
    // Exibe o carregamento
    listDiv.innerHTML = '<p class="loading-message">Carregando sugestões...</p>';

    const { data: sugestoes, error } = await supabaseClient
        .from('sugestoes')
        .select('id, nome, email, ideia, created_at')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("ERRO AO CARREGAR SUGESTÕES (RLS ou Configuração):", error);
        listDiv.innerHTML = `<p class="error-message">Erro ao carregar sugestões: ${error.message}.</p>`;
        return;
    }

    // Se não há dados ou a lista está vazia
    if (!sugestoes || sugestoes.length === 0) {
        listDiv.innerHTML = `<p>Nenhuma sugestão enviada.</p>`;
        return;
    }
    
    // Mapeia os dados para uma lista de strings HTML
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

    // RENDERIZAÇÃO EXPLÍCITA: Define o innerHTML do container uma única vez.
    listDiv.innerHTML = suggestionsHtml;
    console.log(`[DEBUG] Sugestões carregadas com sucesso: ${sugestoes.length} itens renderizados.`);
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

// =========================================================
// ⚙️ LÓGICA CRUD DE POSTS (ADMIN.HTML) - MANTIDA
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
// 🖼️ FRONTEND (INDEX.HTML) - MANTIDO
// =========================================================

async function loadAllPosts() {
    const postsGrid = document.getElementById('postsGrid');
    if (!postsGrid) return;
    postsGrid.innerHTML = '<p class="loading">Carregando as últimas notícias...</p>';

    const { data: posts, error } = await supabaseClient
        .from('posts')
        .select('*')
        .order('data_publicacao', { ascending: false }); 

    if (error) {
        postsGrid.innerHTML = `<p class="error-message">Erro ao carregar posts: ${error.message}</p>`;
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
    document.getElementById('home').classList.remove('active');
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
// 🚀 INICIALIZAÇÃO E LISTENERS
// =========================================================

document.addEventListener('DOMContentLoaded', () => {
    // Inicialização da página de administração
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
            
            // Carregamento de dados após autenticação
            loadSuggestions(); 
            loadAdminPosts();  
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

        // Listener de delegação para exclusão de sugestão
        const suggestionList = document.getElementById('suggestionList');
        if (suggestionList) {
             suggestionList.addEventListener('click', (e) => {
                if (e.target.classList.contains('delete-suggestion-btn')) {
                    deleteSuggestion(e.target.dataset.id);
                }
            });
        }
        
        // Listeners do CRUD de Posts
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
    }

    // Inicialização da página principal
    if (window.location.pathname.includes('index.html')) {
        loadAllPosts();
        
        const suggestionForm = document.getElementById('suggestionForm');
        if(suggestionForm) {
            suggestionForm.addEventListener('submit', handleSuggestionSubmit);
        }
    }
    
    // Configuração de navegação para todas as páginas
    document.querySelectorAll('header nav a').forEach(link => {
        link.addEventListener('click', function(e) {
            // CORREÇÃO: Permite a navegação para arquivos externos (como admin.html)
            if (!this.getAttribute('href').startsWith('#')) {
                return; 
            }
            
            // Lógica de navegação entre seções (para links #hash)
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            
            document.querySelectorAll('.page-section').forEach(section => {
                section.classList.remove('active');
            });
            document.getElementById(targetId).classList.add('active');

            if(targetId === 'home') loadAllPosts();
        });
    });
});