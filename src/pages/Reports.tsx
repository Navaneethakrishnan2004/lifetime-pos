import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, TrendingUp, DollarSign, ShoppingCart, Receipt, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval } from "date-fns";
import { cn } from "@/lib/utils";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface RevenueData {
  date: string;
  revenue: number;
  bills: number;
}

interface PaymentMethodData {
  method: string;
  amount: number;
  count: number;
}

type PeriodType = "custom" | "today" | "week" | "month" | "year";

const Reports = () => {
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("month");
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [paymentData, setPaymentData] = useState<PaymentMethodData[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalBills, setTotalBills] = useState(0);
  const [avgBillValue, setAvgBillValue] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    fetchRevenueData();
  }, [startDate, endDate]);

  const setPeriod = (period: PeriodType) => {
    setSelectedPeriod(period);
    const now = new Date();
    
    switch (period) {
      case "today":
        setStartDate(new Date(now.setHours(0, 0, 0, 0)));
        setEndDate(new Date());
        break;
      case "week":
        setStartDate(startOfWeek(now, { weekStartsOn: 1 }));
        setEndDate(endOfWeek(now, { weekStartsOn: 1 }));
        break;
      case "month":
        setStartDate(startOfMonth(now));
        setEndDate(endOfMonth(now));
        break;
      case "year":
        setStartDate(startOfYear(now));
        setEndDate(endOfYear(now));
        break;
    }
  };

  const fetchRevenueData = async () => {
    const { data: bills, error } = await supabase
      .from("bills")
      .select("*")
      .neq("status", "draft")
      .gte("date", startDate.toISOString())
      .lte("date", endDate.toISOString())
      .order("date");

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    if (!bills || bills.length === 0) {
      setRevenueData([]);
      setPaymentData([]);
      setTotalRevenue(0);
      setTotalBills(0);
      setAvgBillValue(0);
      return;
    }

    // Calculate totals
    const total = bills.reduce((sum, bill) => sum + Number(bill.total), 0);
    setTotalRevenue(total);
    setTotalBills(bills.length);
    setAvgBillValue(total / bills.length);

    // Group by date for chart
    const groupedByDate: { [key: string]: { revenue: number; bills: number } } = {};
    
    bills.forEach((bill) => {
      const dateKey = format(new Date(bill.date), "MMM dd");
      if (!groupedByDate[dateKey]) {
        groupedByDate[dateKey] = { revenue: 0, bills: 0 };
      }
      groupedByDate[dateKey].revenue += Number(bill.total);
      groupedByDate[dateKey].bills += 1;
    });

    const chartData = Object.entries(groupedByDate).map(([date, data]) => ({
      date,
      revenue: Number(data.revenue.toFixed(2)),
      bills: data.bills,
    }));

    setRevenueData(chartData);

    // Group by payment method
    const paymentMethods: { [key: string]: { amount: number; count: number } } = {};
    
    bills.forEach((bill) => {
      const method = bill.payment_method || "Not Specified";
      if (!paymentMethods[method]) {
        paymentMethods[method] = { amount: 0, count: 0 };
      }
      paymentMethods[method].amount += Number(bill.total);
      paymentMethods[method].count += 1;
    });

    const paymentChartData = Object.entries(paymentMethods).map(([method, data]) => ({
      method: method.charAt(0).toUpperCase() + method.slice(1),
      amount: Number(data.amount.toFixed(2)),
      count: data.count,
    }));

    setPaymentData(paymentChartData);
  };

  const downloadPDF = async () => {
    const { data: bills, error } = await supabase
      .from("bills")
      .select("*, bill_items(*)")
      .neq("status", "draft")
      .gte("date", startDate.toISOString())
      .lte("date", endDate.toISOString())
      .order("date");

    if (error || !bills || bills.length === 0) {
      toast({ 
        title: "No data", 
        description: "No bills found for selected date range", 
        variant: "destructive" 
      });
      return;
    }

    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(18);
    doc.text("Bills Report", 14, 20);
    doc.setFontSize(11);
    doc.text(`Period: ${format(startDate, "PPP")} - ${format(endDate, "PPP")}`, 14, 28);
    
    // Summary
    doc.setFontSize(10);
    doc.text(`Total Bills: ${bills.length}`, 14, 36);
    doc.text(`Total Revenue: ₹${totalRevenue.toFixed(2)}`, 14, 42);
    doc.text(`Average Bill: ₹${avgBillValue.toFixed(2)}`, 14, 48);

    // Bills table
    const tableData = bills.map((bill: any) => [
      bill.bill_number,
      format(new Date(bill.date), "dd/MM/yyyy HH:mm"),
      bill.payment_method || "N/A",
      `₹${Number(bill.subtotal).toFixed(2)}`,
      `₹${Number(bill.tax_amount).toFixed(2)}`,
      `₹${Number(bill.discount).toFixed(2)}`,
      `₹${Number(bill.total).toFixed(2)}`,
    ]);

    autoTable(doc, {
      startY: 55,
      head: [["Bill #", "Date", "Payment", "Subtotal", "Tax", "Discount", "Total"]],
      body: tableData,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [52, 152, 219] },
    });

    doc.save(`bills-report-${format(startDate, "yyyy-MM-dd")}-to-${format(endDate, "yyyy-MM-dd")}.pdf`);
    
    toast({ 
      title: "Success", 
      description: "Report downloaded successfully" 
    });
  };

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--warning))', 'hsl(var(--info))'];

  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-0">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-bold">Revenue Reports</h1>
        <Button onClick={downloadPDF} className="gap-2">
          <Download className="h-4 w-4" />
          Download PDF Report
        </Button>
      </div>

      {/* Period Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Period</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedPeriod === "today" ? "default" : "outline"}
              onClick={() => setPeriod("today")}
            >
              Today
            </Button>
            <Button
              variant={selectedPeriod === "week" ? "default" : "outline"}
              onClick={() => setPeriod("week")}
            >
              This Week
            </Button>
            <Button
              variant={selectedPeriod === "month" ? "default" : "outline"}
              onClick={() => setPeriod("month")}
            >
              This Month
            </Button>
            <Button
              variant={selectedPeriod === "year" ? "default" : "outline"}
              onClick={() => setPeriod("year")}
            >
              This Year
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <p className="text-sm mb-2 font-medium">Start Date</p>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : <span>Pick start date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => {
                      if (date) {
                        setStartDate(date);
                        setSelectedPeriod("custom");
                      }
                    }}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex-1">
              <p className="text-sm mb-2 font-medium">End Date</p>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : <span>Pick end date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => {
                      if (date) {
                        setEndDate(date);
                        setSelectedPeriod("custom");
                      }
                    }}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="dark:bg-card/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">₹{totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {format(startDate, "MMM dd")} - {format(endDate, "MMM dd, yyyy")}
            </p>
          </CardContent>
        </Card>

        <Card className="dark:bg-card/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bills</CardTitle>
            <Receipt className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent">{totalBills}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Bills completed in period
            </p>
          </CardContent>
        </Card>

        <Card className="dark:bg-card/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Bill Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-info" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" style={{ color: 'hsl(var(--info))' }}>
              ₹{avgBillValue.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Per transaction
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      <Card className="dark:bg-card/80">
        <CardHeader>
          <CardTitle>Revenue Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {revenueData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis 
                  dataKey="date" 
                  className="text-xs"
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis 
                  className="text-xs"
                  stroke="hsl(var(--muted-foreground))"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0.5rem',
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  name="Revenue (₹)"
                  dot={{ fill: 'hsl(var(--primary))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
              No data available for selected period
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bills Count Chart */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="dark:bg-card/80">
          <CardHeader>
            <CardTitle>Bills Volume</CardTitle>
          </CardHeader>
          <CardContent>
            {revenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis 
                    dataKey="date" 
                    className="text-xs"
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis 
                    className="text-xs"
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '0.5rem',
                    }}
                  />
                  <Bar 
                    dataKey="bills" 
                    fill="hsl(var(--accent))"
                    name="Bills Count"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="dark:bg-card/80">
          <CardHeader>
            <CardTitle>Payment Methods</CardTitle>
          </CardHeader>
          <CardContent>
            {paymentData.length > 0 ? (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={paymentData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ method, percent }) => `${method} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="hsl(var(--primary))"
                      dataKey="amount"
                    >
                      {paymentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '0.5rem',
                      }}
                      formatter={(value: number) => `₹${value.toFixed(2)}`}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {paymentData.map((item, index) => (
                    <div key={item.method} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span>{item.method}</span>
                      </div>
                      <div className="flex gap-4">
                        <span className="text-muted-foreground">{item.count} bills</span>
                        <span className="font-medium">₹{item.amount.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Reports;
