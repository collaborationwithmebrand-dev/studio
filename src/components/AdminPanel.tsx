"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { FestivalTheme, THEME_DATA } from '@/app/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, setDocumentNonBlocking, addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { collection, doc, query, orderBy, limit } from 'firebase/firestore';
import { Palette, PlusCircle, Wallet, Ruler, TrendingUp, Trash2, PackageSearch, Search, DollarSign, ListOrdered, CheckCircle2, Truck, Sparkles, Loader2, Megaphone, Send, PhoneCall, Gift, MapPinned, XCircle, LayoutDashboard, Settings2, BarChart3, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { generateProductDescription } from '@/ai/flows/admin-ai-product-description';
import { Textarea } from '@/components/ui/textarea';

interface AdminPanelProps {
  currentTheme: FestivalTheme;
  isAdmin: boolean;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ currentTheme, isAdmin }) => {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('Grocery');
  const [unit, setUnit] = useState('kg');
  const [section, setSection] = useState('Daily Essentials');
  const [imageUrl, setImageUrl] = useState('');
  const [description, setDescription] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const [whatsapp, setWhatsapp] = useState('');
  const [helpline, setHelpline] = useState('');
  const [upiId, setUpiId] = useState('');
  const [upiQrUrl, setUpiQrUrl] = useState('');
  const [manualRevenue, setManualRevenue] = useState('');
  
  const [announcementMsg, setAnnouncementMsg] = useState('');
  const [isAnnouncementActive, setIsAnnouncementActive] = useState(false);
  
  const [catalogSearch, setCatalogSearch] = useState('');

  const settingsRef = useMemoFirebase(() => doc(firestore, 'storeSettings', 'mainSettings'), [firestore]);
  const { data: settings } = useDoc(settingsRef);

  const announcementRef = useMemoFirebase(() => doc(firestore, 'storeSettings', 'announcement'), [firestore]);
  const { data: announcement } = useDoc(announcementRef);

  const productsQuery = useMemoFirebase(() => collection(firestore, 'products'), [firestore]);
  const { data: products } = useCollection(productsQuery);

  const ordersQuery = useMemoFirebase(() => {
    if (!isAdmin || !firestore) return null;
    return query(collection(firestore, 'orders'), orderBy('createdAt', 'desc'), limit(50));
  }, [firestore, isAdmin]);
  const { data: orders } = useCollection(ordersQuery);

  const stats = useMemo(() => {
    if (!orders) return { orders: 0 };
    return { orders: orders.length };
  }, [orders]);

  useEffect(() => {
    if (settings) {
      setWhatsapp(settings.whatsappNumber || '');
      setHelpline(settings.helpLineNumber || '');
      setUpiId(settings.upiId || '');
      setUpiQrUrl(settings.upiQrUrl || '');
      setManualRevenue(settings.manualRevenue?.toString() || '0');
    }
  }, [settings]);

  useEffect(() => {
    if (announcement) {
      setAnnouncementMsg(announcement.message || '');
      setIsAnnouncementActive(announcement.active || false);
    }
  }, [announcement]);

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
      lastUpdated: new Date().toISOString()
    }, { merge: true });
    toast({ title: "Settings Saved" });
  };

  const handleUpdateAnnouncement = () => {
    if (!announcementRef) return;
    setDocumentNonBlocking(announcementRef, {
      message: announcementMsg,
      active: isAnnouncementActive,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    toast({ 
      title: "Broadcast Sent!", 
      description: "Information updated globally.",
      className: "bg-blue-600 text-white font-black" 
    });
  };

  const handleAdd = async () => {
    if (!name || !price || !imageUrl) return toast({ title: "Error", description: "Fill all required fields", variant: "destructive" });
    addDocumentNonBlocking(collection(firestore, 'products'), {
      name, 
      price: parseFloat(price), 
      unit, 
      section, 
      category, 
      imageUrl, 
      description,
      isPinned, 
      createdAt: new Date().toISOString()
    });
    setName(''); setPrice(''); setImageUrl(''); setDescription('');
    toast({ title: "Product Published", className: "bg-blue-600 text-white font-black" });
  };

  const handleUpdateOrderStatus = (orderId: string, newStatus: string) => {
    updateDocumentNonBlocking(doc(firestore, 'orders', orderId), { status: newStatus });
    toast({ title: `Order ${newStatus.toUpperCase()}`, className: "bg-blue-600 text-white font-black" });
  };

  const handleDeleteOrder = (orderId: string) => {
    deleteDocumentNonBlocking(doc(firestore, 'orders', orderId));
    toast({ title: "Order Removed", variant: "destructive" });
  };

  const handleDeleteProduct = (productId: string) => {
    deleteDocumentNonBlocking(doc(firestore, 'products', productId));
    toast({ title: "Product Removed", variant: "destructive" });
  };

  const handleAiDescription = async () => {
    if (!name) return toast({ title: "AI Warning", description: "Enter product name first", variant: "destructive" });
    setIsAiLoading(true);
    try {
      const result = await generateProductDescription({
        productName: name,
        keywords: [category, section, unit]
      });
      setDescription(result.description);
      toast({ title: "AI Magic Done", className: "bg-blue-600 text-white font-black" });
    } catch (e) {
      toast({ title: "AI Generation Failed", variant: "destructive" });
    } finally {
      setIsAiLoading(false);
    }
  };

  const filteredCatalogProducts = useMemo(() => {
    if (!products) return [];
    return products.filter(p => p.name.toLowerCase().includes(catalogSearch.toLowerCase()));
  }, [products, catalogSearch]);

  if (!isAdmin) return null;

  return (
    <div className="container mx-auto p-6 space-y-12">
      <div className="flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="space-y-2">
          <h2 className="text-4xl font-black text-blue-900 uppercase italic tracking-tighter">Bazaar Control Hub</h2>
          <p className="text-[11px] font-black text-blue-400 uppercase tracking-widest">Admin Dashboard / {currentTheme}</p>
        </div>
        <div className="grid grid-cols-2 gap-6 w-full md:w-auto">
          <Card className="rounded-[2.5rem] border-none shadow-2xl bg-blue-600 text-white p-8 min-w-[200px] flex flex-col items-center justify-center text-center">
             <BarChart3 className="w-8 h-8 mb-4 text-blue-100 opacity-80" />
             <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-100 mb-2">Total Orders</p>
             <p className="text-5xl font-black italic">{stats.orders}</p>
          </Card>
          <Card className="rounded-[2.5rem] border-none shadow-2xl bg-blue-600 text-white p-8 min-w-[200px] flex flex-col items-center justify-center text-center">
             <DollarSign className="w-8 h-8 mb-4 text-blue-100 opacity-80" />
             <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-100 mb-2">Manual Earnings</p>
             <p className="text-5xl font-black italic">₹{settings?.manualRevenue || 0}</p>
          </Card>
        </div>
      </div>

      <Tabs defaultValue="inventory" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-blue-50 rounded-[2rem] h-20 p-2 mb-12 shadow-inner">
          <TabsTrigger value="inventory" className="rounded-[1.5rem] font-black uppercase text-[11px] data-[state=active]:bg-blue-600 data-[state=active]:text-white text-blue-600 transition-all gap-2 tracking-widest"><Database className="w-4 h-4" /> Inventory</TabsTrigger>
          <TabsTrigger value="orders" className="rounded-[1.5rem] font-black uppercase text-[11px] data-[state=active]:bg-blue-600 data-[state=active]:text-white text-blue-600 transition-all gap-2 tracking-widest"><ListOrdered className="w-4 h-4" /> Live Stream</TabsTrigger>
          <TabsTrigger value="broadcast" className="rounded-[1.5rem] font-black uppercase text-[11px] data-[state=active]:bg-blue-600 data-[state=active]:text-white text-blue-600 transition-all gap-2 tracking-widest"><Megaphone className="w-4 h-4" /> Broadcast</TabsTrigger>
          <TabsTrigger value="settings" className="rounded-[1.5rem] font-black uppercase text-[11px] data-[state=active]:bg-blue-600 data-[state=active]:text-white text-blue-600 transition-all gap-2 tracking-widest"><Settings2 className="w-4 h-4" /> Config Hub</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-12 animate-in fade-in duration-700">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <Card className="rounded-[3rem] border-none shadow-2xl h-fit bg-white p-4">
              <CardHeader className="pb-8 border-b-2 border-blue-50 mb-8"><CardTitle className="text-blue-600 font-black uppercase text-xl flex items-center gap-4 italic tracking-tighter"><PlusCircle className="w-8 h-8" /> Publish New Item</CardTitle></CardHeader>
              <CardContent className="space-y-8">
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <Label className="text-blue-600 font-black uppercase text-[10px] ml-4 tracking-widest">Product Title</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-2xl bg-blue-50/50 border-none text-blue-900 font-black h-14 px-6 focus:bg-white transition-all shadow-inner" placeholder="Fresh Mango" />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-blue-600 font-black uppercase text-[10px] ml-4 tracking-widest">Market Price (₹)</Label>
                    <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="rounded-2xl bg-blue-50/50 border-none text-blue-900 font-black h-14 px-6 focus:bg-white transition-all shadow-inner" placeholder="0.00" />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-blue-600 font-black uppercase text-[10px] ml-4 tracking-widest">Section</Label>
                    <Input value={section} onChange={(e) => setSection(e.target.value)} className="rounded-2xl bg-blue-50/50 border-none text-blue-900 font-black h-14 px-6 focus:bg-white transition-all shadow-inner" placeholder="Fresh Fruits" />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-blue-600 font-black uppercase text-[10px] ml-4 tracking-widest">Image URL</Label>
                    <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="rounded-2xl bg-blue-50/50 border-none text-blue-900 font-black h-14 px-6 focus:bg-white transition-all shadow-inner" placeholder="https://..." />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <Label className="text-blue-600 font-black uppercase text-[10px] flex items-center gap-3 tracking-widest">Product Bio (AI Optimized)</Label>
                    <Button onClick={handleAiDescription} disabled={isAiLoading} variant="ghost" className="h-10 text-[10px] font-black text-blue-600 hover:bg-blue-50 uppercase gap-3 px-6 rounded-full border border-blue-100 transition-all">
                      {isAiLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />} Magical AI
                    </Button>
                  </div>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Engaging details for your customers..." className="rounded-[1.5rem] bg-blue-50/50 border-none text-blue-900 font-bold text-sm resize-none h-40 px-6 py-6 focus:bg-white transition-all shadow-inner" />
                </div>

                <div className="space-y-4">
                  <Label className="text-blue-600 font-black uppercase text-[10px] ml-4 flex items-center gap-3 tracking-widest"><Ruler className="w-5 h-5" /> Measurement Logic (SI Units)</Label>
                  <RadioGroup value={unit} onValueChange={setUnit} className="grid grid-cols-4 gap-4">
                    {['gm', 'kg', 'Liter', 'Pcs'].map(u => (
                      <div key={u} className={cn("p-5 rounded-2xl border-2 flex items-center justify-center cursor-pointer transition-all shadow-sm", unit === u ? "bg-blue-600 border-blue-600 shadow-blue-200" : "bg-white border-blue-50 hover:border-blue-200")}>
                        <RadioGroupItem value={u} id={`u-${u}`} className="hidden" />
                        <Label htmlFor={`u-${u}`} className={cn("font-black text-[12px] cursor-pointer uppercase tracking-widest", unit === u ? "text-white" : "text-blue-600")}>{u}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div className="flex items-center gap-4 bg-blue-50/50 px-6 py-4 rounded-2xl border border-blue-100 w-fit shadow-inner">
                  <Checkbox id="c-pin" checked={isPinned} onCheckedChange={(checked) => setIsPinned(checked)} className="border-blue-400 data-[state=checked]:bg-blue-600 rounded-md h-5 w-5" />
                  <Label htmlFor="c-pin" className="text-blue-600 font-black uppercase text-[11px] cursor-pointer tracking-widest">Pin to Bazaar Top</Label>
                </div>

                <Button onClick={handleAdd} className="w-full h-20 rounded-[1.5rem] bg-blue-600 text-white font-black uppercase text-base shadow-2xl shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all italic tracking-tighter">Publish to Live Store</Button>
              </CardContent>
            </Card>

            <Card className="rounded-[3rem] border-none shadow-2xl h-fit bg-white p-4">
              <CardHeader className="pb-8 border-b-2 border-blue-50 mb-8">
                <div className="flex flex-col gap-6">
                  <CardTitle className="text-blue-600 font-black uppercase text-xl flex items-center gap-4 italic tracking-tighter"><PackageSearch className="w-8 h-8" /> Inventory Control</CardTitle>
                  <div className="relative group">
                    <Search className="absolute left-5 top-5 w-5 h-5 text-blue-400 group-focus-within:text-blue-600 transition-colors" />
                    <Input placeholder="Search live catalog..." value={catalogSearch} onChange={(e) => setCatalogSearch(e.target.value)} className="rounded-[1.5rem] bg-blue-50/50 border-none text-blue-900 font-black pl-14 h-16 text-sm shadow-inner" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 max-h-[700px] overflow-y-auto pr-4 custom-scrollbar">
                {filteredCatalogProducts?.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between p-4 bg-blue-50/20 rounded-[1.5rem] border border-blue-50 group hover:bg-blue-50/50 transition-all hover:shadow-md">
                    <div className="flex items-center gap-5">
                      <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-md border-2 border-white">
                        <img src={p.imageUrl} className="w-full h-full object-cover" alt="" />
                      </div>
                      <div>
                        <p className="text-blue-900 font-black text-xs uppercase truncate max-w-[180px] tracking-tight">{p.name}</p>
                        <p className="text-blue-400 font-black text-[10px] tracking-widest mt-1">₹{p.price} / {p.unit}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteProduct(p.id)} className="text-blue-200 hover:text-red-600 hover:bg-red-50 rounded-2xl h-12 w-12 transition-all">
                      <Trash2 className="w-6 h-6" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="orders" className="space-y-10 animate-in fade-in duration-700">
          <Card className="rounded-[3rem] border-none shadow-2xl bg-white p-4">
            <CardHeader className="pb-8 border-b-2 border-blue-50 mb-8"><CardTitle className="text-blue-600 font-black uppercase text-xl flex items-center gap-4 italic tracking-tighter"><ListOrdered className="w-8 h-8" /> Live Stream Dashboard</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 max-h-[1000px] overflow-y-auto pr-6 custom-scrollbar">
              {orders?.map((order: any) => (
                <div key={order.id} className="p-8 bg-blue-50/30 rounded-[2.5rem] border border-blue-100 space-y-8 flex flex-col justify-between hover:shadow-xl transition-all relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <BarChart3 className="w-20 h-20 text-blue-900" />
                  </div>
                  <div className="space-y-6">
                    <div className="flex justify-between items-start relative z-10">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em]">REF: #{order.id.slice(-6)}</p>
                          {order.isForSomeoneElse && <Badge className="bg-pink-100 text-pink-600 text-[9px] font-black uppercase border-none px-3 py-1">GIFT BAG</Badge>}
                        </div>
                        <div className="space-y-3">
                          <p className="text-xl font-black text-blue-900 flex items-center gap-3 italic">
                            <PhoneCall className="w-5 h-5 text-blue-600" /> {order.phoneNumber}
                          </p>
                          <div className="text-[11px] font-bold text-slate-500 bg-white/80 p-4 rounded-2xl border border-blue-50 shadow-sm leading-relaxed">
                            <MapPinned className="w-4 h-4 text-blue-400 mb-2" /> {order.deliveryAddress || "Address Unavailable"}
                          </div>
                          {order.isForSomeoneElse && (
                            <div className="bg-pink-50 p-4 rounded-2xl border border-pink-100">
                               <p className="text-[9px] font-black text-pink-300 uppercase mb-1">RECIPIENT CONTACT</p>
                               <p className="text-sm font-black text-pink-600 flex items-center gap-2 italic">
                                 <Gift className="w-4 h-4" /> {order.recipientPhone}
                               </p>
                            </div>
                          )}
                          <p className="text-[10px] font-black text-blue-300 uppercase tracking-widest">{new Date(order.createdAt).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-3">
                        <Badge className={cn(
                          "text-[10px] font-black uppercase rounded-xl border-none shadow-md px-5 py-2 tracking-widest",
                          order.status === 'pending' ? "bg-yellow-400 text-black" :
                          order.status === 'confirmed' ? "bg-blue-600 text-white" :
                          order.status === 'delivered' ? "bg-green-600 text-white" :
                          "bg-red-500 text-white"
                        )}>
                          {order.status}
                        </Badge>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteOrder(order.id)} className="h-12 w-12 text-slate-200 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all">
                          <Trash2 className="w-6 h-6" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-3 bg-white/60 p-6 rounded-[2rem] border border-blue-50 shadow-inner">
                      <p className="text-[10px] font-black text-blue-300 uppercase tracking-widest mb-4">ITEM LIST</p>
                      {order.items?.map((item: any, i: number) => (
                        <p key={i} className="text-[12px] font-black text-blue-800 uppercase flex items-center justify-between gap-4 border-b border-blue-50 pb-2 last:border-none">
                          <span className="truncate">{item.name}</span>
                          <span className="text-blue-400 shrink-0">{item.quantity} {item.unit}</span>
                        </p>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 pt-8 mt-4 border-t-2 border-dashed border-blue-100">
                    <Button onClick={() => handleUpdateOrderStatus(order.id, 'confirmed')} disabled={order.status !== 'pending'} className="flex-1 h-14 rounded-2xl bg-blue-600 text-white font-black text-[11px] uppercase shadow-lg shadow-blue-100 active:scale-95 transition-all tracking-widest">
                      <CheckCircle2 className="w-5 h-5 mr-3" /> Confirm
                    </Button>
                    <Button onClick={() => handleUpdateOrderStatus(order.id, 'delivered')} disabled={order.status !== 'confirmed'} className="flex-1 h-14 rounded-2xl bg-green-600 text-white font-black text-[11px] uppercase shadow-lg shadow-green-100 active:scale-95 transition-all tracking-widest">
                      <Truck className="w-5 h-5 mr-3" /> Deliver
                    </Button>
                    <Button onClick={() => handleUpdateOrderStatus(order.id, 'cancelled')} disabled={order.status === 'delivered' || order.status === 'cancelled'} variant="outline" className="flex-1 h-14 rounded-2xl border-2 border-red-100 text-red-600 font-black text-[11px] uppercase hover:bg-red-50 active:scale-95 transition-all tracking-widest">
                      <XCircle className="w-5 h-5 mr-3" /> Reject
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="broadcast" className="animate-in fade-in duration-700">
          <Card className="rounded-[3.5rem] border-none shadow-2xl bg-white p-8">
            <CardHeader className="pb-8 border-b-2 border-blue-50 mb-10"><CardTitle className="text-blue-600 font-black uppercase text-2xl flex items-center gap-5 italic tracking-tighter"><Megaphone className="w-10 h-10" /> Global Information Hub</CardTitle></CardHeader>
            <CardContent className="space-y-10">
              <div className="space-y-4">
                <Label className="text-blue-600 font-black uppercase text-[11px] ml-6 tracking-[0.3em]">Notification Content</Label>
                <Textarea 
                  value={announcementMsg} 
                  onChange={(e) => setAnnouncementMsg(e.target.value)} 
                  placeholder="Alert all customers instantly..."
                  className="rounded-[2.5rem] bg-blue-50/50 border-none text-blue-900 font-black h-56 resize-none uppercase text-lg p-12 shadow-inner focus:bg-white transition-all italic leading-tight"
                />
              </div>
              <div className="flex items-center gap-6 bg-blue-50/50 px-10 py-6 rounded-[2rem] border-2 border-blue-100 w-fit shadow-inner">
                <Checkbox id="c-broadcast" checked={isAnnouncementActive} onCheckedChange={(checked) => setIsAnnouncementActive(checked)} className="border-blue-400 data-[state=checked]:bg-blue-600 rounded-lg h-8 w-8" />
                <div className="space-y-1">
                   <Label htmlFor="c-broadcast" className="text-blue-900 font-black uppercase text-sm cursor-pointer italic">Live Global Display</Label>
                   <p className="text-[10px] font-bold text-blue-300 uppercase tracking-widest">Active users will see this in the top bar</p>
                </div>
              </div>
              <Button onClick={handleUpdateAnnouncement} className="w-full h-24 rounded-[2rem] bg-blue-600 text-white font-black uppercase text-xl shadow-2xl shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-6 italic tracking-tighter">
                <Send className="w-10 h-10" /> Push Real-Time Information
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-12 animate-in fade-in duration-700">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <Card className="rounded-[3rem] border-none shadow-2xl bg-white p-4">
              <CardHeader className="pb-8 border-b-2 border-blue-50 mb-8"><CardTitle className="text-blue-600 font-black uppercase text-xl flex items-center gap-4 italic tracking-tighter"><Palette className="w-8 h-8" /> Visual Themes</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-3 gap-5">
                {(Object.keys(THEME_DATA) as FestivalTheme[]).map(t => (
                  <Button 
                    key={t} 
                    onClick={() => handleUpdateTheme(t)} 
                    variant={currentTheme === t ? "default" : "outline"} 
                    className={cn(
                      "rounded-3xl h-20 font-black uppercase text-[11px] transition-all active:scale-90 tracking-widest flex flex-col gap-1", 
                      currentTheme === t ? "bg-blue-600 text-white border-none shadow-xl shadow-blue-200" : "text-blue-600 border-2 border-blue-50 hover:bg-blue-50"
                    )}
                  >
                    <Sparkles className="w-4 h-4 opacity-40" />
                    {t}
                  </Button>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-[3rem] border-none shadow-2xl bg-white p-4">
              <CardHeader className="pb-8 border-b-2 border-blue-50 mb-8"><CardTitle className="text-blue-600 font-black uppercase text-xl flex items-center gap-4 italic tracking-tighter"><Wallet className="w-8 h-8" /> Bazaar Financials</CardTitle></CardHeader>
              <CardContent className="space-y-8">
                <div className="space-y-3">
                  <Label className="text-blue-600 font-black uppercase text-[10px] ml-4 tracking-widest">Manual Revenue Controller (₹)</Label>
                  <Input type="number" value={manualRevenue} onChange={(e) => setManualRevenue(e.target.value)} className="rounded-2xl bg-blue-50/50 border-none text-blue-900 font-black h-16 px-8 text-xl shadow-inner focus:bg-white transition-all italic" placeholder="0.00" />
                  <p className="text-[9px] font-bold text-blue-300 uppercase px-4 italic">Overrides automated tracking for dashboard display</p>
                </div>
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-3"><Label className="text-blue-600 font-black uppercase text-[10px] ml-4 tracking-widest">WhatsApp ID</Label><Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className="rounded-2xl bg-blue-50/50 border-none text-blue-900 font-black h-14 px-6 shadow-inner" /></div>
                  <div className="space-y-3"><Label className="text-blue-600 font-black uppercase text-[10px] ml-4 tracking-widest">Helpline</Label><Input value={helpline} onChange={(e) => setHelpline(e.target.value)} className="rounded-2xl bg-blue-50/50 border-none text-blue-900 font-black h-14 px-6 shadow-inner" /></div>
                </div>
                <div className="space-y-3"><Label className="text-blue-600 font-black uppercase text-[10px] ml-4 tracking-widest">Verified VPA / UPI ID</Label><Input value={upiId} onChange={(e) => setUpiId(e.target.value)} className="rounded-2xl bg-blue-50/50 border-none text-blue-900 font-black h-14 px-6 shadow-inner" /></div>
                <div className="space-y-3"><Label className="text-blue-600 font-black uppercase text-[10px] ml-4 tracking-widest">QR Asset URL</Label><Input value={upiQrUrl} onChange={(e) => setUpiQrUrl(e.target.value)} className="rounded-2xl bg-blue-50/50 border-none text-blue-900 font-black h-14 px-6 shadow-inner" /></div>
                <Button onClick={handleUpdateSettings} className="w-full h-20 rounded-[1.5rem] bg-blue-600 text-white font-black uppercase text-base border-none shadow-2xl shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all italic tracking-tighter">Synchronize Global Config</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};