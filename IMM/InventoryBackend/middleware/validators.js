const { body, param, query, validationResult } = require("express-validator");

// Reusable handler to return validation errors
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

// ─── Auth Validators ──────────────────────────────────────────────────────────

const loginValidator = [
  body("email").isEmail().normalizeEmail().withMessage("Valid email required"),
  body("password").notEmpty().withMessage("Password is required"),
  validate,
];

const registerValidator = [
  body("email").isEmail().normalizeEmail().withMessage("Valid email required"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters")
    .matches(/[A-Z]/)
    .withMessage("Password must contain an uppercase letter")
    .matches(/[0-9]/)
    .withMessage("Password must contain a number"),
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ max: 60 })
    .withMessage("Name too long"),
  body("role")
    .optional()
    .isIn(["admin", "manager", "staff"])
    .withMessage("Role must be admin, manager, or staff"),
  validate,
];

// ─── Inventory Item Validators ────────────────────────────────────────────────

const createItemValidator = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Item name is required")
    .isLength({ max: 100 })
    .withMessage("Item name too long"),
  body("sku")
    .optional({ values: "falsy" })
    .trim()
    .matches(/^[a-zA-Z0-9-]*$/)
    .withMessage("SKU must contain only letters, numbers, and hyphens"),
  body("category")
    .trim()
    .notEmpty()
    .withMessage("Category is required")
    .isIn(["beans", "milk", "syrup", "packaging", "equipment", "add-ins", "powder", "other"])
    .withMessage("Invalid category"),
  body("quantity")
    .isInt({ min: 0 })
    .withMessage("Quantity must be a non-negative integer"),
  body("unit")
    .trim()
    .notEmpty()
    .withMessage("Unit is required (e.g. kg, pcs, liters)"),
  body("lowStockThreshold")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Low stock threshold must be a non-negative integer"),
  body("costPrice")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Cost price must be a non-negative number"),
  body("supplier").optional().trim().isLength({ max: 100 }),
  validate,
];

const updateItemValidator = [
  param("id").notEmpty().withMessage("Item ID is required"),
  body("name").optional().trim().isLength({ max: 100 }),
  body("category")
    .optional()
    .isIn(["beans", "milk", "syrup", "packaging", "equipment", "add-ins", "powder", "other"]),
  body("quantity").optional().isInt({ min: 0 }),
  body("unit").optional().trim().notEmpty(),
  body("lowStockThreshold").optional().isInt({ min: 0 }),
  body("costPrice").optional().isFloat({ min: 0 }),
  body("supplier").optional().trim().isLength({ max: 100 }),
  validate,
];

const adjustStockValidator = [
  param("id").notEmpty().withMessage("Item ID is required"),
  body("adjustment")
    .isInt()
    .withMessage("Adjustment must be an integer (positive to add, negative to deduct)"),
  body("reason")
    .trim()
    .notEmpty()
    .withMessage("Reason for adjustment is required")
    .isLength({ max: 200 }),
  validate,
];

const idParamValidator = [
  param("id").notEmpty().withMessage("ID parameter is required"),
  validate,
];

module.exports = {
  loginValidator,
  registerValidator,
  createItemValidator,
  updateItemValidator,
  adjustStockValidator,
  idParamValidator,
};
