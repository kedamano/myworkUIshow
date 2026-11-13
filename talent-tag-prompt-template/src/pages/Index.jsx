import { useMemo, useState } from "react";
import {
  Plus, Layers, Tags, Search, RefreshCw, ChevronRight, Sparkles, BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import CategoryTree from "@/components/CategoryTree";
import TagForm from "@/components/TagForm";
import { tree, seedTags, findLeaf, allLeaves } from "@/data/library";

const STATUS_STYLE = {
  启用中: "bg-emerald-50 text-emerald-700 border-emerald-200",
  已暂停: "bg-slate-100 text-slate-500 border-slate-200",
  计算中: "bg-sky-50 text-sky-700 border-sky-200",
};

function leafIdsOf(node) {
  if (!node.children) return [node.id];
  return node.children.flatMap(leafIdsOf);
}

function findNode(nodes, id) {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children) {
      const hit = findNode(n.children, id);
      if (hit) return hit;
    }
  }
  return null;
}

export default function Index() {
  const [selected, setSelected] = useState("k1");
  const [tags, setTags] = useState(seedTags);
  const [creating, setCreating] = useState(false);
  const [kw, setKw] = useState("");

  const leaves = useMemo(() => allLeaves(tree), []);
  const node = findNode(tree, selected) || tree[0];
  const ids = useMemo(() => leafIdsOf(node), [node]);
  const list = tags.filter((t) => ids.includes(t.leaf));
  const filtered = kw.trim() ? leaves.filter((l) => l.name.includes(kw.trim())) : null;

  const leafTotal = leaves.length;
  const tplTotal = leaves.filter((l) => l.tpl).length;

  const handleCreated = (t) => {
    setTags((prev) => [{ ...t, id: "g" + Date.now() }, ...prev]);
    setSelected(t.leaf);
    setCreating(false);
  };

  const startCreate = () => {
    const targetLeaf = node.children ? leafIdsOf(node)[0] : node.id;
    setSelected(targetLeaf);
    setCreating(true);
  };

  return (
    <div className="min-h-screen bg-[#F5F6F8] text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#1F3A5F]">
              <Tags className="h-4 w-4 text-white" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold">智能打标平台</span>
              <span className="text-xs text-slate-400">/ 标签管理</span>
            </div>
            <span className="ml-2 rounded border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-400">原型演示</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span className="rounded bg-slate-100 px-2 py-1">招人 ES 已连接</span>
            <span className="rounded bg-slate-100 px-2 py-1">维度 {tags.length}</span>
            <span className="rounded bg-slate-100 px-2 py-1">员工 1,284</span>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1440px] gap-4 px-6 py-4">
        <aside className="hidden w-[300px] shrink-0 lg:block">
          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="h-4 w-1 rounded bg-[#1F3A5F]" />
                <span className="text-sm font-semibold">标签分类</span>
              </div>
              <button className="flex items-center gap-1 rounded border border-slate-200 px-2 py-0.5 text-[11px] text-slate-500 hover:bg-slate-50">
                <RefreshCw className="h-3 w-3" /> 同步
              </button>
            </div>
            <div className="px-4 pt-2 text-[11px] text-slate-400">展示全部标签分类及其下级分类</div>
            <div className="p-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <Input
                  value={kw}
                  onChange={(e) => setKw(e.target.value)}
                  placeholder="过滤分类名称 / 编码…"
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>
            <div className="max-h-[560px] overflow-y-auto px-2 pb-3">
              {filtered ? (
                filtered.length === 0 ? (
                  <div className="px-3 py-6 text-center text-[11px] text-slate-400">没有匹配的分类</div>
                ) : (
                  filtered.map((l) => (
                    <div
                      key={l.id}
                      onClick={() => { setSelected(l.id); setCreating(false); }}
                      className={[
                        "mb-0.5 cursor-pointer rounded-md px-2 py-1.5 text-[13px] transition",
                        selected === l.id ? "bg-[#1F3A5F]/[0.08] font-medium text-[#1F3A5F]" : "text-slate-600 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      {l.name}
                      <span className="ml-1 text-[10px] text-slate-400">{l.path}</span>
                    </div>
                  ))
                )
              ) : (
                <CategoryTree
                  nodes={tree}
                  selected={selected}
                  onSelect={(n) => { setSelected(n.id); setCreating(false); }}
                />
              )}
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
              <span>全部分类</span>
              <span>{leafTotal} 个末级</span>
            </div>
          </div>

          <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
              <BookOpen className="h-3.5 w-3.5" /> 场景模板库
            </div>
            <p className="mt-1.5 text-[11px] leading-5 text-slate-400">
              {tplTotal} 条标准口径已备好，按末级分类放置。新建标签时一键填入描述，不用从零写。
            </p>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          {creating ? (
            <TagForm
              leafId={selected}
              onExit={() => setCreating(false)}
              onCreated={handleCreated}
            />
          ) : (
            <div>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-semibold">{node.name}</h1>
                    <span className="rounded bg-white px-1.5 py-0.5 text-[11px] text-slate-400 ring-1 ring-slate-200">
                      {ids.length} 个末级分类
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    该分类下共 {list.length} 个标签，其中 {list.filter((t) => t.status === "启用中").length} 个启用中
                  </p>
                </div>
                <Button className="bg-[#1F3A5F] hover:bg-[#2c5185]" onClick={startCreate}>
                  <Plus className="mr-1 h-4 w-4" /> 新建标签
                </Button>
              </div>

              <div className="mb-4 grid gap-3 sm:grid-cols-3">
                {[
                  ["末级分类", `${ids.length}`, "可建标签的分类数"],
                  ["已有标签", `${list.length}`, "当前分类下标签总数"],
                  ["未建标签分类", `${ids.filter((id) => !tags.some((t) => t.leaf === id)).length}`, "已有标准口径待使用"],
                ].map(([k, v, sub]) => (
                  <div key={k} className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="text-[11px] text-slate-400">{k}</div>
                    <div className="mt-1 text-xl font-semibold tabular-nums">{v}</div>
                    <div className="mt-0.5 text-[11px] text-slate-400">{sub}</div>
                  </div>
                ))}
              </div>

              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <div className="text-sm font-medium text-slate-700">标签列表</div>
                </div>

                {list.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-50">
                      <Tags className="h-5 w-5 text-slate-300" />
                    </div>
                    <div className="mt-3 text-sm text-slate-600">该分类下还没有标签</div>
                    <p className="mt-1 text-xs text-slate-400">选一个末级分类，用标准口径一分钟建完</p>
                    <Button size="sm" className="mt-4 bg-[#1F3A5F] hover:bg-[#2c5185]" onClick={startCreate}>
                      <Sparkles className="mr-1 h-3.5 w-3.5" /> 从模板创建
                    </Button>
                  </div>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50/80 text-slate-500">
                      <tr>
                        <th className="px-4 py-2.5 text-left font-medium">标签名称</th>
                        <th className="px-3 py-2.5 text-left font-medium">所属分类</th>
                        <th className="px-3 py-2.5 text-left font-medium">打标方式</th>
                        <th className="px-3 py-2.5 text-left font-medium">字段 / 取值</th>
                        <th className="px-3 py-2.5 text-left font-medium">覆盖率</th>
                        <th className="px-3 py-2.5 text-left font-medium">状态</th>
                        <th className="px-3 py-2.5" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {list.map((t) => (
                        <tr key={t.id} className="group hover:bg-slate-50/60">
                          <td className="px-4 py-3 font-medium text-slate-800">{t.name}</td>
                          <td className="px-3 py-3 text-slate-500">{findLeaf(tree, t.leaf)?.name}</td>
                          <td className="px-3 py-3">
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{t.mode}</span>
                          </td>
                          <td className="px-3 py-3 tabular-nums text-slate-500">{t.fields} / {t.values}</td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <Progress value={t.coverage} className="h-1 w-16" />
                              <span className="tabular-nums text-slate-600">{t.coverage}%</span>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <span className={["rounded border px-1.5 py-0.5 text-[11px]", STATUS_STYLE[t.status] || STATUS_STYLE["启用中"]].join(" ")}>
                              {t.status}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <ChevronRight className="ml-auto h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
