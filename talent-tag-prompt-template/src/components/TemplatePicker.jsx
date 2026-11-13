import { useEffect, useMemo, useState } from "react";
import { Search, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import CategoryTree from "@/components/CategoryTree";
import { tree, allLeaves } from "@/data/library";

const leaves = allLeaves(tree);

const MODE_STYLE = {
  "规则": "bg-slate-100 text-slate-600",
  "字典": "bg-sky-50 text-sky-700",
  "模型": "bg-amber-50 text-amber-700",
  "规则 + 字典": "bg-sky-50 text-sky-700",
  "字典 + 模型": "bg-violet-50 text-violet-700",
};

export default function TemplatePicker({ open, onOpenChange, onApply }) {
  const [kw, setKw] = useState("");
  const [active, setActive] = useState(leaves[0]?.id || null);

  useEffect(() => {
    if (!open) setKw("");
  }, [open]);

  const hits = useMemo(() => {
    const q = kw.trim();
    if (!q) return null;
    return leaves.filter((l) => l.name.includes(q) || (l.tpl?.desc || "").includes(q));
  }, [kw]);

  const cur = leaves.find((l) => l.id === active) || null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0">
        <DialogHeader className="border-b border-slate-100 px-5 py-3">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Sparkles className="h-3.5 w-3.5 text-[#1F3A5F]" /> 从场景模板选择
          </DialogTitle>
          <DialogDescription className="text-[11px]">
            模板只填充口径描述文字，输出取值在第 3 步规则配置中定义
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 pt-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              value={kw}
              onChange={(e) => setKw(e.target.value)}
              placeholder="搜索分类名称或口径关键词"
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>

        <div className="grid gap-3 px-5 pb-5 pt-3 md:grid-cols-[240px_1fr]">
          <div className="rounded-md border border-slate-200">
            <ScrollArea className="h-[300px] p-1.5">
              {hits ? (
                hits.length === 0 ? (
                  <div className="px-3 py-6 text-center text-[11px] text-slate-400">没有匹配的模板</div>
                ) : (
                  hits.map((l) => (
                    <div
                      key={l.id}
                      onClick={() => setActive(l.id)}
                      className={[
                        "mb-0.5 cursor-pointer rounded-md px-2 py-1.5 text-[13px] transition",
                        active === l.id ? "bg-[#1F3A5F]/[0.08] font-medium text-[#1F3A5F]" : "text-slate-600 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      <div>{l.name}</div>
                      <div className="text-[10px] text-slate-400">{l.path}</div>
                    </div>
                  ))
                )
              ) : (
                <CategoryTree nodes={tree} selected={active} onSelect={(n) => setActive(n.id)} />
              )}
            </ScrollArea>
          </div>

          <div className="flex min-h-[300px] flex-col rounded-md border border-slate-200 p-4">
            {cur ? (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{cur.name}</div>
                    <div className="mt-0.5 text-[11px] text-slate-400">{cur.path}</div>
                  </div>
                  <span className={["shrink-0 rounded px-1.5 py-0.5 text-[11px]", MODE_STYLE[cur.tpl.mode] || MODE_STYLE["模型"]].join(" ")}>
                    {cur.tpl.mode}
                  </span>
                </div>

                <div className="mt-3 rounded-md bg-slate-50 p-3 text-xs leading-6 text-slate-700">
                  {cur.tpl.desc}
                </div>

                <div className="mt-3">
                  <div className="mb-1.5 text-[11px] text-slate-400">建议关联字段</div>
                  <div className="flex flex-wrap gap-1">
                    {cur.tpl.fields.map((f) => (
                      <span key={f} className="rounded border border-slate-200 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-auto flex items-center justify-between pt-4">
                  <span className="text-[11px] text-slate-400">
                    {cur.tags > 0 ? `该分类已有 ${cur.tags} 个标签` : "该分类下暂无标签"}
                  </span>
                  <Button
                    size="sm"
                    className="bg-[#1F3A5F] hover:bg-[#2c5185]"
                    onClick={() => { onApply(cur); onOpenChange(false); }}
                  >
                    应用此口径 <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center text-xs text-slate-400">
                左侧选择一个分类
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
