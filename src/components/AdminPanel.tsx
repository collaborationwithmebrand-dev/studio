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
import { useFirestore, setDocumentNonBlocking, addDocumentNonBlocking, deleteDocumentNonBlocking, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { Palette, PlusCircle, Wallet, Ruler, TrendingUp, Trash2, PackageSearch, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminPanelProps {
  stats: { orders: number; earnings: number };
  currentTheme: FestivalTheme;
  onResetStats: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ currentTheme }) => {
  const firestore = useFirestore();
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

  const ordersQuery = useMemoFirebase(() => collection(firestore, 'orders'), [firestore]);
  const { data: orders } = useCollection(ordersQuery);

  const topSellers = useMemo(() => {
    if (!orders) return [];
    const counts: Record<string, { name: string; count: number }> = {};
    orders.forEach((o: any) => {
      const pName = o.productName || 'Unknown';
      if (!counts[pName]) counts[pName] = { name: pName, count: 0 };
      counts[pName].count += (o.quantity || 1);
    });
    return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [orders]);

  const filteredCatalogProducts = useMemo(() => {
    if (!products) return [];
    return products.filter(p => p.name.toLowerCase().includes(catalogSearch.toLowerCase()));
  }, [products, catalogSearch]);

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
    toast({ title: "Theme Updated", description: `Active theme: ${newTheme}` });
  };

  const handleUpdateSettings = () => {
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

  const handleDeleteProduct = (productId: string) => {
    const productRef = doc(firestore, 'products', productId);
    deleteDocumentNonBlocking(productRef);
    toast({ title: "Product Removed" });
  };

  return (
    <div className="container mx-auto p-4 space-y-8">
      {/* Top Sellers Section */}
      <Card className="rounded-3xl border-none shadow-sm bg-blue-50/30">
        <CardHeader><CardTitle className="text-blue-600 font-bold flex items-center gap-2 uppercase text-sm"><TrendingUp className="w-5 h-5" /> Most Popular Items</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {topSellers.map((p, i) => (
              <div key={i} className="bg-white p-3 rounded-2xl border border-blue-100 flex flex-col items-center text-center">
                <span className="text-blue-600 font-black text-xs mb-1">#{i+1}</span>
                <p className="text-blue-900 font-bold text-[10px] uppercase truncate w-full">{p.name}</p>
                <p className="text-blue-400 font-black text-[10px]">{p.count} SOLD</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-8">
          {/* Theme Settings */}
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
                    currentTheme === t ? "bg-blue-600" : "text-blue-600 border-blue-100 hover:bg-blue-50"
                  )}
                >
                  {t}
                </Button>
              ))}
            </CardContent>
          </Card>

          {/* Contact & Payment Settings */}
          <Card className="rounded-3xl border-none shadow-sm">
            <CardHeader><CardTitle className="text-blue-600 font-bold uppercase text-sm flex items-center gap-2"><Wallet className="w-5 h-5" /> Contact & UPI</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><Label className="text-blue-600 font-bold uppercase text-[9px]">WhatsApp Order No</Label><Input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} className="rounded-xl bg-blue-50/30 border-none text-blue-900 font-bold" /></div>
                <div className="space-y-1"><Label className="text-blue-600 font-bold uppercase text-[9px]">Help Line No</Label><Input value={helpline} onChange={e => setHelpline(e.target.value)} className="rounded-xl bg-blue-50/30 border-none text-blue-900 font-bold" /></div>
              </div>
              <div className="space-y-1"><Label className="text-blue-600 font-bold uppercase text-[9px]">UPI ID</Label><Input value={upiId} onChange={e => setUpiId(e.target.value)} className="rounded-xl bg-blue-50/30 border-none text-blue-900 font-bold" /></div>
              <div className="space-y-1"><Label className="text-blue-600 font-bold uppercase text-[9px]">UPI QR Image URL</Label><Input value={upiQrUrl} onChange={e => setUpiQrUrl(e.target.value)} className="rounded-xl bg-blue-50/30 border-none text-blue-900 font-bold" /></div>
              <Button onClick={handleUpdateSettings} className="w-full h-10 rounded-xl bg-blue-600 text-white font-bold uppercase text-xs">Save Settings</Button>
            </CardContent>
          </Card>

          {/* Manage Products */}
          <Card className="rounded-3xl border-none shadow-sm">
            <CardHeader>
              <div className="flex flex-col gap-2">
                <CardTitle className="text-blue-600 font-bold uppercase text-sm flex items-center gap-2"><PackageSearch className="w-5 h-5" /> Manage Inventory</CardTitle>
                <div className="relative">
                  <Input 
                    placeholder="Search products..." 
                    value={catalogSearch} 
                    onChange={e => setCatalogSearch(e.target.value)}
                    className="rounded-xl bg-blue-50/30 border-none text-blue-900 font-bold pl-9"
                  />
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-blue-400" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
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

        {/* Add Product Form */}
        <Card className="rounded-3xl border-none shadow-sm h-fit">
          <CardHeader><CardTitle className="text-blue-600 font-bold uppercase text-sm flex items-center gap-2"><PlusCircle className="w-5 h-5" /> New Product</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><Label className="text-blue-600 font-bold uppercase text-[9px]">Product Name</Label><Input value={name} onChange={e => setName(e.target.value)} className="rounded-xl bg-blue-50/30 border-none text-blue-900 font-bold" /></div>
              <div className="space-y-1"><Label className="text-blue-600 font-bold uppercase text-[9px]">Price (₹)</Label><Input type="number" value={price} onChange={e => setPrice(e.target.value)} className="rounded-xl bg-blue-50/30 border-none text-blue-900 font-bold" /></div>
              <div className="space-y-1"><Label className="text-blue-600 font-bold uppercase text-[9px]">Store Section</Label><Input value={section} onChange={e => setSection(e.target.value)} className="rounded-xl bg-blue-50/30 border-none text-blue-900 font-bold" /></div>
              <div className="space-y-1"><Label className="text-blue-600 font-bold uppercase text-[9px]">Image Link</Label><Input value={imageUrl} onChange={e => setImageUrl(e.target.value)} className="rounded-xl bg-blue-50/30 border-none text-blue-900 font-bold" /></div>
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
              <Checkbox id="c-pin" checked={isPinned} onCheckedChange={v => setIsPinned(v === true)} className="border-blue-300" />
              <Label htmlFor="c-pin" className="text-blue-600 font-bold uppercase text-[9px]">Feature at Top</Label>
            </div>

            <Button onClick={handleAdd} className="w-full h-12 rounded-xl bg-blue-600 text-white font-bold uppercase text-sm shadow-md">Publish to Bazaar</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};