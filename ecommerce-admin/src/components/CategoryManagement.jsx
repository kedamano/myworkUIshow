import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, RefreshCw, Pencil, Trash2, Loader2, Tags } from "lucide-react";
import {
  fetchCategoryList,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../services/database";
import { EmptyState, PageHeader, ghostBtn, inputClass, primaryBtn, Field } from "./common/PageElements";
import { Modal } from "./common/Overlays";

const CategoryManagement = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", sort_order: 0 });

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchCategoryList();
      setRows(data);
    } catch (error) {
      console.error(error);
      toast.error(error.message || "加载分类失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", description: "", sort_order: 0 });
    setShowModal(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      name: row.name || "",
      description: row.description || "",
      sort_order: row.sort_order || 0,
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("请填写分类名称");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateCategory(editing.id, {
          name: form.name.trim(),
          description: form.description.trim() || null,
          sort_order: Number(form.sort_order) || 0,
        });
        toast.success("分类已更新");
      } else {
        await createCategory({
          name: form.name.trim(),
          description: form.description.trim() || null,
          sort_order: Number(form.sort_order) || 0,
        });
        toast.success("分类已创建");
      }
      setShowModal(false);
      await load();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (!confirm(`确定删除分类「${row.name}」吗？`)) return;
    try {
      await deleteCategory(row.id);
      toast.success("分类已删除");
      await load();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "删除失败");
    }
  };

  return (
    <div>
      <PageHeader
        title="商品分类"
        description="管理商品分类，维护分类名称与排序"
        actions={
          <>
            <button type="button" className={primaryBtn} onClick={openCreate}>
              <Plus className="h-3.5 w-3.5" /> 新建分类
            </button>
            <button type="button" className={ghostBtn} onClick={load} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> 刷新
            </button>
          </>
        }
      />

      <div className="bg-white border border-[#e0e0e0] rounded-sm">
        {loading ? (
          <EmptyState loading />
        ) : rows.length === 0 ? (
          <EmptyState
            title="暂无分类"
            description="点击新建分类按钮创建第一个分类"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13px]">
              <thead>
                <tr className="bg-[#fafafa] border-b border-[#e0e0e0] text-left text-[12px] text-[#6f6f6f]">
                  <th className="px-4 py-2.5 w-16">排序</th>
                  <th className="px-4 py-2.5">分类名称</th>
                  <th className="px-4 py-2.5">描述</th>
                  <th className="px-4 py-2.5 w-24">商品数量</th>
                  <th className="px-4 py-2.5 w-24 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-[#f0f0f0] last:border-0 hover:bg-[#fafafa]">
                    <td className="px-4 py-3 text-[#6f6f6f]">{row.sort_order || 0}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-[#161616]">
                        <Tags className="h-3.5 w-3.5 text-[#8d8d8d]" />
                        {row.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#6f6f6f]">{row.description || "-"}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-[#eff6ff] text-[#1d4ed8]">
                        {row.productCount || 0} 个商品
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          className="p-1.5 rounded hover:bg-[#f4f4f4] text-[#525252] transition-colors"
                          onClick={() => openEdit(row)}
                          title="编辑"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="p-1.5 rounded hover:bg-[#fef2f2] text-[#8d8d8d] hover:text-[#b91c1c] transition-colors"
                          onClick={() => handleDelete(row)}
                          title="删除"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? "编辑分类" : "新建分类"}
        description={editing ? "修改分类信息" : "创建新的商品分类"}
        footer={
          <>
            <button type="button" className={ghostBtn} onClick={() => setShowModal(false)} disabled={saving}>
              取消
            </button>
            <button type="button" className={primaryBtn} onClick={handleSubmit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editing ? "保存" : "创建"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="分类名称 *">
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="请输入分类名称"
            />
          </Field>
          <Field label="描述">
            <textarea
              className={`${inputClass} h-20 resize-none`}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="选填，分类描述信息"
            />
          </Field>
          <Field label="排序" hint="数字越小越靠前">
            <input
              className={inputClass}
              type="number"
              min="0"
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
};

export default CategoryManagement;
