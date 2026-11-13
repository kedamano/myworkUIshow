import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Users,
  UserCheck,
  UserMinus,
  BadgeCheck,
  Search,
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Save,
  Info,
} from "lucide-react";
import {
  STAFF_ROLES,
  createStaffAccount,
  deleteStaffAccounts,
  fetchRegisteredUsers,
  fetchStaffAccounts,
  fetchStaffStats,
  updateStaffAccount,
} from "../services/database";
import {
  EmptyState,
  Field,
  Kpi,
  PageHeader,
  Pagination,
  ghostBtn,
  inputClass,
  primaryBtn,
} from "./common/PageElements";
import { Modal } from "./common/Overlays";
import { ACCOUNT_STATUS, STAFF_ROLE, Pill } from "./common/StatusPill";
import { fmtDateTime, fmtNumber } from "@/lib/format";

const PAGE_SIZE = 8;
const ROLE_OPTIONS = [{ value: "all", label: "全部角色" }, ...STAFF_ROLES];
const STATUS_OPTIONS = [
  { value: "all", label: "全部状态" },
  { value: "active", label: "正常" },
  { value: "disabled", label: "已停用" },
];

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  role: "operator",
  status: "active",
  remark: "",
};

const roleHint = {
  super_admin: "拥有全部权限，可管理账号与角色",
  operator: "商品、订单、营销等日常运营",
  cs: "订单查询、售后处理、客户答疑",
  warehouse: "库存出入库、发货与物流",
};

const AccountManagement = () => {
  const [tab, setTab] = useState("staff");

  const [staffRows, setStaffRows] = useState([]);
  const [staffTotal, setStaffTotal] = useState(0);
  const [staffPage, setStaffPage] = useState(1);
  const [staffSearch, setStaffSearch] = useState("");
  const [staffKeyword, setStaffKeyword] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [staffStats, setStaffStats] = useState(null);
  const [staffLoading, setStaffLoading] = useState(true);

  const [userRows, setUserRows] = useState([]);
  const [userTotal, setUserTotal] = useState(0);
  const [userPage, setUserPage] = useState(1);
  const [userSearch, setUserSearch] = useState("");
  const [userKeyword, setUserKeyword] = useState("");
  const [userLoading, setUserLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadStaff = async () => {
    setStaffLoading(true);
    try {
      const [list, stats] = await Promise.all([
        fetchStaffAccounts({
          search: staffKeyword,
          role: roleFilter,
          status: statusFilter,
          page: staffPage,
          pageSize: PAGE_SIZE,
        }),
        fetchStaffStats(),
      ]);
      setStaffRows(list.data);
      setStaffTotal(list.total);
      setStaffStats(stats);
    } catch (error) {
      console.error(error);
      toast.error(error.message || "加载员工账号失败");
    } finally {
      setStaffLoading(false);
    }
  };

  const loadUsers = async () => {
    setUserLoading(true);
    try {
      const list = await fetchRegisteredUsers({
        search: userKeyword,
        page: userPage,
        pageSize: PAGE_SIZE,
      });
      setUserRows(list.data);
      setUserTotal(list.total);
    } catch (error) {
      console.error(error);
      toast.error(error.message || "加载登录用户失败");
    } finally {
      setUserLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, [staffKeyword, roleFilter, statusFilter, staffPage]);

  useEffect(() => {
    loadUsers();
  }, [userKeyword, userPage]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      name: row.name || "",
      email: row.email || "",
      phone: row.phone || "",
      role: row.role || "operator",
      status: row.status || "active",
      remark: row.remark || "",
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("请填写姓名");
      return;
    }
    if (!form.email.trim()) {
      toast.error("请填写邮箱");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        role: form.role,
        status: form.status,
        remark: form.remark.trim() || null,
      };
      if (editing) {
        await updateStaffAccount(editing.id, payload);
        toast.success("账号已更新");
      } else {
        await createStaffAccount(payload);
        toast.success("账号已创建");
      }
      setModalOpen(false);
      await loadStaff();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (row) => {
    const next = row.status === "active" ? "disabled" : "active";
    try {
      await updateStaffAccount(row.id, { status: next });
      toast.success(next === "active" ? "账号已启用" : "账号已停用");
      await loadStaff();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "操作失败");
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      await deleteStaffAccounts([deleting.id]);
      toast.success("账号已删除");
      setDeleting(null);
      if (staffRows.length === 1 && staffPage > 1) setStaffPage(staffPage - 1);
      await loadStaff();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "删除失败");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="账号管理"
        description="维护后台员工账号与角色权限，查看已注册的登录用户"
        actions={
          <button
            type="button"
            className={ghostBtn}
            onClick={() => {
              loadStaff();
              loadUsers();
            }}
            disabled={staffLoading || userLoading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${staffLoading || userLoading ? "animate-spin" : ""}`} />
            刷新
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Kpi label="员工账号" value={staffStats ? fmtNumber(staffStats.total) : "-"} icon={Users} tone="blue" loading={staffLoading && !staffStats} />
        <Kpi label="正常账号" value={staffStats ? fmtNumber(staffStats.active) : "-"} icon={UserCheck} tone="green" loading={staffLoading && !staffStats} />
        <Kpi label="已停用" value={staffStats ? fmtNumber(staffStats.disabled) : "-"} icon={UserMinus} tone="red" loading={staffLoading && !staffStats} />
        <Kpi label="注册用户" value={fmtNumber(userTotal)} icon={BadgeCheck} tone="violet" loading={userLoading} hint="通过登录入口注册的账号" />
      </div>

      <div className="bg-white border border-[#e0e0e0] rounded-sm">
        <div className="flex items-center justify-between gap-3 px-4 pt-3 border-b border-[#f0f0f0]">
          <div className="flex gap-1 -mb-px">
            {[
              { key: "staff", label: "员工账号" },
              { key: "users", label: "登录用户" },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={`px-3 py-2 text-[13px] border-b-2 transition-colors ${
                  tab === item.key
                    ? "border-[#0f62fe] text-[#0f62fe] font-medium"
                    : "border-transparent text-[#6f6f6f] hover:text-[#161616]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          {tab === "staff" ? (
            <button type="button" className={`${primaryBtn} mb-2`} onClick={openCreate}>
              <Plus className="h-3.5 w-3.5" /> 新建账号
            </button>
          ) : null}
        </div>

        {tab === "staff" ? (
          <>
            <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-[#f0f0f0]">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  setStaffPage(1);
                  setStaffKeyword(staffSearch.trim());
                }}
                className="relative"
              >
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8d8d8d]" />
                <input
                  value={staffSearch}
                  onChange={(event) => setStaffSearch(event.target.value)}
                  placeholder="搜索姓名 / 邮箱 / 手机号"
                  className={`${inputClass} pl-9 w-56`}
                />
              </form>
              <select
                value={roleFilter}
                onChange={(event) => {
                  setRoleFilter(event.target.value);
                  setStaffPage(1);
                }}
                className={`${inputClass} !w-32`}
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setStaffPage(1);
                }}
                className={`${inputClass} !w-32`}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {staffLoading ? (
              <EmptyState loading />
            ) : staffRows.length === 0 ? (
              <EmptyState title="没有找到员工账号" description="点击右上角「新建账号」添加" />
            ) : (
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full min-w-[880px] text-[13px]">
                  <thead>
                    <tr className="bg-[#fafafa] border-b border-[#e0e0e0] text-left text-[12px] text-[#6f6f6f]">
                      <th className="px-3 py-2.5">姓名</th>
                      <th className="px-3 py-2.5">邮箱</th>
                      <th className="px-3 py-2.5">手机号</th>
                      <th className="px-3 py-2.5">角色</th>
                      <th className="px-3 py-2.5">状态</th>
                      <th className="px-3 py-2.5">最近登录</th>
                      <th className="px-3 py-2.5">备注</th>
                      <th className="w-28 px-3 py-2.5 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffRows.map((row) => (
                      <tr key={row.id} className="border-b border-[#f4f4f4] last:border-b-0 hover:bg-[#fafafa] transition-colors">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-full bg-[#edf5ff] text-[#0f62fe] text-[11px] flex items-center justify-center">
                              {(row.name || "员").slice(0, 1)}
                            </span>
                            <span className="text-[#161616] font-medium">{row.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-[#525252]">{row.email}</td>
                        <td className="px-3 py-3 text-[#525252]">{row.phone || "-"}</td>
                        <td className="px-3 py-3">
                          <Pill config={STAFF_ROLE[row.role]} fallback={row.role || "-"} />
                        </td>
                        <td className="px-3 py-3">
                          <Pill config={ACCOUNT_STATUS[row.status]} fallback={row.status || "-"} />
                        </td>
                        <td className="px-3 py-3 text-[#6f6f6f]">{fmtDateTime(row.last_login_at)}</td>
                        <td className="px-3 py-3 text-[#6f6f6f] max-w-[180px] truncate" title={row.remark || ""}>
                          {row.remark || "-"}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openEdit(row)}
                              className="p-1.5 rounded hover:bg-[#edf5ff] text-[#0f62fe]"
                              title="编辑"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(row)}
                              className="p-1.5 rounded hover:bg-[#f4f4f4] text-[#525252]"
                              title={row.status === "active" ? "停用" : "启用"}
                            >
                              {row.status === "active" ? (
                                <UserMinus className="h-3.5 w-3.5" />
                              ) : (
                                <UserCheck className="h-3.5 w-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleting(row)}
                              className="p-1.5 rounded hover:bg-[#fef2f2] text-[#b91c1c]"
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
            <Pagination page={staffPage} pageSize={PAGE_SIZE} total={staffTotal} onChange={setStaffPage} />
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-[#f0f0f0]">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  setUserPage(1);
                  setUserKeyword(userSearch.trim());
                }}
                className="relative"
              >
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8d8d8d]" />
                <input
                  value={userSearch}
                  onChange={(event) => setUserSearch(event.target.value)}
                  placeholder="搜索邮箱 / 昵称"
                  className={`${inputClass} pl-9 w-56`}
                />
              </form>
              <span className="text-[12px] text-[#8d8d8d]">共 {fmtNumber(userTotal)} 个注册用户</span>
            </div>

            <div className="mx-4 mt-3 flex items-start gap-2 border border-[#f0f0f0] bg-[#fafafa] rounded-sm px-3 py-2.5 text-[12px] text-[#6f6f6f]">
              <Info className="h-4 w-4 text-[#0f62fe] shrink-0 mt-0.5" />
              <p>登录用户由 NoCode 平台统一托管，本页面只做展示。如需封禁账号或重置密码，把邮箱告诉我，我直接处理。</p>
            </div>

            {userLoading ? (
              <EmptyState loading />
            ) : userRows.length === 0 ? (
              <EmptyState title="还没有注册用户" description="开启登录鉴权后，访客通过登录入口注册即可出现在这里" />
            ) : (
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full min-w-[720px] text-[13px]">
                  <thead>
                    <tr className="bg-[#fafafa] border-b border-[#e0e0e0] text-left text-[12px] text-[#6f6f6f]">
                      <th className="px-3 py-2.5">邮箱</th>
                      <th className="px-3 py-2.5">昵称</th>
                      <th className="px-3 py-2.5">注册时间</th>
                      <th className="px-3 py-2.5">最后登录</th>
                      <th className="px-3 py-2.5">状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userRows.map((row) => (
                      <tr key={row.id} className="border-b border-[#f4f4f4] last:border-b-0 hover:bg-[#fafafa] transition-colors">
                        <td className="px-3 py-3 text-[#161616] font-medium">{row.email}</td>
                        <td className="px-3 py-3 text-[#525252]">{row.nickname || "-"}</td>
                        <td className="px-3 py-3 text-[#6f6f6f]">{fmtDateTime(row.registered_at)}</td>
                        <td className="px-3 py-3 text-[#6f6f6f]">{fmtDateTime(row.last_sign_in_at)}</td>
                        <td className="px-3 py-3">
                          <Pill config={ACCOUNT_STATUS[row.status]} fallback={row.status || "-"} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination page={userPage} pageSize={PAGE_SIZE} total={userTotal} onChange={setUserPage} />
          </>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "编辑账号" : "新建员工账号"}
        description={editing ? `正在编辑 ${editing.name}` : "创建后可分配角色与职责范围"}
        footer={
          <>
            <button type="button" className={ghostBtn} onClick={() => setModalOpen(false)} disabled={saving}>
              取消
            </button>
            <button type="button" className={primaryBtn} onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {editing ? "保存修改" : "创建账号"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="姓名">
              <input
                className={inputClass}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="如：李运营"
              />
            </Field>
            <Field label="邮箱">
              <input
                className={inputClass}
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                placeholder="name@shop.com"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="手机号">
              <input
                className={inputClass}
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                placeholder="选填"
              />
            </Field>
            <Field label="角色" hint={roleHint[form.role]}>
              <select
                className={inputClass}
                value={form.role}
                onChange={(event) => setForm({ ...form, role: event.target.value })}
              >
                {STAFF_ROLES.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="状态">
            <div className="flex gap-2">
              {[
                { value: "active", label: "正常" },
                { value: "disabled", label: "已停用" },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setForm({ ...form, status: item.value })}
                  className={`flex-1 px-3 py-2 rounded-sm border text-[13px] transition-colors ${
                    form.status === item.value
                      ? "border-[#0f62fe] bg-[#edf5ff] text-[#0f62fe]"
                      : "border-[#e0e0e0] text-[#525252] hover:bg-[#f4f4f4]"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="备注">
            <textarea
              className={`${inputClass} min-h-[72px] resize-y`}
              value={form.remark}
              onChange={(event) => setForm({ ...form, remark: event.target.value })}
              placeholder="职责范围、负责板块等"
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="删除员工账号"
        description={deleting ? `确定删除「${deleting.name}」吗？` : ""}
        width="max-w-md"
        footer={
          <>
            <button type="button" className={ghostBtn} onClick={() => setDeleting(null)} disabled={deleteLoading}>
              取消
            </button>
            <button type="button" className={primaryBtn} onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              确认删除
            </button>
          </>
        }
      >
        <p className="text-[13px] text-[#525252] leading-relaxed">
          删除后该员工账号将无法再登录后台，此操作不可恢复。若只是暂时不允许使用，建议改用「停用」。
        </p>
      </Modal>
    </div>
  );
};

export default AccountManagement;
