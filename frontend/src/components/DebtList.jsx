import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Landmark, ArrowUpRight, ArrowDownLeft, Calendar, ShieldAlert,
  Upload, Heart, RefreshCw, Eye, ChevronDown, ChevronUp, CheckCircle2, X
} from 'lucide-react';

export default function DebtList({
  debts, currentUser,
  onPay,          // legacy (не используется)
  onConfirm,      // должник подтверждает
  onDecline,      // должник отклоняет
  onWitness,      // свидетель подтверждает/отклоняет: (id, 'approve'|'reject')
  onPayProof,     // (id, FormData) → загрузка пруфа + сумма
  onForgive,      // кредитор прощает: (id)
  onTransfer,     // должник передаёт: (id, newDebtorId)
  friends = []
}) {
  const transfers = debts.filter(d => d.type === 'transfer_sent' || d.type === 'transfer_received');
  const iOwe      = debts.filter(d => (d.debtor?._id === currentUser?._id || d.debtor === currentUser?._id) && (!d.type || d.type === 'debt'));
  const owesMe    = debts.filter(d => (d.creditor?._id === currentUser?._id || d.creditor === currentUser?._id) && (!d.type || d.type === 'debt'));
  const witnessing = debts.filter(d => {
    const wId = d.witness?._id || d.witness;
    return wId && wId.toString() === currentUser?._id && (!d.type || d.type === 'debt');
  });

  const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: '2-digit' });

  // ── Карточка долга ─────────────────────────────────────────────────────────
  const DebtCard = ({ debt, direction }) => {
    if (debt.type === 'transfer_sent' || debt.type === 'transfer_received') {
      const isSent = debt.type === 'transfer_sent';
      const otherUser = isSent ? debt.creditor : debt.debtor;
      const displayAmount = isSent ? `-${debt.amount}` : `+${debt.amount}`;
      const amountColor = isSent ? 'text-red-400' : 'text-emerald-400';
      const arrowIcon = isSent ? <ArrowUpRight className="w-5 h-5 text-red-400" /> : <ArrowDownLeft className="w-5 h-5 text-emerald-400" />;
      const iconBg = isSent ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400';

      return (
        <div className="rounded-xl border border-gray-800 bg-[#060b0b]/85 p-4 flex items-center justify-between gap-3 transition hover:border-gray-700">
          <div className="flex items-start gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
              {arrowIcon}
            </div>
            <div>
              <div className="text-xs font-bold text-gray-200">
                {isSent ? 'Перевод другу' : 'Получен перевод'}
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">
                {isSent ? `Получатель: ${otherUser?.name || 'Пользователь'} (@${otherUser?.username || ''})` : `Отправитель: ${otherUser?.name || 'Пользователь'} (@${otherUser?.username || ''})`}
              </div>
              <div className="text-[9px] text-gray-500 mt-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> {formatDate(debt.createdAt)}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-sm font-black ${amountColor}`}>
              {displayAmount} ✧
            </div>
            <div className="text-[9px] text-gray-500 mt-0.5">
              {isSent ? 'Комиссия учтена' : 'Зачислено на баланс'}
            </div>
          </div>
        </div>
      );
    }

    const [expanded,       setExpanded]       = useState(false);
    const [partialAmt,     setPartialAmt]     = useState('');
    const [proofFile,      setProofFile]      = useState(null);
    const [transferTarget, setTransferTarget] = useState('');
    const [busy,           setBusy]           = useState(false);
    const [localError,     setLocalError]     = useState('');
    const fileRef = useRef();

    const isOverdue  = debt.isOverdue;
    const isOwe      = direction === 'i-owe';
    const isCreditor = direction === 'owes-me';
    const otherUser  = isOwe ? (debt.creditor) : (debt.debtor);

    const currentAmount  = debt.amount || debt.originalAmount;
    const paidSoFar      = debt.paidAmount || 0;
    const remaining      = Math.max(0, currentAmount - paidSoFar);
    const paidPct        = currentAmount > 0 ? Math.min(100, Math.round((paidSoFar / currentAmount) * 100)) : 0;

    // Загружаем платёж (с пруфом или без пруфа)
    const handlePayProof = async () => {
      setLocalError('');
      setBusy(true);
      try {
        const fd = new FormData();
        if (proofFile) fd.append('proof', proofFile);
        if (partialAmt && Number(partialAmt) > 0) fd.append('partialAmount', partialAmt);
        await onPayProof(debt._id, fd);
        setProofFile(null); setPartialAmt('');
      } catch (err) {
        setLocalError(err.message || 'Ошибка проведения платежа');
      } finally {
        setBusy(false);
      }
    };

    const handleForgive = async () => {
      if (!window.confirm(`Простить долг ${otherUser?.name || ''} на ${currentAmount} ₸? Отменить нельзя.`)) return;
      setBusy(true);
      try { await onForgive(debt._id); }
      catch (err) { setLocalError(err.message); }
      finally { setBusy(false); }
    };

    const handleTransfer = async () => {
      if (!transferTarget) return setLocalError('Выберите нового должника');
      setBusy(true);
      try { await onTransfer(debt._id, transferTarget); setTransferTarget(''); }
      catch (err) { setLocalError(err.message); }
      finally { setBusy(false); }
    };

    const statusBadge = () => {
      if (debt.status === 'pending_witness') return <span className="badge-amber animate-pulse">⚖️ Ждёт свидетеля</span>;
      if (debt.status === 'pending_approval') return <span className="badge-yellow animate-pulse">⏳ Ждёт подтверждения</span>;
      if (debt.status === 'active' && isOverdue) return <span className="badge-red">🔥 Просрочен</span>;
      if (debt.status === 'active') return <span className="badge-green">✅ Активен</span>;
      if (debt.status === 'partially_paid' && isOverdue) return <span className="badge-red">🔥 Просрочен (Частично)</span>;
      if (debt.status === 'partially_paid') return <span className="badge-blue">⏳ Частично погашен</span>;
      return null;
    };

    return (
      <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
        className={`rounded-xl border transition-all ${isOverdue ? 'bg-red-500/5 border-red-500/35' : 'bg-[#060b0b]/80 border-gray-800 hover:border-gray-700'}`}>

        {/* Основной ряд */}
        <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isOwe ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
              {isOwe ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
            </div>
            <div>
              <div className="font-bold text-sm text-gray-200 flex items-center gap-1.5 flex-wrap">
                {debt.description}
                {debt.promisedReturnAmount && (
                  <span className="text-[9px] bg-purple-500/15 text-purple-400 border border-purple-500/30 px-1.5 py-0.5 rounded-full font-bold">
                    🤝 Оффер (+{debt.promisedReturnAmount - debt.originalAmount} ₸)
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {isOwe ? 'Кредитор: ' : 'Должник: '}
                <span className="font-medium text-gray-300">{otherUser?.name || '?'}</span>
                {debt.witness && (
                  <span className="ml-2 text-[10px] text-purple-400">
                    | Свидетель: {debt.witness?.name || '?'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-1.5 flex-wrap">
                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {formatDate(debt.dueDate)}</span>
                {statusBadge()}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 border-t border-gray-800/50 md:border-0 pt-3 md:pt-0">
            {/* Суммы */}
            <div className="text-right">
              <div className={`text-base font-black ${isOwe ? 'text-red-400' : 'text-emerald-400'}`}>
                {isOwe ? '-' : '+'}{currentAmount} ₸
              </div>
              {debt.promisedReturnAmount && (
                <div className="text-[10px] text-gray-550">
                  Займ: {debt.originalAmount} ₸
                </div>
              )}
              {debt.penaltyAccrued > 0 && (
                <div className="text-[10px] text-red-400 font-semibold">+{debt.penaltyAccrued} ₸ пеня</div>
              )}
              {paidSoFar > 0 && (
                <div className="text-[10px] text-emerald-400">Оплачено: {paidSoFar} ₸</div>
              )}
            </div>

            {/* Кнопка раскрытия */}
            {debt.status === 'active' && (
              <button onClick={() => setExpanded(!expanded)}
                className="text-gray-500 hover:text-gray-300 transition">
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>

        {/* Прогресс частичной оплаты */}
        {paidSoFar > 0 && (
          <div className="px-4 pb-3">
            <div className="flex justify-between text-[10px] text-gray-500 mb-1">
              <span>Оплачено: {paidPct}%</span>
              <span>Остаток: {remaining} ₸</span>
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all" style={{ width: `${paidPct}%` }} />
            </div>
          </div>
        )}

        {/* Подтверждение свидетелем */}
        {debt.status === 'pending_witness' && debt.witness?._id === currentUser?._id && (
          <div className="px-4 pb-4 flex gap-2 border-t border-gray-800/50 pt-3">
            <span className="text-xs text-purple-400 mr-2">Вы свидетель — подтвердите долг:</span>
            <button onClick={() => onWitness(debt._id, 'approve')} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] py-1.5 px-3 rounded-xl transition">
              ✅ Подтвердить
            </button>
            <button onClick={() => onWitness(debt._id, 'reject')} className="bg-red-600/20 border border-red-500/30 text-red-400 font-bold text-[10px] py-1.5 px-3 rounded-xl hover:bg-red-600/30 transition">
              ❌ Отклонить
            </button>
          </div>
        )}

        {/* Подтверждение должником */}
        {debt.status === 'pending_approval' && (
          <div className="px-4 pb-4 border-t border-gray-800/50 pt-3">
            {(debt.debtor?._id === currentUser?._id || debt.debtor === currentUser?._id) && debt.createdBy !== currentUser._id ? (
              <div className="flex gap-2">
                <button onClick={() => onConfirm(debt._id)} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] py-1.5 px-3 rounded-xl transition">
                  ✅ Подтвердить долг
                </button>
                <button onClick={() => onDecline(debt._id)} className="bg-red-600/20 border border-red-500/30 text-red-400 font-bold text-[10px] py-1.5 px-3 rounded-xl hover:bg-red-600/30 transition">
                  ❌ Оспорить
                </button>
              </div>
            ) : (
              <span className="text-[10px] text-yellow-400">⏳ Ожидает подтверждения другой стороной...</span>
            )}
          </div>
        )}

        {/* Расширенная панель для активного долга */}
        <AnimatePresence>
          {expanded && debt.status === 'active' && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-gray-800/50">
              <div className="p-4 space-y-3">
                {localError && (
                  <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-2 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0" />{localError}
                    <button onClick={() => setLocalError('')} className="ml-auto"><X className="w-3 h-3" /></button>
                  </div>
                )}

                {/* Оплата долга (для должника) */}
                {isOwe && (
                  <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-3">
                    <div className="text-[10px] text-purple-400 font-bold uppercase tracking-wider mb-2 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Внести платёж / Закрыть долг
                    </div>
                    <div className="flex flex-col gap-2">
                      <input type="number" placeholder={`Частичная сумма (макс. ${remaining} ₸, пусто = всё)`}
                        value={partialAmt} onChange={e => setPartialAmt(e.target.value)} min="1" max={remaining}
                        className="bg-[#060b0b] border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-purple-500/60"
                      />
                      <div className="flex items-center gap-2">
                        <input ref={fileRef} type="file" accept="image/*" onChange={e => setProofFile(e.target.files[0])} className="hidden" id={`proof-${debt._id}`} />
                        <label htmlFor={`proof-${debt._id}`}
                          className="cursor-pointer flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-[10px] font-bold px-3 py-2 rounded-lg transition">
                          <Upload className="w-3 h-3 text-purple-400" />
                          {proofFile ? proofFile.name : 'Чек (необязательно)'}
                        </label>
                        <button onClick={handlePayProof} disabled={busy}
                          className="flex-1 bg-gradient-to-r from-emerald-600 to-cyan-600 text-white font-bold text-[10px] py-2 px-3 rounded-lg transition disabled:opacity-40 flex items-center justify-center gap-1">
                          {busy ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                          {partialAmt ? `Внести ${partialAmt} ₸` : 'Оплатить / Отметить оплаченным'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Передача долга (должник) */}
                {isOwe && friends.length > 0 && (
                  <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
                    <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wider mb-2 flex items-center gap-1">
                      <RefreshCw className="w-3.5 h-3.5" /> Передать долг другому
                    </div>
                    <div className="flex gap-2">
                      <select value={transferTarget} onChange={e => setTransferTarget(e.target.value)}
                        className="flex-1 bg-[#060b0b] border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-amber-500/60">
                        <option value="">-- Выберите нового должника --</option>
                        {friends.filter(f => f._id !== currentUser?._id).map(f => (
                          <option key={f._id} value={f._id}>{f.name}</option>
                        ))}
                      </select>
                      <button onClick={handleTransfer} disabled={busy || !transferTarget}
                        className="bg-amber-600/80 hover:bg-amber-600 text-white font-bold text-[10px] py-2 px-3 rounded-lg transition disabled:opacity-40">
                        Передать
                      </button>
                    </div>
                  </div>
                )}

                {/* Подтверждение получения долга (кредитор) */}
                {isCreditor && (
                  <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
                    <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-2 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Подтвердить получение (Оплачено)
                    </div>
                    <p className="text-[10px] text-gray-400 mb-2">
                      Должник вернул вам деньги наличными или переводом? Нажмите здесь для закрытия долга.
                    </p>
                    <div className="flex flex-col gap-2">
                      <input type="number" placeholder={`Сумма получения (макс. ${remaining} ₸, пусто = всё)`}
                        value={partialAmt} onChange={e => setPartialAmt(e.target.value)} min="1" max={remaining}
                        className="bg-[#060b0b] border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-emerald-500/60"
                      />
                      <div className="flex items-center gap-2">
                        <input ref={fileRef} type="file" accept="image/*" onChange={e => setProofFile(e.target.files[0])} className="hidden" id={`creditor-proof-${debt._id}`} />
                        <label htmlFor={`creditor-proof-${debt._id}`}
                          className="cursor-pointer flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-[10px] font-bold px-3 py-2 rounded-lg transition">
                          <Upload className="w-3 h-3 text-emerald-400" />
                          {proofFile ? proofFile.name : 'Чек (необязательно)'}
                        </label>
                        <button onClick={handlePayProof} disabled={busy}
                          className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-[10px] py-2 px-3 rounded-lg transition disabled:opacity-40 flex items-center justify-center gap-1">
                          {busy ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                          {partialAmt ? `Подтвердить ${partialAmt} ₸` : `Подтвердить получение ${remaining} ₸`}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Прощение долга (кредитор) */}
                {isCreditor && (
                  <div className="bg-pink-500/5 border border-pink-500/20 rounded-xl p-3">
                    <div className="text-[10px] text-pink-400 font-bold uppercase tracking-wider mb-2 flex items-center gap-1">
                      <Heart className="w-3.5 h-3.5" /> Простить долг
                    </div>
                    <p className="text-[10px] text-gray-500 mb-2">
                      Вы можете безвозмездно простить этот долг и получить бонус к ELO за благородство.
                    </p>
                    <button onClick={handleForgive} disabled={busy}
                      className="bg-pink-600/80 hover:bg-pink-600 text-white font-bold text-[10px] py-2 px-4 rounded-lg transition disabled:opacity-40 flex items-center gap-1.5">
                      <Heart className="w-3 h-3" /> Простить {currentAmount} ₸
                    </button>
                  </div>
                )}

                {/* Просмотр пруфов */}
                {debt.payments?.length > 0 && (
                  <div>
                    <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Eye className="w-3 h-3" /> История платежей
                    </div>
                    <div className="space-y-1.5">
                      {debt.payments.map((p, i) => (
                        <div key={i} className="flex items-center gap-2 text-[10px] text-gray-400 bg-gray-900/40 rounded-lg px-3 py-1.5">
                          <span className="text-emerald-400 font-bold">+{p.amount} ₸</span>
                          <span>{new Date(p.paidAt).toLocaleDateString('ru-RU')}</span>
                          {p.proofImage && (
                            <a href={`${import.meta.env.VITE_API_URL || ''}${p.proofImage}`} target="_blank" rel="noreferrer"
                              className="ml-auto text-purple-400 hover:underline flex items-center gap-0.5">
                              <Eye className="w-3 h-3" /> Пруф
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  const Section = ({ title, items, direction, colorClass }) => (
    <div className="bg-[#0d1715] border border-gray-800 rounded-2xl p-5 shadow-xl shadow-black/40">
      <h2 className={`text-lg font-black flex items-center gap-2 mb-4 text-transparent bg-clip-text bg-gradient-to-r ${colorClass}`}>
        <Landmark className="w-5 h-5" style={{ color: 'currentColor' }} />
        {title} ({items.length})
      </h2>
      {items.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">Нет долгов в этой категории</div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>{items.map(d => <DebtCard key={d._id} debt={d} direction={direction} />)}</AnimatePresence>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Свидетель */}
      {witnessing.length > 0 && (
        <div className="bg-purple-950/30 border border-purple-500/30 rounded-2xl p-5 shadow-xl">
          <h2 className="text-lg font-black flex items-center gap-2 mb-4 text-purple-300">
            <Eye className="w-5 h-5" /> Требуют вашего свидетельства ({witnessing.length})
          </h2>
          <div className="space-y-3">
            <AnimatePresence>{witnessing.map(d => <DebtCard key={d._id} debt={d} direction="witness" />)}</AnimatePresence>
          </div>
        </div>
      )}

      <Section title="Я должен" items={iOwe} direction="i-owe" colorClass="from-red-400 to-purple-400" />
      <Section title="Мне должны" items={owesMe} direction="owes-me" colorClass="from-emerald-400 to-cyan-400" />

      {transfers.length > 0 && (
        <div className="bg-[#0d1715] border border-gray-800 rounded-2xl p-5 shadow-xl shadow-black/40">
          <h2 className="text-lg font-black flex items-center gap-2 mb-4 text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">
            <RefreshCw className="w-5 h-5 text-amber-400" />
            История переводов ({transfers.length})
          </h2>
          <div className="space-y-3">
            <AnimatePresence>
              {transfers.map(d => <DebtCard key={d._id} debt={d} direction={d.type === 'transfer_sent' ? 'i-owe' : 'owes-me'} />)}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}

// ── mini CSS helpers (inline badges) ─────────────────────────────────────────
const style = document.createElement('style');
style.textContent = `
  .badge-amber  { display:inline-flex; align-items:center; padding: 2px 8px; border-radius: 9999px; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; background:rgba(251,191,36,0.12); color:rgb(251,191,36); border: 1px solid rgba(251,191,36,0.3); }
  .badge-yellow { display:inline-flex; align-items:center; padding: 2px 8px; border-radius: 9999px; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; background:rgba(234,179,8,0.1);  color:rgb(234,179,8);  border: 1px solid rgba(234,179,8,0.3);  }
  .badge-red    { display:inline-flex; align-items:center; padding: 2px 8px; border-radius: 9999px; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; background:rgba(239,68,68,0.12);  color:rgb(239,68,68);  border: 1px solid rgba(239,68,68,0.3);  }
  .badge-green  { display:inline-flex; align-items:center; padding: 2px 8px; border-radius: 9999px; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; background:rgba(34,197,94,0.1);   color:rgb(34,197,94);  border: 1px solid rgba(34,197,94,0.3);  }
  .badge-blue   { display:inline-flex; align-items:center; padding: 2px 8px; border-radius: 9999px; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; background:rgba(59,130,246,0.12);  color:rgb(96,165,250); border: 1px solid rgba(59,130,246,0.3);  }
`;
if (!document.getElementById('debt-badges-style')) { style.id = 'debt-badges-style'; document.head.appendChild(style); }
