
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
import { Palette, PlusCircle, Wallet, Trash2, Megaphone, CheckCircle2, Truck, XCircle, Database, LayoutDashboard, PhoneCall, MapPin, User, Gift, Clock, Zap, Star, Tag, Image as ImageIcon } from 'lucide-react';
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

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('Pcs');
  const [section, setSection] = useState('General Bazaar');
  const [imageUrl, setImageUrl] = useState('');
  const [imageUrl2, setImageUrl2] = useState('');
  const [description, setDescription] = useState('');
  const [deliveryMode, setDeliveryMode] = useState<'instant' | 'standard'>('instant');
  const [isPinned, setIsPinned] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const [whatsapp, setWhatsapp] = useState('');
  const [helpline, setHelpline] = useState('');
  const [upiId, setUpiId] = useState('');
  const [upiQrUrl, setUpiQrUrl] = useState('');
  const [manualRevenue, setManualRevenue] = useState<string>('0');
  const [estimatedTime, setEstimatedTime] = useState('17-25 min');
  const [freeDeliveryMsg, setFreeDeliveryMsg] = useState('');
  
  const [announcementMsg, setAnnouncementMsg] = useState('');
  const [isAnnouncementActive, setIsAnnouncementActive] = useState(false);
  
  const UNIT_OPTIONS = ['gm', 'kg', 'Liter', 'Pcs', 'L', 'XL', 'XXL', '32', '34', '36', '38'];
  const CATEGORY_SUGGESTIONS = ['Plants', 'Fashion', 'Kitchen', 'Electronics', 'Snacks', 'Personal Care'];

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

  useEffect(() => {
    if (announcement) {
      setAnnouncementMsg(announcement.message || '');
      setIsAnnouncementActive(announcement.active || false);
    }
  }, [announcement]);

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
      category: category || "General", 
      imageUrl, 
      imageUrl2: imageUrl2 || null,
      description,
      deliveryMode,
      isPinned,
      createdAt: new Date().toISOString()
    });
    setName(''); setPrice(''); setImageUrl(''); setImageUrl2(''); setDescription(''); setCategory(''); setIsPinned(false); setUnit('Pcs');
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

      <Tabs defaultValue="orders" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-blue-50/50 rounded-[2rem] h-16 p-1.5 mb-12 shadow-inner">
          <TabsTrigger value="orders" className="rounded-xl font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-blue-600 data-[state=active]:text-white">Orders</TabsTrigger>
          <TabsTrigger value="inventory" className="rounded-xl font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-blue-600 data-[state=active]:text-white">Items</TabsTrigger>
          <TabsTrigger value="broadcast" className="rounded-xl font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-blue-600 data-[state=active]:text-white">Alerts</TabsTrigger>
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
                  <p className="text-[9px] font-black text-slate-300 uppercase">{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
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
              <CardHeader className="px-0 mb-6"><CardTitle className="text-blue-600 font-black uppercase text-xl flex items-center gap-3 italic"><PlusCircle className="w-6 h-6" /> New Bazaar Item</CardTitle></CardHeader>
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
                  <Label className="text-[10px] font-black uppercase text-slate-300 ml-3">Unit / Variant (Type anything: 500 gm, 1 Liter...)</Label>
                  <Input value={unit} onChange={(e) => setUnit(e.target.value)} className="rounded-xl bg-slate-50 border-none h-14 font-bold" />
                  <div className="flex flex-wrap gap-2 mt-2">
                    {UNIT_OPTIONS.map(u => (
                      <Button key={u} type="button" onClick={() => setUnit(u)} variant="outline" className="h-8 px-3 rounded-lg text-[9px] font-black uppercase border-blue-100 text-blue-400">{u}</Button>
                    ))}
                  </div>
                </div>
                <Button onClick={handleAdd} className="w-full h-16 rounded-[1.5rem] bg-blue-600 text-white font-black uppercase shadow-xl hover:brightness-110 text-lg italic border-none">Publish Item</Button>
              </CardContent>
            </Card>

            <Card className="rounded-[2.5rem] p-8 bg-white shadow-2xl border-none">
              <CardHeader className="px-0 mb-6"><CardTitle className="text-blue-600 font-black uppercase text-xl flex items-center gap-3 italic"><Database className="w-6 h-6" /> Inventory</CardTitle></CardHeader>
              <CardContent className="px-0 space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {products?.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-50 group">
                    <div className="flex items-center gap-4">
                      <div className="relative w-14 h-14 rounded-xl overflow-hidden shadow-md"><img src={p.imageUrl} className="w-full h-full object-cover" /></div>
                      <div>
                        <p className="text-blue-900 font-black text-xs uppercase truncate max-w-[140px] leading-tight">{p.name}</p>
                        <p className="text-blue-400 font-black text-[9px] uppercase italic">₹{p.price} / {p.unit}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteProduct(p.id)} className="h-10 w-10 rounded-xl text-slate-200 hover:text-red-600 transition-all"><Trash2 className="w-4 h-4" /></Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="broadcast" className="space-y-8">
          <Card className="rounded-[2.5rem] p-8 bg-white shadow-2xl border-none max-w-2xl mx-auto">
            <CardHeader className="px-0 mb-6"><CardTitle className="text-blue-600 font-black uppercase text-2xl flex items-center gap-4 italic"><Megaphone className="w-8 h-8" /> Announcements</CardTitle></CardHeader>
            <CardContent className="px-0 space-y-8">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-slate-300 ml-4">Message</Label>
                <Textarea value={announcementMsg} onChange={(e) => setAnnouncementMsg(e.target.value)} placeholder="Type info for all..." className="rounded-2xl bg-slate-50 border-none h-40 text-blue-950 font-black uppercase p-6 shadow-inner" />
              </div>
              <div className="flex items-center gap-4 p-6 bg-blue-50/50 rounded-2xl border border-blue-50">
                <Switch id="c-broadcast" checked={isAnnouncementActive} onCheckedChange={(checked) => setIsAnnouncementActive(checked)} className="scale-125 data-[state=checked]:bg-blue-600" />
                <Label htmlFor="c-broadcast" className="font-black text-blue-900 uppercase text-[10px]">Broadcast Active: {isAnnouncementActive ? "ON" : "OFF"}</Label>
              </div>
              <Button onClick={handleUpdateAnnouncement} className="w-full h-16 rounded-[1.5rem] bg-blue-600 text-white font-black uppercase shadow-xl italic text-lg border-none">Update News</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <Card className="rounded-[2.5rem] p-8 bg-white shadow-2xl border-none">
              <CardHeader className="px-0 mb-6"><CardTitle className="text-blue-600 font-black uppercase text-xl flex items-center gap-3 italic"><Palette className="w-6 h-6" /> Themes</CardTitle></CardHeader>
              <CardContent className="px-0 grid grid-cols-2 gap-3">
                {(Object.keys(THEME_DATA) as FestivalTheme[]).map(t => (
                  <Button key={t} onClick={() => handleUpdateTheme(t)} variant={currentTheme === t ? "default" : "outline"} className={cn("rounded-xl font-black text-[9px] uppercase h-14 transition-all", currentTheme === t ? "bg-blue-600 text-white shadow-lg border-none" : "border-slate-50 text-slate-400")}>{t}</Button>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-[2.5rem] p-8 bg-white shadow-2xl border-none">
              <CardHeader className="px-0 mb-6"><CardTitle className="text-blue-600 font-black uppercase text-xl flex items-center gap-3 italic"><Wallet className="w-6 h-6" /> Shop Config</CardTitle></CardHeader>
              <CardContent className="px-0 space-y-4">
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
