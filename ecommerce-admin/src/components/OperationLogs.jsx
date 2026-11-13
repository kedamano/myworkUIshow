import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, Loader2, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { fetchOperationLogs } from "@/lib/audit";
import { downloadCsv, fmtDateTime } from "@/lib/format";
import {
  EmptyState,
  PageHeader,
  Pagination,
  ghostBtn,
  inputClass,
  primaryBtn,
} from "./common/PageElements";

const PAGE_SIZE = 12;

const MODULES = [
  { value: "all", label: "全部模块" },
  { value: "商品", label: "商品" },
  { value: "库存", label: "库存" },
  { value: "订单", label: "订单" },
  { value: "售后", label: "售后" },
  { value: "营销", label: "营销" },
  { value: "账号", label: "账号" },
  { value: "分析", label: "分析" },
];

const ACTION_TONE = {
  删除: "#b91c1c",
  停用: "#b45309",
  重新汇总: "#6d28d9",
};

const staffDisplayName = (value) => {
  if (!value) return "-";
  if (typeof value === "object") return value.name || "-";
  const text = String(value).trim();
  if (text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text);
      if (parsed && parsed.name) return parsed.name;
    } catch (error) {
      /* 不是 JSON 时按原文展示 */
    }
  }
  return text;
};

const OperationLogs = () => {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [module, setModule] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchOperationLogs({ module, search, page, pageSize: PAGE_SIZE });
      setRows(result.data);
      setTotal(result.total);
    } catch (error) {
      toast.error(error.message || "日志加载失败");
    } finally {
      setLoading(false);
    }
  }, [module, search, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [module, search]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await fetchOperationLogs({ module, search, page: 1, pageSize: 2000 });
      const headers = ["时间", "操作人", "模块", "操作", "对象", "详情"];
      const data = result.data.map((row) => [
        fmtDateTime(row.created_at),
        staffDisplayName(row.staff_name),
        row.module,
        row.action,
        row.target,
        row.detail,
      ]);
      downloadCsv(`操作日志_${new Date().toISOString().slice(0, 10)}.csv`, headers, data);
      toast.success(`已导出 ${data.length} 条日志`);
    } catch (error) {
      toast.error(error.message || "导出失败");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="操作日志"
        description="记录后台所有写操作，谁在什么时间改了什么，全程可追溯"
        actions={
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || total === 0}
            className={ghostBtn}
          >
            {exporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            导出 CSV
          </button>
        }
      />

      <div className="bg-white border border-[#e0e0e0] rounded-sm">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-[#f0f0f0]">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8d8d8d]" />
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") setSearch(keyword.trim());
              }}
              placeholder="搜索操作人 / 对象 / 详情"
              className={`${inputClass} pl-8 w-64`}
            />
          </div>
          <select
            value={module}
            onChange={(event) => setModule(event.target.value)}
            className={`${inputClass} !w-32`}
          >
            {MODULES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => setSearch(keyword.trim())} className={primaryBtn}>
            查询
          </button>
          <button
            type="button"
            onClick={() => {
              setKeyword("");
              setSearch("");
              setModule("all");
            }}
            className={ghostBtn}
          >
            重置
          </button>
          <div className="flex-1" />
          <button type="button" onClick={load} className={ghostBtn}>
            <RefreshCw className="h-3.5 w-3.5" />
            刷新
          </button>
        </div>

        {!loading && rows.length === 0 ? (
          <EmptyState
            title="暂无操作记录"
            description="后台的增删改操作会自动记录在这里"
            loading={loading}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-[#fafafa] text-left text-[12px] text-[#6f6f6f]">
                    <th className="px-4 py-2.5 font-medium whitespace-nowrap">时间</th>
                    <th className="px-4 py-2.5 font-medium whitespace-nowrap">操作人</th>
                    <th className="px-4 py-2.5 font-medium whitespace-nowrap">模块</th>
                    <th className="px-4 py-2.5 font-medium whitespace-nowrap">操作</th>
                    <th className="px-4 py-2.5 font-medium">对象</th>
                    <th className="px-4 py-2.5 font-medium">详情</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-t border-[#f0f0f0] hover:bg-[#fafafa]">
                      <td className="px-4 py-2.5 text-[#525252] whitespace-nowrap">
                        {fmtDateTime(row.created_at)}
                      </td>
                      <td className="px-4 py-2.5 text-[#161616] whitespace-nowrap">
                        {staffDisplayName(row.staff_name)}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="inline-flex px-1.5 py-0.5 rounded text-[11px] bg-[#f4f4f4] text-[#525252]">
                          {row.module || "-"}
                        </span>
                      </td>
                      <td
                        className="px-4 py-2.5 font-medium whitespace-nowrap"
                        style={{ color: ACTION_TONE[row.action] || "#161616" }}
                      >
                        {row.action || "-"}
                      </td>
                      <td className="px-4 py-2.5 text-[#161616] max-w-[220px] truncate">
                        {row.target || "-"}
                      </td>
                      <td className="px-4 py-2.5 text-[#6f6f6f] max-w-[320px] truncate">
                        {row.detail || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} />
          </>
        )}
      </div>

      <div className="flex items-start gap-2 mt-3 text-[12px] text-[#8d8d8d]">
        <ShieldCheck className="h-3.5 w-3.5 mt-0.5 text-[#0d9488]" />
        <p>
          日志为只追加记录，后台不提供删除入口；如需清理历史日志，请联系管理员在数据库侧处理。
        </p>
      </div>
    </div>
  );
};

export default OperationLogs;
