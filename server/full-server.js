const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const sgMail = require('@sendgrid/mail');
const { authenticateToken, generateToken, hashPassword, verifyPassword } = require('./auth');
const { SERVICES_LIST } = require('./services');

const app = express();
const PORT = process.env.PORT || 5000;

// Configurar SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

// Simulação de banco de dados em memória (substituir por PostgreSQL depois)
let users = [];
let resetTokens = [];
let likes = [];
let matches = [];
let messages = [];

// ENDPOINTS DE AUTENTICAÇÃO

// Registro de usuário
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, birthDate, cep, password } = req.body;

    // Verificar se email já existe
    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
      return res.status(400).json({ message: 'Email já cadastrado' });
    }

    // Validar idade mínima de 18 anos
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    if (age < 18) {
      return res.status(400).json({ message: 'Idade mínima de 18 anos necessária' });
    }

    // Validar CEP
    try {
      const cepClean = cep.replace(/\D/g, '');
      const cepResponse = await axios.get(`https://viacep.com.br/ws/${cepClean}/json/`);
      
      if (cepResponse.data.erro) {
        return res.status(400).json({ message: 'CEP inválido' });
      }

      const { localidade: city, uf: state } = cepResponse.data;

      // Hash da senha
      const hashedPassword = await hashPassword(password);

      // Criar usuário
      const newUser = {
        id: users.length + 1,
        name,
        email,
        password: hashedPassword,
        birthDate,
        cep,
        city,
        state,
        searchRadius: 10,
        servicesOffered: [],
        servicesWanted: [],
        premium: false,
        premiumExpiryDate: null,
        profilePhoto: null,
        createdAt: new Date()
      };

      users.push(newUser);

      res.status(201).json({ 
        message: 'Usuário criado com sucesso',
        userId: newUser.id 
      });

    } catch (error) {
      return res.status(400).json({ message: 'Erro ao validar CEP' });
    }

  } catch (error) {
    console.error('Erro no registro:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({ message: 'Email ou senha inválidos' });
    }

    const isValidPassword = await verifyPassword(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Email ou senha inválidos' });
    }

    const token = generateToken(user.id);
    
    res.json({ 
      token, 
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        premium: user.premium,
        servicesOffered: user.servicesOffered,
        servicesWanted: user.servicesWanted
      }
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Esqueci a senha - enviar código
app.post('/api/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(404).json({ message: 'Email não encontrado' });
    }

    // Gerar código de 6 dígitos
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Salvar código (expira em 15 minutos)
    const resetToken = {
      email,
      code: resetCode,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000)
    };

    resetTokens.push(resetToken);

    // Enviar email se SendGrid configurado
    if (process.env.SENDGRID_API_KEY) {
      try {
        const msg = {
          to: email,
          from: 'noreply@ajudex.com',
          subject: 'AjudeX - Código de Recuperação de Senha',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #ff9a9e;">Recuperação de Senha - AjudeX</h2>
              <p>Você solicitou a recuperação da sua senha.</p>
              <p>Seu código de recuperação é:</p>
              <div style="background: linear-gradient(135deg, #ff9a9e, #9bb5ff); color: white; padding: 20px; border-radius: 10px; text-align: center; margin: 20px 0;">
                <h1 style="font-size: 32px; margin: 0;">${resetCode}</h1>
              </div>
              <p><strong>Este código expira em 15 minutos.</strong></p>
              <p>Se você não solicitou esta recuperação, ignore este email.</p>
              <hr>
              <p style="color: #666; font-size: 12px;">AjudeX - Conectando pessoas através de serviços</p>
            </div>
          `
        };

        await sgMail.send(msg);
      } catch (emailError) {
        console.error('Erro ao enviar email:', emailError);
      }
    }

    res.json({ message: 'Código enviado para seu email' });
  } catch (error) {
    console.error('Erro ao enviar código:', error);
    res.status(500).json({ message: 'Erro ao enviar código' });
  }
});

// Verificar código de reset
app.post('/api/verify-reset-code', async (req, res) => {
  try {
    const { email, code } = req.body;

    const resetToken = resetTokens.find(rt => 
      rt.email === email && 
      rt.code === code && 
      rt.expiresAt > new Date()
    );

    if (!resetToken) {
      return res.status(400).json({ message: 'Código inválido ou expirado' });
    }

    res.json({ message: 'Código válido' });
  } catch (error) {
    console.error('Erro ao verificar código:', error);
    res.status(500).json({ message: 'Erro ao verificar código' });
  }
});

// Redefinir senha
app.post('/api/reset-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    // Hash da nova senha
    const hashedPassword = await hashPassword(newPassword);
    user.password = hashedPassword;

    // Remover tokens de reset
    resetTokens = resetTokens.filter(rt => rt.email !== email);

    res.json({ message: 'Senha alterada com sucesso' });
  } catch (error) {
    console.error('Erro ao alterar senha:', error);
    res.status(500).json({ message: 'Erro ao alterar senha' });
  }
});

// Verificar token
app.get('/api/verify-token', authenticateToken, async (req, res) => {
  try {
    const user = users.find(u => u.id === req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        premium: user.premium,
        servicesOffered: user.servicesOffered,
        servicesWanted: user.servicesWanted
      }
    });
  } catch (error) {
    console.error('Erro ao verificar token:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// ENDPOINTS DE SERVIÇOS

// Listar todos os serviços disponíveis
app.get('/api/services', (req, res) => {
  res.json(SERVICES_LIST);
});

// Atualizar serviços do usuário
app.put('/api/user/services', authenticateToken, (req, res) => {
  try {
    const { servicesOffered, servicesWanted } = req.body;
    
    const user = users.find(u => u.id === req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    // Validar limite de serviços oferecidos (máximo 4)
    if (servicesOffered && servicesOffered.length > 4) {
      return res.status(400).json({ message: 'Máximo de 4 serviços oferecidos permitidos' });
    }

    if (servicesOffered) user.servicesOffered = servicesOffered;
    if (servicesWanted) user.servicesWanted = servicesWanted;

    res.json({ 
      message: 'Serviços atualizados com sucesso',
      user: {
        id: user.id,
        servicesOffered: user.servicesOffered,
        servicesWanted: user.servicesWanted
      }
    });
  } catch (error) {
    console.error('Erro ao atualizar serviços:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'AjudeX API funcionando!',
    timestamp: new Date().toISOString(),
    users: users.length,
    services: SERVICES_LIST.length
  });
});

// Rotas específicas para páginas
app.get('/discovery', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/discovery.html'));
});

app.get('/profile', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/profile.html'));
});

app.get('/premium', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/premium.html'));
});

app.get('/matches', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/matches.html'));
});

app.get('/chat', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/chat.html'));
});

// Servir HTML para todas as outras rotas
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 AjudeX Server running on port ${PORT}`);
  console.log(`📱 Open: http://localhost:${PORT}`);
  console.log(`🔧 API Health: http://localhost:${PORT}/api/health`);
  console.log(`📋 Services: ${SERVICES_LIST.length} available`);
});