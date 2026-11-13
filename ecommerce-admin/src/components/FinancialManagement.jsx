import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  RefreshCw,
  Download,
  Search,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  fetchFinancialSummary,
  fetchDailyRevenue,
  fetchRefundRecords,
} from "../services/database";
import {
  EmptyState,
  Kpi,
  PageHeader,
  Pagination,
  SectionCard,
  ghostBtn,
  inputClass,
} from "./common/PageElements";
import { AFTER_SALE_STATUS } from "./common/StatusPill";
import { downloadCsv, fmtDateTime, fmtMoney } from "@/lib/format";

const PAGE_SIZE = 10;

const RANGE_OPTIONS = [
  { key: "7", label: "近 7 天", days: 7 },
  { key: "30", label: "近 30 天", days: 30 },
  { key: "90", label: "近 90 天", days: 90 },
];

const FinancialManagement = () => {
  const [range, setRange] = useState(30);
  const [summary, setSummary] = useState(null);
  const [dailyData, setDailyData] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [refundTotal, setRefundTotal] = useState(0);
  const [refundPage, setRefundPage] = useState(1);
  const [refundStatus, setRefundStatus] = useState("all");
  const [refundSearch, setRefundSearch] = useState("");
  const [refundKeyword, setRefundKeyword] = useState("");
  const [loading, setLoading] = useState(true);

  const getDateRange = (days) => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));
    return { start: start.toISOString(), end: end.toISOString() };
  };

  const load = async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange(range);
      const [summaryData, daily, refundData] = await Promise.all([
        fetchFinancialSummary(start, end),
        fetchDailyRevenue(range),
        fetchRefundRecords({
          search: refundKeyword,
          status: refundStatus,
          page: refundPage,
          pageSize: PAGE_SIZE,
        }),
      ]);
      setSummary(summaryData);
      setDailyData(daily);
      setRefunds(refundData.data);
      setRefundTotal(refundData.total);
    } catch (error) {
      console.error(error);
      toast.error(error.message || "加载财务数据失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [range, refundPage, refundStatus, refundKeyword]);

  const exportData = () => {
    if (!refunds.length) {
      toast.error("当前没有可导出的数据");
      return;
    }
    downloadCsv(
      `财务对账_${new Date().toISOString().slice(0, 10)}.csv`,
      ["售后单号", "订单号", "客户", "退款金额", "状态", "申请时间"],
      refunds.map((r) => [
        r.after_sale_no,
        r.orders?.order_no || "-",
        r.orders?.customer_name || "-",
        r.amount,
        AFTER_SALE_STATUS[r.status]?.label || r.status,
        fmtDateTime(r.created_at),
      ])
    );
    toast.success("已导出当前页数据");
  };

  const maxRevenue = Math.max(...dailyData.map((d) => d.revenue), 1);

  return (
    <div>
      <PageHeader
        title="财务对账"
        description="收入、退款与结算数据汇总分析"
        actions={
          <>
            <button type="button" className={ghostBtn} onClick={exportData}>
              <Download className="h-3.5 w-3.5" /> 导出
            </button>
            <button type="button" className={ghostBtn} onClick={load} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> 刷新
            </button>
          </>
        }
      />

      <div className="flex items-center gap-2 mb-5">
        {RANGE_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setRange(option.days)}
            className={`px-3 py-1.5 rounded-sm text-[12px] transition-colors ${
              range === option.days
                ? "bg-[#0f62fe] text-white"
                : "text-[#525252] hover:bg-[#f4f4f4]"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Kpi
          label="总收入"
          value={fmtMoney(summary?.totalRevenue || 0, 2)}
          icon={DollarSign}
          tone="blue"
          loading={loading}
        />
        <Kpi
          label="净收入"
          value={fmtMoney(summary?.netRevenue || 0, 2)}
          icon={TrendingUp}
          tone="green"
          loading={loading}
        />
        <Kpi
          label="待结算"
          value={fmtMoney(summary?.pendingAmount || 0, 2)}
          hint={`${summary?.orderCount || 0} 笔订单待处理`}
          icon={Clock}
          tone="amber"
          loading={loading}
        />
        <Kpi
          label="退款总额"
          value={fmtMoney(summary?.totalRefunds || 0, 2)}
          hint={`${summary?.refundCount || 0} 笔退款已完成`}
          icon={TrendingDown}
          tone="red"
          loading={loading}
        />
      </div>

      <SectionCard
        title="收入趋势"
        description={`近 ${range} 天每日收入与退款对比`}
      >
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <RefreshCw className="h-5 w-5 animate-spin text-[#8d8d8d]" />
          </div>
        ) : dailyData.length === 0 ? (
          <EmptyState title="暂无数据" />
        ) : (
          <div className="space-y-3">
            {dailyData.map((day) => (
              <div key={day.date} className="flex items-center gap-3">
                <span className="text-[11px] text-[#6f6f6f] w-20 shrink-0">
                  {day.date.slice(5)}
                </span>
                <div className="flex-1 flex items-center gap-2">
                  <div
                    className="h-5 rounded-sm bg-[#0f62fe] transition-all"
                    style={{
                      width: `${Math.max(2, (day.revenue / maxRevenue) * 100)}%`,
                      minWidth: day.revenue > 0 ? "8px" : "0",
                    }}
                    title={`收入: ¥${day.revenue.toFixed(2)}`}
                  />
                  {day.refunds > 0 ? (
                    <div
                      className="h-5 rounded-sm bg-[#dc2626] transition-all"
                      style={{
                        width: `${Math.max(2, (day.refunds / maxRevenue) * 100)}%`,
                        minWidth: "8px",
                      }}
                      title={`退款: ¥${day.refunds.toFixed(2)}`}
                    />
                  ) : null}
                </div>
                <span className="text-[11px] text-[#6f6f6f] w-24 text-right shrink-0">
                  {day.orders} 单 / ¥{day.revenue.toFixed(0)}
                </span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <div className="mt-5">
        <SectionCard
          title="退款记录"
          description="售后退款明细与状态跟踪"
          bodyClassName="p-0"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-[#f0f0f0]">
            <div className="flex items-center gap-2">
              {["all", "pending", "approved", "refunded", "rejected"].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setRefundStatus(s);
                    setRefundPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-sm text-[12px] transition-colors ${
                    refundStatus === s
                      ? "bg-[#0f62fe] text-white"
                      : "text-[#525252] hover:bg-[#f4f4f4]"
                  }`}
                >
                  {s === "all" ? "全部" : AFTER_SALE_STATUS[s]?.label || s}
                </button>
              ))}
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setRefundPage(1);
                setRefundKeyword(refundSearch.trim());
              }}
              className="relative"
            >
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8d8d8d]" />
              <input
                value={refundSearch}
                onChange={(event) => setRefundSearch(event.target.value)}
                placeholder="搜索售后单号 / 订单号"
                className={`${inputClass} pl-9 w-56`}
              />
            </form>
          </div>

          {loading ? (
            <EmptyState loading />
          ) : refunds.length === 0 ? (
            <EmptyState title="暂无退款记录" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-[13px]">
                <thead>
                  <tr className="bg-[#fafafa] border-b border-[#e0e0e0] text-left text-[12px] text-[#6f6f6f]">
                    <th className="px-4 py-2.5">售后单号</th>
                    <th className="px-4 py-2.5">关联订单</th>
                    <th className="px-4 py-2.5">客户</th>
                    <th className="px-4 py-2.5">退款金额</th>
                    <th className="px-4 py-2.5">类型</th>
                    <th className="px-4 py-2.5">状态</th>
                    <th className="px-4 py-2.5">申请时间</th>
                  </tr>
                </thead>
                <tbody>
                  {refunds.map((row) => (
                    <tr key={row.id} className="border-b border-[#f0f0f0] last:border-0 hover:bg-[#fafafa]">
                      <td className="px-4 py-3 text-[#0f62fe] font-medium">{row.after_sale_no}</td>
                      <td className="px-4 py-3 text-[#525252]">{row.orders?.order_no || "-"}</td>
                      <td className="px-4 py-3 text-[#525252]">{row.orders?.customer_name || "-"}</td>
                      <td className="px-4 py-3 text-[#161616] font-medium">
                        ¥{Number(row.amount || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-[#525252]">{row.type === "return" ? "退货退款" : "仅退款"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] ${
                            row.status === "refunded"
                              ? "bg-[#f0fdf4] text-[#15803d]"
                              : row.status === "pending"
                              ? "bg-[#fffbeb] text-[#b45309]"
                              : row.status === "approved"
                              ? "bg-[#eff6ff] text-[#1d4ed8]"
                              : row.status === "rejected"
                              ? "bg-[#fef2f2] text-[#b91c1c]"
                              : "bg-[#f4f4f4] text-[#8d8d8d]"
                          }`}
                        >
                          {AFTER_SALE_STATUS[row.status]?.label || row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#6f6f6f]">{fmtDateTime(row.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="px-4 py-3 border-t border-[#f0f0f0]">
            <Pagination
              page={refundPage}
              pageSize={PAGE_SIZE}
              total={refundTotal}
              onChange={setRefundPage}
            />
          </div>
        </SectionCard>
      </div>
    </div>
  );
};

export default FinancialManagement;
