
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
import { Palette, PlusCircle, Wallet, Trash2, Megaphone, CheckCircle2, Truck, XCircle, Database, LayoutDashboard, PhoneCall, MapPin, User, Gift } from 'lucide-react';
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
      createdAt: new Date().toISOString()
    });
    setName(''); setPrice(''); setImageUrl(''); setDescription('');
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
    <div className="container mx-auto px-4 space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-blue-100 rounded-2xl">
          <LayoutDashboard className="w-8 h-8 text-blue-600" />
        </div>
        <div>
          <h2 className="text-3xl font-black text-blue-900 uppercase italic tracking-tighter">Secure Admin Hub</h2>
          <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Administrator Access Confirmed</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="rounded-[2rem] p-6 bg-blue-600 text-white border-none shadow-xl">
          <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-2">Manual Revenue tracking</p>
          <h3 className="text-4xl font-black italic tracking-tighter">₹{manualRevenue}</h3>
        </Card>
        <Card className="rounded-[2rem] p-6 bg-white border-none shadow-xl border-slate-50">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Total Orders</p>
          <h3 className="text-4xl font-black italic tracking-tighter text-slate-900">{orders?.length || 0}</h3>
        </Card>
        <Card className="rounded-[2rem] p-6 bg-white border-none shadow-xl border-slate-50">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Inventory Items</p>
          <h3 className="text-4xl font-black italic tracking-tighter text-slate-900">{products?.length || 0}</h3>
        </Card>
      </div>

      <Tabs defaultValue="orders" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-blue-50 rounded-2xl h-16 p-1 mb-10">
          <TabsTrigger value="orders" className="rounded-xl font-black uppercase text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all">Orders</TabsTrigger>
          <TabsTrigger value="inventory" className="rounded-xl font-black uppercase text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all">Items</TabsTrigger>
          <TabsTrigger value="broadcast" className="rounded-xl font-black uppercase text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all">Alerts</TabsTrigger>
          <TabsTrigger value="settings" className="rounded-xl font-black uppercase text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all">Config</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {orders?.map((order: any) => (
              <Card key={order.id} className="rounded-3xl border-none bg-blue-50/30 p-6 space-y-4 hover:shadow-xl transition-all border border-blue-50/50">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-blue-400 uppercase">#{order.id.slice(-6)}</p>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-600 text-white rounded-xl shadow-md">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xl font-black text-blue-900">{order.phoneNumber}</p>
                        <Badge variant="outline" className={cn("text-[9px] font-black uppercase", 
                          order.status === 'confirmed' ? "border-blue-400 text-blue-600" : 
                          order.status === 'delivered' ? "border-green-400 text-green-600" :
                          order.status === 'cancelled' ? "border-red-400 text-red-600" :
                          "border-slate-200 text-slate-400"
                        )}>
                          {order.status}
                        </Badge>
                      </div>
                      <a href={`tel:${order.phoneNumber}`} className="p-3 bg-blue-100 text-blue-600 rounded-xl hover:bg-blue-200 transition-colors">
                        <PhoneCall className="w-5 h-5" />
                      </a>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteOrder(order.id)} className="text-blue-200 hover:text-red-500">
                    <Trash2 className="w-5 h-5" />
                  </Button>
                </div>

                <div className="bg-white rounded-2xl p-4 space-y-3 border border-blue-50 shadow-inner">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[10px] font-black text-blue-400 uppercase tracking-widest">
                      <MapPin className="w-3 h-3" /> Delivery Location
                    </div>
                    <p className="text-sm font-bold text-slate-700 italic leading-relaxed">"{order.deliveryAddress}"</p>
                  </div>

                  {order.isForSomeoneElse && (
                    <div className="pt-3 border-t border-blue-50 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[9px] font-black text-pink-500 uppercase">
                          <Gift className="w-3 h-3" /> Recipient
                        </div>
                        <p className="text-xs font-black text-slate-900">{order.recipientPhone}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[9px] font-black text-blue-400 uppercase">
                          <User className="w-3 h-3" /> Sender
                        </div>
                        <p className="text-xs font-black text-slate-900">{order.senderPhone}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center">
                  <p className="text-2xl font-black text-blue-600 italic">₹{order.totalAmount}</p>
                  <p className="text-[9px] font-black text-slate-300 uppercase">{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => handleUpdateOrderStatus(order.id, 'confirmed')} size="sm" className="flex-1 min-w-[100px] bg-blue-600 text-white font-black text-[10px] h-12 uppercase rounded-xl">
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Confirm
                  </Button>
                  <Button onClick={() => handleUpdateOrderStatus(order.id, 'delivered')} size="sm" className="flex-1 min-w-[100px] bg-green-600 text-white font-black text-[10px] h-12 uppercase rounded-xl">
                    <Truck className="w-4 h-4 mr-2" /> Deliver
                  </Button>
                  <Button onClick={() => handleUpdateOrderStatus(order.id, 'cancelled')} size="sm" variant="outline" className="flex-1 min-w-[100px] border-red-100 text-red-500 font-black text-[10px] h-12 uppercase rounded-xl">
                    <XCircle className="w-4 h-4 mr-2" /> Cancel
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="rounded-[2.5rem] p-6 md:p-8 bg-white shadow-xl border-none">
              <CardHeader className="px-0"><CardTitle className="text-blue-600 font-black uppercase flex items-center gap-3"><PlusCircle /> New Product</CardTitle></CardHeader>
              <CardContent className="px-0 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Title" className="rounded-xl bg-blue-50 border-none h-14 font-bold" />
                  <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price (₹)" className="rounded-xl bg-blue-50 border-none h-14 font-bold" />
                  <Input value={section} onChange={(e) => setSection(e.target.value)} placeholder="Section (e.g. Snacks)" className="rounded-xl bg-blue-50 border-none h-14 font-bold" />
                  <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Image URL" className="rounded-xl bg-blue-50 border-none h-14 font-bold" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-[10px] font-black uppercase text-blue-400">Description</Label>
                    <Button onClick={handleAiDescription} disabled={isAiLoading} variant="ghost" className="h-8 text-[10px] font-black text-blue-600 hover:bg-blue-50">AI ASSIST</Button>
                  </div>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="rounded-xl bg-blue-50 border-none h-32 font-medium" />
                </div>
                <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase text-blue-400 ml-3">Unit / Size</Label>
                  <RadioGroup value={unit} onValueChange={setUnit} className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {UNIT_OPTIONS.map(u => (
                      <div key={u} className={cn("p-4 rounded-xl border-2 text-center cursor-pointer font-black text-[10px] transition-all", unit === u ? "bg-blue-600 text-white border-blue-600 shadow-md" : "bg-white border-blue-50")}>
                        <RadioGroupItem value={u} id={`u-${u}`} className="hidden" />
                        <Label htmlFor={`u-${u}`} className="cursor-pointer uppercase block">{u}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
                <Button onClick={handleAdd} className="w-full h-16 rounded-2xl bg-blue-600 text-white font-black uppercase shadow-xl hover:scale-[1.01] transition-all">Publish Item</Button>
              </CardContent>
            </Card>

            <Card className="rounded-[2.5rem] p-6 md:p-8 bg-white shadow-xl border-none">
              <CardHeader className="px-0"><CardTitle className="text-blue-600 font-black uppercase flex items-center gap-3"><Database /> Catalog</CardTitle></CardHeader>
              <CardContent className="px-0 space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {products?.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between p-4 bg-blue-50/20 rounded-2xl border border-blue-50">
                    <div className="flex items-center gap-4">
                      <img src={p.imageUrl} className="w-14 h-14 rounded-xl object-cover shadow-sm" />
                      <div>
                        <p className="text-blue-900 font-black text-xs uppercase truncate max-w-[150px]">{p.name}</p>
                        <p className="text-blue-400 font-black text-[9px] uppercase tracking-widest">₹{p.price} / {p.unit}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteProduct(p.id)} className="text-blue-200 hover:text-red-600">
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="broadcast" className="space-y-8">
          <Card className="rounded-[2.5rem] p-8 bg-white shadow-xl border-none">
            <CardHeader className="px-0"><CardTitle className="text-blue-600 font-black uppercase flex items-center gap-3"><Megaphone /> Global Announcement</CardTitle></CardHeader>
            <CardContent className="px-0 space-y-6">
              <Textarea value={announcementMsg} onChange={(e) => setAnnouncementMsg(e.target.value)} placeholder="Type information for all customers..." className="rounded-2xl bg-blue-50 border-none h-40 text-blue-900 font-black uppercase" />
              <div className="flex items-center gap-4 p-5 bg-blue-50 rounded-2xl">
                <Switch id="c-broadcast" checked={isAnnouncementActive} onCheckedChange={(checked) => setIsAnnouncementActive(checked)} />
                <Label htmlFor="c-broadcast" className="font-black text-blue-900 uppercase text-xs">Live Broadcast Status</Label>
              </div>
              <Button onClick={handleUpdateAnnouncement} className="w-full h-20 rounded-2xl bg-blue-600 text-white font-black uppercase shadow-xl italic text-lg hover:scale-[1.01] transition-all">Push to Everyone</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="rounded-[2.5rem] p-6 md:p-8 bg-white shadow-xl border-none">
              <CardHeader className="px-0"><CardTitle className="text-blue-600 font-black uppercase flex items-center gap-3"><Palette /> Visual Themes</CardTitle></CardHeader>
              <CardContent className="px-0 grid grid-cols-2 gap-3">
                {(Object.keys(THEME_DATA) as FestivalTheme[]).map(t => (
                  <Button key={t} onClick={() => handleUpdateTheme(t)} variant={currentTheme === t ? "default" : "outline"} className={cn("rounded-2xl font-black text-[10px] uppercase h-16 transition-all", currentTheme === t ? "bg-blue-600 text-white shadow-lg" : "border-blue-50 text-blue-400 hover:bg-blue-50")}>{t}</Button>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-[2.5rem] p-6 md:p-8 bg-white shadow-xl border-none">
              <CardHeader className="px-0"><CardTitle className="text-blue-600 font-black uppercase flex items-center gap-3"><Wallet /> Store Config</CardTitle></CardHeader>
              <CardContent className="px-0 space-y-4">
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase text-blue-400 ml-3">Manual Revenue (₹)</Label>
                  <Input value={manualRevenue} onChange={(e) => setManualRevenue(e.target.value)} placeholder="Display Revenue Value" className="rounded-xl bg-blue-50 border-none h-14 font-black text-blue-900" />
                </div>
                <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="WhatsApp (Delivery Hub)" className="rounded-xl bg-blue-50 border-none h-14 font-bold" />
                <Input value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="UPI ID" className="rounded-xl bg-blue-50 border-none h-14 font-bold" />
                <Input value={upiQrUrl} onChange={(e) => setUpiQrUrl(e.target.value)} placeholder="UPI QR URL" className="rounded-xl bg-blue-50 border-none h-14 font-bold" />
                <Button onClick={handleUpdateSettings} className="w-full h-16 rounded-xl bg-blue-600 text-white font-black uppercase italic shadow-xl hover:scale-[1.01] transition-all">Sync Configurations</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
