import { Loader2, Inbox, ChevronLeft, ChevronRight } from "lucide-react";

const TONES = {
  default: { bg: "#f4f4f4", fg: "#525252" },
  blue: { bg: "#eff6ff", fg: "#1d4ed8" },
  green: { bg: "#f0fdf4", fg: "#15803d" },
  amber: { bg: "#fffbeb", fg: "#b45309" },
  red: { bg: "#fef2f2", fg: "#b91c1c" },
  violet: { bg: "#f5f3ff", fg: "#6d28d9" },
};

export const PageHeader = ({ title, description, actions }) => (
  <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
    <div>
      <h1 className="text-[20px] font-semibold text-[#161616]">{title}</h1>
      {description ? (
        <p className="text-[13px] text-[#6f6f6f] mt-1">{description}</p>
      ) : null}
    </div>
    {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
  </div>
);

export const Kpi = ({ label, value, hint, icon: Icon, tone = "default", loading = false }) => {
  const t = TONES[tone] || TONES.default;
  return (
    <div className="bg-white border border-[#e0e0e0] rounded-sm p-4">
      <div className="flex items-start justify-between">
        <p className="text-[12px] text-[#6f6f6f]">{label}</p>
        {Icon ? (
          <span
            className="w-7 h-7 rounded flex items-center justify-center"
            style={{ backgroundColor: t.bg, color: t.fg }}
          >
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
      </div>
      {loading ? (
        <div className="h-7 w-24 bg-[#f4f4f4] rounded animate-pulse mt-2" />
      ) : (
        <p className="text-[24px] font-light text-[#161616] mt-1 leading-8">{value}</p>
      )}
      {hint ? <p className="text-[11px] text-[#8d8d8d] mt-0.5">{hint}</p> : null}
    </div>
  );
};

export const SectionCard = ({ title, description, actions, children, className = "", bodyClassName = "" }) => (
  <section className={`bg-white border border-[#e0e0e0] rounded-sm ${className}`}>
    {title ? (
      <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[#f0f0f0]">
        <div>
          <h2 className="text-[15px] font-medium text-[#161616]">{title}</h2>
          {description ? <p className="text-[12px] text-[#8d8d8d] mt-0.5">{description}</p> : null}
        </div>
        {actions}
      </header>
    ) : null}
    <div className={bodyClassName || "p-4"}>{children}</div>
  </section>
);

export const EmptyState = ({ title = "暂无数据", description, action, loading = false }) => (
  <div className="flex flex-col items-center justify-center py-14 text-center">
    {loading ? (
      <Loader2 className="h-6 w-6 animate-spin text-[#8d8d8d]" />
    ) : (
      <Inbox className="h-8 w-8 text-[#c6c6c6]" />
    )}
    <p className="text-[14px] text-[#525252] mt-3">{loading ? "加载中..." : title}</p>
    {!loading && description ? (
      <p className="text-[12px] text-[#8d8d8d] mt-1">{description}</p>
    ) : null}
    {!loading && action ? <div className="mt-3">{action}</div> : null}
  </div>
);

export const Pagination = ({ page, pageSize, total, onChange }) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-[#f0f0f0] text-[12px] text-[#6f6f6f]">
      <span>
        共 {total} 条，当前 {start}-{end}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="w-7 h-7 flex items-center justify-center rounded border border-[#e0e0e0] disabled:opacity-40 hover:bg-[#f4f4f4] transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="px-2 text-[#161616]">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="w-7 h-7 flex items-center justify-center rounded border border-[#e0e0e0] disabled:opacity-40 hover:bg-[#f4f4f4] transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export const Field = ({ label, hint, children, className = "" }) => (
  <label className={`block ${className}`}>
    <span className="block text-[12px] font-medium text-[#525252] mb-1.5">{label}</span>
    {children}
    {hint ? <span className="block text-[11px] text-[#8d8d8d] mt-1">{hint}</span> : null}
  </label>
);

export const inputClass =
  "w-full px-3 py-2 border border-[#e0e0e0] rounded-sm text-[13px] bg-white text-[#161616] focus:outline-none focus:border-[#0f62fe] transition-colors placeholder:text-[#a8a8a8]";

export const primaryBtn =
  "inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-sm text-[13px] font-medium bg-[#0f62fe] text-white hover:bg-[#0043ce] transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

export const ghostBtn =
  "inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-sm text-[13px] font-medium border border-[#e0e0e0] bg-white text-[#525252] hover:bg-[#f4f4f4] transition-colors disabled:opacity-50";
