const supabase = require('../config/supabase');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { uploadMultiple } = require('../services/storageService');

const BUCKET_NAME = 'products';

// Настройка multer для временного хранения
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = path.join(__dirname, '../uploads/temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    // Временное имя, потом переименуем
    cb(null, Date.now() + '-' + Math.random().toString(36).substring(7));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    // Разрешаем любые изображения
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Разрешены только изображения'));
    }
  }
});

// Генерация имени файла по шаблону
function generateFileName(productName, ram, storage, color, index = '') {
  // Очищаем название от спецсимволов
  const slug = productName
    .toLowerCase()
    .replace(/[^a-z0-9а-яё\s-]/gi, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  
  // Формируем части имени
  const parts = [slug];
  
  if (ram) parts.push(`${ram}gb`);
  if (storage) parts.push(`${storage}gb`);
  if (color) {
    const colorSlug = color
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/gi, '');
    parts.push(colorSlug);
  }
  
  // Добавляем индекс если есть (для множественных файлов)
  if (index) parts.push(index);
  
  return parts.join('-') + '.webp';
}

// Загрузка файла в Supabase Storage
exports.uploadToStorage = async (filePath, fileName) => {
  try {
    const fileContent = fs.readFileSync(filePath);
    
    // Определяем MIME type по расширению файла
    const path = require('path');
    const ext = path.extname(fileName).toLowerCase();
    const mimeTypes = {
      '.webp': 'image/webp',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml'
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    
    // Проверяем, существует ли файл с таким именем
    const { data: existingFile } = await supabase
      .storage
      .from(BUCKET_NAME)
      .download(fileName);

    if (existingFile) {
      // Файл существует - удаляем его сначала
      await supabase
        .storage
        .from(BUCKET_NAME)
        .remove([fileName]);
    }

    // Загружаем новый файл с правильным Content-Type
    const { data, error } = await supabase
      .storage
      .from(BUCKET_NAME)
      .upload(fileName, fileContent, {
        cacheControl: '3600',
        upsert: true,
        contentType: contentType  // ← ДОБАВЛЕНО!
      });

    // Удаляем временный файл
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    if (error) throw error;

    // Получаем публичный URL
    const { data: { publicUrl } } = supabase
      .storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);

    return {
      fileName: data.path,
      url: publicUrl
    };
  } catch (error) {
    console.error('Storage upload error:', error);
    throw new Error(`Ошибка загрузки файла: ${error.message}`);
  }
};

// Удаление файла из хранилища по URL
exports.deleteFromStorage = async (fileUrl) => {
  try {
    if (!fileUrl) return;
    
    // Извлекаем имя файла из URL
    // URL выглядит как: https://.../products/filename.webp
    const urlParts = fileUrl.split('/');
    const fileName = urlParts[urlParts.length - 1];
    
    if (!fileName || fileName === 'products') return;

    const { error } = await supabase
      .storage
      .from(BUCKET_NAME)
      .remove([fileName]);

    if (error) {
      console.error('Storage delete error:', error);
      // Не выбрасываем ошибку, если файл не найден
      if (error.message.includes('not found')) return;
      throw error;
    }
    
    console.log(`[STORAGE] Deleted file: ${fileName}`);
  } catch (error) {
    console.error('Error deleting from storage:', error);
    // Не прерываем выполнение, если удаление не удалось
  }
};

// Обработка загрузки нескольких файлов
exports.uploadMultiple = upload.any();

module.exports.upload = upload;
module.exports.generateFileName = generateFileName;