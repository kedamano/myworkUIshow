import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Ticket,
  RefreshCw,
  Power,
  Activity,
  Percent,
  TicketCheck,
  ReceiptText,
  Trash2,
} from "lucide-react";
import {
  createCoupon,
  deleteCouponUsage,
  fetchCouponUsages,
  fetchCoupons,
  recordCouponUsage,
  updateCoupon,
} from "../services/database";
import { EmptyState, Field, Kpi, PageHeader, ghostBtn, inputClass, primaryBtn } from "./common/PageElements";
import { Modal } from "./common/Overlays";
import { COUPON_STATUS, COUPON_TYPE, Pill } from "./common/StatusPill";
import { fmtDate, fmtDateTime, fmtMoney, fmtNumber } from "@/lib/format";
import { useStaff } from "@/contexts/StaffContext";
import { canManageMarketing } from "@/lib/permissions";

const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const emptyForm = () => ({
  code: "",
  name: "",
  type: "amount",
  value: "",
  min_amount: "",
  total: "500",
  start_at: today(),
  end_at: plusDays(30),
});

const MarketingManagement = () => {
  const { role } = useStaff();
  const manageable = canManageMarketing(role);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const [redeemCoupon, setRedeemCoupon] = useState(null);
  const [redeemForm, setRedeemForm] = useState({
    order_no: "",
    customer_name: "",
    customer_phone: "",
    order_amount: "",
  });
  const [redeemSaving, setRedeemSaving] = useState(false);
  const [redeemError, setRedeemError] = useState("");

  const [usageCoupon, setUsageCoupon] = useState(null);
  const [usages, setUsages] = useState([]);
  const [usagesTotal, setUsagesTotal] = useState(0);
  const [usagesLoading, setUsagesLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchCoupons();
      setRows(data);
    } catch (error) {
      console.error(error);
      toast.error(error.message || "加载优惠券失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return rows;
    return rows.filter(
      (row) => (row.name || "").toLowerCase().includes(value) || (row.code || "").toLowerCase().includes(value)
    );
  }, [rows, search]);

  const stats = useMemo(() => {
    const totalIssued = rows.reduce((sum, row) => sum + (row.total || 0), 0);
    const used = rows.reduce((sum, row) => sum + (row.used || 0), 0);
    return {
      active: rows.filter((row) => row.status === "active").length,
      totalIssued,
      used,
      rate: totalIssued ? (used / totalIssued) * 100 : 0,
    };
  }, [rows]);

  const openCreate = () => {
    setForm(emptyForm());
    setFormOpen(true);
  };

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error("请填写券名称");
      return;
    }
    if (!form.code.trim()) {
      toast.error("请填写券码");
      return;
    }
    if (Number(form.value) <= 0) {
      toast.error("请填写正确的优惠面额");
      return;
    }
    setSaving(true);
    try {
      await createCoupon({
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        type: form.type,
        value: Number(form.value) || 0,
        min_amount: Number(form.min_amount) || 0,
        total: Number(form.total) || 0,
        used: 0,
        start_at: form.start_at ? new Date(form.start_at).toISOString() : new Date().toISOString(),
        end_at: form.end_at ? new Date(`${form.end_at}T23:59:59`).toISOString() : null,
        status: "active",
      });
      toast.success("优惠券已创建");
      setFormOpen(false);
      await load();
    } catch (error) {
      console.error(error);
      toast.error("创建失败：" + (error.message || "未知错误"));
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (row) => {
    const nextStatus = row.status === "active" ? "disabled" : "active";
    try {
      await updateCoupon(row.id, { status: nextStatus });
      toast.success(nextStatus === "active" ? "优惠券已启用" : "优惠券已停用");
      await load();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "操作失败");
    }
  };

  const displayStatus = (row) => {
    if (row.status === "active" && row.end_at && new Date(row.end_at) < new Date()) return "expired";
    return row.status || "active";
  };

  const openRedeem = (row) => {
    setRedeemCoupon(row);
    setRedeemForm({ order_no: "", customer_name: "", customer_phone: "", order_amount: "" });
    setRedeemError("");
  };

  const handleRedeem = async () => {
    if (!redeemCoupon) return;
    const amount = Number(redeemForm.order_amount);
    if (!amount || amount <= 0) {
      setRedeemError("请填写订单金额");
      return;
    }
    if (!redeemForm.order_no.trim()) {
      setRedeemError("请填写订单号");
      return;
    }
    setRedeemSaving(true);
    setRedeemError("");
    try {
      const usage = await recordCouponUsage({
        couponId: redeemCoupon.id,
        order_no: redeemForm.order_no,
        customer_name: redeemForm.customer_name,
        customer_phone: redeemForm.customer_phone,
        order_amount: amount,
      });
      toast.success(`核销成功，优惠 ¥${Number(usage.discount_amount).toFixed(2)}`);
      setRedeemCoupon(null);
      await load();
    } catch (error) {
      console.error(error);
      setRedeemError(error.message || "核销失败");
    } finally {
      setRedeemSaving(false);
    }
  };

  const openUsages = async (row) => {
    setUsageCoupon(row);
    setUsagesLoading(true);
    try {
      const list = await fetchCouponUsages({ couponId: row.id, page: 1, pageSize: 20 });
      setUsages(list.data);
      setUsagesTotal(list.total);
    } catch (error) {
      console.error(error);
      toast.error(error.message || "加载核销记录失败");
      setUsages([]);
      setUsagesTotal(0);
    } finally {
      setUsagesLoading(false);
    }
  };

  const handleDeleteUsage = async (usage) => {
    if (!window.confirm(`确认删除核销记录 ${usage.order_no || ""}？删除后券的已核销数会回退。`)) return;
    try {
      await deleteCouponUsage(usage.id);
      toast.success("核销记录已删除");
      setUsages((prev) => prev.filter((item) => item.id !== usage.id));
      setUsagesTotal((prev) => Math.max(0, prev - 1));
      await load();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "删除失败");
    }
  };

  return (
    <div>
      <PageHeader
        title="优惠券"
        description="创建满减与折扣券，登记核销并追踪每张券的使用明细"
        actions={
          <>
            <button type="button" className={ghostBtn} onClick={load} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> 刷新
            </button>
            <button
              type="button"
              className={primaryBtn}
              onClick={openCreate}
              title={manageable ? "" : "当前角色无营销管理权限"}
            >
              <Plus className="h-4 w-4" /> 新建优惠券
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Kpi label="进行中活动" value={stats.active} icon={Activity} tone="green" loading={loading} />
        <Kpi label="累计发放" value={fmtNumber(stats.totalIssued)} icon={Ticket} tone="blue" loading={loading} />
        <Kpi label="已核销" value={fmtNumber(stats.used)} icon={Percent} tone="violet" loading={loading} />
        <Kpi label="核销率" value={`${stats.rate.toFixed(1)}%`} icon={Activity} tone="amber" loading={loading} />
      </div>

      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8d8d8d]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索券名称或券码"
            className={`${inputClass} pl-9 w-56`}
          />
        </div>
        <p className="text-[12px] text-[#a8a8a8]">共 {filtered.length} 张券</p>
      </div>

      {loading ? (
        <div className="bg-white border border-[#e0e0e0] rounded-sm">
          <EmptyState loading />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-[#e0e0e0] rounded-sm">
          <EmptyState
            title="还没有优惠券"
            description="创建一张券开始做活动"
            action={
              manageable ? (
                <button type="button" className={primaryBtn} onClick={openCreate}>
                  新建优惠券
                </button>
              ) : null
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((row) => {
            const percent = row.total ? Math.min(100, ((row.used || 0) / row.total) * 100) : 0;
            const status = displayStatus(row);
            return (
              <div key={row.id} className="bg-white border border-[#e0e0e0] rounded-sm overflow-hidden">
                <div className="flex">
                  <div className="w-24 shrink-0 bg-[#edf5ff] border-r border-dashed border-[#cfe1ff] flex flex-col items-center justify-center py-4">
                    <p className="text-[20px] font-semibold text-[#0f62fe]">
                      {row.type === "discount" ? `${Number(row.value) / 10}折` : `¥${Number(row.value)}`}
                    </p>
                    <p className="text-[10px] text-[#6f6f6f] mt-1">
                      {Number(row.min_amount) > 0 ? `满${Number(row.min_amount)}可用` : "无门槛"}
                    </p>
                  </div>
                  <div className="flex-1 p-3 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13px] font-medium text-[#161616] truncate">{row.name}</p>
                      <Pill config={COUPON_STATUS[status]} fallback={status} />
                    </div>
                    <p className="text-[11px] text-[#a8a8a8] mt-0.5">
                      {row.code} · {COUPON_TYPE[row.type] || row.type}
                    </p>
                    <p className="text-[11px] text-[#6f6f6f] mt-1">
                      {fmtDate(row.start_at)} - {fmtDate(row.end_at)}
                    </p>
                    <div className="mt-2">
                      <div className="h-1.5 bg-[#f0f0f0] rounded-full overflow-hidden">
                        <div className="h-full bg-[#0f62fe] rounded-full" style={{ width: `${percent}%` }} />
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-[#8d8d8d]">
                          已核销 {row.used || 0} / {row.total || 0}
                        </span>
                        {manageable ? (
                          <>
                            <button
                              type="button"
                              onClick={() => openRedeem(row)}
                              className="inline-flex items-center gap-0.5 text-[11px] text-[#0f62fe] hover:underline"
                            >
                              <TicketCheck className="h-3 w-3" /> 核销
                            </button>
                            <button
                              type="button"
                              onClick={() => openUsages(row)}
                              className="inline-flex items-center gap-0.5 text-[11px] text-[#525252] hover:underline"
                            >
                              <ReceiptText className="h-3 w-3" /> 明细
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleStatus(row)}
                              className={`inline-flex items-center gap-0.5 text-[11px] ${
                                row.status === "active" ? "text-[#b91c1c]" : "text-[#0f62fe]"
                              } hover:underline`}
                            >
                              <Power className="h-3 w-3" />
                              {row.status === "active" ? "停用" : "启用"}
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={Boolean(redeemCoupon)}
        onClose={() => setRedeemCoupon(null)}
        title={`核销优惠券 · ${redeemCoupon?.name || ""}`}
        description="核销后券的已核销数 +1，并为客户补记积分"
        footer={
          <>
            <button type="button" className={ghostBtn} onClick={() => setRedeemCoupon(null)} disabled={redeemSaving}>
              取消
            </button>
            <button type="button" className={primaryBtn} onClick={handleRedeem} disabled={redeemSaving}>
              {redeemSaving ? "提交中..." : "确认核销"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          {redeemError ? (
            <div className="px-3 py-2 border border-[#fecaca] bg-[#fef2f2] text-[#b91c1c] text-[12px] rounded-sm">
              {redeemError}
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <Field label="订单号">
              <input
                value={redeemForm.order_no}
                onChange={(event) => setRedeemForm({ ...redeemForm, order_no: event.target.value })}
                placeholder="例如 SO-20261113-001"
                className={inputClass}
              />
            </Field>
            <Field label="订单金额">
              <input
                type="number"
                min="0"
                step="0.01"
                value={redeemForm.order_amount}
                onChange={(event) => setRedeemForm({ ...redeemForm, order_amount: event.target.value })}
                placeholder="0.00"
                className={inputClass}
              />
            </Field>
            <Field label="客户姓名" hint="可选">
              <input
                value={redeemForm.customer_name}
                onChange={(event) => setRedeemForm({ ...redeemForm, customer_name: event.target.value })}
                placeholder="客户姓名"
                className={inputClass}
              />
            </Field>
            <Field label="客户手机号" hint="用于匹配客户档案补记积分">
              <input
                value={redeemForm.customer_phone}
                onChange={(event) => setRedeemForm({ ...redeemForm, customer_phone: event.target.value })}
                placeholder="用于匹配客户档案"
                className={inputClass}
              />
            </Field>
          </div>
          {redeemCoupon ? (
            <div className="border border-[#f0f0f0] rounded-sm p-3 text-[12px] text-[#525252] space-y-1">
              <p>券码：{redeemCoupon.code}</p>
              <p>
                面额：
                {redeemCoupon.type === "discount"
                  ? `${Number(redeemCoupon.value) / 10} 折`
                  : `¥${Number(redeemCoupon.value)}`}
                {Number(redeemCoupon.min_amount) > 0
                  ? ` · 满 ${Number(redeemCoupon.min_amount)} 可用`
                  : " · 无门槛"}
              </p>
              <p>
                已核销 {redeemCoupon.used || 0} / {redeemCoupon.total || 0}
              </p>
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={Boolean(usageCoupon)}
        onClose={() => setUsageCoupon(null)}
        title={`核销明细 · ${usageCoupon?.name || ""}`}
        description={`共 ${usagesTotal} 条核销记录`}
        footer={
          <button type="button" className={primaryBtn} onClick={() => setUsageCoupon(null)}>
            关闭
          </button>
        }
      >
        {usagesLoading ? (
          <EmptyState loading />
        ) : usages.length === 0 ? (
          <EmptyState title="暂无核销记录" description="该券还没有被核销过" />
        ) : (
          <div className="space-y-2">
            {usages.map((usage) => (
              <div
                key={usage.id}
                className="flex items-center justify-between gap-3 border border-[#f0f0f0] rounded-sm px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-[12px] text-[#161616]">{usage.order_no || "未填写订单号"}</p>
                  <p className="text-[11px] text-[#a8a8a8] truncate">
                    {[usage.customer_name, usage.customer_phone, fmtDateTime(usage.created_at)]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[12px] text-[#161616]">-{fmtMoney(usage.discount_amount, 2)}</p>
                  <p className="text-[11px] text-[#a8a8a8]">订单 {fmtMoney(usage.order_amount, 2)}</p>
                </div>
                {manageable ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteUsage(usage)}
                    className="text-[#b91c1c] hover:bg-[#fef2f2] p-1 rounded"
                    title="删除核销记录"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="新建优惠券"
        description="券码需唯一，创建后立即可用"
        footer={
          <>
            <button type="button" className={ghostBtn} onClick={() => setFormOpen(false)} disabled={saving}>
              取消
            </button>
            <button type="button" className={primaryBtn} onClick={handleCreate} disabled={saving}>
              {saving ? "创建中..." : "创建"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="券名称" className="col-span-2">
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="例如：双十一满 500 减 100"
                className={inputClass}
              />
            </Field>
            <Field label="券码">
              <input
                value={form.code}
                onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
                placeholder="SPRING100"
                className={inputClass}
              />
            </Field>
            <Field label="类型">
              <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} className={inputClass}>
                <option value="amount">满减券</option>
                <option value="discount">折扣券（85 表示 8.5 折）</option>
              </select>
            </Field>
            <Field label={form.type === "discount" ? "折扣值" : "减免金额"}>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.value}
                onChange={(event) => setForm({ ...form, value: event.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="使用门槛">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.min_amount}
                onChange={(event) => setForm({ ...form, min_amount: event.target.value })}
                placeholder="0 表示无门槛"
                className={inputClass}
              />
            </Field>
            <Field label="发放总量">
              <input
                type="number"
                min="0"
                step="1"
                value={form.total}
                onChange={(event) => setForm({ ...form, total: event.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="开始日期">
              <input
                type="date"
                value={form.start_at}
                onChange={(event) => setForm({ ...form, start_at: event.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="结束日期">
              <input
                type="date"
                value={form.end_at}
                onChange={(event) => setForm({ ...form, end_at: event.target.value })}
                className={inputClass}
              />
            </Field>
          </div>
          <p className="text-[11px] text-[#8d8d8d]">
            当前券面额预览：
            {form.type === "discount" ? `${(Number(form.value) || 0) / 10} 折` : fmtMoney(form.value, 0)}
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default MarketingManagement;
