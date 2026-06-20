// Utilitários para autenticação e persistência de usuário

// Salvar token e dados do usuário
function saveUserData(token, user) {
    localStorage.setItem('authToken', token); // Usar authToken como padrão
    localStorage.setItem('token', token); // Manter compatibilidade
    localStorage.setItem('user', JSON.stringify(user));
    console.log('✅ Dados do usuário salvos:', user.name);
}

// Obter dados do usuário salvos
function getSavedUser() {
    try {
        const userData = localStorage.getItem('user');
        return userData ? JSON.parse(userData) : null;
    } catch (error) {
        console.error('❌ Erro ao obter dados do usuário:', error);
        return null;
    }
}

// Obter token salvo
function getSavedToken() {
    return localStorage.getItem('authToken') || localStorage.getItem('token');
}

// Verificar se usuário está logado
function isLoggedIn() {
    return getSavedToken() && getSavedUser();
}

// Logout - limpar dados
function logout() {
    // Limpar TODOS os dados do localStorage relacionados ao app
    localStorage.removeItem('authToken');
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    localStorage.removeItem('user');
    localStorage.removeItem('userProfile');
    localStorage.removeItem('ajudex_user');
    
    // Limpar qualquer chave que comece com 'ajudex' ou 'user'
    Object.keys(localStorage).forEach(key => {
        if (key.toLowerCase().includes('ajudex') || key.toLowerCase().includes('user') || key.toLowerCase().includes('auth')) {
            localStorage.removeItem(key);
        }
    });
    
    console.log('🧹 Logout completo - todos os dados removidos');
    window.location.href = '/';
}

// Verificar token com o servidor e atualizar dados
async function verifyAndUpdateUser() {
    const token = getSavedToken();
    if (!token) return null;

    try {
        const response = await fetch('/api/verify-token', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            // Atualizar dados salvos do usuário
            localStorage.setItem('user', JSON.stringify(data.user));
            return data.user;
        } else {
            // Token inválido - fazer logout
            logout();
            return null;
        }
    } catch (error) {
        console.error('❌ Erro ao verificar token:', error);
        return getSavedUser(); // Retornar dados salvos como fallback
    }
}

// Proteger página - redirecionar se não estiver logado
function requireLogin() {
    const token = getSavedToken();
    const user = getSavedUser();
    
    if (!token || !user) {
        console.log('🔒 Acesso negado - redirecionando para login');
        window.location.href = '/';
        return false;
    }
    
    console.log('✅ Usuário autenticado:', user.name);
    return true;
}

// Inicializar autenticação em uma página
async function initAuth(showLoading = true) {
    const token = getSavedToken();
    const user = getSavedUser();
    
    // Verificar se tem dados salvos primeiro
    if (!token || !user) {
        console.log('🔒 Acesso negado - redirecionando para login');
        window.location.href = '/';
        return null;
    }

    if (showLoading) {
        const loadingEl = document.getElementById('loading');
        if (loadingEl) loadingEl.style.display = 'block';
    }

    try {
        // Tentar verificar com servidor, mas usar dados locais como fallback
        const response = await fetch('/api/verify-token', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        let currentUser = user; // Usar dados salvos como padrão

        if (response.ok) {
            const data = await response.json();
            // Atualizar apenas se o servidor retornou dados válidos
            if (data.user) {
                localStorage.setItem('user', JSON.stringify(data.user));
                currentUser = data.user;
            }
        }
        
        if (showLoading) {
            const loadingEl = document.getElementById('loading');
            if (loadingEl) loadingEl.style.display = 'none';
        }

        console.log('✅ Auth inicializada para:', currentUser.name);
        return currentUser;
    } catch (error) {
        console.log('⚠️ Usando dados locais (erro de conexão)');
        
        if (showLoading) {
            const loadingEl = document.getElementById('loading');
            if (loadingEl) loadingEl.style.display = 'none';
        }
        
        return user; // Retornar dados salvos em caso de erro
    }
}

// Atualizar nome do usuário na interface
function updateUserDisplay(user) {
    // Atualizar nome em elementos com classe ou ID específico
    const userNameElements = document.querySelectorAll('.user-name, #userName');
    userNameElements.forEach(element => {
        if (element) element.textContent = user.name;
    });

    // Atualizar foto de perfil se existir
    const profilePhotoElements = document.querySelectorAll('.profile-photo img');
    profilePhotoElements.forEach(element => {
        if (element && user.photo) {
            element.src = user.photo;
        }
    });

    // Mostrar badge premium se aplicável
    const premiumElements = document.querySelectorAll('.premium-badge');
    premiumElements.forEach(element => {
        if (element) {
            element.style.display = user.premium ? 'inline-block' : 'none';
        }
    });
}
