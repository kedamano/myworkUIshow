import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Boxes,
  AlertTriangle,
  PackageX,
  ArrowDownToLine,
  Search,
  RefreshCw,
  Plus,
  Minus,
  CheckCircle2,
  Undo2,
  Pencil,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  adjustSkuStock,
  adjustStock,
  cancelPurchaseOrder,
  createPurchaseOrder,
  deletePurchaseOrder,
  fetchInventoryOverview,
  fetchProductSkus,
  fetchProducts,
  fetchPurchaseOrders,
  fetchStockLogs,
  fetchStockWithLock,
  receivePurchaseOrder,
  reversePurchaseOrder,
  specText,
  updatePurchaseOrder,
  PURCHASE_STATUS,
} from "../services/database";
import { EmptyState, Field, Kpi, PageHeader, Pagination, ghostBtn, inputClass, primaryBtn } from "./common/PageElements";
import { Modal } from "./common/Overlays";
import { PRODUCT_STATUS, Pill } from "./common/StatusPill";
import { fmtDateTime, fmtMoney, fmtNumber } from "@/lib/format";
import { useStaff } from "@/contexts/StaffContext";
import { canAdjustStock } from "@/lib/permissions";

const PAGE_SIZE = 10;

/** 从 operator 字段提取操作人名称（兼容 JSON 对象和纯字符串两种格式） */
const formatOperator = (operator) => {
  if (!operator) return "-";
  const raw = String(operator).trim();
  if (raw.startsWith("{")) {
    try {
      const obj = JSON.parse(raw);
      return obj.name || raw;
    } catch {
      return raw;
    }
  }
  return raw;
};

const InventoryManagement = () => {
  const { role } = useStaff();
  const adjustable = canAdjustStock(role);
  const [tab, setTab] = useState("stock");
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  const [products, setProducts] = useState([]);
  const [productTotal, setProductTotal] = useState(0);
  const [productPage, setProductPage] = useState(1);
  const [productSearch, setProductSearch] = useState("");
  const [productKeyword, setProductKeyword] = useState("");
  const [productFilter, setProductFilter] = useState("all");

  const [logs, setLogs] = useState([]);
  const [logTotal, setLogTotal] = useState(0);
  const [logPage, setLogPage] = useState(1);
  const [logSearch, setLogSearch] = useState("");
  const [logKeyword, setLogKeyword] = useState("");

  const [productOptions, setProductOptions] = useState([]);
  const [purchaseList, setPurchaseList] = useState([]);
  const [purchaseTotal, setPurchaseTotal] = useState(0);
  const [purchasePage, setPurchasePage] = useState(1);
  const [purchaseFilter, setPurchaseFilter] = useState("all");
  const [purchaseSearch, setPurchaseSearch] = useState("");
  const [purchaseKeyword, setPurchaseKeyword] = useState("");
  const [poFormOpen, setPoFormOpen] = useState(false);
  const [poForm, setPoForm] = useState(null);
  const [poSkus, setPoSkus] = useState([]);
  const [poSaving, setPoSaving] = useState(false);
  const [poError, setPoError] = useState("");

  const [target, setTarget] = useState(null);
  const [targetSkus, setTargetSkus] = useState([]);
  const [skuAmounts, setSkuAmounts] = useState({});
  const [moveType, setMoveType] = useState("in");
  const [quantity, setQuantity] = useState("");
  const [remark, setRemark] = useState("");
  const [saving, setSaving] = useState(false);

  const loadOverview = async () => {
    try {
      const data = await fetchInventoryOverview();
      setOverview(data);
    } catch (error) {
      console.error(error);
    }
  };

  const loadStock = async () => {
    setLoading(true);
    try {
      const list = await fetchStockWithLock();
      const keyword = productKeyword.trim().toLowerCase();
      const filtered = list.filter((row) => {
        if (productFilter === "low_stock" && !(row.stock > 0 && row.stock < row.safety)) return false;
        if (productFilter === "out_of_stock" && row.stock > 0) return false;
        if (keyword && !String(row.name || "").toLowerCase().includes(keyword)) return false;
        return true;
      });
      const start = (productPage - 1) * PAGE_SIZE;
      setProducts(filtered.slice(start, start + PAGE_SIZE));
      setProductTotal(filtered.length);
    } catch (error) {
      console.error(error);
      toast.error(error.message || "加载库存失败");
    } finally {
      setLoading(false);
    }
  };

  const loadPurchases = async () => {
    setLoading(true);
    try {
      const list = await fetchPurchaseOrders({
        status: purchaseFilter,
        search: purchaseKeyword,
        page: purchasePage,
        pageSize: PAGE_SIZE,
      });
      setPurchaseList(list.data);
      setPurchaseTotal(list.total);
    } catch (error) {
      console.error(error);
      toast.error(error.message || "加载采购单失败");
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    setLoading(true);
    try {
      const list = await fetchStockLogs({ search: logKeyword, page: logPage, pageSize: PAGE_SIZE });
      setLogs(list.data);
      setLogTotal(list.total);
    } catch (error) {
      console.error(error);
      toast.error(error.message || "加载库存流水失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
    fetchProducts({ page: 1, pageSize: 500 })
      .then((list) => setProductOptions(list.data || []))
      .catch(() => setProductOptions([]));
  }, []);

  useEffect(() => {
    if (tab === "stock") loadStock();
    else if (tab === "purchase") loadPurchases();
    else loadLogs();
  }, [
    tab,
    productKeyword,
    productFilter,
    productPage,
    purchaseFilter,
    purchaseKeyword,
    purchasePage,
    logKeyword,
    logPage,
  ]);

  useEffect(() => {
    if (!poForm?.product_id) {
      setPoSkus([]);
      return undefined;
    }
    let alive = true;
    fetchProductSkus(poForm.product_id)
      .then((list) => {
        if (alive) setPoSkus(list);
      })
      .catch(() => {
        if (alive) setPoSkus([]);
      });
    return () => {
      alive = false;
    };
  }, [poForm?.product_id]);

  const refreshAll = async () => {
    await loadOverview();
    if (tab === "stock") await loadStock();
    else if (tab === "purchase") await loadPurchases();
    else await loadLogs();
  };

  const openAdjust = async (product, type = "in") => {
    setTarget(product);
    setMoveType(type);
    setQuantity("");
    setRemark("");
    setTargetSkus([]);
    setSkuAmounts({});
    try {
      const list = await fetchProductSkus(product.id);
      if (list.length) setTargetSkus(list);
    } catch (error) {
      toast.error(error.message || "加载 SKU 失败");
    }
  };

  const handleAdjust = async () => {
    if (!target) return;
    setSaving(true);
    try {
      const note = remark.trim() || (moveType === "in" ? "采购入库" : "手动出库");

      if (targetSkus.length) {
        const entries = targetSkus
          .map((sku) => ({ sku, amount: Number(skuAmounts[sku.id]) || 0 }))
          .filter((entry) => entry.amount > 0);
        if (!entries.length) {
          toast.error("请至少为一个 SKU 填写大于 0 的数量");
          return;
        }
        for (const entry of entries) {
          await adjustSkuStock(
            entry.sku.id,
            moveType === "in" ? entry.amount : -entry.amount,
            note
          );
        }
        toast.success(`${target.name} 已更新 ${entries.length} 个 SKU 的库存`);
      } else {
        const amount = Number(quantity);
        if (!amount || amount <= 0) {
          toast.error("请输入大于 0 的数量");
          return;
        }
        await adjustStock(target.id, moveType === "in" ? amount : -amount, note);
        toast.success(`${target.name} 已${moveType === "in" ? "入库" : "出库"} ${amount} 件`);
      }

      setTarget(null);
      setTargetSkus([]);
      setSkuAmounts({});
      await refreshAll();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "库存调整失败");
    } finally {
      setSaving(false);
    }
  };

  const openPoCreate = () => {
    setPoForm({
      id: null,
      product_id: "",
      sku_id: "",
      quantity: "",
      unit_cost: "",
      supplier: "",
      expected_at: "",
      remark: "",
    });
    setPoError("");
    setPoFormOpen(true);
  };

  const openPoEdit = (row) => {
    setPoForm({
      id: row.id,
      product_id: row.product_id,
      sku_id: row.sku_id || "",
      quantity: row.quantity,
      unit_cost: row.unit_cost ?? "",
      supplier: row.supplier || "",
      expected_at: row.expected_at ? String(row.expected_at).slice(0, 10) : "",
      remark: row.remark || "",
    });
    setPoError("");
    setPoFormOpen(true);
  };

  const handleSavePo = async () => {
    if (!poForm.product_id) {
      setPoError("请选择商品");
      return;
    }
    if (poSkus.length && !poForm.sku_id) {
      setPoError("该商品包含多个规格，请选择要补货的规格");
      return;
    }
    if (!Number(poForm.quantity) || Number(poForm.quantity) <= 0) {
      setPoError("请填写大于 0 的采购数量");
      return;
    }
    setPoSaving(true);
    setPoError("");
    try {
      if (poForm.id) {
        await updatePurchaseOrder(poForm.id, poForm);
        toast.success("采购单已更新");
      } else {
        await createPurchaseOrder(poForm);
        toast.success("采购单已创建");
      }
      setPoFormOpen(false);
      setPoForm(null);
      await refreshAll();
    } catch (error) {
      console.error(error);
      setPoError(error.message || "保存失败");
    } finally {
      setPoSaving(false);
    }
  };

  const handleReceive = async (row) => {
    try {
      await receivePurchaseOrder(row.id);
      toast.success(`采购单 ${row.po_no} 已入库`);
      await refreshAll();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "入库失败");
    }
  };

  const handleReverse = async (row) => {
    if (!window.confirm(`确认撤销 ${row.po_no} 的入库？将扣回 ${row.quantity} 件库存。`)) return;
    try {
      await reversePurchaseOrder(row.id);
      toast.success(`采购单 ${row.po_no} 已撤销入库`);
      await refreshAll();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "撤销失败");
    }
  };

  const handleCancel = async (row) => {
    if (!window.confirm(`确认取消采购单 ${row.po_no}？`)) return;
    try {
      await cancelPurchaseOrder(row.id);
      toast.success(`采购单 ${row.po_no} 已取消`);
      await refreshAll();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "取消失败");
    }
  };

  const handleDeletePo = async (row) => {
    if (!window.confirm(`确认删除采购单 ${row.po_no}？删除后不可恢复。`)) return;
    try {
      await deletePurchaseOrder(row.id);
      toast.success(`采购单 ${row.po_no} 已删除`);
      await refreshAll();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "删除失败");
    }
  };

  return (
    <div>
      <PageHeader
        title="库存管理"
        description="监控库存预警，执行入库与出库并保留完整流水"
        actions={
          <button type="button" className={ghostBtn} onClick={refreshAll} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> 刷新
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Kpi label="总库存" value={overview ? fmtNumber(overview.totalStock) : "-"} icon={Boxes} tone="blue" loading={!overview} />
        <Kpi label="低库存商品" value={overview ? overview.lowStock : "-"} hint="库存低于安全库存" icon={AlertTriangle} tone="amber" loading={!overview} />
        <Kpi label="缺货 SKU" value={overview ? overview.outOfStock : "-"} icon={PackageX} tone="red" loading={!overview} />
        <Kpi label="近 30 天入库" value={overview ? fmtNumber(overview.inbound30d) : "-"} icon={ArrowDownToLine} tone="green" loading={!overview} />
      </div>

      <div className="bg-white border border-[#e0e0e0] rounded-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-[#f0f0f0]">
          <div className="flex items-center gap-1">
            {[
              { key: "stock", label: "库存列表" },
              { key: "purchase", label: "采购补货" },
              { key: "logs", label: "库存流水" },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={`px-3 py-1.5 rounded-sm text-[12px] transition-colors ${
                  tab === item.key ? "bg-[#0f62fe] text-white" : "text-[#525252] hover:bg-[#f4f4f4]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === "stock" ? (
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={productFilter}
                onChange={(event) => {
                  setProductFilter(event.target.value);
                  setProductPage(1);
                }}
                className={`${inputClass} !w-32`}
              >
                <option value="all">全部库存</option>
                <option value="low_stock">低库存</option>
                <option value="out_of_stock">已缺货</option>
              </select>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  setProductPage(1);
                  setProductKeyword(productSearch.trim());
                }}
                className="relative"
              >
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8d8d8d]" />
                <input
                  value={productSearch}
                  onChange={(event) => setProductSearch(event.target.value)}
                  placeholder="搜索商品"
                  className={`${inputClass} pl-9 w-48`}
                />
              </form>
            </div>
          ) : tab === "purchase" ? (
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={purchaseFilter}
                onChange={(event) => {
                  setPurchaseFilter(event.target.value);
                  setPurchasePage(1);
                }}
                className={`${inputClass} !w-32`}
              >
                <option value="all">全部状态</option>
                <option value="pending">待收货</option>
                <option value="received">已入库</option>
                <option value="cancelled">已取消</option>
              </select>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  setPurchasePage(1);
                  setPurchaseKeyword(purchaseSearch.trim());
                }}
                className="relative"
              >
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8d8d8d]" />
                <input
                  value={purchaseSearch}
                  onChange={(event) => setPurchaseSearch(event.target.value)}
                  placeholder="搜索单号 / 供应商 / 商品"
                  className={`${inputClass} pl-9 w-56`}
                />
              </form>
              {adjustable ? (
                <button type="button" className={primaryBtn} onClick={openPoCreate}>
                  <Plus className="h-3.5 w-3.5" /> 新建采购单
                </button>
              ) : null}
            </div>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setLogPage(1);
                setLogKeyword(logSearch.trim());
              }}
              className="relative"
            >
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8d8d8d]" />
              <input
                value={logSearch}
                onChange={(event) => setLogSearch(event.target.value)}
                placeholder="搜索商品名称"
                className={`${inputClass} pl-9 w-48`}
              />
            </form>
          )}
        </div>

        {loading ? (
          <EmptyState loading />
        ) : tab === "stock" ? (
          products.length === 0 ? (
            <EmptyState title="暂无商品" description="先去商品管理创建商品" />
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[960px] text-[13px]">
                <thead>
                  <tr className="bg-[#fafafa] border-b border-[#e0e0e0] text-left text-[12px] text-[#6f6f6f]">
                    <th className="px-3 py-2.5">商品</th>
                    <th className="px-3 py-2.5">分类</th>
                    <th className="px-3 py-2.5 text-right">当前库存</th>
                    <th className="px-3 py-2.5 text-right">锁定</th>
                    <th className="px-3 py-2.5 text-right">可用</th>
                    <th className="px-3 py-2.5 text-right">安全库存</th>
                    <th className="px-3 py-2.5">状态</th>
                    <th className="w-36 px-3 py-2.5 text-right">库存操作</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id} className="border-b border-[#f4f4f4] last:border-b-0 hover:bg-[#fafafa]">
                      <td className="px-3 py-3">
                        <p className="text-[#161616] font-medium">{product.name}</p>
                        <p className="text-[11px] text-[#a8a8a8]">PRD-{String(product.id).padStart(4, "0")}</p>
                      </td>
                      <td className="px-3 py-3 text-[#525252]">{product.category}</td>
                      <td className="px-3 py-3 text-right">
                        <span
                          className={
                            product.stock <= 0
                              ? "text-[#b91c1c] font-medium"
                              : product.belowSafety
                              ? "text-[#b45309] font-medium"
                              : "text-[#161616]"
                          }
                        >
                          {fmtNumber(product.stock)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        {product.locked > 0 ? (
                          <span className="text-[#b45309]">{fmtNumber(product.locked)}</span>
                        ) : (
                          <span className="text-[#a8a8a8]">0</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right text-[#161616]">{fmtNumber(product.available)}</td>
                      <td className="px-3 py-3 text-right text-[#6f6f6f]">{fmtNumber(product.safety)}</td>
                      <td className="px-3 py-3">
                        <Pill config={PRODUCT_STATUS[product.status]} fallback={product.status} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {adjustable ? (
                            <>
                              <button
                                type="button"
                                onClick={() => openAdjust(product, "in")}
                                className="inline-flex items-center gap-1 text-[12px] text-[#0f62fe] hover:bg-[#edf5ff] px-2 py-1 rounded"
                              >
                                <Plus className="h-3 w-3" /> 入库
                              </button>
                              <button
                                type="button"
                                onClick={() => openAdjust(product, "out")}
                                className="inline-flex items-center gap-1 text-[12px] text-[#525252] hover:bg-[#f4f4f4] px-2 py-1 rounded"
                              >
                                <Minus className="h-3 w-3" /> 出库
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : tab === "purchase" ? (
          purchaseList.length === 0 ? (
            <EmptyState
              title="暂无采购单"
              description={adjustable ? "点击右上角「新建采购单」创建补货计划" : "暂无补货计划"}
            />
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[980px] text-[13px]">
                <thead>
                  <tr className="bg-[#fafafa] border-b border-[#e0e0e0] text-left text-[12px] text-[#6f6f6f]">
                    <th className="px-3 py-2.5">采购单号</th>
                    <th className="px-3 py-2.5">商品 / 规格</th>
                    <th className="px-3 py-2.5 text-right">数量</th>
                    <th className="px-3 py-2.5 text-right">单价</th>
                    <th className="px-3 py-2.5">供应商</th>
                    <th className="px-3 py-2.5">预计到货</th>
                    <th className="px-3 py-2.5">状态</th>
                    <th className="w-44 px-3 py-2.5 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseList.map((row) => {
                    const status = PURCHASE_STATUS[row.status] || {
                      label: row.status,
                      color: "#525252",
                      bg: "#f4f4f4",
                    };
                    const skuLabel = row.product_skus?.sku_code
                      ? `${row.product_skus.sku_code}${specText(row.product_skus.specs) ? `（${specText(row.product_skus.specs)}）` : ""}`
                      : "单品";
                    return (
                      <tr key={row.id} className="border-b border-[#f4f4f4] last:border-b-0 hover:bg-[#fafafa]">
                        <td className="px-3 py-3">
                          <p className="text-[#161616] font-medium">{row.po_no}</p>
                          <p className="text-[11px] text-[#a8a8a8]">{fmtDateTime(row.created_at)}</p>
                        </td>
                        <td className="px-3 py-3">
                          <p className="text-[#161616]">{row.products?.name || `商品 #${row.product_id}`}</p>
                          <p className="text-[11px] text-[#a8a8a8]">{skuLabel}</p>
                        </td>
                        <td className="px-3 py-3 text-right text-[#161616]">{fmtNumber(row.quantity)}</td>
                        <td className="px-3 py-3 text-right text-[#525252]">
                          {row.unit_cost === null || row.unit_cost === undefined ? "-" : fmtMoney(row.unit_cost)}
                        </td>
                        <td className="px-3 py-3 text-[#525252]">{row.supplier || "-"}</td>
                        <td className="px-3 py-3 text-[#525252]">
                          {row.expected_at ? String(row.expected_at).slice(0, 10) : "-"}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className="inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium"
                            style={{ color: status.color, backgroundColor: status.bg }}
                          >
                            {status.label}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {adjustable ? (
                              <>
                                {row.status === "pending" ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleReceive(row)}
                                      className="inline-flex items-center gap-1 text-[12px] text-[#0f62fe] hover:bg-[#edf5ff] px-2 py-1 rounded"
                                    >
                                      <CheckCircle2 className="h-3 w-3" /> 入库
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openPoEdit(row)}
                                      className="inline-flex items-center gap-1 text-[12px] text-[#525252] hover:bg-[#f4f4f4] px-2 py-1 rounded"
                                    >
                                      <Pencil className="h-3 w-3" /> 编辑
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleCancel(row)}
                                      className="inline-flex items-center gap-1 text-[12px] text-[#b45309] hover:bg-[#fffbeb] px-2 py-1 rounded"
                                    >
                                      <XCircle className="h-3 w-3" /> 取消
                                    </button>
                                  </>
                                ) : row.status === "received" ? (
                                  <button
                                    type="button"
                                    onClick={() => handleReverse(row)}
                                    className="inline-flex items-center gap-1 text-[12px] text-[#b45309] hover:bg-[#fffbeb] px-2 py-1 rounded"
                                  >
                                    <Undo2 className="h-3 w-3" /> 撤销入库
                                  </button>
                                ) : null}
                                {row.status !== "received" ? (
                                  <button
                                    type="button"
                                    onClick={() => handleDeletePo(row)}
                                    className="inline-flex items-center gap-1 text-[12px] text-[#b91c1c] hover:bg-[#fef2f2] px-2 py-1 rounded"
                                  >
                                    <Trash2 className="h-3 w-3" /> 删除
                                  </button>
                                ) : null}
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : logs.length === 0 ? (
          <EmptyState title="暂无库存流水" description="执行入库或出库后会自动记录" />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[820px] text-[13px]">
              <thead>
                <tr className="bg-[#fafafa] border-b border-[#e0e0e0] text-left text-[12px] text-[#6f6f6f]">
                  <th className="px-3 py-2.5">时间</th>
                  <th className="px-3 py-2.5">商品</th>
                  <th className="px-3 py-2.5">类型</th>
                  <th className="px-3 py-2.5 text-right">数量</th>
                  <th className="px-3 py-2.5 text-right">变动前 → 变动后</th>
                  <th className="px-3 py-2.5">操作人</th>
                  <th className="px-3 py-2.5">备注</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-[#f4f4f4] last:border-b-0 hover:bg-[#fafafa]">
                    <td className="px-3 py-3 text-[#6f6f6f]">{fmtDateTime(log.created_at)}</td>
                    <td className="px-3 py-3 text-[#161616]">{log.product_name}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium ${log.type === "in" ? "text-[#15803d] bg-[#f0fdf4]" : "text-[#b45309] bg-[#fffbeb]"}`}>
                        {log.type === "in" ? "入库" : "出库"}
                      </span>
                    </td>
                    <td className={`px-3 py-3 text-right font-medium ${log.type === "in" ? "text-[#15803d]" : "text-[#b45309]"}`}>
                      {log.type === "in" ? "+" : "-"}{log.quantity}
                    </td>
                    <td className="px-3 py-3 text-right text-[#525252]">
                      {log.before_stock} → {log.after_stock}
                    </td>
                    <td className="px-3 py-3 text-[#525252]">{formatOperator(log.operator)}</td>
                    <td className="px-3 py-3 text-[#6f6f6f]">{log.remark || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "stock" ? (
          <Pagination page={productPage} pageSize={PAGE_SIZE} total={productTotal} onChange={setProductPage} />
        ) : tab === "purchase" ? (
          <Pagination page={purchasePage} pageSize={PAGE_SIZE} total={purchaseTotal} onChange={setPurchasePage} />
        ) : (
          <Pagination page={logPage} pageSize={PAGE_SIZE} total={logTotal} onChange={setLogPage} />
        )}
      </div>

      <Modal
        open={poFormOpen}
        onClose={() => {
          setPoFormOpen(false);
          setPoForm(null);
        }}
        title={poForm?.id ? "编辑采购单" : "新建采购单"}
        description="采购单创建后为「待收货」，入库时自动增加库存并记录流水"
        footer={
          <>
            <button
              type="button"
              className={ghostBtn}
              onClick={() => {
                setPoFormOpen(false);
                setPoForm(null);
              }}
              disabled={poSaving}
            >
              取消
            </button>
            <button type="button" className={primaryBtn} onClick={handleSavePo} disabled={poSaving}>
              {poSaving ? "保存中..." : "保存采购单"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          {poError ? (
            <div className="px-3 py-2 border border-[#fecaca] bg-[#fef2f2] text-[#b91c1c] text-[12px] rounded-sm">
              {poError}
            </div>
          ) : null}
          <Field label="采购商品">
            <select
              value={poForm?.product_id || ""}
              onChange={(event) => setPoForm({ ...poForm, product_id: event.target.value, sku_id: "" })}
              className={inputClass}
              disabled={Boolean(poForm?.id)}
            >
              <option value="">请选择商品</option>
              {productOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}（PRD-{String(item.id).padStart(4, "0")}）
                </option>
              ))}
            </select>
          </Field>
          {poSkus.length ? (
            <Field label="补货规格" hint="该商品按规格管理库存，必须指定规格">
              <select
                value={poForm?.sku_id || ""}
                onChange={(event) => setPoForm({ ...poForm, sku_id: event.target.value })}
                className={inputClass}
              >
                <option value="">请选择规格</option>
                {poSkus.map((sku) => (
                  <option key={sku.id} value={sku.id}>
                    {specText(sku.specs) || sku.sku_code}（库存 {sku.stock}）
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <Field label="采购数量">
              <input
                type="number"
                min="1"
                step="1"
                value={poForm?.quantity ?? ""}
                onChange={(event) => setPoForm({ ...poForm, quantity: event.target.value })}
                placeholder="请输入数量"
                className={inputClass}
              />
            </Field>
            <Field label="单价" hint="可选">
              <input
                type="number"
                min="0"
                step="0.01"
                value={poForm?.unit_cost ?? ""}
                onChange={(event) => setPoForm({ ...poForm, unit_cost: event.target.value })}
                placeholder="0.00"
                className={inputClass}
              />
            </Field>
            <Field label="供应商" hint="可选">
              <input
                value={poForm?.supplier || ""}
                onChange={(event) => setPoForm({ ...poForm, supplier: event.target.value })}
                placeholder="例如：杭州某某供应商"
                className={inputClass}
              />
            </Field>
            <Field label="预计到货" hint="可选">
              <input
                type="date"
                value={poForm?.expected_at || ""}
                onChange={(event) => setPoForm({ ...poForm, expected_at: event.target.value })}
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="备注" hint="可选">
            <input
              value={poForm?.remark || ""}
              onChange={(event) => setPoForm({ ...poForm, remark: event.target.value })}
              placeholder="例如：季度补货"
              className={inputClass}
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        title={`${moveType === "in" ? "入库" : "出库"} · ${target?.name || ""}`}
        description={`当前库存 ${target?.stock ?? 0} 件，操作后会自动记录流水`}
        footer={
          <>
            <button type="button" className={ghostBtn} onClick={() => setTarget(null)} disabled={saving}>
              取消
            </button>
            <button type="button" className={primaryBtn} onClick={handleAdjust} disabled={saving}>
              {saving ? "处理中..." : "确认"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="操作类型">
            <div className="flex gap-2">
              {[
                { key: "in", label: "入库" },
                { key: "out", label: "出库" },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setMoveType(item.key)}
                  className={`flex-1 px-3 py-2 rounded-sm text-[13px] border transition-colors ${
                    moveType === item.key
                      ? "border-[#0f62fe] bg-[#edf5ff] text-[#0f62fe]"
                      : "border-[#e0e0e0] text-[#525252] hover:bg-[#f4f4f4]"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </Field>
          {targetSkus.length ? (
            <Field label="按 SKU 填写数量" hint="只填写需要变动的 SKU，留空按 0 处理">
              <div className="border border-[#e0e0e0] rounded-sm divide-y divide-[#f0f0f0]">
                {targetSkus.map((sku) => (
                  <div key={sku.id} className="flex items-center gap-3 px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-[#161616] truncate">
                        {specText(sku.specs) || sku.sku_code}
                      </p>
                      <p className="text-[11px] text-[#a8a8a8]">{sku.sku_code}</p>
                    </div>
                    <span className="text-[12px] text-[#6f6f6f] whitespace-nowrap">
                      现有 {sku.stock}
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={skuAmounts[sku.id] ?? ""}
                      onChange={(event) =>
                        setSkuAmounts((prev) => ({ ...prev, [sku.id]: event.target.value }))
                      }
                      placeholder="0"
                      className={`${inputClass} !w-24 text-right`}
                    />
                  </div>
                ))}
              </div>
            </Field>
          ) : (
            <Field label="数量">
              <input
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder="请输入数量"
                className={inputClass}
              />
            </Field>
          )}
          <Field label="备注">
            <input
              value={remark}
              onChange={(event) => setRemark(event.target.value)}
              placeholder={moveType === "in" ? "例如：采购入库" : "例如：破损报废"}
              className={inputClass}
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
};

export default InventoryManagement;
