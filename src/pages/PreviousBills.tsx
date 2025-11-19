import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Eye, Printer, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Bill {
  id: string;
  bill_number: number;
  date: string;
  subtotal: number;
  tax_amount: number;
  discount: number;
  total: number;
  payment_method: string;
  status: string;
}

interface BillItem {
  item_name_snapshot: string;
  price_snapshot: number;
  quantity: number;
  line_total: number;
}

const PreviousBills = () => {
  const [bills, setBills] = useState<Bill[]>([]);
  const [filteredBills, setFilteredBills] = useState<Bill[]>([]);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchBills();
  }, []);

  useEffect(() => {
    filterBills();
  }, [searchQuery, bills]);

  const fetchBills = async () => {
    const { data, error } = await supabase
      .from("bills")
      .select("*")
      .neq("status", "draft")
      .order("date", { ascending: false });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setBills(data || []);
    }
  };

  const filterBills = () => {
    if (!searchQuery) {
      setFilteredBills(bills);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = bills.filter(
      (bill) =>
        bill.bill_number.toString().includes(query) ||
        bill.payment_method?.toLowerCase().includes(query) ||
        format(new Date(bill.date), "dd/MM/yyyy").includes(query)
    );
    setFilteredBills(filtered);
  };

  const viewBill = async (bill: Bill) => {
    const { data, error } = await supabase
      .from("bill_items")
      .select("*")
      .eq("bill_id", bill.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    setSelectedBill(bill);
    setBillItems(data || []);
    setIsDialogOpen(true);
  };

  const printBill = async () => {
    if (!selectedBill) return;

    const { data: settings } = await supabase.from("settings").select("shop_name, shop_phone, tax_percentage").single();
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const billDate = new Date(selectedBill.date);
    const formattedDate = `${billDate.toLocaleDateString()}, ${billDate.toLocaleTimeString()}`;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bill #${selectedBill.bill_number}</title>
          <style>
            @page {
              size: 58mm auto;
              margin: 0;
            }
            @media print {
              body {
                width: 58mm;
                margin: 0;
                padding: 2mm;
              }
            }
            body {
              font-family: 'Courier New', 'Consolas', monospace;
              width: 58mm;
              margin: 0 auto;
              padding: 2mm;
              font-size: 10px;
              line-height: 1.3;
              color: #000;
              background: #fff;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 3px 0; }
            table { width: 100%; border-collapse: collapse; font-size: 9px; }
            th, td { padding: 2px 0; text-align: left; }
            th { border-bottom: 1px solid #000; }
            .right { text-align: right; }
            .total-row { border-top: 1px solid #000; padding-top: 3px; margin-top: 3px; }
            .grand-total { font-size: 11px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="center bold">${settings?.shop_name || 'My Shop'}</div>
          ${settings?.shop_phone ? `<div class="center">Ph: ${settings.shop_phone}</div>` : ''}
          <div class="divider"></div>
          <div class="bold">Bill #: ${selectedBill.bill_number}</div>
          <div>Date: ${formattedDate}</div>
          ${selectedBill.payment_method ? `<div>Payment: ${selectedBill.payment_method}</div>` : ''}
          <div class="divider"></div>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th class="right">Qty</th>
                <th class="right">Price</th>
                <th class="right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${billItems.map(item => `
                <tr>
                  <td>${item.item_name_snapshot}</td>
                  <td class="right">${item.quantity}</td>
                  <td class="right">${Number(item.price_snapshot).toFixed(2)}</td>
                  <td class="right">${Number(item.line_total).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="divider"></div>
          <table class="total-row">
            <tr><td>Subtotal:</td><td class="right">₹${Number(selectedBill.subtotal).toFixed(2)}</td></tr>
            <tr><td>Tax (${settings?.tax_percentage || 0}%):</td><td class="right">₹${Number(selectedBill.tax_amount).toFixed(2)}</td></tr>
            ${selectedBill.discount > 0 ? `<tr><td>Discount:</td><td class="right">₹${Number(selectedBill.discount).toFixed(2)}</td></tr>` : ''}
            <tr class="grand-total"><td>TOTAL:</td><td class="right">₹${Number(selectedBill.total).toFixed(2)}</td></tr>
          </table>
          <div class="divider"></div>
          <div class="center">Thank you!</div>
          <div class="center">Visit again!</div>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const editBill = () => {
    // Navigate to billing page with bill data
    window.location.href = `/bills?edit=${selectedBill?.id}`;
  };

  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-0">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">Previous Bills</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search Bills</CardTitle>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by bill number, date, or payment method..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Bill #</TableHead>
                <TableHead className="whitespace-nowrap">Date</TableHead>
                <TableHead className="whitespace-nowrap">Total</TableHead>
                <TableHead className="whitespace-nowrap">Payment</TableHead>
                <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBills.map((bill) => (
                <TableRow key={bill.id}>
                  <TableCell className="font-medium">#{bill.bill_number}</TableCell>
                  <TableCell className="whitespace-nowrap">{format(new Date(bill.date), "dd/MM/yyyy HH:mm")}</TableCell>
                  <TableCell>₹{Number(bill.total).toFixed(2)}</TableCell>
                  <TableCell className="capitalize">{bill.payment_method || "N/A"}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => viewBill(bill)}>
                      <Eye className="h-4 w-4 md:mr-2" />
                      <span className="hidden md:inline">View</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bill #{selectedBill?.bill_number}</DialogTitle>
          </DialogHeader>
          {selectedBill && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Date</p>
                  <p className="font-medium">
                    {format(new Date(selectedBill.date), "dd/MM/yyyy HH:mm")}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Payment Method</p>
                  <p className="font-medium capitalize">{selectedBill.payment_method || "N/A"}</p>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {billItems.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{item.item_name_snapshot}</TableCell>
                      <TableCell>₹{Number(item.price_snapshot).toFixed(2)}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell className="text-right">
                        ₹{Number(item.line_total).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="space-y-2 border-t pt-4">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>₹{Number(selectedBill.subtotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax:</span>
                  <span>₹{Number(selectedBill.tax_amount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Discount:</span>
                  <span>₹{Number(selectedBill.discount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span>₹{Number(selectedBill.total).toFixed(2)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={editBill}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Bill
                </Button>
                <Button onClick={printBill}>
                  <Printer className="mr-2 h-4 w-4" />
                  Print Bill
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PreviousBills;
