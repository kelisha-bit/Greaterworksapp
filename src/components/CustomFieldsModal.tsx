import React, { useState } from 'react';
import { X, Plus, Trash2, Edit2, Save } from 'lucide-react';
import { supabase } from '../supabase';
import { CustomFieldDefinition, OperationType } from '../types';
import { handleDatabaseError } from '../App';
import { toast } from 'sonner';

interface CustomFieldsModalProps {
  isOpen: boolean;
  onClose: () => void;
  definitions: CustomFieldDefinition[];
  onSave: () => void;
}

export function CustomFieldsModal({ isOpen, onClose, definitions, onSave }: CustomFieldsModalProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'text' as CustomFieldDefinition['type'],
    required: false,
    options: [] as string[],
  });
  const [newOption, setNewOption] = useState('');

  if (!isOpen) return null;

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'text',
      required: false,
      options: [],
    });
    setNewOption('');
    setIsAdding(false);
    setEditingId(null);
  };

  const handleEdit = (def: CustomFieldDefinition) => {
    setFormData({
      name: def.name,
      type: def.type,
      required: def.required,
      options: def.options || [],
    });
    setEditingId(def.id);
    setIsAdding(true);
  };

  const handleAddOption = () => {
    if (newOption.trim()) {
      setFormData({
        ...formData,
        options: [...formData.options, newOption.trim()],
      });
      setNewOption('');
    }
  };

  const handleRemoveOption = (index: number) => {
    setFormData({
      ...formData,
      options: formData.options.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name,
        type: formData.type,
        required: formData.required,
        options: formData.type === 'select' ? formData.options : null,
      };

      if (editingId) {
        const { error } = await supabase
          .from('custom_field_definitions')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
        toast.success('Field updated successfully');
      } else {
        const { error } = await supabase
          .from('custom_field_definitions')
          .insert([payload]);
        if (error) throw error;
        toast.success('Field added successfully');
      }
      onSave();
      resetForm();
    } catch (error) {
      handleDatabaseError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'custom_field_definitions');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this custom field? Data stored in this field for all members will be preserved but the field will no longer be visible in forms.')) return;
    try {
      const { error } = await supabase
        .from('custom_field_definitions')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Field deleted successfully');
      onSave();
    } catch (error) {
      handleDatabaseError(error, OperationType.DELETE, 'custom_field_definitions');
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
          <h2 className="text-xl font-bold text-neutral-900">Custom Fields</h2>
          <button onClick={onClose} className="p-2 text-neutral-400 hover:text-neutral-600 rounded-lg">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-6">
          {!isAdding ? (
            <div className="space-y-4">
              <button
                onClick={() => setIsAdding(true)}
                className="w-full py-3 border-2 border-dashed border-neutral-200 rounded-xl text-neutral-500 font-semibold hover:border-primary-500 hover:text-primary-600 transition-all flex items-center justify-center gap-2"
              >
                <Plus size={20} />
                Add New Field
              </button>

              <div className="space-y-3">
                {definitions.map((def) => (
                  <div key={def.id} className="flex items-center justify-between p-4 bg-neutral-50 rounded-xl border border-neutral-100">
                    <div>
                      <div className="font-bold text-neutral-900">{def.name}</div>
                      <div className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">
                        {def.type} {def.required && '• Required'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(def)}
                        className="p-2 text-neutral-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(def.id)}
                        className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
                {definitions.length === 0 && (
                  <div className="text-center py-12 text-neutral-400">
                    No custom fields defined yet.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-neutral-700">Field Name</label>
                  <input
                    required
                    type="text"
                    className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none"
                    placeholder="e.g., Blood Group, Membership Type"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-700">Field Type</label>
                    <select
                      className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none"
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    >
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                      <option value="select">Dropdown Select</option>
                      <option value="boolean">Yes / No (Checkbox)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-700">Requirement</label>
                    <div className="flex items-center gap-2 h-[42px]">
                      <input
                        type="checkbox"
                        id="required-field"
                        checked={formData.required}
                        onChange={(e) => setFormData({ ...formData, required: e.target.checked })}
                        className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                      />
                      <label htmlFor="required-field" className="text-sm text-neutral-600">Required Field</label>
                    </div>
                  </div>
                </div>

                {formData.type === 'select' && (
                  <div className="space-y-3 p-4 bg-neutral-50 rounded-xl border border-neutral-100">
                    <label className="text-sm font-semibold text-neutral-700">Dropdown Options</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="flex-1 px-4 py-2 rounded-lg border border-neutral-200 focus:ring-2 focus:ring-primary-500 outline-none"
                        placeholder="Add option..."
                        value={newOption}
                        onChange={(e) => setNewOption(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddOption())}
                      />
                      <button
                        type="button"
                        onClick={handleAddOption}
                        className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                      >
                        <Plus size={20} />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {formData.options.map((opt, i) => (
                        <div key={i} className="flex items-center gap-1 px-3 py-1 bg-white border border-neutral-200 rounded-full text-sm">
                          <span>{opt}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveOption(i)}
                            className="text-neutral-400 hover:text-red-500"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 py-3 bg-neutral-100 text-neutral-600 rounded-xl font-semibold hover:bg-neutral-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Save size={20} />
                  {editingId ? 'Update Field' : 'Save Field'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
