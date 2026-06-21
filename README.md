# AjudeX

AjudeX is a service-exchange platform that connects people based on the services they offer and the services they need.

## 🌍 Purpose

AjudeX was created to encourage collaboration, community support, and access to services without depending only on money.  
Users can create a profile, list the services they can offer, list the services they need, and connect with people nearby for service exchange.

## ✨ Features

- User registration and login
- JWT authentication
- Password recovery by email
- Profile with city, state, CEP, bio and photo
- Offered services and wanted services
- Discovery of other users
- Likes, matches and chat
- Premium user support
- Stripe payment integration
- SendGrid email integration
- AWS S3/local upload support
- PostgreSQL database with Drizzle ORM
- Docker support
- NGINX configuration for deployment

## 🛠️ Tech Stack

- Node.js
- Express
- JavaScript
- PostgreSQL
- Drizzle ORM
- JWT
- bcrypt
- Stripe
- SendGrid
- AWS S3
- Docker
- NGINX
- HTML/CSS/JavaScript frontend

## 📁 Project Structure

```txt
ajudex/
├── client/              # Frontend pages
├── server/              # Backend API
├── shared/              # Shared database schema
├── nginx/               # NGINX configuration
├── Dockerfile           # Production Docker image
├── package.json         # Dependencies and scripts
├── init-database.sql    # Initial database structure
└── drizzle.config.js    # Drizzle ORM configuration
