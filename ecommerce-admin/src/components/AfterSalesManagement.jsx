import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Search, RotateCcw, Clock, BadgeCheck, Wallet, RefreshCw } from "lucide-react";
import {
  createAfterSale,
  fetchAfterSaleStats,
  fetchAfterSales,
  fetchRecentOrders,
  updateAfterSale,
} from "../services/database";
import { EmptyState, Field, Kpi, PageHeader, Pagination, ghostBtn, inputClass, primaryBtn } from "./common/PageElements";
import { Modal } from "./common/Overlays";
import { AFTER_SALE_STATUS, AFTER_SALE_TYPE, Pill } from "./common/StatusPill";
import { fmtDateTime, fmtMoney } from "@/lib/format";

const PAGE_SIZE = 10;
const TABS = [
  { key: "all", label: "全部" },
  { key: "pending", label: "待审核" },
  { key: "approved", label: "已通过" },
  { key: "refunded", label: "已退款" },
  { key: "rejected", label: "已驳回" },
];

const AfterSalesManagement = () => {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [keyword, setKeyword] = useState("");
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState({ order_no: "", customer_name: "", type: "refund", reason: "", amount: "", remark: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [list, stat] = await Promise.all([
        fetchAfterSales({ status, search: keyword, page, pageSize: PAGE_SIZE }),
        fetchAfterSaleStats(),
      ]);
      setRows(list.data);
      setTotal(list.total);
      setStats(stat);
    } catch (error) {
      console.error(error);
      toast.error(error.message || "加载售后数据失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [status, keyword, page]);

  const openCreate = async () => {
    setForm({ order_no: "", customer_name: "", type: "refund", reason: "", amount: "", remark: "" });
    setFormOpen(true);
    try {
      const recent = await fetchRecentOrders(60);
      setOrders(recent);
    } catch (error) {
      console.error(error);
    }
  };

  const pickOrder = (orderNo) => {
    const order = orders.find((item) => item.order_no === orderNo);
    setForm((prev) => ({
      ...prev,
      order_no: orderNo,
      customer_name: order?.customer_name || "",
      amount: order ? String(order.amount) : prev.amount,
    }));
  };

  const handleCreate = async () => {
    if (!form.order_no) {
      toast.error("请选择关联订单");
      return;
    }
    if (!form.reason.trim()) {
      toast.error("请填写售后原因");
      return;
    }
    setSaving(true);
    try {
      await createAfterSale({
        order_no: form.order_no,
        customer_name: form.customer_name,
        type: form.type,
        reason: form.reason.trim(),
        amount: Number(form.amount) || 0,
        status: "pending",
        remark: form.remark.trim() || null,
      });
      toast.success("售后单已创建");
      setFormOpen(false);
      await load();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "创建失败");
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (row, nextStatus) => {
    try {
      await updateAfterSale(row.id, { status: nextStatus, handled_at: new Date().toISOString() });
      toast.success(`售后单已${AFTER_SALE_STATUS[nextStatus].label}`);
      await load();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "操作失败");
    }
  };

  return (
    <div>
      <PageHeader
        title="售后退款"
        description="审核退款、退货与换货申请，跟踪退款金额"
        actions={
          <>
            <button type="button" className={ghostBtn} onClick={load} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> 刷新
            </button>
            <button type="button" className={primaryBtn} onClick={openCreate}>
              <Plus className="h-4 w-4" /> 新建售后
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Kpi label="售后单总数" value={stats ? stats.total : "-"} icon={RotateCcw} tone="blue" loading={loading && !stats} />
        <Kpi label="待审核" value={stats ? stats.pending : "-"} icon={Clock} tone="amber" loading={loading && !stats} />
        <Kpi label="已通过" value={stats ? stats.approved : "-"} icon={BadgeCheck} tone="violet" loading={loading && !stats} />
        <Kpi
          label="累计退款"
          value={stats ? fmtMoney(stats.refundedAmount, 2) : "-"}
          hint={stats ? `${stats.refundedCount} 笔已退款` : ""}
          icon={Wallet}
          tone="red"
          loading={loading && !stats}
        />
      </div>

      <div className="bg-white border border-[#e0e0e0] rounded-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-[#f0f0f0]">
          <div className="flex flex-wrap items-center gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setStatus(tab.key);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-sm text-[12px] transition-colors ${
                  status === tab.key ? "bg-[#0f62fe] text-white" : "text-[#525252] hover:bg-[#f4f4f4]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
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
              placeholder="订单号 / 客户"
              className={`${inputClass} pl-9 !w-52`}
            />
          </form>
        </div>

        {loading ? (
          <EmptyState loading />
        ) : rows.length === 0 ? (
          <EmptyState title="暂无售后单" description="客户提交售后后会出现在这里" />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[900px] text-[13px]">
              <thead>
                <tr className="bg-[#fafafa] border-b border-[#e0e0e0] text-left text-[12px] text-[#6f6f6f]">
                  <th className="px-3 py-2.5">售后单</th>
                  <th className="px-3 py-2.5">关联订单</th>
                  <th className="px-3 py-2.5">客户</th>
                  <th className="px-3 py-2.5">类型</th>
                  <th className="px-3 py-2.5">原因</th>
                  <th className="px-3 py-2.5 text-right">退款金额</th>
                  <th className="px-3 py-2.5">状态</th>
                  <th className="px-3 py-2.5">申请时间</th>
                  <th className="w-32 px-3 py-2.5 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-[#f4f4f4] last:border-b-0 hover:bg-[#fafafa] transition-colors">
                    <td className="px-3 py-3 text-[#161616] font-medium">AS-{String(row.id).padStart(4, "0")}</td>
                    <td className="px-3 py-3 text-[#525252]">{row.order_no}</td>
                    <td className="px-3 py-3 text-[#161616]">{row.customer_name}</td>
                    <td className="px-3 py-3">
                      <Pill config={AFTER_SALE_TYPE[row.type]} fallback={row.type} />
                    </td>
                    <td className="px-3 py-3 text-[#525252] max-w-[220px] truncate">{row.reason}</td>
                    <td className="px-3 py-3 text-right font-medium text-[#161616]">{fmtMoney(row.amount, 2)}</td>
                    <td className="px-3 py-3">
                      <Pill config={AFTER_SALE_STATUS[row.status]} fallback={row.status} />
                    </td>
                    <td className="px-3 py-3 text-[#6f6f6f]">{fmtDateTime(row.created_at)}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {row.status === "pending" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => changeStatus(row, "approved")}
                              className="text-[12px] text-[#0f62fe] hover:bg-[#edf5ff] px-2 py-1 rounded"
                            >
                              通过
                            </button>
                            <button
                              type="button"
                              onClick={() => changeStatus(row, "rejected")}
                              className="text-[12px] text-[#b91c1c] hover:bg-[#fef2f2] px-2 py-1 rounded"
                            >
                              驳回
                            </button>
                          </>
                        ) : row.status === "approved" ? (
                          <button
                            type="button"
                            onClick={() => changeStatus(row, "refunded")}
                            className="text-[12px] text-[#15803d] hover:bg-[#f0fdf4] px-2 py-1 rounded"
                          >
                            确认退款
                          </button>
                        ) : (
                          <span className="text-[12px] text-[#a8a8a8]">已处理</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} />
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="新建售后单"
        description="选择关联订单后自动带出客户与金额"
        footer={
          <>
            <button type="button" className={ghostBtn} onClick={() => setFormOpen(false)} disabled={saving}>
              取消
            </button>
            <button type="button" className={primaryBtn} onClick={handleCreate} disabled={saving}>
              {saving ? "提交中..." : "提交售后"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="关联订单">
            <select value={form.order_no} onChange={(event) => pickOrder(event.target.value)} className={inputClass}>
              <option value="">请选择订单</option>
              {orders.map((order) => (
                <option key={order.id} value={order.order_no}>
                  {order.order_no} · {order.customer_name} · {fmtMoney(order.amount, 2)}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="售后类型">
              <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} className={inputClass}>
                <option value="refund">仅退款</option>
                <option value="return">退货退款</option>
                <option value="exchange">换货</option>
              </select>
            </Field>
            <Field label="退款金额">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(event) => setForm({ ...form, amount: event.target.value })}
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="售后原因">
            <input
              value={form.reason}
              onChange={(event) => setForm({ ...form, reason: event.target.value })}
              placeholder="例如：商品与描述不符"
              className={inputClass}
            />
          </Field>
          <Field label="补充说明">
            <textarea
              value={form.remark}
              onChange={(event) => setForm({ ...form, remark: event.target.value })}
              rows={2}
              className={inputClass}
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
};

export default AfterSalesManagement;
