import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import {
  Wallet,
  ShoppingCart,
  Clock,
  RotateCcw,
  AlertTriangle,
  Ticket,
  ChevronRight,
  RefreshCw,
  Crown,
  ArrowUpRight,
  Boxes,
  TrendingUp,
  Users,
  PackageCheck,
} from "lucide-react";
import { fetchDashboard } from "../services/database";
import { EmptyState, Kpi, PageHeader, SectionCard, ghostBtn } from "./common/PageElements";
import { fmtMoney, fmtNumber, timeAgo } from "@/lib/format";

const ACTIVITY_STYLE = {
  order: { label: "订", color: "#1d4ed8", bg: "#eff6ff" },
  after_sale: { label: "售", color: "#b45309", bg: "#fffbeb" },
  stock: { label: "库", color: "#15803d", bg: "#f0fdf4" },
};

const STATUS_COLORS = {
  pending: "#f59e0b",
  processing: "#3b82f6",
  shipped: "#8b5cf6",
  delivered: "#10b981",
  cancelled: "#9ca3af",
};

const CATEGORY_COLORS = ["#0f62fe", "#7c3aed", "#10b981", "#f59e0b", "#ef4444"];

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const result = await fetchDashboard();
      setData(result);
    } catch (error) {
      console.error(error);
      toast.error(error.message || "加载仪表盘失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const summary = data?.summary;
  const todos = [
    { label: "待处理订单", value: summary?.pendingOrders ?? 0, to: "/orders", icon: Clock, tone: "text-[#b45309] bg-[#fffbeb]" },
    { label: "待审核售后", value: summary?.pendingAfterSales ?? 0, to: "/aftersales", icon: RotateCcw, tone: "text-[#b91c1c] bg-[#fef2f2]" },
    { label: "库存预警商品", value: summary?.lowStock ?? 0, to: "/inventory", icon: AlertTriangle, tone: "text-[#1d4ed8] bg-[#eff6ff]" },
    { label: "进行中优惠券", value: summary?.activeCoupons ?? 0, to: "/marketing", icon: Ticket, tone: "text-[#15803d] bg-[#f0fdf4]" },
  ];

  const statusData = data?.orderStatusDistribution || [];
  const topCategories = data?.topCategories || [];

  return (
    <div>
      <PageHeader
        title="运营总览"
        description={new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
        actions={
          <button type="button" className={ghostBtn} onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> 刷新
          </button>
        }
      />

      {/* 核心 KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Kpi label="今日营收" value={summary ? fmtMoney(summary.todayRevenue, 2) : "-"} icon={Wallet} tone="blue" loading={loading} />
        <Kpi label="今日订单" value={summary ? fmtNumber(summary.todayOrders) : "-"} icon={ShoppingCart} tone="violet" loading={loading} />
        <Kpi
          label="客单价"
          value={summary ? fmtMoney(summary.avgOrderValue, 2) : "-"}
          hint={summary ? `近30天 ${fmtNumber(summary.totalOrders)} 笔订单` : ""}
          icon={TrendingUp}
          tone="green"
          loading={loading}
        />
        <Kpi
          label="访客转化率"
          value={summary ? `${summary.conversionRate.toFixed(2)}%` : "-"}
          hint="近30天访客到成交转化"
          icon={Users}
          tone="amber"
          loading={loading}
        />
      </div>

      {/* 待办事项 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {todos.map((item) => (
          <Link
            key={item.label}
            to={item.to}
            className="group bg-white border border-[#e0e0e0] rounded-sm px-4 py-3 flex items-center gap-3 hover:border-[#0f62fe] transition-colors"
          >
            <span className={`w-8 h-8 rounded flex items-center justify-center ${item.tone}`}>
              <item.icon className="h-4 w-4" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-[#8d8d8d]">{item.label}</p>
              <p className="text-[18px] font-light text-[#161616] leading-6">{item.value}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-[#c6c6c6] group-hover:text-[#0f62fe] transition-colors" />
          </Link>
        ))}
      </div>

      {/* 图表区域 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        <SectionCard
          className="xl:col-span-2"
          title="近 30 天营收趋势"
          description="数据来自每日经营快照"
          actions={
            <Link to="/analytics" className="inline-flex items-center gap-0.5 text-[12px] text-[#0f62fe] hover:underline">
              详细分析 <ArrowUpRight className="h-3 w-3" />
            </Link>
          }
        >
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.trend || []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="dashRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0f62fe" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#0f62fe" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#8d8d8d" }} interval="preserveStartEnd" axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#8d8d8d" }} axisLine={false} tickLine={false} width={52} tickFormatter={(value) => (value >= 10000 ? `${(value / 10000).toFixed(1)}w` : value)} />
                <RTooltip
                  formatter={(value, name) => (name === "revenue" ? [fmtMoney(value, 2), "营收"] : [value, "订单"])}
                  contentStyle={{ fontSize: 12, borderRadius: 2, border: "1px solid #e0e0e0" }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#0f62fe" strokeWidth={2} fill="url(#dashRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="订单状态分布" description="近30天订单状态占比">
          {statusData.length === 0 ? (
            <EmptyState title="暂无订单数据" />
          ) : (
            <div>
              <div className="h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={42}
                      outerRadius={65}
                      paddingAngle={3}
                    >
                      {statusData.map((item) => (
                        <Cell key={item.status} fill={STATUS_COLORS[item.status] || "#9ca3af"} />
                      ))}
                    </Pie>
                    <RTooltip formatter={(value, name) => [value, name]} contentStyle={{ fontSize: 12, borderRadius: 2 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 mt-2">
                {statusData.map((item) => (
                  <div key={item.status} className="flex items-center gap-2 text-[12px]">
                    <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: STATUS_COLORS[item.status] || "#9ca3af" }} />
                    <span className="flex-1 text-[#525252]">{item.name}</span>
                    <span className="text-[#161616]">{item.value} 笔</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      {/* 第二行图表 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        <SectionCard title="热销商品 TOP5" description="按累计销量">
          {(data?.topProducts || []).length === 0 ? (
            <EmptyState title="暂无商品数据" />
          ) : (
            <div className="space-y-3">
              {data.topProducts.map((product, index) => (
                <div key={product.id} className="flex items-center gap-3">
                  <span
                    className={`w-5 h-5 rounded-sm flex items-center justify-center text-[11px] ${
                      index === 0 ? "bg-[#f59e0b] text-white" : index === 1 ? "bg-[#94a3b8] text-white" : index === 2 ? "bg-[#cd7f32] text-white" : "bg-[#f4f4f4] text-[#8d8d8d]"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-[#161616] truncate">{product.name}</p>
                    <p className="text-[11px] text-[#8d8d8d]">销量 {fmtNumber(product.sales)} 件</p>
                  </div>
                  <span className="text-[12px] text-[#161616]">{fmtMoney(product.revenue, 0)}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="品类销量排行" description="按累计销售件数">
          {topCategories.length === 0 ? (
            <EmptyState title="暂无品类数据" />
          ) : (
            <div className="space-y-3">
              {topCategories.map((item, index) => {
                const maxSales = topCategories[0]?.sales || 1;
                return (
                  <div key={item.name}>
                    <div className="flex items-center justify-between text-[12px] mb-1">
                      <span className="flex items-center gap-1.5 text-[#525252]">
                        <span
                          className="w-4 h-4 rounded-sm flex items-center justify-center text-[10px] text-white"
                          style={{ backgroundColor: CATEGORY_COLORS[index] || "#9ca3af" }}
                        >
                          {index + 1}
                        </span>
                        {item.name}
                      </span>
                      <span className="text-[#161616]">{fmtNumber(item.sales)} 件</span>
                    </div>
                    <div className="h-1.5 bg-[#f4f4f4] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(item.sales / maxSales) * 100}%`,
                          backgroundColor: CATEGORY_COLORS[index] || "#9ca3af",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard title="会员等级分布" description="按客户消费额自动分级">
          {(data?.levelDistribution || []).length === 0 ? (
            <EmptyState title="暂无客户数据" />
          ) : (
            <div className="space-y-3">
              {data.levelDistribution.map((item) => {
                const total = data.levelDistribution.reduce((sum, row) => sum + row.value, 0) || 1;
                return (
                  <div key={item.name}>
                    <div className="flex items-center justify-between text-[12px] mb-1">
                      <span className="flex items-center gap-1.5 text-[#525252]">
                        <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: item.color }} />
                        {item.name}
                      </span>
                      <span className="text-[#161616]">
                        {item.value} 人 · {((item.value / total) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-[#f4f4f4] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(item.value / total) * 100}%`, backgroundColor: item.color }} />
                    </div>
                  </div>
                );
              })}
              <Link to="/customers" className="inline-flex items-center gap-0.5 text-[12px] text-[#0f62fe] hover:underline pt-1">
                查看客户列表 <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          )}
        </SectionCard>
      </div>

      {/* 最新动态 */}
      <div className="grid grid-cols-1 xl:grid-cols-1 gap-4">
        <SectionCard title="最新动态" description="订单、售后与库存变更实时汇总">
          {(data?.activities || []).length === 0 ? (
            <EmptyState title="暂无动态" />
          ) : (
            <div className="space-y-0">
              {data.activities.map((activity, index) => {
                const style = ACTIVITY_STYLE[activity.type] || ACTIVITY_STYLE.order;
                return (
                  <div key={index} className="flex items-start gap-3 py-2.5 border-b border-[#f7f7f7] last:border-b-0">
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] shrink-0"
                      style={{ backgroundColor: style.bg, color: style.color }}
                    >
                      {style.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-[#161616]">{activity.title}</p>
                      <p className="text-[11px] text-[#8d8d8d]">{activity.desc}</p>
                    </div>
                    <span className="text-[11px] text-[#a8a8a8] shrink-0">{timeAgo(activity.time)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
};

export default Dashboard;
