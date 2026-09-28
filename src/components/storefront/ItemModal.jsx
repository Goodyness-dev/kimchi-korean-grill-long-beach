import React, { useState } from 'react';
import { formatCents } from '../../utils/currency.js';

export default function ItemModal({ item, onClose, onAddToCart }) {
  if (!item) return null;

  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState(() => {
    const initial = {};
    // Pre-select first option for required single-choice groups
    for (const grp of item.modifier_groups || []) {
      if (grp.is_required && grp.max_selection === 1 && grp.options?.length > 0) {
        initial[grp.id] = [grp.options[0].id];
      } else {
        initial[grp.id] = [];
      }
    }
    return initial;
  });
  const [customerNotes, setCustomerNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState(null);

  // Compute live price
  let optionDeltaTotal = 0;
  for (const grp of item.modifier_groups || []) {
    const selectedIds = selectedOptions[grp.id] || [];
    for (const opt of grp.options || []) {
      if (selectedIds.includes(opt.id)) {
        optionDeltaTotal += opt.price_delta_minor || 0;
      }
    }
  }

  const unitTotal = item.price_minor + optionDeltaTotal;
  const lineTotal = unitTotal * quantity;

  function toggleOption(groupId, optionId, maxSelection, isSingle) {
    setErrorMsg(null);
    setSelectedOptions(prev => {
      const current = prev[groupId] || [];
      if (isSingle || maxSelection === 1) {
        return { ...prev, [groupId]: [optionId] };
      }
      if (current.includes(optionId)) {
        return { ...prev, [groupId]: current.filter(id => id !== optionId) };
      }
      if (current.length >= maxSelection) {
        setErrorMsg(`Maximum ${maxSelection} choices allowed for this group`);
        return prev;
      }
      return { ...prev, [groupId]: [...current, optionId] };
    });
  }

  function handleConfirmAdd() {
    // Validate required groups
    for (const grp of item.modifier_groups || []) {
      const selected = selectedOptions[grp.id] || [];
      if (grp.is_required && selected.length < (grp.min_selection || 1)) {
        setErrorMsg(`Please make a selection for required option "${grp.name}"`);
        return;
      }
    }

    const flatSelectedOptionIds = [];
    for (const ids of Object.values(selectedOptions)) {
      flatSelectedOptionIds.push(...ids);
    }

    onAddToCart({
      itemId: item.id,
      name: item.name,
      basePriceMinor: item.price_minor,
      unitPriceMinor: unitTotal,
      quantity,
      selectedOptionIds: flatSelectedOptionIds,
      customerNotes: customerNotes.trim()
    });

    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="card-thick bg-neutral-950 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border-2 border-neutral-800">
        {/* Modal Header */}
        <div className="p-5 border-b border-neutral-800 flex items-start justify-between gap-4">
          <div>
            <h3 className="font-serif text-xl font-bold text-white">{item.name}</h3>
            <p className="font-mono text-sm font-semibold text-orange-400 mt-0.5">
              Base: {formatCents(item.price_minor)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-900 transition"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body - Scrollable */}
        <div className="p-5 overflow-y-auto space-y-6">
          {item.description && (
            <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
              {item.description}
            </p>
          )}

          {errorMsg && (
            <div className="p-3 bg-red-950/80 border border-red-800 text-red-200 text-xs rounded-xl flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
              {errorMsg}
            </div>
          )}

          {/* Modifier Groups */}
          {item.modifier_groups?.map(group => {
            const isSingle = group.max_selection === 1;
            const currentSelected = selectedOptions[group.id] || [];

            return (
              <div key={group.id} className="space-y-3 p-4 rounded-xl bg-neutral-900/60 border border-neutral-800/80">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-sm text-white flex items-center gap-2">
                    <span>{group.name}</span>
                    {group.is_required && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-950 text-orange-400 border border-orange-800">
                        Required
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-neutral-400">
                    {isSingle ? 'Choose 1' : `Up to ${group.max_selection}`}
                  </span>
                </div>

                <div className="space-y-2">
                  {group.options?.map(opt => {
                    const isChecked = currentSelected.includes(opt.id);
                    return (
                      <label
                        key={opt.id}
                        className={`flex items-center justify-between p-3 rounded-lg border text-xs sm:text-sm cursor-pointer transition ${
                          isChecked
                            ? 'bg-orange-950/40 border-orange-700/80 text-white font-medium'
                            : 'bg-neutral-950/40 border-neutral-800/80 text-neutral-300 hover:border-neutral-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type={isSingle ? 'radio' : 'checkbox'}
                            name={group.id}
                            checked={isChecked}
                            onChange={() => toggleOption(group.id, opt.id, group.max_selection, isSingle)}
                            className="w-4 h-4 text-orange-600 bg-neutral-900 border-neutral-700 focus:ring-orange-500"
                          />
                          <span>{opt.name}</span>
                        </div>
                        {opt.price_delta_minor > 0 && (
                          <span className="font-mono text-orange-400 font-semibold text-xs">
                            +{formatCents(opt.price_delta_minor)}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Preparation Notes */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-neutral-400 font-medium">
              <label htmlFor="item-notes">Special Kitchen Instructions</label>
              <span>{customerNotes.length}/250</span>
            </div>
            <textarea
              id="item-notes"
              rows="2"
              maxLength="250"
              placeholder="e.g. Extra crispy crust, dressing on the side..."
              value={customerNotes}
              onChange={e => setCustomerNotes(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500 transition"
            />
          </div>

          {/* Quantity Selector */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-sm font-semibold text-neutral-300">Quantity</span>
            <div className="flex items-center gap-3 bg-neutral-900 border border-neutral-800 rounded-xl p-1">
              <button
                type="button"
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white flex items-center justify-center font-bold text-base transition"
              >
                -
              </button>
              <span className="font-mono font-bold text-white w-6 text-center text-sm">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity(q => Math.min(10, q + 1))}
                className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white flex items-center justify-center font-bold text-base transition"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-5 border-t border-neutral-800 bg-neutral-900/80 flex items-center justify-between gap-4">
          <div>
            <div className="text-[11px] text-neutral-400">Total Price</div>
            <div className="font-mono text-xl font-bold text-white">
              {formatCents(lineTotal)}
            </div>
          </div>

          <button
            type="button"
            onClick={handleConfirmAdd}
            className="flex-1 max-w-[260px] py-3 px-4 rounded-xl font-bold text-sm text-white bg-orange-600 hover:bg-orange-500 shadow-lg shadow-orange-600/30 transition flex items-center justify-center gap-2"
          >
            <span>Add to Order</span>
            <span>•</span>
            <span className="font-mono">{formatCents(lineTotal)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
