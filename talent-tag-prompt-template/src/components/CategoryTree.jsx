import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

function Node({ node, depth, selected, onSelect, compact }) {
  const [open, setOpen] = useState(depth < 1);
  const isLeaf = !node.children;
  const active = selected === node.id;

  return (
    <div>
      <div
        onClick={() => (isLeaf ? onSelect(node) : setOpen((v) => !v))}
        className={[
          "flex cursor-pointer items-center gap-1.5 rounded-md py-1.5 pr-2 text-[13px] transition",
          active ? "bg-[#1F3A5F]/[0.08] font-medium text-[#1F3A5F]" : "text-slate-600 hover:bg-slate-50",
        ].join(" ")}
        style={{ paddingLeft: 4 + depth * 14 }}
      >
        {isLeaf ? (
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
        ) : open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        )}
        <span className="truncate">{node.name}</span>
        {isLeaf && (
          <span className="ml-1 shrink-0 rounded border border-emerald-200 px-1 text-[10px] leading-4 text-emerald-600">末级</span>
        )}
        {isLeaf && node.tags > 0 && (
          <span className="shrink-0 rounded bg-slate-100 px-1 text-[10px] leading-4 text-slate-500">已建标签</span>
        )}
        {!compact && (
          <span className="ml-auto shrink-0 text-[11px] text-slate-400">
            {isLeaf ? node.tags : node.children.length}
          </span>
        )}
      </div>
      {!isLeaf && open && (
        <div>
          {node.children.map((c) => (
            <Node key={c.id} node={c} depth={depth + 1} selected={selected} onSelect={onSelect} compact={compact} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CategoryTree({ nodes, selected, onSelect, compact = false }) {
  return (
    <div>
      {nodes.map((n) => (
        <Node key={n.id} node={n} depth={0} selected={selected} onSelect={onSelect} compact={compact} />
      ))}
    </div>
  );
}
