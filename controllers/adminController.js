// controllers/adminController.js
const adminService = require('../services/adminService');
const { uploadMultiple } = require('../services/storageService');

// Получить список пользователей
exports.getAllUsers = async (req, res) => {
  try {
    const { page, limit } = req.query;
    
    const result = await adminService.getAllUsers(page, limit);
    
    // ИСПРАВЛЕНИЕ: возвращаем просто массив, а не { users: [...] }
    res.json(result.users || result);
  } catch (error) {
    console.error('Admin Controller Error (getAllUsers):', error);
    res.status(500).json({ error: error.message });
  }
};

// =========================================================
// ЗАКАЗЫ (ORDERS)
// =========================================================

// Список всех заказов
exports.getAllOrders = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const result = await adminService.getAllOrders(page, limit);
    
    // ИСПРАВЛЕНИЕ: возвращаем просто массив
    res.json(result.orders || result);
  } catch (error) {
    console.error('Admin Controller Error (getAllOrders):', error);
    res.status(500).json({ error: error.message });
  }
};

// Детали одного заказа
exports.getOrderDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await adminService.getOrderDetails(id);
    res.json(order);
  } catch (error) {
    console.error('Admin Controller Error (getOrderDetails):', error);
    if (error.message === 'Заказ не найден') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

// Изменение статуса
exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Необходимо указать новый статус' });
    }

    const result = await adminService.updateOrderStatus(id, status);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// =========================================================
// СТАТИСТИКА (STATS)
// =========================================================

exports.getStats = async (req, res) => {
  try {
    const stats = await adminService.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Admin Controller Error (getStats):', error);
    res.status(500).json({ error: error.message });
  }
};

// =========================================================
// ОПЕРАТИВНАЯ ПАМЯТЬ (RAM)
// =========================================================

// Получить список RAM
exports.getAllRam = async (req, res) => {
  try {
    const ramList = await adminService.getAllRam();
    res.json(ramList);
  } catch (error) {
    console.error('Admin Controller Error (getAllRam):', error);
    res.status(500).json({ error: error.message });
  }
};

// Создать RAM
exports.createRam = async (req, res) => {
  try {
    const { size_gb } = req.body;
    
    if (!size_gb) {
      return res.status(400).json({ error: 'Необходимо указать объем памяти' });
    }

    const result = await adminService.createRam(size_gb);
    res.status(201).json(result);
  } catch (error) {
    console.error('Admin Controller Error (createRam):', error);
    res.status(400).json({ error: error.message });
  }
};

// Обновить RAM
exports.updateRam = async (req, res) => {
  try {
    const { id } = req.params;
    const { size_gb } = req.body;

    if (!size_gb) {
      return res.status(400).json({ error: 'Необходимо указать объем памяти' });
    }

    const result = await adminService.updateRam(id, size_gb);
    res.json(result);
  } catch (error) {
    console.error('Admin Controller Error (updateRam):', error);
    res.status(400).json({ error: error.message });
  }
};

// Удалить RAM
exports.deleteRam = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await adminService.deleteRam(id);
    res.json(result);
  } catch (error) {
    console.error('Admin Controller Error (deleteRam):', error);
    // Возвращаем 400 для ошибок зависимостей, 500 для остальных
    const statusCode = error.message.includes('Нельзя удалить') ? 400 : 500;
    res.status(statusCode).json({ error: error.message });
  }
};

// =========================================================
// ВНУТРЕННЯЯ ПАМЯТЬ (STORAGE)
// =========================================================

// Получить список Storage
exports.getAllStorage = async (req, res) => {
  try {
    const storageList = await adminService.getAllStorage();
    res.json(storageList);
  } catch (error) {
    console.error('Admin Controller Error (getAllStorage):', error);
    res.status(500).json({ error: error.message });
  }
};

// Создать Storage
exports.createStorage = async (req, res) => {
  try {
    const { size_gb } = req.body;
    
    if (!size_gb) {
      return res.status(400).json({ error: 'Необходимо указать объем памяти' });
    }

    const result = await adminService.createStorage(size_gb);
    res.status(201).json(result);
  } catch (error) {
    console.error('Admin Controller Error (createStorage):', error);
    res.status(400).json({ error: error.message });
  }
};

// Обновить Storage
exports.updateStorage = async (req, res) => {
  try {
    const { id } = req.params;
    const { size_gb } = req.body;

    if (!size_gb) {
      return res.status(400).json({ error: 'Необходимо указать объем памяти' });
    }

    const result = await adminService.updateStorage(id, size_gb);
    res.json(result);
  } catch (error) {
    console.error('Admin Controller Error (updateStorage):', error);
    res.status(400).json({ error: error.message });
  }
};

// Удалить Storage
exports.deleteStorage = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await adminService.deleteStorage(id);
    res.json(result);
  } catch (error) {
    console.error('Admin Controller Error (deleteStorage):', error);
    // Возвращаем 400 для ошибок зависимостей, 500 для остальных
    const statusCode = error.message.includes('Нельзя удалить') ? 400 : 500;
    res.status(statusCode).json({ error: error.message });
  }
};

// =========================================================
// ЦВЕТА (COLORS)
// =========================================================

// Получить список цветов
exports.getAllColors = async (req, res) => {
  try {
    const colorsList = await adminService.getAllColors();
    res.json(colorsList);
  } catch (error) {
    console.error('Admin Controller Error (getAllColors):', error);
    res.status(500).json({ error: error.message });
  }
};

// Создать цвет
exports.createColor = async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Необходимо указать название цвета' });
    }

    const result = await adminService.createColor(name);
    res.status(201).json(result);
  } catch (error) {
    console.error('Admin Controller Error (createColor):', error);
    res.status(400).json({ error: error.message });
  }
};

// Обновить цвет
exports.updateColor = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Необходимо указать название цвета' });
    }

    const result = await adminService.updateColor(id, name);
    res.json(result);
  } catch (error) {
    console.error('Admin Controller Error (updateColor):', error);
    res.status(400).json({ error: error.message });
  }
};

// Удалить цвет
exports.deleteColor = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await adminService.deleteColor(id);
    res.json(result);
  } catch (error) {
    console.error('Admin Controller Error (deleteColor):', error);
    // Возвращаем 400 для ошибок зависимостей, 500 для остальных
    const statusCode = error.message.includes('Нельзя удалить') ? 400 : 500;
    res.status(statusCode).json({ error: error.message });
  }
};

// =========================================================
// БРЕНДЫ (BRANDS)
// =========================================================

// Получить список брендов
exports.getAllBrands = async (req, res) => {
  try {
    const brandsList = await adminService.getAllBrands();
    res.json(brandsList);
  } catch (error) {
    console.error('Admin Controller Error (getAllBrands):', error);
    res.status(500).json({ error: error.message });
  }
};

// Создать бренд
exports.createBrand = async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Необходимо указать название бренда' });
    }

    const result = await adminService.createBrand(name);
    res.status(201).json(result);
  } catch (error) {
    console.error('Admin Controller Error (createBrand):', error);
    res.status(400).json({ error: error.message });
  }
};

// Обновить бренд
exports.updateBrand = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Необходимо указать название бренда' });
    }

    const result = await adminService.updateBrand(id, name);
    res.json(result);
  } catch (error) {
    console.error('Admin Controller Error (updateBrand):', error);
    res.status(400).json({ error: error.message });
  }
};

// Удалить бренд
exports.deleteBrand = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await adminService.deleteBrand(id);
    res.json(result);
  } catch (error) {
    console.error('Admin Controller Error (deleteBrand):', error);
    // Возвращаем 400 для ошибок зависимостей, 500 для остальных
    const statusCode = error.message.includes('Нельзя удалить') ? 400 : 500;
    res.status(statusCode).json({ error: error.message });
  }
};

// =========================================================
// ТОВАРЫ (PRODUCTS) - ДЛЯ СПИСКА
// =========================================================

// Получить список товаров для админки
exports.getAdminProducts = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const result = await adminService.getAdminProducts(page, limit);
    res.json(result);
  } catch (error) {
    console.error('Admin Controller Error (getAdminProducts):', error);
    res.status(500).json({ error: error.message });
  }
};

// =========================================================
// ТОВАРЫ (PRODUCTS) - ДЕТАЛЬНАЯ ИНФОРМАЦИЯ
// =========================================================

// Получить товар для редактирования
exports.getAdminProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await adminService.getAdminProductById(id);
    res.json(product);
  } catch (error) {
    console.error('Admin Controller Error (getAdminProductById):', error);
    if (error.message === 'Товар не найден') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

// =========================================================
// ТОВАРЫ (PRODUCTS) - СОЗДАНИЕ, ОБНОВЛЕНИЕ, УДАЛЕНИЕ
// =========================================================

// Создать товар (с загрузкой файлов для каждого варианта)
exports.createProduct = async (req, res) => {
  try {
    uploadMultiple(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      const { name, brandId, description, specs, variants } = req.body;

      // Парсим JSON
      const parsedVariants = typeof variants === 'string' ? JSON.parse(variants) : variants;
      const parsedSpecs = typeof specs === 'string' ? JSON.parse(specs) : specs;

      // Валидация
      if (!name || !brandId) {
        return res.status(400).json({ error: 'Название и бренд обязательны' });
      }

      if (!parsedVariants || parsedVariants.length === 0) {
        return res.status(400).json({ error: 'Необходимо добавить хотя бы один вариант товара' });
      }

      // Сопоставляем файлы с вариантами по индексу
      // req.files - это массив файлов, отправленных с полями variant_0_image, variant_1_image и т.д.
      const filesMap = {};
      if (req.files) {
        req.files.forEach(file => {
          // Извлекаем индекс из имени поля: variant_0_image -> 0
          const match = file.fieldname.match(/variant_(\d+)_image/);
          if (match) {
            filesMap[match[1]] = file;
          }
        });
      }

      // Добавляем файлы к соответствующим вариантам
      const variantsWithFiles = parsedVariants.map((variant, index) => ({
        ...variant,
        file: filesMap[index] || null // Привязываем файл к варианту
      }));

      const result = await adminService.createProduct({
        name,
        brandId,
        description,
        specs: parsedSpecs,
        variants: variantsWithFiles
      });

      res.status(201).json(result);
    });
  } catch (error) {
    console.error('Admin Controller Error (createProduct):', error);
    res.status(400).json({ error: error.message });
  }
};

// Обновить товар (с загрузкой файлов для каждого варианта)
exports.updateProduct = async (req, res) => {
  try {
    uploadMultiple(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      const { id } = req.params;
      const { name, brandId, description, specs, variants } = req.body;

      // Парсим JSON
      const parsedVariants = typeof variants === 'string' ? JSON.parse(variants) : variants;
      const parsedSpecs = typeof specs === 'string' ? JSON.parse(specs) : specs;

      // Валидация
      if (!name || !brandId) {
        return res.status(400).json({ error: 'Название и бренд обязательны' });
      }

      if (!parsedVariants || parsedVariants.length === 0) {
        return res.status(400).json({ error: 'Необходимо добавить хотя бы один вариант товара' });
      }

      // Сопоставляем файлы с вариантами по индексу
      const filesMap = {};
      if (req.files) {
        req.files.forEach(file => {
          const match = file.fieldname.match(/variant_(\d+)_image/);
          if (match) {
            filesMap[match[1]] = file;
          }
        });
      }

      // Добавляем файлы к соответствующим вариантам
      const variantsWithFiles = parsedVariants.map((variant, index) => ({
        ...variant,
        file: filesMap[index] || null
      }));

      const result = await adminService.updateProduct(
        id,
        {
          name,
          brandId,
          description,
          specs: parsedSpecs,
          variants: variantsWithFiles
        }
      );

      res.json(result);
    });
  } catch (error) {
    console.error('Admin Controller Error (updateProduct):', error);
    res.status(400).json({ error: error.message });
  }
};

// Удалить товар
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await adminService.deleteProduct(id);
    res.json(result);
  } catch (error) {
    console.error('Admin Controller Error (deleteProduct):', error);
    const statusCode = error.message.includes('Нельзя удалить') ? 400 : 500;
    res.status(statusCode).json({ error: error.message });
  }
};