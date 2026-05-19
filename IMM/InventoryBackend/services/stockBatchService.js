const { normalizeDateValue } = require("./notificationService");

const DEFAULT_FALLBACK_DATE = "9999-12-31";
const QUANTITY_PRECISION = 1000;
const QUANTITY_EPSILON = 0.000001;

const normalizeQuantityValue = (value) => {
  const parsed = Number.parseFloat(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * QUANTITY_PRECISION) / QUANTITY_PRECISION;
};

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "object" && (value._seconds || value.seconds)) {
    return Number(value._seconds || value.seconds) * 1000;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

const generateBatchId = () =>
  `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const normalizeReceivedAt = (value, fallbackValue = new Date().toISOString()) => {
  if (!value) return fallbackValue;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && (value._seconds || value.seconds)) {
    return new Date(Number(value._seconds || value.seconds) * 1000).toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallbackValue : parsed.toISOString();
};

const sortStockBatches = (batches = []) => {
  return [...batches].sort((first, second) => {
    const receivedDiff = toMillis(first.receivedAt) - toMillis(second.receivedAt);
    if (receivedDiff !== 0) return receivedDiff;

    const firstExpiration = first.expirationDate || DEFAULT_FALLBACK_DATE;
    const secondExpiration = second.expirationDate || DEFAULT_FALLBACK_DATE;
    return firstExpiration.localeCompare(secondExpiration);
  });
};

const normalizeSingleBatch = (batch = {}, fallbackReceivedAt, fallbackId) => {
  const quantity = normalizeQuantityValue(batch.quantity);
  if (!Number.isFinite(quantity) || quantity <= QUANTITY_EPSILON) return null;

  const normalizedBatch = {
    id: batch.id || fallbackId || generateBatchId(),
    quantity,
    expirationDate: normalizeDateValue(batch.expirationDate),
    receivedAt: normalizeReceivedAt(batch.receivedAt || batch.createdAt, fallbackReceivedAt),
  };

  if (batch.cost !== undefined && batch.cost !== null && Number.isFinite(Number(batch.cost))) {
    normalizedBatch.cost = Number(batch.cost);
  }

  return normalizedBatch;
};

const normalizeStockBatches = (item = {}, { seedFromItem = true } = {}) => {
  const fallbackReceivedAt = normalizeReceivedAt(item.updatedAt || item.createdAt, new Date().toISOString());
  const explicitBatches = Array.isArray(item.stockBatches)
    ? item.stockBatches
        .map((batch, index) =>
          normalizeSingleBatch(batch, fallbackReceivedAt, `${item.id || "item"}-${index + 1}`)
        )
        .filter(Boolean)
    : [];

  if (explicitBatches.length > 0 || !seedFromItem) {
    return sortStockBatches(explicitBatches);
  }

  const normalizedItemQuantity = normalizeQuantityValue(item.quantity);
  if (!Number.isFinite(normalizedItemQuantity) || normalizedItemQuantity <= QUANTITY_EPSILON) {
    return [];
  }

  const seededBatch = normalizeSingleBatch(
    {
      id: `${item.id || "item"}-seed`,
      quantity: normalizedItemQuantity,
      expirationDate: item.expirationDate || null,
      receivedAt: fallbackReceivedAt,
    },
    fallbackReceivedAt
  );

  return seededBatch ? [seededBatch] : [];
};

const summarizeStockBatches = (batches = [], lowStockThreshold = 0) => {
  const normalized = sortStockBatches(
    batches
      .map((batch) => normalizeSingleBatch(batch, new Date().toISOString()))
      .filter(Boolean)
  );

  const quantity = normalizeQuantityValue(
    normalized.reduce((sum, batch) => sum + batch.quantity, 0)
  );
  const expirationDate =
    normalized
      .map((batch) => batch.expirationDate)
      .filter(Boolean)
      .sort()[0] || null;

  return {
    stockBatches: normalized,
    quantity,
    expirationDate,
    isLowStock: quantity <= normalizeQuantityValue(lowStockThreshold),
  };
};

const resetStockBatches = ({
  quantity = 0,
  expirationDate = null,
  lowStockThreshold = 0,
  receivedAt = new Date().toISOString(),
} = {}) => {
  const parsedQuantity = normalizeQuantityValue(quantity);
  if (!Number.isFinite(parsedQuantity) || parsedQuantity <= QUANTITY_EPSILON) {
    return summarizeStockBatches([], lowStockThreshold);
  }

  return summarizeStockBatches(
    [
      {
        id: generateBatchId(),
        quantity: parsedQuantity,
        expirationDate: normalizeDateValue(expirationDate),
        receivedAt: normalizeReceivedAt(receivedAt),
      },
    ],
    lowStockThreshold
  );
};

const addStockBatch = (
  item = {},
  additionQuantity,
  expirationDate = null,
  receivedAt = new Date().toISOString(),
  batchCost = null
) => {
  const parsedQuantity = normalizeQuantityValue(additionQuantity);
  const currentBatches = normalizeStockBatches(item);

  if (!Number.isFinite(parsedQuantity) || parsedQuantity <= QUANTITY_EPSILON) {
    return {
      ...summarizeStockBatches(currentBatches, item.lowStockThreshold),
      addedBatch: null,
    };
  }

  const addedBatch = {
    id: generateBatchId(),
    quantity: parsedQuantity,
    expirationDate: normalizeDateValue(expirationDate),
    receivedAt: normalizeReceivedAt(receivedAt),
    ...(batchCost !== null && Number.isFinite(batchCost) ? { cost: batchCost } : {}),
  };

  const summary = summarizeStockBatches(
    [...currentBatches, addedBatch],
    item.lowStockThreshold
  );

  return {
    ...summary,
    addedBatch,
  };
};

const consumeStockBatches = (item = {}, deductionQuantity) => {
  const parsedQuantity = normalizeQuantityValue(deductionQuantity);
  const currentBatches = normalizeStockBatches(item);
  const currentQuantity = normalizeQuantityValue(
    currentBatches.reduce((sum, batch) => sum + batch.quantity, 0)
  );

  if (!Number.isFinite(parsedQuantity) || parsedQuantity <= QUANTITY_EPSILON) {
    return {
      ...summarizeStockBatches(currentBatches, item.lowStockThreshold),
      consumedBatches: [],
    };
  }

  if (parsedQuantity - currentQuantity > QUANTITY_EPSILON) {
    throw {
      code: 400,
      message: `Insufficient stock. Current: ${currentQuantity}, Adjustment: -${parsedQuantity}`,
    };
  }

  let remaining = parsedQuantity;
  const nextBatches = [];
  const consumedBatches = [];

  // Sort batches to consume expired items first, then by received date (FIFO)
  const sortedBatches = [...currentBatches].sort((a, b) => {
    const today = new Date().toISOString().split('T')[0];
    const aIsExpired = a.expirationDate <= today;
    const bIsExpired = b.expirationDate <= today;

    // Expired items first
    if (aIsExpired && !bIsExpired) return -1;
    if (!aIsExpired && bIsExpired) return 1;

    // Then by expiration date (earliest first)
    if (aIsExpired && bIsExpired) {
      return a.expirationDate.localeCompare(b.expirationDate);
    }

    // Non-expired: FIFO by received date
    return new Date(a.receivedAt) - new Date(b.receivedAt);
  });

  for (const batch of sortedBatches) {
    if (remaining <= 0) {
      nextBatches.push(batch);
      continue;
    }

    const consumedQuantity = normalizeQuantityValue(Math.min(batch.quantity, remaining));
    const remainingQuantity = normalizeQuantityValue(batch.quantity - consumedQuantity);

    if (consumedQuantity > QUANTITY_EPSILON) {
      const today = new Date().toISOString().split('T')[0];
      const isExpired = batch.expirationDate <= today;
      
      consumedBatches.push({
        id: batch.id,
        quantity: consumedQuantity,
        previousQuantity: batch.quantity,
        remainingQuantity,
        expirationDate: batch.expirationDate,
        receivedAt: batch.receivedAt,
        ...(batch.cost !== undefined ? { cost: batch.cost } : {}),
        isExpired: isExpired,
      });
    }

    if (remainingQuantity > QUANTITY_EPSILON) {
      nextBatches.push({
        ...batch,
        quantity: remainingQuantity,
      });
    }

    remaining = normalizeQuantityValue(remaining - consumedQuantity);
  }

  const summary = summarizeStockBatches(nextBatches, item.lowStockThreshold);

  return {
    ...summary,
    consumedBatches,
  };
};

module.exports = {
  addStockBatch,
  consumeStockBatches,
  normalizeStockBatches,
  resetStockBatches,
  summarizeStockBatches,
};
