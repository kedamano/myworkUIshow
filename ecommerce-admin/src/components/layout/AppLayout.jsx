import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { ChevronRight, Database } from "lucide-react";
import { navGroups, navItems } from "@/nav-items";
import TopNavigation from "@/components/TopNavigation";
import { fetchAfterSaleStats, fetchOrderStatusCounts, fetchProductStats } from "@/services/database";
import { useStaff } from "@/contexts/StaffContext";
import { canAccessNav } from "@/lib/permissions";

const Brand = () => (
  <div className="h-14 flex items-center gap-2.5 px-4 border-b border-[#f0f0f0]">
    <div
      className="w-8 h-8 rounded flex items-center justify-center text-white text-[12px] font-bold"
      style={{ background: "linear-gradient(135deg, #4F46E5 0%, #2563EB 100%)" }}
    >
      EC
    </div>
    <div className="leading-tight">
      <p className="text-[14px] font-semibold text-[#161616]">电商运营平台</p>
      <p className="text-[10px] text-[#8d8d8d] tracking-wide">EC OPERATIONS</p>
    </div>
  </div>
);

const SidebarNav = ({ onNavigate }) => {
  const { role } = useStaff();
  const grouped = useMemo(() => {
    const map = new Map();
    navGroups.forEach((group) => map.set(group, []));
    navItems
      .filter((item) => canAccessNav(role, item.perm))
      .forEach((item) => {
        const group = item.group || "其他";
        if (!map.has(group)) map.set(group, []);
        map.get(group).push(item);
      });
    return [...map.entries()].filter(([, items]) => items.length > 0);
  }, [role]);

  return (
    <nav className="flex-1 overflow-y-auto scrollbar-thin px-2 py-3">
      {grouped.map(([group, items]) => (
        <div key={group} className="mb-4">
          <p className="px-3 mb-1 text-[10px] font-medium tracking-wider text-[#a8a8a8]">{group}</p>
          <div className="space-y-0.5">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-sm text-[13px] transition-colors border-l-2 ${
                    isActive
                      ? "bg-[#edf5ff] text-[#0f62fe] border-[#0f62fe] font-medium"
                      : "text-[#525252] border-transparent hover:bg-[#f4f4f4] hover:text-[#161616]"
                  }`
                }
              >
                {item.icon}
                <span className="flex-1">{item.title}</span>
                <ChevronRight className="h-3 w-3 opacity-0" />
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
};

const AppLayout = () => {
  const location = useLocation();
  const { role } = useStaff();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [alerts, setAlerts] = useState({ pendingOrders: 0, pendingAfterSales: 0, lowStock: 0 });

  const current = navItems.find((item) =>
    item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to)
  );
  const permitted = current ? canAccessNav(role, current.perm) : true;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [orderCounts, afterSaleStats, productStats] = await Promise.all([
          fetchOrderStatusCounts(),
          fetchAfterSaleStats(),
          fetchProductStats(),
        ]);
        if (!cancelled) {
          setAlerts({
            pendingOrders: orderCounts.pending || 0,
            pendingAfterSales: afterSaleStats.pending || 0,
            lowStock: productStats.alert || 0,
          });
        }
      } catch (error) {
        console.error("加载待办数量失败", error);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-[#f7f7f7]">
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-[216px] bg-white border-r border-[#e0e0e0] flex-col z-40">
        <Brand />
        <SidebarNav />
        <div className="px-4 py-3 border-t border-[#f0f0f0] flex items-center gap-2 text-[11px] text-[#8d8d8d]">
          <Database className="h-3.5 w-3.5 text-[#16a34a]" />
          <span>云数据库已连接</span>
        </div>
      </aside>

      {mobileOpen ? (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative h-full w-[220px] bg-white flex flex-col shadow-xl">
            <Brand />
            <SidebarNav onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="lg:ml-[216px] flex flex-col min-h-screen">
        <TopNavigation
          title={current?.title || "仪表盘"}
          alerts={alerts}
          onToggleSidebar={() => setMobileOpen((prev) => !prev)}
        />
        <main className="flex-1 p-4 lg:p-6">
          {role === "guest" ? (
            <div className="bg-white border border-[#e0e0e0] rounded-sm py-20 flex flex-col items-center text-center px-6">
              <p className="text-[15px] text-[#161616] font-medium">当前登录账号没有后台访问权限</p>
              <p className="text-[12px] text-[#8d8d8d] mt-1 max-w-md">
                你的邮箱未绑定任何员工账号。如需开通，请联系超级管理员在「账号管理」中添加你的邮箱并分配角色。
              </p>
            </div>
          ) : permitted ? (
            <Outlet />
          ) : (
            <div className="bg-white border border-[#e0e0e0] rounded-sm py-20 flex flex-col items-center text-center">
              <p className="text-[15px] text-[#161616] font-medium">当前角色无权访问该模块</p>
              <p className="text-[12px] text-[#8d8d8d] mt-1">
                如需开通，请让超级管理员在「账号管理」中调整你的角色
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
