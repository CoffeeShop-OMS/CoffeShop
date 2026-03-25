import { X } from 'lucide-react';
import Dropdown from '../Dropdown';

export default function ItemDrawer({
  isOpen,
  isEditMode,
  item,
  setItem,
  formError,
  onClose,
  onSubmit,
  inputCls,
  btnBrown,
}) {
  const title = isEditMode ? 'Update Item' : 'Add New Item';
  const subtitle = isEditMode ? 'Modify the details for this inventory item.' : 'Fill in the details for the new inventory item.';
  const submitText = isEditMode ? 'Update Item' : 'Save Item';
  const fields = isEditMode
    ? [
        { label: 'Item Name', field: 'itemName', type: 'text', placeholder: 'e.g. Arabica Beans' },
        { label: 'Current Stock', field: 'initialStock', type: 'number', placeholder: 'e.g. 10' },
        { label: 'Cost per Unit', field: 'costPerUnit', type: 'number', placeholder: 'e.g. 12.50' },
        { label: 'Minimum Stock', field: 'minimumStock', type: 'number', placeholder: 'e.g. 50' },
      ]
    : [
        { label: 'Item Name', field: 'itemName', type: 'text', placeholder: 'e.g. Arabica Beans' },
        { label: 'Cost per Unit', field: 'costPerUnit', type: 'number', placeholder: 'e.g. 12.50' },
        { label: 'Minimum Stock', field: 'minimumStock', type: 'number', placeholder: 'e.g. 50' },
      ];

  return (
    <>
      <button
        aria-label="Close"
        onClick={onClose}
        className={`fixed inset-0 bg-[#1C100A]/20 backdrop-blur-[2px] z-40 border-none p-0 cursor-default w-full transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />
      <aside
        className={`fixed inset-0 sm:inset-auto sm:top-0 sm:right-0 sm:h-screen sm:w-full sm:max-w-105 bg-white sm:border-l border-[#EAE5E0] shadow-2xl z-50 flex flex-col transition-all duration-300 ease-out ${
          isOpen
            ? 'opacity-100 translate-x-0 sm:translate-x-0'
            : 'opacity-0 translate-x-full sm:translate-x-full pointer-events-none'
        }`}
      >
        <form onSubmit={onSubmit} className="flex flex-col h-full">
          <div className="px-5 sm:px-7 pt-5 sm:pt-7 pb-4 sm:pb-5 border-b border-[#F0EDE8] bg-[#FDFCFB]">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-lg font-bold text-[#1C100A]" style={{ fontFamily: "'Playfair Display', serif" }}>{title}</h2>
                <p className="text-xs text-[#9E8A7A] mt-1">{subtitle}</p>
              </div>
              <button type="button" onClick={onClose} className="bg-[#F0EBE5] border-none rounded-xl p-2 cursor-pointer flex text-[#6B5744] hover:bg-[#E6DDD6] transition">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-5 sm:py-6 flex flex-col gap-4 sm:gap-5">
            {fields.map(({ label, field, type, placeholder }) => (
              <div key={field}>
                <label className="block text-[11px] font-bold text-[#7A6355] uppercase tracking-widest mb-2">{label}</label>
                <input
                  type={type}
                  min={type === 'number' ? 0 : undefined}
                  step={field === 'costPerUnit' ? '0.01' : '1'}
                  maxLength={field === 'itemName' ? 100 : undefined}
                  pattern={field === 'itemName' ? '.{1,}' : undefined}
                  value={item[field]}
                  onChange={(e) => {
                    let value = e.target.value;
                    
                    if (type === 'number') {
                      // Allow only numbers and decimal point
                      value = value.replace(/[^0-9.]/g, '');
                      
                      // For cost, allow up to 2 decimals
                      if (field === 'costPerUnit') {
                        const parts = value.split('.');
                        if (parts.length > 2) {
                          value = parts[0] + '.' + parts[1];
                        } else if (parts[1] && parts[1].length > 2) {
                          value = parts[0] + '.' + parts[1].slice(0, 2);
                        }
                      } else {
                        // For stock quantities, only integers
                        value = value.replace(/\./g, '');
                      }
                    }
                    
                    setItem((p) => ({ ...p, [field]: value }));
                  }}
                  className={inputCls}
                  placeholder={placeholder}
                  required
                />
              </div>
            ))}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-[#7A6355] uppercase tracking-widest mb-2">Category</label>
                <Dropdown
                  value={item.category}
                  onChange={(val) => setItem((p) => ({ ...p, category: val }))}
                  options={['Beans', 'Milk', 'Syrup', 'Cups', 'Pastries', 'Powder']}
                  placeholder="Select category"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#7A6355] uppercase tracking-widest mb-2">Unit</label>
                <Dropdown
                  value={item.unit}
                  onChange={(val) => setItem((p) => ({ ...p, unit: val }))}
                  options={['pcs', 'ml', 'grams', 'liters']}
                  placeholder="Select unit"
                />
              </div>
            </div>
          </div>

          <div className="px-5 sm:px-7 py-4 sm:py-5 border-t border-[#F0EDE8] flex gap-3 bg-[#FDFCFB]">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white text-[#6B5744] font-semibold text-sm border border-[#E2DDD8] hover:bg-[#FAF6F2] transition">
              Cancel
            </button>
            <button type="submit" className={`flex-1 py-2.5 rounded-xl text-sm ${btnBrown}`}>
              {submitText}
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}
