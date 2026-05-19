const { db } = require("../config/firebase");
const { FieldValue } = require("firebase-admin/firestore");
const { emitInventoryUpdate } = require("../services/realtime");
const { normalizeDateValue, syncNotificationsForItem } = require("../services/notificationService");
const {
  addStockBatch,
  consumeStockBatches,
  resetStockBatches,
  normalizeStockBatches,
} = require("../services/stockBatchService");

const COLLECTION = "inventory";
const LOG_COLLECTION = "inventoryLogs";
const QUANTITY_PRECISION = 1000;
const QUANTITY_EPSILON = 0.000001;

// Category mapping: UI format to backend lowercase format
const categoryToBackend = {
  'Beans': 'beans',
  'Milk': 'milk',
  'Syrup': 'syrup',
  'Cups': 'packaging',
  'Pastries': 'other',
  'Equipment': 'equipment',
  'Add-ins': 'add-ins',
  'Powder': 'powder',
  'Other': 'other',
};

const normalizeSkuPrefix = (value = "Item") => {
  const lettersOnly = String(value).replace(/[^a-zA-Z]/g, "");
  if (!lettersOnly) return "ITM";
  return lettersOnly.slice(0, 3).toUpperCase();
};

const sanitizeSku = (value = "") => {
  const match = String(value).trim().match(/^([a-zA-Z]+)-([0-9]{3})$/);
  if (!match) return "";
  return `${normalizeSkuPrefix(match[1])}-${match[2]}`;
};

const generateSkuWithPrefix = async (name = "Item") => {
  const prefix = normalizeSkuPrefix(name);
  
  // Query all existing SKUs with this prefix to find the highest number
  const snapshot = await db.collection(COLLECTION)
    .where("sku", ">=", `${prefix}-000`)
    .where("sku", "<=", `${prefix}-999`)
    .orderBy("sku", "desc")
    .limit(1)
    .get();

  let nextNumber = 1;
  if (!snapshot.empty) {
    const lastSku = snapshot.docs[0].data().sku;
    const match = lastSku.match(/-(\d{3})$/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
      if (nextNumber > 999) nextNumber = 1; // Wrap around if needed
    }
  }

  const suffix = nextNumber.toString().padStart(3, '0');
  return `${prefix}-${suffix}`;
};

// ─── Helper ───────────────────────────────────────────────────────────────────

const toClientErrorMessage = (error, fallbackMessage) => {
  const raw = String(error?.message || "").toLowerCase();
  const isCredentialsIssue =
    raw.includes("unable to detect a project id") ||
    raw.includes("could not load the default credentials") ||
    raw.includes("invalid grant");

  if (isCredentialsIssue) {
    return "Firestore credentials are not configured in backend. Check InventoryBackend/.env Firebase Admin settings.";
  }

  return fallbackMessage;
};

const mapBatchLogDetails = (batches = []) =>
  batches.map((batch) => {
    const details = {
      id: batch.id || "",
      quantity: batch.quantity,
      expirationDate: batch.expirationDate || null,
      receivedAt: batch.receivedAt || null,
    };

    if (batch.previousQuantity !== undefined && batch.previousQuantity !== null) {
      details.previousQuantity = batch.previousQuantity;
    }

    if (batch.remainingQuantity !== undefined && batch.remainingQuantity !== null) {
      details.remainingQuantity = batch.remainingQuantity;
    }

    if (batch.isExpired !== undefined && batch.isExpired !== null) {
      details.isExpired = Boolean(batch.isExpired);
    }

    return details;
  });

const normalizeQuantityValue = (value) => {
  const parsed = Number.parseFloat(value ?? 0);
  if (!Number.isFinite(parsed)) return Number.NaN;
  return Math.round(parsed * QUANTITY_PRECISION) / QUANTITY_PRECISION;
};

const isWholeQuantity = (value) => Math.abs(value - Math.round(value)) < QUANTITY_EPSILON;

const unitRequiresWholeQuantity = (unit = "") =>
  String(unit).trim().toLowerCase() === "pcs";

const validateUnitQuantity = (value, unit, label) => {
  if (Number.isNaN(value)) return `${label} must be a valid number.`;
  if (!unitRequiresWholeQuantity(unit)) return null;
  if (isWholeQuantity(value)) return null;
  return `${label} must be a whole number when unit is pcs.`;
};

const logActivity = async (action, itemId, itemName, userId, details = {}) => {
  await db.collection(LOG_COLLECTION).add({
    action,        // "CREATE" | "UPDATE" | "DELETE" | "STOCK_ADJUST"
    itemId,
    itemName,
    performedBy: userId,
    details,
    timestamp: FieldValue.serverTimestamp(),
  });
};

// ─── CREATE ───────────────────────────────────────────────────────────────────

/**
 * POST /api/inventory
 */
const createItem = async (req, res) => {
  try {
    const { name, sku, category, quantity, unit, lowStockThreshold = 10, totalBatchCost, batchQuantity, supplier, expirationDate, conversions = [] } = req.body;

    const quantityValue = normalizeQuantityValue(quantity);
    const thresholdValue = normalizeQuantityValue(lowStockThreshold);
    const cleanName = String(name).trim();
    const cleanCategory = categoryToBackend[category] || category.toLowerCase();
    const cleanUnit = String(unit).trim();
    const cleanSupplier = supplier ? String(supplier).trim() : null;
    const cleanExpirationDate = normalizeDateValue(expirationDate);
    const quantityValidationMessage = validateUnitQuantity(quantityValue, cleanUnit, "Quantity");
    if (quantityValidationMessage) {
      return res.status(422).json({ success: false, message: quantityValidationMessage });
    }
    const thresholdValidationMessage = validateUnitQuantity(thresholdValue, cleanUnit, "Low stock threshold");
    if (thresholdValidationMessage) {
      return res.status(422).json({ success: false, message: thresholdValidationMessage });
    }
    const batchSnapshot = resetStockBatches({
      quantity: quantityValue,
      expirationDate: cleanExpirationDate,
      lowStockThreshold: thresholdValue,
      receivedAt: new Date().toISOString(),
    });

    let finalSku = sanitizeSku(sku) || await generateSkuWithPrefix(cleanName);

    // Validate custom SKU uniqueness only (auto-generated SKUs are sequential and unique)
    if (sku) {
      const skuCheck = await db.collection(COLLECTION).where("sku", "==", finalSku).limit(1).get();
      if (!skuCheck.empty) {
        return res.status(409).json({ success: false, message: `SKU '${finalSku}' already exists` });
      }
    }

    // Calculate cost per unit: totalBatchCost / batchQuantity
    const costPerUnit = (totalBatchCost && batchQuantity) ? parseFloat(totalBatchCost) / parseFloat(batchQuantity) : null;

    const newItem = {
      name: cleanName,
      sku: finalSku,
      category: cleanCategory,
      quantity: batchSnapshot.quantity,
      unit: cleanUnit,
      lowStockThreshold: thresholdValue,
      totalBatchCost: totalBatchCost ? parseFloat(totalBatchCost) : null,
      batchQuantity: batchQuantity ? parseFloat(batchQuantity) : null,
      costPrice: costPerUnit,
      supplier: cleanSupplier,
      expirationDate: batchSnapshot.expirationDate,
      stockBatches: batchSnapshot.stockBatches,
      isLowStock: batchSnapshot.isLowStock,
      conversions: Array.isArray(conversions) ? conversions : [],
      status: "active",
      createdBy: req.user.uid,
      updatedBy: req.user.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection(COLLECTION).add(newItem);

    await logActivity("CREATE", docRef.id, cleanName, req.user.uid, {
      quantity: batchSnapshot.quantity,
      sku: finalSku,
      expirationDate: batchSnapshot.expirationDate || null,
      stockBatches: mapBatchLogDetails(batchSnapshot.stockBatches),
    });

    // Emit real-time update to all connected clients
    emitInventoryUpdate("created", { id: docRef.id, ...newItem });
    await syncNotificationsForItem({ id: docRef.id, ...newItem });

    res.status(201).json({
      success: true,
      message: "Inventory item created",
      data: { id: docRef.id, ...newItem },
    });
  } catch (error) {
    console.error("createItem error:", error);
    res.status(500).json({ success: false, message: toClientErrorMessage(error, "Failed to create item") });
  }
};

// ─── READ ALL ─────────────────────────────────────────────────────────────────

/**
 * GET /api/inventory
 * Supports: ?category=beans&lowStock=true&search=milk&page=1&limit=20
 */
const getAllItems = async (req, res) => {
  try {
    const { category, lowStock, search, status = "active", limit = 20, startAfter } = req.query;
    const limitNum = Math.min(parseInt(limit), 100);
    const normalizedStatus = String(status || "active").toLowerCase();

    // Use a broad query + in-memory filtering to avoid composite-index failures
    // in environments where Firestore indexes are not yet created.
    let query = db.collection(COLLECTION).limit(limitNum);

    if (startAfter) {
      const lastDoc = await db.collection(COLLECTION).doc(startAfter).get();
      if (lastDoc.exists) query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    let items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // Default behavior remains active-only. Optional query allows archived/all.
    if (normalizedStatus === "archived") {
      items = items.filter((i) => (i.status || "active") === "deleted");
    } else if (normalizedStatus === "all") {
      items = items.filter((i) => ["active", "deleted"].includes(i.status || "active"));
    } else {
      items = items.filter((i) => (i.status || "active") === "active");
    }

    if (category) items = items.filter((i) => i.category === category);
    if (lowStock === "true") items = items.filter((i) => i.isLowStock === true);

    if (search) {
      const term = search.toLowerCase();
      items = items.filter(
        (i) =>
          (i.name || "").toLowerCase().includes(term) ||
          (i.sku || "").toLowerCase().includes(term) ||
          (i.supplier || "").toLowerCase().includes(term)
      );
    }

    items.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    const lastVisible = snapshot.docs[snapshot.docs.length - 1];

    res.json({
      success: true,
      data: items,
      count: items.length,
      nextCursor: lastVisible?.id || null,
    });
  } catch (error) {
    console.error("getAllItems error:", error);
    res.status(500).json({ success: false, message: toClientErrorMessage(error, "Failed to fetch inventory") });
  }
};

// ─── READ ONE ─────────────────────────────────────────────────────────────────

/**
 * GET /api/inventory/:id
 */
const getItemById = async (req, res) => {
  try {
    const doc = await db.collection(COLLECTION).doc(req.params.id).get();

    if (!doc.exists || doc.data().status === "deleted") {
      return res.status(404).json({ success: false, message: "Item not found" });
    }

    res.json({ success: true, data: { id: doc.id, ...doc.data() } });
  } catch (error) {
    console.error("getItemById error:", error);
    res.status(500).json({ success: false, message: toClientErrorMessage(error, "Failed to fetch item") });
  }
};

// ─── UPDATE ───────────────────────────────────────────────────────────────────

/**
 * PATCH /api/inventory/:id
 */
const updateItem = async (req, res) => {
  try {
    const docRef = db.collection(COLLECTION).doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists || doc.data().status === "deleted") {
      return res.status(404).json({ success: false, message: "Item not found" });
    }

    const current = doc.data();
    const { name, category, quantity, unit, lowStockThreshold, totalBatchCost, batchQuantity, supplier, expirationDate, conversions } = req.body;
    const nextUnit = unit !== undefined ? String(unit).trim() : current.unit;

    const updates = { updatedBy: req.user.uid, updatedAt: FieldValue.serverTimestamp() };

    if (name !== undefined) updates.name = name;
    if (category !== undefined) updates.category = categoryToBackend[category] || category.toLowerCase();
    if (unit !== undefined) updates.unit = nextUnit;
    if (supplier !== undefined) updates.supplier = supplier;
    if (totalBatchCost !== undefined) {
      // For editing existing items, update the current batch cost instead of totalBatchCost
      const parsedBatchCost = parseFloat(totalBatchCost);
      
      // Find the most recent batch with stock and update its cost
      const currentBatches = normalizeStockBatches(current);
      if (currentBatches.length > 0) {
        // Sort batches by receivedAt descending (most recent first)
        const sortedBatches = [...currentBatches].sort((a, b) => 
          new Date(b.receivedAt || 0) - new Date(a.receivedAt || 0)
        );
        
        // Update the cost of the most recent batch
        const mostRecentBatch = sortedBatches[0];
        const updatedBatches = currentBatches.map(batch => 
          batch.id === mostRecentBatch.id 
            ? { ...batch, cost: parsedBatchCost }
            : batch
        );
        
        // Recalculate total batch cost as sum of all batch costs
        const newTotalBatchCost = updatedBatches.reduce((sum, batch) => sum + Number(batch.cost || 0), 0);
        
        updates.totalBatchCost = newTotalBatchCost;
        updates.stockBatches = updatedBatches;
      } else {
        // Fallback to item-level totalBatchCost if no batches exist
        updates.totalBatchCost = parsedBatchCost;
      }
    }
    if (batchQuantity !== undefined) updates.batchQuantity = parseFloat(batchQuantity);
    if (totalBatchCost !== undefined || batchQuantity !== undefined) {
      const finalBatchQuantity = batchQuantity !== undefined ? parseFloat(batchQuantity) : current.batchQuantity;
      
      if (totalBatchCost !== undefined) {
        // Cost per unit is calculated as current batch cost / batch quantity
        const costPerUnit = (finalBatchQuantity && finalBatchQuantity > 0) ? parseFloat(totalBatchCost) / finalBatchQuantity : null;
        updates.costPrice = costPerUnit;
      } else {
        // If only batchQuantity changed, recalculate cost per unit using current totalBatchCost
        const finalTotalBatchCost = current.totalBatchCost;
        const costPerUnit = (finalTotalBatchCost && finalBatchQuantity && finalBatchQuantity > 0) ? finalTotalBatchCost / finalBatchQuantity : null;
        updates.costPrice = costPerUnit;
      }
    }
    if (conversions !== undefined) updates.conversions = Array.isArray(conversions) ? conversions : [];

    const newQty = quantity !== undefined ? normalizeQuantityValue(quantity) : Number(current.quantity ?? 0);
    const newThreshold =
      lowStockThreshold !== undefined
        ? normalizeQuantityValue(lowStockThreshold)
        : Number(current.lowStockThreshold ?? 0);
    const nextExpirationDate =
      expirationDate !== undefined ? normalizeDateValue(expirationDate) : current.expirationDate;
    const shouldResetStockBatches = quantity !== undefined || expirationDate !== undefined;
    const quantityToValidate = shouldResetStockBatches ? newQty : Number(current.quantity ?? 0);
    const quantityValidationMessage = validateUnitQuantity(quantityToValidate, nextUnit, "Quantity");
    if (quantityValidationMessage) {
      return res.status(422).json({ success: false, message: quantityValidationMessage });
    }
    const thresholdValidationMessage = validateUnitQuantity(newThreshold, nextUnit, "Low stock threshold");
    if (thresholdValidationMessage) {
      return res.status(422).json({ success: false, message: thresholdValidationMessage });
    }

    if (lowStockThreshold !== undefined) updates.lowStockThreshold = newThreshold;

    if (shouldResetStockBatches) {
      const batchSnapshot = resetStockBatches({
        quantity: newQty,
        expirationDate: nextExpirationDate,
        lowStockThreshold: newThreshold,
        receivedAt: new Date().toISOString(),
      });

      updates.quantity = batchSnapshot.quantity;
      updates.expirationDate = batchSnapshot.expirationDate;
      updates.stockBatches = batchSnapshot.stockBatches;
      updates.isLowStock = batchSnapshot.isLowStock;
    } else {
      updates.isLowStock = Number(current.quantity ?? 0) <= newThreshold;
    }

    await docRef.update(updates);
    await logActivity("UPDATE", req.params.id, current.name, req.user.uid, {
      ...updates,
      ...(shouldResetStockBatches && {
        fifoReset: true,
        quantity: updates.quantity,
        expirationDate: updates.expirationDate || null,
        stockBatches: mapBatchLogDetails(updates.stockBatches),
      }),
    });

    const responseData = {
      id: req.params.id,
      ...current,
      ...updates,
      name: updates.name ?? current.name,
      quantity: updates.quantity ?? newQty,
      lowStockThreshold: newThreshold,
      expirationDate: updates.expirationDate ?? current.expirationDate ?? null,
      stockBatches: updates.stockBatches || current.stockBatches || [],
      status: current.status || "active",
    };

    // Emit real-time update to all connected clients
    emitInventoryUpdate("updated", responseData);

    await syncNotificationsForItem(responseData);

    res.json({ success: true, message: "Item updated successfully", data: responseData });
  } catch (error) {
    console.error("updateItem error:", error);
    res.status(500).json({ success: false, message: toClientErrorMessage(error, "Failed to update item") });
  }
};

// ─── DELETE (Soft) ────────────────────────────────────────────────────────────

/**
 * DELETE /api/inventory/:id
 */
const deleteItem = async (req, res) => {
  try {
    const docRef = db.collection(COLLECTION).doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists || doc.data().status === "deleted") {
      return res.status(404).json({ success: false, message: "Item not found" });
    }

    const current = doc.data();

    await docRef.update({
      status: "deleted",
      deletedBy: req.user.uid,
      deletedAt: FieldValue.serverTimestamp(),
    });

    await logActivity("DELETE", req.params.id, current.name, req.user.uid);

    // Emit real-time update to all connected clients
    emitInventoryUpdate("deleted", {
      id: req.params.id,
      ...current,
      status: "deleted",
      deletedBy: req.user.uid,
    });

    await syncNotificationsForItem({
      id: req.params.id,
      ...current,
      status: "deleted",
    });

    res.json({ success: true, message: "Item deleted successfully" });
  } catch (error) {
    console.error("deleteItem error:", error);
    res.status(500).json({ success: false, message: toClientErrorMessage(error, "Failed to delete item") });
  }
};

// ─── STOCK ADJUSTMENT ─────────────────────────────────────────────────────────

/**
 * POST /api/inventory/:id/adjust
 * Safely adjusts stock using Firestore transactions to prevent race conditions.
 */
const adjustStock = async (req, res) => {
  try {
    const { adjustment, reason, expirationDate, batchCost } = req.body;
    const adjustmentValue = normalizeQuantityValue(adjustment);
    const normalizedExpirationDate = normalizeDateValue(expirationDate);
    const parsedBatchCost = batchCost !== undefined && batchCost !== null ? parseFloat(batchCost) : null;
    const docRef = db.collection(COLLECTION).doc(req.params.id);

    const result = await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);

      if (!doc.exists || doc.data().status === "deleted") {
        throw { code: 404, message: "Item not found" };
      }

      const current = doc.data();
      const quantityValidationMessage = validateUnitQuantity(Math.abs(adjustmentValue), current.unit, "Adjustment");
      if (quantityValidationMessage) {
        throw { code: 422, message: quantityValidationMessage };
      }
      const batchSnapshot =
        adjustmentValue >= 0
          ? addStockBatch(current, adjustmentValue, normalizedExpirationDate, new Date().toISOString(), parsedBatchCost)
          : consumeStockBatches(current, Math.abs(adjustmentValue));

      // Calculate total batch cost as sum of all batch costs
      const newTotalBatchCost = batchSnapshot.stockBatches.reduce((sum, batch) => sum + Number(batch.cost || 0), 0);

      transaction.update(docRef, {
        quantity: batchSnapshot.quantity,
        expirationDate: batchSnapshot.expirationDate,
        stockBatches: batchSnapshot.stockBatches,
        totalBatchCost: newTotalBatchCost,
        isLowStock: batchSnapshot.isLowStock,
        updatedBy: req.user.uid,
        updatedAt: FieldValue.serverTimestamp(),
      });

      return {
        newQuantity: batchSnapshot.quantity,
        isLowStock: batchSnapshot.isLowStock,
        expirationDate: batchSnapshot.expirationDate,
        stockBatches: batchSnapshot.stockBatches,
        totalBatchCost: newTotalBatchCost,
        addedBatch: batchSnapshot.addedBatch || null,
        consumedBatches: batchSnapshot.consumedBatches || [],
        itemName: current.name,
        item: current,
      };
    });

    const loggedAddedBatch = result.addedBatch
      ? {
          quantity: result.addedBatch.quantity,
          expirationDate: result.addedBatch.expirationDate || null,
          receivedAt: result.addedBatch.receivedAt || null,
        }
      : null;
    const loggedConsumedBatches = mapBatchLogDetails(result.consumedBatches);
    const previousQuantity = result.newQuantity - adjustmentValue;

    await logActivity("STOCK_ADJUST", req.params.id, result.itemName, req.user.uid, {
      adjustment: adjustmentValue,
      direction: adjustmentValue >= 0 ? "IN" : "OUT",
      reason,
      sku: result.item.sku || "",
      unit: result.item.unit || "",
      previousQuantity,
      newQuantity: result.newQuantity,
      expirationDate: result.expirationDate || null,
      addedBatch: loggedAddedBatch,
      consumedBatches: loggedConsumedBatches,
      fifoMode: "FIFO",
    });

    // Emit real-time update to all connected clients
    emitInventoryUpdate("stock-adjusted", {
      id: req.params.id,
      name: result.item.name,
      sku: result.item.sku || "",
      category: result.item.category,
      quantity: result.newQuantity,
      unit: result.item.unit || "",
      lowStockThreshold: result.item.lowStockThreshold || 0,
      costPrice: result.item.costPrice || null,
      supplier: result.item.supplier || null,
      expirationDate: result.expirationDate || null,
      stockBatches: result.stockBatches || [],
      isLowStock: result.isLowStock,
      status: result.item.status || "active",
      adjustment: adjustmentValue,
      previousQuantity,
      reason,
      addedBatch: loggedAddedBatch,
      consumedBatches: loggedConsumedBatches,
    });

    await syncNotificationsForItem({
      id: req.params.id,
      ...result.item,
      quantity: result.newQuantity,
      expirationDate: result.expirationDate || null,
      stockBatches: result.stockBatches || [],
      isLowStock: result.isLowStock,
    });

    res.json({
      success: true,
      message: `Stock adjusted by ${adjustmentValue > 0 ? "+" : ""}${adjustmentValue}`,
      data: {
        newQuantity: result.newQuantity,
        previousQuantity,
        isLowStock: result.isLowStock,
        expirationDate: result.expirationDate || null,
        stockBatches: result.stockBatches || [],
        totalBatchCost: result.totalBatchCost,
        addedBatch: loggedAddedBatch,
        consumedBatches: loggedConsumedBatches,
        ...(result.isLowStock && { alert: "⚠️ Item is below low stock threshold!" }),
      },
    });
  } catch (error) {
    if (error.code === 404) return res.status(404).json({ success: false, message: error.message });
    if (error.code === 400) return res.status(400).json({ success: false, message: error.message });
    if (error.code === 422) return res.status(422).json({ success: false, message: error.message });
    console.error("adjustStock error:", error);
    res.status(500).json({ success: false, message: toClientErrorMessage(error, "Failed to adjust stock") });
  }
};

// ─── LOW STOCK REPORT ─────────────────────────────────────────────────────────

/**
 * GET /api/inventory/reports/low-stock
 */
const getLowStockItems = async (req, res) => {
  try {
    const snapshot = await db
      .collection(COLLECTION)
      .where("status", "==", "active")
      .where("isLowStock", "==", true)
      .orderBy("quantity", "asc")
      .get();

    const items = snapshot.docs.map((doc) => ({
      id: doc.id,
      name: doc.data().name,
      sku: doc.data().sku,
      quantity: doc.data().quantity,
      lowStockThreshold: doc.data().lowStockThreshold,
      unit: doc.data().unit,
      category: doc.data().category,
    }));

    res.json({ success: true, data: items, count: items.length });
  } catch (error) {
    console.error("getLowStockItems error:", error);
    res.status(500).json({ success: false, message: toClientErrorMessage(error, "Failed to fetch low stock report") });
  }
};

// ─── ACTIVITY LOGS ────────────────────────────────────────────────────────────

/**
 * GET /api/inventory/:id/logs
 */
const getItemLogs = async (req, res) => {
  try {
    const snapshot = await db
      .collection(LOG_COLLECTION)
      .where("itemId", "==", req.params.id)
      .orderBy("timestamp", "desc")
      .limit(50)
      .get();

    const logs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json({ success: true, data: logs });
  } catch (error) {
    console.error("getItemLogs error:", error);
    res.status(500).json({ success: false, message: toClientErrorMessage(error, "Failed to fetch logs") });
  }
};

// ─── CROSS-ITEM ACTIVITY LOGS ─────────────────────────────────────────────────

/**
 * GET /api/inventory/logs
 * Supports: ?action=STOCK_ADJUST&limit=50&days=7&cursor=<docId>&itemId=<inventoryId>
 */
const getAllLogs = async (req, res) => {
  try {
    const {
      action,
      itemId,
      limit = 50,
      days = 7,
      cursor,
    } = req.query;

    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
    const isAllTime = String(days || "").toLowerCase() === "all";
    const requiresInMemoryFiltering = Boolean(action || itemId);

    let baseQuery = db.collection(LOG_COLLECTION);

    if (!isAllTime) {
      const daysNum = Math.max(parseInt(days, 10) || 7, 1);
      const now = new Date();
      const startDate = new Date(now.getTime() - daysNum * 24 * 60 * 60 * 1000);
      baseQuery = baseQuery.where("timestamp", ">=", startDate);
    }

    baseQuery = baseQuery.orderBy("timestamp", "desc");

    let cursorDoc = null;
    if (cursor) {
      const cursorSnapshot = await db.collection(LOG_COLLECTION).doc(String(cursor)).get();
      if (cursorSnapshot.exists) {
        cursorDoc = cursorSnapshot;
      }
    }

    const matchesFilters = (log) => {
      if (action && log.action !== action) return false;
      if (itemId && log.itemId !== itemId) return false;
      return true;
    };

    const mapSnapshot = (snapshot) => snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    if (!requiresInMemoryFiltering) {
      let query = baseQuery.limit(limitNum);
      if (cursorDoc) {
        query = query.startAfter(cursorDoc);
      }

      const snapshot = await query.get();
      const logs = mapSnapshot(snapshot);
      const lastVisible = snapshot.docs[snapshot.docs.length - 1];

      return res.json({
        success: true,
        data: logs,
        count: logs.length,
        nextCursor: snapshot.docs.length === limitNum ? lastVisible?.id || null : null,
      });
    }

    const batchSize = Math.min(Math.max(limitNum * 2, 50), 200);
    const maxScanBatches = 10;
    const collectedLogs = [];
    let lastScannedDoc = cursorDoc;
    let batchesScanned = 0;
    let exhausted = false;

    while (collectedLogs.length < limitNum && batchesScanned < maxScanBatches) {
      let query = baseQuery.limit(batchSize);
      if (lastScannedDoc) {
        query = query.startAfter(lastScannedDoc);
      }

      const snapshot = await query.get();
      if (snapshot.empty) {
        exhausted = true;
        break;
      }

      const rawLogs = mapSnapshot(snapshot);
      collectedLogs.push(...rawLogs.filter(matchesFilters));

      lastScannedDoc = snapshot.docs[snapshot.docs.length - 1];
      batchesScanned += 1;

      if (snapshot.docs.length < batchSize) {
        exhausted = true;
        break;
      }
    }

    const logs = collectedLogs.slice(0, limitNum);

    res.json({
      success: true,
      data: logs,
      count: logs.length,
      nextCursor: exhausted ? null : lastScannedDoc?.id || null,
    });
  } catch (error) {
    console.error("getAllLogs error:", error);
    res.status(500).json({ success: false, message: toClientErrorMessage(error, "Failed to fetch logs") });
  }
};

/**
 * PATCH /api/inventory/:id/restore
 */
const restoreItem = async (req, res) => {
  try {
    const docRef = db.collection(COLLECTION).doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, message: "Item not found" });
    }

    const current = doc.data();
    if ((current.status || "active") !== "deleted") {
      return res.status(400).json({ success: false, message: "Item is not archived" });
    }

    const updates = {
      status: "active",
      deletedBy: null,
      deletedAt: null,
      restoredBy: req.user.uid,
      restoredAt: FieldValue.serverTimestamp(),
      updatedBy: req.user.uid,
      updatedAt: FieldValue.serverTimestamp(),
    };

    await docRef.update(updates);

    const responseData = {
      id: req.params.id,
      ...current,
      ...updates,
      status: "active",
    };

    await logActivity("UPDATE", req.params.id, current.name, req.user.uid, {
      restored: true,
      previousStatus: current.status || "deleted",
      status: "active",
    });

    emitInventoryUpdate("updated", responseData);
    await syncNotificationsForItem(responseData);

    res.json({
      success: true,
      message: "Item restored successfully",
      data: responseData,
    });
  } catch (error) {
    console.error("restoreItem error:", error);
    res.status(500).json({ success: false, message: toClientErrorMessage(error, "Failed to restore item") });
  }
};

module.exports = { createItem, getAllItems, getItemById, updateItem, deleteItem, restoreItem, adjustStock, getLowStockItems, getItemLogs, getAllLogs };
