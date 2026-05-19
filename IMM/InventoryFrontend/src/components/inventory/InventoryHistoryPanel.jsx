import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Clock3,
  Layers3,
  PackageSearch,
  RefreshCcw,
  Search,
  X,
} from 'lucide-react';
import Dropdown from '../Dropdown';

const formatTimestamp = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';

  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

const formatQuantity = (value, unit = '') => {
  const amount = Number(value || 0);
  const absAmount = Math.abs(amount);
  return `${Number.isInteger(absAmount) ? absAmount : absAmount.toFixed(2)}${unit ? ` ${unit}` : ''}`.trim();
};

const formatSignedQuantity = (value, unit = '') => {
  const amount = Number(value || 0);
  const prefix = amount > 0 ? '+' : '';
  return `${prefix}${Number.isInteger(amount) ? amount : amount.toFixed(2)}${unit ? ` ${unit}` : ''}`.trim();
};

const formatUser = (value = '') => {
  if (!value) return 'System';
  return value.startsWith('admin:') ? value.replace('admin:', '') : value;
};

const formatExpiration = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const getBatchSummary = (entry) => {
  if (entry.direction === 'EXPIRED') {
    return entry.expirationDate
      ? `Item expired on ${formatExpiration(entry.expirationDate)}`
      : 'Item marked as expired';
  }

  if (entry.direction === 'IN') {
    const batchQuantity = Number(entry.addedBatch?.quantity || entry.absoluteAdjustment || 0);
    const batchExpiration = formatExpiration(entry.addedBatch?.expirationDate || entry.expirationDate);
    return batchExpiration
      ? `Added batch ${formatQuantity(batchQuantity, entry.unit)} - Expires ${batchExpiration}`
      : `Added batch ${formatQuantity(batchQuantity, entry.unit)}`;
  }

  if (entry.consumedBatches?.length > 0) {
    const totalConsumed = entry.consumedBatches.reduce(
      (sum, batch) => sum + Number(batch.quantity || 0),
      0
    );
    const batchLabel = `${entry.consumedBatches.length} batch${entry.consumedBatches.length === 1 ? '' : 'es'}`;
    return `Deducted ${formatQuantity(totalConsumed, entry.unit)} from ${batchLabel}`;
  }

  return 'Stock movement recorded from the available batches';
};

const hasNumericValue = (value) =>
  value !== undefined && value !== null && Number.isFinite(Number(value));

const getConsumedBatchDetails = (entry) => {
  if (!entry || entry.direction !== 'OUT' || !Array.isArray(entry.consumedBatches)) return [];

  return entry.consumedBatches.map((batch, index) => {
    const previousQuantity = hasNumericValue(batch.previousQuantity)
      ? Number(batch.previousQuantity)
      : null;
    const remainingQuantity = hasNumericValue(batch.remainingQuantity)
      ? Number(batch.remainingQuantity)
      : null;
    const quantity = Number(batch.quantity || 0);
    const quantityTrail =
      previousQuantity !== null && remainingQuantity !== null
        ? `${formatQuantity(previousQuantity, entry.unit)} -> ${formatQuantity(remainingQuantity, entry.unit)}`
        : '';
    const meta = [
      batch.expirationDate ? `Expires ${formatExpiration(batch.expirationDate)}` : '',
      batch.receivedAt ? `Received ${formatExpiration(batch.receivedAt)}` : '',
      batch.isExpired ? 'Expired batch' : '',
    ].filter(Boolean);

    return {
      key: batch.id || `${entry.id}-batch-${index}`,
      batchLabel: `Batch ${index + 1}`,
      deductedLabel: `Deducted ${formatQuantity(quantity, entry.unit)}`,
      quantityTrail,
      meta,
    };
  });
};

const ConsumedBatchDetails = ({ batchDetails }) => {
  if (batchDetails.length === 0) return null;

  return (
    <div className="space-y-2">
      {batchDetails.map((batch) => (
        <div key={batch.key} className="rounded-xl border border-[#EEE5DB] bg-[#FCFAF8] px-3.5 py-3">
          <p className="text-sm font-semibold text-[#2C1810]">{batch.batchLabel}</p>
          <p className="mt-1 text-xs text-rose-700 font-semibold">
            {batch.deductedLabel}
            {batch.quantityTrail ? ` - ${batch.quantityTrail}` : ''}
          </p>
          {batch.meta.length > 0 ? (
            <p className="mt-1 text-[11px] text-[#9E8A7A]">{batch.meta.join(' - ')}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
};

const BatchDetailsButton = ({ entry, onClick }) => {
  const batchCount = getConsumedBatchDetails(entry).length;
  if (batchCount === 0) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 inline-flex items-center text-xs font-semibold text-[#6B3E26] hover:text-[#2E1C15] underline underline-offset-2"
    >
      View batches
    </button>
  );
};

const summaryCardBase =
  'rounded-2xl border px-4 py-4 sm:px-5 sm:py-5 bg-[#FCFAF8]';

export default function InventoryHistoryPanel({
  entries = [],
  loadedCount = 0,
  isLoading = false,
  isLoadingMore = false,
  error = '',
  searchTerm = '',
  onSearchTermChange,
  movementFilter = 'All',
  onMovementFilterChange,
  rangeFilter = '30',
  onRangeFilterChange,
  onRefresh,
  onLoadMore,
  hasMore = false,
}) {
  const [batchModalEntry, setBatchModalEntry] = useState(null);

  const summary = useMemo(() => {
    return entries.reduce(
      (acc, entry) => {
        acc.net += Number(entry.adjustment || 0);
        if (entry.direction === 'IN') acc.restocks += 1;
        if (entry.direction === 'OUT') acc.consumptions += 1;
        if (entry.direction === 'EXPIRED') acc.expired += 1;
        return acc;
      },
      {
        restocks: 0,
        consumptions: 0,
        expired: 0,
        net: 0,
      }
    );
  }, [entries]);

  const rangeOptions = [
    { value: '7', label: 'Last 7 Days' },
    { value: '30', label: 'Last 30 Days' },
    { value: '90', label: 'Last 90 Days' },
    { value: 'all', label: 'All Time' },
  ];

  const movementOptions = [
    { value: 'All', label: 'All Movements' },
    { value: 'IN', label: 'Restocks Only' },
    { value: 'OUT', label: 'Consumption Only' },
    { value: 'EXPIRED', label: 'Expired Only' },
  ];

  const batchModalDetails = useMemo(
    () => getConsumedBatchDetails(batchModalEntry),
    [batchModalEntry]
  );

  return (
    <>
    {batchModalEntry ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-6 backdrop-blur-sm">
        <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-xl border border-[#EAE5E0]">
          <div className="flex items-start justify-between gap-4 border-b border-[#F0EDE8] px-5 py-4">
            <div>
              <h3 className="text-sm font-bold text-[#1C100A]">Consumed Batches</h3>
              <p className="mt-1 text-xs text-[#9E8A7A]">
                {batchModalEntry.itemName} - {formatTimestamp(batchModalEntry.timestamp)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setBatchModalEntry(null)}
              className="rounded-full p-1.5 text-[#9E8A7A] hover:bg-[#F8F4EF] hover:text-[#2C1810] transition-colors"
              aria-label="Close batch details"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
            <p className="mb-3 text-sm text-[#4B3429]">{getBatchSummary(batchModalEntry)}</p>
            <ConsumedBatchDetails batchDetails={batchModalDetails} />
          </div>
        </div>
      </div>
    ) : null}

    <div className="bg-white rounded-2xl border border-[#EAE5E0] shadow-sm overflow-hidden">
      <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-[#F0EDE8] bg-[#FDFCFB] flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-sm font-bold text-[#1C100A]">Inventory History</h3>
          <p className="text-xs text-[#9E8A7A] mt-1">
            Complete log of stock movement and expired-item events, including batch and expiry details.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading || isLoadingMore}
          className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl border border-[#E2DDD8] bg-white text-sm font-semibold text-[#3D261D] hover:bg-[#FAF6F2] disabled:opacity-60 disabled:cursor-not-allowed transition-all"
        >
          <RefreshCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh History
        </button>
      </div>

      <div className="px-4 sm:px-6 py-4 border-b border-[#F0EDE8] bg-[#FBFAF8]">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_220px_220px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C4B8B0]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => onSearchTermChange?.(event.target.value)}
              placeholder="Search by item, SKU, reason, user, or expiry note"
              className="w-full pl-10 pr-3.5 py-2.5 border border-[#E2DDD8] rounded-xl text-sm text-[#2C1810] bg-white transition focus:outline-none focus:border-[#6B3E26] focus:ring-2 focus:ring-[#6B3E26]/10 placeholder:text-[#C4B8B0]"
            />
          </div>
          <Dropdown
            value={movementFilter}
            onChange={onMovementFilterChange}
            options={movementOptions}
            placeholder="Movement type"
            className="text-sm font-semibold text-[#3D261D]"
          />
          <Dropdown
            value={rangeFilter}
            onChange={onRangeFilterChange}
            options={rangeOptions}
            placeholder="Date range"
            className="text-sm font-semibold text-[#3D261D]"
          />
        </div>
      </div>

      <div className="px-4 sm:px-6 py-4 sm:py-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5 border-b border-[#F0EDE8] bg-white">
        <div className={`${summaryCardBase} border-[#E8DED5]`}>
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#9E8A7A] font-semibold">Visible Records</p>
          <p className="mt-2 text-2xl font-bold text-[#1C100A]">{entries.length}</p>
          <p className="mt-1 text-xs text-[#7A6355]">{loadedCount} history record{loadedCount === 1 ? '' : 's'} loaded</p>
        </div>
        <div className={`${summaryCardBase} border-emerald-200 bg-emerald-50/70`}>
          <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-700 font-semibold">Restocks</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{summary.restocks}</p>
          <p className="mt-1 text-xs text-emerald-700/80">Recorded stock additions</p>
        </div>
        <div className={`${summaryCardBase} border-rose-200 bg-rose-50/70`}>
          <p className="text-[11px] uppercase tracking-[0.18em] text-rose-700 font-semibold">Consumption</p>
          <p className="mt-2 text-2xl font-bold text-rose-700">{summary.consumptions}</p>
          <p className="mt-1 text-xs text-rose-700/80">Recorded stock deductions</p>
        </div>
        <div className={`${summaryCardBase} border-orange-200 bg-orange-50/80`}>
          <p className="text-[11px] uppercase tracking-[0.18em] text-orange-700 font-semibold">Expired</p>
          <p className="mt-2 text-2xl font-bold text-orange-700">{summary.expired}</p>
          <p className="mt-1 text-xs text-orange-700/80">Expiration alerts in history</p>
        </div>
        <div className={`${summaryCardBase} border-amber-200 bg-amber-50/80`}>
          <p className="text-[11px] uppercase tracking-[0.18em] text-amber-700 font-semibold">Net Change</p>
          <p className="mt-2 text-2xl font-bold text-amber-700">
            {summary.net > 0 ? '+' : ''}{summary.net}
          </p>
          <p className="mt-1 text-xs text-amber-700/80">Based on visible movements</p>
        </div>
      </div>

      {error ? (
        <div className="mx-4 sm:mx-6 mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="px-4 sm:px-6 py-16 text-center">
          <RefreshCcw className="w-8 h-8 text-[#A89080] mx-auto animate-spin mb-3" />
          <p className="text-sm font-medium text-[#6B5744]">Loading inventory history...</p>
          <p className="text-xs text-[#A89080] mt-1">Pulling movement and expiration records.</p>
        </div>
      ) : entries.length > 0 ? (
        <>
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[#F0EDE8] bg-[#FDFCFB]">
                  {['When', 'Item', 'Movement', 'Quantity', 'Stock After', 'Reason', 'Batch Details', 'Recorded By'].map((heading) => (
                    <th
                      key={heading}
                      className="px-4 sm:px-6 py-3 text-left text-[10px] font-bold text-[#A89080] uppercase tracking-widest whitespace-nowrap"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const isIncoming = entry.direction === 'IN';
                  const isExpired = entry.direction === 'EXPIRED';
                  return (
                    <tr key={entry.id} className="border-b border-[#F5F2EE] last:border-0 hover:bg-[#FCFAF7] transition-colors">
                      <td className="px-4 sm:px-6 py-4 align-top min-w-[180px]">
                        <div className="flex items-start gap-2 text-sm text-[#2C1810]">
                          <Clock3 className="w-4 h-4 text-[#A89080] mt-0.5 shrink-0" />
                          <span>{formatTimestamp(entry.timestamp)}</span>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 align-top min-w-[180px]">
                        <p className="text-sm font-semibold text-[#1C100A]">{entry.itemName}</p>
                        <p className="text-xs text-[#A89080] mt-1">{entry.itemSku || 'No SKU'}</p>
                      </td>
                      <td className="px-4 sm:px-6 py-4 align-top min-w-[140px]">
                        <span
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                            isExpired
                              ? 'bg-orange-50 text-orange-700 border-orange-200'
                              : isIncoming
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {isExpired ? <AlertTriangle className="w-3.5 h-3.5" /> : isIncoming ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownLeft className="w-3.5 h-3.5" />}
                          {isExpired ? 'Expired' : isIncoming ? 'Restock' : 'Consumption'}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 align-top min-w-[120px]">
                        <p className={`text-sm font-bold ${
                          isExpired ? 'text-orange-700' : isIncoming ? 'text-emerald-700' : 'text-rose-700'
                        }`}>
                          {isExpired ? 'Expired' : formatSignedQuantity(entry.adjustment, entry.unit)}
                        </p>
                      </td>
                      <td className="px-4 sm:px-6 py-4 align-top min-w-[150px]">
                        <p className="text-sm font-semibold text-[#1C100A]">
                          {formatQuantity(entry.newQuantity, entry.unit)}
                        </p>
                        <p className="text-xs text-[#9E8A7A] mt-1">
                          {isExpired
                            ? `Expired on ${formatExpiration(entry.expirationDate) || 'recorded date'}`
                            : `From ${formatQuantity(entry.previousQuantity, entry.unit)}`}
                        </p>
                      </td>
                      <td className="px-4 sm:px-6 py-4 align-top min-w-[280px]">
                        <p className="text-sm text-[#4B3429] whitespace-pre-wrap break-words">
                          {entry.reason || 'No reason recorded'}
                        </p>
                      </td>
                      <td className="px-4 sm:px-6 py-4 align-top min-w-[260px]">
                        <div className="flex items-start gap-2">
                          <Layers3 className="w-4 h-4 text-[#A89080] mt-0.5 shrink-0" />
                          <div>
                            <p className="text-sm text-[#4B3429]">{getBatchSummary(entry)}</p>
                            <BatchDetailsButton entry={entry} onClick={() => setBatchModalEntry(entry)} />
                            {entry.expirationDate ? (
                              <p className="text-xs text-[#9E8A7A] mt-1">
                                Current expiry: {formatExpiration(entry.expirationDate)}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 align-top min-w-[180px]">
                        <p className="text-sm text-[#2C1810] break-all">{formatUser(entry.performedBy)}</p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="lg:hidden divide-y divide-[#F0EDE8]">
            {entries.map((entry) => {
              const isIncoming = entry.direction === 'IN';
              const isExpired = entry.direction === 'EXPIRED';
              return (
                <div key={entry.id} className="px-4 py-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#1C100A]">{entry.itemName}</p>
                      <p className="text-[11px] text-[#A89080] mt-1">{entry.itemSku || 'No SKU'}</p>
                      <p className="text-xs text-[#9E8A7A] mt-1">{formatTimestamp(entry.timestamp)}</p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                        isExpired
                          ? 'bg-orange-50 text-orange-700 border-orange-200'
                          : isIncoming
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      {isExpired ? <AlertTriangle className="w-3.5 h-3.5" /> : isIncoming ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownLeft className="w-3.5 h-3.5" />}
                      {isExpired ? 'Expired' : isIncoming ? 'Restock' : 'Consume'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-[#F8F4EF] px-3 py-2.5">
                      <p className="text-[10px] uppercase tracking-widest text-[#A89080] font-bold">Quantity</p>
                      <p className={`mt-1 text-sm font-bold ${
                        isExpired ? 'text-orange-700' : isIncoming ? 'text-emerald-700' : 'text-rose-700'
                      }`}>
                        {isExpired ? 'Expired' : formatSignedQuantity(entry.adjustment, entry.unit)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-[#F8F4EF] px-3 py-2.5">
                      <p className="text-[10px] uppercase tracking-widest text-[#A89080] font-bold">Stock After</p>
                      <p className="mt-1 text-sm font-bold text-[#1C100A]">{formatQuantity(entry.newQuantity, entry.unit)}</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#EEE5DB] bg-[#FCFAF8] px-3.5 py-3">
                    <p className="text-[10px] uppercase tracking-widest text-[#A89080] font-bold">Reason</p>
                    <p className="mt-1 text-sm text-[#4B3429] whitespace-pre-wrap break-words">
                      {entry.reason || 'No reason recorded'}
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#EEE5DB] bg-[#FCFAF8] px-3.5 py-3">
                    <p className="text-[10px] uppercase tracking-widest text-[#A89080] font-bold">Batch Details</p>
                    <p className="mt-1 text-sm text-[#4B3429]">{getBatchSummary(entry)}</p>
                    <BatchDetailsButton entry={entry} onClick={() => setBatchModalEntry(entry)} />
                    {entry.expirationDate ? (
                      <p className="text-xs text-[#9E8A7A] mt-1">Current expiry: {formatExpiration(entry.expirationDate)}</p>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-between gap-3 text-xs text-[#7A6355]">
                    <span>
                      {isExpired
                        ? `Expired on ${formatExpiration(entry.expirationDate) || 'recorded date'}`
                        : `From ${formatQuantity(entry.previousQuantity, entry.unit)}`}
                    </span>
                    <span className="break-all text-right">{formatUser(entry.performedBy)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="px-4 sm:px-6 py-14 text-center">
          <PackageSearch className="w-10 h-10 text-[#C4B8B0] mx-auto mb-3 opacity-70" />
          <p className="text-sm font-semibold text-[#6B5744]">No inventory history found</p>
          <p className="text-xs text-[#A89080] mt-1">
            Try a different date range or clear the history filters.
          </p>
        </div>
      )}

      {hasMore ? (
        <div className="px-4 sm:px-6 py-4 border-t border-[#F0EDE8] bg-[#FBFAF8] flex justify-center">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E2DDD8] bg-white text-sm font-semibold text-[#3D261D] hover:bg-[#FAF6F2] disabled:opacity-60 disabled:cursor-not-allowed transition-all"
          >
            <RefreshCcw className={`w-4 h-4 ${isLoadingMore ? 'animate-spin' : ''}`} />
            {isLoadingMore ? 'Loading More...' : 'Load More History'}
          </button>
        </div>
      ) : null}
    </div>
    </>
  );
}
