import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, ShoppingCart, Loader2 } from "lucide-react";
import { createOrder, fetchProductOptions } from "../services/database";
import { Modal } from "./common/Overlays";
import { Field, ghostBtn, inputClass, primaryBtn } from "./common/PageElements";

const CreateOrderModal = ({ open, onClose, onCreated }) => {
  const [products, setProducts] = useState([]);
  const [items, setItems] = useState([]);
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [remark, setRemark] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoadingProducts(true);
    fetchProductOptions()
      .then(setProducts)
      .catch((error) => toast.error(error.message || "加载商品失败"))
      .finally(() => setLoadingProducts(false));
  }, [open]);

  const resetForm = () => {
    setCustomerName("");
    setPhone("");
    setAddress("");
    setRemark("");
    setItems([]);
  };

  const addItem = () => {
    setItems([
      ...items,
      { product_id: "", product_name: "", unit_price: 0, quantity: 1, sku_name: "" },
    ]);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index, field, value) => {
    const newItems = [...items];
    if (field === "product_id") {
      const product = products.find((p) => p.id === value);
      if (product) {
        newItems[index] = {
          ...newItems[index],
          product_id: product.id,
          product_name: product.name,
          unit_price: product.price,
          sku_name: "",
        };
      }
    } else {
      newItems[index] = { ...newItems[index], [field]: value };
    }
    setItems(newItems);
  };

  const totalAmount = items.reduce(
    (sum, item) => sum + (Number(item.unit_price) || 0) * (Number(item.quantity) || 0),
    0
  );

  const totalQuantity = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

  const handleSubmit = async () => {
    if (!customerName.trim()) {
      toast.error("请填写客户姓名");
      return;
    }
    if (!phone.trim()) {
      toast.error("请填写联系电话");
      return;
    }
    if (!items.length) {
      toast.error("请至少添加一件商品");
      return;
    }
    if (items.some((item) => !item.product_id)) {
      toast.error("请选择所有商品");
      return;
    }
    if (items.some((item) => !item.quantity || item.quantity <= 0)) {
      toast.error("商品数量必须大于 0");
      return;
    }

    setSaving(true);
    try {
      await createOrder({
        customer_name: customerName.trim(),
        phone: phone.trim(),
        address: address.trim() || null,
        items: items.map((item) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          sku_name: item.sku_name || null,
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
        })),
        remark: remark.trim() || null,
      });
      toast.success("订单创建成功");
      resetForm();
      onCreated?.();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "创建订单失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="新建订单"
      description="填写客户信息并添加商品"
      width="max-w-2xl"
      footer={
        <>
          <button type="button" className={ghostBtn} onClick={onClose} disabled={saving}>
            取消
          </button>
          <button type="button" className={primaryBtn} onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
            创建订单
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="客户姓名 *">
            <input
              className={inputClass}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="请输入客户姓名"
            />
          </Field>
          <Field label="联系电话 *">
            <input
              className={inputClass}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="请输入联系电话"
            />
          </Field>
        </div>
        <Field label="收货地址">
          <input
            className={inputClass}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="请输入收货地址"
          />
        </Field>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-medium text-[#525252]">商品清单 *</span>
            <button type="button" className={ghostBtn} onClick={addItem}>
              <Plus className="h-3.5 w-3.5" /> 添加商品
            </button>
          </div>
          {loadingProducts ? (
            <div className="flex items-center justify-center py-6 text-[#8d8d8d]">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> 加载商品中...
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-6 text-[12px] text-[#8d8d8d] border border-dashed border-[#e0e0e0] rounded-sm">
              还没有添加商品，点击"添加商品"按钮
            </div>
          ) : (
            <div className="border border-[#e0e0e0] rounded-sm overflow-hidden">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-[#fafafa] border-b border-[#e0e0e0] text-left text-[#6f6f6f]">
                    <th className="px-3 py-2">商品</th>
                    <th className="px-3 py-2 w-20">单价</th>
                    <th className="px-3 py-2 w-24">数量</th>
                    <th className="px-3 py-2 w-20">小计</th>
                    <th className="px-3 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={index} className="border-b border-[#f0f0f0] last:border-0">
                      <td className="px-3 py-2">
                        <select
                          className={inputClass}
                          value={item.product_id}
                          onChange={(e) => updateItem(index, "product_id", e.target.value)}
                        >
                          <option value="">选择商品</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} (库存: {p.stock})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          className={inputClass}
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) => updateItem(index, "unit_price", e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          className={inputClass}
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, "quantity", e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2 text-[#161616] font-medium">
                        ¥{((Number(item.unit_price) || 0) * (Number(item.quantity) || 0)).toFixed(2)}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="p-1 rounded hover:bg-[#fef2f2] text-[#8d8d8d] hover:text-[#b91c1c] transition-colors"
                          onClick={() => removeItem(index)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between px-3 py-2 bg-[#fafafa] border-t border-[#e0e0e0] text-[12px]">
                <span className="text-[#6f6f6f]">共 {totalQuantity} 件商品</span>
                <span className="text-[#161616] font-medium">合计：¥{totalAmount.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>

        <Field label="订单备注">
          <textarea
            className={`${inputClass} h-20 resize-none`}
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="选填，订单备注信息"
          />
        </Field>
      </div>
    </Modal>
  );
};

export default CreateOrderModal;
