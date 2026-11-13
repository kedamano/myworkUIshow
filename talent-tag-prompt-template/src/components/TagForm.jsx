import { useMemo, useState } from "react";
import {
  Check, ChevronLeft, ChevronRight, Sparkles, Plus, Trash2, Search,
  Database, ShieldCheck, Layers, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import CategoryTree from "@/components/CategoryTree";
import TemplatePicker from "@/components/TemplatePicker";
import { tree, fieldGroups, findLeaf } from "@/data/library";

const STEPS = ["基本信息", "关联字段", "规则配置"];
const MODES = ["规则打标", "模型打标", "规则 + 模型"];

function Stepper({ step }) {
  return (
    <div className="flex items-center">
      {STEPS.map((s, i) => {
        const idx = i + 1;
        const done = step > idx;
        const cur = step === idx;
        return (
          <div key={s} className={i < STEPS.length - 1 ? "flex flex-1 items-center" : "flex items-center"}>
            <div className="flex items-center gap-2.5">
              <span
                className={[
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                  done
                    ? "bg-emerald-500 text-white"
                    : cur
                      ? "bg-[#1F3A5F] text-white ring-4 ring-[#1F3A5F]/10"
                      : "border border-slate-300 bg-white text-slate-500",
                ].join(" ")}
              >
                {done ? <Check className="h-4 w-4" /> : idx}
              </span>
              <span
                className={[
                  "whitespace-nowrap",
                  cur ? "text-sm font-semibold text-slate-900" : "text-xs font-medium text-slate-500",
                ].join(" ")}
              >
                {s}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span
                className={[
                  "mx-3 h-0.5 flex-1 rounded-full transition-colors",
                  step > idx ? "bg-emerald-400" : "bg-slate-200",
                ].join(" ")}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function TagForm({ leafId, onExit, onCreated }) {
  const [step, setStep] = useState(1);
  const [leaf, setLeaf] = useState(leafId);
  const [name, setName] = useState("");
  const [mode, setMode] = useState("规则打标");
  const [desc, setDesc] = useState("");
  const [pickedFields, setPickedFields] = useState([]);
  const [values, setValues] = useState([{ value: "", rule: "" }]);
  const [source, setSource] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);

  const cur = useMemo(() => findLeaf(tree, leaf), [leaf]);
  const path = useMemo(() => {
    const walk = (nodes, trail) => {
      for (const n of nodes) {
        if (n.id === leaf) return [...trail, n.name].join(" / ");
        if (n.children) {
          const hit = walk(n.children, [...trail, n.name]);
          if (hit) return hit;
        }
      }
      return null;
    };
    return walk(tree, []);
  }, [leaf]);

  const applyTemplate = (l) => {
    setLeaf(l.id);
    setDesc(l.tpl.desc);
    setPickedFields(l.tpl.fields);
    setValues(l.tpl.values.map((v) => ({ value: v, rule: "" })));
    setSource(`${l.path} / ${l.name}`);
    if (l.tpl.tagMode) setMode(l.tpl.tagMode);
    if (!name) setName(l.name);
  };

  const toggleField = (f) => {
    setPickedFields((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  };

  const setValueAt = (i, patch) => {
    setValues((prev) => prev.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  };

  const canNext1 = name.trim() && desc.trim() && leaf;
  const canSave = values.filter((v) => v.value.trim()).length >= 2;

  const save = () => {
    onCreated({
      name: name.trim(),
      leaf,
      mode,
      fields: pickedFields.length,
      values: values.filter((v) => v.value.trim()).length,
      status: "启用中",
      coverage: 0,
      pending: 0,
    });
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">新建标签维度</h1>
          <p className="mt-0.5 text-xs text-slate-500">{path}</p>
        </div>
        <button
          onClick={onExit}
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
        >
          <X className="h-3.5 w-3.5" /> 退出
        </button>
      </div>

      <div className="mb-4 rounded-lg border border-slate-200 bg-white px-6 py-4">
        <Stepper step={step} />
      </div>

      {step === 1 && (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-[#1F3A5F] text-[11px] font-semibold text-white">1</span>
            <span className="text-sm font-semibold text-slate-800">基本信息</span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-xs text-slate-500">标签维度 ID <span className="text-rose-500">*</span></Label>
              <div className="mt-1.5 flex h-9 items-center rounded-md border border-slate-200 bg-slate-50 px-3 font-mono text-xs text-slate-500">
                {cur?.id}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">由分类推断，创建后不可修改</p>
            </div>
            <div>
              <Label className="text-xs text-slate-500">标签维度名称 <span className="text-rose-500">*</span></Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：院校层次" className="mt-1.5 h-9 text-sm" />
              <p className="mt-1 text-[11px] text-slate-400">展示给业务用户的标签名</p>
            </div>
            <div>
              <Label className="text-xs text-slate-500">打标方式 <span className="text-rose-500">*</span></Label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="mt-1.5 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#1F3A5F]"
              >
                {MODES.map((m) => <option key={m}>{m}</option>)}
              </select>
              <p className="mt-1 text-[11px] text-slate-400">
                {mode === "规则打标" ? "仅按字段条件命中，不调模型" : mode === "模型打标" ? "由模型读文本判断，需配置置信度" : "规则优先命中，未命中交模型"}
              </p>
            </div>
            <div>
              <Label className="text-xs text-slate-500">标签分类 <span className="text-rose-500">*</span></Label>
              <div className="mt-1.5 flex h-9 items-center justify-between gap-2 rounded-md border border-slate-200 px-3">
                <span className="truncate text-sm text-slate-700">{cur?.name}</span>
                <button onClick={() => setCatOpen(true)} className="shrink-0 rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-50">
                  选择
                </button>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">仅末级分类可建标签</p>
            </div>
          </div>

          <Separator className="my-5" />

          <div className="mb-2 flex items-center justify-between">
            <Label className="text-xs text-slate-500">标签维度描述 <span className="text-rose-500">*</span></Label>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setPickerOpen(true)}>
              <Sparkles className="mr-1 h-3.5 w-3.5 text-[#1F3A5F]" /> 从模板选择
            </Button>
          </div>
          <textarea
            value={desc}
            onChange={(e) => { setDesc(e.target.value); setSource(""); }}
            rows={4}
            placeholder="描述该标签维度的业务含义和判定标准，如：根据员工出生日期判断其所属代际"
            className="w-full resize-none rounded-md border border-slate-200 p-3 text-sm leading-6 text-slate-700 outline-none focus:border-[#1F3A5F]"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {source ? (
              <>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">模板来源：{source}</span>
                <button onClick={() => { setDesc(""); setSource(""); }} className="text-[11px] text-slate-400 hover:text-slate-600">清除</button>
              </>
            ) : (
              <span className="text-[11px] text-slate-400">模板只填充描述文字，取值与命中逻辑在第 3 步定义</span>
            )}
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
            <Button variant="outline" size="sm" onClick={onExit}>取消</Button>
            <div className="flex items-center gap-3">
              {!canNext1 && <span className="text-[11px] text-slate-400">名称与描述为必填</span>}
              <Button size="sm" className="bg-[#1F3A5F] hover:bg-[#2c5185]" disabled={!canNext1} onClick={() => setStep(2)}>
                下一步：关联字段 <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-1 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-[#1F3A5F] text-[11px] font-semibold text-white">2</span>
            <span className="text-sm font-semibold text-slate-800">关联字段</span>
            <span className="ml-auto text-[11px] text-slate-400">已选 {pickedFields.length} 个</span>
          </div>
          <p className="mb-4 text-[11px] text-slate-400">口径里提到的字段需要在这里勾选，只勾业务上真实可用的字段。</p>

          <ScrollArea className="h-[420px] pr-2">
            <div className="space-y-3">
              {fieldGroups.map((g) => (
                <div key={g.group} className="rounded-md border border-slate-200">
                  <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50/60 px-3 py-1.5 text-[11px] font-medium text-slate-600">
                    <Database className="h-3 w-3" /> {g.group}
                  </div>
                  <div className="grid gap-0 sm:grid-cols-2">
                    {g.fields.map((f) => {
                      const on = pickedFields.includes(f);
                      return (
                        <button
                          key={f}
                          onClick={() => toggleField(f)}
                          className={[
                            "flex items-center gap-2 border-b border-slate-50 px-3 py-2 text-left text-xs transition last:border-0",
                            on ? "bg-[#1F3A5F]/[0.05] text-slate-800" : "text-slate-500 hover:bg-slate-50",
                          ].join(" ")}
                        >
                          <span className={[
                            "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border",
                            on ? "border-[#1F3A5F] bg-[#1F3A5F] text-white" : "border-slate-300",
                          ].join(" ")}>
                            {on && <Check className="h-2.5 w-2.5" />}
                          </span>
                          <span className="truncate font-mono text-[11px]">{f}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
            <Button variant="outline" size="sm" onClick={() => setStep(1)}>
              <ChevronLeft className="mr-1 h-3.5 w-3.5" /> 上一步
            </Button>
            <div className="flex items-center gap-3">
              {pickedFields.length === 0 && <span className="text-[11px] text-slate-400">请至少关联 1 个字段</span>}
              <Button size="sm" className="bg-[#1F3A5F] hover:bg-[#2c5185]" disabled={pickedFields.length === 0} onClick={() => setStep(3)}>
                下一步：规则配置 <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-1 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-[#1F3A5F] text-[11px] font-semibold text-white">3</span>
            <span className="text-sm font-semibold text-slate-800">规则配置</span>
            <span className="ml-auto text-[11px] text-slate-400">已定义 {values.filter((v) => v.value.trim()).length} 个取值</span>
          </div>
          <p className="mb-4 text-[11px] text-slate-400">取值在这里定，模板里不重复。取值必须是受控枚举，自由文本无法聚合统计。</p>

          <div className="overflow-hidden rounded-md border border-slate-200">
            <div className="grid grid-cols-[160px_1fr_36px] gap-2 border-b border-slate-100 bg-slate-50/60 px-3 py-1.5 text-[11px] text-slate-500">
              <span>输出取值</span>
              <span>命中条件</span>
              <span />
            </div>
            {values.map((v, i) => (
              <div key={i} className="grid grid-cols-[160px_1fr_36px] items-center gap-2 border-b border-slate-50 px-3 py-2">
                <Input
                  value={v.value}
                  onChange={(e) => setValueAt(i, { value: e.target.value })}
                  placeholder="如：985"
                  className="h-7 text-xs"
                />
                <Input
                  value={v.rule}
                  onChange={(e) => setValueAt(i, { rule: e.target.value })}
                  placeholder="如：学校名称命中 985 名单"
                  className="h-7 text-xs"
                />
                <button
                  onClick={() => setValues((prev) => prev.filter((_, idx) => idx !== i))}
                  className="flex h-7 w-7 items-center justify-center rounded text-slate-300 hover:bg-slate-100 hover:text-slate-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <div className="grid grid-cols-[160px_1fr_36px] items-center gap-2 bg-slate-50/60 px-3 py-2">
              <span className="text-xs text-slate-400">无法判断</span>
              <span className="text-[11px] text-slate-400">系统保底值，字段缺失或无法确认时自动输出</span>
              <span className="text-center text-[10px] text-slate-300">锁定</span>
            </div>
          </div>

          <button
            onClick={() => setValues((prev) => [...prev, { value: "", rule: "" }])}
            className="mt-2 flex items-center gap-1 text-[11px] text-[#1F3A5F] hover:underline"
          >
            <Plus className="h-3 w-3" /> 添加取值
          </button>

          <div className="mt-4 flex items-start gap-2 rounded-md bg-slate-50 px-3 py-2.5 text-[11px] leading-5 text-slate-500">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div>模型打标时，低于置信度阈值的结果进入待复核队列，不直接参与筛选；规则打标不产生待复核。</div>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
            <Button variant="outline" size="sm" onClick={() => setStep(2)}>
              <ChevronLeft className="mr-1 h-3.5 w-3.5" /> 上一步
            </Button>
            <div className="flex items-center gap-3">
              {!canSave && <span className="text-[11px] text-slate-400">至少定义 2 个取值</span>}
              <Button size="sm" className="bg-[#1F3A5F] hover:bg-[#2c5185]" disabled={!canSave} onClick={save}>
                保存标签维度
              </Button>
            </div>
          </div>
        </div>
      )}

      <TemplatePicker open={pickerOpen} onOpenChange={setPickerOpen} onApply={applyTemplate} />

      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Layers className="h-3.5 w-3.5" /> 选择末级分类
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[320px]">
            <CategoryTree
              nodes={tree}
              selected={leaf}
              onSelect={(n) => { setLeaf(n.id); setCatOpen(false); }}
            />
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
