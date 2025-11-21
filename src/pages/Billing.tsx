import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Minus, Trash2, Save, Printer, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category: string;
}

interface Settings {
  tax_percentage: number;
}

interface ShopSettings extends Settings {
  shop_name: string;
  shop_phone?: string;
}

const Billing = () => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [settings, setSettings] = useState<ShopSettings>({ tax_percentage: 5, shop_name: "My Shop" });
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [savedBills, setSavedBills] = useState<any[]>([]);
  const [currentBillId, setCurrentBillId] = useState<string | null>(null);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    fetchMenuItems();
    fetchSettings();
    fetchSavedBills();
    fetchTodayRevenue();
    
    // Check if editing a bill from URL
    const urlParams = new URLSearchParams(window.location.search);
    const editBillId = urlParams.get('edit');
    if (editBillId) {
      loadBillById(editBillId);
    }
  }, []);

  const fetchMenuItems = async () => {
    const { data, error } = await supabase
      .from("menu_items")
      .select("*")
      .eq("is_active", true)
      .order("name");

    if (error) {
      toast({ title: "Error loading menu", description: error.message, variant: "destructive" });
    } else {
      setMenuItems(data || []);
    }
  };

  const fetchSettings = async () => {
    const { data } = await supabase.from("settings").select("tax_percentage, shop_name, shop_phone").single();
    if (data) setSettings(data);
  };

  const fetchTodayRevenue = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from("bills")
      .select("total")
      .neq("status", "draft")
      .gte("date", today.toISOString());
    
    const revenue = data?.reduce((sum, bill) => sum + Number(bill.total), 0) || 0;
    setTodayRevenue(revenue);
  };

  const fetchSavedBills = async () => {
    const { data } = await supabase
      .from("bills")
      .select("*")
      .eq("status", "draft")
      .order("created_at", { ascending: false });
    setSavedBills(data || []);
  };

  const addToCart = (item: MenuItem) => {
    const existing = cart.find((c) => c.id === item.id);
    if (existing) {
      setCart(cart.map((c) => (c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c)));
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }
  };

  const updateQuantity = (id: string, change: number) => {
    setCart(
      cart
        .map((item) =>
          item.id === id ? { ...item, quantity: Math.max(0, item.quantity + change) } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeItem = (id: string) => {
    setCart(cart.filter((item) => item.id !== id));
  };

  const calculateTotals = () => {
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const taxAmount = (subtotal * settings.tax_percentage) / 100;
    const total = subtotal + taxAmount - discount;
    return { subtotal, taxAmount, total };
  };

  const saveBill = async (printAfter = false) => {
    if (cart.length === 0) {
      toast({ title: "Cart is empty", variant: "destructive" });
      return;
    }

    const { subtotal, taxAmount, total } = calculateTotals();

    const billData = {
      subtotal,
      tax_amount: taxAmount,
      discount,
      total,
      payment_method: paymentMethod || null,
      status: printAfter ? "printed" : "draft",
    };

    let billId = currentBillId;

    if (currentBillId) {
      // Update existing bill
      const { error: billError } = await supabase
        .from("bills")
        .update(billData)
        .eq("id", currentBillId);

      if (billError) {
        toast({ title: "Error updating bill", description: billError.message, variant: "destructive" });
        return;
      }

      // Delete old items
      await supabase.from("bill_items").delete().eq("bill_id", currentBillId);
    } else {
      // Create new bill
      const { data: bill, error: billError } = await supabase
        .from("bills")
        .insert(billData)
        .select()
        .single();

      if (billError || !bill) {
        toast({ title: "Error creating bill", description: billError?.message, variant: "destructive" });
        return;
      }
      billId = bill.id;
    }

    // Insert bill items
    const items = cart.map((item) => ({
      bill_id: billId,
      item_name_snapshot: item.name,
      price_snapshot: item.price,
      quantity: item.quantity,
      line_total: item.price * item.quantity,
    }));

    const { error: itemsError } = await supabase.from("bill_items").insert(items);

    if (itemsError) {
      toast({ title: "Error saving items", description: itemsError.message, variant: "destructive" });
      return;
    }

    toast({ title: printAfter ? "Bill saved & printed!" : "Bill saved!", description: "Successfully saved." });
    
    if (printAfter) {
      printBill(billId!);
    }

    clearCart();
    fetchSavedBills();
    fetchTodayRevenue();
  };

  const printBill = async (billId: string) => {
    const { data: bill } = await supabase.from("bills").select("*").eq("id", billId).single();
    const { data: items } = await supabase.from("bill_items").select("*").eq("bill_id", billId);
    
    if (!bill || !items) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const billDate = new Date(bill.date);
    const formattedDate = `${billDate.toLocaleDateString()} ${billDate.toLocaleTimeString()}`;

    // Helper function to center text (32 chars for 58mm)
    const center = (text: string, width = 32) => {
      const padding = Math.max(0, Math.floor((width - text.length) / 2));
      return ' '.repeat(padding) + text;
    };

    // Helper function to create line with left and right text
    const line = (left: string, right: string, width = 32) => {
      const space = width - left.length - right.length;
      return left + ' '.repeat(Math.max(1, space)) + right;
    };

    const divider = '-'.repeat(32);

    let receipt = '';
    receipt += center(settings.shop_name) + '\n';
    if (settings.shop_phone) {
      receipt += center(`Ph: ${settings.shop_phone}`) + '\n';
    }
    receipt += divider + '\n';
    receipt += `Bill #: ${bill.bill_number}\n`;
    receipt += `Date: ${formattedDate}\n`;
    if (bill.payment_method) {
      receipt += `Payment: ${bill.payment_method}\n`;
    }
    receipt += divider + '\n';
    receipt += 'Item             Qty Price Total\n';
    receipt += divider + '\n';

    items.forEach(item => {
      const name = item.item_name_snapshot.length > 16 
        ? item.item_name_snapshot.substring(0, 13) + '...'
        : item.item_name_snapshot.padEnd(16);
      const qty = item.quantity.toString().padStart(3);
      const price = Number(item.price_snapshot).toFixed(2).padStart(5);
      const total = Number(item.line_total).toFixed(2).padStart(6);
      receipt += `${name} ${qty} ${price} ${total}\n`;
    });

    receipt += divider + '\n';
    receipt += line('Subtotal:', `Rs.${Number(bill.subtotal).toFixed(2)}`) + '\n';
    receipt += line(`Tax (${settings.tax_percentage}%):`, `Rs.${Number(bill.tax_amount).toFixed(2)}`) + '\n';
    if (bill.discount > 0) {
      receipt += line('Discount:', `Rs.${Number(bill.discount).toFixed(2)}`) + '\n';
    }
    receipt += divider + '\n';
    receipt += line('TOTAL:', `Rs.${Number(bill.total).toFixed(2)}`) + '\n';
    receipt += divider + '\n';
    receipt += center('Thank you!') + '\n';
    receipt += center('Visit again!') + '\n\n\n';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bill #${bill.bill_number}</title>
          <style>
            @page {
              size: 58mm auto;
              margin: 0;
            }
            body {
              font-family: 'Courier New', monospace;
              font-size: 12px;
              line-height: 1.2;
              margin: 0;
              padding: 2mm;
              white-space: pre;
            }
            @media print {
              body {
                margin: 0;
                padding: 2mm;
              }
            }
          </style>
        </head>
        <body>${receipt}</body>
      </html>
    `);
    
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const loadBill = async (billId: string) => {
    const { data: billItems } = await supabase
      .from("bill_items")
      .select("*")
      .eq("bill_id", billId);

    if (billItems) {
      const { data: billData } = await supabase.from("bills").select("*").eq("id", billId).single();
      
      setCart(
        billItems.map((item) => ({
          id: item.id,
          name: item.item_name_snapshot,
          price: Number(item.price_snapshot),
          quantity: item.quantity,
          category: "Uncategorized",
        }))
      );
      
      if (billData) {
        setDiscount(Number(billData.discount));
        setPaymentMethod(billData.payment_method || "");
        setCurrentBillId(billId);
      }
    }
  };

  const loadBillById = async (billId: string) => {
    await loadBill(billId);
    const { data: bill } = await supabase.from("bills").select("bill_number").eq("id", billId).single();
    if (bill) {
      toast({ title: "Bill loaded", description: `Editing Bill #${bill.bill_number}` });
    }
  };

  const clearCart = () => {
    setCart([]);
    setDiscount(0);
    setPaymentMethod("");
    setCurrentBillId(null);
  };

  const { subtotal, taxAmount, total } = calculateTotals();

  const filteredMenuItems = menuItems.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Menu Items */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Menu Items</CardTitle>
          <Input
            placeholder="Search menu items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredMenuItems.map((item) => (
              <Card
                key={item.id}
                className="cursor-pointer transition-all hover:shadow-md"
                onClick={() => addToCart(item)}
              >
                <CardContent className="p-4">
                  <h3 className="font-semibold">{item.name}</h3>
                  <p className="text-xs text-muted-foreground mb-1">{item.category}</p>
                  <p className="text-lg text-primary">₹{item.price.toFixed(2)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Cart & Totals */}
      <div className="space-y-4">
        <Card className="dark:bg-card/80 dark:border-border/50">
          <CardHeader>
            <CardTitle>Current Bill</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {cart.length === 0 ? (
              <p className="text-center text-muted-foreground">No items in cart</p>
            ) : (
              <div className="space-y-2">
                {cart.map((item) => (
                  <div key={item.id} className="flex items-center justify-between border-b pb-2">
                    <div className="flex-1">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.category}</p>
                      <p className="text-sm text-muted-foreground">₹{item.price.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="icon" variant="outline" onClick={() => updateQuantity(item.id, -1)}>
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <Button size="icon" variant="outline" onClick={() => updateQuantity(item.id, 1)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="destructive"
                        onClick={() => removeItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2 border-t pt-4">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax ({settings.tax_percentage}%):</span>
                <span>₹{taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Discount:</span>
                <Input
                  type="number"
                  className="w-24 text-right"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                />
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span>₹{total.toFixed(2)}</span>
              </div>
            </div>

            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Payment Method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
              </SelectContent>
            </Select>

            <div className="space-y-2">
              <Button className="w-full" onClick={clearCart} variant="outline">
                <Trash2 className="mr-2 h-4 w-4" />
                Clear
              </Button>
              <Button className="w-full" onClick={() => saveBill(false)}>
                <Save className="mr-2 h-4 w-4" />
                Save Bill
              </Button>
              <Button className="w-full" onClick={() => saveBill(true)} variant="default">
                <Printer className="mr-2 h-4 w-4" />
                Save & Print
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Saved Bills */}
        {savedBills.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Saved Bills</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {savedBills.map((bill) => (
                <Button
                  key={bill.id}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => loadBill(bill.id)}
                >
                  Bill #{bill.bill_number} - ₹{Number(bill.total).toFixed(2)}
                </Button>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Billing;
