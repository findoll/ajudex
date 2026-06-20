const { pgTable, serial, varchar, text, boolean, timestamp, integer, json } = require('drizzle-orm/pg-core');

// Tabela de usuários (alinhada com estrutura existente)
const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').unique().notNull(),
  password: text('password').notNull(),
  cep: text('cep'),
  address: text('address'),
  neighborhood: text('neighborhood'),
  city: text('city'),
  state: text('state'),
  location: text('location'),
  birthdate: text('birthdate'),
  age: integer('age'),
  locationRadius: integer('location_radius').default(10),
  bio: text('bio'),
  offeredServices: json('offered_services').default([]),
  wantedServices: json('wanted_services').default([]),
  photo: text('photo'),
  premium: boolean('premium').default(false),
  premiumExpirationDate: timestamp('premium_expiration_date'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Tabela de tokens de reset de senha
const passwordResetTokens = pgTable('password_reset_tokens', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull(),
  token: varchar('token', { length: 6 }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow()
});

// Tabela de curtidas (usar tabela swipes existente)
const swipes = pgTable('swipes', {
  id: serial('id').primaryKey(),
  swiperId: integer('swiper_id').references(() => users.id).notNull(),
  swipedUserId: integer('swiped_user_id').references(() => users.id).notNull(),
  direction: text('direction').notNull(), // 'like' ou 'pass'
  createdAt: timestamp('created_at').defaultNow()
});

// Tabela de matches confirmados
const matches = pgTable('matches', {
  id: serial('id').primaryKey(),
  user1Id: integer('user1_id').references(() => users.id).notNull(),
  user2Id: integer('user2_id').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow()
});

// Tabela de mensagens do chat
const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  matchId: integer('match_id').references(() => matches.id).notNull(),
  senderId: integer('sender_id').references(() => users.id).notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow()
});

// Tabela de sugestões dos usuários (usar tabela feedback existente)
const feedback = pgTable('feedback', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  message: text('message').notNull(), // CORREÇÃO: usar 'message' para alinhar com banco
  createdAt: timestamp('created_at').defaultNow()
});

// Tabela de denúncias/bloqueios (usar tabela blocks existente)
const blocks = pgTable('blocks', {
  id: serial('id').primaryKey(),
  reporterId: integer('reporter_id').references(() => users.id).notNull(),
  reportedId: integer('reported_id').references(() => users.id).notNull(),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at').defaultNow()
});

module.exports = {
  users,
  passwordResetTokens,
  swipes,
  matches,
  messages,
  feedback,
  blocks
};
