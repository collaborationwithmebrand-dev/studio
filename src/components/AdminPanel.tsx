

"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { FestivalTheme, THEME_DATA } from '@/app/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, setDocumentNonBlocking, addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { collection, doc, query, orderBy, limit } from 'firebase/firestore';
import { Palette, CirclePlus, Wallet, Trash2, CircleCheck, Truck, CircleX, Database, LayoutDashboard, PhoneCall, MapPin, User, Gift, Clock, Zap, Star, Tag, ShoppingBag, Pin, Power, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { generateProductDescription } from '@/ai/flows/admin-ai-product-description';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';

interface AdminPanelProps {
  currentTheme: FestivalTheme;
  isAdmin: boolean;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ currentTheme, isAdmin }) => {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const settingsRef = useMemoFirebase(() => doc(firestore, 'storeSettings', 'mainSettings'), [firestore]);
  const { data: settings } = useDoc(settingsRef);
  
  const productsQuery = useMemoFirebase(() => collection(firestore, 'products'), [firestore]);
  const { data: products } = useCollection(productsQuery);

  const ordersQuery = useMemoFirebase(() => {
    if (!isAdmin || !firestore) return null;
    return query(collection(firestore, 'orders'), orderBy('createdAt', 'desc'), limit(50));
  }, [firestore, isAdmin]);
  const { data: orders } = useCollection(ordersQuery);

  // Product state
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('Snacks');
  const [unit, setUnit] = useState('Pcs');
  const [section, setSection] = useState('General Bazaar');
  const [imageUrl, setImageUrl] = useState('');
  const [imageUrl2, setImageUrl2] = useState('');
  const [description, setDescription] = useState('');
  const [deliveryMode, setDeliveryMode] = useState<'instant' | 'standard'>('instant');
  const [isPinned, setIsPinned] = useState(false);
  const [isOutOfStock, setIsOutOfStock] = useState(false);

  const [inventorySearch, setInventorySearch] = useState('');

  // Settings state
  const [whatsapp, setWhatsapp] = useState('');
  const [helpline, setHelpline] = useState('');
  const [upiId, setUpiId] = useState('');
  const [upiQrUrl, setUpiQrUrl] = useState('');
  const [manualRevenue, setManualRevenue] = useState<string>('0');
  const [estimatedTime, setEstimatedTime] = useState('17-25 min');
  const [freeDeliveryMsg, setFreeDeliveryMsg] = useState('');
  
  const isStoreLive = settings?.isOrderingEnabled === true;

  const UNIT_OPTIONS = ['gm', 'kg', 'Liter', 'Pcs', 'L', 'XL', 'XXL', '32', '34', '36', '38'];
  const SECTION_OPTIONS = ['General Bazaar', 'Fresh Produce', 'Electronics', 'Apparel', 'Essentials'];
  const CATEGORY_OPTIONS = ['Snacks', 'Beverages', 'Mobiles', 'Fashion', 'Grocery', 'Vegetables', 'Fruits', 'Paan & Tobacco', 'Summer', 'Beauty', 'Decor', 'Skin Care'];

  useEffect(() => {
    if (settings) {
      setWhatsapp(settings.whatsappNumber || '');
      setHelpline(settings.helpLineNumber || '');
      setUpiId(settings.upiId || '');
      setUpiQrUrl(settings.upiQrUrl || '');
      setManualRevenue(settings.manualRevenue?.toString() || '0');
      setEstimatedTime(settings.estimatedDeliveryTime || '17-25 min');
      setFreeDeliveryMsg(settings.freeDeliveryMessage || '');
    }
  }, [settings]);

  const filteredInventory = useMemo(() => {
    if (!products) return [];
    if (!inventorySearch) return products;
    return products.filter(p => 
        (p.name && p.name.toLowerCase().includes(inventorySearch.toLowerCase()))
    );
  }, [products, inventorySearch]);

  if (!isAdmin) return null;

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
      manualRevenue: parseFloat(manualRevenue) || 0,
      estimatedDeliveryTime: estimatedTime,
      freeDeliveryMessage: freeDeliveryMsg,
      lastUpdated: new Date().toISOString()
    }, { merge: true });
    toast({ title: "Settings Updated", className: "bg-blue-600 text-white" });
  };
  
  const handleToggleOrdering = (enabled: boolean) => {
      if (!settingsRef) return;
      updateDocumentNonBlocking(settingsRef, { isOrderingEnabled: enabled });
      toast({ 
          title: enabled ? "Store Ordering ENABLED" : "Store Ordering DISABLED",
          className: enabled ? "bg-green-600 text-white" : "bg-red-600 text-white",
      });
  };

  const handleAddProduct = () => {
    if (!name || !price || !imageUrl) return toast({ title: "Fields Missing", variant: "destructive" });
    addDocumentNonBlocking(collection(firestore, 'products'), {
      name, 
      price: parseFloat(price), 
      unit, 
      section, 
      category, 
      imageUrl, 
      imageUrl2: imageUrl2 || null,
      description,
      deliveryMode,
      isPinned,
      isOutOfStock,
      createdAt: new Date().toISOString()
    });
    setName(''); setPrice(''); setImageUrl(''); setImageUrl2(''); setDescription(''); 
    setCategory('Snacks'); setSection('General Bazaar');
    setIsPinned(false); setUnit('Pcs'); setIsOutOfStock(false);
    toast({ title: "Item Published", className: "bg-blue-600 text-white font-black" });
  };

  const handleUpdateOrderStatus = (orderId: string, newStatus: string) => {
    updateDocumentNonBlocking(doc(firestore, 'orders', orderId), { status: newStatus });
    toast({ title: `Order ${newStatus}`, className: "bg-blue-600 text-white font-black" });
  };

  const handleDeleteOrder = (orderId: string) => {
    deleteDocumentNonBlocking(doc(firestore, 'orders', orderId));
    toast({ title: "Order Removed", variant: "destructive" });
  };

  const handleDeleteProduct = (productId: string) => {
    deleteDocumentNonBlocking(doc(firestore, 'products', productId));
    toast({ title: "Product Deleted", variant: "destructive" });
  };

  const toggleStockStatus = (productId: string, currentStatus: boolean) => {
    updateDocumentNonBlocking(doc(firestore, 'products', productId), { isOutOfStock: !currentStatus });
    toast({ 
      title: !currentStatus ? "Marked Out of Stock" : "Marked In Stock", 
      className: !currentStatus ? "bg-red-600 text-white" : "bg-green-600 text-white" 
    });
  };

  const togglePinStatus = (productId: string, currentStatus: boolean) => {
    updateDocumentNonBlocking(doc(firestore, 'products', productId), { isPinned: !currentStatus });
    toast({ 
      title: !currentStatus ? "Pinned to Top" : "Unpinned", 
      className: "bg-yellow-500 text-white" 
    });
  };

  return (
    <div className="container mx-auto px-4 space-y-12 animate-in fade-in duration-700">
      <div className="flex items-center gap-6">
        <div className="p-5 bg-blue-100 rounded-[2rem] shadow-xl">
          <LayoutDashboard className="w-10 h-10 text-blue-600" />
        </div>
        <div>
          <h2 className="text-4xl font-black text-blue-900 uppercase italic tracking-tighter leading-none">Admin Control Center</h2>
          <p className="text-[11px] font-bold text-blue-400 uppercase tracking-[0.4em] mt-2">Bounsi Hub | Administrator Access</p>
        </div>
      </div>

      <Tabs defaultValue="orders" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-blue-50/50 rounded-[2rem] h-16 p-1.5 mb-12 shadow-inner">
          <TabsTrigger value="orders" className="rounded-xl font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-blue-600 data-[state=active]:text-white">Orders</TabsTrigger>
          <TabsTrigger value="inventory" className="rounded-xl font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-blue-600 data-[state=active]:text-white">Items</TabsTrigger>
          <TabsTrigger value="settings" className="rounded-xl font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-blue-600 data-[state=active]:text-white">Config</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {orders?.map((order: any) => (
              <Card key={order.id} className="rounded-[2rem] border-none bg-white p-6 space-y-4 shadow-xl group">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <p className="text-[9px] font-black text-blue-300 uppercase tracking-widest leading-none">ID: #{order.id.slice(-6)}</p>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-600 text-white rounded-xl"><User className="w-4 h-4" /></div>
                      <div>
                        <p className="text-xl font-black text-blue-900 leading-none italic">{order.phoneNumber}</p>
                        <Badge variant="outline" className={cn("text-[9px] font-black uppercase mt-1.5", 
                          order.status === 'confirmed' ? "border-blue-400 text-blue-600" : 
                          order.status === 'delivered' ? "border-green-400 text-green-600" :
                          order.status === 'cancelled' ? "border-red-400 text-red-600" :
                          "border-slate-200 text-slate-400"
                        )}>{order.status}</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <a href={`tel:${order.phoneNumber}`} className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"><PhoneCall className="w-4 h-4" /></a>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteOrder(order.id)} className="h-10 w-10 rounded-xl text-slate-200 hover:text-red-500 transition-all"><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-[1.2rem] p-4 space-y-3 border border-blue-50">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[9px] font-black text-blue-400 uppercase tracking-widest"><MapPin className="w-3 h-3" /> Delivery Address</div>
                    <p className="text-xs font-bold text-slate-700 italic leading-relaxed">"{order.deliveryAddress}"</p>
                  </div>
                </div>
                <div className="flex justify-between items-center px-1">
                  <p className="text-2xl font-black text-blue-600 italic leading-none">₹{order.totalAmount}</p>
                  <p className="text-[9px] font-black text-slate-300 uppercase">
                    {mounted ? new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button onClick={() => handleUpdateOrderStatus(order.id, 'confirmed')} className="flex-1 bg-blue-600 text-white font-black text-[10px] h-12 uppercase rounded-xl">Confirm</Button>
                  <Button onClick={() => handleUpdateOrderStatus(order.id, 'delivered')} className="flex-1 bg-green-600 text-white font-black text-[10px] h-12 uppercase rounded-xl">Deliver</Button>
                  <Button onClick={() => handleUpdateOrderStatus(order.id, 'cancelled')} variant="outline" className="flex-1 border-2 border-red-50 text-red-500 font-black text-[10px] h-12 uppercase rounded-xl">Cancel</Button>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <Card className="rounded-[2.5rem] p-8 bg-white shadow-2xl border-none">
              <CardHeader className="px-0 mb-6">
                <CardTitle className="text-blue-600 font-black uppercase text-xl flex items-center gap-3 italic">
                  <CirclePlus className="w-6 h-6" /> New Bazaar Item
                </CardTitle>
              </CardHeader>
              <CardContent className="px-0 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-300 ml-3">Product Name</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Premium T-Shirt" className="rounded-xl bg-slate-50 border-none h-14 font-bold" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-300 ml-3">Listing Price (₹)</Label>
                    <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price" className="rounded-xl bg-slate-50 border-none h-14 font-bold" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-300 ml-3">Main Image URL</Label>
                    <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." className="rounded-xl bg-slate-50 border-none h-14 font-bold" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-300 ml-3">2nd Image URL</Label>
                    <Input value={imageUrl2} onChange={(e) => setImageUrl2(e.target.value)} placeholder="Optional" className="rounded-xl bg-slate-50 border-none h-14 font-bold" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-300 ml-3">Section</Label>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {SECTION_OPTIONS.map(s => (
                      <Button key={s} type="button" onClick={() => setSection(s)} variant={section === s ? 'default' : 'outline'} className={cn("h-8 px-3 rounded-lg text-[9px] font-black uppercase", section === s ? 'bg-blue-600 text-white border-none' : 'border-blue-100 text-blue-400')}>{s}</Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-300 ml-3">Category</Label>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {CATEGORY_OPTIONS.map(c => (
                      <Button key={c} type="button" onClick={() => setCategory(c)} variant={category === c ? 'default' : 'outline'} className={cn("h-8 px-3 rounded-lg text-[9px] font-black uppercase", category === c ? 'bg-blue-600 text-white border-none' : 'border-blue-100 text-blue-400')}>{c}</Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-300 ml-3">Unit / Variant (Type anything: 500 gm, 1 Liter...)</Label>
                  <Input value={unit} onChange={(e) => setUnit(e.target.value)} className="rounded-xl bg-slate-50 border-none h-14 font-bold" />
                  <div className="flex flex-wrap gap-2 pt-2">
                    {UNIT_OPTIONS.map(u => (
                      <Button key={u} type="button" onClick={() => setUnit(u)} variant={unit === u ? 'default' : 'outline'} className={cn("h-8 px-3 rounded-lg text-[9px] font-black uppercase", unit === u ? 'bg-blue-600 text-white border-none' : 'border-blue-100 text-blue-400')}>{u}</Button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-blue-50/50">
                    <Switch checked={isOutOfStock} onCheckedChange={setIsOutOfStock} className="data-[state=checked]:bg-red-500" />
                    <Label className="text-[10px] font-black uppercase text-blue-900 leading-tight">Sold Out</Label>
                  </div>
                  <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-blue-50/50">
                    <Switch checked={isPinned} onCheckedChange={setIsPinned} className="data-[state=checked]:bg-yellow-500" />
                    <Label className="text-[10px] font-black uppercase text-blue-900 leading-tight">Pin to Top</Label>
                  </div>
                </div>
                <Button onClick={handleAddProduct} className="w-full h-16 rounded-[1.5rem] bg-blue-600 text-white font-black uppercase shadow-xl hover:brightness-110 text-lg italic border-none">Publish Item</Button>
              </CardContent>
            </Card>

            <Card className="rounded-[2.5rem] p-8 bg-white shadow-2xl border-none">
              <CardHeader className="px-0 mb-6">
                <CardTitle className="text-blue-600 font-black uppercase text-xl flex items-center gap-3 italic">
                  <Database className="w-6 h-6" /> Inventory
                </CardTitle>
              </CardHeader>
              <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <Input 
                    placeholder="Search inventory..." 
                    value={inventorySearch} 
                    onChange={(e) => setInventorySearch(e.target.value)}
                    className="w-full h-14 pl-12 rounded-2xl bg-slate-50 border-none shadow-inner text-base font-bold"
                />
              </div>
              <CardContent className="px-0 space-y-3 max-h-[520px] overflow-y-auto pr-2 custom-scrollbar">
                {filteredInventory?.map((p: any) => (
                  <div key={p.id} className={cn("flex items-center justify-between p-4 rounded-2xl border transition-all duration-500 group", p.isOutOfStock ? "bg-red-50 border-red-100 opacity-80" : "bg-slate-50/50 border-slate-50")}>
                    <div className="flex items-center gap-4">
                      <div className="relative w-14 h-14 rounded-xl overflow-hidden shadow-md">
                        <img src={p.imageUrl} className={cn("w-full h-full object-cover", p.isOutOfStock && "grayscale")} />
                        {p.isOutOfStock && <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center"><ShoppingBag className="w-6 h-6 text-white" /></div>}
                      </div>
                      <div>
                        <p className={cn("font-black text-xs uppercase truncate max-w-[140px] leading-tight", p.isOutOfStock ? "text-red-900" : "text-blue-900")}>{p.name}</p>
                        <p className="text-blue-400 font-black text-[9px] uppercase italic">₹{p.price} / {p.unit}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col items-center gap-1">
                        <Switch checked={p.isPinned} onCheckedChange={() => togglePinStatus(p.id, p.isPinned)} className="scale-75 data-[state=checked]:bg-yellow-500" />
                        <span className="text-[7px] font-black uppercase text-slate-400">PIN</span>
                      </div>
                      <div className="flex flex-col items-center gap-1 mx-2">
                        <Switch checked={!p.isOutOfStock} onCheckedChange={() => toggleStockStatus(p.id, p.isOutOfStock)} className="scale-75 data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500" />
                        <span className="text-[7px] font-black uppercase text-slate-400">{p.isOutOfStock ? "OUT" : "IN"}</span>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteProduct(p.id)} className="h-10 w-10 rounded-xl text-slate-200 hover:text-red-600 transition-all"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="settings" className="space-y-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <Card className="rounded-[2.5rem] p-8 bg-white shadow-2xl border-none">
              <CardHeader className="px-0 mb-6">
                <CardTitle className="text-blue-600 font-black uppercase text-xl flex items-center gap-3 italic">
                  <Palette className="w-6 h-6" /> Themes
                </CardTitle>
              </CardHeader>
              <CardContent className="px-0 grid grid-cols-2 gap-3">
                {(Object.keys(THEME_DATA) as FestivalTheme[]).map(t => (
                  <Button key={t} onClick={() => handleUpdateTheme(t)} variant={currentTheme === t ? "default" : "outline"} className={cn("rounded-xl font-black text-[9px] uppercase h-14 transition-all", currentTheme === t ? "bg-blue-600 text-white shadow-lg border-none" : "border-slate-50 text-slate-400")}>{t}</Button>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-[2.5rem] p-8 bg-white shadow-2xl border-none">
              <CardHeader className="px-0 mb-6">
                <CardTitle className="text-blue-600 font-black uppercase text-xl flex items-center gap-3 italic">
                  <Wallet className="w-6 h-6" /> Shop Config
                </CardTitle>
              </CardHeader>
              <CardContent className="px-0 space-y-4">
                <div className={cn("flex items-center justify-between p-4 rounded-2xl border-2",
                    isStoreLive ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
                )}>
                    <div className="flex items-center gap-3">
                        <Power className={cn("w-6 h-6", isStoreLive ? "text-green-600" : "text-red-600")} />
                        <Label className="text-sm font-black uppercase text-blue-900">
                            {isStoreLive ? "Store is LIVE" : "Store is OFF"}
                        </Label>
                    </div>
                    <Switch
                        checked={isStoreLive}
                        onCheckedChange={handleToggleOrdering}
                        className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-red-600"
                    />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-300 ml-3">Global Delivery Time (e.g. 17-25 min)</Label>
                  <Input value={estimatedTime} onChange={(e) => setEstimatedTime(e.target.value)} className="rounded-xl bg-slate-50 border-none h-14 font-black text-blue-900" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-300 ml-3">Announcement Banner (e.g. Free Delivery)</Label>
                  <Input value={freeDeliveryMsg} onChange={(e) => setFreeDeliveryMsg(e.target.value)} className="rounded-xl bg-slate-50 border-none h-14 font-bold" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-300 ml-3">WhatsApp No.</Label>
                  <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className="rounded-xl bg-slate-50 border-none h-14 font-bold" />
                </div>
                <Button onClick={handleUpdateSettings} className="w-full h-16 rounded-[1.2rem] bg-blue-600 text-white font-black uppercase italic shadow-xl border-none mt-4">Save Configuration</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
