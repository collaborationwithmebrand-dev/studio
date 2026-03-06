
"use client"

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { FestivalTheme, THEME_DATA } from '@/app/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, addDocumentNonBlocking, setDocumentNonBlocking, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { Palette, PlusCircle, Wallet, Layers, Ruler } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminPanelProps {
  stats: { orders: number; earnings: number; upiId?: string; upiQrUrl?: string };
  currentTheme: FestivalTheme;
  onResetStats: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ stats, currentTheme }) => {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('Food');
  const [unit, setUnit] = useState('kg');
  const [section, setSection] = useState('General Bazaar');
  const [imageUrl, setImageUrl] = useState('');
  const [isCodAvailable, setIsCodAvailable] = useState(true);
  const [isUpiAvailable, setIsUpiAvailable] = useState(true);
  const [isPinned, setIsPinned] = useState(false);

  // Store Settings state
  const [whatsapp, setWhatsapp] = useState('');
  const [helpline, setHelpline] = useState('');
  const [upiId, setUpiId] = useState('');
  const [upiQrUrl, setUpiQrUrl] = useState('');

  const settingsRef = useMemoFirebase(() => doc(firestore, 'storeSettings', 'mainSettings'), [firestore]);
  const { data: settings } = useDoc(settingsRef);

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
    toast({ 
      title: "Bazaar Updated!", 
      description: `The theme is now set to ${newTheme} for all users.`,
    });
  };

  const handleUpdateSettings = () => {
    setDocumentNonBlocking(settingsRef, { 
      whatsappNumber: whatsapp, 
      helpLineNumber: helpline,
      upiId: upiId,
      upiQrUrl: upiQrUrl,
      lastUpdated: new Date().toISOString()
    }, { merge: true });
    toast({ title: "Settings Saved", description: "Bazaar configurations updated successfully." });
  };

  const handleAdd = async () => {
    if (!name || !price || !imageUrl) return toast({ title: "Error", description: "Please fill all required fields", variant: "destructive" });
    
    addDocumentNonBlocking(collection(firestore, 'products'), {
      name, 
      price: parseFloat(price), 
      unit, 
      section, 
      category, 
      imageUrl, 
      isCodAvailable, 
      isUpiAvailable, 
      isPinned, 
      createdAt: new Date().toISOString()
    });
    
    setName(''); 
    setPrice(''); 
    setImageUrl('');
    toast({ title: "Product Added", description: `${name} is now live in the Bazaar!` });
  };

  return (
    <div className="container mx-auto p-4 space-y-8 pb-20">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Theme & Store Settings */}
        <div className="space-y-8">
          <Card className="rounded-[2.5rem] shadow-2xl border-none bg-white/95 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="font-black flex items-center gap-2 text-blue-600 uppercase tracking-tighter">
                <Palette className="w-6 h-6 text-blue-600" /> GLOBAL THEME
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-3">
                {(Object.keys(THEME_DATA) as FestivalTheme[]).map((theme) => (
                  <Button 
                    key={theme}
                    onClick={() => handleUpdateTheme(theme)}
                    variant={currentTheme === theme ? "default" : "outline"}
                    className={cn(
                      "rounded-2xl h-14 font-black border-blue-200 transition-all uppercase text-xs",
                      currentTheme === theme ? 'bg-blue-600 text-white' : 'bg-transparent text-blue-600 hover:bg-blue-50'
                    )}
                  >
                    {theme}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[2.5rem] shadow-2xl border-none bg-white/95 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="font-black flex items-center gap-2 text-blue-600 uppercase tracking-tighter">
                <Wallet className="w-6 h-6 text-blue-600" /> BAZAAR CONTACTS
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="font-black text-blue-600 uppercase text-[10px] tracking-widest">WhatsApp Number</Label>
                <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="91XXXXXXXXXX" className="rounded-xl h-12 bg-blue-50 border-none text-blue-900 placeholder:text-blue-300 font-bold" />
              </div>
              <div className="space-y-2">
                <Label className="font-black text-blue-600 uppercase text-[10px] tracking-widest">Help Line Number</Label>
                <Input value={helpline} onChange={(e) => setHelpline(e.target.value)} placeholder="91XXXXXXXXXX" className="rounded-xl h-12 bg-blue-50 border-none text-blue-900 placeholder:text-blue-300 font-bold" />
              </div>
              <div className="space-y-2">
                <Label className="font-black text-blue-600 uppercase text-[10px] tracking-widest">UPI ID</Label>
                <Input value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="bazaar@upi" className="rounded-xl h-12 bg-blue-50 border-none text-blue-900 placeholder:text-blue-300 font-bold" />
              </div>
              <div className="space-y-2">
                <Label className="font-black text-blue-600 uppercase text-[10px] tracking-widest">UPI QR URL</Label>
                <Input value={upiQrUrl} onChange={(e) => setUpiQrUrl(e.target.value)} placeholder="https://..." className="rounded-xl h-12 bg-blue-50 border-none text-blue-900 placeholder:text-blue-300 font-bold" />
              </div>
              <Button onClick={handleUpdateSettings} className="w-full h-14 rounded-2xl bg-blue-600 text-white font-black hover:bg-blue-700 shadow-xl uppercase">
                SAVE BAZAAR SETTINGS
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Product Add Section */}
        <Card className="rounded-[2.5rem] shadow-2xl border-none lg:col-span-2 bg-white/95">
          <CardHeader>
            <CardTitle className="text-blue-600 font-black flex items-center gap-2 uppercase tracking-tighter">
              <PlusCircle className="w-6 h-6 text-blue-600" /> PUBLISH NEW PRODUCT
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="font-black text-blue-600 uppercase text-[10px] tracking-widest">Product Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pure Desi Ghee" className="rounded-xl h-12 bg-blue-50 border-none text-blue-900 placeholder:text-blue-300 font-bold" />
              </div>
              <div className="space-y-2">
                <Label className="font-black text-blue-600 uppercase text-[10px] tracking-widest">Price (₹)</Label>
                <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Amount in Rupees" className="rounded-xl h-12 bg-blue-50 border-none text-blue-900 placeholder:text-blue-300 font-bold" />
              </div>
              <div className="space-y-2">
                <Label className="font-black text-blue-600 uppercase text-[10px] tracking-widest">Store Section</Label>
                <Input value={section} onChange={(e) => setSection(e.target.value)} placeholder="e.g. Dairy Special" className="rounded-xl h-12 bg-blue-50 border-none text-blue-900 placeholder:text-blue-300 font-bold" />
              </div>
              <div className="space-y-2">
                <Label className="font-black text-blue-600 uppercase text-[10px] tracking-widest">Image URL</Label>
                <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." className="rounded-xl h-12 bg-blue-50 border-none text-blue-900 placeholder:text-blue-300 font-bold" />
              </div>
            </div>

            <div className="space-y-4">
              <Label className="font-black text-blue-600 uppercase text-[10px] tracking-widest flex items-center gap-2">
                <Ruler className="w-4 h-4" /> Select Unit (Kg / Liter / Pcs)
              </Label>
              <RadioGroup value={unit} onValueChange={setUnit} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {['gm', 'kg', 'Liter', 'Pcs'].map((u) => (
                  <div key={u} className={cn(
                    "flex items-center justify-center p-4 rounded-2xl border-2 transition-all cursor-pointer",
                    unit === u ? "border-blue-600 bg-blue-50 shadow-md scale-105" : "border-blue-100 bg-white"
                  )}>
                    <RadioGroupItem value={u} id={`unit-${u}`} className="hidden" />
                    <Label htmlFor={`unit-${u}`} className="cursor-pointer font-black text-blue-600 uppercase text-xs">
                      {u}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
            
            <div className="flex flex-wrap gap-4 py-4">
              <div className="flex items-center gap-3 bg-blue-50 p-4 rounded-2xl border border-blue-100">
                <Checkbox id="cod" checked={isCodAvailable} onCheckedChange={(v) => setIsCodAvailable(v === true)} className="border-blue-400" />
                <Label htmlFor="cod" className="cursor-pointer font-black text-blue-600 uppercase text-[10px]">Enable COD</Label>
              </div>
              <div className="flex items-center gap-3 bg-blue-50 p-4 rounded-2xl border border-blue-100">
                <Checkbox id="upi" checked={isUpiAvailable} onCheckedChange={(v) => setIsUpiAvailable(v === true)} className="border-blue-400" />
                <Label htmlFor="upi" className="cursor-pointer font-black text-blue-600 uppercase text-[10px]">Enable UPI</Label>
              </div>
              <div className="flex items-center gap-3 bg-blue-600 p-4 rounded-2xl shadow-lg">
                <Checkbox id="pin" checked={isPinned} onCheckedChange={(v) => setIsPinned(v === true)} className="border-white/50 bg-white/10" />
                <Label htmlFor="pin" className="cursor-pointer font-black text-white uppercase text-[10px]">Pin to Top</Label>
              </div>
            </div>

            <Button onClick={handleAdd} className="w-full h-20 rounded-[2rem] bg-blue-600 text-white font-black text-2xl shadow-2xl hover:bg-blue-700 hover:scale-[1.02] transition-transform uppercase tracking-tighter">
              PUBLISH TO BAZAAR
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
