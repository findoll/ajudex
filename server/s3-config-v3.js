// Configuração AWS S3 v3 para multer-s3@3.0.1
const { S3Client } = require('@aws-sdk/client-s3');
const multer = require('multer');
const multerS3 = require('multer-s3');

// Verificar se todas as credenciais estão disponíveis
if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  console.log('⚠️ ATENÇÃO: Credenciais AWS não configuradas!');
  console.log('   AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? '✅' : '❌');
  console.log('   AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? '✅' : '❌');
  console.log('   Configure as credenciais AWS para habilitar upload de fotos.');
}

// Configuração S3 Client v3
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "eu-north-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Log de debug para S3
console.log("🌐 S3 Config v3:");
console.log(`   - Região: ${process.env.AWS_REGION || "eu-north-1"}`);
console.log(`   - Bucket: ${process.env.AWS_S3_BUCKET_NAME || "ajudex-uploads-prod"}`);
console.log(`   - Access Key: ${process.env.AWS_ACCESS_KEY_ID ? '✅ Configurada' : '❌ Não configurada'}`);
console.log(`   - Secret Key: ${process.env.AWS_SECRET_ACCESS_KEY ? '✅ Configurada' : '❌ Não configurada'}`);

// Verificação de conectividade S3 v3 (opcional)
async function testS3Connection() {
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.log('🔐 Credenciais AWS não disponíveis - uploads desabilitados');
    return false;
  }
  
  try {
    const { HeadBucketCommand } = require('@aws-sdk/client-s3');
    await s3Client.send(new HeadBucketCommand({ 
      Bucket: process.env.AWS_S3_BUCKET_NAME 
    }));
    console.log('✅ Conectividade S3 v3 verificada');
    return true;
  } catch (error) {
    console.log(`❌ Erro S3 v3: ${error.message}`);
    return false;
  }
}

// Chamar teste na inicialização
testS3Connection();

const uploadS3 = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: process.env.AWS_S3_BUCKET_NAME || "ajudex-uploads-prod",
    metadata: function (req, file, cb) {
      console.log('🔧 Multer-S3 v3 metadata callback:', {
        fieldName: file.fieldname,
        originalname: file.originalname,
        mimetype: file.mimetype
      });
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      // Usar ID do usuário como nome da foto
      const userId = req.user?.userId || 'anonymous';
      const fileExtension = file.originalname.split(".").pop();
      const filename = `uploads/profile-${userId}.${fileExtension}`;
      console.log('🔧 Multer-S3 v3 key callback gerando:', filename, 'para usuário ID:', userId);
      cb(null, filename);
    },
    contentType: multerS3.AUTO_CONTENT_TYPE,
    // ACL removido - bucket não permite ACLs
  }),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    console.log('🔧 Multer v3 fileFilter chamado:', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    });
    
    if (file.mimetype.startsWith("image/")) {
      console.log('✅ Arquivo aprovado pelo filtro v3');
      cb(null, true);
    } else {
      console.log('❌ Arquivo rejeitado pelo filtro v3 - não é imagem');
      cb(new Error("Apenas imagens são permitidas"), false);
    }
  },
});

module.exports = { uploadS3, s3Client };
