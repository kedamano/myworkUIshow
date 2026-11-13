import {
  LayoutDashboard,
  ShoppingCart,
  RotateCcw,
  Package,
  Boxes,
  Users,
  Ticket,
  BarChart3,
  UserCog,
  ScrollText,
  Tags,
  Building2,
  DollarSign,
} from "lucide-react";
import Index from "./pages/Index.jsx";
import OrderProcessing from "./components/OrderProcessing.jsx";
import AfterSalesManagement from "./components/AfterSalesManagement.jsx";
import ProductManagement from "./components/ProductManagement.jsx";
import InventoryManagement from "./components/InventoryManagement.jsx";
import CategoryManagement from "./components/CategoryManagement.jsx";
import SupplierManagement from "./components/SupplierManagement.jsx";
import CustomerManagement from "./components/CustomerManagement.jsx";
import MarketingManagement from "./components/MarketingManagement.jsx";
import Analytics from "./components/Analytics.jsx";
import FinancialManagement from "./components/FinancialManagement.jsx";
import AccountManagement from "./components/AccountManagement.jsx";
import OperationLogs from "./components/OperationLogs.jsx";

/**
 * 导航与路由的单一数据源，App.jsx 与 AppLayout 共用。
 */
export const navItems = [
  {
    title: "仪表盘",
    to: "/",
    perm: "dashboard",
    group: "概览",
    icon: <LayoutDashboard className="h-4 w-4" />,
    page: <Index />,
  },
  {
    title: "订单处理",
    to: "/orders",
    perm: "orders",
    group: "交易",
    icon: <ShoppingCart className="h-4 w-4" />,
    page: <OrderProcessing />,
  },
  {
    title: "售后退款",
    to: "/aftersales",
    perm: "aftersales",
    group: "交易",
    icon: <RotateCcw className="h-4 w-4" />,
    page: <AfterSalesManagement />,
  },
  {
    title: "商品管理",
    to: "/products",
    perm: "products",
    group: "商品与库存",
    icon: <Package className="h-4 w-4" />,
    page: <ProductManagement />,
  },
  {
    title: "库存管理",
    to: "/inventory",
    perm: "inventory",
    group: "商品与库存",
    icon: <Boxes className="h-4 w-4" />,
    page: <InventoryManagement />,
  },
  {
    title: "商品分类",
    to: "/categories",
    perm: "products",
    group: "商品与库存",
    icon: <Tags className="h-4 w-4" />,
    page: <CategoryManagement />,
  },
  {
    title: "供应商管理",
    to: "/suppliers",
    perm: "inventory",
    group: "商品与库存",
    icon: <Building2 className="h-4 w-4" />,
    page: <SupplierManagement />,
  },
  {
    title: "客户会员",
    to: "/customers",
    perm: "customers",
    group: "客户与营销",
    icon: <Users className="h-4 w-4" />,
    page: <CustomerManagement />,
  },
  {
    title: "优惠券",
    to: "/marketing",
    perm: "marketing",
    group: "客户与营销",
    icon: <Ticket className="h-4 w-4" />,
    page: <MarketingManagement />,
  },
  {
    title: "数据分析",
    to: "/analytics",
    perm: "analytics",
    group: "分析",
    icon: <BarChart3 className="h-4 w-4" />,
    page: <Analytics />,
  },
  {
    title: "财务对账",
    to: "/finance",
    perm: "analytics",
    group: "分析",
    icon: <DollarSign className="h-4 w-4" />,
    page: <FinancialManagement />,
  },
  {
    title: "账号管理",
    to: "/accounts",
    perm: "accounts",
    group: "系统",
    icon: <UserCog className="h-4 w-4" />,
    page: <AccountManagement />,
  },
  {
    title: "操作日志",
    to: "/logs",
    perm: "logs",
    group: "系统",
    icon: <ScrollText className="h-4 w-4" />,
    page: <OperationLogs />,
  },
];

export const navGroups = ["概览", "交易", "商品与库存", "客户与营销", "分析", "系统"];
