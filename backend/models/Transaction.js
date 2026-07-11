const mongoose = require('mongoose');

// Запись частичного платежа
const PaymentSchema = new mongoose.Schema({
  amount:     { type: Number, required: true, min: 1 },
  paidAt:     { type: Date,   default: Date.now },
  proofImage: { type: String, default: null },   // путь к файлу пруфа
  paidBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { _id: true });

const TransactionSchema = new mongoose.Schema({
  creditor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  debtor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  originalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  promisedReturnAmount: {
    type: Number,
    default: null
  },
  // Реально выплаченная сумма (частичные платежи)
  paidAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  dueDate: {
    type: Date,
    required: true
  },
  // Фактическая дата возникновения долга (ретроактивность)
  incurredAt: {
    type: Date,
    default: null // если null — используется createdAt
  },
  penaltyRate: {
    type: Number,
    default: 0.01 // 1% в день при просрочке
  },
  // ── Свидетель (Third-party verification) ────────────────────────────────────
  witness: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  witnessStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  // ── Статус долга ─────────────────────────────────────────────────────────────
  status: {
    type: String,
    enum: [
      'pending_witness',   // ждёт подтверждения свидетелем
      'pending_approval',  // ждёт подтверждения должником (legacy)
      'active',            // активный
      'partially_paid',    // частично погашен
      'paid',              // полностью оплачен
      'declined',          // отклонён
      'forgiven',          // прощён кредитором
      'transferred'        // передан другому должнику
    ],
    default: 'pending_witness'
  },
  // ── Пруф оплаты (финальный, для полной оплаты) ───────────────────────────────
  proofImage: {
    type: String,
    default: null
  },
  // ── История частичных платежей ───────────────────────────────────────────────
  payments: [PaymentSchema],
  // ── Прощение долга ───────────────────────────────────────────────────────────
  forgiven:        { type: Boolean, default: false },
  forgivenAt:      { type: Date,    default: null  },
  // ── Передача и оплата за друга ───────────────────────────────────────────────
  transferredTo:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  paidByThirdParty:{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  // ── Служебные поля ───────────────────────────────────────────────────────────
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  overdueReminderSent: { type: Boolean, default: false },
  resolvedAt:          { type: Date,    default: null  }
}, {
  timestamps: true
});

// Виртуальное поле: остаток к оплате
TransactionSchema.virtual('remaining').get(function () {
  return Math.max(0, this.amount - this.paidAmount);
});

module.exports = mongoose.model('Transaction', TransactionSchema);
