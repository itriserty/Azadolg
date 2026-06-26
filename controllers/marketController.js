const MarketItem = require('../models/MarketItem');
const User = require('../models/User');
const LotteryPool = require('../models/LotteryPool');
const { checkLotteryAndProcess } = require('../services/lotteryService');

// Процент комиссии, уходящий в пул лотереи (10%)
const LOTTERY_FEE_PERCENT = 0.10;

/**
 * Покупка товара на маркете
 * POST /market/buy
 */
async function buyMarketItem(req, res) {
  try {
    const { itemId } = req.body;
    // Берем ID покупателя из заголовка или из тела запроса
    const buyerId = req.headers['x-user-id'] || req.body.buyerId;

    if (!itemId) {
      return res.status(400).json({ error: 'Не указан ID товара (itemId)' });
    }
    if (!buyerId) {
      return res.status(400).json({ error: 'Не указан ID покупателя (заголовок x-user-id или buyerId)' });
    }

    // 1. Находим товар и его продавца
    const item = await MarketItem.findById(itemId);
    if (!item) {
      return res.status(404).json({ error: 'Товар на маркете не найден' });
    }

    // 2. Находим покупателя
    const buyer = await User.findById(buyerId);
    if (!buyer) {
      return res.status(404).json({ error: 'Покупатель не найден' });
    }

    if (item.seller.toString() === buyerId) {
      return res.status(400).json({ error: 'Вы не можете купить свой собственный товар' });
    }

    // 3. Проверяем баланс покупателя
    if (buyer.balance < item.price) {
      return res.status(400).json({ 
        error: `Недостаточно средств. Стоимость товара: ${item.price}, ваш баланс: ${buyer.balance}` 
      });
    }

    // 4. Проводим расчеты
    const lotteryFee = Math.round(item.price * LOTTERY_FEE_PERCENT);
    const sellerEarnings = item.price - lotteryFee;

    // Списываем средства с покупателя
    buyer.balance -= item.price;
    await buyer.save();

    // Начисляем средства продавцу
    const seller = await User.findByIdAndUpdate(
      item.seller,
      { $inc: { balance: sellerEarnings } },
      { new: true }
    );

    if (!seller) {
      // Откат транзакции баланса покупателя в случае сбоя продавца
      buyer.balance += item.price;
      await buyer.save();
      return res.status(404).json({ error: 'Продавец товара не найден' });
    }

    // 5. Начисляем комиссию в пул лотереи и добавляем лотерейный билет
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    let activePool = await LotteryPool.findOne({ isActive: true });
    if (!activePool) {
      activePool = new LotteryPool({
        poolAmount: 0,
        tickets: [],
        month: currentMonthStr,
        isActive: true
      });
    }

    activePool.poolAmount += lotteryFee;
    // Покупатель получает билет за совершенную покупку
    activePool.tickets.push(buyerId);
    await activePool.save();

    console.log(`[MARKET] Purchase successful. price=${item.price}, fee=${lotteryFee} added to lottery pool (${activePool.poolAmount}/10000). Buyer got a ticket.`);

    // 6. Вызываем проверку лотереи и обработку результатов
    const lotteryResult = await checkLotteryAndProcess();

    // 7. Возвращаем успешный ответ
    res.status(200).json({
      message: 'Покупка успешно совершена',
      transaction: {
        itemTitle: item.title,
        price: item.price,
        buyerDebited: item.price,
        sellerCredited: sellerEarnings,
        lotteryFeeCredited: lotteryFee
      },
      lottery: {
        poolAmount: activePool.poolAmount,
        ticketsCount: activePool.tickets.length,
        lotteryResult
      }
    });

  } catch (error) {
    console.error('Ошибка при покупке на маркете:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера при проведении покупки' });
  }
}

/**
 * Создание товара на маркете (для тестов)
 * POST /market/create
 */
async function createMarketItem(req, res) {
  try {
    const { title, price, seller } = req.body;
    if (!title || !price || !seller) {
      return res.status(400).json({ error: 'Заполните обязательные поля: title, price, seller' });
    }

    const sellerUser = await User.findById(seller);
    if (!sellerUser) {
      return res.status(404).json({ error: 'Продавец не найден' });
    }

    const newItem = new MarketItem({
      title,
      price,
      seller
    });
    await newItem.save();

    res.status(201).json(newItem);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Внутренняя ошибка' });
  }
}

module.exports = {
  buyMarketItem,
  createMarketItem
};
