
"use client"

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { FestivalTheme, THEME_DATA } from '@/app/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, addDocumentNonBlocking, setDocumentNonBlocking, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { Palette, PlusCircle, LayoutGrid, Phone, MessageCircle } from 'lucide-react';

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

  const settingsRef = useMemoFirebase(() => doc(firestore, 'storeSettings', 'mainSettings'), [firestore]);
  const { data: settings } = useDoc(settingsRef);

  useEffect(() => {
    if (settings) {
      setWhatsapp(settings.whatsappNumber || '');
      setHelpline(settings.helpLineNumber || '');
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
      lastUpdated: new Date().toISOString()
    }, { merge: true });
    toast({ title: "Settings Saved", description: "WhatsApp and Help Line numbers updated." });
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
          <Card className="rounded-[2.5rem] shadow-2xl border-none bg-white/10 backdrop-blur-xl text-white">
            <CardHeader>
              <CardTitle className="font-black flex items-center gap-2">
                <Palette className="w-6 h-6" /> GLOBAL THEME
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-3">
                {(Object.keys(THEME_DATA) as FestivalTheme[]).map((theme) => (
                  <Button 
                    key={theme}
                    onClick={() => handleUpdateTheme(theme)}
                    variant={currentTheme === theme ? "default" : "outline"}
                    className={`rounded-2xl h-14 font-bold border-white/20 ${currentTheme === theme ? 'bg-white text-black' : 'bg-transparent text-white hover:bg-white/10'}`}
                  >
                    {theme}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[2.5rem] shadow-2xl border-none bg-white/10 backdrop-blur-xl text-white">
            <CardHeader>
              <CardTitle className="font-black flex items-center gap-2">
                <Phone className="w-6 h-6" /> CONTACT SETTINGS
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="font-bold opacity-80">WhatsApp Number</Label>
                <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="e.g. 917319965930" className="rounded-xl h-12 bg-white/10 border-none text-white placeholder:text-white/40" />
              </div>
              <div className="space-y-2">
                <Label className="font-bold opacity-80">Help Line Number</Label>
                <Input value={helpline} onChange={(e) => setHelpline(e.target.value)} placeholder="e.g. 917319965930" className="rounded-xl h-12 bg-white/10 border-none text-white placeholder:text-white/40" />
              </div>
              <Button onClick={handleUpdateSettings} className="w-full h-12 rounded-xl bg-white text-black font-black hover:bg-white/90">
                SAVE CONTACTS
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Product Add Section */}
        <Card className="rounded-[2.5rem] shadow-2xl border-none lg:col-span-2 bg-white">
          <CardHeader>
            <CardTitle className="text-primary font-black flex items-center gap-2">
              <PlusCircle className="w-6 h-6" /> ADD NEW ITEM
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-bold text-gray-700">Product Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Premium Kaju Katli" className="rounded-xl h-12 bg-slate-50 border-none" />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-gray-700">Price (₹)</Label>
                <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price in Rupees" className="rounded-xl h-12 bg-slate-50 border-none" />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-gray-700">Store Section</Label>
                <Input value={section} onChange={(e) => setSection(e.target.value)} placeholder="e.g. Sweets Corner" className="rounded-xl h-12 bg-slate-50 border-none" />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-gray-700">Image URL</Label>
                <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." className="rounded-xl h-12 bg-slate-50 border-none" />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-gray-700">Unit Type</Label>
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gm">gm</SelectItem>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="Liter">Liter</SelectItem>
                    <SelectItem value="Pcs">Pcs</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-6 py-2">
              <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl">
                <Checkbox id="cod" checked={isCodAvailable} onCheckedChange={(v) => setIsCodAvailable(v === true)} />
                <Label htmlFor="cod" className="cursor-pointer font-medium">Enable COD</Label>
              </div>
              <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl">
                <Checkbox id="upi" checked={isUpiAvailable} onCheckedChange={(v) => setIsUpiAvailable(v === true)} />
                <Label htmlFor="upi" className="cursor-pointer font-medium">Enable UPI</Label>
              </div>
              <div className="flex items-center gap-3 bg-primary/5 p-3 rounded-2xl border border-primary/20">
                <Checkbox id="pin" checked={isPinned} onCheckedChange={(v) => setIsPinned(v === true)} />
                <Label htmlFor="pin" className="cursor-pointer font-black text-primary">Pin to Top</Label>
              </div>
            </div>

            <Button onClick={handleAdd} className="w-full h-16 rounded-[1.5rem] font-black text-xl shadow-xl hover:scale-[1.02] transition-transform">
              PUBLISH TO BAZAAR
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
