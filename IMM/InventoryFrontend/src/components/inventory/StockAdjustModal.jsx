import { AlertTriangle, ArrowDown, ArrowUp, Edit2, Package2, Sparkles } from 'lucide-react';
import { summarizeInventoryAfterAddition } from '../../utils/inventoryBatches';

const modeStyles = {
  increase: {
    icon: ArrowUp,
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-700',
    accentText: 'text-emerald-700',
    button: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    title: 'Add stock',
    actionLabel: 'Add Stock',
    helperAction: 'add',
  },
  decrease: {
    icon: ArrowDown,
    iconBg: 'bg-rose-100',
    iconColor: 'text-rose-700',
    accentText: 'text-rose-700',
    button: 'bg-rose-600 hover:bg-rose-700 text-white',
    title: 'Deduct stock',
    actionLabel: 'Deduct Stock',
    helperAction: 'remove',
  },
};

export default function StockAdjustModal({
  isOpen,
  item,
  mode = 'increase',
  quantity = '',
  expirationDate = '',
  batchCost = '',
  deductionMode = 'manual',
  isBusy = false,
  onQuantityChange,
  onExpirationDateChange,
  onBatchCostChange,
  onDeductionModeChange,
  onCancel,
  onConfirm,
}) {
  if (!isOpen || !item) return null;

  const styles = modeStyles[mode] || modeStyles.increase;
  const Icon = styles.icon;
  const unitLabel = item.unit || 'unit';
  const supportsFractionalUnit = String(unitLabel).toLowerCase() !== 'pcs';
  const maxRemovable = Number(item.quantity || 0);
  const stockPreview = summarizeInventoryAfterAddition(item, quantity, expirationDate);
  const hasExpiredStock = stockPreview.hasExpiredStock;
  const autoExpiredQuantity = stockPreview.expiredQuantity;
  const showDeductionModePicker = mode === 'decrease' && hasExpiredStock && autoExpiredQuantity > 0;
  const isAutoDeductExpired = showDeductionModePicker && deductionMode === 'expired';
  const displayQuantity = isAutoDeductExpired
    ? formatModalQuantity(autoExpiredQuantity)
    : quantity;

  return (
    <>
      <button
        aria-label="Close"
        disabled={isBusy}
        onClick={isBusy ? undefined : onCancel}
        className="fixed inset-0 bg-[#1C100A]/40 backdrop-blur-[2px] z-[60] border-none p-0 cursor-default w-full disabled:opacity-100"
      />
      <div className="fixed inset-0 flex items-center justify-center z-[70] p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-[#EAE5E0] overflow-hidden">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onConfirm?.();
            }}
          >
            <div className="px-5 sm:px-7 pt-5 sm:pt-7 pb-4 sm:pb-5">
              <div className="flex items-center gap-3 mb-4">
                <div className={`${styles.iconBg} rounded-full p-3 shrink-0`}>
                  <Icon className={`w-5 h-5 ${styles.iconColor}`} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#1C100A]" style={{ fontFamily: "'Playfair Display', serif" }}>
                    {styles.title}
                  </h3>
                  <p className="text-xs text-[#8A7666]">Choose how many {unitLabel} to {mode === 'increase' ? 'add' : 'remove'}.</p>
                </div>
              </div>

              <div className="rounded-2xl border border-[#F0EDE8] bg-[#FBFAF8] p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-white border border-[#EAE5E0] p-2.5">
                    <Package2 className="w-4 h-4 text-[#3D261D]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#1C100A]">{item.name}</p>
                    <p className="text-xs text-[#8A7666] mt-1">
                      Current stock: <span className={`font-semibold ${styles.accentText}`}>{item.quantity} {unitLabel}</span>
                    </p>
                    <p className="text-xs text-[#8A7666]">
                      Reorder level: {item.threshold} {unitLabel}
                    </p>
                  </div>
                </div>
              </div>

              {hasExpiredStock && (
                <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl border border-rose-200 bg-white p-2.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      {mode === 'increase' ? (
                        <>
                          <p className="text-sm font-semibold text-rose-900">Expired stock alert</p>
                          <p className="mt-1 text-xs leading-5 text-rose-700">
                            This item has <span className="font-semibold">{stockPreview.expiredQuantity} {unitLabel}</span> expired. New stock will be added as a separate batch.
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-semibold text-rose-900">Expired items removed first</p>
                          <p className="mt-1 text-xs leading-5 text-rose-700">
                            This item has <span className="font-semibold">{stockPreview.expiredQuantity} {unitLabel}</span> expired. Deduction will remove expired stock first, then good stock.
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {showDeductionModePicker && (
                <div className="mt-5">
                  <p className="block text-xs font-bold uppercase tracking-widest text-[#A89080] mb-2">
                    Deduction Method
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <DeductionModeButton
                      active={deductionMode !== 'expired'}
                      disabled={isBusy}
                      icon={Edit2}
                      label="Manual"
                      detail="Type amount"
                      onClick={() => onDeductionModeChange?.('manual')}
                    />
                    <DeductionModeButton
                      active={deductionMode === 'expired'}
                      disabled={isBusy}
                      icon={Sparkles}
                      label="All expired"
                      detail={`${formatModalQuantity(autoExpiredQuantity)} ${unitLabel}`}
                      onClick={() => onDeductionModeChange?.('expired')}
                    />
                  </div>
                </div>
              )}

              <div className="mt-5">
                <label htmlFor="stock-adjust-quantity" className="block text-xs font-bold uppercase tracking-widest text-[#A89080] mb-2">
                  {unitLabel}
                </label>
                <input
                  id="stock-adjust-quantity"
                  type="number"
                  aria-label={`Quantity in ${unitLabel}`}
                  min={supportsFractionalUnit ? '0.001' : '1'}
                  step={supportsFractionalUnit ? '0.001' : '1'}
                  autoFocus
                  value={displayQuantity}
                  disabled={isAutoDeductExpired || isBusy}
                  onChange={(event) => onQuantityChange?.(event.target.value)}
                  className="w-full border border-[#E2DDD8] rounded-xl px-3.5 py-2.5 text-sm text-[#2C1810] bg-white transition focus:outline-none focus:border-[#6B3E26] focus:ring-2 focus:ring-[#6B3E26]/10 placeholder:text-[#C4B8B0] disabled:bg-[#F6F1EC] disabled:text-[#7A6355] disabled:cursor-not-allowed"
                  placeholder={`Enter number of ${unitLabel}`}
                />
                <p className="mt-2 text-xs text-[#8A7666]">
                  {isAutoDeductExpired ? 'All expired stock will be deducted.' : `Enter the amount in ${unitLabel} to ${styles.helperAction}.`}
                  {mode === 'decrease' ? ` Maximum removable: ${maxRemovable} ${unitLabel}.` : ''}
                </p>
                <p className="mt-1 text-[10px] text-[#9E8A7A]">
                  {supportsFractionalUnit
                    ? 'Decimal values are allowed for this unit.'
                    : 'Whole numbers only for pieces.'}
                </p>
              </div>

              {mode === 'increase' && item?.cat !== 'Equipment' && (
                <div className="mt-5">
                  <label htmlFor="stock-adjust-expiration" className="block text-xs font-bold uppercase tracking-widest text-[#A89080] mb-2">
                    Batch Expiration Date
                  </label>
                  <input
                    id="stock-adjust-expiration"
                    type="date"
                    value={expirationDate}
                    onChange={(event) => onExpirationDateChange?.(event.target.value)}
                    className="w-full border border-[#E2DDD8] rounded-xl px-3.5 py-2.5 text-sm text-[#2C1810] bg-white transition focus:outline-none focus:border-[#6B3E26] focus:ring-2 focus:ring-[#6B3E26]/10"
                  />
                  <p className="mt-2 text-xs text-[#8A7666]">
                    Optional for non-expiring items. If you set this, the new stock will be saved as its own batch so expiry tracking stays clear.
                  </p>
                </div>
              )}

              {mode === 'increase' && (
                <div className="mt-5">
                  <label htmlFor="stock-adjust-batch-cost" className="block text-xs font-bold uppercase tracking-widest text-[#A89080] mb-2">
                    Total Batch Cost
                  </label>
                  <input
                    id="stock-adjust-batch-cost"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={batchCost}
                    onChange={(event) => onBatchCostChange?.(event.target.value)}
                    className="w-full border border-[#E2DDD8] rounded-xl px-3.5 py-2.5 text-sm text-[#2C1810] bg-white transition focus:outline-none focus:border-[#6B3E26] focus:ring-2 focus:ring-[#6B3E26]/10 placeholder:text-[#C4B8B0]"
                    placeholder="Enter batch cost (₱)"
                  />
                  <p className="mt-2 text-xs text-[#8A7666]">
                    Optional. Cost of this specific batch. If not set, will use the item's default cost calculation.
                  </p>
                </div>
              )}
            </div>

            <div className="px-5 sm:px-7 py-4 sm:py-5 border-t border-[#F0EDE8] flex flex-col sm:flex-row gap-3 bg-[#FDFCFB]">
              <button
                type="button"
                onClick={onCancel}
                disabled={isBusy}
                className="flex-1 py-2.5 rounded-xl bg-white text-[#6B5744] font-semibold text-sm border border-[#E2DDD8] hover:bg-[#FAF6F2] transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isBusy}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed ${styles.button}`}
              >
                {isBusy ? 'Processing...' : styles.actionLabel}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

function formatModalQuantity(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return String(value ?? '');
  return Number.isInteger(numericValue)
    ? String(numericValue)
    : numericValue.toFixed(3).replace(/\.?0+$/, '');
}

function DeductionModeButton({ active, disabled, icon, label, detail, onClick }) {
  const ModeIcon = icon;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-[64px] items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
        active
          ? 'border-[#6B3E26] bg-[#F7EFE8] text-[#3D261D] shadow-sm'
          : 'border-[#E2DDD8] bg-white text-[#7A6355] hover:border-[#CDBCAA] hover:bg-[#FBFAF8]'
      }`}
      aria-pressed={active}
    >
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-white text-[#6B3E26]' : 'bg-[#F6F1EC] text-[#9E8A7A]'}`}>
        <ModeIcon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold leading-tight">{label}</span>
        <span className="mt-1 block truncate text-[11px] font-medium opacity-75">{detail}</span>
      </span>
    </button>
  );
}

function PreviewPill({ label, value, tone = 'slate' }) {
  const toneStyles = {
    rose: 'border-rose-200 bg-white text-rose-800',
    slate: 'border-slate-200 bg-white text-slate-700',
    emerald: 'border-emerald-200 bg-white text-emerald-700',
    amber: 'border-amber-200 bg-white text-amber-700',
  };

  return (
    <div className={`rounded-xl border px-3 py-2 ${toneStyles[tone] || toneStyles.slate}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-70">{label}</p>
      <p className="mt-1 text-xs font-semibold">{value}</p>
    </div>
  );
}
