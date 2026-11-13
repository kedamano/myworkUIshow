import { supabase } from "@/integrations/supabase/client";
import { audit, getCurrentStaff } from "@/lib/audit";

const sanitize = (value = "") => String(value).replace(/[,%()]/g, " ").trim();

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const startOfDaysAgo = (days) => {
  const d = startOfToday();
  d.setDate(d.getDate() - (days - 1));
  return d;
};

const productStatusFor = (stock, currentStatus, safetyStock = 50) => {
  if (currentStatus === "inactive") return "inactive";
  if (stock <= 0) return "out_of_stock";
  if (stock < Math.max(1, Number(safetyStock) || 0)) return "low_stock";
  return "active";
};

/* ==================== 订单 ==================== */

export const fetchOrders = async ({ status = "all", search = "", page = 1, pageSize = 10 } = {}) => {
  const from = (page - 1) * pageSize;
  let query = supabase.from("orders").select("*", { count: "exact" });

  if (status !== "all") query = query.eq("status", status);

  const keyword = sanitize(search);
  if (keyword) {
    query = query.or(
      `order_no.ilike.%${keyword}%,customer_name.ilike.%${keyword}%,phone.ilike.%${keyword}%`
    );
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) throw error;
  return { data: data || [], total: count || 0 };
};

export const fetchRecentOrders = async (limit = 50) => {
  const { data, error } = await supabase
    .from("orders")
    .select("id,order_no,customer_name,amount,status,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
};

export const fetchOrderStatusCounts = async () => {
  const keys = ["pending", "processing", "shipped", "delivered", "cancelled"];
  const results = await Promise.all(
    keys.map((key) =>
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", key)
    )
  );
  const counts = { all: 0 };
  results.forEach((res, index) => {
    if (res.error) throw res.error;
    counts[keys[index]] = res.count || 0;
    counts.all += res.count || 0;
  });
  return counts;
};

export const fetchTodayOrderSummary = async () => {
  const { data, error } = await supabase
    .from("orders")
    .select("amount,status")
    .gte("created_at", startOfToday().toISOString());
  if (error) throw error;
  const rows = data || [];
  return {
    orders: rows.length,
    revenue: rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
  };
};

const ORDER_STATUS_LABEL = {
  pending: "待处理",
  processing: "处理中",
  shipped: "已发货",
  delivered: "已送达",
  cancelled: "已取消",
};

export const ORDER_TRANSITIONS = {
  pending: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

export const canTransitionOrder = (from, to) =>
  Array.isArray(ORDER_TRANSITIONS[from]) && ORDER_TRANSITIONS[from].includes(to);

const assertOrderTransition = (from, to) => {
  if (!canTransitionOrder(from, to)) {
    throw new Error(
      `订单状态不能从「${ORDER_STATUS_LABEL[from] || from}」直接变为「${ORDER_STATUS_LABEL[to] || to}」`
    );
  }
};

/** 写入订单状态变更历史 */
const logOrderStatus = async (orderId, fromStatus, toStatus, operator, remark) => {
  try {
    await supabase.from("order_status_logs").insert([{
      order_id: orderId,
      from_status: fromStatus,
      to_status: toStatus,
      operator: operator || getCurrentStaff(),
      remark: remark || null,
    }]);
  } catch (error) {
    console.error("写入订单状态历史失败", error);
  }
};

export const updateOrderStatus = async (orderId, newStatus) => {
  const { data: current, error: fetchError } = await supabase
    .from("orders")
    .select("id,status,order_no")
    .eq("id", orderId)
    .single();
  if (fetchError) throw fetchError;
  assertOrderTransition(current.status, newStatus);

  // 条件更新：仅当状态仍未被其他操作改动时才落库，避免并发覆盖
  const { data, error } = await supabase
    .from("orders")
    .update({ status: newStatus })
    .eq("id", orderId)
    .eq("status", current.status)
    .select("id,status,order_no");
  if (error) throw error;
  if (!data || !data.length) {
    throw new Error("订单状态已被其他操作更新，请刷新后重试");
  }

  await logOrderStatus(orderId, current.status, newStatus);
  await audit({
    module: "订单",
    action: "状态变更",
    target: current.order_no,
    detail: `${ORDER_STATUS_LABEL[current.status] || current.status} → ${ORDER_STATUS_LABEL[newStatus] || newStatus}`,
  });
  return data[0];
};

export const updateOrder = async (orderId, patch) => {
  const { data: currentRow, error: currentError } = await supabase
    .from("orders")
    .select("id,status,order_no,tracking_no,remark")
    .eq("id", orderId)
    .maybeSingle();
  if (currentError) throw currentError;

  if (!currentRow) throw new Error("订单不存在或已被删除");
  if (patch.status) {
    assertOrderTransition(currentRow.status, patch.status);
  }

  // 条件更新：状态变更仅在校验时的状态仍未被改动时才落库
  let query = supabase.from("orders").update(patch).eq("id", orderId);
  if (patch.status) {
    query = query.eq("status", currentRow.status);
  }
  const { data, error } = await query.select().maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error("订单已被其他操作更新，请刷新后重试");
  }

  if (patch.status) {
    await logOrderStatus(orderId, currentRow.status, patch.status);
    await audit({
      module: "订单",
      action: "状态变更",
      target: currentRow.order_no,
      detail: `${ORDER_STATUS_LABEL[currentRow.status] || currentRow.status} → ${
        ORDER_STATUS_LABEL[patch.status] || patch.status
      }`,
    });
  } else if (patch.tracking_no !== undefined || patch.remark !== undefined) {
    const changes = [];
    if (
      patch.tracking_no !== undefined &&
      (patch.tracking_no || null) !== (currentRow.tracking_no || null)
    ) {
      changes.push(`运单号 ${currentRow.tracking_no || "无"} → ${patch.tracking_no || "无"}`);
    }
    if (patch.remark !== undefined && (patch.remark || null) !== (currentRow.remark || null)) {
      changes.push("更新备注");
    }
    if (changes.length) {
      await audit({ module: "订单", action: "编辑订单", target: currentRow.order_no, detail: changes.join(" · ") });
    }
  }

  return data;
};

export const bulkUpdateOrders = async (orderIds, patch) => {
  if (!orderIds.length) return [];
  let currentRows = [];
  if (patch.status) {
    const { data, error: fetchError } = await supabase
      .from("orders")
      .select("id,order_no,status")
      .in("id", orderIds);
    if (fetchError) throw fetchError;
    currentRows = data || [];
    const invalid = currentRows.find((row) => !canTransitionOrder(row.status, patch.status));
    if (invalid) {
      throw new Error(
        `订单 ${invalid.order_no} 当前为「${ORDER_STATUS_LABEL[invalid.status] || invalid.status}」，不能直接变为「${ORDER_STATUS_LABEL[patch.status] || patch.status}」`
      );
    }
  }

  // 条件更新：仅更新仍处于校验时状态的订单，避免并发覆盖
  let query = supabase.from("orders").update(patch).in("id", orderIds);
  if (patch.status) {
    const fromStatuses = [...new Set(currentRows.map((row) => row.status))];
    if (fromStatuses.length) query = query.in("status", fromStatuses);
  }
  const { data, error } = await query.select();
  if (error) throw error;

  if (patch.status) {
    const statusMap = new Map(currentRows.map((r) => [r.id, r.status]));
    for (const row of data || []) {
      await logOrderStatus(row.id, statusMap.get(row.id), patch.status);
    }
    await audit({
      module: "订单",
      action: "批量状态变更",
      target: `${(data || []).length} 笔订单`,
      detail: `批量变更为「${ORDER_STATUS_LABEL[patch.status] || patch.status}」`,
    });
  }
  return data || [];
};

/* ==================== 商品 ==================== */

export const fetchProducts = async ({
  search = "",
  category = "all",
  status = "all",
  page = 1,
  pageSize = 10,
} = {}) => {
  const from = (page - 1) * pageSize;
  let query = supabase.from("products").select("*", { count: "exact" });

  const keyword = sanitize(search);
  if (keyword) query = query.ilike("name", `%${keyword}%`);
  if (category !== "all") query = query.eq("category", category);
  if (status !== "all") query = query.eq("status", status);

  const { data, error, count } = await query
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true })
    .range(from, from + pageSize - 1);

  if (error) throw error;
  return { data: data || [], total: count || 0 };
};

export const fetchProductOptions = async () => {
  const { data, error } = await supabase
    .from("products")
    .select("id,name,price,stock,category")
    .order("name");
  if (error) throw error;
  return data || [];
};

export const fetchCategories = async () => {
  const { data, error } = await supabase.from("products").select("category");
  if (error) throw error;
  return [...new Set((data || []).map((item) => item.category).filter(Boolean))];
};

export const fetchProductStats = async () => {
  const { data, error } = await supabase.from("products").select("stock,status,sales");
  if (error) throw error;
  const rows = data || [];
  return {
    total: rows.length,
    active: rows.filter((row) => row.status === "active").length,
    alert: rows.filter((row) => row.status === "low_stock" || row.status === "out_of_stock").length,
    stock: rows.reduce((sum, row) => sum + (row.stock || 0), 0),
    sales: rows.reduce((sum, row) => sum + (row.sales || 0), 0),
  };
};

export const createProduct = async (payload) => {
  const stock = Number(payload.stock) || 0;
  const record = {
    ...payload,
    stock,
    price: Number(payload.price) || 0,
    cost: Number(payload.cost) || 0,
    sales: 0,
    status: productStatusFor(stock, payload.status),
    sort_order: Number(payload.sort_order) || 999,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from("products").insert([record]).select().single();
  if (error) throw error;

  if (stock > 0) {
    await supabase.from("stock_logs").insert([
      {
        product_id: data.id,
        product_name: data.name,
        type: "in",
        quantity: stock,
        before_stock: 0,
        after_stock: stock,
        operator: getCurrentStaff(),
        remark: "新建商品初始入库",
      },
    ]);
  }

  await audit({
    module: "商品",
    action: "新建商品",
    target: data.name,
    detail: `售价 ¥${record.price} · 初始库存 ${stock}`,
  });
  return data;
};

export const updateProduct = async (productId, patch) => {
  const next = { ...patch, updated_at: new Date().toISOString() };
  if (next.price !== undefined) next.price = Number(next.price) || 0;
  if (next.cost !== undefined) next.cost = Number(next.cost) || 0;
  if (next.stock !== undefined) {
    next.stock = Number(next.stock) || 0;
    next.status = productStatusFor(next.stock, next.status);
  }
  const { data, error } = await supabase
    .from("products")
    .update(next)
    .eq("id", productId)
    .select()
    .single();
  if (error) throw error;

  const changes = [];
  if (patch.price !== undefined) changes.push(`售价 ¥${next.price}`);
  if (patch.cost !== undefined) changes.push(`成本 ¥${next.cost}`);
  if (patch.stock !== undefined) changes.push(`库存 ${next.stock}`);
  if (patch.status !== undefined) changes.push(`状态 ${patch.status}`);
  if (changes.length) {
    await audit({ module: "商品", action: "编辑商品", target: data.name, detail: changes.join(" · ") });
  }
  return data;
};

export const deleteProducts = async (productIds) => {
  if (!productIds.length) return true;

  const { data: targets, error: fetchError } = await supabase
    .from("products")
    .select("id,name")
    .in("id", productIds);
  if (fetchError) throw fetchError;
  const names = (targets || []).map((item) => item.name);

  const { data: relatedOrders, error: orderError } = await supabase
    .from("orders")
    .select("id,order_no,products")
    .in("status", ["pending", "processing", "shipped"]);
  if (orderError) throw orderError;

  const blocked = (relatedOrders || []).find(
    (order) => Array.isArray(order.products) && order.products.some((name) => names.includes(name))
  );
  if (blocked) {
    const matched = (blocked.products || []).find((name) => names.includes(name));
    throw new Error(`商品「${matched}」已被订单 ${blocked.order_no} 引用，请先处理该订单`);
  }

  const { error } = await supabase.from("products").delete().in("id", productIds);
  if (error) throw error;

  await audit({
    module: "商品",
    action: "删除商品",
    target: names.join("、"),
    detail: `共 ${productIds.length} 个商品`,
  });
  return true;
};

export const bulkUpdateProductStatus = async (productIds, status) => {
  if (!productIds.length) return [];
  const { data, error } = await supabase
    .from("products")
    .update({ status, updated_at: new Date().toISOString() })
    .in("id", productIds)
    .select();
  if (error) throw error;

  await audit({
    module: "商品",
    action: "批量上下架",
    target: `${productIds.length} 个商品`,
    detail: status === "active" ? "批量上架" : "批量下架",
  });
  return data || [];
};

export const updateProductOrder = async (productId, sortOrder) => {
  const { error } = await supabase
    .from("products")
    .update({ sort_order: sortOrder })
    .eq("id", productId);
  if (error) throw error;
  return true;
};

export const adjustStock = async (productId, delta, remark = "手动调整库存") => {
  const { data, error } = await supabase.rpc("adjust_stock", {
    p_product_id: productId,
    p_delta: delta,
    p_remark: remark,
  });
  if (error) throw error;
  return data;
};

export const adjustSkuStock = async (skuId, delta, remark = "手动调整库存") => {
  const { data, error } = await supabase.rpc("adjust_sku_stock", {
    p_sku_id: skuId,
    p_delta: delta,
    p_remark: remark,
  });
  if (error) throw error;
  return data;
};

/* ==================== SKU 多规格 ==================== */

export const SKU_STATUS = {
  active: { label: "在售", color: "#15803d", bg: "#f0fdf4" },
  inactive: { label: "已停用", color: "#525252", bg: "#f4f4f4" },
};

export const specText = (specs) => {
  if (!specs || typeof specs !== "object") return "";
  return Object.entries(specs)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}:${value}`)
    .join(" / ");
};

export const fetchProductSkus = async (productId) => {
  const { data, error } = await supabase
    .from("product_skus")
    .select("*")
    .eq("product_id", productId)
    .order("id", { ascending: true });
  if (error) throw error;
  return data || [];
};

export const fetchAllSkus = async () => {
  const { data, error } = await supabase
    .from("product_skus")
    .select("id,product_id,sku_code,specs,price,stock,status");
  if (error) throw error;
  return data || [];
};

const normalizeSpecs = (specs) => {
  if (Array.isArray(specs)) {
    return specs.reduce((acc, item) => {
      const key = String(item?.key || "").trim();
      if (key) acc[key] = item?.value ?? "";
      return acc;
    }, {});
  }
  if (specs && typeof specs === "object") return specs;
  return {};
};

const normalizeSkuRow = (sku, index) => {
  return {
    product_id: sku.product_id,
    sku_code: String(sku.sku_code || `SKU-${index + 1}`).trim(),
    specs: normalizeSpecs(sku.specs),
    price: sku.price === "" || sku.price === null || sku.price === undefined ? null : Number(sku.price),
    stock: Math.max(0, Number(sku.stock) || 0),
    status: sku.status || "active",
  };
};

/**
 * 保存商品规格：按 sku_code 比对，已存在的走 update（保留 id，订单明细引用不断），
 * 新增的走 insert（编码全局唯一，重复会报错）。
 */
export const saveProductSkus = async (productId, skus) => {
  const { data: existing, error: listError } = await supabase
    .from("product_skus")
    .select("id,sku_code")
    .eq("product_id", productId);
  if (listError) throw listError;

  const rows = (skus || [])
    .filter((sku) => String(sku.sku_code || "").trim() || Object.keys(sku.specs || {}).length)
    .map(normalizeSkuRow);

  const seen = new Set();
  const uniqueRows = rows.filter((row) => {
    if (!row.sku_code || seen.has(row.sku_code)) return false;
    seen.add(row.sku_code);
    return true;
  });

  const existingMap = new Map((existing || []).map((row) => [row.sku_code, row.id]));
  const nextCodes = new Set(uniqueRows.map((row) => row.sku_code));

  const toDelete = (existing || []).filter((row) => !nextCodes.has(row.sku_code)).map((row) => row.id);
  if (toDelete.length) {
    const { error } = await supabase.from("product_skus").delete().in("id", toDelete);
    if (error) throw error;
  }

  const toUpdate = uniqueRows.filter((row) => existingMap.has(row.sku_code));
  for (const row of toUpdate) {
    const { error } = await supabase
      .from("product_skus")
      .update({
        specs: row.specs,
        price: row.price,
        stock: row.stock,
        status: row.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingMap.get(row.sku_code));
    if (error) throw error;
  }

  const toInsert = uniqueRows.filter((row) => !existingMap.has(row.sku_code));
  if (toInsert.length) {
    const { error } = await supabase.from("product_skus").insert(toInsert);
    if (error) throw error;
  }

  const totalStock = await syncProductStockFromSkus(productId);

  await audit({
    module: "商品",
    action: "维护规格",
    target: `${uniqueRows.length} 个 SKU`,
    detail:
      uniqueRows.map((row) => `${row.sku_code}（库存 ${row.stock}）`).join("、") ||
      "已清空规格，商品回归单品库存",
  });

  return { saved: uniqueRows.length, totalStock };
};

export const syncProductStockFromSkus = async (productId) => {
  const [
    { data: skus, error: skuError },
    { data: product, error: productError },
  ] = await Promise.all([
    supabase.from("product_skus").select("stock").eq("product_id", productId),
    supabase.from("products").select("status,safety_stock").eq("id", productId).maybeSingle(),
  ]);
  if (skuError) throw skuError;
  if (productError) throw productError;

  const total = (skus || []).reduce((sum, row) => sum + (Number(row.stock) || 0), 0);
  const status = productStatusFor(total, product?.status, product?.safety_stock);
  const { error } = await supabase
    .from("products")
    .update({ stock: total, status, updated_at: new Date().toISOString() })
    .eq("id", productId);
  if (error) throw error;
  return total;
};

/* ==================== 采购补货 ==================== */

export const PURCHASE_STATUS = {
  pending: { label: "待收货", color: "#b45309", bg: "#fffbeb" },
  received: { label: "已入库", color: "#15803d", bg: "#f0fdf4" },
  cancelled: { label: "已取消", color: "#525252", bg: "#f4f4f4" },
};

const LOCK_ORDER_STATUSES = ["pending", "processing"];

const generatePoNo = () => {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PO-${stamp}-${rand}`;
};

const poName = (row) => {
  const product = row?.products?.name || `商品 #${row?.product_id ?? "-"}`;
  const sku = row?.product_skus?.sku_code;
  return sku ? `${product} / ${sku}` : product;
};

const skuLabelOf = (sku) => {
  if (!sku) return "";
  const spec = specText(sku.specs);
  return `${sku.sku_code || "SKU"}${spec ? `（${spec}）` : ""}`;
};

const toNumberOrNull = (value) =>
  value === "" || value === null || value === undefined ? null : Number(value);

export const fetchPurchaseOrders = async ({
  status = "all",
  search = "",
  page = 1,
  pageSize = 10,
} = {}) => {
  const from = (page - 1) * pageSize;
  let query = supabase
    .from("purchase_orders")
    .select("*,products(name),product_skus(sku_code,specs)", { count: "exact" });

  if (status !== "all") query = query.eq("status", status);
  const keyword = sanitize(search);
  if (keyword) {
    query = query.or(
      `po_no.ilike.%${keyword}%,supplier.ilike.%${keyword}%,products.name.ilike.%${keyword}%`
    );
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) throw error;
  return { data: data || [], total: count || 0 };
};

export const createPurchaseOrder = async (payload) => {
  const quantity = Number(payload.quantity) || 0;
  if (quantity <= 0) throw new Error("采购数量必须大于 0");

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id,name")
    .eq("id", payload.product_id)
    .maybeSingle();
  if (productError) throw productError;
  if (!product) throw new Error("商品不存在，可能已被删除");

  let skuId = null;
  if (payload.sku_id) {
    const { data: sku, error: skuError } = await supabase
      .from("product_skus")
      .select("id,product_id")
      .eq("id", payload.sku_id)
      .maybeSingle();
    if (skuError) throw skuError;
    if (!sku || String(sku.product_id) !== String(product.id)) {
      throw new Error("所选规格不属于该商品");
    }
    skuId = sku.id;
  }

  const { data, error } = await supabase
    .from("purchase_orders")
    .insert([
      {
        po_no: generatePoNo(),
        product_id: product.id,
        sku_id: skuId,
        quantity,
        unit_cost: toNumberOrNull(payload.unit_cost),
        supplier: String(payload.supplier || "").trim() || null,
        status: "pending",
        expected_at: payload.expected_at || null,
        remark: String(payload.remark || "").trim() || null,
      },
    ])
    .select("*,products(name),product_skus(sku_code,specs)")
    .single();
  if (error) throw error;

  await audit({
    module: "库存",
    action: "新建采购单",
    target: data.po_no,
    detail: `${poName(data)} · 数量 ${quantity}${data.supplier ? ` · 供应商 ${data.supplier}` : ""}`,
  });
  return data;
};

export const updatePurchaseOrder = async (id, patch = {}) => {
  const { data: current, error: fetchError } = await supabase
    .from("purchase_orders")
    .select("id,po_no,status")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!current) throw new Error("采购单不存在");
  if (current.status !== "pending") {
    throw new Error(
      `「${current.po_no}」已${PURCHASE_STATUS[current.status]?.label || current.status}，无法修改`
    );
  }

  const next = {};
  if (patch.quantity !== undefined) {
    const quantity = Number(patch.quantity) || 0;
    if (quantity <= 0) throw new Error("采购数量必须大于 0");
    next.quantity = quantity;
  }
  if (patch.unit_cost !== undefined) next.unit_cost = toNumberOrNull(patch.unit_cost);
  if (patch.supplier !== undefined) next.supplier = String(patch.supplier || "").trim() || null;
  if (patch.expected_at !== undefined) next.expected_at = patch.expected_at || null;
  if (patch.remark !== undefined) next.remark = String(patch.remark || "").trim() || null;

  if (!Object.keys(next).length) return current;

  const { data, error } = await supabase
    .from("purchase_orders")
    .update({ ...next, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*,products(name),product_skus(sku_code,specs)")
    .single();
  if (error) throw error;

  await audit({
    module: "库存",
    action: "修改采购单",
    target: current.po_no,
    detail: Object.keys(next).join("、"),
  });
  return data;
};

export const cancelPurchaseOrder = async (id) => {
  const { data: current, error: fetchError } = await supabase
    .from("purchase_orders")
    .select("id,po_no,status")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!current) throw new Error("采购单不存在");
  if (current.status !== "pending") {
    throw new Error(
      `「${current.po_no}」已${PURCHASE_STATUS[current.status]?.label || current.status}，无法取消`
    );
  }

  const { data, error } = await supabase
    .from("purchase_orders")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("po_no")
    .single();
  if (error) throw error;

  await audit({
    module: "库存",
    action: "取消采购单",
    target: data.po_no,
    detail: "待收货 → 已取消",
  });
  return data;
};

export const deletePurchaseOrder = async (id) => {
  const { data: current, error: fetchError } = await supabase
    .from("purchase_orders")
    .select("id,po_no,status")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!current) return true;
  if (current.status === "received") {
    throw new Error(
      `「${current.po_no}」已入库，删除会留下无单可查的库存流水，如需撤销请使用「撤销入库」`
    );
  }

  const { error } = await supabase.from("purchase_orders").delete().eq("id", id);
  if (error) throw error;

  await audit({
    module: "库存",
    action: "删除采购单",
    target: current.po_no,
    detail: PURCHASE_STATUS[current.status]?.label || current.status,
  });
  return true;
};

/** 采购入库：加库存并写流水，单据状态置为已入库 */
export const receivePurchaseOrder = async (id) => {
  // 先检查采购单状态
  const { data: po, error: fetchError } = await supabase
    .from("purchase_orders")
    .select("id,status,po_no")
    .eq("id", id)
    .single();
  if (fetchError) throw fetchError;
  if (!po) throw new Error("采购单不存在");
  if (po.status !== "pending") {
    throw new Error(`采购单 ${po.po_no} 当前状态为「${po.status}」，只有待收货状态才能入库`);
  }

  const { data, error } = await supabase.rpc("receive_purchase_order", { p_po_id: id });
  if (error) throw error;

  await audit({
    module: "采购",
    action: "采购入库",
    target: po.po_no,
    detail: `已入库`,
  });
  return data;
};

/** 撤销入库：把已入库的数量扣回，单据置为已取消 */
export const reversePurchaseOrder = async (id) => {
  const { data: po, error: fetchError } = await supabase
    .from("purchase_orders")
    .select("id,status,po_no")
    .eq("id", id)
    .single();
  if (fetchError) throw fetchError;
  if (!po) throw new Error("采购单不存在");
  if (po.status !== "received") {
    throw new Error(`采购单 ${po.po_no} 当前状态为「${po.status}」，只有已入库状态才能撤销`);
  }

  const { data, error } = await supabase.rpc("reverse_purchase_order", { p_po_id: id });
  if (error) throw error;

  await audit({
    module: "采购",
    action: "撤销入库",
    target: po.po_no,
    detail: `已撤销入库`,
  });
  return data;
};

/* ==================== 客户 ==================== */

export const fetchCustomers = async ({ search = "", level = "all", page = 1, pageSize = 10 } = {}) => {
  const from = (page - 1) * pageSize;
  let query = supabase.from("customers").select("*", { count: "exact" });

  const keyword = sanitize(search);
  if (keyword) {
    query = query.or(`name.ilike.%${keyword}%,phone.ilike.%${keyword}%,city.ilike.%${keyword}%`);
  }
  if (level !== "all") query = query.eq("level", level);

  const { data, error, count } = await query
    .order("total_spent", { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) throw error;
  return { data: data || [], total: count || 0 };
};

export const fetchCustomerStats = async () => {
  const { data, error } = await supabase
    .from("customers")
    .select("level,total_spent,order_count,created_at");
  if (error) throw error;
  const rows = data || [];
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const repeat = rows.filter((row) => (row.order_count || 0) > 1).length;
  return {
    total: rows.length,
    vip: rows.filter((row) => row.level === "钻石会员" || row.level === "黄金会员").length,
    newThisMonth: rows.filter((row) => new Date(row.created_at) >= monthStart).length,
    repeatRate: rows.length ? (repeat / rows.length) * 100 : 0,
    avgSpent: rows.length
      ? rows.reduce((sum, row) => sum + (Number(row.total_spent) || 0), 0) / rows.length
      : 0,
  };
};

export const fetchCustomerOrders = async (phone) => {
  const { data, error } = await supabase
    .from("orders")
    .select("id,order_no,amount,status,products,created_at")
    .eq("phone", phone)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return data || [];
};

export const updateCustomer = async (customerId, patch) => {
  const { data, error } = await supabase
    .from("customers")
    .update(patch)
    .eq("id", customerId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

/* ==================== 客户等级与积分 ==================== */

export const LEVEL_RULES = [
  { name: "普通会员", min: 0 },
  { name: "白银会员", min: 1000 },
  { name: "黄金会员", min: 3000 },
  { name: "钻石会员", min: 8000 },
];

export const POINTS_PER_YUAN = 1;

export const levelForSpent = (spent) => {
  const value = Number(spent) || 0;
  let matched = LEVEL_RULES[0].name;
  for (const rule of LEVEL_RULES) {
    if (value >= rule.min) matched = rule.name;
  }
  return matched;
};

export const nextLevelRule = (spent) => {
  const value = Number(spent) || 0;
  return LEVEL_RULES.find((rule) => value < rule.min) || null;
};

export const fetchCustomerPointsLogs = async (customerId) => {
  const { data, error } = await supabase
    .from("customer_points_logs")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
};

export const adjustCustomerPoints = async (
  customerId,
  delta,
  { type = "adjust", source = "", orderNo = "", remark = "" } = {}
) => {
  const value = Number(delta) || 0;
  if (!value) return 0;

  const { data: customer, error: fetchError } = await supabase
    .from("customers")
    .select("id,name,points")
    .eq("id", customerId)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!customer) throw new Error("客户不存在");

  const before = Number(customer.points) || 0;
  const after = Math.max(0, before + value);

  const { error } = await supabase
    .from("customers")
    .update({ points: after })
    .eq("id", customerId);
  if (error) throw error;

  await supabase.from("customer_points_logs").insert([
    {
      customer_id: customerId,
      type: value >= 0 ? (type === "sync" ? "sync" : "earn") : "use",
      points: Math.abs(value),
      balance_after: after,
      source: source || null,
      order_no: orderNo || null,
      remark: remark || null,
    },
  ]);

  await audit({
    module: "客户",
    action: value >= 0 ? "积分发放" : "积分扣减",
    target: customer.name,
    detail: `${before} → ${after}（${value >= 0 ? "+" : "-"}${Math.abs(value)}）${
      source ? ` · ${source}` : ""
    }`,
  });

  return after;
};

/**
 * 按累计消费重算所有客户的会员等级与积分（1 元 = 1 积分）。
 * 等级规则变更或历史数据修正后调用。
 */
export const recomputeCustomerLevels = async () => {
  const { data: customers, error } = await supabase
    .from("customers")
    .select("id,name,level,total_spent,points");
  if (error) throw error;

  let levelChanged = 0;
  let pointsChanged = 0;

  for (const row of customers || []) {
    const targetLevel = levelForSpent(row.total_spent);
    const currentPoints = Number(row.points) || 0;
    const targetPoints = Math.max(
      0,
      Math.floor(Number(row.total_spent) || 0) * POINTS_PER_YUAN
    );

    const patch = {};
    if (targetLevel !== row.level) {
      patch.level = targetLevel;
      levelChanged += 1;
    }
    if (targetPoints !== currentPoints) {
      patch.points = targetPoints;
      pointsChanged += 1;
    }
    if (!Object.keys(patch).length) continue;

    const { error: updateError } = await supabase
      .from("customers")
      .update(patch)
      .eq("id", row.id);
    if (updateError) throw updateError;

    if (patch.points !== undefined) {
      await supabase.from("customer_points_logs").insert([
        {
          customer_id: row.id,
          type: "sync",
          points: Math.abs(targetPoints - currentPoints),
          balance_after: targetPoints,
          source: "等级重算",
          remark: `按累计消费 ¥${Number(row.total_spent || 0).toFixed(2)} 重新计算`,
        },
      ]);
    }
  }

  await audit({
    module: "客户",
    action: "重新计算等级",
    target: `${(customers || []).length} 位客户`,
    detail: `等级变更 ${levelChanged} 人 · 积分同步 ${pointsChanged} 人`,
  });

  return { total: (customers || []).length, levelChanged, pointsChanged };
};

/* ==================== 售后 ==================== */

export const fetchAfterSales = async ({ status = "all", search = "", page = 1, pageSize = 10 } = {}) => {
  const from = (page - 1) * pageSize;
  let query = supabase.from("after_sales").select("*", { count: "exact" });

  if (status !== "all") query = query.eq("status", status);
  const keyword = sanitize(search);
  if (keyword) {
    query = query.or(`order_no.ilike.%${keyword}%,customer_name.ilike.%${keyword}%`);
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) throw error;
  return { data: data || [], total: count || 0 };
};

export const fetchAfterSaleStats = async () => {
  const { data, error } = await supabase.from("after_sales").select("status,amount,created_at");
  if (error) throw error;
  const rows = data || [];
  const refunded = rows.filter((row) => row.status === "refunded");
  return {
    total: rows.length,
    pending: rows.filter((row) => row.status === "pending").length,
    approved: rows.filter((row) => row.status === "approved").length,
    refundedAmount: refunded.reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
    refundedCount: refunded.length,
  };
};

const AFTER_SALE_STATUS_LABEL = {
  pending: "待审核",
  approved: "已通过",
  refunded: "已退款",
  rejected: "已驳回",
};

export const createAfterSale = async (payload) => {
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id,order_no,amount,status")
    .eq("order_no", payload.order_no)
    .maybeSingle();
  if (orderError) throw orderError;
  if (!order) throw new Error("找不到对应的订单");

  if (["delivered", "cancelled"].includes(order.status)) {
    throw new Error(`订单当前为「${ORDER_STATUS_LABEL[order.status] || order.status}」，不能发起售后`);
  }

  const amount = Number(payload.amount) || 0;
  if (amount <= 0) throw new Error("退款金额必须大于 0");
  if (amount > Number(order.amount)) {
    throw new Error(`退款金额不能超过订单金额 ¥${Number(order.amount).toFixed(2)}`);
  }

  const { data: existing, error: existError } = await supabase
    .from("after_sales")
    .select("id")
    .eq("order_no", payload.order_no)
    .in("status", ["pending", "approved"])
    .limit(1);
  if (existError) throw existError;
  if ((existing || []).length > 0) {
    throw new Error("该订单已有处理中的售后单，不能重复发起");
  }

  const { data, error } = await supabase.from("after_sales").insert([payload]).select().single();
  if (error) throw error;

  await audit({
    module: "售后",
    action: "发起售后",
    target: payload.order_no,
    detail: `${payload.type === "return" ? "退货退款" : payload.type === "exchange" ? "换货" : "仅退款"} · ¥${amount.toFixed(2)}`,
  });
  return data;
};

export const updateAfterSale = async (id, patch) => {
  // 获取售后单信息（用于库存回补）
  const { data: afterSale, error: fetchError } = await supabase
    .from("after_sales")
    .select("id,order_no,type,status")
    .eq("id", id)
    .single();
  if (fetchError) throw fetchError;

  const { data, error } = await supabase.rpc("update_after_sale", {
    p_id: id,
    p_patch: patch,
  });
  if (error) throw error;

  // 退款完成时，回补库存（仅退货退款类型）
  if (patch.status === "refunded" && afterSale?.type === "return") {
    try {
      const { data: order } = await supabase
        .from("orders")
        .select("products")
        .eq("order_no", afterSale.order_no)
        .single();
      if (order?.products?.length) {
        for (const productName of order.products) {
          const { data: product } = await supabase
            .from("products")
            .select("id,name,stock")
            .eq("name", productName)
            .maybeSingle();
          if (product) {
            await supabase.rpc("adjust_stock", {
              p_product_id: product.id,
              p_delta: 1,
              p_remark: `售后退款回补 · ${afterSale.order_no}`,
            });
          }
        }
      }
    } catch (restockError) {
      console.error("售后退款库存回补失败", restockError);
    }
  }

  await audit({
    module: "售后",
    action: "售后状态变更",
    target: afterSale?.order_no || `#${id}`,
    detail: `状态改为「${patch.status}」`,
  });
  return data;
};

/* ==================== 优惠券 ==================== */

export const fetchCoupons = async () => {
  const { data, error } = await supabase
    .from("coupons")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
};

export const createCoupon = async (payload) => {
  const { data, error } = await supabase.from("coupons").insert([payload]).select().single();
  if (error) throw error;

  await audit({
    module: "营销",
    action: "新建优惠券",
    target: payload.name || payload.code,
    detail: `面额 ${payload.value} · 总量 ${payload.total ?? "不限"}`,
  });
  return data;
};

export const updateCoupon = async (id, patch) => {
  const { data, error } = await supabase
    .from("coupons")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;

  await audit({
    module: "营销",
    action: "更新优惠券",
    target: data.name || data.code,
    detail: patch.status ? `状态改为「${patch.status}」` : "更新券信息",
  });
  return data;
};

/* ==================== 优惠券核销 ==================== */

export const fetchCouponUsages = async ({
  couponId = "",
  search = "",
  page = 1,
  pageSize = 10,
} = {}) => {
  const from = (page - 1) * pageSize;
  let query = supabase
    .from("coupon_usages")
    .select("*,coupons(name,code)", { count: "exact" });

  if (couponId) query = query.eq("coupon_id", couponId);
  const keyword = sanitize(search);
  if (keyword) {
    query = query.or(
      `order_no.ilike.%${keyword}%,customer_name.ilike.%${keyword}%,customer_phone.ilike.%${keyword}%,code.ilike.%${keyword}%`
    );
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) throw error;
  return { data: data || [], total: count || 0 };
};

export const recordCouponUsage = async (payload) => {
  const { data: coupon, error: couponError } = await supabase
    .from("coupons")
    .select("id,name,code,status,used,total,type,value,min_amount,end_at")
    .eq("id", payload.couponId)
    .maybeSingle();
  if (couponError) throw couponError;
  if (!coupon) throw new Error("优惠券不存在");
  if (coupon.status !== "active") throw new Error("该优惠券未启用，无法核销");
  if (coupon.end_at && new Date(coupon.end_at) < new Date()) {
    throw new Error("该优惠券已过有效期，无法核销");
  }
  if (Number(coupon.total) > 0 && (Number(coupon.used) || 0) >= Number(coupon.total)) {
    throw new Error("该优惠券已发放完毕，无法继续核销");
  }

  const orderAmount = Number(payload.order_amount) || 0;
  const minAmount = Number(coupon.min_amount) || 0;
  if (orderAmount <= 0) throw new Error("请填写订单金额");
  if (orderAmount < minAmount) {
    throw new Error(`订单金额未达到使用门槛 ¥${minAmount}`);
  }

  const rawDiscount =
    coupon.type === "discount"
      ? orderAmount * (1 - (Number(coupon.value) || 10) / 10)
      : Math.min(Number(coupon.value) || 0, orderAmount);
  const discount = Math.round(rawDiscount * 100) / 100;
  if (discount <= 0) throw new Error("优惠金额计算为 0，无法核销");

  const { data: usage, error } = await supabase
    .from("coupon_usages")
    .insert([
      {
        coupon_id: coupon.id,
        code: coupon.code || coupon.name,
        order_no: String(payload.order_no || "").trim(),
        customer_name: String(payload.customer_name || "").trim() || null,
        customer_phone: String(payload.customer_phone || "").trim() || null,
        order_amount: orderAmount,
        discount_amount: discount,
      },
    ])
    .select()
    .single();
  if (error) throw error;

  await supabase
    .from("coupons")
    .update({ used: (Number(coupon.used) || 0) + 1 })
    .eq("id", coupon.id);

  // 核销的同时按订单金额给客户补记积分（1 元 = 1 积分）
  const phone = String(payload.customer_phone || "").trim();
  if (phone) {
    const { data: customer } = await supabase
      .from("customers")
      .select("id,name,points")
      .eq("phone", phone)
      .maybeSingle();
    if (customer) {
      const before = Number(customer.points) || 0;
      const earned = Math.max(1, Math.floor(orderAmount) * POINTS_PER_YUAN);
      await supabase.from("customers").update({ points: before + earned }).eq("id", customer.id);
      await supabase.from("customer_points_logs").insert([
        {
          customer_id: customer.id,
          type: "earn",
          points: earned,
          balance_after: before + earned,
          source: "订单积分",
          order_no: usage.order_no,
          remark: `核销订单金额 ¥${orderAmount.toFixed(2)}`,
        },
      ]);
    }
  }

  await audit({
    module: "营销",
    action: "核销优惠券",
    target: coupon.name || coupon.code,
    detail: `订单 ${usage.order_no || "-"} · 优惠 ¥${discount.toFixed(2)}`,
  });

  return usage;
};

export const deleteCouponUsage = async (id) => {
  const { data: usage, error: fetchError } = await supabase
    .from("coupon_usages")
    .select("id,coupon_id,code,order_no")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!usage) return true;

  const { error } = await supabase.from("coupon_usages").delete().eq("id", id);
  if (error) throw error;

  if (usage.coupon_id) {
    const { data: coupon } = await supabase
      .from("coupons")
      .select("id,used")
      .eq("id", usage.coupon_id)
      .maybeSingle();
    if (coupon) {
      await supabase
        .from("coupons")
        .update({ used: Math.max(0, (Number(coupon.used) || 0) - 1) })
        .eq("id", coupon.id);
    }
  }

  await audit({
    module: "营销",
    action: "删除核销记录",
    target: usage.code || usage.order_no || `#${usage.id}`,
    detail: usage.order_no ? `订单 ${usage.order_no}` : "核销记录",
  });
  return true;
};

/* ==================== 库存 ==================== */

export const fetchStockLogs = async ({ search = "", page = 1, pageSize = 10 } = {}) => {
  const from = (page - 1) * pageSize;
  let query = supabase.from("stock_logs").select("*", { count: "exact" });

  const keyword = sanitize(search);
  if (keyword) query = query.ilike("product_name", `%${keyword}%`);

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) throw error;
  return { data: data || [], total: count || 0 };
};

export const fetchInventoryOverview = async () => {
  const [{ data: rows, error }, { data: inbound, error: inboundError }] = await Promise.all([
    supabase.from("products").select("stock,status,safety_stock"),
    supabase
      .from("stock_logs")
      .select("quantity,type")
      .eq("type", "in")
      .gte("created_at", startOfDaysAgo(30).toISOString()),
  ]);
  if (error) throw error;
  if (inboundError) throw inboundError;

  const products = rows || [];
  return {
    totalStock: products.reduce((sum, row) => sum + (row.stock || 0), 0),
    lowStock: products.filter(
      (row) => row.stock > 0 && row.stock < (Number(row.safety_stock) || 0)
    ).length,
    outOfStock: products.filter((row) => (row.stock || 0) <= 0).length,
    inbound30d: (inbound || []).reduce((sum, row) => sum + (row.quantity || 0), 0),
  };
};

/**
 * 库存占用：未发货订单（待处理 / 处理中）的明细会锁定对应商品的库存。
 * 可用 = 实际库存 - 锁定，用于库存页展示与超卖判断。
 */
export const fetchStockWithLock = async () => {
  const [{ data: products, error: productError }, { data: openOrders, error: orderError }] =
    await Promise.all([
      supabase
        .from("products")
        .select("id,name,stock,safety_stock,status")
        .order("id", { ascending: true }),
      supabase
        .from("orders")
        .select("id")
        .in("status", LOCK_ORDER_STATUSES)
        .limit(2000),
    ]);
  if (productError) throw productError;
  if (orderError) throw orderError;

  const orderIds = (openOrders || []).map((row) => row.id);
  const { data: items, error: itemError } = orderIds.length
    ? await supabase.from("order_items").select("product_id,quantity").in("order_id", orderIds)
    : { data: [], error: null };
  if (itemError) throw itemError;

  const lockedMap = {};
  for (const item of items || []) {
    if (!item.product_id) continue;
    lockedMap[item.product_id] =
      (lockedMap[item.product_id] || 0) + (Number(item.quantity) || 0);
  }

  return (products || []).map((row) => {
    const stock = Number(row.stock) || 0;
    const locked = lockedMap[row.id] || 0;
    const safety = Number(row.safety_stock) || 0;
    return {
      ...row,
      stock,
      locked,
      available: Math.max(0, stock - locked),
      safety,
      belowSafety: stock < safety,
    };
  });
};

/* ==================== 分析 ==================== */

export const fetchAnalytics = async (days = 30) => {
  const since = startOfDaysAgo(days);
  const sinceDate = since.toISOString().slice(0, 10);

  const [ordersRes, productsRes, dailyRes, afterSalesRes] = await Promise.all([
    supabase
      .from("orders")
      .select("id,amount,status,province,created_at,products")
      .gte("created_at", since.toISOString()),
    supabase.from("products").select("id,name,category,price,sales,stock"),
    supabase
      .from("daily_stats")
      .select("stat_date,revenue,orders_count,visitors,new_users")
      .gte("stat_date", sinceDate)
      .order("stat_date"),
    supabase
      .from("after_sales")
      .select("amount,status,created_at")
      .gte("created_at", since.toISOString()),
  ]);

  [ordersRes, productsRes, dailyRes, afterSalesRes].forEach((res) => {
    if (res.error) throw res.error;
  });

  const orders = ordersRes.data || [];
  const products = productsRes.data || [];
  const daily = dailyRes.data || [];
  const afterSales = afterSalesRes.data || [];

  const validOrders = orders.filter((order) => order.status !== "cancelled");
  const revenue = validOrders.reduce((sum, order) => sum + (Number(order.amount) || 0), 0);
  const visitors = daily.reduce((sum, row) => sum + (row.visitors || 0), 0);
  const refundedAmount = afterSales
    .filter((row) => row.status === "refunded")
    .reduce((sum, row) => sum + (Number(row.amount) || 0), 0);

  const dayMap = new Map();
  for (let i = 0; i < days; i += 1) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    dayMap.set(key, { key, date: `${d.getMonth() + 1}/${d.getDate()}`, revenue: 0, orders: 0 });
  }
  validOrders.forEach((order) => {
    const key = new Date(order.created_at).toISOString().slice(0, 10);
    const bucket = dayMap.get(key);
    if (bucket) {
      bucket.revenue += Number(order.amount) || 0;
      bucket.orders += 1;
    }
  });
  const trend = [...dayMap.values()];

  const categoryMap = new Map();
  products.forEach((product) => {
    const name = product.category || "未分类";
    const amount = (Number(product.price) || 0) * (Number(product.sales) || 0);
    const bucket = categoryMap.get(name) || { name, value: 0, sales: 0 };
    bucket.value += amount;
    bucket.sales += Number(product.sales) || 0;
    categoryMap.set(name, bucket);
  });
  const colors = ["#0f62fe", "#2563eb", "#7c3aed", "#0d9488", "#f59e0b", "#dc2626"];
  const category = [...categoryMap.values()]
    .sort((a, b) => b.value - a.value)
    .map((item, index) => ({ ...item, color: colors[index % colors.length] }));

  const provinceMap = new Map();
  validOrders.forEach((order) => {
    const name = order.province || "其他";
    const bucket = provinceMap.get(name) || { name, revenue: 0, orders: 0 };
    bucket.revenue += Number(order.amount) || 0;
    bucket.orders += 1;
    provinceMap.set(name, bucket);
  });
  const provinces = [...provinceMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8);

  const weekdays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  const heatmap = weekdays.map((label) => ({ label, hours: Array.from({ length: 24 }, () => 0) }));
  validOrders.forEach((order) => {
    const d = new Date(order.created_at);
    const weekday = (d.getDay() + 6) % 7;
    heatmap[weekday].hours[d.getHours()] += 1;
  });

  const topProducts = [...products]
    .sort((a, b) => (b.sales || 0) - (a.sales || 0))
    .slice(0, 8)
    .map((product) => ({
      ...product,
      revenue: (Number(product.price) || 0) * (Number(product.sales) || 0),
    }));

  return {
    summary: {
      revenue,
      orders: validOrders.length,
      avgOrder: validOrders.length ? revenue / validOrders.length : 0,
      visitors,
      conversion: visitors ? (validOrders.length / visitors) * 100 : 0,
      refundRate: revenue ? (refundedAmount / revenue) * 100 : 0,
      refundedAmount,
    },
    trend,
    category,
    provinces,
    heatmap,
    topProducts,
  };
};

/* ==================== 仪表盘 ==================== */

export const fetchDashboard = async () => {
  const since = startOfDaysAgo(30);
  const today = startOfToday().toISOString();

  const [
    dailyRes,
    ordersRes,
    productsRes,
    afterSalesRes,
    logsRes,
    customersRes,
    couponsRes,
    recentRes,
    pendingOrdersRes,
    pendingAfterSalesRes,
  ] = await Promise.all([
    supabase
      .from("daily_stats")
      .select("stat_date,visitors")
      .gte("stat_date", since.toISOString().slice(0, 10))
      .order("stat_date"),
    supabase
      .from("orders")
      .select("id,amount,status,created_at")
      .gte("created_at", since.toISOString())
      .limit(5000),
    supabase.from("products").select("id,name,category,price,sales,stock,status"),
    supabase
      .from("after_sales")
      .select("id,order_no,customer_name,type,amount,status,created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("stock_logs")
      .select("id,product_name,type,quantity,created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("customers").select("level,total_spent,order_count,created_at"),
    supabase.from("coupons").select("id,name,status,end_at,total,used"),
    supabase
      .from("orders")
      .select("id,order_no,customer_name,amount,status,created_at")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase
      .from("after_sales")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);

  [
    dailyRes,
    ordersRes,
    productsRes,
    afterSalesRes,
    logsRes,
    customersRes,
    couponsRes,
    recentRes,
    pendingOrdersRes,
    pendingAfterSalesRes,
  ].forEach((res) => {
    if (res.error) throw res.error;
  });

  const daily = dailyRes.data || [];
  const orders = ordersRes.data || [];
  const recentOrders = recentRes.data || [];
  const products = productsRes.data || [];
  const afterSales = afterSalesRes.data || [];
  const logs = logsRes.data || [];
  const customers = customersRes.data || [];
  const coupons = couponsRes.data || [];

  const validOrders = orders.filter((order) => order.status !== "cancelled");
  const todayOrders = validOrders.filter((order) => order.created_at >= today);

  const dayMap = new Map();
  for (let i = 0; i < 30; i += 1) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    dayMap.set(key, {
      key,
      date: `${d.getMonth() + 1}/${d.getDate()}`,
      revenue: 0,
      orders: 0,
      visitors: 0,
    });
  }
  validOrders.forEach((order) => {
    const bucket = dayMap.get(new Date(order.created_at).toISOString().slice(0, 10));
    if (bucket) {
      bucket.revenue += Number(order.amount) || 0;
      bucket.orders += 1;
    }
  });
  daily.forEach((row) => {
    const bucket = dayMap.get(String(row.stat_date).slice(0, 10));
    if (bucket) bucket.visitors = Number(row.visitors) || 0;
  });
  const trend = [...dayMap.values()];

  const topProducts = [...products]
    .sort((a, b) => (b.sales || 0) - (a.sales || 0))
    .slice(0, 5)
    .map((product) => ({
      ...product,
      revenue: (Number(product.price) || 0) * (Number(product.sales) || 0),
    }));

  const levelMap = new Map();
  customers.forEach((customer) => {
    levelMap.set(customer.level || "普通会员", (levelMap.get(customer.level || "普通会员") || 0) + 1);
  });
  const levelColors = {
    钻石会员: "#6d28d9",
    黄金会员: "#f59e0b",
    白银会员: "#94a3b8",
    普通会员: "#cbd5e1",
  };
  const levelDistribution = [...levelMap.entries()].map(([name, value]) => ({
    name,
    value,
    color: levelColors[name] || "#cbd5e1",
  }));

  const pendingOrders = pendingOrdersRes.count || 0;
  const pendingAfterSales = pendingAfterSalesRes.count || 0;
  const lowStock = products.filter((product) => product.stock < 50).length;
  const activeCoupons = coupons.filter((coupon) => coupon.status === "active").length;

  const activities = [
    ...recentOrders.slice(0, 5).map((order) => ({
      type: "order",
      title: `新订单 ${order.order_no}`,
      desc: `${order.customer_name} · ¥${Number(order.amount || 0).toFixed(2)}`,
      time: order.created_at,
    })),
    ...afterSales.slice(0, 3).map((row) => ({
      type: "after_sale",
      title: `售后申请 ${row.order_no}`,
      desc: `${row.customer_name} · ¥${Number(row.amount || 0).toFixed(2)}`,
      time: row.created_at,
    })),
    ...logs.slice(0, 3).map((log) => ({
      type: "stock",
      title: `${log.type === "in" ? "入库" : "出库"} ${log.product_name}`,
      desc: `${log.type === "in" ? "+" : "-"}${log.quantity} 件`,
      time: log.created_at,
    })),
  ]
    .sort((a, b) => new Date(b.time) - new Date(a.time))
    .slice(0, 8);

  const totalRevenue = validOrders.reduce((sum, order) => sum + (Number(order.amount) || 0), 0);
  const totalOrders = validOrders.length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const conversionRate = daily.reduce((sum, row) => sum + (Number(row.visitors) || 0), 0) > 0
    ? (totalOrders / daily.reduce((sum, row) => sum + (Number(row.visitors) || 0), 0)) * 100
    : 0;

  const orderStatusDistribution = ["pending", "processing", "shipped", "delivered", "cancelled"].map((status) => ({
    name: { pending: "待处理", processing: "处理中", shipped: "已发货", delivered: "已送达", cancelled: "已取消" }[status],
    value: orders.filter((order) => order.status === status).length,
    status,
  })).filter((item) => item.value > 0);

  const categoryDistribution = {};
  products.forEach((product) => {
    const cat = product.category || "未分类";
    categoryDistribution[cat] = (categoryDistribution[cat] || 0) + (Number(product.sales) || 0);
  });
  const topCategories = Object.entries(categoryDistribution)
    .map(([name, sales]) => ({ name, sales }))
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 5);

  return {
    summary: {
      todayRevenue: todayOrders.reduce((sum, order) => sum + (Number(order.amount) || 0), 0),
      todayOrders: todayOrders.length,
      pendingOrders,
      pendingAfterSales,
      lowStock,
      activeCoupons,
      totalCustomers: customers.length,
      repeatCustomers: customers.filter((customer) => (customer.order_count || 0) > 1).length,
      totalRevenue,
      totalOrders,
      avgOrderValue,
      conversionRate,
    },
    trend,
    topProducts,
    levelDistribution,
    activities,
    orderStatusDistribution,
    topCategories,
  };
};

/* ==================== 账号管理 ==================== */

export const STAFF_ROLES = [
  { value: "super_admin", label: "超级管理员" },
  { value: "operator", label: "运营专员" },
  { value: "cs", label: "客服专员" },
  { value: "warehouse", label: "仓库专员" },
];

export const roleLabel = (value) =>
  STAFF_ROLES.find((role) => role.value === value)?.label || value || "-";

export const fetchStaffAccounts = async ({
  search = "",
  role = "all",
  status = "all",
  page = 1,
  pageSize = 10,
} = {}) => {
  const from = (page - 1) * pageSize;
  let query = supabase.from("staff_accounts").select("*", { count: "exact" });

  const keyword = sanitize(search);
  if (keyword) {
    query = query.or(`name.ilike.%${keyword}%,email.ilike.%${keyword}%,phone.ilike.%${keyword}%`);
  }
  if (role !== "all") query = query.eq("role", role);
  if (status !== "all") query = query.eq("status", status);

  const { data, error, count } = await query
    .order("id", { ascending: true })
    .range(from, from + pageSize - 1);

  if (error) throw error;
  return { data: data || [], total: count || 0 };
};

export const fetchStaffStats = async () => {
  const { data, error } = await supabase.from("staff_accounts").select("status,role");
  if (error) throw error;
  const rows = data || [];
  return {
    total: rows.length,
    active: rows.filter((row) => row.status === "active").length,
    disabled: rows.filter((row) => row.status === "disabled").length,
    superAdmin: rows.filter((row) => row.role === "super_admin").length,
  };
};

export const fetchCurrentStaff = async () => {
  let email = "";
  let authed = false;
  try {
    const { data } = await supabase.auth.getUser();
    if (data?.user) {
      authed = true;
      email = data.user.email || "";
    }
  } catch (error) {
    authed = false;
  }

  // 已登录：必须是后台员工才能进入，否则按游客处理（无任何后台权限）
  if (authed) {
    if (email) {
      const { data, error } = await supabase
        .from("staff_accounts")
        .select("id,name,role,email,phone")
        .eq("email", email)
        .eq("status", "active")
        .limit(1);
      if (!error && data && data[0]) {
        return { staff: data[0], authed: true, guest: false };
      }
    }
    return { staff: null, authed: true, guest: true };
  }

  // 登录态未知（SDK 尚未就绪）：按游客处理，绝不回落到超管，避免越权
  return { staff: null, authed: false, guest: true };
};

export const createStaffAccount = async (payload) => {
  const { data, error } = await supabase
    .from("staff_accounts")
    .insert([{ ...payload, status: payload.status || "active" }])
    .select()
    .single();
  if (error) throw error;

  await audit({
    module: "账号",
    action: "新建员工账号",
    target: data.name || data.email,
    detail: `角色 ${roleLabel(data.role)}`,
  });
  return data;
};

export const updateStaffAccount = async (id, patch) => {
  const { data: target, error: targetError } = await supabase
    .from("staff_accounts")
    .select("id,name,role,status,email")
    .eq("id", id)
    .maybeSingle();
  if (targetError) throw targetError;

  const nextRole = patch.role || target?.role;
  const nextStatus = patch.status || target?.status;

  if (target?.role === "super_admin" && (nextRole !== "super_admin" || nextStatus !== "active")) {
    const { data: admins, error: adminError } = await supabase
      .from("staff_accounts")
      .select("id")
      .eq("role", "super_admin")
      .eq("status", "active");
    if (adminError) throw adminError;
    if ((admins || []).length <= 1) {
      throw new Error(`「${target.name}」是最后一位在职超级管理员，无法停用或降级`);
    }
  }

  const { data, error } = await supabase
    .from("staff_accounts")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;

  const changes = [];
  if (patch.name !== undefined && patch.name !== target?.name) changes.push(`姓名 ${target?.name} → ${patch.name}`);
  if (patch.role !== undefined && patch.role !== target?.role) {
    changes.push(`角色 ${roleLabel(target?.role)} → ${roleLabel(patch.role)}`);
  }
  if (patch.status !== undefined && patch.status !== target?.status) {
    changes.push(`状态 ${patch.status === "active" ? "启用" : "停用"}`);
  }
  await audit({
    module: "账号",
    action: "编辑员工账号",
    target: data.name || data.email,
    detail: changes.length ? changes.join(" · ") : "更新资料",
  });
  return data;
};

export const deleteStaffAccounts = async (ids) => {
  if (!ids.length) return true;

  const { data: targets, error: targetError } = await supabase
    .from("staff_accounts")
    .select("id,name,role,status")
    .in("id", ids);
  if (targetError) throw targetError;

  const removingAdmins = (targets || []).filter(
    (row) => row.role === "super_admin" && row.status === "active"
  ).length;
  if (removingAdmins) {
    const { data: admins, error: adminError } = await supabase
      .from("staff_accounts")
      .select("id")
      .eq("role", "super_admin")
      .eq("status", "active");
    if (adminError) throw adminError;
    if ((admins || []).length <= removingAdmins) {
      throw new Error("删除后系统将没有在职超级管理员，请先保留或新建一位");
    }
  }

  const { error } = await supabase.from("staff_accounts").delete().in("id", ids);
  if (error) throw error;

  await audit({
    module: "账号",
    action: "删除员工账号",
    target: (targets || []).map((row) => row.name).join("、"),
    detail: `共 ${ids.length} 个账号`,
  });
  return true;
};

export const fetchRegisteredUsers = async ({ search = "", page = 1, pageSize = 10 } = {}) => {
  const from = (page - 1) * pageSize;
  let query = supabase.from("registered_users").select("*", { count: "exact" });

  const keyword = sanitize(search);
  if (keyword) query = query.or(`email.ilike.%${keyword}%,nickname.ilike.%${keyword}%`);

  const { data, error, count } = await query
    .order("registered_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) throw error;
  return { data: data || [], total: count || 0 };
};

/* ==================== 数据汇总 ==================== */

export const rebuildDailyStats = async (days = 30) => {
  const { data, error } = await supabase.rpc("rebuild_daily_stats", { p_days: days });
  if (error) throw error;
  return data;
};

/* ==================== 订单商品明细 ==================== */

/** 查询订单商品明细 */
export const fetchOrderItems = async (orderId) => {
  const { data, error } = await supabase
    .from("order_items")
    .select(
      "id,order_id,product_id,product_name,sku_name,quantity,unit_price,total_price,created_at"
    )
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
};

/** 批量查询多个订单的商品明细 */
export const fetchOrderItemsBatch = async (orderIds) => {
  if (!orderIds.length) return [];
  const { data, error } = await supabase
    .from("order_items")
    .select(
      "id,order_id,product_id,product_name,sku_name,quantity,unit_price,total_price,created_at"
    )
    .in("order_id", orderIds)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
};

/** 创建新订单（含商品明细） */
export const createOrder = async (payload) => {
  const { order_no, customer_name, phone, address, items, remark } = payload;

  // 参数校验
  if (!customer_name) throw new Error("请填写客户姓名");
  if (!phone) throw new Error("请填写联系电话");
  if (!items || !items.length) throw new Error("请至少添加一件商品");

  // 计算总金额
  const amount = items.reduce(
    (sum, item) => sum + (Number(item.unit_price) || 0) * (Number(item.quantity) || 0),
    0
  );

  // 生成订单号
  const orderNo = order_no || `ORD${Date.now()}${Math.floor(Math.random() * 1000)}`;

  // 插入订单
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert([
      {
        order_no: orderNo,
        customer_name,
        phone,
        address: address || null,
        amount,
        status: "pending",
        remark: remark || null,
      },
    ])
    .select()
    .single();
  if (orderError) throw orderError;

  // 插入订单商品明细
  const itemRows = items.map((item) => ({
    order_id: order.id,
    product_id: item.product_id,
    product_name: item.product_name,
    sku_name: item.sku_name || null,
    quantity: Number(item.quantity) || 1,
    unit_price: Number(item.unit_price) || 0,
    total_price: (Number(item.unit_price) || 0) * (Number(item.quantity) || 1),
  }));

  const { error: itemsError } = await supabase.from("order_items").insert(itemRows);
  if (itemsError) throw itemsError;

  // 扣减库存
  for (const item of items) {
    if (item.product_id) {
      const { error: stockError } = await supabase.rpc("adjust_stock", {
        p_product_id: item.product_id,
        p_delta: -(Number(item.quantity) || 1),
        p_remark: `订单 ${orderNo} 扣减库存`,
      });
      if (stockError) throw stockError;
    }
  }

  await audit({
    module: "订单",
    action: "新建订单",
    target: orderNo,
    detail: `客户 ${customer_name}，金额 ¥${amount.toFixed(2)}，共 ${items.length} 件商品`,
  });

  return order;
};

/* ==================== 商品分类管理 ==================== */

/** 查询分类列表（含商品数量统计） */
export const fetchCategoryList = async () => {
  const [{ data: categories, error: catError }, { data: products, error: prodError }] = await Promise.all([
    supabase
      .from("categories")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase.from("products").select("category"),
  ]);
  if (catError) throw catError;
  if (prodError) throw prodError;

  // 手动统计每个分类下的商品数量
  const countMap = new Map();
  (products || []).forEach((p) => {
    if (p.category) {
      countMap.set(p.category, (countMap.get(p.category) || 0) + 1);
    }
  });

  return (categories || []).map((cat) => ({
    ...cat,
    productCount: countMap.get(cat.name) || 0,
  }));
};

/** 新建分类 */
export const createCategory = async (payload) => {
  const { name, description, sort_order } = payload;
  if (!name) throw new Error("请填写分类名称");

  // 检查名称是否重复
  const { data: existing } = await supabase
    .from("categories")
    .select("id")
    .eq("name", name)
    .maybeSingle();
  if (existing) throw new Error("分类名称已存在");

  const { data, error } = await supabase
    .from("categories")
    .insert([
      {
        name,
        description: description || null,
        sort_order: Number(sort_order) || 0,
      },
    ])
    .select()
    .single();
  if (error) throw error;

  await audit({
    module: "商品",
    action: "新建分类",
    target: name,
    detail: description || "",
  });
  return data;
};

/** 更新分类 */
export const updateCategory = async (id, patch) => {
  const { data: current, error: currentError } = await supabase
    .from("categories")
    .select("id,name")
    .eq("id", id)
    .single();
  if (currentError) throw currentError;

  // 检查名称是否与其他分类重复
  if (patch.name && patch.name !== current.name) {
    const { data: existing } = await supabase
      .from("categories")
      .select("id")
      .eq("name", patch.name)
      .neq("id", id)
      .maybeSingle();
    if (existing) throw new Error("分类名称已存在");
  }

  const { data, error } = await supabase
    .from("categories")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;

  await audit({
    module: "商品",
    action: "编辑分类",
    target: patch.name || current.name,
    detail: "更新分类信息",
  });
  return data;
};

/** 删除分类（仅当没有关联商品时） */
export const deleteCategory = async (id) => {
  const { data: category, error: fetchError } = await supabase
    .from("categories")
    .select("id,name")
    .eq("id", id)
    .single();
  if (fetchError) throw fetchError;

  // 检查是否有商品使用该分类
  const { count, error: countError } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("category", category.name);
  if (countError) throw countError;
  if (count > 0) {
    throw new Error(`该分类下还有 ${count} 个商品，请先移除或修改这些商品的分类`);
  }

  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw error;

  await audit({
    module: "商品",
    action: "删除分类",
    target: category.name,
    detail: "",
  });
  return true;
};

/* ==================== 供应商管理 ==================== */

/** 查询供应商列表 */
export const fetchSuppliers = async ({ search = "", page = 1, pageSize = 10 } = {}) => {
  const from = (page - 1) * pageSize;
  let query = supabase.from("suppliers").select("*", { count: "exact" });

  const keyword = sanitize(search);
  if (keyword) {
    query = query.or(
      `name.ilike.%${keyword}%,contact.ilike.%${keyword}%,phone.ilike.%${keyword}%`
    );
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) throw error;
  return { data: data || [], total: count || 0 };
};

/** 查询所有供应商（用于下拉选择） */
export const fetchAllSuppliers = async () => {
  const { data, error } = await supabase
    .from("suppliers")
    .select("id,name,contact,phone")
    .eq("status", "active")
    .order("name");
  if (error) throw error;
  return data || [];
};

/** 新建供应商 */
export const createSupplier = async (payload) => {
  const { name, contact, phone, email, address, remark } = payload;
  if (!name) throw new Error("请填写供应商名称");

  const { data, error } = await supabase
    .from("suppliers")
    .insert([
      {
        name,
        contact: contact || null,
        phone: phone || null,
        email: email || null,
        address: address || null,
        remark: remark || null,
        status: "active",
      },
    ])
    .select()
    .single();
  if (error) throw error;

  await audit({
    module: "供应商",
    action: "新建供应商",
    target: name,
    detail: contact ? `联系人 ${contact}` : "",
  });
  return data;
};

/** 更新供应商 */
export const updateSupplier = async (id, patch) => {
  const { data: current, error: currentError } = await supabase
    .from("suppliers")
    .select("id,name")
    .eq("id", id)
    .single();
  if (currentError) throw currentError;

  const { data, error } = await supabase
    .from("suppliers")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;

  await audit({
    module: "供应商",
    action: "编辑供应商",
    target: patch.name || current.name,
    detail: "更新供应商信息",
  });
  return data;
};

/** 删除供应商 */
export const deleteSupplier = async (id) => {
  const { data: supplier, error: fetchError } = await supabase
    .from("suppliers")
    .select("id,name")
    .eq("id", id)
    .single();
  if (fetchError) throw fetchError;

  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  if (error) throw error;

  await audit({
    module: "供应商",
    action: "删除供应商",
    target: supplier.name,
    detail: "",
  });
  return true;
};

/* ==================== 财务对账 ==================== */

/** 查询财务汇总数据 */
export const fetchFinancialSummary = async (startDate, endDate) => {
  // 查询订单收入
  let orderQuery = supabase
    .from("orders")
    .select("amount,status,created_at")
    .gte("created_at", startDate)
    .lt("created_at", endDate);

  const { data: orders, error: orderError } = await orderQuery;
  if (orderError) throw orderError;

  // 查询退款数据
  let refundQuery = supabase
    .from("after_sales")
    .select("amount,status,created_at")
    .gte("created_at", startDate)
    .lt("created_at", endDate);

  const { data: refunds, error: refundError } = await refundQuery;
  if (refundError) throw refundError;

  const orderRows = orders || [];
  const refundRows = refunds || [];

  // 计算各项指标
  const totalRevenue = orderRows
    .filter((o) => o.status !== "cancelled")
    .reduce((sum, o) => sum + (Number(o.amount) || 0), 0);

  const pendingAmount = orderRows
    .filter((o) => o.status === "pending")
    .reduce((sum, o) => sum + (Number(o.amount) || 0), 0);

  const completedAmount = orderRows
    .filter((o) => o.status === "delivered")
    .reduce((sum, o) => sum + (Number(o.amount) || 0), 0);

  const cancelledAmount = orderRows
    .filter((o) => o.status === "cancelled")
    .reduce((sum, o) => sum + (Number(o.amount) || 0), 0);

  const totalRefunds = refundRows
    .filter((r) => r.status === "refunded")
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  const pendingRefunds = refundRows
    .filter((r) => r.status === "pending" || r.status === "approved")
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  const netRevenue = totalRevenue - totalRefunds;

  return {
    totalRevenue,
    pendingAmount,
    completedAmount,
    cancelledAmount,
    totalRefunds,
    pendingRefunds,
    netRevenue,
    orderCount: orderRows.length,
    refundCount: refundRows.filter((r) => r.status === "refunded").length,
  };
};

/** 查询每日收入趋势 */
export const fetchDailyRevenue = async (days = 30) => {
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  startDate.setDate(startDate.getDate() - (days - 1));

  const { data: orders, error } = await supabase
    .from("orders")
    .select("amount,status,created_at")
    .gte("created_at", startDate.toISOString());
  if (error) throw error;

  const rows = orders || [];
  const dailyMap = new Map();

  // 初始化所有日期
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    dailyMap.set(key, { date: key, revenue: 0, refunds: 0, orders: 0 });
  }

  // 汇总订单收入
  rows.forEach((order) => {
    if (order.status === "cancelled") return;
    const key = order.created_at.slice(0, 10);
    if (dailyMap.has(key)) {
      const item = dailyMap.get(key);
      item.revenue += Number(order.amount) || 0;
      item.orders += 1;
    }
  });

  // 查询退款数据
  const { data: refunds, error: refundError } = await supabase
    .from("after_sales")
    .select("amount,status,created_at")
    .gte("created_at", startDate.toISOString());
  if (refundError) throw refundError;

  (refunds || []).forEach((refund) => {
    if (refund.status !== "refunded") return;
    const key = refund.created_at.slice(0, 10);
    if (dailyMap.has(key)) {
      dailyMap.get(key).refunds += Number(refund.amount) || 0;
    }
  });

  return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
};

/** 查询退款记录 */
export const fetchRefundRecords = async ({ search = "", status = "all", page = 1, pageSize = 10 } = {}) => {
  const from = (page - 1) * pageSize;
  let query = supabase
    .from("after_sales")
    .select("*", { count: "exact" });

  const keyword = sanitize(search);
  if (keyword) {
    query = query.or(
      `after_sale_no.ilike.%${keyword}%,order_no.ilike.%${keyword}%,customer_name.ilike.%${keyword}%`
    );
  }

  if (status !== "all") query = query.eq("status", status);

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) throw error;

  // 手动关联订单信息
  const orderNos = [...new Set((data || []).map((r) => r.order_no).filter(Boolean))];
  let orderMap = new Map();
  if (orderNos.length) {
    const { data: orders, error: orderError } = await supabase
      .from("orders")
      .select("order_no,customer_name")
      .in("order_no", orderNos);
    if (orderError) throw orderError;
    orderMap = new Map((orders || []).map((o) => [o.order_no, o]));
  }

  const enriched = (data || []).map((row) => ({
    ...row,
    orders: row.order_no ? orderMap.get(row.order_no) || null : null,
  }));

  return { data: enriched, total: count || 0 };
};
