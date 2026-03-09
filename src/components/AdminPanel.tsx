
"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { FestivalTheme, THEME_DATA } from '@/app/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, setDocumentNonBlocking, addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking, useDoc, useMemoFirebase, useCollection, useUser } from '@/firebase';
import { collection, doc, query, orderBy, limit } from 'firebase/firestore';
import { Palette, PlusCircle, Wallet, Ruler, TrendingUp, Trash2, PackageSearch, Search, DollarSign, ListOrdered, CheckCircle2, Clock, XCircle, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface AdminPanelProps {
  currentTheme: FestivalTheme;
  isAdmin: boolean;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ currentTheme, isAdmin }) => {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('Grocery');
  const [unit, setUnit] = useState('kg');
  const [section, setSection] = useState('Daily Essentials');
  const [imageUrl, setImageUrl] = useState('');
  const [isPinned, setIsPinned] = useState(false);

  const [whatsapp, setWhatsapp] = useState('');
  const [helpline, setHelpline] = useState('');
  const [upiId, setUpiId] = useState('');
  const [upiQrUrl, setUpiQrUrl] = useState('');
  
  const [catalogSearch, setCatalogSearch] = useState('');

  const settingsRef = useMemoFirebase(() => doc(firestore, 'storeSettings', 'mainSettings'), [firestore]);
  const { data: settings } = useDoc(settingsRef);

  const productsQuery = useMemoFirebase(() => collection(firestore, 'products'), [firestore]);
  const { data: products } = useCollection(productsQuery);

  const ordersQuery = useMemoFirebase(() => {
    // Only query if the admin state is definitively true
    if (!isAdmin) return null;
    return query(collection(firestore, 'orders'), orderBy('createdAt', 'desc'), limit(50));
  }, [firestore, isAdmin]);
  const { data: orders } = useCollection(ordersQuery);

  const stats = useMemo(() => {
    if (!orders) return { orders: 0, earnings: 0 };
    return {
      orders: orders.length,
      earnings: orders.reduce((sum: number, o: any) => sum + (o.totalAmount || 0), 0)
    };
  }, [orders]);

  useEffect(() => {
    if (settings) {
      setWhatsapp(settings.whatsappNumber || '');
      setHelpline(settings.helpLineNumber || '');
      setUpiId(settings.upiId || '');
      setUpiQrUrl(settings.upiQrUrl || '');
    }
  }, [settings]);

  const handleUpdateTheme = (newTheme: FestivalTheme) => {
    const themeRef = doc(firestore, 'publicDisplaySettings', 'theme');
    setDocumentNonBlocking(themeRef, { activeThemeName: newTheme }, { merge: true });
    toast({ title: "Theme Updated" });
  };

  const handleUpdateSettings = () => {
    if (!settingsRef) return;
    setDocumentNonBlocking(settingsRef, { 
      whatsappNumber: whatsapp, 
      helpLineNumber: helpline,
      upiId: upiId,
      upiQrUrl: upiQrUrl,
      lastUpdated: new Date().toISOString()
    }, { merge: true });
    toast({ title: "Settings Saved" });
  };

  const handleAdd = async () => {
    if (!name || !price || !imageUrl) return toast({ title: "Error", description: "Fill all required fields", variant: "destructive" });
    addDocumentNonBlocking(collection(firestore, 'products'), {
      name, price: parseFloat(price), unit, section, category, imageUrl, isPinned, createdAt: new Date().toISOString()
    });
    setName(''); setPrice(''); setImageUrl('');
    toast({ title: "Product Added Successfully!" });
  };

  const handleUpdateOrderStatus = (orderId: string, newStatus: string) => {
    updateDocumentNonBlocking(doc(firestore, 'orders', orderId), { status: newStatus });
    toast({ title: `Order ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}` });
  };

  const handleDeleteProduct = (productId: string) => {
    deleteDocumentNonBlocking(doc(firestore, 'products', productId));
    toast({ title: "Product Removed" });
  };

  const filteredCatalogProducts = useMemo(() => {
    if (!products) return [];
    return products.filter(p => p.name.toLowerCase().includes(catalogSearch.toLowerCase()));
  }, [products, catalogSearch]);

  if (!isAdmin) return null;

  return (
    <div className="container mx-auto p-4 space-y-8">
      <div className="grid grid-cols-2 gap-4">
        <Card className="rounded-3xl border-none shadow-sm bg-blue-600 text-white">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center">
            <TrendingUp className="w-6 h-6 mb-2" />
            <p className="text-[10px] font-bold uppercase opacity-80">Total Activity</p>
            <p className="text-2xl font-black">{stats.orders} ORDERS</p>
          </CardContent>
        </Card>
        <Card className="rounded-3xl border-none shadow-sm bg-blue-600 text-white">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center">
            <DollarSign className="w-6 h-6 mb-2" />
            <p className="text-[10px] font-bold uppercase opacity-80">Revenue Insight</p>
            <p className="text-2xl font-black">₹{stats.earnings}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="inventory" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-blue-50 rounded-2xl h-12 p-1">
          <TabsTrigger value="inventory" className="rounded-xl font-bold uppercase text-[10px] data-[state=active]:bg-blue-600 data-[state=active]:text-white text-blue-600">Inventory</TabsTrigger>
          <TabsTrigger value="orders" className="rounded-xl font-bold uppercase text-[10px] data-[state=active]:bg-blue-600 data-[state=active]:text-white text-blue-600">Orders</TabsTrigger>
          <TabsTrigger value="settings" className="rounded-xl font-bold uppercase text-[10px] data-[state=active]:bg-blue-600 data-[state=active]:text-white text-blue-600">Config</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="rounded-3xl border-none shadow-sm h-fit">
              <CardHeader><CardTitle className="text-blue-600 font-bold uppercase text-sm flex items-center gap-2"><PlusCircle className="w-5 h-5" /> New Product</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1"><Label className="text-blue-600 font-bold uppercase text-[9px]">Product Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl bg-blue-50/30 border-none text-blue-900 font-bold h-10" /></div>
                  <div className="space-y-1"><Label className="text-blue-600 font-bold uppercase text-[9px]">Price (₹)</Label><Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="rounded-xl bg-blue-50/30 border-none text-blue-900 font-bold h-10" /></div>
                  <div className="space-y-1"><Label className="text-blue-600 font-bold uppercase text-[9px]">Store Section</Label><Input value={section} onChange={(e) => setSection(e.target.value)} className="rounded-xl bg-blue-50/30 border-none text-blue-900 font-bold h-10" /></div>
                  <div className="space-y-1"><Label className="text-blue-600 font-bold uppercase text-[9px]">Image Link</Label><Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="rounded-xl bg-blue-50/30 border-none text-blue-900 font-bold h-10" /></div>
                </div>

                <div className="space-y-2">
                  <Label className="text-blue-600 font-bold uppercase text-[9px] flex items-center gap-1.5"><Ruler className="w-3.5 h-3.5" /> Measurement Unit (SI)</Label>
                  <RadioGroup value={unit} onValueChange={setUnit} className="grid grid-cols-4 gap-2">
                    {['gm', 'kg', 'Liter', 'Pcs'].map(u => (
                      <div key={u} className={cn("p-2 rounded-xl border flex items-center justify-center cursor-pointer transition-all", unit === u ? "bg-blue-600 border-blue-600" : "bg-white border-blue-100")}>
                        <RadioGroupItem value={u} id={`u-${u}`} className="hidden" />
                        <Label htmlFor={`u-${u}`} className={cn("font-bold text-[10px] cursor-pointer uppercase", unit === u ? "text-white" : "text-blue-600")}>{u}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div className="flex items-center gap-2 bg-blue-50/30 px-3 py-2 rounded-xl border border-blue-100 w-fit">
                  <Checkbox id="c-pin" checked={isPinned} onCheckedChange={(checked) => setIsPinned(checked)} className="border-blue-300 data-[state=checked]:bg-blue-600" />
                  <Label htmlFor="c-pin" className="text-blue-600 font-bold uppercase text-[9px]">Feature at Top</Label>
                </div>

                <Button onClick={handleAdd} className="w-full h-12 rounded-xl bg-blue-600 text-white font-bold uppercase text-sm shadow-md border-none">Publish to Bazaar</Button>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-none shadow-sm h-fit">
              <CardHeader>
                <div className="flex flex-col gap-2">
                  <CardTitle className="text-blue-600 font-bold uppercase text-sm flex items-center gap-2"><PackageSearch className="w-5 h-5" /> Manage Inventory</CardTitle>
                  <div className="relative">
                    <Input 
                      placeholder="Search catalog..." 
                      value={catalogSearch} 
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      className="rounded-xl bg-blue-50/30 border-none text-blue-900 font-bold pl-9 h-10"
                    />
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-blue-400" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {filteredCatalogProducts.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between p-2 bg-blue-50/30 rounded-xl border border-blue-50">
                    <div className="flex items-center gap-3">
                      <img src={p.imageUrl} className="w-8 h-8 rounded-lg object-cover" alt="" />
                      <div>
                        <p className="text-blue-900 font-bold text-[10px] uppercase truncate max-w-[120px]">{p.name}</p>
                        <p className="text-blue-400 font-bold text-[9px]">₹{p.price} / {p.unit}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteProduct(p.id)} className="text-blue-300 hover:text-red-500 rounded-xl h-8 w-8">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="orders" className="mt-6">
          <Card className="rounded-3xl border-none shadow-sm">
            <CardHeader><CardTitle className="text-blue-600 font-bold uppercase text-sm flex items-center gap-2"><ListOrdered className="w-5 h-5" /> Live Orders</CardTitle></CardHeader>
            <CardContent className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {orders?.map((order: any) => (
                <div key={order.id} className="p-4 bg-blue-50/30 rounded-2xl border border-blue-50 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-black text-blue-400 uppercase">ID: #{order.id.slice(-6)}</p>
                      <p className="text-[10px] font-bold text-blue-900">Phone: {order.phoneNumber}</p>
                      <p className="text-[9px] font-bold text-blue-400">{new Date(order.createdAt).toLocaleString()}</p>
                    </div>
                    <Badge className={cn(
                      "text-[9px] font-black uppercase rounded-lg border-none",
                      order.status === 'pending' ? "bg-yellow-100 text-yellow-700" :
                      order.status === 'confirmed' ? "bg-blue-100 text-blue-700" :
                      order.status === 'delivered' ? "bg-green-100 text-green-700" :
                      "bg-red-100 text-red-700"
                    )}>
                      {order.status}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    {order.items?.map((item: any, i: number) => (
                      <p key={i} className="text-[10px] font-bold text-blue-800 uppercase">• {item.name} ({item.quantity} {item.unit})</p>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-dashed border-blue-100">
                    <Button onClick={() => handleUpdateOrderStatus(order.id, 'confirmed')} disabled={order.status !== 'pending'} size="sm" className="h-8 rounded-lg bg-blue-600 text-white font-black text-[9px] uppercase">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Confirm
                    </Button>
                    <Button onClick={() => handleUpdateOrderStatus(order.id, 'delivered')} disabled={order.status !== 'confirmed'} size="sm" className="h-8 rounded-lg bg-green-600 text-white font-black text-[9px] uppercase">
                      <Truck className="w-3 h-3 mr-1" /> Deliver
                    </Button>
                    <Button onClick={() => handleUpdateOrderStatus(order.id, 'cancelled')} disabled={order.status === 'delivered' || order.status === 'cancelled'} size="sm" variant="outline" className="h-8 rounded-lg border-red-200 text-red-600 font-black text-[9px] uppercase">
                      <XCircle className="w-3 h-3 mr-1" /> Reject
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="rounded-3xl border-none shadow-sm">
              <CardHeader><CardTitle className="text-blue-600 font-bold uppercase text-sm flex items-center gap-2"><Palette className="w-5 h-5" /> Special Day Themes</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-3 gap-2">
                {(Object.keys(THEME_DATA) as FestivalTheme[]).map(t => (
                  <Button 
                    key={t} 
                    onClick={() => handleUpdateTheme(t)} 
                    variant={currentTheme === t ? "default" : "outline"} 
                    className={cn(
                      "rounded-xl h-10 font-bold uppercase text-[9px]", 
                      currentTheme === t ? "bg-blue-600 text-white border-none" : "text-blue-600 border-blue-100 hover:bg-blue-50"
                    )}
                  >
                    {t}
                  </Button>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-none shadow-sm">
              <CardHeader><CardTitle className="text-blue-600 font-bold uppercase text-sm flex items-center gap-2"><Wallet className="w-5 h-5" /> Contact & UPI</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1"><Label className="text-blue-600 font-bold uppercase text-[9px]">WhatsApp Order No</Label><Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className="rounded-xl bg-blue-50/30 border-none text-blue-900 font-bold h-10" /></div>
                  <div className="space-y-1"><Label className="text-blue-600 font-bold uppercase text-[9px]">Help Line No</Label><Input value={helpline} onChange={(e) => setHelpline(e.target.value)} className="rounded-xl bg-blue-50/30 border-none text-blue-900 font-bold h-10" /></div>
                </div>
                <div className="space-y-1"><Label className="text-blue-600 font-bold uppercase text-[9px]">UPI ID</Label><Input value={upiId} onChange={(e) => setUpiId(e.target.value)} className="rounded-xl bg-blue-50/30 border-none text-blue-900 font-bold h-10" /></div>
                <div className="space-y-1"><Label className="text-blue-600 font-bold uppercase text-[9px]">UPI QR Image URL</Label><Input value={upiQrUrl} onChange={(e) => setUpiQrUrl(e.target.value)} className="rounded-xl bg-blue-50/30 border-none text-blue-900 font-bold h-10" /></div>
                <Button onClick={handleUpdateSettings} className="w-full h-11 rounded-xl bg-blue-600 text-white font-bold uppercase text-xs border-none shadow-md">Save Configuration</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
