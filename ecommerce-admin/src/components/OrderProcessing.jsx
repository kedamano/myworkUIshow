import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Search,
  RefreshCw,
  Download,
  ChevronRight,
  Truck,
  PackageCheck,
  XCircle,
  Clock,
  MapPin,
  Phone,
  CreditCard,
  Save,
  Loader2,
  User,
  Check,
  History,
  Package,
  Plus,
} from "lucide-react";
import {
  bulkUpdateOrders,
  fetchOrderStatusCounts,
  fetchOrders,
  fetchTodayOrderSummary,
  updateOrder,
  updateOrderStatus,
} from "../services/database";
import { EmptyState, Kpi, PageHeader, Pagination, ghostBtn, inputClass, primaryBtn } from "./common/PageElements";
import { Drawer } from "./common/Overlays";
import { ORDER_FLOW, ORDER_STATUS, Pill } from "./common/StatusPill";
import { downloadCsv, fmtDateTime, fmtMoney, timeAgo } from "@/lib/format";
import { useStaff } from "@/contexts/StaffContext";
import { displayPhone } from "@/lib/permissions";
import CreateOrderModal from "./CreateOrderModal";

const PAGE_SIZE = 10;

const FILTERS = [
  { key: "all", label: "全部" },
  { key: "pending", label: "待处理" },
  { key: "processing", label: "处理中" },
  { key: "shipped", label: "已发货" },
  { key: "delivered", label: "已送达" },
  { key: "cancelled", label: "已取消" },
];

const OrderProcessing = () => {
  const { role } = useStaff();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [keyword, setKeyword] = useState("");
  const [counts, setCounts] = useState({ all: 0 });
  const [today, setToday] = useState({ orders: 0, revenue: 0 });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  const [tracking, setTracking] = useState("");
  const [remark, setRemark] = useState("");
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [list, statusCounts, todaySummary] = await Promise.all([
        fetchOrders({ status, search: keyword, page, pageSize: PAGE_SIZE }),
        fetchOrderStatusCounts(),
        fetchTodayOrderSummary(),
      ]);
      setRows(list.data);
      setTotal(list.total);
      setCounts(statusCounts);
      setToday(todaySummary);
    } catch (error) {
      console.error(error);
      toast.error(error.message || "加载订单失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [status, keyword, page]);

  useEffect(() => {
    setSelected([]);
  }, [status, keyword, page]);

  const allChecked = rows.length > 0 && selected.length === rows.length;

  const requestStatus = async (ids, nextStatus, message) => {
    if (!ids.length) return;
    try {
      await bulkUpdateOrders(ids, { status: nextStatus });
      toast.success(message);
      setSelected([]);
      await load();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "操作失败");
    }
  };

  const advance = (order) => {
    const index = ORDER_FLOW.indexOf(order.status);
    if (index < 0 || index >= ORDER_FLOW.length - 1) return;
    requestStatus([order.id], ORDER_FLOW[index + 1], `${order.order_no} 已推进到${ORDER_STATUS[ORDER_FLOW[index + 1]].label}`);
  };

  const openDetail = (order) => {
    setActiveOrder(order);
    setTracking(order.tracking_no || "");
    setRemark(order.remark || "");
  };

  const saveDetail = async () => {
    if (!activeOrder) return;
    setSaving(true);
    try {
      const updated = await updateOrder(activeOrder.id, {
        tracking_no: tracking.trim() || null,
        remark: remark.trim() || null,
      });
      setActiveOrder(updated);
      toast.success("订单信息已保存");
      await load();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const changeDetailStatus = async (nextStatus) => {
    if (!activeOrder) return;
    try {
      const updated = await updateOrderStatus(activeOrder.id, nextStatus);
      setActiveOrder(updated);
      toast.success(`订单已${ORDER_STATUS[nextStatus].label}`);
      await load();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "状态更新失败");
    }
  };

  const exportRows = () => {
    if (!rows.length) {
      toast.error("当前页没有可导出的订单");
      return;
    }
    downloadCsv(
      `订单列表_${new Date().toISOString().slice(0, 10)}.csv`,
      ["订单号", "客户", "电话", "金额", "状态", "商品件数", "地址", "下单时间"],
      rows.map((order) => [
        order.order_no,
        order.customer_name,
        displayPhone(order.phone, role),
        order.amount,
        ORDER_STATUS[order.status]?.label || order.status,
        order.items,
        order.address,
        fmtDateTime(order.created_at),
      ])
    );
    toast.success("已导出当前页订单");
  };

  return (
    <div>
      <PageHeader
        title="订单处理"
        description="跟踪订单流转、维护物流信息与客户备注"
        actions={
          <>
            <button type="button" className={primaryBtn} onClick={() => setShowCreate(true)}>
              <Plus className="h-3.5 w-3.5" /> 新建订单
            </button>
            <button type="button" className={ghostBtn} onClick={exportRows}>
              <Download className="h-3.5 w-3.5" /> 导出
            </button>
            <button type="button" className={ghostBtn} onClick={load} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> 刷新
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Kpi label="今日订单" value={today.orders} icon={Clock} tone="blue" loading={loading && !today.orders} />
        <Kpi label="今日营收" value={fmtMoney(today.revenue, 2)} icon={PackageCheck} tone="green" loading={loading && !today.orders} />
        <Kpi label="待处理" value={counts.pending || 0} hint="需要尽快分配处理" icon={Clock} tone="amber" loading={loading && !counts.all} />
        <Kpi label="已发货" value={counts.shipped || 0} hint="在途订单" icon={Truck} tone="violet" loading={loading && !counts.all} />
      </div>

      <div className="bg-white border border-[#e0e0e0] rounded-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-[#f0f0f0]">
          <div className="flex flex-wrap items-center gap-1">
            {FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => {
                  setStatus(filter.key);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-sm text-[12px] transition-colors ${
                  status === filter.key
                    ? "bg-[#0f62fe] text-white"
                    : "text-[#525252] hover:bg-[#f4f4f4]"
                }`}
              >
                {filter.label}
                <span className={`ml-1.5 ${status === filter.key ? "text-white/80" : "text-[#a8a8a8]"}`}>
                  {counts[filter.key] ?? 0}
                </span>
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
              placeholder="订单号 / 客户 / 电话"
              className={`${inputClass} pl-9 w-56`}
            />
          </form>
        </div>

        {selected.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 px-4 py-2 bg-[#edf5ff] border-b border-[#cfe1ff]">
            <span className="text-[12px] text-[#0f62fe]">已选 {selected.length} 笔订单</span>
            <button type="button" className={ghostBtn} onClick={() => requestStatus(selected, "shipped", "已批量发货")}>
              <Truck className="h-3.5 w-3.5" /> 批量发货
            </button>
            <button type="button" className={ghostBtn} onClick={() => requestStatus(selected, "delivered", "已批量标记送达")}>
              <PackageCheck className="h-3.5 w-3.5" /> 标记送达
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-sm text-[13px] font-medium border border-[#fecaca] text-[#b91c1c] bg-white hover:bg-[#fef2f2]"
              onClick={() => requestStatus(selected, "cancelled", "已取消所选订单")}
            >
              <XCircle className="h-3.5 w-3.5" /> 取消订单
            </button>
          </div>
        ) : null}

        {loading ? (
          <EmptyState loading />
        ) : rows.length === 0 ? (
          <EmptyState title="没有匹配的订单" description="试试调整筛选条件或搜索关键词" />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[940px] text-[13px]">
              <thead>
                <tr className="bg-[#fafafa] border-b border-[#e0e0e0] text-left text-[12px] text-[#6f6f6f]">
                  <th className="w-10 px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={() => setSelected(allChecked ? [] : rows.map((row) => row.id))}
                      className="h-3.5 w-3.5 accent-[#0f62fe]"
                    />
                  </th>
                  <th className="px-3 py-2.5">订单号</th>
                  <th className="px-3 py-2.5">客户</th>
                  <th className="px-3 py-2.5">商品</th>
                  <th className="px-3 py-2.5 text-right">金额</th>
                  <th className="px-3 py-2.5">状态</th>
                  <th className="px-3 py-2.5">下单时间</th>
                  <th className="w-32 px-3 py-2.5 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((order) => (
                  <tr key={order.id} className="border-b border-[#f4f4f4] last:border-b-0 hover:bg-[#fafafa] transition-colors">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selected.includes(order.id)}
                        onChange={() =>
                          setSelected((prev) =>
                            prev.includes(order.id) ? prev.filter((id) => id !== order.id) : [...prev, order.id]
                          )
                        }
                        className="h-3.5 w-3.5 accent-[#0f62fe]"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => openDetail(order)}
                        className="text-[13px] font-medium text-[#0f62fe] hover:underline"
                      >
                        {order.order_no}
                      </button>
                      <p className="text-[11px] text-[#a8a8a8]">{order.items} 件商品</p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-[#161616]">{order.customer_name}</p>
                      <p className="text-[11px] text-[#a8a8a8]">{displayPhone(order.phone, role)}</p>
                    </td>
                    <td className="px-3 py-3 text-[#525252]">
                      <p className="truncate max-w-[200px]">{(order.products || []).join("、") || "-"}</p>
                    </td>
                    <td className="px-3 py-3 text-right font-medium text-[#161616]">{fmtMoney(order.amount, 2)}</td>
                    <td className="px-3 py-3">
                      <Pill config={ORDER_STATUS[order.status]} fallback={order.status} />
                    </td>
                    <td className="px-3 py-3 text-[#6f6f6f]">
                      <p>{fmtDateTime(order.created_at)}</p>
                      <p className="text-[11px] text-[#a8a8a8]">{timeAgo(order.created_at)}</p>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" onClick={() => openDetail(order)} className="text-[12px] text-[#525252] hover:text-[#161616] px-2 py-1 rounded hover:bg-[#f0f0f0]">
                          详情
                        </button>
                        <button
                          type="button"
                          onClick={() => advance(order)}
                          disabled={order.status === "delivered" || order.status === "cancelled"}
                          className="inline-flex items-center gap-0.5 text-[12px] text-[#0f62fe] hover:text-[#0043ce] px-2 py-1 rounded hover:bg-[#edf5ff] disabled:text-[#c6c6c6] disabled:hover:bg-transparent"
                        >
                          推进 <ChevronRight className="h-3 w-3" />
                        </button>
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

      <Drawer
        open={Boolean(activeOrder)}
        onClose={() => setActiveOrder(null)}
        title={activeOrder?.order_no || "订单详情"}
        subtitle={activeOrder ? `${fmtDateTime(activeOrder.created_at)} 下单` : ""}
        footer={
          activeOrder ? (
            <>
              <button type="button" className={ghostBtn} onClick={saveDetail} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} 保存信息
              </button>
              {activeOrder.status !== "cancelled" && activeOrder.status !== "delivered" ? (
                <button
                  type="button"
                  className={primaryBtn}
                  onClick={() => {
                    const index = ORDER_FLOW.indexOf(activeOrder.status);
                    if (index >= 0 && index < ORDER_FLOW.length - 1) changeDetailStatus(ORDER_FLOW[index + 1]);
                  }}
                >
                  推进到{ORDER_STATUS[ORDER_FLOW[Math.min(ORDER_FLOW.indexOf(activeOrder.status) + 1, ORDER_FLOW.length - 1)]]?.label}
                </button>
              ) : null}
            </>
          ) : null
        }
      >
        {activeOrder ? (
          <div className="space-y-4">
            {/* 金额汇总 */}
            <div className="rounded-sm border border-[#d9e4f7] bg-gradient-to-br from-[#f5f9ff] via-white to-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] text-[#8d8d8d] mb-1">订单金额</p>
                  <p className="text-[26px] font-light text-[#161616] leading-none tracking-tight">
                    {fmtMoney(activeOrder.amount, 2)}
                  </p>
                </div>
                <Pill config={ORDER_STATUS[activeOrder.status]} fallback={activeOrder.status} />
              </div>
              <div className="mt-3 pt-3 border-t border-[#e3ecf9] flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-[#525252]">
                <span className="inline-flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5 text-[#8d8d8d]" />
                  {activeOrder.payment_method || "在线支付"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 text-[#8d8d8d]" />
                  {activeOrder.items} 件商品
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-[#8d8d8d]" />
                  {fmtDateTime(activeOrder.created_at)}
                </span>
              </div>
            </div>

            {/* 收货信息 */}
            <section className="rounded-sm border border-[#e0e0e0] overflow-hidden">
              <header className="px-3 py-2 bg-[#fafafa] border-b border-[#f0f0f0] flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-[#0f62fe]" />
                <h3 className="text-[12px] font-medium text-[#161616]">收货信息</h3>
              </header>
              <div className="p-3 space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-sm bg-[#edf5ff] text-[#0f62fe] flex items-center justify-center shrink-0">
                    <User className="h-3.5 w-3.5" />
                  </span>
                  <p className="text-[13px] text-[#161616]">{activeOrder.customer_name}</p>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-sm bg-[#edf5ff] text-[#0f62fe] flex items-center justify-center shrink-0">
                    <Phone className="h-3.5 w-3.5" />
                  </span>
                  <p className="text-[13px] text-[#161616]">{displayPhone(activeOrder.phone, role)}</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-6 h-6 rounded-sm bg-[#edf5ff] text-[#0f62fe] flex items-center justify-center shrink-0">
                    <MapPin className="h-3.5 w-3.5" />
                  </span>
                  <p className="text-[13px] text-[#161616] leading-5">{activeOrder.address}</p>
                </div>
              </div>
            </section>

            {/* 商品明细 */}
            <section className="rounded-sm border border-[#e0e0e0] overflow-hidden">
              <header className="px-3 py-2 bg-[#fafafa] border-b border-[#f0f0f0] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 text-[#0f62fe]" />
                  <h3 className="text-[12px] font-medium text-[#161616]">商品明细</h3>
                </span>
                <span className="text-[11px] text-[#8d8d8d]">共 {activeOrder.items} 件</span>
              </header>
              <ul className="divide-y divide-[#f0f0f0]">
                {(activeOrder.products || []).map((product, index) => (
                  <li key={index} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="w-5 h-5 rounded-sm bg-[#f4f4f4] text-[#525252] text-[11px] flex items-center justify-center shrink-0">
                      {index + 1}
                    </span>
                    <span className="text-[13px] text-[#161616] truncate">{product}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* 物流与备注 */}
            <section className="rounded-sm border border-[#e0e0e0] overflow-hidden">
              <header className="px-3 py-2 bg-[#fafafa] border-b border-[#f0f0f0] flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5 text-[#0f62fe]" />
                <h3 className="text-[12px] font-medium text-[#161616]">物流与备注</h3>
              </header>
              <div className="p-3 space-y-3">
                <div>
                  <label className="block text-[11px] text-[#8d8d8d] mb-1">物流单号</label>
                  <input
                    value={tracking}
                    onChange={(event) => setTracking(event.target.value)}
                    placeholder="填写物流单号，例如 SF1234567890"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#8d8d8d] mb-1">内部备注</label>
                  <textarea
                    value={remark}
                    onChange={(event) => setRemark(event.target.value)}
                    rows={3}
                    placeholder="内部备注，仅运营可见"
                    className={inputClass}
                  />
                </div>
              </div>
            </section>

            {/* 流转进度 */}
            <section className="rounded-sm border border-[#e0e0e0] overflow-hidden">
              <header className="px-3 py-2 bg-[#fafafa] border-b border-[#f0f0f0] flex items-center gap-1.5">
                <History className="h-3.5 w-3.5 text-[#0f62fe]" />
                <h3 className="text-[12px] font-medium text-[#161616]">流转进度</h3>
              </header>
              <div className="p-3">
                {activeOrder.status === "cancelled" ? (
                  <div className="flex items-center gap-2 text-[12px] text-[#b91c1c]">
                    <XCircle className="h-3.5 w-3.5" />
                    订单已取消，不再流转
                  </div>
                ) : (
                  <ol>
                    {ORDER_FLOW.map((step, index) => {
                      const currentIndex = ORDER_FLOW.indexOf(activeOrder.status);
                      const done = currentIndex >= index;
                      const isCurrent = index === currentIndex;
                      return (
                        <li key={step} className="relative flex items-start gap-3 pb-4 last:pb-0">
                          {index < ORDER_FLOW.length - 1 ? (
                            <span
                              aria-hidden="true"
                              className={`absolute left-[10px] top-[22px] bottom-0 w-px ${
                                currentIndex >= index + 1 ? "bg-[#0f62fe]" : "bg-[#e0e0e0]"
                              }`}
                            />
                          ) : null}
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                              done ? "bg-[#0f62fe] text-white" : "bg-[#f0f0f0] text-[#a8a8a8]"
                            }`}
                          >
                            {done ? <Check className="h-3 w-3" /> : index + 1}
                          </span>
                          <div className="min-w-0 pt-px">
                            <p
                              className={`text-[12px] leading-5 ${
                                done ? "text-[#161616]" : "text-[#a8a8a8]"
                              }`}
                            >
                              {ORDER_STATUS[step].label}
                            </p>
                            {isCurrent ? (
                              <p className="text-[11px] text-[#0f62fe] mt-0.5">当前状态</p>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            </section>
          </div>
        ) : null}
      </Drawer>

      <CreateOrderModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={load}
      />
    </div>
  );
};

export default OrderProcessing;
