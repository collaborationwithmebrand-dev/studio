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
  stats: { orders: number; earnings: number; upiId?: string; upiQrUrl?: string };
  currentTheme: FestivalTheme;
  onResetStats: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ currentTheme }) => {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('Food');
  const [unit, setUnit] = useState('kg');
  const [section, setSection] = useState('Dairy Special');
  const [imageUrl, setImageUrl] = useState('');
  const [isCodAvailable, setIsCodAvailable] = useState(true);
  const [isUpiAvailable, setIsUpiAvailable] = useState(true);
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
    const counts: Record<string, { name: string; count: number; revenue: number }> = {};
    orders.forEach((o: any) => {
      const pName = o.productName || 'Unknown';
      if (!counts[pName]) counts[pName] = { name: pName, count: 0, revenue: 0 };
      counts[pName].count += (o.quantity || 1);
      counts[pName].revenue += (o.amount || 0);
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
    toast({ title: "Bazaar Updated", description: `Theme set to ${newTheme}` });
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
    if (!name || !price || !imageUrl) return toast({ title: "Error", description: "Fill all fields", variant: "destructive" });
    addDocumentNonBlocking(collection(firestore, 'products'), {
      name, price: parseFloat(price), unit, section, category, imageUrl, isCodAvailable, isUpiAvailable, isPinned, createdAt: new Date().toISOString()
    });
    setName(''); setPrice(''); setImageUrl('');
    toast({ title: "Product Published!" });
  };

  const handleDeleteProduct = (productId: string) => {
    const productRef = doc(firestore, 'products', productId);
    deleteDocumentNonBlocking(productRef);
    toast({ title: "Product Removed", description: "The item has been deleted from your catalog." });
  };

  return (
    <div className="container mx-auto p-4 space-y-10">
      <Card className="rounded-[2rem] border-none shadow-xl bg-blue-50/50">
        <CardHeader><CardTitle className="text-blue-600 font-black flex items-center gap-2 uppercase text-sm"><TrendingUp className="w-5 h-5" /> TOP SELLING ITEMS</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {topSellers.map((p, i) => (
              <div key={i} className="bg-white p-4 rounded-2xl border border-blue-100 shadow-sm flex flex-col gap-1">
                <span className="text-blue-600 font-black text-xs">#{i+1}</span>
                <p className="text-blue-900 font-bold text-[10px] uppercase truncate">{p.name}</p>
                <p className="text-blue-500 font-black text-xs">{p.count} ORDERS</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="space-y-10">
          <Card className="rounded-[2rem] border-none shadow-xl">
            <CardHeader><CardTitle className="text-blue-600 font-black uppercase text-sm flex items-center gap-2"><Palette className="w-5 h-5" /> FESTIVAL THEME (Special Day)</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(Object.keys(THEME_DATA) as FestivalTheme[]).map(t => (
                <Button 
                  key={t} 
                  onClick={() => handleUpdateTheme(t)} 
                  variant={currentTheme === t ? "default" : "outline"} 
                  className={cn(
                    "rounded-xl h-12 font-black uppercase text-[10px] transition-all", 
                    currentTheme === t ? "bg-blue-600 scale-105 shadow-lg shadow-blue-200" : "text-blue-600 border-blue-100 hover:bg-blue-50"
                  )}
                >
                  {t}
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border-none shadow-xl">
            <CardHeader><CardTitle className="text-blue-600 font-black uppercase text-sm flex items-center gap-2"><Wallet className="w-5 h-5" /> CONTACT & UPI SETTINGS</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label className="text-blue-600 font-black uppercase text-[9px]">WhatsApp Order No</Label><Input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} className="rounded-xl bg-blue-50/50 border-none text-blue-900 font-bold" /></div>
                <div className="space-y-2"><Label className="text-blue-600 font-black uppercase text-[9px]">Help Line No</Label><Input value={helpline} onChange={e => setHelpline(e.target.value)} className="rounded-xl bg-blue-50/50 border-none text-blue-900 font-bold" /></div>
              </div>
              <div className="space-y-2"><Label className="text-blue-600 font-black uppercase text-[9px]">UPI ID</Label><Input value={upiId} onChange={e => setUpiId(e.target.value)} className="rounded-xl bg-blue-50/50 border-none text-blue-900 font-bold" /></div>
              <div className="space-y-2"><Label className="text-blue-600 font-black uppercase text-[9px]">UPI QR Image URL</Label><Input value={upiQrUrl} onChange={e => setUpiQrUrl(e.target.value)} className="rounded-xl bg-blue-50/50 border-none text-blue-900 font-bold" /></div>
              <Button onClick={handleUpdateSettings} className="w-full h-12 rounded-xl bg-blue-600 text-white font-black uppercase text-xs">SAVE BAZAAR SETTINGS</Button>
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border-none shadow-xl">
            <CardHeader>
              <div className="flex flex-col gap-4">
                <CardTitle className="text-blue-600 font-black uppercase text-sm flex items-center gap-2"><PackageSearch className="w-5 h-5" /> MANAGE CATALOG</CardTitle>
                <div className="relative">
                  <Input 
                    placeholder="Search in catalog..." 
                    value={catalogSearch} 
                    onChange={e => setCatalogSearch(e.target.value)}
                    className="rounded-xl bg-blue-50/50 border-none text-blue-900 font-bold pl-10"
                  />
                  <Search className="absolute left-3 top-2.5 w-5 h-5 text-blue-400" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {filteredCatalogProducts.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-blue-50/50 rounded-2xl border border-blue-100 group">
                  <div className="flex items-center gap-3">
                    <img src={p.imageUrl} className="w-10 h-10 rounded-lg object-cover" alt="" />
                    <div>
                      <p className="text-blue-900 font-black text-[10px] uppercase truncate max-w-[150px]">{p.name}</p>
                      <p className="text-blue-500 font-bold text-[9px]">₹{p.price} / {p.unit}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteProduct(p.id)} className="text-blue-400 hover:text-red-500 hover:bg-red-50 rounded-xl">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              {filteredCatalogProducts.length === 0 && (
                <p className="text-blue-400 font-bold text-center py-4 text-[10px] uppercase">No matching products found</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-[2rem] border-none shadow-xl h-fit">
          <CardHeader><CardTitle className="text-blue-600 font-black uppercase text-sm flex items-center gap-2"><PlusCircle className="w-5 h-5" /> PUBLISH PRODUCT</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label className="text-blue-600 font-black uppercase text-[9px]">Product Name</Label><Input value={name} onChange={e => setName(e.target.value)} className="rounded-xl bg-blue-50/50 border-none text-blue-900 font-bold" /></div>
              <div className="space-y-2"><Label className="text-blue-600 font-black uppercase text-[9px]">Price (₹)</Label><Input type="number" value={price} onChange={e => setPrice(e.target.value)} className="rounded-xl bg-blue-50/50 border-none text-blue-900 font-bold" /></div>
              <div className="space-y-2"><Label className="text-blue-600 font-black uppercase text-[9px]">Section</Label><Input value={section} onChange={e => setSection(e.target.value)} className="rounded-xl bg-blue-50/50 border-none text-blue-900 font-bold" /></div>
              <div className="space-y-2"><Label className="text-blue-600 font-black uppercase text-[9px]">Image URL</Label><Input value={imageUrl} onChange={e => setImageUrl(e.target.value)} className="rounded-xl bg-blue-50/50 border-none text-blue-900 font-bold" /></div>
            </div>

            <div className="space-y-3">
              <Label className="text-blue-600 font-black uppercase text-[9px] flex items-center gap-1.5"><Ruler className="w-3.5 h-3.5" /> SI Unit (Quantity Base)</Label>
              <RadioGroup value={unit} onValueChange={setUnit} className="grid grid-cols-4 gap-2">
                {['gm', 'kg', 'Liter', 'Pcs'].map(u => (
                  <div key={u} className={cn("p-3 rounded-xl border flex items-center justify-center cursor-pointer transition-all", unit === u ? "bg-blue-600 border-blue-600" : "bg-white border-blue-100")}>
                    <RadioGroupItem value={u} id={`u-${u}`} className="hidden" />
                    <Label htmlFor={`u-${u}`} className={cn("font-black text-[10px] cursor-pointer uppercase", unit === u ? "text-white" : "text-blue-600")}>{u}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="flex flex-wrap gap-4 py-2">
              <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-xl"><Checkbox id="c-cod" checked={isCodAvailable} onCheckedChange={v => setIsCodAvailable(v === true)} /><Label htmlFor="c-cod" className="text-blue-600 font-black uppercase text-[9px]">COD</Label></div>
              <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-xl"><Checkbox id="c-upi" checked={isUpiAvailable} onCheckedChange={v => setIsUpiAvailable(v === true)} /><Label htmlFor="c-upi" className="text-blue-600 font-black uppercase text-[9px]">UPI</Label></div>
              <div className="flex items-center gap-2 bg-blue-600 px-4 py-2 rounded-xl shadow-lg shadow-blue-200"><Checkbox id="c-pin" checked={isPinned} onCheckedChange={v => setIsPinned(v === true)} className="border-white" /><Label htmlFor="c-pin" className="text-white font-black uppercase text-[9px]">PIN TO TOP</Label></div>
            </div>

            <Button onClick={handleAdd} className="w-full h-16 rounded-2xl bg-blue-600 text-white font-black uppercase text-sm shadow-xl hover:scale-[1.02] transition-transform">PUBLISH TO BAZAAR</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};