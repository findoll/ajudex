import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from './db.js';
import { users, passwordResetTokens, likes, matches, messages, suggestions, reports } from '../shared/schema.js';
import { eq, and, or, not, inArray } from 'drizzle-orm';
import sgMail from '@sendgrid/mail';
import Stripe from 'stripe';
import axios from 'axios';

// Configuração SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Configuração Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const JWT_SECRET = process.env.JWT_SECRET || 'ajudex-secret-key';

// Middleware de autenticação
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Token de acesso requerido' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.error('❌ Erro na verificação do token:', err);
      return res.status(403).json({ message: 'Token inválido' });
    }
    console.log('✅ Token verificado, usuário decodificado:', user);
    req.user = user;
    next();
  });
};

export const registerRoutes = (app) => {
  // Login
  app.post('/api/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      const [user] = await db.select().from(users).where(eq(users.email, email));

      if (!user || !await bcrypt.compare(password, user.password)) {
        return res.status(401).json({ message: 'Email ou senha inválidos' });
      }

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
      
      // Retornar dados completos do usuário para persistência
      const { password: userPassword, ...userData } = user;
      
      res.json({ 
        success: true,
        message: 'Login realizado com sucesso',
        token, 
        user: userData
      });
    } catch (error) {
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  // Verificar se email já existe
  app.post('/api/check-email', async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: 'Email é obrigatório' });
      }
      
      const [existingUser] = await db.select().from(users).where(eq(users.email, email));
      
      if (existingUser) {
        return res.status(200).json({ 
          exists: true,
          message: 'Email já cadastrado' 
        });
      }
      
      res.status(200).json({ 
        exists: false,
        message: 'Email disponível' 
      });
    } catch (error) {
      console.error('Erro ao verificar email:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  // Registro
  app.post('/api/register', async (req, res) => {
    try {
      const { name, email, birthDate, cep, password } = req.body;

      // Verificar se email já existe
      const [existingUser] = await db.select().from(users).where(eq(users.email, email));
      if (existingUser) {
        return res.status(409).json({ 
          message: 'Email já cadastrado', 
          error: 'EMAIL_ALREADY_EXISTS',
          exists: true 
        });
      }

      // Validar idade mínima de 18 anos
      if (!birthDate) {
        return res.status(400).json({ 
          message: 'Data de nascimento é obrigatória',
          error: 'BIRTHDATE_REQUIRED' 
        });
      }

      const birthDateObj = new Date(birthDate);
      const today = new Date();
      
      // Calcular idade em anos
      let age = today.getFullYear() - birthDateObj.getFullYear();
      const monthDiff = today.getMonth() - birthDateObj.getMonth();
      
      // Ajustar se ainda não fez aniversário neste ano
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDateObj.getDate())) {
        age--;
      }

      if (age < 18) {
        return res.status(400).json({ 
          message: 'Você deve ter pelo menos 18 anos para se cadastrar',
          error: 'UNDERAGE_USER',
          age: age
        });
      }

      console.log(`✅ Usuário tem ${age} anos - idade válida para cadastro`);

      // Validar CEP
      const cepClean = cep.replace(/\D/g, '');
      const cepResponse = await axios.get(`https://viacep.com.br/ws/${cepClean}/json/`);
      
      if (cepResponse.data.erro) {
        return res.status(400).json({ message: 'CEP inválido' });
      }

      const { localidade: city, uf: state } = cepResponse.data;

      // Hash da senha
      const hashedPassword = await bcrypt.hash(password, 10);

      // Criar usuário
      const [newUser] = await db.insert(users).values({
        name,
        email,
        password: hashedPassword,
        birthDate,
        age, // Salvar idade calculada
        cep,
        city,
        state,
        servicesOffered: [],
        servicesWanted: []
      }).returning();

      // Gerar token JWT para login automático  
      const token = jwt.sign({ userId: newUser.id }, JWT_SECRET, { expiresIn: '7d' });
      
      // Retornar token e dados do usuário (sem senha) para login automático
      const { password: userPassword, ...userData } = newUser;
      
      res.status(201).json({ 
        message: 'Usuário criado com sucesso',
        token,
        user: userData,
        autoLogin: true
      });
    } catch (error) {
      console.error('Erro no registro:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  // Esqueci a senha - enviar código
  app.post('/api/forgot-password', async (req, res) => {
    try {
      const { email } = req.body;

      // Verificar se email existe
      const [user] = await db.select().from(users).where(eq(users.email, email));
      if (!user) {
        return res.status(404).json({ message: 'Email não encontrado' });
      }

      // Gerar código de 6 dígitos
      const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

      // Salvar código no banco (expira em 15 minutos)
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      await db.insert(passwordResetTokens).values({
        email,
        token: resetCode,
        expiresAt
      });

      // Enviar email
      const msg = {
        to: email,
        from: 'noreply@ajudex.com',
        subject: 'AjudeX - Código de Recuperação de Senha',
        html: `
          <h2>Recuperação de Senha - AjudeX</h2>
          <p>Seu código de recuperação é:</p>
          <h1 style="color: #ff9a9e; font-size: 32px; text-align: center;">${resetCode}</h1>
          <p>Este código expira em 15 minutos.</p>
          <p>Se você não solicitou esta recuperação, ignore este email.</p>
        `
      };

      await sgMail.send(msg);

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

      const [resetToken] = await db
        .select()
        .from(passwordResetTokens)
        .where(and(
          eq(passwordResetTokens.email, email),
          eq(passwordResetTokens.token, code)
        ))
        .orderBy(passwordResetTokens.createdAt);

      if (!resetToken || resetToken.expiresAt < new Date()) {
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

      // Hash da nova senha
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Atualizar senha do usuário
      await db
        .update(users)
        .set({ password: hashedPassword })
        .where(eq(users.email, email));

      // Remover tokens de reset usados
      await db
        .delete(passwordResetTokens)
        .where(eq(passwordResetTokens.email, email));

      res.json({ message: 'Senha alterada com sucesso' });
    } catch (error) {
      console.error('Erro ao alterar senha:', error);
      res.status(500).json({ message: 'Erro ao alterar senha' });
    }
  });

  // Verificar token (manter usuário logado)
  app.get('/api/verify-token', authenticateToken, async (req, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.user.userId));
      if (!user) {
        return res.status(404).json({ message: 'Usuário não encontrado' });
      }

      // Retornar todos os dados do usuário (exceto senha) para persistência
      const { password: userPassword, ...userData } = user;
      
      res.json({ user: userData });
    } catch (error) {
      console.error('Erro ao verificar token:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  // Servir fotos do S3 ou redirecionamento
  app.get('/api/photo/:fileName(*)', async (req, res) => {
    try {
      const fileName = req.params.fileName;
      
      // Se está usando S3, redirecionar para URL do S3
      if (process.env.AWS_S3_BUCKET_NAME) {
        const s3Url = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION || 'eu-north-1'}.amazonaws.com/${fileName}`;
        return res.redirect(s3Url);
      }
      
      // Fallback para servir arquivos locais se não estiver usando S3
      const path = require('path');
      const filePath = path.join(process.cwd(), 'uploads', fileName);
      res.sendFile(filePath);
    } catch (error) {
      console.error('Erro ao servir foto:', error);
      res.status(404).json({ error: 'Foto não encontrada' });
    }
  });

  // Stripe: Configuração da chave pública
  app.get('/api/stripe-config', (req, res) => {
    res.json({ 
      publicKey: process.env.VITE_STRIPE_PUBLIC_KEY
    });
  });

  // Stripe: Criar Payment Intent para pagamento único
  app.post('/api/create-payment-intent', authenticateToken, async (req, res) => {
    try {
      const { amount, currency = 'brl' } = req.body;
      
      console.log('💳 Dados da requisição:', { amount, currency, userId: req.user?.userId });
      
      if (!amount) {
        return res.status(400).json({ 
          success: false, 
          message: 'Valor do pagamento é obrigatório' 
        });
      }

      if (!req.user || !req.user.userId) {
        console.error('❌ Token decodificado mas sem userId:', req.user);
        return res.status(401).json({ 
          success: false, 
          message: 'ID do usuário é obrigatório' 
        });
      }

      // Converter para centavos
      const amountInCents = Math.round(amount * 100);

      console.log(`💳 Criando Payment Intent para R$ ${amount} (${amountInCents} centavos)`);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: currency,
        metadata: {
          userId: req.user.userId,
          type: 'premium_30_days'
        }
      });

      console.log('✅ Payment Intent criado:', paymentIntent.id);

      res.json({
        success: true,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
      });
    } catch (error) {
      console.error('❌ Erro ao criar Payment Intent:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erro ao processar pagamento: ' + error.message 
      });
    }
  });

  // Stripe: Confirmar pagamento e ativar Premium
  app.post('/api/confirm-payment', authenticateToken, async (req, res) => {
    try {
      const { paymentIntentId } = req.body;
      
      if (!paymentIntentId) {
        return res.status(400).json({ 
          success: false, 
          message: 'ID do pagamento é obrigatório' 
        });
      }

      // Verificar se o pagamento foi bem-sucedido
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      
      if (paymentIntent.status === 'succeeded') {
        // Ativar Premium por 30 dias
        const premiumExpirationDate = new Date();
        premiumExpirationDate.setDate(premiumExpirationDate.getDate() + 30);

        await db
          .update(users)
          .set({ 
            premium: true,
            premiumExpirationDate: premiumExpirationDate,
            locationRadius: 100 // Aumentar raio para Premium
          })
          .where(eq(users.id, req.user.userId));

        console.log(`✅ Premium ativado para usuário ${req.user.userId} até ${premiumExpirationDate}`);

        res.json({
          success: true,
          message: 'Premium ativado com sucesso!',
          premiumExpirationDate: premiumExpirationDate
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Pagamento não foi concluído'
        });
      }
    } catch (error) {
      console.error('❌ Erro ao confirmar pagamento:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erro ao confirmar pagamento: ' + error.message 
      });
    }
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'API AjudeX funcionando!' });
  });
};
