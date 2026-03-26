const { db } = require("../config/firebase");
const { FieldValue } = require("firebase-admin/firestore");

const COLLECTION = "inventory";
const LOG_COLLECTION = "inventoryLogs";

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

const sanitizeSku = (value = "") =>
  String(value)
    .trim()
    .replace(/[^a-zA-Z0-9-]/g, "")
    .toUpperCase();

const generateSku = (name = "ITEM", suffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0')) => {
  const prefix =
    String(name)
      .trim()
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, 3)
      .padEnd(3, 'X');

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
    const { name, sku, category, quantity, unit, lowStockThreshold = 10, costPrice, supplier } = req.body;

    const quantityInt = parseInt(quantity);
    const thresholdInt = parseInt(lowStockThreshold);
    const cleanName = String(name).trim();
    const cleanCategory = categoryToBackend[category] || category.toLowerCase(); // Convert UI category to backend format
    const cleanUnit = String(unit).trim();
    const cleanSupplier = supplier ? String(supplier).trim() : null;

    let finalSku = sanitizeSku(sku) || generateSku(cleanName);

    // Ensure SKU uniqueness when auto-generating or when a custom SKU collides.
    let attempts = 0;
    while (attempts < 5) {
      const skuCheck = await db.collection(COLLECTION).where("sku", "==", finalSku).limit(1).get();
      if (skuCheck.empty) break;

      if (sku) {
        return res.status(409).json({ success: false, message: `SKU '${finalSku}' already exists` });
      }

      attempts += 1;
      const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      finalSku = generateSku(cleanName, randomSuffix);
    }

    if (attempts >= 5) {
      return res.status(500).json({
        success: false,
        message: "Unable to generate a unique SKU. Please try again.",
      });
    }

    const newItem = {
      name: cleanName,
      sku: finalSku,
      category: cleanCategory,
      quantity: quantityInt,
      unit: cleanUnit,
      lowStockThreshold: thresholdInt,
      costPrice: costPrice ? parseFloat(costPrice) : null,
      supplier: cleanSupplier,
      isLowStock: quantityInt <= thresholdInt,
      status: "active",
      createdBy: req.user.uid,
      updatedBy: req.user.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection(COLLECTION).add(newItem);

    await logActivity("CREATE", docRef.id, cleanName, req.user.uid, { quantity: quantityInt, sku: finalSku });

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
    const { category, lowStock, search, limit = 20, startAfter } = req.query;
    const limitNum = Math.min(parseInt(limit), 100);

    // Use a broad query + in-memory filtering to avoid composite-index failures
    // in environments where Firestore indexes are not yet created.
    let query = db.collection(COLLECTION).limit(limitNum);

    if (startAfter) {
      const lastDoc = await db.collection(COLLECTION).doc(startAfter).get();
      if (lastDoc.exists) query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    let items = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((i) => i.status === "active");

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
    const { name, category, quantity, unit, lowStockThreshold, costPrice, supplier } = req.body;

    const updates = { updatedBy: req.user.uid, updatedAt: FieldValue.serverTimestamp() };

    if (name !== undefined) updates.name = name;
    if (category !== undefined) updates.category = categoryToBackend[category] || category.toLowerCase(); // Convert UI category to backend format
    if (unit !== undefined) updates.unit = unit;
    if (supplier !== undefined) updates.supplier = supplier;
    if (costPrice !== undefined) updates.costPrice = parseFloat(costPrice);

    const newQty = quantity !== undefined ? parseInt(quantity) : current.quantity;
    const newThreshold = lowStockThreshold !== undefined ? parseInt(lowStockThreshold) : current.lowStockThreshold;

    if (quantity !== undefined) updates.quantity = newQty;
    if (lowStockThreshold !== undefined) updates.lowStockThreshold = newThreshold;

    // Recalculate low stock flag
    updates.isLowStock = newQty <= newThreshold;

    await docRef.update(updates);
    await logActivity("UPDATE", req.params.id, current.name, req.user.uid, updates);

    res.json({ success: true, message: "Item updated successfully", data: { id: req.params.id, ...updates } });
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

    await docRef.update({
      status: "deleted",
      deletedBy: req.user.uid,
      deletedAt: FieldValue.serverTimestamp(),
    });

    await logActivity("DELETE", req.params.id, doc.data().name, req.user.uid);

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
    const { adjustment, reason } = req.body;
    const adjustmentInt = parseInt(adjustment);
    const docRef = db.collection(COLLECTION).doc(req.params.id);

    const result = await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);

      if (!doc.exists || doc.data().status === "deleted") {
        throw { code: 404, message: "Item not found" };
      }

      const current = doc.data();
      const newQuantity = current.quantity + adjustmentInt;

      if (newQuantity < 0) {
        throw { code: 400, message: `Insufficient stock. Current: ${current.quantity}, Adjustment: ${adjustmentInt}` };
      }

      const isLowStock = newQuantity <= current.lowStockThreshold;

      transaction.update(docRef, {
        quantity: newQuantity,
        isLowStock,
        updatedBy: req.user.uid,
        updatedAt: FieldValue.serverTimestamp(),
      });

      return { newQuantity, isLowStock, itemName: current.name };
    });

    await logActivity("STOCK_ADJUST", req.params.id, result.itemName, req.user.uid, {
      adjustment: adjustmentInt,
      reason,
      newQuantity: result.newQuantity,
    });

    res.json({
      success: true,
      message: `Stock adjusted by ${adjustmentInt > 0 ? "+" : ""}${adjustmentInt}`,
      data: {
        newQuantity: result.newQuantity,
        isLowStock: result.isLowStock,
        ...(result.isLowStock && { alert: "⚠️ Item is below low stock threshold!" }),
      },
    });
  } catch (error) {
    if (error.code === 404) return res.status(404).json({ success: false, message: error.message });
    if (error.code === 400) return res.status(400).json({ success: false, message: error.message });
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

module.exports = { createItem, getAllItems, getItemById, updateItem, deleteItem, adjustStock, getLowStockItems, getItemLogs };
