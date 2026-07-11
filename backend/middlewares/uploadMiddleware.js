const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

// Папка для хранения пруфов оплаты
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'proofs');

// Создаём папку если не существует
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext    = path.extname(file.originalname).toLowerCase();
    cb(null, `proof-${unique}${ext}`);
  }
});

const fileFilter = (_req, file, cb) => {
  const allowed = /^image\/(jpeg|jpg|png|gif|webp)$/i;
  if (allowed.test(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Разрешены только изображения (jpg, png, gif, webp)'), false);
  }
};

const uploadProof = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5 МБ
}).single('proof');

// Папка для хранения аватарок
const AVATAR_DIR = path.join(__dirname, '..', 'uploads', 'avatars');

// Создаём папку если не существует
if (!fs.existsSync(AVATAR_DIR)) {
  fs.mkdirSync(AVATAR_DIR, { recursive: true });
}

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, AVATAR_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext    = path.extname(file.originalname).toLowerCase();
    cb(null, `avatar-${unique}${ext}`);
  }
});

const uploadAvatar = multer({
  storage: avatarStorage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 } // 2 МБ
}).single('avatar');

function uploadAvatarMiddleware(req, res, next) {
  uploadAvatar(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Файл слишком большой. Максимальный размер: 2 МБ' });
      }
      return res.status(400).json({ error: `Ошибка загрузки: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}

// Обёртка, превращающая callback multer в middleware с обработкой ошибок
function uploadProofMiddleware(req, res, next) {
  uploadProof(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Файл слишком большой. Максимальный размер: 5 МБ' });
      }
      return res.status(400).json({ error: `Ошибка загрузки: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}

module.exports = { uploadProofMiddleware, uploadAvatarMiddleware, UPLOAD_DIR, AVATAR_DIR };
