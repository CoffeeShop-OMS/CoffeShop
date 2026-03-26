const categoryColors = {
  Beans: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400', border: 'border-amber-200' },
  Milk: { bg: 'bg-sky-50', text: 'text-sky-700', dot: 'bg-sky-400', border: 'border-sky-200' },
  Syrup: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-400', border: 'border-violet-200' },
  Cups: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400', border: 'border-emerald-200' },
  Pastries: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-400', border: 'border-rose-200' },
  Equipment: { bg: 'bg-stone-50', text: 'text-stone-600', dot: 'bg-stone-400', border: 'border-stone-200' },
  Other: { bg: 'bg-stone-50', text: 'text-stone-600', dot: 'bg-stone-400', border: 'border-stone-200' },
};

export default function InventoryTable({
  isLoading,
  items,
  onUpdate,
  onDelete,
  selectedItems = new Set(),
  onSelectedChange = () => {},
}) {
  if (!Array.isArray(items)) return null;

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const newSelected = new Set(selectedItems);
      items.forEach((item) => newSelected.add(item.id));
      onSelectedChange(newSelected);
    } else {
      onSelectedChange(new Set());
    }
  };

  const handleSelectItem = (id) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    onSelectedChange(newSelected);
  };

  const allSelected = items.length > 0 && items.every((item) => selectedItems.has(item.id));

  return (
    <div className="hidden md:block overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-[#F0EDE8] bg-[#FDFCFB]">
            <th className="w-12 text-center px-4 py-3">
              <input type="checkbox" checked={allSelected} onChange={handleSelectAll} className="accent-[#3D261D] rounded" />
            </th>
            {['Item', 'SKU', 'Category', 'Stock', 'Reorder Level', 'Current Value', 'Maximum Value', 'Status', 'Actions'].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-[#A89080] uppercase tracking-widest whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={10} className="text-center text-[#A89080] py-12 text-sm">
                Loading inventory…
              </td>
            </tr>
          ) : items.length === 0 ? (
            <tr>
              <td colSpan={10} className="text-center text-[#A89080] py-12 text-sm">
                No items found.
              </td>
            </tr>
          ) : (
            items.map((item) => {
              const cc = categoryColors[item.cat] || categoryColors.Other;
              const isSelected = selectedItems.has(item.id);
              return (
                <tr
                  key={item.id}
                  className={`border-b border-[#F5F2EE] last:border-0 transition-colors duration-100
                    ${isSelected ? 'bg-[#3D261D]/5' : item.isOut ? 'bg-red-50/60 hover:bg-red-50' : 'hover:bg-[#FAF8F5]'}`}
                >
                  <td className="text-center px-4 py-3.5">
                    <input type="checkbox" checked={isSelected} onChange={() => handleSelectItem(item.id)} className="accent-[#3D261D]" />
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="text-sm font-semibold text-[#1C100A]">{item.name}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="text-sm font-mono text-[#7A6355]">{item.sku}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${cc.bg} ${cc.text} ${cc.border}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cc.dot}`} />
                      {item.cat}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className={`text-sm font-bold ${item.isOut ? 'text-red-500' : item.isLow ? 'text-amber-600' : 'text-[#1C100A]'}`}>
                      {item.stock}
                    </p>
                    <p className="text-[11px] text-[#C4B8B0] mt-0.5">Updated {item.date}</p>
                  </td>
                  <td className="px-4 py-3.5 text-sm font-medium text-[#7A6355] whitespace-nowrap">{item.reorder}</td>
                  <td className="px-4 py-3.5">
                    <span className="text-sm font-semibold text-emerald-600">₱{item.currentValue.toFixed(2)}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-sm font-semibold text-[#3D261D]">₱{item.maxValue.toFixed(2)}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide whitespace-nowrap
                      ${item.isOut ? 'bg-red-50 text-red-600 border border-red-200'
                        : item.isLow ? 'bg-amber-50 text-amber-600 border border-amber-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex gap-1.5 justify-center">
                      <button onClick={() => onUpdate(item)} className="px-3 py-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-all duration-150">Update</button>
                      <button onClick={() => onDelete(item)} className="px-3 py-1.5 text-[11px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-all duration-150">Archive</button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
