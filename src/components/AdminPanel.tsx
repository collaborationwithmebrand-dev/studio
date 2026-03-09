
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
import { Palette, PlusCircle, Wallet, Ruler, TrendingUp, Trash2, PackageSearch, Search, DollarSign, ListOrdered, CheckCircle2, Clock, XCircle, Truck, Sparkles, Loader2, Megaphone, Send, Pin, LayoutGrid } from 'lucide-react';
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
    toast({ title: "Broadcast Updated", description: isAnnouncementActive ? "Announcement is now LIVE" : "Announcement Hidden" });
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

  const handleAiDescription = async () => {
    if (!name) return toast({ title: "AI Hint", description: "Enter product name first", variant: "destructive" });
    setIsAiLoading(true);
    try {
      const result = await generateProductDescription({
        productName: name,
        keywords: [category, section, unit]
      });
      setDescription(result.description);
      toast({ title: "AI Generated Description" });
    } catch (e) {
      toast({ title: "AI Failed", variant: "destructive" });
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
    <div className="container mx-auto p-4 space-y-10">
      <div className="grid grid-cols-2 gap-6">
        <Card className="rounded-[2.5rem] border-none shadow-xl bg-blue-600 text-white">
          <CardContent className="p-10 flex flex-col items-center justify-center text-center">
            <TrendingUp className="w-8 h-8 mb-3 opacity-80" />
            <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Total Bazaar Orders</p>
            <p className="text-4xl font-black">{stats.orders}</p>
          </CardContent>
        </Card>
        <Card className="rounded-[2.5rem] border-none shadow-xl bg-blue-600 text-white">
          <CardContent className="p-10 flex flex-col items-center justify-center text-center">
            <DollarSign className="w-8 h-8 mb-3 opacity-80" />
            <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Total Revenue</p>
            <p className="text-4xl font-black">₹{stats.earnings}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="inventory" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-blue-50 rounded-[1.5rem] h-14 p-1.5 mb-8">
          <TabsTrigger value="inventory" className="rounded-xl font-black uppercase text-[10px] data-[state=active]:bg-blue-600 data-[state=active]:text-white text-blue-600">Inventory</TabsTrigger>
          <TabsTrigger value="orders" className="rounded-xl font-black uppercase text-[10px] data-[state=active]:bg-blue-600 data-[state=active]:text-white text-blue-600">Live Orders</TabsTrigger>
          <TabsTrigger value="broadcast" className="rounded-xl font-black uppercase text-[10px] data-[state=active]:bg-blue-600 data-[state=active]:text-white text-blue-600">Broadcast</TabsTrigger>
          <TabsTrigger value="settings" className="rounded-xl font-black uppercase text-[10px] data-[state=active]:bg-blue-600 data-[state=active]:text-white text-blue-600">Config Hub</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-8 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <Card className="rounded-[2.5rem] border-none shadow-lg h-fit bg-white">
              <CardHeader><CardTitle className="text-blue-600 font-black uppercase text-base flex items-center gap-3"><PlusCircle className="w-6 h-6" /> Add New Item</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-blue-600 font-black uppercase text-[10px] ml-2">Product Title</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-2xl bg-blue-50/50 border-none text-blue-900 font-bold h-12 px-5" placeholder="e.g. Fresh Mango" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-blue-600 font-black uppercase text-[10px] ml-2">Bazaar Price (₹)</Label>
                    <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="rounded-2xl bg-blue-50/50 border-none text-blue-900 font-bold h-12 px-5" placeholder="0.00" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-blue-600 font-black uppercase text-[10px] ml-2">Store Section</Label>
                    <Input value={section} onChange={(e) => setSection(e.target.value)} className="rounded-2xl bg-blue-50/50 border-none text-blue-900 font-bold h-12 px-5" placeholder="e.g. Fresh Fruits" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-blue-600 font-black uppercase text-[10px] ml-2">Image Link</Label>
                    <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="rounded-2xl bg-blue-50/50 border-none text-blue-900 font-bold h-12 px-5" placeholder="https://..." />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between px-2">
                    <Label className="text-blue-600 font-black uppercase text-[10px] flex items-center gap-2">Item Bio (AI Optimized)</Label>
                    <Button onClick={handleAiDescription} disabled={isAiLoading} variant="ghost" className="h-8 text-[9px] font-black text-blue-600 hover:bg-blue-100 uppercase gap-2 px-4 rounded-full">
                      {isAiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Magic AI
                    </Button>
                  </div>
                  <Textarea 
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)} 
                    placeholder="Describe the product for customers..."
                    className="rounded-2xl bg-blue-50/50 border-none text-blue-900 font-medium text-xs resize-none h-32 px-5 py-4" 
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-blue-600 font-black uppercase text-[10px] ml-2 flex items-center gap-2"><Ruler className="w-4 h-4" /> Measurement Unit (SI)</Label>
                  <RadioGroup value={unit} onValueChange={setUnit} className="grid grid-cols-4 gap-3">
                    {['gm', 'kg', 'Liter', 'Pcs'].map(u => (
                      <div key={u} className={cn("p-3 rounded-xl border-2 flex items-center justify-center cursor-pointer transition-all", unit === u ? "bg-blue-600 border-blue-600 shadow-lg" : "bg-white border-blue-50 hover:border-blue-200")}>
                        <RadioGroupItem value={u} id={`u-${u}`} className="hidden" />
                        <Label htmlFor={`u-${u}`} className={cn("font-black text-[11px] cursor-pointer uppercase", unit === u ? "text-white" : "text-blue-600")}>{u}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div className="flex items-center gap-3 bg-blue-50/50 px-5 py-3 rounded-2xl border border-blue-100 w-fit">
                  <Checkbox id="c-pin" checked={isPinned} onCheckedChange={(checked) => setIsPinned(checked)} className="border-blue-400 data-[state=checked]:bg-blue-600 rounded-md" />
                  <Label htmlFor="c-pin" className="text-blue-600 font-black uppercase text-[10px] cursor-pointer">Feature at Top of Bazaar</Label>
                </div>

                <Button onClick={handleAdd} className="w-full h-14 rounded-2xl bg-blue-600 text-white font-black uppercase text-sm shadow-xl shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all">Publish to Live Bazaar</Button>
              </CardContent>
            </Card>

            <Card className="rounded-[2.5rem] border-none shadow-lg h-fit bg-white">
              <CardHeader>
                <div className="flex flex-col gap-4">
                  <CardTitle className="text-blue-600 font-black uppercase text-base flex items-center gap-3"><PackageSearch className="w-6 h-6" /> Inventory Control</CardTitle>
                  <div className="relative">
                    <Search className="absolute left-4 top-3.5 w-4 h-4 text-blue-400" />
                    <Input 
                      placeholder="Search active catalog..." 
                      value={catalogSearch} 
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      className="rounded-2xl bg-blue-50/50 border-none text-blue-900 font-bold pl-11 h-12 text-xs"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 max-h-[600px] overflow-y-auto pr-3 custom-scrollbar">
                {filteredCatalogProducts?.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-blue-50/30 rounded-2xl border border-blue-50 group hover:bg-blue-50/60 transition-colors">
                    <div className="flex items-center gap-4">
                      <img src={p.imageUrl} className="w-12 h-12 rounded-xl object-cover shadow-sm" alt="" />
                      <div>
                        <p className="text-blue-900 font-black text-[11px] uppercase truncate max-w-[150px]">{p.name}</p>
                        <p className="text-blue-400 font-black text-[10px]">₹{p.price} / {p.unit}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteProduct(p.id)} className="text-blue-200 hover:text-red-600 rounded-xl h-10 w-10">
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="orders" className="space-y-6">
          <Card className="rounded-[2.5rem] border-none shadow-lg bg-white">
            <CardHeader><CardTitle className="text-blue-600 font-black uppercase text-base flex items-center gap-3"><ListOrdered className="w-6 h-6" /> Live Order Stream</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[800px] overflow-y-auto pr-4 custom-scrollbar">
              {orders?.map((order: any) => (
                <div key={order.id} className="p-6 bg-blue-50/30 rounded-[2rem] border border-blue-50 space-y-6">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">ORDER: #{order.id.slice(-6)}</p>
                      <p className="text-sm font-black text-blue-900 flex items-center gap-2"><PhoneCall className="w-3.5 h-3.5" /> {order.phoneNumber}</p>
                      <p className="text-[10px] font-bold text-blue-400 uppercase">{new Date(order.createdAt).toLocaleString()}</p>
                    </div>
                    <Badge className={cn(
                      "text-[9px] font-black uppercase rounded-lg border-none shadow-sm px-3 py-1",
                      order.status === 'pending' ? "bg-yellow-100 text-yellow-700" :
                      order.status === 'confirmed' ? "bg-blue-600 text-white" :
                      order.status === 'delivered' ? "bg-green-600 text-white" :
                      "bg-red-100 text-red-700"
                    )}>
                      {order.status}
                    </Badge>
                  </div>
                  <div className="space-y-2 bg-white/50 p-4 rounded-2xl border border-blue-50">
                    {order.items?.map((item: any, i: number) => (
                      <p key={i} className="text-[11px] font-bold text-blue-800 uppercase flex items-center justify-between">
                        <span>• {item.name}</span>
                        <span className="text-blue-400">{item.quantity} {item.unit}</span>
                      </p>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-3 pt-4 border-t border-dashed border-blue-100">
                    <Button onClick={() => handleUpdateOrderStatus(order.id, 'confirmed')} disabled={order.status !== 'pending'} className="flex-1 h-10 rounded-xl bg-blue-600 text-white font-black text-[10px] uppercase shadow-md active:scale-95 transition-all">
                      <CheckCircle2 className="w-4 h-4 mr-2" /> Confirm
                    </Button>
                    <Button onClick={() => handleUpdateOrderStatus(order.id, 'delivered')} disabled={order.status !== 'confirmed'} className="flex-1 h-10 rounded-xl bg-green-600 text-white font-black text-[10px] uppercase shadow-md active:scale-95 transition-all">
                      <Truck className="w-4 h-4 mr-2" /> Dispatch
                    </Button>
                    <Button onClick={() => handleUpdateOrderStatus(order.id, 'cancelled')} disabled={order.status === 'delivered' || order.status === 'cancelled'} variant="outline" className="flex-1 h-10 rounded-xl border-red-200 text-red-600 font-black text-[10px] uppercase hover:bg-red-50 active:scale-95 transition-all">
                      <XCircle className="w-4 h-4 mr-2" /> Reject
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="broadcast" className="animate-in fade-in duration-500">
          <Card className="rounded-[2.5rem] border-none shadow-lg bg-white">
            <CardHeader><CardTitle className="text-blue-600 font-black uppercase text-base flex items-center gap-3"><Megaphone className="w-6 h-6" /> Live Store Broadcast</CardTitle></CardHeader>
            <CardContent className="space-y-8">
              <div className="space-y-3">
                <Label className="text-blue-600 font-black uppercase text-[10px] ml-2">Announcement Message</Label>
                <Textarea 
                  value={announcementMsg} 
                  onChange={(e) => setAnnouncementMsg(e.target.value)} 
                  placeholder="Type a message to show on all customer screens..."
                  className="rounded-3xl bg-blue-50/50 border-none text-blue-900 font-black h-40 resize-none uppercase text-sm p-8 shadow-inner"
                />
              </div>
              <div className="flex items-center gap-3 bg-blue-50/50 px-6 py-4 rounded-2xl border border-blue-100 w-fit">
                <Checkbox id="c-broadcast" checked={isAnnouncementActive} onCheckedChange={(checked) => setIsAnnouncementActive(checked)} className="border-blue-400 data-[state=checked]:bg-blue-600 rounded-md" />
                <Label htmlFor="c-broadcast" className="text-blue-600 font-black uppercase text-[11px] cursor-pointer">Activate Stream on Dashboard</Label>
              </div>
              <Button onClick={handleUpdateAnnouncement} className="w-full h-16 rounded-2xl bg-blue-600 text-white font-black uppercase text-base shadow-xl shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-4">
                <Send className="w-6 h-6" /> Push Notification to Bazaar
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-10 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <Card className="rounded-[2.5rem] border-none shadow-lg bg-white">
              <CardHeader><CardTitle className="text-blue-600 font-black uppercase text-base flex items-center gap-3"><Palette className="w-6 h-6" /> Festive Experience</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-3 gap-3">
                {(Object.keys(THEME_DATA) as FestivalTheme[]).map(t => (
                  <Button 
                    key={t} 
                    onClick={() => handleUpdateTheme(t)} 
                    variant={currentTheme === t ? "default" : "outline"} 
                    className={cn(
                      "rounded-2xl h-14 font-black uppercase text-[10px] transition-all active:scale-90", 
                      currentTheme === t ? "bg-blue-600 text-white border-none shadow-xl" : "text-blue-600 border-blue-100 hover:bg-blue-50"
                    )}
                  >
                    {t}
                  </Button>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-[2.5rem] border-none shadow-lg bg-white">
              <CardHeader><CardTitle className="text-blue-600 font-black uppercase text-base flex items-center gap-3"><Wallet className="w-6 h-6" /> Payment & Contact</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2"><Label className="text-blue-600 font-black uppercase text-[10px] ml-2">WhatsApp Orders</Label><Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className="rounded-2xl bg-blue-50/50 border-none text-blue-900 font-bold h-12 px-5" /></div>
                  <div className="space-y-2"><Label className="text-blue-600 font-black uppercase text-[10px] ml-2">Store Helpline</Label><Input value={helpline} onChange={(e) => setHelpline(e.target.value)} className="rounded-2xl bg-blue-50/50 border-none text-blue-900 font-bold h-12 px-5" /></div>
                </div>
                <div className="space-y-2"><Label className="text-blue-600 font-black uppercase text-[10px] ml-2">Verified UPI ID</Label><Input value={upiId} onChange={(e) => setUpiId(e.target.value)} className="rounded-2xl bg-blue-50/50 border-none text-blue-900 font-bold h-12 px-5" /></div>
                <div className="space-y-2"><Label className="text-blue-600 font-black uppercase text-[10px] ml-2">UPI QR Image URL</Label><Input value={upiQrUrl} onChange={(e) => setUpiQrUrl(e.target.value)} className="rounded-2xl bg-blue-50/50 border-none text-blue-900 font-bold h-12 px-5" /></div>
                <Button onClick={handleUpdateSettings} className="w-full h-14 rounded-2xl bg-blue-600 text-white font-black uppercase text-sm border-none shadow-xl shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all">Apply Global Settings</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
