import { supabase } from "@/integrations/supabase/client";

/**
 * 操作审计：记录关键业务动作，供「操作日志」页面查询。
 * 当前操作人由顶栏在登录后写入。
 */

let currentStaff = "管理员";

export const setCurrentStaff = (staff) => {
  const name = typeof staff === "string" ? staff : staff?.name;
  currentStaff = name || "管理员";
};

export const getCurrentStaff = () => currentStaff;

export const audit = async ({ module, action, target, detail }) => {
  try {
    const { error } = await supabase.from("operation_logs").insert([
      {
        staff_name: currentStaff,
        module,
        action,
        target: target || null,
        detail: detail || null,
      },
    ]);
    if (error) console.error("操作日志写入失败", error);
  } catch (error) {
    console.error("操作日志写入异常", error);
  }
  return true;
};

export const fetchOperationLogs = async ({
  module = "all",
  search = "",
  page = 1,
  pageSize = 10,
} = {}) => {
  const from = (page - 1) * pageSize;
  let query = supabase.from("operation_logs").select("*", { count: "exact" });

  if (module !== "all") query = query.eq("module", module);

  const keyword = String(search).replace(/[,%()]/g, " ").trim();
  if (keyword) {
    query = query.or(
      `staff_name.ilike.%${keyword}%,target.ilike.%${keyword}%,detail.ilike.%${keyword}%`
    );
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) throw error;
  return { data: data || [], total: count || 0 };
};
