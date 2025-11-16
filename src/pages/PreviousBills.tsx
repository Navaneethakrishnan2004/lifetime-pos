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
import { Search, Eye, Printer } from "lucide-react";
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

  const printBill = () => {
    window.print();
    toast({ title: "Print", description: "Opening print dialog..." });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Previous Bills</h1>
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
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bill #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBills.map((bill) => (
                <TableRow key={bill.id}>
                  <TableCell className="font-medium">#{bill.bill_number}</TableCell>
                  <TableCell>{format(new Date(bill.date), "dd/MM/yyyy HH:mm")}</TableCell>
                  <TableCell>₹{Number(bill.total).toFixed(2)}</TableCell>
                  <TableCell className="capitalize">{bill.payment_method || "N/A"}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => viewBill(bill)}>
                      <Eye className="mr-2 h-4 w-4" />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
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

              <Button className="w-full" onClick={printBill}>
                <Printer className="mr-2 h-4 w-4" />
                Print Bill
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PreviousBills;
