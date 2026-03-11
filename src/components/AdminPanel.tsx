
"use client"

import React, { useState, useEffect } from 'react';
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
import { Palette, PlusCircle, Wallet, Trash2, Megaphone, CheckCircle2, Truck, XCircle, Database, LayoutDashboard, PhoneCall, MapPin, User, Gift, Clock, Zap, Star } from 'lucide-react';
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
  
  if (!isAdmin) return null;

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('General');
  const [unit, setUnit] = useState('Pcs');
  const [section, setSection] = useState('Daily Essentials');
  const [imageUrl, setImageUrl] = useState('');
  const [description, setDescription] = useState('');
  const [deliveryMode, setDeliveryMode] = useState<'instant' | 'standard'>('instant');
  const [isPinned, setIsPinned] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const [whatsapp, setWhatsapp] = useState('');
  const [helpline, setHelpline] = useState('');
  const [upiId, setUpiId] = useState('');
  const [upiQrUrl, setUpiQrUrl] = useState('');
  const [manualRevenue, setManualRevenue] = useState<string>('0');
  
  const [announcementMsg, setAnnouncementMsg] = useState('');
  const [isAnnouncementActive, setIsAnnouncementActive] = useState(false);
  
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

  const UNIT_OPTIONS = ['gm', 'kg', 'Liter', 'Pcs', 'L', 'XL', 'XXL', 'XXXL', '32', '34', '36', '38'];

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
    toast({ title: "Settings Updated", className: "bg-blue-600 text-white" });
  };

  const handleUpdateAnnouncement = () => {
    if (!announcementRef) return;
    setDocumentNonBlocking(announcementRef, {
      message: announcementMsg,
      active: isAnnouncementActive,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    toast({ title: "Broadcast Live", className: "bg-blue-600 text-white" });
  };

  const handleAdd = () => {
    if (!name || !price || !imageUrl) return toast({ title: "Fields Missing", variant: "destructive" });
    addDocumentNonBlocking(collection(firestore, 'products'), {
      name, 
      price: parseFloat(price), 
      unit, 
      section, 
      category, 
      imageUrl, 
      description,
      deliveryMode,
      isPinned,
      createdAt: new Date().toISOString()
    });
    setName(''); setPrice(''); setImageUrl(''); setDescription(''); setIsPinned(false);
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

  const handleAiDescription = async () => {
    if (!name) return toast({ title: "Enter Title", variant: "destructive" });
    setIsAiLoading(true);
    try {
      const result = await generateProductDescription({
        productName: name,
        keywords: [category, section]
      });
      setDescription(result.description);
      toast({ title: "AI Description Generated", className: "bg-blue-600 text-white" });
    } catch (e) {
      toast({ title: "AI Error", variant: "destructive" });
    } finally {
      setIsAiLoading(false);
    }
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <Card className="rounded-[2.5rem] p-8 bg-blue-600 text-white border-none shadow-[0_30px_60px_-15px_rgba(37,99,235,0.4)]">
          <p className="text-[11px] font-black uppercase tracking-[0.3em] opacity-60 mb-3">Total Estimated Revenue</p>
          <h3 className="text-5xl font-black italic tracking-tighter leading-none">₹{manualRevenue}</h3>
        </Card>
        <Card className="rounded-[2.5rem] p-8 bg-white border-none shadow-xl border-slate-50">
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-300 mb-3">Total Orders (Stream)</p>
          <h3 className="text-5xl font-black italic tracking-tighter text-slate-900 leading-none">{orders?.length || 0}</h3>
        </Card>
        <Card className="rounded-[2.5rem] p-8 bg-white border-none shadow-xl border-slate-50">
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-300 mb-3">Catalog Capacity</p>
          <h3 className="text-5xl font-black italic tracking-tighter text-slate-900 leading-none">{products?.length || 0}</h3>
        </Card>
      </div>

      <Tabs defaultValue="orders" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-blue-50/50 rounded-[2rem] h-20 p-2 mb-16 shadow-inner">
          <TabsTrigger value="orders" className="rounded-2xl font-black uppercase text-xs tracking-widest data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-xl transition-all">Orders</TabsTrigger>
          <TabsTrigger value="inventory" className="rounded-2xl font-black uppercase text-xs tracking-widest data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-xl transition-all">Items</TabsTrigger>
          <TabsTrigger value="broadcast" className="rounded-2xl font-black uppercase text-xs tracking-widest data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-xl transition-all">Alerts</TabsTrigger>
          <TabsTrigger value="settings" className="rounded-2xl font-black uppercase text-xs tracking-widest data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-xl transition-all">Config</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {orders?.map((order: any) => (
              <Card key={order.id} className="rounded-[2.5rem] border-none bg-white p-8 space-y-6 shadow-xl hover:shadow-2xl transition-all border border-blue-50/50 group">
                <div className="flex justify-between items-start">
                  <div className="space-y-3">
                    <p className="text-[10px] font-black text-blue-300 uppercase tracking-widest leading-none">ID: #{order.id.slice(-6)}</p>
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-xl">
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-2xl font-black text-blue-900 leading-none italic">{order.phoneNumber}</p>
                        <Badge variant="outline" className={cn("text-[10px] font-black uppercase mt-2 px-3", 
                          order.status === 'confirmed' ? "border-blue-400 text-blue-600" : 
                          order.status === 'delivered' ? "border-green-400 text-green-600" :
                          order.status === 'cancelled' ? "border-red-400 text-red-600" :
                          "border-slate-200 text-slate-400"
                        )}>
                          {order.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <a href={`tel:${order.phoneNumber}`} className="p-4 bg-blue-50 text-blue-600 rounded-2xl hover:bg-blue-100 transition-colors shadow-sm">
                      <PhoneCall className="w-5 h-5" />
                    </a>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteOrder(order.id)} className="h-12 w-12 rounded-2xl text-slate-200 hover:text-red-500 transition-all">
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-[1.5rem] p-6 space-y-4 border border-blue-50 shadow-inner group-hover:bg-blue-50/30 transition-colors">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[10px] font-black text-blue-400 uppercase tracking-[0.3em]">
                      <MapPin className="w-3.5 h-3.5" /> Delivery Hub
                    </div>
                    <p className="text-sm font-bold text-slate-700 italic leading-relaxed">"{order.deliveryAddress}"</p>
                  </div>

                  {order.isForSomeoneElse && (
                    <div className="pt-4 border-t border-blue-100/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[10px] font-black text-pink-500 uppercase tracking-widest">
                          <Gift className="w-3.5 h-3.5" /> Recipient
                        </div>
                        <p className="text-sm font-black text-slate-900">{order.recipientPhone}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[10px] font-black text-blue-400 uppercase tracking-widest">
                          <User className="w-3.5 h-3.5" /> Sender
                        </div>
                        <p className="text-sm font-black text-slate-900">{order.senderPhone}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center px-2">
                  <p className="text-3xl font-black text-blue-600 italic leading-none">₹{order.totalAmount}</p>
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-tighter">{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <Button onClick={() => handleUpdateOrderStatus(order.id, 'confirmed')} className="flex-1 bg-blue-600 text-white font-black text-[11px] h-14 uppercase rounded-2xl shadow-xl hover:brightness-110 active:scale-95 transition-all">
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Confirm
                  </Button>
                  <Button onClick={() => handleUpdateOrderStatus(order.id, 'delivered')} className="flex-1 bg-green-600 text-white font-black text-[11px] h-14 uppercase rounded-2xl shadow-xl hover:brightness-110 active:scale-95 transition-all">
                    <Truck className="w-4 h-4 mr-2" /> Deliver
                  </Button>
                  <Button onClick={() => handleUpdateOrderStatus(order.id, 'cancelled')} variant="outline" className="flex-1 border-2 border-red-50 text-red-500 font-black text-[11px] h-14 uppercase rounded-2xl hover:bg-red-50 active:scale-95 transition-all">
                    <XCircle className="w-4 h-4 mr-2" /> Cancel
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <Card className="rounded-[3rem] p-10 bg-white shadow-2xl border-none">
              <CardHeader className="px-0 mb-8"><CardTitle className="text-blue-600 font-black uppercase text-2xl flex items-center gap-4 italic tracking-tighter"><PlusCircle className="w-8 h-8" /> New Bazaar Item</CardTitle></CardHeader>
              <CardContent className="px-0 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[11px] font-black uppercase text-slate-300 ml-4">Product Name</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Title" className="rounded-2xl bg-slate-50 border-none h-16 font-bold focus:ring-2 focus:ring-blue-100 transition-all" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[11px] font-black uppercase text-slate-300 ml-4">Listing Price (₹)</Label>
                    <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price" className="rounded-2xl bg-slate-50 border-none h-16 font-bold focus:ring-2 focus:ring-blue-100 transition-all" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[11px] font-black uppercase text-slate-300 ml-4">Bazaar Section</Label>
                    <Input value={section} onChange={(e) => setSection(e.target.value)} placeholder="e.g. Snacks" className="rounded-2xl bg-slate-50 border-none h-16 font-bold focus:ring-2 focus:ring-blue-100 transition-all" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[11px] font-black uppercase text-slate-300 ml-4">Visual URL</Label>
                    <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Image Link" className="rounded-2xl bg-slate-50 border-none h-16 font-bold focus:ring-2 focus:ring-blue-100 transition-all" />
                  </div>
                </div>
                
                <div className="space-y-6">
                  <Label className="text-[11px] font-black uppercase text-blue-300 ml-4 tracking-[0.3em]">Unit / Variant Size</Label>
                  <RadioGroup value={unit} onValueChange={setUnit} className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {UNIT_OPTIONS.map(u => (
                      <div key={u} className={cn("p-5 rounded-2xl border-2 text-center cursor-pointer font-black text-[11px] transition-all shadow-sm", unit === u ? "bg-blue-600 text-white border-blue-600 shadow-xl scale-105" : "bg-white border-slate-50 hover:border-blue-100")}>
                        <RadioGroupItem value={u} id={`u-${u}`} className="hidden" />
                        <Label htmlFor={`u-${u}`} className="cursor-pointer uppercase block leading-none">{u}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center mb-1">
                    <Label className="text-[11px] font-black uppercase text-blue-400 ml-4 tracking-widest">Story / Description</Label>
                    <Button onClick={handleAiDescription} disabled={isAiLoading} variant="ghost" className="h-10 px-6 rounded-xl text-[10px] font-black text-blue-600 bg-blue-50 hover:bg-blue-100 transition-all">AI DESCRIPTION ASSIST</Button>
                  </div>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="rounded-2xl bg-slate-50 border-none h-40 font-medium focus:ring-2 focus:ring-blue-100 transition-all" />
                </div>

                <div className="space-y-10 pt-4">
                  <div className="flex items-center justify-between p-6 bg-blue-50/50 rounded-3xl border border-blue-100">
                    <div className="flex items-center gap-4">
                      <Star className={cn("w-6 h-6", isPinned ? "text-blue-600 fill-blue-600" : "text-blue-300")} />
                      <Label htmlFor="p-pin" className="font-black text-blue-900 uppercase text-xs tracking-widest">Highlight this item</Label>
                    </div>
                    <Switch id="p-pin" checked={isPinned} onCheckedChange={setIsPinned} className="scale-125 data-[state=checked]:bg-blue-600" />
                  </div>

                  <div className="space-y-6">
                    <Label className="text-[11px] font-black uppercase text-blue-600 ml-4 tracking-[0.4em]">Choose Delivery Speed</Label>
                    <RadioGroup value={deliveryMode} onValueChange={(val: any) => setDeliveryMode(val)} className="grid grid-cols-2 gap-6">
                      <div className={cn("p-6 rounded-[2.5rem] border-4 cursor-pointer transition-all duration-500", deliveryMode === 'instant' ? "bg-blue-600 text-white border-blue-600 shadow-2xl" : "bg-slate-50 border-transparent shadow-inner")}>
                        <RadioGroupItem value="instant" id="d-instant" className="hidden" />
                        <Label htmlFor="d-instant" className="cursor-pointer flex flex-col items-center gap-3 font-black uppercase text-[10px] italic">
                          <Zap className="w-8 h-8" /> 25 Min Mode
                        </Label>
                      </div>
                      <div className={cn("p-6 rounded-[2.5rem] border-4 cursor-pointer transition-all duration-500", deliveryMode === 'standard' ? "bg-blue-600 text-white border-blue-600 shadow-2xl" : "bg-slate-50 border-transparent shadow-inner")}>
                        <RadioGroupItem value="standard" id="d-standard" className="hidden" />
                        <Label htmlFor="d-standard" className="cursor-pointer flex flex-col items-center gap-3 font-black uppercase text-[10px] italic">
                          <Clock className="w-8 h-8" /> 2 Day Mode
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <Button onClick={handleAdd} className="w-full h-24 rounded-[2.5rem] bg-blue-600 text-white font-black uppercase shadow-[0_30px_60px_-10px_rgba(37,99,235,0.4)] hover:brightness-110 active:scale-[0.98] transition-all text-xl italic border-none">Publish to Bazaar</Button>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[3rem] p-10 bg-white shadow-2xl border-none overflow-hidden relative">
              <div className="absolute top-0 right-0 w-40 h-40 bg-blue-50/50 rounded-full blur-3xl -mr-20 -mt-20" />
              <CardHeader className="px-0 mb-8"><CardTitle className="text-blue-600 font-black uppercase text-2xl flex items-center gap-4 italic tracking-tighter"><Database className="w-8 h-8" /> Live Inventory</CardTitle></CardHeader>
              <CardContent className="px-0 space-y-4 max-h-[800px] overflow-y-auto pr-4 custom-scrollbar">
                {products?.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between p-6 bg-slate-50/50 rounded-3xl border border-slate-50 group hover:bg-blue-50/50 transition-all">
                    <div className="flex items-center gap-6">
                      <div className="relative w-20 h-20 rounded-2xl overflow-hidden shadow-lg">
                        <img src={p.imageUrl} className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500" />
                      </div>
                      <div>
                        <p className="text-blue-900 font-black text-sm uppercase truncate max-w-[180px] leading-tight mb-1">{p.name}</p>
                        <p className="text-blue-400 font-black text-[10px] uppercase tracking-widest italic">₹{p.price} / {p.unit}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[8px] border-blue-100 text-blue-400 font-black px-2 py-0">
                            {p.deliveryMode === 'standard' ? '2 Day' : '25 Min'}
                          </Badge>
                          {p.isPinned && <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />}
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteProduct(p.id)} className="h-12 w-12 rounded-2xl text-slate-200 hover:text-red-600 transition-all">
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="broadcast" className="space-y-10">
          <Card className="rounded-[3.5rem] p-12 bg-white shadow-2xl border-none max-w-4xl mx-auto overflow-hidden relative">
            <div className="absolute inset-0 shimmer opacity-5 pointer-events-none" />
            <CardHeader className="px-0 mb-8"><CardTitle className="text-blue-600 font-black uppercase text-3xl flex items-center gap-6 italic tracking-tighter"><Megaphone className="w-10 h-10" /> Global News Flash</CardTitle></CardHeader>
            <CardContent className="px-0 space-y-10">
              <div className="space-y-4">
                <Label className="text-[11px] font-black uppercase text-slate-300 ml-6 tracking-[0.4em]">Broadcast Message</Label>
                <Textarea value={announcementMsg} onChange={(e) => setAnnouncementMsg(e.target.value)} placeholder="What's happening in Bounsi?..." className="rounded-[2rem] bg-slate-50 border-none h-48 text-blue-950 font-black uppercase p-10 text-lg shadow-inner focus:ring-2 focus:ring-blue-100 transition-all" />
              </div>
              <div className="flex items-center gap-6 p-8 bg-blue-50/50 rounded-[2rem] border border-blue-50 shadow-inner">
                <Switch id="c-broadcast" checked={isAnnouncementActive} onCheckedChange={(checked) => setIsAnnouncementActive(checked)} className="scale-150 data-[state=checked]:bg-blue-600" />
                <Label htmlFor="c-broadcast" className="font-black text-blue-900 uppercase text-xs tracking-widest">Live System Status: {isAnnouncementActive ? "ON AIR" : "OFFLINE"}</Label>
              </div>
              <Button onClick={handleUpdateAnnouncement} className="w-full h-24 rounded-[2.5rem] bg-blue-600 text-white font-black uppercase shadow-[0_30px_60px_-10px_rgba(37,99,235,0.4)] italic text-2xl hover:brightness-110 active:scale-[0.98] transition-all border-none">Update Broadcaster</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <Card className="rounded-[3rem] p-10 bg-white shadow-2xl border-none">
              <CardHeader className="px-0 mb-8"><CardTitle className="text-blue-600 font-black uppercase text-2xl flex items-center gap-4 italic tracking-tighter"><Palette className="w-8 h-8" /> Interface Themes</CardTitle></CardHeader>
              <CardContent className="px-0 grid grid-cols-2 gap-4">
                {(Object.keys(THEME_DATA) as FestivalTheme[]).map(t => (
                  <Button key={t} onClick={() => handleUpdateTheme(t)} variant={currentTheme === t ? "default" : "outline"} className={cn("rounded-2xl font-black text-[11px] uppercase h-20 tracking-widest transition-all duration-500", currentTheme === t ? "bg-blue-600 text-white shadow-2xl scale-105 border-none" : "border-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-600")}>{t}</Button>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-[3rem] p-10 bg-white shadow-2xl border-none">
              <CardHeader className="px-0 mb-8"><CardTitle className="text-blue-600 font-black uppercase text-2xl flex items-center gap-4 italic tracking-tighter"><Wallet className="w-8 h-8" /> Revenue & Gateway</CardTitle></CardHeader>
              <CardContent className="px-0 space-y-6">
                <div className="space-y-2">
                  <Label className="text-[11px] font-black uppercase text-slate-300 ml-4 tracking-[0.2em]">Manual Revenue Display (₹)</Label>
                  <Input value={manualRevenue} onChange={(e) => setManualRevenue(e.target.value)} className="rounded-2xl bg-slate-50 border-none h-16 font-black text-blue-900 text-xl shadow-inner focus:ring-2 focus:ring-blue-100" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-black uppercase text-slate-300 ml-4">WhatsApp Endpoint</Label>
                  <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className="rounded-2xl bg-slate-50 border-none h-16 font-bold focus:ring-2 focus:ring-blue-100" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-black uppercase text-slate-300 ml-4">Merchant UPI ID</Label>
                  <Input value={upiId} onChange={(e) => setUpiId(e.target.value)} className="rounded-2xl bg-slate-50 border-none h-16 font-bold focus:ring-2 focus:ring-blue-100" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-black uppercase text-slate-300 ml-4">UPI QR Visual URL</Label>
                  <Input value={upiQrUrl} onChange={(e) => setUpiQrUrl(e.target.value)} className="rounded-2xl bg-slate-50 border-none h-16 font-bold focus:ring-2 focus:ring-blue-100" />
                </div>
                <Button onClick={handleUpdateSettings} className="w-full h-20 rounded-[2rem] bg-blue-600 text-white font-black uppercase italic shadow-2xl hover:brightness-110 active:scale-[0.98] transition-all border-none mt-6 tracking-widest">Synchronize Configuration</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
