import { useMemo, useState } from "react";
import {
  Sparkles, PenLine, Check, ChevronLeft, ChevronRight, AlertTriangle, Play,
  Loader2, ShieldCheck, Info, Settings2, Database, Gauge, X, ArrowRight,
  CheckCircle2, Clock, Coins, Users, FileWarning, BookOpen, Search, Layers, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { categories, templates, fieldMeta, sampleNames } from "@/data/templates";

const STEPS = ["入口", "选场景", "配置", "试跑", "启用"];

function lcg(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function buildTrial(tpl, threshold, n = 20) {
  const seedBase = tpl.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const rnd = lcg(seedBase * 977 + 13);
  const rows = [];
  for (let i = 0; i < n; i++) {
    const pair = tpl.demo[(i + Math.floor(rnd() * 2)) % tpl.demo.length];
    const conf = Math.min(0.99, Math.max(0.42, tpl.confidence - 0.1 + rnd() * 0.2));
    rows.push({
      name: sampleNames[i % sampleNames.length],
      value: pair[0],
      evidence: pair[1],
      confidence: Number(conf.toFixed(2)),
      status: conf >= threshold ? "confirmed" : "pending_review",
    });
  }
  const dist = {};
  rows.forEach((r) => { dist[r.value] = (dist[r.value] || 0) + 1; });
  const confirmed = rows.filter((r) => r.status === "confirmed").length;
  const accuracy = Math.round(86 + rnd() * 10);
  return { rows, dist, confirmed, pending: n - confirmed, accuracy, total: n };
}

function Stepper({ step }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((s, i) => {
        const idx = i + 1;
        const done = step > idx;
        const cur = step === idx;
        return (
          <div key={s} className="flex items-center gap-2">
            <div
              className={[
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition",
                done ? "bg-emerald-500 text-white" : cur ? "bg-[#1F3A5F] text-white" : "bg-slate-100 text-slate-400",
              ].join(" ")}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : idx}
            </div>
            <span className={["text-xs", cur ? "font-semibold text-slate-900" : "text-slate-400"].join(" ")}>{s}</span>
            {i < STEPS.length - 1 && <div className="mx-1 h-px w-8 bg-slate-200" />}
          </div>
        );
      })}
    </div>
  );
}

function ExecutorBadge({ executor }) {
  const map = {
    "纯规则": "bg-slate-100 text-slate-600 border-slate-200",
    "规则优先": "bg-sky-50 text-sky-700 border-sky-200",
    "规则+模型混合": "bg-violet-50 text-violet-700 border-violet-200",
    "模型为主": "bg-amber-50 text-amber-700 border-amber-200",
  };
  return (
    <span className={["rounded border px-1.5 py-0.5 text-[11px] font-medium", map[executor] || map["模型为主"]].join(" ")}>
      {executor}
    </span>
  );
}

function TemplateCard({ tpl, onSelect, used }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex h-full flex-col rounded-lg border border-slate-200 bg-white p-4 transition hover:border-[#1F3A5F]/40 hover:shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-900">{tpl.name}</span>
          {used && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">已使用</span>}
        </div>
        <span className="shrink-0 rounded bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">{tpl.id}</span>
      </div>
      <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-slate-500">{tpl.summary}</p>
      <div className="mt-3 flex flex-wrap gap-1">
        {tpl.options.slice(0, 3).map((o) => (
          <span key={o} className="rounded bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-600">{o}</span>
        ))}
        {tpl.options.length > 3 && (
          <span className="px-1 py-0.5 text-[11px] text-slate-400">等 {tpl.options.length} 项</span>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
        <div className="flex items-center gap-1.5">
          <ExecutorBadge executor={tpl.executor} />
          <span className="text-[11px] text-slate-400">{tpl.valueType}</span>
        </div>
        <button onClick={() => setOpen(true)} className="text-[11px] text-slate-400 underline-offset-2 hover:text-[#1F3A5F] hover:underline">
          查看判断规则
        </button>
      </div>
      <Button size="sm" className="mt-3 w-full bg-[#1F3A5F] hover:bg-[#2c5185]" onClick={() => onSelect(tpl)}>
        使用此模板
        <ArrowRight className="ml-1 h-3.5 w-3.5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              {tpl.name}
              <ExecutorBadge executor={tpl.executor} />
            </DialogTitle>
            <DialogDescription className="text-xs">{tpl.summary}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <BookOpen className="h-3.5 w-3.5" /> 判断规则
              </div>
              <ol className="space-y-1.5">
                {tpl.rules.map((r, i) => (
                  <li key={i} className="flex gap-2 text-xs leading-5 text-slate-600">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded bg-slate-100 text-[10px] text-slate-500">{i + 1}</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ol>
            </div>
            <Separator />
            <div>
              <div className="mb-1.5 text-xs font-medium text-slate-500">输出取值</div>
              <div className="flex flex-wrap gap-1">
                {tpl.options.map((o) => (
                  <span key={o} className="rounded border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-600">{o}</span>
                ))}
              </div>
            </div>
            <div className="rounded bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-800">
              提示词原文不对业务用户展示。以上为人类可读的规则说明，与后台提示词同源维护。
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function TagWizard({ categoryKey, onExit, onCreated }) {
  const [step, setStep] = useState(1);
  const [cat, setCat] = useState(categoryKey || "edu");
  const [tpl, setTpl] = useState(null);
  const [tagName, setTagName] = useState("");
  const [missing, setMissing] = useState({});
  const [params, setParams] = useState({});
  const [threshold, setThreshold] = useState(0.8);
  const [trial, setTrial] = useState(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [created, setCreated] = useState(null);

  const list = useMemo(() => templates.filter((t) => t.cat === cat), [cat]);

  const selectTpl = (t) => {
    setTpl(t);
    setTagName(t.name);
    setThreshold(t.confidence);
    const m = {};
    t.fields.forEach((f) => { m[f] = f.startsWith("员工档案.项目经历") ? "missing" : "ready"; });
    setMissing(m);
    const p = {};
    t.params.forEach((f) => { p[f] = fieldMeta[f]?.sample || ""; });
    setParams(p);
    setTrial(null);
    setStep(3);
  };

  const requiredMissing = tpl
    ? tpl.fields.filter((f) => fieldMeta[f]?.required && missing[f] === "missing").length +
      tpl.params.filter((f) => !params[f]).length
    : 0;

  const runTrial = () => {
    setTrial({ loading: true });
    setTimeout(() => setTrial(buildTrial(tpl, threshold)), 900);
  };

  const confirmEnable = () => {
    setStep(6);
    setRunning(true);
    setProgress(0);
    const timer = setInterval(() => {
      setProgress((p) => {
        const next = p + 7 + Math.random() * 9;
        if (next >= 100) {
          clearInterval(timer);
          setTimeout(() => {
            const t = {
              name: tagName,
              cat: tpl.cat,
              template: tpl.id,
              coverage: Math.min(99, 88 + Math.round(Math.random() * 10)),
              pending: trial ? trial.pending : 0,
              executor: tpl.executor,
              status: "启用中",
            };
            setCreated(t);
            setRunning(false);
            setDone(true);
            onCreated(t);
          }, 350);
          return 100;
        }
        return next;
      });
    }, 160);
  };

  if (done && created) {
    return (
      <div className="mx-auto max-w-2xl py-10">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
            <CheckCircle2 className="h-7 w-7 text-emerald-600" />
          </div>
          <h2 className="mt-4 text-xl font-semibold text-slate-900">标签「{created.name}」已启用</h2>
          <p className="mt-1 text-sm text-slate-500">基于模板 {created.template} 创建，系统已开始全量计算</p>
        </div>
        <div className="mt-8 grid grid-cols-3 gap-3">
          {[
            ["覆盖率", created.coverage + "%"],
            ["待复核", created.pending + " 条"],
            ["执行方式", created.executor],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-slate-200 bg-white p-4 text-center">
              <div className="text-[11px] text-slate-400">{k}</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{v}</div>
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs leading-6 text-slate-500">
          标签值绑定模板版本 {created.template}-v1。低于置信度阈值的结果已进入待复核队列，不会直接参与筛选。
        </div>
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="outline" onClick={onExit}>回到标签列表</Button>
          <Button className="bg-[#1F3A5F] hover:bg-[#2c5185]" onClick={onExit}>再建一个标签</Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <Stepper step={Math.min(step, 5)} />
        <Button variant="ghost" size="sm" className="text-slate-500" onClick={onExit}>
          <X className="mr-1 h-3.5 w-3.5" /> 退出
        </Button>
      </div>

      {step === 1 && (
        <div>
          <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2.5 text-xs text-sky-800">
            这是可点击的交互原型，试跑数据与执行结果均为模拟，用于验证交互流程与信息层级。
          </div>
          <h2 className="text-lg font-semibold text-slate-900">选择创建方式</h2>
          <p className="mt-1 text-sm text-slate-500">从场景模板创建可以跳过提示词编写，直接复用平台沉淀的判断标准。</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <button
              onClick={() => setStep(2)}
              className="rounded-xl border-2 border-[#1F3A5F] bg-white p-5 text-left shadow-sm transition hover:shadow"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1F3A5F]/10">
                  <Sparkles className="h-5 w-5 text-[#1F3A5F]" />
                </div>
                <Badge className="bg-[#1F3A5F] text-[10px] hover:bg-[#1F3A5F]">推荐</Badge>
              </div>
              <div className="mt-3 text-base font-semibold text-slate-900">从场景模板创建</div>
              <p className="mt-1.5 text-xs leading-5 text-slate-500">
                按场景选择模板，字段与取值已预置。全程不接触提示词，约 90 秒完成。
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {["20 个场景模板", "输出值受控", "支持试跑"].map((t) => (
                  <span key={t} className="rounded bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-500">{t}</span>
                ))}
              </div>
            </button>

            <div className="rounded-xl border-2 border-slate-200 bg-slate-50/60 p-5 text-left">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-200/70">
                  <PenLine className="h-5 w-5 text-slate-400" />
                </div>
                <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-500">已有能力</span>
              </div>
              <div className="mt-3 text-base font-semibold text-slate-500">自定义标签</div>
              <p className="mt-1.5 text-xs leading-5 text-slate-400">
                自行编写提示词与字段绑定，需要同时熟悉业务口径、提示词写法与系统字段。
              </p>
              <div className="mt-3 text-[11px] text-slate-400">本原型不演示该路径</div>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-900">选择业务场景</h2>
          <p className="mt-1 text-sm text-slate-500">先选场景分类，再从该分类下的模板中选择一个。</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-[220px_1fr]">
            <div className="rounded-lg border border-slate-200 bg-white p-2">
              {categories.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setCat(c.key)}
                  className={[
                    "mb-1 flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition last:mb-0",
                    cat === c.key ? "bg-[#1F3A5F] text-white" : "text-slate-600 hover:bg-slate-50",
                  ].join(" ")}
                >
                  <span className="flex items-center gap-2">
                    <Layers className="h-3.5 w-3.5" />
                    {c.name}
                  </span>
                  <span className={["text-[11px]", cat === c.key ? "text-white/70" : "text-slate-400"].join(" ")}>
                    {c.count}
                  </span>
                </button>
              ))}
            </div>
            <div>
              <div className="mb-3 flex items-center justify-between">
                <div className="text-xs text-slate-500">{categories.find((c) => c.key === cat)?.desc}</div>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <Input placeholder="搜索模板" className="h-8 w-44 pl-7 text-xs" />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {list.map((t) => (
                  <TemplateCard
                    key={t.id}
                    tpl={t}
                    onSelect={selectTpl}
                    used={["T01", "T02", "T07", "T15", "T11"].includes(t.id)}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="mt-5">
            <Button variant="outline" size="sm" onClick={() => setStep(1)}>
              <ChevronLeft className="mr-1 h-3.5 w-3.5" /> 上一步
            </Button>
          </div>
        </div>
      )}

      {step === 3 && tpl && (
        <div className="pb-24">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">配置模板</h2>
              <p className="mt-1 text-sm text-slate-500">
                模板 <span className="font-medium text-slate-700">{tpl.id} · {tpl.name}</span>，确认字段与参数后即可试跑。
              </p>
            </div>
            <ExecutorBadge executor={tpl.executor} />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <Label className="text-xs text-slate-500">标签名称</Label>
                <Input value={tagName} onChange={(e) => setTagName(e.target.value)} className="mt-1.5 h-9 max-w-sm text-sm" />
              </div>

              <div className="rounded-lg border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                    <Database className="h-3.5 w-3.5" /> 字段映射
                  </div>
                  <span className="text-[11px] text-slate-400">{tpl.fields.length} 个字段</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {tpl.fields.map((f) => {
                    const meta = fieldMeta[f];
                    const isMissing = missing[f] === "missing";
                    return (
                      <div key={f} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="w-24 shrink-0 text-xs text-slate-600">{meta.label}</div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-mono text-[11px] text-slate-500">{f}</div>
                          <div className="truncate text-[11px] text-slate-400">示例：{meta.sample}</div>
                        </div>
                        <span className="shrink-0 text-[11px] text-slate-400">{meta.required ? "必填" : "选填"}</span>
                        <button
                          onClick={() => setMissing((m) => ({ ...m, [f]: isMissing ? "ready" : "missing" }))}
                          className={[
                            "shrink-0 rounded border px-1.5 py-0.5 text-[11px] transition",
                            isMissing
                              ? "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
                          ].join(" ")}
                          title="点击可模拟字段缺失"
                        >
                          {isMissing ? "缺失" : "就绪"}
                        </button>
                      </div>
                    );
                  })}
                </div>
                {Object.values(missing).includes("missing") && (
                  <div className="border-t border-slate-100 bg-amber-50/60 px-4 py-2 text-[11px] leading-5 text-amber-800">
                    <AlertTriangle className="mr-1 inline h-3 w-3" />
                    存在缺失字段。非必填字段缺失时该对象可能产出「无法判断」并进入待复核；必填字段缺失会导致不可启用。
                  </div>
                )}
              </div>

              {tpl.params.length > 0 && (
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="mb-3 flex items-center gap-1.5 text-xs font-medium text-slate-600">
                    <Settings2 className="h-3.5 w-3.5" /> 运行参数
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {tpl.params.map((f) => (
                      <div key={f}>
                        <Label className="text-xs text-slate-500">
                          {fieldMeta[f].label} <span className="text-rose-500">*</span>
                        </Label>
                        <Input
                          value={params[f] || ""}
                          onChange={(e) => setParams((p) => ({ ...p, [f]: e.target.value }))}
                          className="mt-1.5 h-8 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-slate-400">参数不同时，同一模板对同一个人可能产出不同的标签值。</p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                  <Gauge className="h-3.5 w-3.5" /> 置信度阈值
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-2xl font-semibold text-slate-900">{threshold.toFixed(2)}</span>
                  <span className="text-xs text-slate-400">（模板默认 {tpl.confidence.toFixed(2)}）</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="0.99"
                  step="0.01"
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="mt-3 w-full accent-[#1F3A5F]"
                />
                <p className="mt-2 text-[11px] leading-5 text-slate-400">
                  低于阈值的标签值进入待复核队列，不直接参与筛选。阈值不低于 0.50。
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-600">
                  <ShieldCheck className="h-3.5 w-3.5" /> 输出约束
                </div>
                <div className="text-[11px] leading-6 text-slate-500">
                  <div>类型：{tpl.valueType}</div>
                  <div>输出必须落在 {tpl.options.length} 个取值内</div>
                  <div>越界即判为解析失败，不写值</div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {tpl.options.slice(0, 5).map((o) => (
                    <span key={o} className="rounded bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500">{o}</span>
                  ))}
                  {tpl.options.length > 5 && <span className="px-1 text-[10px] text-slate-400">+{tpl.options.length - 5}</span>}
                </div>
              </div>
            </div>
          </div>

          <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-slate-200 bg-white/95 backdrop-blur">
            <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3">
              <Button variant="outline" size="sm" onClick={() => setStep(2)}>
                <ChevronLeft className="mr-1 h-3.5 w-3.5" /> 上一步
              </Button>
              <div className="flex items-center gap-3">
                {requiredMissing > 0 && (
                  <span className="text-[11px] text-rose-600">有 {requiredMissing} 个必填项未就绪</span>
                )}
                <Button
                  size="sm"
                  className="bg-[#1F3A5F] hover:bg-[#2c5185]"
                  disabled={requiredMissing > 0 || !tagName.trim()}
                  onClick={() => { setStep(4); setTrial(null); }}
                >
                  下一步：试跑 <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 4 && tpl && (
        <div className="pb-24">
          <h2 className="text-lg font-semibold text-slate-900">试跑预览</h2>
          <p className="mt-1 text-sm text-slate-500">抽样 20 条执行，验证口径与准确率。试跑结果不写入正式标签值。</p>

          {!trial && (
            <div className="mt-6 flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white py-16">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-50">
                <Play className="h-5 w-5 text-slate-400" />
              </div>
              <div className="mt-3 text-sm text-slate-600">尚未试跑</div>
              <p className="mt-1 text-xs text-slate-400">将从有完整字段的对象中随机抽取 20 条</p>
              <Button className="mt-4 bg-[#1F3A5F] hover:bg-[#2c5185]" onClick={runTrial}>开始试跑</Button>
            </div>
          )}

          {trial && trial.loading && (
            <div className="mt-6 flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-white py-16">
              <Loader2 className="h-6 w-6 animate-spin text-[#1F3A5F]" />
              <div className="mt-3 text-sm text-slate-500">正在执行 20 条样本…</div>
            </div>
          )}

          {trial && !trial.loading && (
            <div className="mt-5 space-y-4">
              {trial.accuracy < 90 && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    抽样准确率 {trial.accuracy}%，低于 90% 建议线。建议返回调整置信度阈值，或联系模板维护者优化判断规则。不阻断继续，但会显著增加后续复核量。
                  </div>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-4">
                {[
                  ["抽样准确率", trial.accuracy + "%", trial.accuracy >= 90 ? "text-emerald-600" : "text-amber-600"],
                  ["直出（≥阈值）", trial.confirmed + " 条", "text-slate-900"],
                  ["待复核", trial.pending + " 条", "text-amber-600"],
                  ["解析失败", "0 条", "text-slate-900"],
                ].map(([k, v, cls]) => (
                  <div key={k} className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="text-[11px] text-slate-400">{k}</div>
                    <div className={["mt-0.5 text-lg font-semibold", cls].join(" ")}>{v}</div>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="mb-3 text-xs font-medium text-slate-600">值分布</div>
                  <div className="space-y-2.5">
                    {Object.entries(trial.dist)
                      .sort((a, b) => b[1] - a[1])
                      .map(([k, v]) => (
                        <div key={k}>
                          <div className="mb-1 flex items-center justify-between text-[11px]">
                            <span className="truncate pr-2 text-slate-600">{k}</span>
                            <span className="shrink-0 text-slate-400">{v} 条</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-[#1F3A5F]"
                              style={{ width: Math.round((v / trial.total) * 100) + "%" }}
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <div className="border-b border-slate-100 px-4 py-2.5 text-xs font-medium text-slate-600">样例明细</div>
                  <ScrollArea className="h-[300px]">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-slate-50 text-slate-500">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">对象</th>
                          <th className="px-3 py-2 text-left font-medium">标签值</th>
                          <th className="px-3 py-2 text-left font-medium">置信度</th>
                          <th className="px-3 py-2 text-left font-medium">依据</th>
                          <th className="px-3 py-2 text-left font-medium">状态</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {trial.rows.slice(0, 12).map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50/60">
                            <td className="whitespace-nowrap px-3 py-2 text-slate-700">{r.name}</td>
                            <td className="max-w-[180px] px-3 py-2">
                              <span
                                className={[
                                  "rounded px-1.5 py-0.5 text-[11px]",
                                  r.value === "无法判断" ? "bg-slate-100 text-slate-500" : "bg-slate-900 text-white",
                                ].join(" ")}
                              >
                                {r.value}
                              </span>
                            </td>
                            <td className={["px-3 py-2 tabular-nums", r.status === "confirmed" ? "text-slate-600" : "text-amber-600"].join(" ")}>
                              {r.confidence.toFixed(2)}
                            </td>
                            <td className="max-w-[260px] truncate px-3 py-2 text-slate-400">{r.evidence}</td>
                            <td className="whitespace-nowrap px-3 py-2">
                              {r.status === "confirmed" ? (
                                <span className="text-emerald-600">直出</span>
                              ) : (
                                <span className="text-amber-600">待复核</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                </div>
              </div>
            </div>
          )}

          <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-slate-200 bg-white/95 backdrop-blur">
            <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3">
              <Button variant="outline" size="sm" onClick={() => setStep(3)}>
                <ChevronLeft className="mr-1 h-3.5 w-3.5" /> 返回配置
              </Button>
              <div className="flex items-center gap-3">
                {trial && !trial.loading && (
                  <Button variant="ghost" size="sm" className="text-slate-500" onClick={runTrial}>重新试跑</Button>
                )}
                <Button
                  size="sm"
                  className="bg-[#1F3A5F] hover:bg-[#2c5185]"
                  disabled={!trial || trial.loading}
                  onClick={() => setStep(5)}
                >
                  下一步：启用 <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 5 && tpl && trial && (
        <div className="pb-24">
          <h2 className="text-lg font-semibold text-slate-900">确认启用</h2>
          <p className="mt-1 text-sm text-slate-500">启用后将立即对全量对象执行，请确认影响范围与成本。</p>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_320px]">
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-white">
                <div className="border-b border-slate-100 px-4 py-2.5 text-xs font-medium text-slate-600">标签信息</div>
                <div className="divide-y divide-slate-50">
                  {[
                    ["标签名称", tagName],
                    ["所属分类", categories.find((c) => c.key === tpl.cat)?.name],
                    ["使用模板", `${tpl.id} · ${tpl.name}`],
                    ["执行方式", tpl.executor],
                    ["置信度阈值", threshold.toFixed(2)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-xs text-slate-500">{k}</span>
                      <span className="text-xs font-medium text-slate-800">{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white">
                <div className="border-b border-slate-100 px-4 py-2.5 text-xs font-medium text-slate-600">执行影响</div>
                <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
                  {[
                    [<Users key="u" className="h-3.5 w-3.5" />, "影响对象", "1,284 人"],
                    [<Clock key="c" className="h-3.5 w-3.5" />, "预计耗时", tpl.executor === "纯规则" ? "约 30 秒" : "约 4 分钟"],
                    [<Coins key="m" className="h-3.5 w-3.5" />, "预计成本", tpl.executor === "纯规则" ? "¥0" : "约 ¥8.6"],
                    [
                      <FileWarning key="w" className="h-3.5 w-3.5" />,
                      "预估待复核",
                      `${Math.round((trial.pending / trial.total) * 1284)} 人`,
                    ],
                  ].map(([icon, k, v]) => (
                    <div key={k} className="rounded-md bg-slate-50 p-3">
                      <div className="flex items-center gap-1 text-[11px] text-slate-400">
                        {icon}
                        {k}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-[11px] leading-5 text-slate-500">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div>全量执行前会先抽 50 条做准确率校验，低于 85% 自动阻断。执行过程中失败率超过 10% 会自动暂停并告警。</div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs font-medium text-slate-600">试跑结论</div>
              <div className="mt-3 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">抽样准确率</span>
                  <span className={["font-semibold", trial.accuracy >= 90 ? "text-emerald-600" : "text-amber-600"].join(" ")}>
                    {trial.accuracy}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">直出率</span>
                  <span className="font-semibold text-slate-800">{Math.round((trial.confirmed / trial.total) * 100)}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">覆盖取值</span>
                  <span className="font-semibold text-slate-800">{Object.keys(trial.dist).length} / {tpl.options.length}</span>
                </div>
              </div>
              <Separator className="my-3" />
              <div className="text-[11px] leading-5 text-slate-400">
                标签值将绑定模板版本 {tpl.id}-v1。模板升级后历史值不追溯，重算需手动触发。
              </div>
            </div>
          </div>

          <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-slate-200 bg-white/95 backdrop-blur">
            <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3">
              <Button variant="outline" size="sm" onClick={() => setStep(4)}>
                <ChevronLeft className="mr-1 h-3.5 w-3.5" /> 返回试跑
              </Button>
              <Button size="sm" className="bg-[#1F3A5F] hover:bg-[#2c5185]" onClick={confirmEnable}>
                <Zap className="mr-1 h-3.5 w-3.5" /> 确认启用
              </Button>
            </div>
          </div>
        </div>
      )}

      {step === 6 && running && (
        <div className="mx-auto max-w-xl py-16">
          <div className="text-center">
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-[#1F3A5F]" />
            <h2 className="mt-4 text-lg font-semibold text-slate-900">正在执行全量计算</h2>
            <p className="mt-1 text-sm text-slate-500">已处理 {Math.round((progress / 100) * 1284)} / 1,284 人</p>
          </div>
          <Progress value={progress} className="mt-6 h-1.5" />
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            {[
              ["成功", Math.round((progress / 100) * 1284)],
              ["待复核", Math.round((progress / 100) * (trial ? trial.pending : 0) * 4)],
              ["失败", 0],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg border border-slate-200 bg-white py-3">
                <div className="text-[11px] text-slate-400">{k}</div>
                <div className="mt-0.5 text-sm font-semibold text-slate-900">{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
