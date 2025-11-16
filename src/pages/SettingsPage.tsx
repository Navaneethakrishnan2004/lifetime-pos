import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Save } from "lucide-react";

interface Settings {
  id: string;
  shop_name: string;
  shop_address: string;
  shop_phone: string;
  gst_number: string;
  tax_percentage: number;
}

const SettingsPage = () => {
  const [settings, setSettings] = useState<Settings>({
    id: "",
    shop_name: "",
    shop_address: "",
    shop_phone: "",
    gst_number: "",
    tax_percentage: 5,
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data, error } = await supabase.from("settings").select("*").single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else if (data) {
      setSettings({
        ...data,
        shop_address: data.shop_address || "",
        shop_phone: data.shop_phone || "",
        gst_number: data.gst_number || "",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await supabase
      .from("settings")
      .update({
        shop_name: settings.shop_name,
        shop_address: settings.shop_address,
        shop_phone: settings.shop_phone,
        gst_number: settings.gst_number,
        tax_percentage: settings.tax_percentage,
      })
      .eq("id", settings.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Settings updated successfully" });
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Shop Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="shop_name">Shop Name *</Label>
                <Input
                  id="shop_name"
                  value={settings.shop_name}
                  onChange={(e) => setSettings({ ...settings, shop_name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="shop_phone">Phone Number</Label>
                <Input
                  id="shop_phone"
                  value={settings.shop_phone}
                  onChange={(e) => setSettings({ ...settings, shop_phone: e.target.value })}
                  placeholder="+91 XXXXXXXXXX"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="shop_address">Address</Label>
                <Input
                  id="shop_address"
                  value={settings.shop_address}
                  onChange={(e) => setSettings({ ...settings, shop_address: e.target.value })}
                  placeholder="Shop address"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gst_number">GST Number</Label>
                <Input
                  id="gst_number"
                  value={settings.gst_number}
                  onChange={(e) => setSettings({ ...settings, gst_number: e.target.value })}
                  placeholder="GSTIN (optional)"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tax_percentage">Tax Percentage (%)</Label>
                <Input
                  id="tax_percentage"
                  type="number"
                  step="0.01"
                  value={settings.tax_percentage}
                  onChange={(e) =>
                    setSettings({ ...settings, tax_percentage: parseFloat(e.target.value) })
                  }
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full md:w-auto">
              <Save className="mr-2 h-4 w-4" />
              Save Settings
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;
