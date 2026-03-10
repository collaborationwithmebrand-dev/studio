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
    <div className="container mx-auto px-4 space-y-8 md:space-y-12">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-1 text-center md:text-left">
          <h2 className="text-2xl md:text-4xl font-black text-blue-900 uppercase italic tracking-tighter">Admin Control Hub</h2>
          <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Dashboard / {currentTheme}</p>
        </div>
        <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
          <Card className="rounded-3xl border-none shadow-xl bg-blue-600 text-white p-4 md:p-8 min-w-[140px] flex flex-col items-center justify-center text-center">
             <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-blue-100 mb-1">Orders</p>
             <p className="text-3xl md:text-5xl font-black italic">{stats.orders}</p>
          </Card>
          <Card className="rounded-3xl border-none shadow-xl bg-blue-600 text-white p-4 md:p-8 min-w-[140px] flex flex-col items-center justify-center text-center">
             <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-blue-100 mb-1">Manual Revenue</p>
             <p className="text-3xl md:text-5xl font-black italic">₹{settings?.manualRevenue || 0}</p>
          </Card>
        </div>
      </div>

      <Tabs defaultValue="inventory" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-blue-50 rounded-2xl md:rounded-[2rem] h-14 md:h-20 p-1 md:p-2 mb-8 md:mb-12 shadow-inner overflow-hidden">
          <TabsTrigger value="inventory" className="rounded-xl md:rounded-[1.5rem] font-black uppercase text-[8px] md:text-[11px] data-[state=active]:bg-blue-600 data-[state=active]:text-white text-blue-600 transition-all gap-1 md:gap-2 tracking-tighter md:tracking-widest">
            <Database className="w-3 h-3 md:w-4 md:h-4" /> <span className="hidden xs:inline">Inv</span><span className="inline xs:hidden">Inv</span>
          </TabsTrigger>
          <TabsTrigger value="orders" className="rounded-xl md:rounded-[1.5rem] font-black uppercase text-[8px] md:text-[11px] data-[state=active]:bg-blue-600 data-[state=active]:text-white text-blue-600 transition-all gap-1 md:gap-2 tracking-tighter md:tracking-widest">
            <ListOrdered className="w-3 h-3 md:w-4 md:h-4" /> <span className="hidden xs:inline">Orders</span><span className="inline xs:hidden">Ord</span>
          </TabsTrigger>
          <TabsTrigger value="broadcast" className="rounded-xl md:rounded-[1.5rem] font-black uppercase text-[8px] md:text-[11px] data-[state=active]:bg-blue-600 data-[state=active]:text-white text-blue-600 transition-all gap-1 md:gap-2 tracking-tighter md:tracking-widest">
            <Megaphone className="w-3 h-3 md:w-4 md:h-4" /> <span className="hidden xs:inline">Broadcast</span><span className="inline xs:hidden">Cast</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="rounded-xl md:rounded-[1.5rem] font-black uppercase text-[8px] md:text-[11px] data-[state=active]:bg-blue-600 data-[state=active]:text-white text-blue-600 transition-all gap-1 md:gap-2 tracking-tighter md:tracking-widest">
            <Settings2 className="w-3 h-3 md:w-4 md:h-4" /> <span className="hidden xs:inline">Config</span><span className="inline xs:hidden">Cfg</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-8 md:space-y-12 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
            <Card className="rounded-3xl md:rounded-[3rem] border-none shadow-xl h-fit bg-white p-4">
              <CardHeader className="pb-4 border-b border-blue-50 mb-6 md:mb-8"><CardTitle className="text-blue-600 font-black uppercase text-lg md:text-xl flex items-center gap-3 md:gap-4 italic tracking-tighter"><PlusCircle className="w-6 h-6 md:w-8 md:h-8" /> Publish Item</CardTitle></CardHeader>
              <CardContent className="space-y-6 md:space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                  <div className="space-y-2">
                    <Label className="text-blue-600 font-black uppercase text-[10px] tracking-widest">Title</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl bg-blue-50/50 border-none text-blue-900 font-black h-12 md:h-14 px-4 md:px-6" placeholder="Fresh Mango" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-blue-600 font-black uppercase text-[10px] tracking-widest">Price (₹)</Label>
                    <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="rounded-xl bg-blue-50/50 border-none text-blue-900 font-black h-12 md:h-14 px-4 md:px-6" placeholder="0.00" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-blue-600 font-black uppercase text-[10px] tracking-widest">Section</Label>
                    <Input value={section} onChange={(e) => setSection(e.target.value)} className="rounded-xl bg-blue-50/50 border-none text-blue-900 font-black h-12 md:h-14 px-4 md:px-6" placeholder="Fresh Fruits" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-blue-600 font-black uppercase text-[10px] tracking-widest">Image URL</Label>
                    <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="rounded-xl bg-blue-50/50 border-none text-blue-900 font-black h-12 md:h-14 px-4 md:px-6" placeholder="https://..." />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <Label className="text-blue-600 font-black uppercase text-[10px] tracking-widest">Bio (AI Optimized)</Label>
                    <Button onClick={handleAiDescription} disabled={isAiLoading} variant="ghost" className="h-8 text-[9px] font-black text-blue-600 uppercase gap-2 px-3 rounded-full border border-blue-100">
                      {isAiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} AI
                    </Button>
                  </div>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Product details..." className="rounded-xl md:rounded-[1.5rem] bg-blue-50/50 border-none text-blue-900 font-bold text-sm resize-none h-32 md:h-40 px-4 md:px-6 py-4 md:py-6" />
                </div>

                <div className="space-y-3">
                  <Label className="text-blue-600 font-black uppercase text-[10px] tracking-widest">Measurement Logic</Label>
                  <RadioGroup value={unit} onValueChange={setUnit} className="grid grid-cols-4 gap-2 md:gap-4">
                    {['gm', 'kg', 'Liter', 'Pcs'].map(u => (
                      <div key={u} className={cn("p-3 md:p-5 rounded-xl md:rounded-2xl border flex items-center justify-center cursor-pointer transition-all", unit === u ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100" : "bg-white border-blue-50 text-blue-600")}>
                        <RadioGroupItem value={u} id={`u-${u}`} className="hidden" />
                        <Label htmlFor={`u-${u}`} className="font-black text-[10px] md:text-[12px] cursor-pointer uppercase tracking-widest">{u}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div className="flex items-center gap-3 bg-blue-50/50 px-4 py-3 md:px-6 md:py-4 rounded-xl border border-blue-100 w-fit">
                  <Checkbox id="c-pin" checked={isPinned} onCheckedChange={(checked) => setIsPinned(checked)} className="border-blue-400 data-[state=checked]:bg-blue-600" />
                  <Label htmlFor="c-pin" className="text-blue-600 font-black uppercase text-[10px] md:text-[11px] cursor-pointer tracking-widest">Pin to Top</Label>
                </div>

                <Button onClick={handleAdd} className="w-full h-16 md:h-20 rounded-xl md:rounded-[1.5rem] bg-blue-600 text-white font-black uppercase text-sm md:text-base shadow-lg hover:bg-blue-700 active:scale-95 transition-all italic">Publish Live</Button>
              </CardContent>
            </Card>

            <Card className="rounded-3xl md:rounded-[3rem] border-none shadow-xl h-fit bg-white p-4">
              <CardHeader className="pb-4 border-b border-blue-50 mb-6 md:mb-8">
                <div className="flex flex-col gap-4">
                  <CardTitle className="text-blue-600 font-black uppercase text-lg md:text-xl flex items-center gap-3 md:gap-4 italic tracking-tighter"><PackageSearch className="w-6 h-6 md:w-8 md:h-8" /> Inventory</CardTitle>
                  <div className="relative group">
                    <Search className="absolute left-4 top-4 w-4 h-4 text-blue-400" />
                    <Input placeholder="Search catalog..." value={catalogSearch} onChange={(e) => setCatalogSearch(e.target.value)} className="rounded-xl bg-blue-50/50 border-none text-blue-900 font-black pl-11 h-12 text-xs" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 max-h-[500px] md:max-h-[700px] overflow-y-auto pr-2 custom-scrollbar">
                {filteredCatalogProducts?.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-blue-50/20 rounded-xl border border-blue-50 group">
                    <div className="flex items-center gap-3 md:gap-5">
                      <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl overflow-hidden shadow-sm border border-white">
                        <img src={p.imageUrl} className="w-full h-full object-cover" alt="" />
                      </div>
                      <div>
                        <p className="text-blue-900 font-black text-[10px] md:text-xs uppercase truncate max-w-[120px] md:max-w-[180px]">{p.name}</p>
                        <p className="text-blue-400 font-black text-[8px] md:text-[10px] tracking-widest mt-1">₹{p.price} / {p.unit}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteProduct(p.id)} className="text-blue-200 hover:text-red-600 h-10 w-10">
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="orders" className="space-y-8 md:space-y-10 animate-in fade-in duration-500">
          <Card className="rounded-3xl md:rounded-[3rem] border-none shadow-xl bg-white p-4">
            <CardHeader className="pb-4 border-b border-blue-50 mb-6 md:mb-8"><CardTitle className="text-blue-600 font-black uppercase text-lg md:text-xl flex items-center gap-3 md:gap-4 italic tracking-tighter"><ListOrdered className="w-6 h-6 md:w-8 md:h-8" /> Live Order Stream</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-10 max-h-[800px] md:max-h-[1000px] overflow-y-auto pr-2 custom-scrollbar">
              {orders?.map((order: any) => (
                <div key={order.id} className="p-6 md:p-8 bg-blue-50/30 rounded-2xl md:rounded-[2.5rem] border border-blue-100 space-y-6 flex flex-col justify-between hover:shadow-lg transition-all">
                  <div className="space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <p className="text-[8px] md:text-[10px] font-black text-blue-400 uppercase tracking-widest">#{order.id.slice(-6)}</p>
                          {order.isForSomeoneElse && <Badge className="bg-pink-100 text-pink-600 text-[8px] font-black uppercase border-none px-2 py-0.5">GIFT</Badge>}
                        </div>
                        <div className="space-y-2">
                          <p className="text-lg md:text-xl font-black text-blue-900 flex items-center gap-2 italic">
                            <PhoneCall className="w-4 h-4 text-blue-600" /> {order.phoneNumber}
                          </p>
                          <div className="text-[10px] md:text-[11px] font-bold text-slate-500 bg-white/80 p-3 rounded-xl border border-blue-50 leading-relaxed">
                            <MapPinned className="w-3 h-3 text-blue-400 mb-1" /> {order.deliveryAddress || "No Address"}
                          </div>
                          {order.isForSomeoneElse && (
                            <div className="bg-pink-50 p-3 rounded-xl border border-pink-100">
                               <p className="text-[8px] font-black text-pink-300 uppercase mb-0.5">RECIPIENT</p>
                               <p className="text-xs md:text-sm font-black text-pink-600 flex items-center gap-2 italic">
                                 <Gift className="w-3 h-3" /> {order.recipientPhone}
                               </p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge className={cn(
                          "text-[8px] md:text-[10px] font-black uppercase rounded-lg border-none px-3 py-1 shadow-sm",
                          order.status === 'pending' ? "bg-yellow-400 text-black" :
                          order.status === 'confirmed' ? "bg-blue-600 text-white" :
                          order.status === 'delivered' ? "bg-green-600 text-white" :
                          "bg-red-500 text-white"
                        )}>
                          {order.status}
                        </Badge>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteOrder(order.id)} className="h-10 w-10 text-slate-200 hover:text-red-600 transition-all">
                          <Trash2 className="w-5 h-5" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2 bg-white/60 p-4 rounded-xl border border-blue-50 shadow-inner">
                      {order.items?.map((item: any, i: number) => (
                        <p key={i} className="text-[10px] md:text-[12px] font-black text-blue-800 uppercase flex items-center justify-between gap-2 border-b border-blue-50/50 pb-1.5 last:border-none">
                          <span className="truncate">{item.name}</span>
                          <span className="text-blue-400 shrink-0">{item.quantity} {item.unit}</span>
                        </p>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 md:gap-4 pt-4 border-t border-dashed border-blue-100">
                    <Button onClick={() => handleUpdateOrderStatus(order.id, 'confirmed')} disabled={order.status !== 'pending'} className="flex-1 h-12 rounded-xl bg-blue-600 text-white font-black text-[9px] md:text-[11px] uppercase tracking-tighter">
                      Confirm
                    </Button>
                    <Button onClick={() => handleUpdateOrderStatus(order.id, 'delivered')} disabled={order.status !== 'confirmed'} className="flex-1 h-12 rounded-xl bg-green-600 text-white font-black text-[9px] md:text-[11px] uppercase tracking-tighter">
                      Deliver
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="broadcast" className="animate-in fade-in duration-500">
          <Card className="rounded-3xl md:rounded-[3.5rem] border-none shadow-xl bg-white p-6 md:p-8">
            <CardHeader className="pb-4 border-b border-blue-50 mb-6 md:mb-10"><CardTitle className="text-blue-600 font-black uppercase text-xl md:text-2xl flex items-center gap-3 md:gap-5 italic tracking-tighter"><Megaphone className="w-8 h-8 md:w-10 md:h-10" /> Store Broadcast</CardTitle></CardHeader>
            <CardContent className="space-y-8 md:space-y-10">
              <div className="space-y-3">
                <Label className="text-blue-600 font-black uppercase text-[10px] md:text-[11px] tracking-widest">Message Content</Label>
                <Textarea 
                  value={announcementMsg} 
                  onChange={(e) => setAnnouncementMsg(e.target.value)} 
                  placeholder="Inform all active customers..."
                  className="rounded-2xl md:rounded-[2.5rem] bg-blue-50/50 border-none text-blue-900 font-black h-40 md:h-56 resize-none uppercase text-base md:text-lg p-6 md:p-12 shadow-inner"
                />
              </div>
              <div className="flex items-center gap-4 bg-blue-50/50 px-6 py-4 rounded-xl md:rounded-[2rem] border border-blue-100 w-fit">
                <Checkbox id="c-broadcast" checked={isAnnouncementActive} onCheckedChange={(checked) => setIsAnnouncementActive(checked)} className="border-blue-400 data-[state=checked]:bg-blue-600 h-6 w-6" />
                <div className="space-y-0.5">
                   <Label htmlFor="c-broadcast" className="text-blue-900 font-black uppercase text-xs md:text-sm cursor-pointer italic">Live Global Display</Label>
                   <p className="text-[8px] md:text-[10px] font-bold text-blue-300 uppercase tracking-widest">Visible to all users in the top bar</p>
                </div>
              </div>
              <Button onClick={handleUpdateAnnouncement} className="w-full h-16 md:h-24 rounded-xl md:rounded-[2rem] bg-blue-600 text-white font-black uppercase text-sm md:text-xl shadow-lg hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-3 md:gap-6 italic">
                <Send className="w-6 h-6 md:w-10 md:h-10" /> Push Real-Time Info
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-8 md:space-y-12 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
            <Card className="rounded-3xl md:rounded-[3rem] border-none shadow-xl bg-white p-4">
              <CardHeader className="pb-4 border-b border-blue-50 mb-6 md:mb-8"><CardTitle className="text-blue-600 font-black uppercase text-lg md:text-xl flex items-center gap-3 md:gap-4 italic tracking-tighter"><Palette className="w-6 h-6 md:w-8 md:h-8" /> Visual Themes</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-3 gap-3 md:gap-5">
                {(Object.keys(THEME_DATA) as FestivalTheme[]).map(t => (
                  <Button 
                    key={t} 
                    onClick={() => handleUpdateTheme(t)} 
                    variant={currentTheme === t ? "default" : "outline"} 
                    className={cn(
                      "rounded-2xl h-16 md:h-20 font-black uppercase text-[9px] md:text-[11px] transition-all tracking-tighter md:tracking-widest flex flex-col gap-0.5 md:gap-1", 
                      currentTheme === t ? "bg-blue-600 text-white border-none shadow-md" : "text-blue-600 border border-blue-50"
                    )}
                  >
                    <Sparkles className="w-3 h-3 opacity-40" />
                    {t}
                  </Button>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-3xl md:rounded-[3rem] border-none shadow-xl bg-white p-4">
              <CardHeader className="pb-4 border-b border-blue-50 mb-6 md:mb-8"><CardTitle className="text-blue-600 font-black uppercase text-lg md:text-xl flex items-center gap-3 md:gap-4 italic tracking-tighter"><Wallet className="w-6 h-6 md:w-8 md:h-8" /> Financials</CardTitle></CardHeader>
              <CardContent className="space-y-6 md:space-y-8">
                <div className="space-y-2">
                  <Label className="text-blue-600 font-black uppercase text-[10px] tracking-widest">Manual Revenue (₹)</Label>
                  <Input type="number" value={manualRevenue} onChange={(e) => setManualRevenue(e.target.value)} className="rounded-xl bg-blue-50/50 border-none text-blue-900 font-black h-12 md:h-16 px-4 md:px-8 text-lg md:text-xl shadow-inner focus:bg-white transition-all" placeholder="0.00" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                  <div className="space-y-2"><Label className="text-blue-600 font-black uppercase text-[10px] tracking-widest">WhatsApp ID</Label><Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className="rounded-xl bg-blue-50/50 border-none text-blue-900 font-black h-12 md:h-14 px-4" /></div>
                  <div className="space-y-2"><Label className="text-blue-600 font-black uppercase text-[10px] tracking-widest">Helpline</Label><Input value={helpline} onChange={(e) => setHelpline(e.target.value)} className="rounded-xl bg-blue-50/50 border-none text-blue-900 font-black h-12 md:h-14 px-4" /></div>
                </div>
                <div className="space-y-2"><Label className="text-blue-600 font-black uppercase text-[10px] tracking-widest">UPI ID</Label><Input value={upiId} onChange={(e) => setUpiId(e.target.value)} className="rounded-xl bg-blue-50/50 border-none text-blue-900 font-black h-12 md:h-14 px-4" /></div>
                <div className="space-y-2"><Label className="text-blue-600 font-black uppercase text-[10px] tracking-widest">QR Asset URL</Label><Input value={upiQrUrl} onChange={(e) => setUpiQrUrl(e.target.value)} className="rounded-xl bg-blue-50/50 border-none text-blue-900 font-black h-12 md:h-14 px-4" /></div>
                <Button onClick={handleUpdateSettings} className="w-full h-16 md:h-20 rounded-xl md:rounded-[1.5rem] bg-blue-600 text-white font-black uppercase text-sm md:text-base border-none shadow-lg hover:bg-blue-700 active:scale-95 transition-all italic">Synchronize Config</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};