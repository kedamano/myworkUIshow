import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Tag,
  Package,
  Edit3,
  Trash2,
  Image as ImageIcon,
  RefreshCw,
  ArrowUpCircle,
  ArrowDownCircle,
  AlertTriangle,
  TrendingUp,
  Layers,
  X,
} from "lucide-react";
import {
  bulkUpdateProductStatus,
  createProduct,
  deleteProducts,
  fetchAllSkus,
  fetchCategories,
  fetchProductStats,
  fetchProductSkus,
  fetchProducts,
  saveProductSkus,
  updateProduct,
} from "../services/database";
import { EmptyState, Field, Kpi, PageHeader, Pagination, ghostBtn, inputClass, primaryBtn } from "./common/PageElements";
import { Drawer, Modal } from "./common/Overlays";
import { PRODUCT_STATUS, Pill } from "./common/StatusPill";
import { useStaff } from "@/contexts/StaffContext";
import { canDeleteRecords, canEditProducts } from "@/lib/permissions";
import { fmtMoney, fmtNumber } from "@/lib/format";

const PAGE_SIZE = 8;

const toSkuRows = (skus) =>
  (skus || []).map((sku) => ({
    key: `sku-${sku.id}`,
    sku_code: sku.sku_code || "",
    price: sku.price ?? "",
    stock: sku.stock ?? 0,
    status: sku.status || "active",
    specs: Object.entries(sku.specs || {}).map(([key, value]) => ({ key, value })),
  }));

const emptyForm = {
  name: "",
  category: "",
  price: "",
  cost: "",
  stock: "",
  safety_stock: 50,
  image_url: "",
  description: "",
  status: "active",
  sort_order: 999,
};

const ProductManagement = () => {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState([]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [confirmState, setConfirmState] = useState(null);

  const [skuProduct, setSkuProduct] = useState(null);
  const [skuRows, setSkuRows] = useState([]);
  const [skuLoading, setSkuLoading] = useState(false);
  const [skuSaving, setSkuSaving] = useState(false);
  const [skuError, setSkuError] = useState("");
  const [skuCounts, setSkuCounts] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const [list, stat, cats, skus] = await Promise.all([
        fetchProducts({ search: keyword, category, status, page, pageSize: PAGE_SIZE }),
        fetchProductStats(),
        fetchCategories(),
        fetchAllSkus(),
      ]);
      setRows(list.data);
      setTotal(list.total);
      setStats(stat);
      setCategories(cats);
      const countMap = (skus || []).reduce((acc, sku) => {
        acc[sku.product_id] = (acc[sku.product_id] || 0) + 1;
        return acc;
      }, {});
      setSkuCounts(countMap);
    } catch (error) {
      console.error(error);
      toast.error(error.message || "加载商品失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [keyword, category, status, page]);

  useEffect(() => {
    setSelected([]);
  }, [keyword, category, status, page]);

  const allChecked = rows.length > 0 && selected.length === rows.length;

  const toggleAll = () => {
    setSelected(allChecked ? [] : rows.map((row) => row.id));
  };

  const toggleOne = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (product) => {
    setEditing(product);
    setForm({
      name: product.name || "",
      category: product.category || "",
      price: product.price ?? "",
      cost: product.cost ?? "",
      stock: product.stock ?? "",
      safety_stock: product.safety_stock ?? 50,
      image_url: product.image_url || "",
      description: product.description || "",
      status: product.status === "inactive" ? "inactive" : "active",
      sort_order: product.sort_order ?? 999,
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("请填写商品名称");
      return;
    }
    if (form.price === "" || Number(form.price) < 0) {
      toast.error("请填写正确的售价");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category.trim() || "未分类",
        price: Number(form.price) || 0,
        cost: Number(form.cost) || 0,
        stock: Number(form.stock) || 0,
        safety_stock: Math.max(0, Number(form.safety_stock) || 0),
        image_url: form.image_url.trim() || null,
        description: form.description.trim() || null,
        status: form.status,
        sort_order: Number(form.sort_order) || 999,
      };
      if (editing) {
        await updateProduct(editing.id, payload);
        toast.success("商品已更新");
      } else {
        await createProduct(payload);
        toast.success("商品已创建");
      }
      setFormOpen(false);
      await load();
    } catch (error) {
      console.error(error);
      toast.error("保存失败：" + (error.message || "未知错误"));
    } finally {
      setSaving(false);
    }
  };

  const handleBatchStatus = async (nextStatus) => {
    if (!selected.length) return;
    try {
      await bulkUpdateProductStatus(selected, nextStatus);
      toast.success(`已将 ${selected.length} 个商品${nextStatus === "active" ? "上架" : "下架"}`);
      setSelected([]);
      await load();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "批量操作失败");
    }
  };

  const requestDelete = (ids) => {
    setConfirmState({
      title: ids.length > 1 ? "批量删除商品" : "删除商品",
      description: `将永久删除 ${ids.length} 个商品，删除后不可恢复。`,
      onConfirm: async () => {
        try {
          await deleteProducts(ids);
          toast.success("已删除");
          setSelected([]);
          setConfirmState(null);
          await load();
        } catch (error) {
          console.error(error);
          toast.error(error.message || "删除失败");
        }
      },
    });
  };

  /* ---------- SKU 多规格 ---------- */

  const openSkus = async (product) => {
    setSkuProduct(product);
    setSkuRows([]);
    setSkuError("");
    setSkuLoading(true);
    try {
      const list = await fetchProductSkus(product.id);
      setSkuRows(toSkuRows(list));
    } catch (error) {
      toast.error(error.message || "加载规格失败");
    } finally {
      setSkuLoading(false);
    }
  };

  const addSkuRow = () => {
    setSkuRows((prev) => [
      ...prev,
      {
        key: `new-${Date.now()}-${prev.length}`,
        sku_code: "",
        price: "",
        stock: 0,
        status: "active",
        specs: [],
      },
    ]);
  };

  const updateSkuRow = (rowKey, patch) => {
    setSkuRows((prev) => prev.map((row) => (row.key === rowKey ? { ...row, ...patch } : row)));
  };

  const removeSkuRow = (rowKey) => {
    setSkuRows((prev) => prev.filter((row) => row.key !== rowKey));
  };

  const addSpec = (rowKey) => {
    setSkuRows((prev) =>
      prev.map((row) =>
        row.key === rowKey ? { ...row, specs: [...row.specs, { key: "", value: "" }] } : row
      )
    );
  };

  const updateSpec = (rowKey, index, patch) => {
    setSkuRows((prev) =>
      prev.map((row) =>
        row.key === rowKey
          ? { ...row, specs: row.specs.map((item, i) => (i === index ? { ...item, ...patch } : item)) }
          : row
      )
    );
  };

  const removeSpec = (rowKey, index) => {
    setSkuRows((prev) =>
      prev.map((row) =>
        row.key === rowKey ? { ...row, specs: row.specs.filter((_, i) => i !== index) } : row
      )
    );
  };

  const handleSaveSkus = async () => {
    if (!skuProduct) return;
    setSkuSaving(true);
    setSkuError("");
    try {
      const payload = skuRows.map((row) => ({
        product_id: skuProduct.id,
        sku_code: row.sku_code,
        price: row.price,
        stock: row.stock,
        status: row.status,
        specs: row.specs,
      }));
      const result = await saveProductSkus(skuProduct.id, payload);
      toast.success(`规格已保存，合计库存 ${result.totalStock} 件`);
      setSkuProduct(null);
      await load();
    } catch (error) {
      console.error(error);
      setSkuError(error.message || "保存失败");
    } finally {
      setSkuSaving(false);
    }
  };

  const handleSearch = (event) => {
    event.preventDefault();
    setPage(1);
    setKeyword(search.trim());
  };

  const rangeText = useMemo(() => {
    if (!total) return "无匹配商品";
    return `当前筛选共 ${total} 个商品`;
  }, [total]);

  const { role } = useStaff();
  const editable = canEditProducts(role);
  const deletable = canDeleteRecords(role);

  return (
    <div>
      <PageHeader
        title="商品管理"
        description="维护商品信息、上下架状态与库存，支持批量操作"
        actions={
          editable ? (
            <button type="button" className={primaryBtn} onClick={openCreate}>
              <Plus className="h-4 w-4" /> 新增商品
            </button>
          ) : null
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Kpi label="商品总数" value={stats ? fmtNumber(stats.total) : "-"} icon={Package} tone="blue" loading={loading && !stats} />
        <Kpi label="在售商品" value={stats ? fmtNumber(stats.active) : "-"} icon={Tag} tone="green" loading={loading && !stats} />
        <Kpi label="库存预警" value={stats ? fmtNumber(stats.alert) : "-"} hint="库存低于安全库存或已缺货" icon={AlertTriangle} tone="amber" loading={loading && !stats} />
        <Kpi label="累计销量" value={stats ? fmtNumber(stats.sales) : "-"} icon={TrendingUp} tone="violet" loading={loading && !stats} />
      </div>

      <div className="bg-white border border-[#e0e0e0] rounded-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-[#f0f0f0]">
          <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8d8d8d]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜索商品名称"
                className={`${inputClass} pl-9 !w-52`}
              />
            </div>
            <select
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                setPage(1);
              }}
              className={`${inputClass} !w-36`}
            >
              <option value="all">全部分类</option>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className={`${inputClass} !w-32`}
            >
              <option value="all">全部状态</option>
              <option value="active">在售</option>
              <option value="low_stock">库存不足</option>
              <option value="out_of_stock">缺货</option>
              <option value="inactive">已下架</option>
            </select>
            <button type="submit" className={primaryBtn}>
              查询
            </button>
            <button
              type="button"
              className={ghostBtn}
              onClick={() => {
                setSearch("");
                setCategory("all");
                setStatus("all");
                setKeyword("");
                setPage(1);
              }}
            >
              重置
            </button>
          </form>

          <div className="flex items-center gap-3">
            <span className="text-[12px] text-[#8d8d8d]">{rangeText}</span>
            <div className="flex items-center gap-2">
            {selected.length > 0 ? (
              <div className="flex items-center gap-2 mr-1">
                <span className="text-[12px] text-[#525252]">已选 {selected.length} 项</span>
                {editable ? (
                  <>
                    <button type="button" className={ghostBtn} onClick={() => handleBatchStatus("active")}>
                      <ArrowUpCircle className="h-3.5 w-3.5" /> 上架
                    </button>
                    <button type="button" className={ghostBtn} onClick={() => handleBatchStatus("inactive")}>
                      <ArrowDownCircle className="h-3.5 w-3.5" /> 下架
                    </button>
                  </>
                ) : null}
                {deletable ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-sm text-[13px] font-medium border border-[#fecaca] text-[#b91c1c] bg-white hover:bg-[#fef2f2]"
                    onClick={() => requestDelete(selected)}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> 删除
                  </button>
                ) : null}
              </div>
            ) : null}
            <button type="button" className={ghostBtn} onClick={load} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> 刷新
            </button>
            </div>
          </div>
        </div>

        {loading ? (
          <EmptyState loading />
        ) : rows.length === 0 ? (
          <EmptyState
            title="没有找到商品"
            description={rangeText}
            action={
              editable ? (
                <button type="button" className={primaryBtn} onClick={openCreate}>
                  新增商品
                </button>
              ) : null
            }
          />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[900px] text-[13px]">
              <thead>
                <tr className="bg-[#fafafa] border-b border-[#e0e0e0] text-left text-[12px] text-[#6f6f6f]">
                  <th className="w-10 px-3 py-2.5">
                    <input type="checkbox" checked={allChecked} onChange={toggleAll} className="h-3.5 w-3.5 accent-[#0f62fe]" />
                  </th>
                  <th className="w-14 px-2 py-2.5">图片</th>
                  <th className="px-3 py-2.5">商品</th>
                  <th className="px-3 py-2.5">分类</th>
                  <th className="px-3 py-2.5 text-right">售价 / 成本</th>
                  <th className="px-3 py-2.5 text-right">库存</th>
                  <th className="px-3 py-2.5 text-right">销量</th>
                  <th className="px-3 py-2.5">状态</th>
                  <th className="w-28 px-3 py-2.5 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((product) => (
                  <tr key={product.id} className="border-b border-[#f4f4f4] last:border-b-0 hover:bg-[#fafafa] transition-colors">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selected.includes(product.id)}
                        onChange={() => toggleOne(product.id)}
                        className="h-3.5 w-3.5 accent-[#0f62fe]"
                      />
                    </td>
                    <td className="px-2 py-3">
                      <div className="w-10 h-10 rounded-sm bg-[#f4f4f4] overflow-hidden flex items-center justify-center">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="h-4 w-4 text-[#a8a8a8]" />
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-[13px] font-medium text-[#161616]">{product.name}</p>
                      <p className="text-[11px] text-[#a8a8a8]">
                        PRD-{String(product.id).padStart(4, "0")}
                        {skuCounts[product.id] ? ` · ${skuCounts[product.id]} 个规格` : " · 单品"}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-[#525252]">{product.category}</td>
                    <td className="px-3 py-3 text-right">
                      <p className="text-[#161616]">{fmtMoney(product.price, 2)}</p>
                      <p className="text-[11px] text-[#a8a8a8]">成本 {fmtMoney(product.cost, 2)}</p>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className={product.stock <= 0 ? "text-[#b91c1c] font-medium" : product.stock < 50 ? "text-[#b45309] font-medium" : "text-[#161616]"}>
                        {fmtNumber(product.stock)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right text-[#525252]">{fmtNumber(product.sales)}</td>
                    <td className="px-3 py-3">
                      <Pill config={PRODUCT_STATUS[product.status]} fallback={product.status} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {editable ? (
                          <>
                            <button
                              type="button"
                              onClick={() => openSkus(product)}
                              className="p-1.5 rounded hover:bg-[#f0f0f0] text-[#525252]"
                              aria-label="规格管理"
                              title="规格管理"
                            >
                              <Layers className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEdit(product)}
                              className="p-1.5 rounded hover:bg-[#f0f0f0] text-[#525252]"
                              aria-label="编辑"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        ) : null}
                        {deletable ? (
                          <button
                            type="button"
                            onClick={() => requestDelete([product.id])}
                            className="p-1.5 rounded hover:bg-[#fef2f2] text-[#b91c1c]"
                            aria-label="删除"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
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
        title={editing ? "编辑商品" : "新增商品"}
        description="商品信息保存后立即同步到线上商品库"
        width="max-w-2xl"
        footer={
          <>
            <button type="button" className={ghostBtn} onClick={() => setFormOpen(false)} disabled={saving}>
              取消
            </button>
            <button type="button" className={primaryBtn} onClick={handleSave} disabled={saving}>
              {saving ? "保存中..." : "保存"}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="商品名称" className="sm:col-span-2">
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="例如：无线蓝牙耳机"
              className={inputClass}
            />
          </Field>
          <Field label="分类">
            <input
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
              placeholder="例如：数码电子"
              list="product-categories"
              className={inputClass}
            />
            <datalist id="product-categories">
              {categories.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </Field>
          <Field label="上架状态">
            <select
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value })}
              className={inputClass}
            >
              <option value="active">上架销售</option>
              <option value="inactive">下架</option>
            </select>
          </Field>
          <Field label="售价">
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(event) => setForm({ ...form, price: event.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="成本价">
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.cost}
              onChange={(event) => setForm({ ...form, cost: event.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="库存数量" hint="库存为 0 时自动标记缺货">
            <input
              type="number"
              min="0"
              step="1"
              value={form.stock}
              onChange={(event) => setForm({ ...form, stock: event.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="安全库存" hint="低于该值自动标为低库存">
            <input
              type="number"
              min="0"
              step="1"
              value={form.safety_stock}
              onChange={(event) => setForm({ ...form, safety_stock: event.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="排序值" hint="数字越小越靠前">
            <input
              type="number"
              min="0"
              step="1"
              value={form.sort_order}
              onChange={(event) => setForm({ ...form, sort_order: event.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="商品图片链接" className="sm:col-span-2" hint="填写可访问的图片 URL，留空则显示占位图">
            <input
              value={form.image_url}
              onChange={(event) => setForm({ ...form, image_url: event.target.value })}
              placeholder="https://..."
              className={inputClass}
            />
          </Field>
          <Field label="商品描述" className="sm:col-span-2">
            <textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              rows={3}
              placeholder="补充卖点、规格等信息"
              className={inputClass}
            />
          </Field>
        </div>
      </Modal>

      <Drawer
        open={Boolean(skuProduct)}
        onClose={() => setSkuProduct(null)}
        title={`规格管理 · ${skuProduct?.name || ""}`}
        subtitle="每个 SKU 独立编码、价格与库存；商品总库存自动取所有 SKU 之和"
        width="max-w-3xl"
        footer={
          <>
            <button type="button" className={ghostBtn} onClick={() => setSkuProduct(null)} disabled={skuSaving}>
              取消
            </button>
            <button type="button" className={primaryBtn} onClick={handleSaveSkus} disabled={skuSaving}>
              {skuSaving ? "保存中..." : "保存规格"}
            </button>
          </>
        }
      >
        {skuLoading ? (
          <EmptyState loading />
        ) : (
          <>
            {skuError ? (
              <div className="mb-3 px-3 py-2 border border-[#fecaca] bg-[#fef2f2] text-[#b91c1c] text-[12px] rounded-sm">
                {skuError}
              </div>
            ) : null}

            <div className="space-y-3">
              {skuRows.map((row) => (
                <div key={row.key} className="border border-[#e0e0e0] rounded-sm p-3 bg-[#fafafa]">
                  <div className="grid grid-cols-2 md:grid-cols-[minmax(0,1fr)_110px_90px_100px_36px] gap-2">
                    <input
                      value={row.sku_code}
                      onChange={(event) => updateSkuRow(row.key, { sku_code: event.target.value })}
                      placeholder="SKU 编码（留空自动生成）"
                      className={inputClass}
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.price}
                      onChange={(event) => updateSkuRow(row.key, { price: event.target.value })}
                      placeholder="售价"
                      className={inputClass}
                    />
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={row.stock}
                      onChange={(event) => updateSkuRow(row.key, { stock: event.target.value })}
                      placeholder="库存"
                      className={inputClass}
                    />
                    <select
                      value={row.status}
                      onChange={(event) => updateSkuRow(row.key, { status: event.target.value })}
                      className={inputClass}
                    >
                      <option value="active">在售</option>
                      <option value="inactive">停用</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => removeSkuRow(row.key)}
                      className="flex items-center justify-center rounded border border-[#e0e0e0] text-[#b91c1c] hover:bg-[#fef2f2]"
                      aria-label="删除该 SKU"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="mt-2 space-y-1.5">
                    {row.specs.map((spec, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          value={spec.key}
                          onChange={(event) => updateSpec(row.key, index, { key: event.target.value })}
                          placeholder="规格名，如 颜色"
                          className={`${inputClass} !w-32`}
                        />
                        <input
                          value={spec.value}
                          onChange={(event) => updateSpec(row.key, index, { value: event.target.value })}
                          placeholder="规格值，如 红色"
                          className={`${inputClass} flex-1`}
                        />
                        <button
                          type="button"
                          onClick={() => removeSpec(row.key, index)}
                          className="p-1.5 rounded hover:bg-[#fef2f2] text-[#b91c1c]"
                          aria-label="删除规格项"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addSpec(row.key)}
                      className="text-[12px] text-[#0f62fe] hover:underline"
                    >
                      + 添加规格项
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button type="button" onClick={addSkuRow} className={`${ghostBtn} w-full border-dashed mt-3`}>
              <Plus className="h-3.5 w-3.5" /> 添加 SKU
            </button>

            {skuRows.length === 0 ? (
              <p className="text-[12px] text-[#8d8d8d] text-center py-2">
                暂无规格，商品按单品出售，库存在商品资料中维护
              </p>
            ) : (
              <p className="text-[12px] text-[#8d8d8d]">
                合计库存 {skuRows.reduce((sum, row) => sum + (Number(row.stock) || 0), 0)} 件
              </p>
            )}
          </>
        )}
      </Drawer>

      <Modal
        open={Boolean(confirmState)}
        onClose={() => setConfirmState(null)}
        title={confirmState?.title}
        footer={
          <>
            <button type="button" className={ghostBtn} onClick={() => setConfirmState(null)}>
              取消
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-sm text-[13px] font-medium bg-[#da1e28] text-white hover:bg-[#ba1b23]"
              onClick={() => confirmState?.onConfirm?.()}
            >
              确认删除
            </button>
          </>
        }
      >
        <p className="text-[13px] text-[#525252]">{confirmState?.description}</p>
      </Modal>
    </div>
  );
};

export default ProductManagement;
