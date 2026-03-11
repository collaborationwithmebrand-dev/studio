
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
    toast({ title: "Broadcast Updated" });
  };

  const handleAdd = async () => {
    if (!name || !price || !imageUrl) return toast({ title: "Error", description: "Fill required fields", variant: "destructive" });
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
    toast({ title: `Order ${newStatus}`, className: "bg-blue-600 text-white font-black" });
  };

  const handleDeleteProduct = (productId: string) => {
    deleteDocumentNonBlocking(doc(firestore, 'products', productId));
    toast({ title: "Product Removed", variant: "destructive" });
  };

  const handleAiDescription = async () => {
    if (!name) return toast({ title: "AI Warning", description: "Enter name first", variant: "destructive" });
    setIsAiLoading(true);
    try {
      const result = await generateProductDescription({
        productName: name,
        keywords: [category, section, unit]
      });
      setDescription(result.description);
      toast({ title: "AI Magic Done", className: "bg-blue-600 text-white font-black" });
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
    <div className="container mx-auto px-4 space-y-8 md:space-y-12">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <h2 className="text-2xl md:text-4xl font-black text-blue-900 uppercase italic tracking-tighter">Admin Hub</h2>
      </div>

      <Tabs defaultValue="inventory" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-blue-50 rounded-2xl h-14 p-1 mb-8">
          <TabsTrigger value="inventory" className="rounded-xl font-black uppercase text-[10px] data-[state=active]:bg-blue-600 data-[state=active]:text-white">Inv</TabsTrigger>
          <TabsTrigger value="orders" className="rounded-xl font-black uppercase text-[10px] data-[state=active]:bg-blue-600 data-[state=active]:text-white">Orders</TabsTrigger>
          <TabsTrigger value="broadcast" className="rounded-xl font-black uppercase text-[10px] data-[state=active]:bg-blue-600 data-[state=active]:text-white">Cast</TabsTrigger>
          <TabsTrigger value="settings" className="rounded-xl font-black uppercase text-[10px] data-[state=active]:bg-blue-600 data-[state=active]:text-white">Config</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="rounded-3xl p-4 bg-white shadow-xl border-none">
              <CardHeader><CardTitle className="text-blue-600 font-black uppercase flex items-center gap-3"><PlusCircle /> New Item</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Title" className="rounded-xl bg-blue-50 border-none h-12" />
                  <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price" className="rounded-xl bg-blue-50 border-none h-12" />
                  <Input value={section} onChange={(e) => setSection(e.target.value)} placeholder="Section" className="rounded-xl bg-blue-50 border-none h-12" />
                  <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Image URL" className="rounded-xl bg-blue-50 border-none h-12" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-[10px] font-black uppercase text-blue-400">Description</Label>
                    <Button onClick={handleAiDescription} disabled={isAiLoading} variant="ghost" className="h-8 text-[10px] font-black text-blue-600">AI GEN</Button>
                  </div>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="rounded-xl bg-blue-50 border-none h-32" />
                </div>
                <RadioGroup value={unit} onValueChange={setUnit} className="grid grid-cols-4 gap-2">
                  {['gm', 'kg', 'Liter', 'Pcs'].map(u => (
                    <div key={u} className={cn("p-2 rounded-xl border text-center cursor-pointer font-black text-[10px]", unit === u ? "bg-blue-600 text-white" : "bg-white")}>
                      <RadioGroupItem value={u} id={`u-${u}`} className="hidden" />
                      <Label htmlFor={`u-${u}`} className="cursor-pointer">{u}</Label>
                    </div>
                  ))}
                </RadioGroup>
                <Button onClick={handleAdd} className="w-full h-14 rounded-xl bg-blue-600 text-white font-black uppercase shadow-lg">Publish</Button>
              </CardContent>
            </Card>

            <Card className="rounded-3xl p-4 bg-white shadow-xl border-none">
              <CardHeader><CardTitle className="text-blue-600 font-black uppercase flex items-center gap-3"><Database /> Inventory</CardTitle></CardHeader>
              <CardContent className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {filteredCatalogProducts?.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-blue-50/20 rounded-xl border border-blue-50">
                    <div className="flex items-center gap-3">
                      <img src={p.imageUrl} className="w-10 h-10 rounded-lg object-cover" />
                      <div>
                        <p className="text-blue-900 font-black text-[10px] uppercase truncate max-w-[120px]">{p.name}</p>
                        <p className="text-blue-400 font-black text-[8px] uppercase tracking-widest">₹{p.price} / {p.unit}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteProduct(p.id)} className="text-blue-200 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="orders" className="space-y-8">
          <Card className="rounded-3xl p-4 bg-white shadow-xl border-none">
            <CardHeader><CardTitle className="text-blue-600 font-black uppercase italic tracking-tighter">Live Orders</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {orders?.map((order: any) => (
                <div key={order.id} className="p-6 bg-blue-50/30 rounded-2xl border border-blue-100 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest">#{order.id.slice(-6)}</p>
                      <p className="text-lg font-black text-blue-900">{order.phoneNumber}</p>
                      <p className="text-[10px] text-slate-500 font-bold">{order.deliveryAddress}</p>
                    </div>
                    <Badge className={cn(
                      "text-[8px] font-black uppercase px-2 py-1",
                      order.status === 'pending' ? "bg-yellow-400 text-black" :
                      order.status === 'confirmed' ? "bg-blue-600 text-white" : "bg-green-600 text-white"
                    )}>
                      {order.status}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => handleUpdateOrderStatus(order.id, 'confirmed')} size="sm" className="flex-1 bg-blue-600 text-white font-black text-[9px] uppercase">Confirm</Button>
                    <Button onClick={() => handleUpdateOrderStatus(order.id, 'delivered')} size="sm" className="flex-1 bg-green-600 text-white font-black text-[9px] uppercase">Deliver</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="broadcast" className="space-y-8">
          <Card className="rounded-3xl p-8 bg-white shadow-xl border-none">
            <CardHeader><CardTitle className="text-blue-600 font-black uppercase flex items-center gap-3"><Megaphone /> Store Announcement</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <Textarea value={announcementMsg} onChange={(e) => setAnnouncementMsg(e.target.value)} className="rounded-2xl bg-blue-50 border-none h-40 text-blue-900 font-black uppercase" />
              <div className="flex items-center gap-3">
                <Checkbox id="c-broadcast" checked={isAnnouncementActive} onCheckedChange={(checked) => setIsAnnouncementActive(checked)} />
                <Label htmlFor="c-broadcast" className="font-black text-blue-900">Make Live</Label>
              </div>
              <Button onClick={handleUpdateAnnouncement} className="w-full h-16 rounded-xl bg-blue-600 text-white font-black uppercase shadow-lg italic">Push Update</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="rounded-3xl p-4 bg-white shadow-xl border-none">
              <CardHeader><CardTitle className="text-blue-600 font-black uppercase flex items-center gap-3"><Palette /> Themes</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-3 gap-2">
                {(Object.keys(THEME_DATA) as FestivalTheme[]).map(t => (
                  <Button key={t} onClick={() => handleUpdateTheme(t)} variant={currentTheme === t ? "default" : "outline"} className="rounded-xl font-black text-[10px] uppercase h-14">{t}</Button>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-3xl p-4 bg-white shadow-xl border-none">
              <CardHeader><CardTitle className="text-blue-600 font-black uppercase flex items-center gap-3"><Wallet /> Payment Config</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="WhatsApp Number" className="rounded-xl bg-blue-50 border-none h-12" />
                <Input value={helpline} onChange={(e) => setHelpline(e.target.value)} placeholder="Helpline Number" className="rounded-xl bg-blue-50 border-none h-12" />
                <Input value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="UPI ID" className="rounded-xl bg-blue-50 border-none h-12" />
                <Input value={upiQrUrl} onChange={(e) => setUpiQrUrl(e.target.value)} placeholder="QR Code URL" className="rounded-xl bg-blue-50 border-none h-12" />
                <Button onClick={handleUpdateSettings} className="w-full h-14 rounded-xl bg-blue-600 text-white font-black uppercase italic shadow-lg">Sync Settings</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
