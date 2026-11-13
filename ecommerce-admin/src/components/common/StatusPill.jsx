export const ORDER_STATUS = {
  pending: { label: "待处理", color: "#b45309", bg: "#fffbeb" },
  processing: { label: "处理中", color: "#1d4ed8", bg: "#eff6ff" },
  shipped: { label: "已发货", color: "#6d28d9", bg: "#f5f3ff" },
  delivered: { label: "已送达", color: "#15803d", bg: "#f0fdf4" },
  cancelled: { label: "已取消", color: "#6b7280", bg: "#f3f4f6" },
};

export const ORDER_FLOW = ["pending", "processing", "shipped", "delivered"];

export const PRODUCT_STATUS = {
  active: { label: "在售", color: "#15803d", bg: "#f0fdf4" },
  low_stock: { label: "库存不足", color: "#b45309", bg: "#fffbeb" },
  out_of_stock: { label: "缺货", color: "#b91c1c", bg: "#fef2f2" },
  inactive: { label: "已下架", color: "#6b7280", bg: "#f3f4f6" },
};

export const AFTER_SALE_STATUS = {
  pending: { label: "待审核", color: "#b45309", bg: "#fffbeb" },
  approved: { label: "已通过", color: "#1d4ed8", bg: "#eff6ff" },
  refunded: { label: "已退款", color: "#15803d", bg: "#f0fdf4" },
  rejected: { label: "已驳回", color: "#b91c1c", bg: "#fef2f2" },
};

export const AFTER_SALE_TYPE = {
  refund: { label: "仅退款", color: "#1d4ed8", bg: "#eff6ff" },
  return: { label: "退货退款", color: "#6d28d9", bg: "#f5f3ff" },
  exchange: { label: "换货", color: "#b45309", bg: "#fffbeb" },
};

export const COUPON_STATUS = {
  active: { label: "进行中", color: "#15803d", bg: "#f0fdf4" },
  expired: { label: "已过期", color: "#6b7280", bg: "#f3f4f6" },
  disabled: { label: "已停用", color: "#b91c1c", bg: "#fef2f2" },
};

export const COUPON_TYPE = {
  amount: "满减券",
  discount: "折扣券",
};

export const CUSTOMER_LEVEL = {
  钻石会员: { color: "#6d28d9", bg: "#f5f3ff" },
  黄金会员: { color: "#b45309", bg: "#fffbeb" },
  白银会员: { color: "#475569", bg: "#f1f5f9" },
  普通会员: { color: "#6b7280", bg: "#f3f4f6" },
};

export const STAFF_ROLE = {
  super_admin: { label: "超级管理员", color: "#6d28d9", bg: "#f5f3ff" },
  operator: { label: "运营专员", color: "#1d4ed8", bg: "#eff6ff" },
  cs: { label: "客服专员", color: "#0d9488", bg: "#f0fdfa" },
  warehouse: { label: "仓库专员", color: "#b45309", bg: "#fffbeb" },
};

export const ACCOUNT_STATUS = {
  active: { label: "正常", color: "#15803d", bg: "#f0fdf4" },
  disabled: { label: "已停用", color: "#b91c1c", bg: "#fef2f2" },
  banned: { label: "已封禁", color: "#b91c1c", bg: "#fef2f2" },
};

export const Pill = ({ config, fallback = "-" }) => {
  if (!config) {
    return (
      <span className="inline-flex items-center rounded px-2 py-0.5 text-[11px] text-[#6b7280] bg-[#f3f4f6] whitespace-nowrap">
        {fallback}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
      style={{ color: config.color, backgroundColor: config.bg }}
    >
      {config.label}
    </span>
  );
};
