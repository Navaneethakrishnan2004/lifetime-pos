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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, Eye, Printer, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [billToDelete, setBillToDelete] = useState<Bill | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

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

  const editBill = (bill: Bill) => {
    navigate(`/billing?edit=${bill.id}`);
  };

  const confirmDelete = (bill: Bill) => {
    setBillToDelete(bill);
    setDeleteDialogOpen(true);
  };

  const deleteBill = async () => {
    if (!billToDelete) return;

    // Delete bill items first
    await supabase.from("bill_items").delete().eq("bill_id", billToDelete.id);
    
    // Then delete the bill
    const { error } = await supabase.from("bills").delete().eq("id", billToDelete.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Bill deleted", description: `Bill #${billToDelete.bill_number} has been deleted.` });
      fetchBills();
    }

    setDeleteDialogOpen(false);
    setBillToDelete(null);
  };

  const printBill = async () => {
    if (!selectedBill) return;

    const { data: settings } = await supabase.from("settings").select("shop_name, shop_phone, tax_percentage").single();
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const billDate = new Date(selectedBill.date);
    const formattedDate = `${billDate.toLocaleDateString()} ${billDate.toLocaleTimeString()}`;

    const center = (text: string, width = 32) => {
      const padding = Math.max(0, Math.floor((width - text.length) / 2));
      return ' '.repeat(padding) + text;
    };

    const line = (left: string, right: string, width = 32) => {
      const space = width - left.length - right.length;
      return left + ' '.repeat(Math.max(1, space)) + right;
    };

    const divider = '-'.repeat(32);

    let receipt = '';
    receipt += center(settings?.shop_name || 'My Shop') + '\n';
    if (settings?.shop_phone) {
      receipt += center(`Ph: ${settings.shop_phone}`) + '\n';
    }
    receipt += divider + '\n';
    receipt += `Bill #: ${selectedBill.bill_number}\n`;
    receipt += `Date: ${formattedDate}\n`;
    if (selectedBill.payment_method) {
      receipt += `Payment: ${selectedBill.payment_method}\n`;
    }
    receipt += divider + '\n';
    receipt += 'Item             Qty Price Total\n';
    receipt += divider + '\n';

    billItems.forEach(item => {
      const name = item.item_name_snapshot.length > 16 
        ? item.item_name_snapshot.substring(0, 13) + '...'
        : item.item_name_snapshot.padEnd(16);
      const qty = item.quantity.toString().padStart(3);
      const price = Number(item.price_snapshot).toFixed(2).padStart(5);
      const total = Number(item.line_total).toFixed(2).padStart(6);
      receipt += `${name} ${qty} ${price} ${total}\n`;
    });

    receipt += divider + '\n';
    receipt += line('Subtotal:', `Rs.${Number(selectedBill.subtotal).toFixed(2)}`) + '\n';
    receipt += line(`Tax (${settings?.tax_percentage || 0}%):`, `Rs.${Number(selectedBill.tax_amount).toFixed(2)}`) + '\n';
    if (selectedBill.discount > 0) {
      receipt += line('Discount:', `Rs.${Number(selectedBill.discount).toFixed(2)}`) + '\n';
    }
    receipt += divider + '\n';
    receipt += line('TOTAL:', `Rs.${Number(selectedBill.total).toFixed(2)}`) + '\n';
    receipt += divider + '\n';
    receipt += center('Thank you!') + '\n';
    receipt += center('Visit again!') + '\n\n\n';

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
            body {
              font-family: 'Courier New', 'Lucida Console', monospace;
              font-size: 14px;
              font-weight: 900;
              line-height: 1.4;
              margin: 0;
              padding: 3mm;
              white-space: pre;
              color: #000000;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            @media print {
              body {
                margin: 0;
                padding: 3mm;
                font-weight: 900;
                color: #000000;
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
                <TableHead className="whitespace-nowrap">Status</TableHead>
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
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs capitalize ${
                      bill.status === 'printed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                      bill.status === 'saved' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                      'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                    }`}>
                      {bill.status || 'saved'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => viewBill(bill)} title="View">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => editBill(bill)} title="Edit">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => confirmDelete(bill)} title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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
                <Button variant="outline" onClick={() => { setIsDialogOpen(false); editBill(selectedBill); }}>
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Bill #{billToDelete?.bill_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the bill and all its items.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteBill} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PreviousBills;
