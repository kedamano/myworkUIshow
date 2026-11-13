import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Users,
  Crown,
  UserPlus,
  Repeat,
  Search,
  RefreshCw,
  Save,
  Loader2,
  Coins,
  RefreshCcw,
  Plus,
  Minus,
} from "lucide-react";
import {
  adjustCustomerPoints,
  fetchCustomerOrders,
  fetchCustomerPointsLogs,
  fetchCustomerStats,
  fetchCustomers,
  levelForSpent,
  nextLevelRule,
  recomputeCustomerLevels,
  updateCustomer,
  LEVEL_RULES,
} from "../services/database";
import { EmptyState, Field, Kpi, PageHeader, Pagination, ghostBtn, inputClass, primaryBtn } from "./common/PageElements";
import { Drawer, Modal } from "./common/Overlays";
import { CUSTOMER_LEVEL, ORDER_STATUS, Pill } from "./common/StatusPill";
import { fmtDate, fmtDateTime, fmtMoney, fmtNumber } from "@/lib/format";
import { useStaff } from "@/contexts/StaffContext";
import { displayPhone } from "@/lib/permissions";

const PAGE_SIZE = 10;
const LEVELS = ["普通会员", "白银会员", "黄金会员", "钻石会员"];

const POINTS_TYPE = {
  earn: "积分发放",
  use: "积分扣减",
  adjust: "积分调整",
  sync: "积分同步",
};

const CustomerManagement = () => {
  const { role } = useStaff();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [keyword, setKeyword] = useState("");
  const [level, setLevel] = useState("all");
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const [active, setActive] = useState(null);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [form, setForm] = useState({ level: "普通会员", remark: "", tags: "" });
  const [saving, setSaving] = useState(false);
  const [pointsLogs, setPointsLogs] = useState([]);
  const [pointsLoading, setPointsLoading] = useState(false);
  const [recomputing, setRecomputing] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustDelta, setAdjustDelta] = useState("");
  const [adjustRemark, setAdjustRemark] = useState("");
  const [adjustSaving, setAdjustSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [list, stat] = await Promise.all([
        fetchCustomers({ search: keyword, level, page, pageSize: PAGE_SIZE }),
        fetchCustomerStats(),
      ]);
      setRows(list.data);
      setTotal(list.total);
      setStats(stat);
    } catch (error) {
      console.error(error);
      toast.error(error.message || "加载客户数据失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [keyword, level, page]);

  const openDetail = async (customer) => {
    setActive(customer);
    setForm({
      level: customer.level || "普通会员",
      remark: customer.remark || "",
      tags: (customer.tags || []).join(","),
    });
    setOrdersLoading(true);
    setPointsLoading(true);
    try {
      const [history, logs] = await Promise.all([
        fetchCustomerOrders(customer.phone),
        fetchCustomerPointsLogs(customer.id),
      ]);
      setOrders(history);
      setPointsLogs(logs);
    } catch (error) {
      console.error(error);
      setOrders([]);
      setPointsLogs([]);
    } finally {
      setOrdersLoading(false);
      setPointsLoading(false);
    }
  };

  const handleRecompute = async () => {
    setRecomputing(true);
    try {
      const result = await recomputeCustomerLevels();
      toast.success(
        `重算完成：${result.total} 位客户，等级变更 ${result.levelChanged} 人，积分同步 ${result.pointsChanged} 人`
      );
      await load();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "重算失败");
    } finally {
      setRecomputing(false);
    }
  };

  const handleAdjustPoints = async (direction) => {
    if (!active) return;
    const value = Number(adjustDelta);
    if (!value || value <= 0) {
      toast.error("请填写大于 0 的积分数量");
      return;
    }
    setAdjustSaving(true);
    try {
      const next = await adjustCustomerPoints(
        active.id,
        direction === "earn" ? value : -value,
        { source: "后台手动调整", remark: adjustRemark.trim() }
      );
      setActive({ ...active, points: next });
      setPointsLogs(await fetchCustomerPointsLogs(active.id));
      setAdjustOpen(false);
      setAdjustDelta("");
      setAdjustRemark("");
      toast.success(`积分已${direction === "earn" ? "发放" : "扣减"}，当前余额 ${next}`);
      await load();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "积分调整失败");
    } finally {
      setAdjustSaving(false);
    }
  };

  const handleSave = async () => {
    if (!active) return;
    setSaving(true);
    try {
      const tags = form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      const updated = await updateCustomer(active.id, {
        level: form.level,
        remark: form.remark.trim() || null,
        tags: tags.length ? tags : null,
      });
      setActive(updated);
      toast.success("客户信息已更新");
      await load();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const nextRule = nextLevelRule(active?.total_spent);

  return (
    <div>
      <PageHeader
        title="客户会员"
        description="按累计消费自动分级，管理会员积分、标签与备注"
        actions={
          <>
            <button type="button" className={ghostBtn} onClick={handleRecompute} disabled={recomputing || loading}>
              <RefreshCcw className={`h-3.5 w-3.5 ${recomputing ? "animate-spin" : ""}`} />
              {recomputing ? "重算中..." : "重新计算等级与积分"}
            </button>
            <button type="button" className={ghostBtn} onClick={load} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> 刷新
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Kpi label="客户总数" value={stats ? fmtNumber(stats.total) : "-"} icon={Users} tone="blue" loading={loading && !stats} />
        <Kpi label="高价值会员" value={stats ? fmtNumber(stats.vip) : "-"} hint="黄金及钻石会员" icon={Crown} tone="amber" loading={loading && !stats} />
        <Kpi label="本月新增" value={stats ? fmtNumber(stats.newThisMonth) : "-"} icon={UserPlus} tone="green" loading={loading && !stats} />
        <Kpi
          label="复购率"
          value={stats ? `${stats.repeatRate.toFixed(1)}%` : "-"}
          hint={stats ? `人均消费 ${fmtMoney(stats.avgSpent, 0)}` : ""}
          icon={Repeat}
          tone="violet"
          loading={loading && !stats}
        />
      </div>

      <div className="bg-white border border-[#e0e0e0] rounded-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-[#f0f0f0]">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setPage(1);
              setKeyword(search.trim());
            }}
            className="relative"
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8d8d8d]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索姓名 / 电话 / 城市"
              className={`${inputClass} pl-9 w-56`}
            />
          </form>
          <select
            value={level}
            onChange={(event) => {
              setLevel(event.target.value);
              setPage(1);
            }}
            className={`${inputClass} !w-36`}
          >
            <option value="all">全部等级</option>
            {LEVELS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <EmptyState loading />
        ) : rows.length === 0 ? (
          <EmptyState title="没有找到客户" description="客户档案会随订单自动沉淀" />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[940px] text-[13px]">
              <thead>
                <tr className="bg-[#fafafa] border-b border-[#e0e0e0] text-left text-[12px] text-[#6f6f6f]">
                  <th className="px-3 py-2.5">客户</th>
                  <th className="px-3 py-2.5">联系方式</th>
                  <th className="px-3 py-2.5">城市</th>
                  <th className="px-3 py-2.5">等级</th>
                  <th className="px-3 py-2.5 text-right">累计消费</th>
                  <th className="px-3 py-2.5 text-right">订单数</th>
                  <th className="px-3 py-2.5 text-right">积分</th>
                  <th className="px-3 py-2.5">最近下单</th>
                  <th className="w-20 px-3 py-2.5 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((customer) => (
                  <tr key={customer.id} className="border-b border-[#f4f4f4] last:border-b-0 hover:bg-[#fafafa] transition-colors">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-full bg-[#edf5ff] text-[#0f62fe] text-[11px] flex items-center justify-center">
                          {(customer.name || "客").slice(0, 1)}
                        </span>
                        <div>
                          <p className="text-[#161616] font-medium">{customer.name}</p>
                          <div className="flex gap-1 mt-0.5">
                            {(customer.tags || []).slice(0, 2).map((tag) => (
                              <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-[#f4f4f4] text-[#6f6f6f] rounded">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-[#525252]">{displayPhone(customer.phone, role)}</td>
                    <td className="px-3 py-3 text-[#525252]">{customer.city || "-"}</td>
                    <td className="px-3 py-3">
                      <Pill config={CUSTOMER_LEVEL[customer.level]} fallback={customer.level || "普通会员"} />
                    </td>
                    <td className="px-3 py-3 text-right font-medium text-[#161616]">{fmtMoney(customer.total_spent, 2)}</td>
                    <td className="px-3 py-3 text-right text-[#525252]">{fmtNumber(customer.order_count)}</td>
                    <td className="px-3 py-3 text-right text-[#525252]">{fmtNumber(customer.points)}</td>
                    <td className="px-3 py-3 text-[#6f6f6f]">{fmtDate(customer.last_order_at)}</td>
                    <td className="px-3 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openDetail(customer)}
                        className="text-[12px] text-[#0f62fe] hover:text-[#0043ce] px-2 py-1 rounded hover:bg-[#edf5ff]"
                      >
                        详情
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} />
      </div>

      <Drawer
        open={Boolean(active)}
        onClose={() => setActive(null)}
        title={active?.name || "客户详情"}
        subtitle={active ? `${displayPhone(active.phone, role)} · ${active.city || "未知城市"}` : ""}
        footer={
          <button type="button" className={primaryBtn} onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} 保存
          </button>
        }
      >
        {active ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="border border-[#f0f0f0] rounded-sm p-3">
                <p className="text-[11px] text-[#8d8d8d]">累计消费</p>
                <p className="text-[16px] text-[#161616] mt-1">{fmtMoney(active.total_spent, 2)}</p>
              </div>
              <div className="border border-[#f0f0f0] rounded-sm p-3">
                <p className="text-[11px] text-[#8d8d8d]">订单数</p>
                <p className="text-[16px] text-[#161616] mt-1">{active.order_count || 0}</p>
              </div>
              <div className="border border-[#f0f0f0] rounded-sm p-3">
                <p className="text-[11px] text-[#8d8d8d]">客单价</p>
                <p className="text-[16px] text-[#161616] mt-1">
                  {fmtMoney(active.order_count ? active.total_spent / active.order_count : 0, 0)}
                </p>
              </div>
              <div className="border border-[#f0f0f0] rounded-sm p-3">
                <p className="text-[11px] text-[#8d8d8d]">当前积分</p>
                <p className="text-[16px] text-[#161616] mt-1">{fmtNumber(active.points)}</p>
              </div>
            </div>

            <div className="space-y-3">
              <Field label="会员等级">
                <select value={form.level} onChange={(event) => setForm({ ...form, level: event.target.value })} className={inputClass}>
                  {LEVELS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="客户标签" hint="多个标签用英文逗号分隔">
                <input
                  value={form.tags}
                  onChange={(event) => setForm({ ...form, tags: event.target.value })}
                  placeholder="例如：高客单,易转化"
                  className={inputClass}
                />
              </Field>
              <Field label="备注">
                <textarea
                  value={form.remark}
                  onChange={(event) => setForm({ ...form, remark: event.target.value })}
                  rows={2}
                  className={inputClass}
                />
              </Field>
            </div>

            <div className="border border-[#f0f0f0] rounded-sm p-3">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-medium text-[#525252]">等级进度</p>
                <span className="text-[11px] text-[#8d8d8d]">
                  {nextRule
                    ? `距 ${nextRule.name} 还差 ${fmtMoney(nextRule.min - active.total_spent, 0)}`
                    : "已达最高等级"}
                </span>
              </div>
              <div className="h-1.5 bg-[#f0f0f0] rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-[#0f62fe] rounded-full"
                  style={{ width: `${nextRule ? Math.min(100, (active.total_spent / nextRule.min) * 100) : 100}%` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                {LEVEL_RULES.map((rule) => (
                  <span key={rule.name} className="text-[10px] text-[#a8a8a8]">
                    {rule.min}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-[#8d8d8d] mt-2">
                当前等级 {levelForSpent(active.total_spent)} · 按累计消费自动升降级
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[12px] font-medium text-[#525252]">积分明细</p>
                <button
                  type="button"
                  onClick={() => {
                    setAdjustDelta("");
                    setAdjustRemark("");
                    setAdjustOpen(true);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] text-[#0f62fe] hover:underline"
                >
                  <Plus className="h-3 w-3" /> 调整积分
                </button>
              </div>
              {pointsLoading ? (
                <EmptyState loading />
              ) : pointsLogs.length === 0 ? (
                <p className="text-[12px] text-[#8d8d8d]">暂无积分记录</p>
              ) : (
                <div className="space-y-1.5">
                  {pointsLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between gap-3 border border-[#f0f0f0] rounded-sm px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-[12px] text-[#161616]">{log.source || POINTS_TYPE[log.type] || "积分变动"}</p>
                        <p className="text-[11px] text-[#a8a8a8] truncate">
                          {[log.order_no, log.remark].filter(Boolean).join(" · ") || fmtDateTime(log.created_at)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-[12px] font-medium ${log.type === "use" ? "text-[#b45309]" : "text-[#15803d]"}`}>
                          {log.type === "use" ? "-" : "+"}
                          {log.points}
                        </p>
                        <p className="text-[11px] text-[#a8a8a8]">余额 {fmtNumber(log.balance_after)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="text-[12px] font-medium text-[#525252] mb-2">历史订单</p>
              {ordersLoading ? (
                <EmptyState loading />
              ) : orders.length === 0 ? (
                <p className="text-[12px] text-[#8d8d8d]">暂无订单记录</p>
              ) : (
                <div className="space-y-2">
                  {orders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between gap-3 border border-[#f0f0f0] rounded-sm px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-[12px] text-[#161616]">{order.order_no}</p>
                        <p className="text-[11px] text-[#a8a8a8] truncate">{(order.products || []).join("、")}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[12px] text-[#161616]">{fmtMoney(order.amount, 2)}</p>
                        <p className="text-[11px] text-[#a8a8a8]">{fmtDate(order.created_at)}</p>
                      </div>
                      <Pill config={ORDER_STATUS[order.status]} fallback={order.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </Drawer>

      <Modal
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        title={`调整积分 · ${active?.name || ""}`}
        description={`当前积分 ${fmtNumber(active?.points)}，调整后会写入积分明细`}
        footer={
          <>
            <button type="button" className={ghostBtn} onClick={() => setAdjustOpen(false)} disabled={adjustSaving}>
              取消
            </button>
            <button type="button" className={ghostBtn} onClick={() => handleAdjustPoints("use")} disabled={adjustSaving}>
              <Minus className="h-3.5 w-3.5" /> 扣减
            </button>
            <button type="button" className={primaryBtn} onClick={() => handleAdjustPoints("earn")} disabled={adjustSaving}>
              <Plus className="h-3.5 w-3.5" /> 发放
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="积分数量">
            <input
              type="number"
              min="1"
              step="1"
              value={adjustDelta}
              onChange={(event) => setAdjustDelta(event.target.value)}
              placeholder="请输入数量"
              className={inputClass}
            />
          </Field>
          <Field label="调整原因" hint="可选，会写入积分明细">
            <input
              value={adjustRemark}
              onChange={(event) => setAdjustRemark(event.target.value)}
              placeholder="例如：活动补偿"
              className={inputClass}
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
};

export default CustomerManagement;
