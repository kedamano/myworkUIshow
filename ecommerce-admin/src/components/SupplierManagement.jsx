import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, RefreshCw, Pencil, Trash2, Loader2, Search, Building2, Phone, Mail, MapPin } from "lucide-react";
import {
  fetchSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from "../services/database";
import { EmptyState, PageHeader, Pagination, ghostBtn, inputClass, primaryBtn, Field } from "./common/PageElements";
import { Modal } from "./common/Overlays";

const PAGE_SIZE = 10;

const SupplierManagement = () => {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    contact: "",
    phone: "",
    email: "",
    address: "",
    remark: "",
    status: "active",
  });

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchSuppliers({ search: keyword, page, pageSize: PAGE_SIZE });
      setRows(data.data);
      setTotal(data.total);
    } catch (error) {
      console.error(error);
      toast.error(error.message || "加载供应商失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [keyword, page]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: "",
      contact: "",
      phone: "",
      email: "",
      address: "",
      remark: "",
      status: "active",
    });
    setShowModal(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      name: row.name || "",
      contact: row.contact || "",
      phone: row.phone || "",
      email: row.email || "",
      address: row.address || "",
      remark: row.remark || "",
      status: row.status || "active",
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("请填写供应商名称");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        contact: form.contact.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        remark: form.remark.trim() || null,
        status: form.status,
      };
      if (editing) {
        await updateSupplier(editing.id, payload);
        toast.success("供应商已更新");
      } else {
        await createSupplier(payload);
        toast.success("供应商已创建");
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
    if (!confirm(`确定删除供应商「${row.name}」吗？`)) return;
    try {
      await deleteSupplier(row.id);
      toast.success("供应商已删除");
      await load();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "删除失败");
    }
  };

  return (
    <div>
      <PageHeader
        title="供应商管理"
        description="维护供应商档案，记录联系人与供货信息"
        actions={
          <>
            <button type="button" className={primaryBtn} onClick={openCreate}>
              <Plus className="h-3.5 w-3.5" /> 新建供应商
            </button>
            <button type="button" className={ghostBtn} onClick={load} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> 刷新
            </button>
          </>
        }
      />

      <div className="bg-white border border-[#e0e0e0] rounded-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-[#f0f0f0]">
          <div className="text-[12px] text-[#6f6f6f]">共 {total} 家供应商</div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setPage(1);
              setKeyword(search.trim());
            }}
            className="relative"
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8d8d8d]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="供应商名称 / 联系人 / 电话"
              className={`${inputClass} pl-9 w-64`}
            />
          </form>
        </div>

        {loading ? (
          <EmptyState loading />
        ) : rows.length === 0 ? (
          <EmptyState
            title="暂无供应商"
            description="点击新建供应商按钮添加第一家供应商"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-[13px]">
              <thead>
                <tr className="bg-[#fafafa] border-b border-[#e0e0e0] text-left text-[12px] text-[#6f6f6f]">
                  <th className="px-4 py-2.5">供应商名称</th>
                  <th className="px-4 py-2.5">联系人</th>
                  <th className="px-4 py-2.5">电话</th>
                  <th className="px-4 py-2.5">邮箱</th>
                  <th className="px-4 py-2.5">地址</th>
                  <th className="px-4 py-2.5 w-20">状态</th>
                  <th className="px-4 py-2.5 w-24 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-[#f0f0f0] last:border-0 hover:bg-[#fafafa]">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-[#161616] font-medium">
                        <Building2 className="h-3.5 w-3.5 text-[#8d8d8d]" />
                        {row.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#525252]">{row.contact || "-"}</td>
                    <td className="px-4 py-3 text-[#525252]">{row.phone || "-"}</td>
                    <td className="px-4 py-3 text-[#525252]">{row.email || "-"}</td>
                    <td className="px-4 py-3 text-[#525252] max-w-[200px] truncate">{row.address || "-"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ${
                          row.status === "active"
                            ? "bg-[#f0fdf4] text-[#15803d]"
                            : "bg-[#f4f4f4] text-[#8d8d8d]"
                        }`}
                      >
                        {row.status === "active" ? "合作中" : "已停用"}
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

        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} />
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? "编辑供应商" : "新建供应商"}
        description={editing ? "修改供应商信息" : "添加新的供应商"}
        width="max-w-xl"
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
          <Field label="供应商名称 *">
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="请输入供应商名称"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="联系人">
              <input
                className={inputClass}
                value={form.contact}
                onChange={(e) => setForm({ ...form, contact: e.target.value })}
                placeholder="联系人姓名"
              />
            </Field>
            <Field label="联系电话">
              <input
                className={inputClass}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="联系电话"
              />
            </Field>
          </div>
          <Field label="邮箱">
            <input
              className={inputClass}
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="供应商邮箱"
            />
          </Field>
          <Field label="地址">
            <input
              className={inputClass}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="供应商地址"
            />
          </Field>
          <Field label="备注">
            <textarea
              className={`${inputClass} h-16 resize-none`}
              value={form.remark}
              onChange={(e) => setForm({ ...form, remark: e.target.value })}
              placeholder="选填，备注信息"
            />
          </Field>
          <Field label="状态">
            <select
              className={inputClass}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="active">合作中</option>
              <option value="inactive">已停用</option>
            </select>
          </Field>
        </div>
      </Modal>
    </div>
  );
};

export default SupplierManagement;
