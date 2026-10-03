import { Trash2, TreePine, Droplets, Flower2, Trees, Fence, HelpCircle } from "lucide-react";

export const CATEGORY_ICONS = {
  garbage: Trash2,
  tree: TreePine,
  water: Droplets,
  plants: Flower2,
  park: Trees,
  blocked: Fence,
};

export default function CategoryIcon({ category, size = "md" }) {
  const Icon = CATEGORY_ICONS[category] || HelpCircle;
  const box = size === "sm" ? "size-7 rounded-lg" : "size-9 rounded-xl";
  const ic = size === "sm" ? "size-3.5" : "size-4";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center bg-green-50 text-green-700 ${box}`}
    >
      <Icon className={ic} />
    </span>
  );
}
