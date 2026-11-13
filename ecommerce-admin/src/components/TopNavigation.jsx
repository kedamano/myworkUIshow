import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Bell, ChevronDown, LogOut, Menu, Search, ShoppingCart, User, UserCog, AlertTriangle, Boxes } from "lucide-react";
import { navItems } from "@/nav-items";
import { useStaff } from "@/contexts/StaffContext";
import { ROLE_LABEL } from "@/lib/permissions";

const TopNavigation = ({ title, alerts = {}, onToggleSidebar }) => {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const wrapRef = useRef(null);
  const { staff: currentStaff, role } = useStaff();

  const results = useMemo(() => {
    const value = keyword.trim();
    if (!value) return [];
    return navItems.filter((item) => item.title.includes(value)).slice(0, 5);
  }, [keyword]);

  useEffect(() => {
    const handler = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setSearchOpen(false);
        setNoticeOpen(false);
        setAccountOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const noticeCount = (alerts.pendingOrders || 0) + (alerts.pendingAfterSales || 0) + (alerts.lowStock || 0);

  const go = (to) => {
    setSearchOpen(false);
    setNoticeOpen(false);
    setAccountOpen(false);
    setKeyword("");
    navigate(to);
  };

  const handleLogout = async () => {
    setAccountOpen(false);
    const sdk = typeof window !== "undefined" ? window.NoCode : null;
    try {
      if (sdk && typeof sdk.logout === "function") {
        await sdk.logout();
        return;
      }
      if (sdk && typeof sdk.signOut === "function") {
        await sdk.signOut();
        return;
      }
    } catch (error) {
      console.error(error);
    }
    toast.info("登录状态由 NoCode 平台统一管理，可在登录页退出");
  };

  return (
    <header className="sticky top-0 z-30 h-14 bg-white border-b border-[#e0e0e0] flex items-center justify-between gap-3 px-4 lg:px-6">
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="lg:hidden p-1.5 rounded hover:bg-[#f4f4f4] text-[#525252]"
          aria-label="打开菜单"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h2 className="text-[15px] font-medium text-[#161616] truncate">{title}</h2>
        <span className="hidden sm:inline text-[11px] text-[#a8a8a8]">/ 电商运营平台</span>
      </div>

      <div className="flex items-center gap-1.5" ref={wrapRef}>
        <div className="relative">
          <div className="hidden md:flex items-center gap-2 w-56 px-3 py-1.5 border border-[#e0e0e0] rounded-sm bg-[#fafafa] focus-within:border-[#0f62fe] transition-colors">
            <Search className="h-3.5 w-3.5 text-[#8d8d8d]" />
            <input
              type="text"
              value={keyword}
              placeholder="搜索功能模块..."
              onChange={(event) => {
                setKeyword(event.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              className="flex-1 bg-transparent text-[12px] outline-none placeholder:text-[#a8a8a8]"
            />
          </div>
          {searchOpen && results.length > 0 ? (
            <div className="absolute right-0 mt-1 w-56 bg-white border border-[#e0e0e0] rounded-sm shadow-lg py-1">
              {results.map((item) => (
                <button
                  key={item.to}
                  type="button"
                  onClick={() => go(item.to)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[#525252] hover:bg-[#f4f4f4]"
                >
                  {item.icon}
                  {item.title}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setNoticeOpen((prev) => !prev)}
            className="relative w-8 h-8 flex items-center justify-center rounded hover:bg-[#f4f4f4] text-[#525252]"
            aria-label="待办提醒"
          >
            <Bell className="h-4 w-4" />
            {noticeCount > 0 ? (
              <span className="absolute top-1 right-1 min-w-[6px] h-[6px] bg-[#da1e28] rounded-full" />
            ) : null}
          </button>
          {noticeOpen ? (
            <div className="absolute right-0 mt-1 w-72 bg-white border border-[#e0e0e0] rounded-sm shadow-lg py-1">
              <div className="px-3 py-2 border-b border-[#f0f0f0]">
                <p className="text-[11px] font-medium text-[#6f6f6f]">待办提醒</p>
              </div>
              <button
                type="button"
                onClick={() => go("/orders")}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-[13px] text-[#525252] hover:bg-[#f4f4f4]"
              >
                <span className="flex items-center gap-2">
                  <ShoppingCart className="h-3.5 w-3.5 text-[#b45309]" />
                  待处理订单
                </span>
                <span className="text-[#161616] font-medium">{alerts.pendingOrders || 0}</span>
              </button>
              <button
                type="button"
                onClick={() => go("/aftersales")}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-[13px] text-[#525252] hover:bg-[#f4f4f4]"
              >
                <span className="flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-[#b91c1c]" />
                  待审核售后
                </span>
                <span className="text-[#161616] font-medium">{alerts.pendingAfterSales || 0}</span>
              </button>
              <button
                type="button"
                onClick={() => go("/inventory")}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-[13px] text-[#525252] hover:bg-[#f4f4f4]"
              >
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-[#dc2626]" />
                  库存预警
                </span>
                <span className="text-[#161616] font-medium">{alerts.lowStock || 0}</span>
              </button>
              <div className="border-t border-[#f0f0f0] px-3 py-2">
                <p className="text-[10px] text-[#a8a8a8]">点击对应项可快速跳转处理</p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setAccountOpen((prev) => !prev)}
            className="flex items-center gap-2 pl-2 ml-1 pr-1.5 py-1 border-l border-[#e0e0e0] rounded-sm hover:bg-[#f4f4f4] transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-[#edf5ff] flex items-center justify-center">
              <User className="h-3.5 w-3.5 text-[#0f62fe]" />
            </div>
            <div className="hidden sm:block leading-tight text-left">
              <p className="text-[12px] text-[#161616]">{currentStaff?.name || "管理员"}</p>
              <p className="text-[10px] text-[#a8a8a8]">{ROLE_LABEL[role] || "运营负责人"}</p>
            </div>
            <ChevronDown
              className={`hidden sm:block h-3 w-3 text-[#a8a8a8] transition-transform ${accountOpen ? "rotate-180" : ""}`}
            />
          </button>
          {accountOpen ? (
            <div className="absolute right-0 mt-1 w-56 bg-white border border-[#e0e0e0] rounded-sm shadow-lg py-1">
              <div className="px-3 py-2 border-b border-[#f0f0f0]">
                <p className="text-[12px] text-[#161616] font-medium">{currentStaff?.name || "管理员"}</p>
                <p className="text-[11px] text-[#8d8d8d] mt-0.5 truncate">
                  {currentStaff?.email || "未绑定邮箱"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => go("/accounts")}
                className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[#525252] hover:bg-[#f4f4f4]"
              >
                <UserCog className="h-3.5 w-3.5 text-[#0f62fe]" />
                账号管理
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[#525252] hover:bg-[#f4f4f4]"
              >
                <LogOut className="h-3.5 w-3.5 text-[#b91c1c]" />
                退出登录
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
};

export default TopNavigation;
