// Serviço de banco de dados PostgreSQL - AWS RDS COMPATÍVEL
const { Pool } = require("pg");
const { drizzle } = require("drizzle-orm/node-postgres");
const {
  users,
  swipes,
  matches,
  messages,
  feedback,
  blocks,
  passwordResetTokens,
} = require("../shared/schema.js");
const { eq, and, or, desc } = require("drizzle-orm");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL deve estar configurado");
}

// Configuração para AWS RDS PostgreSQL - SSL FLEXÍVEL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Aceita certificados auto-assinados
  }
});

const db = drizzle(pool, {
  schema: {
    users,
    swipes,
    matches,
    messages,
    feedback,
    blocks,
    passwordResetTokens,
  },
});

class DatabaseService {
  constructor() {
    this.db = db;
  }

  // USUÁRIOS
  async createUser(userData) {
    try {
      // Converter e validar arrays de serviços - SIMPLIFICADO para JSON
      let offeredServices = userData.servicesOffered || [];
      let wantedServices = userData.servicesWanted || [];

      // Se chegaram como strings, fazer parse
      if (typeof offeredServices === "string") {
        try {
          offeredServices = JSON.parse(offeredServices);
        } catch (e) {
          offeredServices = [];
        }
      }

      if (typeof wantedServices === "string") {
        try {
          wantedServices = JSON.parse(wantedServices);
        } catch (e) {
          wantedServices = [];
        }
      }

      // Garantir que sejam arrays válidos
      offeredServices = Array.isArray(offeredServices) ? offeredServices : [];
      wantedServices = Array.isArray(wantedServices) ? wantedServices : [];

      console.log("🔧 Serviços para JSON:", {
        offeredServices,
        wantedServices,
      });

      const [user] = await this.db
        .insert(users)
        .values({
          name: userData.name,
          email: userData.email.toLowerCase(),
          password: userData.password,
          photo: userData.photo,
          birthdate: userData.birthDate,
          cep: userData.cep,
          city: userData.city,
          state: userData.state,
          locationRadius: parseInt(userData.searchRadius) || 30,
          offeredServices: offeredServices,
          wantedServices: wantedServices,
          premium: userData.premium || false,
          premiumExpirationDate: userData.premiumExpiresAt || null,
        })
        .returning();

      console.log("✅ Usuário salvo no PostgreSQL:", user.name);
      return this.mapUserFromDB(user);
    } catch (error) {
      console.error("❌ Erro ao criar usuário no PostgreSQL:", error);
      throw error;
    }
  }

  async getUserByEmail(email) {
    try {
      const [user] = await this.db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()));
      return user ? this.mapUserFromDB(user) : null;
    } catch (error) {
      console.error("❌ Erro ao buscar usuário por email:", error);
      return null;
    }
  }

  async getUserById(id) {
    try {
      const [user] = await this.db.select().from(users).where(eq(users.id, id));
      return user ? this.mapUserFromDB(user) : null;
    } catch (error) {
      console.error("❌ Erro ao buscar usuário por ID:", error);
      return null;
    }
  }

  async getAllUsers() {
    try {
      const allUsers = await this.db.select().from(users);
      return allUsers.map((user) => this.mapUserFromDB(user));
    } catch (error) {
      console.error("❌ Erro ao buscar todos os usuários:", error);
      return [];
    }
  }

  async updateUser(userId, updateData) {
    try {
      // Mapear campos para estrutura do banco
      const mappedData = {};
      if (updateData.name) mappedData.name = updateData.name;
      if (updateData.photo) mappedData.photo = updateData.photo;
      if (updateData.profilePhotoUrl)
        mappedData.photo = updateData.profilePhotoUrl;
      if (updateData.birthDate) mappedData.birthdate = updateData.birthDate;
      if (updateData.cep) mappedData.cep = updateData.cep;
      if (updateData.city) mappedData.city = updateData.city;
      if (updateData.state) mappedData.state = updateData.state;
      if (updateData.searchRadius)
        mappedData.locationRadius = parseInt(updateData.searchRadius);

      // Tratar arrays de serviços
      if (updateData.servicesOffered) {
        let offeredServices = updateData.servicesOffered;
        if (typeof offeredServices === "string") {
          try {
            offeredServices = JSON.parse(offeredServices);
          } catch (e) {
            offeredServices = [];
          }
        }
        mappedData.offeredServices = offeredServices;
      }

      if (updateData.servicesWanted) {
        let wantedServices = updateData.servicesWanted;
        if (typeof wantedServices === "string") {
          try {
            wantedServices = JSON.parse(wantedServices);
          } catch (e) {
            wantedServices = [];
          }
        }
        mappedData.wantedServices = wantedServices;
      }

      if (updateData.premium !== undefined)
        mappedData.premium = updateData.premium;
      if (updateData.premiumExpiryDate !== undefined)
        mappedData.premiumExpirationDate = updateData.premiumExpiryDate;

      mappedData.updatedAt = new Date();

      const [user] = await this.db
        .update(users)
        .set(mappedData)
        .where(eq(users.id, userId))
        .returning();

      console.log("✅ Usuário atualizado no PostgreSQL:", user.name);
      return this.mapUserFromDB(user);
    } catch (error) {
      console.error("❌ Erro ao atualizar usuário:", error);
      throw error;
    }
  }

  // Atualizar apenas a senha do usuário
  async updateUserPassword(email, newPassword) {
    try {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      const [user] = await this.db
        .update(users)
        .set({
          password: hashedPassword,
          updatedAt: new Date(),
        })
        .where(eq(users.email, email.toLowerCase()))
        .returning();

      if (!user) {
        throw new Error("Usuário não encontrado");
      }

      console.log("✅ Senha atualizada no PostgreSQL para:", email);
      return true;
    } catch (error) {
      console.error("❌ Erro ao atualizar senha:", error);
      throw error;
    }
  }

  // Mapear dados do banco para compatibilidade com o sistema anterior
  mapUserFromDB(user) {
    return {
      ...user,
      servicesOffered: user.offeredServices || [],
      servicesWanted: user.wantedServices || [],
      searchRadius: user.locationRadius || 30,
      birthDate: user.birthdate,
      premiumExpiryDate: user.premiumExpirationDate,
      // Usando apenas 'photo' para consistência total do sistema
    };
  }

  // LIKES (usando tabela swipes)
  async createLike(fromUserId, toUserId) {
    try {
      const [like] = await this.db
        .insert(swipes)
        .values({
          swiperId: fromUserId,
          swipedUserId: toUserId,
          direction: "like",
        })
        .returning();

      console.log("✅ Like salvo no PostgreSQL");
      return like;
    } catch (error) {
      console.error("❌ Erro ao criar like:", error);
      throw error;
    }
  }

  async checkMutualLike(userId1, userId2) {
    try {
      const like = await this.db
        .select()
        .from(swipes)
        .where(
          and(
            eq(swipes.swiperId, userId2),
            eq(swipes.swipedUserId, userId1),
            eq(swipes.direction, "like"),
          ),
        );

      return like.length > 0;
    } catch (error) {
      console.error("❌ Erro ao verificar like mútuo:", error);
      return false;
    }
  }

  async createPass(fromUserId, toUserId) {
    try {
      const [pass] = await this.db
        .insert(swipes)
        .values({
          swiperId: fromUserId,
          swipedUserId: toUserId,
          direction: "pass",
        })
        .returning();

      console.log("✅ Pass salvo no PostgreSQL");
      return pass;
    } catch (error) {
      console.error("❌ Erro ao criar pass:", error);
      throw error;
    }
  }

  async getAllLikes() {
    try {
      const allLikes = await this.db
        .select()
        .from(swipes)
        .where(eq(swipes.direction, "like"));
      return allLikes;
    } catch (error) {
      console.error("❌ Erro ao buscar likes:", error);
      return [];
    }
  }

  // Buscar todos os swipes (likes e passes) de um usuário
  async getUserSwipes(userId) {
    try {
      const userSwipes = await this.db
        .select()
        .from(swipes)
        .where(eq(swipes.swiperId, userId));

      return userSwipes;
    } catch (error) {
      console.error("❌ Erro ao buscar swipes do usuário:", error);
      return [];
    }
  }

  // Verificar se usuário já deu swipe em outro usuário
  async hasUserSwiped(swiperId, swipedUserId) {
    try {
      const swipe = await this.db
        .select()
        .from(swipes)
        .where(
          and(
            eq(swipes.swiperId, swiperId),
            eq(swipes.swipedUserId, swipedUserId),
          ),
        );

      return swipe.length > 0;
    } catch (error) {
      console.error("❌ Erro ao verificar swipe:", error);
      return false;
    }
  }

  // Função utilitária para gerar hash dos serviços de um usuário
  generateServicesHash(offeredServices, wantedServices) {
    const crypto = require("crypto");
    const servicesString = JSON.stringify({
      offered: Array.isArray(offeredServices) ? offeredServices.sort() : [],
      wanted: Array.isArray(wantedServices) ? wantedServices.sort() : [],
    });
    return crypto.createHash("md5").update(servicesString).digest("hex");
  }

  // Função utilitária para calcular distância entre dois CEPs usando coordenadas reais
  async calculateDistanceBetweenCEPs(cep1, cep2) {
    try {
      // Se os CEPs são iguais, distância é 0
      if (cep1 === cep2) {
        return 0;
      }

      // Cache de coordenadas para evitar múltiplas consultas
      if (!this.coordsCache) {
        this.coordsCache = new Map();
      }

      // Função para buscar coordenadas de um CEP
      const getCoordinates = async (cep) => {
        if (this.coordsCache.has(cep)) {
          return this.coordsCache.get(cep);
        }

        try {
          // Tentar buscar coordenadas via API de geocoding
          const viacepResponse = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
          const viacepData = await viacepResponse.json();

          if (viacepData.erro) {
            return null;
          }

          // Aproximação de coordenadas para cidades brasileiras principais
          const cityCoords = this.getCityCoordinates(viacepData.localidade, viacepData.uf);
          
          const coords = {
            lat: cityCoords.lat,
            lng: cityCoords.lng,
            city: viacepData.localidade,
            state: viacepData.uf
          };

          this.coordsCache.set(cep, coords);
          return coords;
        } catch (error) {
          console.error(`❌ Erro ao buscar coordenadas para CEP ${cep}:`, error);
          return null;
        }
      };

      const [coords1, coords2] = await Promise.all([
        getCoordinates(cep1),
        getCoordinates(cep2)
      ]);

      if (!coords1 || !coords2) {
        console.log(`⚠️ Não foi possível obter coordenadas para ${cep1} ou ${cep2}`);
        return null;
      }

      console.log(`📍 CEP ${cep1}: ${coords1.city}/${coords1.state}`);
      console.log(`📍 CEP ${cep2}: ${coords2.city}/${coords2.state}`);

      // Calcular distância real usando fórmula de Haversine
      const distance = this.calculateHaversineDistance(
        coords1.lat, coords1.lng,
        coords2.lat, coords2.lng
      );

      const category = distance < 10 ? 'mesma região' : 
                     distance < 50 ? 'mesmo estado' : 'estados diferentes';
      
      console.log(`📏 ${category}: ${distance.toFixed(1)}km`);
      return distance;

    } catch (error) {
      console.error("❌ Erro ao calcular distância entre CEPs:", error);
      return null;
    }
  }

  // Mapa aproximado de coordenadas das principais cidades brasileiras
  getCityCoordinates(city, state) {
    const cityCoords = {
      // São Paulo
      'São Paulo': { lat: -23.5505, lng: -46.6333 },
      'Praia Grande': { lat: -24.0058, lng: -46.4030 },
      'Campinas': { lat: -22.9099, lng: -47.0626 },
      'Santos': { lat: -23.9608, lng: -46.3331 },
      
      // Rio de Janeiro
      'Rio de Janeiro': { lat: -22.9068, lng: -43.1729 },
      'Niterói': { lat: -22.8833, lng: -43.1036 },
      
      // Minas Gerais
      'Belo Horizonte': { lat: -19.9167, lng: -43.9345 },
      'Uberlândia': { lat: -18.9113, lng: -48.2622 },
      
      // Rio Grande do Sul
      'Porto Alegre': { lat: -30.0346, lng: -51.2177 },
      'Caxias do Sul': { lat: -29.1678, lng: -51.1794 },
      
      // Paraná
      'Curitiba': { lat: -25.4284, lng: -49.2733 },
      'Londrina': { lat: -23.3045, lng: -51.1696 },
      
      // Bahia
      'Salvador': { lat: -12.9714, lng: -38.5014 },
      'Feira de Santana': { lat: -12.2664, lng: -38.9663 },
      
      // Ceará
      'Fortaleza': { lat: -3.7172, lng: -38.5433 },
      
      // Pernambuco
      'Recife': { lat: -8.0476, lng: -34.8770 },
      
      // Acre
      'Rio Branco': { lat: -9.9754, lng: -67.8244 }
    };

    // Buscar coordenadas específicas da cidade
    if (cityCoords[city]) {
      return cityCoords[city];
    }

    // Fallback para coordenadas aproximadas por estado
    const stateCoords = {
      'SP': { lat: -23.5505, lng: -46.6333 }, // São Paulo
      'RJ': { lat: -22.9068, lng: -43.1729 }, // Rio de Janeiro
      'MG': { lat: -19.9167, lng: -43.9345 }, // Belo Horizonte
      'RS': { lat: -30.0346, lng: -51.2177 }, // Porto Alegre
      'PR': { lat: -25.4284, lng: -49.2733 }, // Curitiba
      'SC': { lat: -27.5954, lng: -48.5480 }, // Florianópolis
      'BA': { lat: -12.9714, lng: -38.5014 }, // Salvador
      'CE': { lat: -3.7172, lng: -38.5433 },  // Fortaleza
      'PE': { lat: -8.0476, lng: -34.8770 },  // Recife
      'AC': { lat: -9.9754, lng: -67.8244 }   // Rio Branco
    };

    return stateCoords[state] || { lat: -15.7801, lng: -47.9292 }; // Brasília como fallback
  }

  // Fórmula de Haversine para calcular distância entre coordenadas
  calculateHaversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Raio da Terra em km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLng = this.deg2rad(lng2 - lng1);
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    return Math.round(distance * 10) / 10; // Arredondar para 1 casa decimal
  }

  deg2rad(deg) {
    return deg * (Math.PI / 180);
  }

  // Função para calcular se dois usuários estão dentro do raio de busca um do outro
  async calculateMutualDistance(user1, user2) {
    try {
      const distance = await this.calculateDistanceBetweenCEPs(
        user1.cep,
        user2.cep,
      );

      if (distance === null) {
        return { withinRange: false, distance: null };
      }

      // Verificar se ambos usuários estão dentro do raio de busca um do outro
      const user1Radius = user1.premium ? 100 : user1.locationRadius || 30;
      const user2Radius = user2.premium ? 100 : user2.locationRadius || 30;

      // Para estar no Discovery, a distância deve estar dentro do raio de AMBOS usuários
      const withinRange = distance <= user1Radius && distance <= user2Radius;

      console.log(
        `📍 Distância entre ${user1.name} (raio: ${user1Radius}km) e ${user2.name} (raio: ${user2Radius}km): ${distance.toFixed(1)}km - ${withinRange ? "DENTRO" : "FORA"} do alcance mútuo`,
      );

      return {
        withinRange,
        distance: parseFloat(distance.toFixed(1)),
        user1Radius,
        user2Radius,
      };
    } catch (error) {
      console.error("❌ Erro ao calcular distância mútua:", error);
      return { withinRange: false, distance: null };
    }
  }

  // Verificar se usuário deve reaparecer no Discovery
  async shouldReappearInDiscovery(currentUserId, targetUserId) {
    try {
      // Buscar último swipe entre esses usuários
      const lastSwipe = await this.db
        .select()
        .from(swipes)
        .where(
          and(
            eq(swipes.swiperId, currentUserId),
            eq(swipes.swipedUserId, targetUserId),
          ),
        )
        .orderBy(swipes.createdAt, "desc")
        .limit(1);

      // Se não há swipe anterior, usuário pode aparecer
      if (lastSwipe.length === 0) {
        return true;
      }

      // Buscar dados atuais dos usuários
      const currentUser = await this.getUserById(currentUserId);
      const targetUser = await this.getUserById(targetUserId);

      if (!currentUser || !targetUser) {
        return false;
      }

      // Verificar se ambos têm campo updatedAt mais recente que o último swipe
      const swipeDate = new Date(lastSwipe[0].createdAt);
      const currentUserUpdated = new Date(
        currentUser.updatedAt || currentUser.createdAt,
      );
      const targetUserUpdated = new Date(
        targetUser.updatedAt || targetUser.createdAt,
      );

      // Se AMBOS usuários foram atualizados após o último swipe, podem reaparecer
      const bothUpdatedAfterSwipe =
        currentUserUpdated > swipeDate && targetUserUpdated > swipeDate;

      if (bothUpdatedAfterSwipe) {
        console.log(
          `🔄 Usuário ${targetUserId} pode reaparecer para ${currentUserId} (ambos atualizaram serviços após último swipe)`,
        );
        return true;
      }

      // Alternativamente, se passou mais de 30 dias, permitir reaparecer
      const daysSinceSwipe = (new Date() - swipeDate) / (1000 * 60 * 60 * 24);
      if (daysSinceSwipe > 30) {
        console.log(
          `🔄 Usuário ${targetUserId} pode reaparecer para ${currentUserId} (${daysSinceSwipe.toFixed(0)} dias desde último swipe)`,
        );
        return true;
      }

      // Caso contrário, não reaparecer
      return false;
    } catch (error) {
      console.error("❌ Erro ao verificar reaparecer no discovery:", error);
      return false;
    }
  }

  async clearAllLikes() {
    try {
      await this.db.delete(swipes);
      console.log("✅ Likes limpos do PostgreSQL");
    } catch (error) {
      console.error("❌ Erro ao limpar likes:", error);
    }
  }

  // MATCHES
  async createMatch(userId1, userId2) {
    try {
      const [match] = await this.db
        .insert(matches)
        .values({
          user1Id: userId1,
          user2Id: userId2,
        })
        .returning();

      console.log("✅ Match salvo no PostgreSQL");
      return match;
    } catch (error) {
      console.error("❌ Erro ao criar match:", error);
      throw error;
    }
  }

  async getUserMatches(userId) {
    try {
      const userMatches = await this.db
        .select()
        .from(matches)
        .where(or(eq(matches.user1Id, userId), eq(matches.user2Id, userId)));

      return userMatches;
    } catch (error) {
      console.error("❌ Erro ao buscar matches do usuário:", error);
      return [];
    }
  }

  async getAllMatches() {
    try {
      const allMatches = await this.db.select().from(matches);
      return allMatches;
    } catch (error) {
      console.error("❌ Erro ao buscar matches:", error);
      return [];
    }
  }

  async deleteMatch(matchId) {
    try {
      await this.db.delete(matches).where(eq(matches.id, matchId));
      console.log(`✅ Match ${matchId} removido do PostgreSQL`);
      return true;
    } catch (error) {
      console.error("❌ Erro ao deletar match:", error);
      throw error;
    }
  }

  async clearAllMatches() {
    try {
      await this.db.delete(matches);
      console.log("✅ Matches limpos do PostgreSQL");
    } catch (error) {
      console.error("❌ Erro ao limpar matches:", error);
    }
  }

  // MENSAGENS
  async createMessage(matchId, senderId, content) {
    try {
      const [message] = await this.db
        .insert(messages)
        .values({
          matchId: matchId,
          senderId: senderId,
          content: content,
        })
        .returning();

      console.log("✅ Mensagem salva no PostgreSQL");
      return message;
    } catch (error) {
      console.error("❌ Erro ao criar mensagem:", error);
      throw error;
    }
  }

  async getMatchMessages(matchId, limit = 100) {
    try {
      console.log(`📖 Buscando histórico de mensagens: match ${matchId}, limite ${limit}`);
      
      // Buscar mensagens ordenadas por data DESC (mais recentes primeiro) com limite especificado
      // CORREÇÃO: usar match_id (snake_case) que é o nome correto da coluna no banco
      const matchMessages = await this.db
        .select()
        .from(messages)
        .where(eq(messages.matchId, matchId))  // messages.matchId mapeia para match_id
        .orderBy(desc(messages.createdAt))      // messages.createdAt mapeia para created_at
        .limit(limit);

      console.log(`📊 Histórico encontrado: ${matchMessages.length} mensagens do banco`);
      
      // Retornar em ordem cronológica (mais antigas primeiro) para o frontend
      const chronologicalMessages = matchMessages.reverse();
      
      if (chronologicalMessages.length > 0) {
        const firstMsg = chronologicalMessages[0];
        const lastMsg = chronologicalMessages[chronologicalMessages.length - 1];
        console.log(`📅 Período: ${new Date(firstMsg.createdAt).toLocaleString()} até ${new Date(lastMsg.createdAt).toLocaleString()}`);
      }
      
      return chronologicalMessages;
    } catch (error) {
      console.error("❌ Erro ao buscar mensagens do match:", error);
      return [];
    }
  }

  async getAllMessages() {
    try {
      const allMessages = await this.db.select().from(messages);
      return allMessages;
    } catch (error) {
      console.error("❌ Erro ao buscar mensagens:", error);
      return [];
    }
  }

  async clearAllMessages() {
    try {
      await this.db.delete(messages);
      console.log("✅ Mensagens limpas do PostgreSQL");
    } catch (error) {
      console.error("❌ Erro ao limpar mensagens:", error);
    }
  }

  // DENÚNCIAS (usando tabela blocks)
  async createReport(reporterId, reportedUserId, reason) {
    try {
      const [report] = await this.db
        .insert(blocks)
        .values({
          reporterId: reporterId,
          reportedId: reportedUserId,
          reason: reason,
        })
        .returning();

      console.log("✅ Denúncia salva no PostgreSQL");
      return report;
    } catch (error) {
      console.error("❌ Erro ao criar denúncia:", error);
      throw error;
    }
  }

  async getAllReports() {
    try {
      const allReports = await this.db.select().from(blocks);
      return allReports.map((report) => ({
        ...report,
        reportedUserId: report.reportedId, // Compatibilidade
      }));
    } catch (error) {
      console.error("❌ Erro ao buscar denúncias:", error);
      return [];
    }
  }

  // SUGESTÕES (usando tabela feedback)
  async createSuggestion(userId, userEmail, userName, suggestion) {
    try {
      const [newSuggestion] = await this.db
        .insert(feedback)
        .values({
          userId: userId,
          message: suggestion, // CORREÇÃO: usar 'message' ao invés de 'content'
        })
        .returning();

      console.log("✅ Sugestão salva no PostgreSQL");
      return {
        ...newSuggestion,
        userEmail: userEmail,
        userName: userName,
        suggestion: suggestion,
      };
    } catch (error) {
      console.error("❌ Erro ao criar sugestão:", error);
      throw error;
    }
  }

  async getAllSuggestions() {
    try {
      const allSuggestions = await this.db.select().from(feedback);
      return allSuggestions.map((s) => ({
        ...s,
        suggestion: s.message, // CORREÇÃO: usar 'message' ao invés de 'content'
        userEmail: "user@ajudex.com", // Placeholder
        userName: "Usuário", // Placeholder
      }));
    } catch (error) {
      console.error("❌ Erro ao buscar sugestões:", error);
      return [];
    }
  }

  // TOKENS DE RESET
  async createPasswordResetToken(email, token) {
    try {
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 15); // Expira em 15 minutos

      const [resetToken] = await this.db
        .insert(passwordResetTokens)
        .values({
          email: email,
          token: token,
          expiresAt: expiresAt,
        })
        .returning();

      return resetToken;
    } catch (error) {
      console.error("❌ Erro ao criar token de reset:", error);
      throw error;
    }
  }

  async getValidPasswordResetToken(email, token) {
    try {
      const [resetToken] = await this.db
        .select()
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.email, email),
            eq(passwordResetTokens.token, token),
          ),
        );

      if (!resetToken) return null;

      // Verificar se não expirou
      if (new Date() > new Date(resetToken.expiresAt)) {
        return null;
      }

      return resetToken;
    } catch (error) {
      console.error("❌ Erro ao buscar token de reset:", error);
      return null;
    }
  }

  async deletePasswordResetToken(email, token) {
    try {
      await this.db
        .delete(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.email, email),
            eq(passwordResetTokens.token, token),
          ),
        );
    } catch (error) {
      console.error("❌ Erro ao deletar token de reset:", error);
    }
  }
}

module.exports = new DatabaseService();
