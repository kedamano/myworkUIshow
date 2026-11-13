/**
 * 角色权限定义。
 * 说明：这里是前端展示层控制，用于隐藏无权限的入口与按钮；
 * 服务端已开启行级安全（RLS）：anon 不可访问业务表，authenticated 角色需通过
 * is_active_staff() 校验（JWT sub 匹配在职员工账号）方可读写，账号管理类写操作
 * 仅限超级管理员。前端隐藏不替代服务端校验。
 */

export const ROLE_LABEL = {
  super_admin: "超级管理员",
  operator: "运营专员",
  cs: "客服专员",
  warehouse: "仓库专员",
  guest: "访客",
};

export const NAV_ACCESS = {
  dashboard: ["super_admin", "operator", "cs", "warehouse"],
  orders: ["super_admin", "operator", "cs", "warehouse"],
  aftersales: ["super_admin", "operator", "cs"],
  products: ["super_admin", "operator", "warehouse"],
  inventory: ["super_admin", "operator", "warehouse"],
  customers: ["super_admin", "operator", "cs"],
  marketing: ["super_admin", "operator"],
  analytics: ["super_admin", "operator", "cs"],
  accounts: ["super_admin"],
  logs: ["super_admin"],
};

export const DEFAULT_ROLE = "operator";

export const roleOf = (staff) => staff?.role || DEFAULT_ROLE;

export const canAccessNav = (role, permKey) => {
  const allow = NAV_ACCESS[permKey];
  if (!allow) return true;
  return allow.includes(role);
};

export const canManageAccounts = (role) => role === "super_admin";
export const canEditProducts = (role) => ["super_admin", "operator", "warehouse"].includes(role);
export const canAdjustStock = (role) => ["super_admin", "operator", "warehouse"].includes(role);
export const canManageMarketing = (role) => ["super_admin", "operator"].includes(role);
export const canDeleteRecords = (role) => role === "super_admin";

/** 非超级管理员默认对手机号脱敏 */
export const shouldMaskPhone = (role) => role !== "super_admin";

export const maskPhone = (phone) => {
  const value = String(phone || "");
  if (value.length < 7) return value || "-";
  return `${value.slice(0, 3)}****${value.slice(-4)}`;
};

export const displayPhone = (phone, role) =>
  shouldMaskPhone(role) ? maskPhone(phone) : phone || "-";
