import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Database, Download, RefreshCw, TrendingUp, ShoppingBag, Wallet, Users, Calendar } from "lucide-react";
import { fetchAnalytics, rebuildDailyStats } from "../services/database";
import { EmptyState, Kpi, PageHeader, SectionCard, ghostBtn } from "./common/PageElements";
import { downloadCsv, fmtMoney, fmtNumber } from "@/lib/format";

const RANGES = [
  { key: 7, label: "近 7 天" },
  { key: 30, label: "近 30 天" },
  { key: 90, label: "近 90 天" },
];

const heatColor = (value, max) => {
  if (!value) return "#f4f4f4";
  const ratio = max ? value / max : 0;
  if (ratio < 0.2) return "#dbeafe";
  if (ratio < 0.4) return "#bfdbfe";
  if (ratio < 0.6) return "#93c5fd";
  if (ratio < 0.8) return "#3b82f6";
  return "#1d4ed8";
};

const Analytics = () => {
  const [days, setDays] = useState(30);
  const [customRange, setCustomRange] = useState({ start: "", end: "" });
  const [useCustom, setUseCustom] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const result = await fetchAnalytics(days);
      setData(result);
    } catch (error) {
      console.error(error);
      toast.error(error.message || "加载分析数据失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [days]);

  const summary = data?.summary;

  const exportTrend = () => {
    if (!data?.trend?.length) {
      toast.error("暂无可导出的数据");
      return;
    }
    downloadCsv(
      `经营趋势_${useCustom ? "自定义" : `近${days}天`}.csv`,
      ["日期", "营收", "订单量"],
      data.trend.map((row) => [row.key, row.revenue.toFixed(2), row.orders])
    );
    toast.success("趋势数据已导出");
  };

  const exportProducts = () => {
    if (!data?.topProducts?.length) {
      toast.error("暂无可导出的数据");
      return;
    }
    downloadCsv(
      `商品销售排行.csv`,
      ["排名", "商品", "分类", "销量", "销售额"],
      data.topProducts.map((product, index) => [
        index + 1,
        product.name,
        product.category,
        product.sales,
        product.revenue.toFixed(2),
      ])
    );
    toast.success("商品排行已导出");
  };

  const heatMax = data
    ? Math.max(1, ...data.heatmap.flatMap((row) => row.hours))
    : 1;

  const handleRebuild = async () => {
    setRebuilding(true);
    try {
      const result = await rebuildDailyStats(days);
      toast.success(`汇总完成：${result.orders} 笔订单，营收 ${fmtMoney(result.revenue)}`);
      await load();
    } catch (error) {
      toast.error(error.message || "汇总失败");
    } finally {
      setRebuilding(false);
    }
  };

  const rangeBtnClass = (key) =>
    "px-3 py-2 text-[12px] transition-colors " +
    (!useCustom && days === key
      ? "bg-[#0f62fe] text-white"
      : "bg-white text-[#525252] hover:bg-[#f4f4f4]");

  const customBtnClass =
    "px-3 py-2 text-[12px] transition-colors " +
    (useCustom
      ? "bg-[#0f62fe] text-white"
      : "bg-white text-[#525252] hover:bg-[#f4f4f4]");

  return (
    <div>
      <PageHeader
        title="数据分析"
        description="营收、品类、地区与下单时段的全维度经营分析"
        actions={
          <>
            <div className="flex border border-[#e0e0e0] rounded-sm overflow-hidden">
              {RANGES.map((range) => (
                <button
                  key={range.key}
                  type="button"
                  onClick={() => {
                    setDays(range.key);
                    setUseCustom(false);
                  }}
                  className={rangeBtnClass(range.key)}
                >
                  {range.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setUseCustom(true)}
                className={customBtnClass}
              >
                自定义
              </button>
            </div>
            {useCustom ? (
              <div className="flex items-center gap-1 text-[12px]">
                <Calendar className="h-3.5 w-3.5 text-[#8d8d8d]" />
                <input
                  type="date"
                  value={customRange.start}
                  onChange={(e) => setCustomRange((prev) => ({ ...prev, start: e.target.value }))}
                  className="px-2 py-1.5 border border-[#e0e0e0] rounded-sm text-[12px]"
                />
                <span className="text-[#8d8d8d]">至</span>
                <input
                  type="date"
                  value={customRange.end}
                  onChange={(e) => setCustomRange((prev) => ({ ...prev, end: e.target.value }))}
                  className="px-2 py-1.5 border border-[#e0e0e0] rounded-sm text-[12px]"
                />
              </div>
            ) : null}
            <button type="button" className={ghostBtn} onClick={exportTrend}>
              <Download className="h-3.5 w-3.5" /> 导出
            </button>
            <button
              type="button"
              className={ghostBtn}
              onClick={handleRebuild}
              disabled={rebuilding || loading}
              title="按订单表重新汇总近 N 天的营收与订单量，写入 daily_stats"
            >
              <Database className={`h-3.5 w-3.5 ${rebuilding ? "animate-spin" : ""}`} />
              {rebuilding ? "汇总中..." : "重新汇总"}
            </button>
            <button type="button" className={ghostBtn} onClick={load} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Kpi label="营收总额" value={summary ? fmtMoney(summary.revenue, 2) : "-"} icon={Wallet} tone="blue" loading={loading} />
        <Kpi label="订单量" value={summary ? fmtNumber(summary.orders) : "-"} icon={ShoppingBag} tone="violet" loading={loading} />
        <Kpi label="客单价" value={summary ? fmtMoney(summary.avgOrder, 2) : "-"} icon={TrendingUp} tone="green" loading={loading} />
        <Kpi
          label="访客转化率"
          value={summary ? `${summary.conversion.toFixed(2)}%` : "-"}
          hint={summary ? `访客 ${fmtNumber(summary.visitors)} · 退款率 ${summary.refundRate.toFixed(1)}%` : ""}
          icon={Users}
          tone="amber"
          loading={loading}
        />
      </div>

      {loading && !data ? (
        <div className="bg-white border border-[#e0e0e0] rounded-sm">
          <EmptyState loading />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <SectionCard
              className="xl:col-span-2"
              title="营收趋势"
              description={useCustom ? "自定义日期范围" : `近 ${days} 天每日成交金额`}
              actions={<span className="text-[11px] text-[#8d8d8d]">单位：元</span>}
            >
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data?.trend || []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0f62fe" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#0f62fe" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#8d8d8d" }} interval="preserveStartEnd" axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#8d8d8d" }} axisLine={false} tickLine={false} width={54} tickFormatter={(value) => (value >= 10000 ? `${(value / 10000).toFixed(1)}w` : value)} />
                    <RTooltip
                      formatter={(value, name) => (name === "revenue" ? [fmtMoney(value, 2), "营收"] : [value, "订单"])}
                      contentStyle={{ fontSize: 12, borderRadius: 2, border: "1px solid #e0e0e0" }}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#0f62fe" strokeWidth={2} fill="url(#revenueFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>

            <SectionCard title="品类销售占比" description="按销售额计算">
              {data?.category?.length ? (
                <div>
                  <div className="h-[170px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.category}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={45}
                          outerRadius={70}
                          paddingAngle={2}
                        >
                          {data.category.map((item) => (
                            <Cell key={item.name} fill={item.color} />
                          ))}
                        </Pie>
                        <RTooltip formatter={(value, name) => [fmtMoney(value, 0), name]} contentStyle={{ fontSize: 12, borderRadius: 2 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1.5 mt-1">
                    {data.category.slice(0, 5).map((item) => (
                      <div key={item.name} className="flex items-center gap-2 text-[12px]">
                        <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: item.color }} />
                        <span className="flex-1 text-[#525252]">{item.name}</span>
                        <span className="text-[#161616]">{fmtMoney(item.value, 0)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState title="暂无品类数据" />
              )}
            </SectionCard>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <SectionCard title="订单量走势" description={useCustom ? "自定义日期范围" : `近 ${days} 天每日订单数`}>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.trend || []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#8d8d8d" }} interval="preserveStartEnd" axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#8d8d8d" }} axisLine={false} tickLine={false} width={34} allowDecimals={false} />
                    <RTooltip formatter={(value) => [value, "订单"]} contentStyle={{ fontSize: 12, borderRadius: 2 }} />
                    <Bar dataKey="orders" fill="#7c3aed" radius={[2, 2, 0, 0]} maxBarSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>

            <SectionCard title="地区营收分布" description="按订单收货省份统计">
              {data?.provinces?.length ? (
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.provinces} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10, fill: "#8d8d8d" }} axisLine={false} tickLine={false} tickFormatter={(value) => (value >= 10000 ? `${(value / 10000).toFixed(0)}w` : value)} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#525252" }} axisLine={false} tickLine={false} width={64} />
                      <RTooltip formatter={(value) => [fmtMoney(value, 0), "营收"]} contentStyle={{ fontSize: 12, borderRadius: 2 }} />
                      <Bar dataKey="revenue" fill="#0d9488" radius={[0, 2, 2, 0]} maxBarSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState title="暂无地区数据" description="订单地址解析后自动统计" />
              )}
            </SectionCard>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <SectionCard title="下单时段热力图" description="周一至周日 × 0-23 时下单量">
              <div className="overflow-x-auto scrollbar-thin">
                <div className="min-w-[560px]">
                  <div className="flex items-center gap-0.5 mb-1 ml-9">
                    {Array.from({ length: 24 }, (_, hour) => (
                      <div key={hour} className="flex-1 text-[9px] text-[#a8a8a8] text-center">
                        {hour % 3 === 0 ? hour : ""}
                      </div>
                    ))}
                  </div>
                  {(data?.heatmap || []).map((row) => (
                    <div key={row.label} className="flex items-center gap-0.5 mb-0.5">
                      <span className="w-8 text-[10px] text-[#8d8d8d] text-right pr-1">{row.label}</span>
                      {row.hours.map((value, hour) => (
                        <div
                          key={hour}
                          title={`${row.label} ${hour}:00 · ${value} 单`}
                          className="flex-1 h-4 rounded-[2px]"
                          style={{ backgroundColor: heatColor(value, heatMax) }}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-end gap-1 mt-2 text-[10px] text-[#8d8d8d]">
                <span>少</span>
                {["#f4f4f4", "#dbeafe", "#bfdbfe", "#93c5fd", "#3b82f6", "#1d4ed8"].map((color) => (
                  <span key={color} className="w-3 h-3 rounded-[2px]" style={{ backgroundColor: color }} />
                ))}
                <span>多</span>
              </div>
            </SectionCard>

            <SectionCard
              title="商品销售排行"
              description="按累计销量排序"
              actions={
                <button type="button" className="text-[12px] text-[#0f62fe] hover:underline" onClick={exportProducts}>
                  导出
                </button>
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="text-left text-[#8d8d8d] border-b border-[#f0f0f0]">
                      <th className="py-2">商品</th>
                      <th className="py-2">分类</th>
                      <th className="py-2 text-right">销量</th>
                      <th className="py-2 text-right">销售额</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.topProducts || []).map((product, index) => (
                      <tr key={product.id} className="border-b border-[#f7f7f7] last:border-b-0">
                        <td className="py-2">
                          <span className={`inline-flex w-4 h-4 items-center justify-center rounded-sm text-[10px] mr-1.5 ${index < 3 ? "bg-[#0f62fe] text-white" : "bg-[#f4f4f4] text-[#8d8d8d]"}`}>
                            {index + 1}
                          </span>
                          <span className="text-[#161616]">{product.name}</span>
                        </td>
                        <td className="py-2 text-[#6f6f6f]">{product.category}</td>
                        <td className="py-2 text-right text-[#161616]">{fmtNumber(product.sales)}</td>
                        <td className="py-2 text-right text-[#161616]">{fmtMoney(product.revenue, 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>
        </div>
      )}
    </div>
  );
};

export default Analytics;
