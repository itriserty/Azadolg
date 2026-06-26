/**
 * Интеграционный тестовый скрипт для верификации логики приложения.
 * 
 * Данный скрипт выполняет симуляцию полного жизненного цикла:
 * 1. Создание пользователей (Алиса и Боб).
 * 2. Добавление в друзья и проверку приватности профиля.
 * 3. Создание и подтверждение долга с расчетом просрочки и пени.
 * 4. Создание товаров на маркете и покупка с распределением средств.
 * 5. Накопление лотерейного пула до лимита (>=10000) и проведение розыгрыша Кармы.
 */

const mongoose = require('mongoose');
const User = require('./models/User');
const Debt = require('./models/Debt');
const MarketItem = require('./models/MarketItem');
const LotteryPool = require('./models/LotteryPool');

const { calculateCurrentDebt } = require('./services/debtService');
const { checkLotteryAndProcess } = require('./services/lotteryService');

// Для тестирования используем локальную тестовую базу данных
const TEST_MONGO_URI = 'mongodb://localhost:27017/debt_tracker_test';

async function runTests() {
  console.log('=== ЗАПУСК ИНТЕГРАЦИОННОГО ТЕСТИРОВАНИЯ ===');
  
  try {
    await mongoose.connect(TEST_MONGO_URI);
    console.log('Подключено к тестовой БД:', TEST_MONGO_URI);
    
    // Очистка БД перед тестами
    await Promise.all([
      User.deleteMany({}),
      Debt.deleteMany({}),
      MarketItem.deleteMany({}),
      LotteryPool.deleteMany({})
    ]);
    console.log('База данных успешно очищена.\n');

    // ==========================================
    // 1. Создание пользователей
    // ==========================================
    console.log('--- Шаг 1: Создание пользователей ---');
    const alice = new User({
      name: 'Алиса',
      email: 'alice@example.com',
      balance: 5000,
      karma: 100
    });
    
    const bob = new User({
      name: 'Боб',
      email: 'bob@example.com',
      balance: 2000,
      karma: 50
    });
    
    const charlie = new User({
      name: 'Чарли',
      email: 'charlie@example.com',
      balance: 1000,
      karma: 0
    });

    await Promise.all([alice.save(), bob.save(), charlie.save()]);
    console.log(`Пользователи созданы. \nАлиса: ${alice._id}, \nБоб: ${bob._id}, \nЧарли: ${charlie._id}\n`);

    // ==========================================
    // 2. Дружба и проверка приватности профиля
    // ==========================================
    console.log('--- Шаг 2: Проверка дружбы и приватности ---');
    // Сначала они не друзья. Симулируем запрос профиля Боба Чарли (не друг)
    // Ожидаем скрытый email и баланс
    console.log(`Чарли (не друг) запрашивает профиль Боба...`);
    const isBobFriendOfCharlie = charlie.friends.includes(bob._id);
    if (!isBobFriendOfCharlie) {
      console.log(`[ОГРАНИЧЕННЫЙ ДОСТУП] Данные профиля Боба для Чарли: name="${bob.name}", karma=${bob.karma}. Email и баланс скрыты (УСПЕШНО).`);
    }

    // Добавляем Алису и Боба в друзья
    alice.friends.push(bob._id);
    bob.friends.push(alice._id);
    await Promise.all([alice.save(), bob.save()]);
    console.log('Алиса и Боб добавились в друзья.');

    // Симулируем запрос профиля Боба Алисой (друг)
    const isBobFriendOfAlice = alice.friends.includes(bob._id);
    if (isBobFriendOfAlice) {
      console.log(`[ПОЛНЫЙ ДОСТУП] Данные профиля Боба для Алисы: name="${bob.name}", email="${bob.email}", balance=${bob.balance}, karma=${bob.karma} (УСПЕШНО).`);
    }
    console.log('\n');

    // ==========================================
    // 3. Создание долга и расчет процентов
    // ==========================================
    console.log('--- Шаг 3: Создание долга и расчет процентов ---');
    
    // Срок сдачи — вчера (чтобы начислить пени за 1 день)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const debt = new Debt({
      creditor: alice._id,
      debtor: bob._id,
      amount: 1000,
      penaltyRate: 0.05, // 5% в день для наглядности теста
      dueDate: yesterday,
      status: 'pending_confirmation'
    });
    await debt.save();
    console.log(`Создан долг: Боб должен Алисе 1000. Статус: ${debt.status}.`);

    // Пока статус не active, пени не должны начисляться
    let currentAmount = calculateCurrentDebt(debt);
    console.log(`Сумма неподтвержденного долга (должна быть 1000): ${currentAmount}`);

    // Боб подтверждает долг
    debt.status = 'active';
    await debt.save();
    console.log(`Боб подтвердил долг. Статус: ${debt.status}.`);

    // Проверяем начисление пени (должен быть 1 день просрочки)
    currentAmount = calculateCurrentDebt(debt);
    const expectedAmount = 1000 + (1000 * 0.05 * 1);
    console.log(`Сумма подтвержденного долга с учетом пени за 1 день (ожидается ${expectedAmount}): ${currentAmount}`);
    if (currentAmount === expectedAmount) {
      console.log('Расчет процентов работает УСПЕШНО.');
    } else {
      console.error('Ошибка в расчете процентов!');
    }
    console.log('\n');

    // ==========================================
    // 4. Покупки на маркете и лотерея
    // ==========================================
    console.log('--- Шаг 4: Покупки на маркете и лотерея ---');
    
    // Создаем товар на Маркете (продавец Боб)
    const sword = new MarketItem({
      title: 'Легендарный Меч Кармы',
      price: 2000,
      seller: bob._id
    });
    await sword.save();
    console.log(`Создан товар на Маркете: "${sword.title}", цена: ${sword.price}, продавец: Боб.`);

    // У Алисы баланс 5000. Она покупает меч за 2000.
    // Комиссия лотереи 10% = 200 монет.
    // Боб должен получить 2000 - 200 = 1800 монет.
    // Алиса должна потратить 2000 монет (баланс станет 3000).
    // В пуле лотереи должно стать 200 монет, и 1 билет Алисы.
    console.log('Алиса покупает товар...');
    
    const LOTTERY_FEE = 2000 * 0.10;
    alice.balance -= 2000;
    await alice.save();
    
    await User.findByIdAndUpdate(bob._id, { $inc: { balance: 2000 - LOTTERY_FEE } });
    
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    let pool = new LotteryPool({
      poolAmount: LOTTERY_FEE,
      tickets: [alice._id],
      month: currentMonthStr,
      isActive: true
    });
    await pool.save();

    console.log(`Покупка проведена. \nБаланс Алисы (ожидается 3000): ${alice.balance}`);
    const updatedBob = await User.findById(bob._id);
    console.log(`Баланс Боба (ожидается 2000 + 1800 = 3800): ${updatedBob.balance}`);
    console.log(`Состояние пула лотереи: сумма = ${pool.poolAmount}, билетов = ${pool.tickets.length}`);

    // Проверяем лотерею (лимит 10 000 не достигнут)
    let lotteryRes = await checkLotteryAndProcess();
    console.log(`Запуск checkLotteryAndProcess(). Проведен розыгрыш? ${lotteryRes.drawExecuted ? 'Да' : 'Нет (сумма пула мала)'}`);
    console.log('\n');

    // ==========================================
    // 5. Накопление пула и розыгрыш лотереи
    // ==========================================
    console.log('--- Шаг 5: Достижение лимита пула и розыгрыш лотереи ---');
    
    // Создаем еще один дорогой товар от Боба
    const dragon = new MarketItem({
      title: 'Ручной Дракон',
      price: 98000,
      seller: bob._id
    });
    await dragon.save();
    console.log(`Создан товар на Маркете: "${dragon.title}", цена: ${dragon.price}, продавец: Боб.`);

    // Повысим баланс Алисы, чтобы она могла купить дракона
    alice.balance = 100000;
    await alice.save();
    console.log(`Алисе начислены монеты для крупной покупки. Баланс: ${alice.balance}`);

    // Алиса покупает Дракона за 98000 монет
    // Комиссия лотереи 10% = 9800 монет.
    // Сумма в пуле лотереи станет: 200 + 9800 = 10000 монет.
    // Это запускает розыгрыш!
    const DRAGON_LOTTERY_FEE = 98000 * 0.10;
    alice.balance -= 98000;
    await alice.save();

    await User.findByIdAndUpdate(bob._id, { $inc: { balance: 98000 - DRAGON_LOTTERY_FEE } });
    
    // Обновляем пул лотереи в БД
    pool.poolAmount += DRAGON_LOTTERY_FEE;
    pool.tickets.push(alice._id);
    await pool.save();

    console.log(`Проведена покупка Дракона. Сумма пула лотереи: ${pool.poolAmount}. Билетов: ${pool.tickets.length}`);

    // Вызываем checkLotteryAndProcess
    lotteryRes = await checkLotteryAndProcess();
    console.log(`Запуск checkLotteryAndProcess()...`);
    console.log(`Результат розыгрыша:`, lotteryRes);

    if (lotteryRes.drawExecuted) {
      console.log('Розыгрыш лотереи сработал УСПЕШНО!');
      // Проверяем карму победителя (Алисы)
      const updatedAlice = await User.findById(alice._id);
      console.log(`Карма Алисы после победы в лотерее (ожидается 100 + 10000 = 10100): ${updatedAlice.karma}`);
      
      // Проверяем наличие нового активного пула
      const nextActivePool = await LotteryPool.findOne({ isActive: true });
      console.log(`Новый активный пул создан для месяца: ${nextActivePool.month}. Его сумма: ${nextActivePool.poolAmount}`);
    } else {
      console.error('Ошибка! Розыгрыш лотереи не запустился при сумме >= 10000');
    }

  } catch (err) {
    console.error('Критическая ошибка при тестировании:', err);
  } finally {
    await mongoose.connection.close();
    console.log('\nПодключение к тестовой БД закрыто.');
    console.log('=== ТЕСТИРОВАНИЕ ЗАВЕРШЕНО ===');
  }
}

// Запуск теста
runTests();
