const MarketItem = require('../models/MarketItem');
const User = require('../models/User');
const Inventory = require('../models/Inventory');
const { SHOP_ITEMS } = require('./shopController');

// GET /api/market/list - Получить все активные объявления
async function listMarketItems(req, res) {
  try {
    const items = await MarketItem.find({ status: 'active' })
      .populate('seller', 'name username avatar eloRating')
      .sort({ createdAt: -1 });

    // Обогащаем деталями предметов из SHOP_ITEMS
    const enriched = items.map(item => {
      const details = SHOP_ITEMS[item.itemId];
      return {
        ...item.toObject(),
        details: details || { name: 'Неизвестный предмет', description: 'Нет описания' }
      };
    });

    res.status(255).json(enriched);
  } catch (error) {
    console.error('Ошибка получения рынка:', error);
    res.status(500).json({ error: 'Ошибка получения объявлений на рынке' });
  }
}

// POST /api/market/sell - Выставить предмет на продажу
async function sellMarketItem(req, res) {
  try {
    const { itemId, price } = req.body;
    const sellerId = req.user;

    if (!itemId || !price || Number(price) <= 0) {
      return res.status(400).json({ error: 'Необходимо указать ID предмета и цену больше нуля' });
    }

    const itemDetails = SHOP_ITEMS[itemId];
    if (!itemDetails) {
      return res.status(404).json({ error: 'Предмет не существует в игровом каталоге' });
    }

    // Проверяем наличие предмета в инвентаре продавца
    const inventoryItem = await Inventory.findOne({ userId: sellerId, itemId });
    if (!inventoryItem || inventoryItem.quantity <= 0) {
      return res.status(403).json({ error: 'У вас нет этого предмета в инвентаре' });
    }

    // Списываем 1 штуку из инвентаря
    inventoryItem.quantity -= 1;
    if (inventoryItem.quantity <= 0) {
      await Inventory.findByIdAndDelete(inventoryItem._id);
    } else {
      await inventoryItem.save();
    }

    // Создаем лот на рынке
    const marketItem = new MarketItem({
      seller: sellerId,
      itemId,
      itemType: itemDetails.type,
      price: Math.round(Number(price)),
      status: 'active'
    });
    await marketItem.save();

    res.status(201).json({
      message: `Лот "${itemDetails.name}" успешно выставлен на рынок за ${price} ₸ Кармы`,
      marketItem
    });
  } catch (error) {
    console.error('Ошибка выставления лота:', error);
    res.status(500).json({ error: 'Ошибка сервера при публикации лота' });
  }
}

// POST /api/market/buy/:id - Купить лот с рынка
async function buyMarketItem(req, res) {
  try {
    const listingId = req.params.id;
    const buyerId = req.user;

    const marketItem = await MarketItem.findById(listingId);
    if (!marketItem || marketItem.status !== 'active') {
      return res.status(404).json({ error: 'Лот не найден или уже продан/отменен' });
    }

    if (marketItem.seller.toString() === buyerId.toString()) {
      return res.status(400).json({ error: 'Нельзя купить свой собственный лот' });
    }

    const [buyer, seller] = await Promise.all([
      User.findById(buyerId),
      User.findById(marketItem.seller)
    ]);

    if (!buyer) return res.status(404).json({ error: 'Покупатель не найден' });
    if (!seller) return res.status(404).json({ error: 'Продавец не найден' });

    if (buyer.karma < marketItem.price) {
      return res.status(400).json({
        error: `Недостаточно Кармы. Требуется: ${marketItem.price} ₸ Кармы, у вас: ${buyer.karma} ₸.`
      });
    }

    // Переводим Карму
    buyer.karma -= marketItem.price;
    seller.karma += marketItem.price;
    seller.stats.totalKarmaEarned += marketItem.price;

    // Переносим предмет покупателю в инвентарь
    let buyerInv = await Inventory.findOne({ userId: buyerId, itemId: marketItem.itemId });
    if (buyerInv) {
      buyerInv.quantity += 1;
      await buyerInv.save();
    } else {
      buyerInv = new Inventory({
        userId: buyerId,
        itemType: marketItem.itemType,
        itemId: marketItem.itemId,
        quantity: 1
      });
      await buyerInv.save();
    }

    // Маркируем лот как проданный
    marketItem.status = 'sold';
    
    await Promise.all([buyer.save(), seller.save(), marketItem.save()]);

    res.status(200).json({
      message: `Покупка успешно совершена! Списано ${marketItem.price} Кармы`,
      buyer: { _id: buyer._id, name: buyer.name, karma: buyer.karma },
      marketItem
    });
  } catch (error) {
    console.error('Ошибка покупки лота:', error);
    res.status(500).json({ error: 'Ошибка сервера при обработке покупки' });
  }
}

// POST /api/market/cancel/:id - Отменить лот и вернуть предмет продавцу
async function cancelMarketItem(req, res) {
  try {
    const listingId = req.params.id;
    const userId = req.user;

    const marketItem = await MarketItem.findById(listingId);
    if (!marketItem || marketItem.status !== 'active') {
      return res.status(404).json({ error: 'Лот не найден или не активен' });
    }

    const user = await User.findById(userId);
    const isSeller = marketItem.seller.toString() === userId.toString();
    const isAdmin = user && user.role === 'admin';

    if (!isSeller && !isAdmin) {
      return res.status(403).json({ error: 'У вас нет прав для отмены этого лота' });
    }

    // Возвращаем предмет продавцу
    let sellerInv = await Inventory.findOne({ userId: marketItem.seller, itemId: marketItem.itemId });
    if (sellerInv) {
      sellerInv.quantity += 1;
      await sellerInv.save();
    } else {
      sellerInv = new Inventory({
        userId: marketItem.seller,
        itemType: marketItem.itemType,
        itemId: marketItem.itemId,
        quantity: 1
      });
      await sellerInv.save();
    }

    marketItem.status = 'cancelled';
    await marketItem.save();

    res.status(200).json({
      message: 'Лот успешно отменен, предмет возвращен в инвентарь',
      marketItem
    });
  } catch (error) {
    console.error('Ошибка отмены лота:', error);
    res.status(500).json({ error: 'Ошибка сервера при отмене лота' });
  }
}

module.exports = {
  listMarketItems,
  sellMarketItem,
  buyMarketItem,
  cancelMarketItem
};
